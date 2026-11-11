from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Iterable

from sqlalchemy import create_engine, func, select, text, update
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from . import __version__
from .models import (
    ArquivoFonte,
    Base,
    CargaImportacao,
    Componente,
    ComponenteEdicao,
    DisponibilidadeComponente,
    Edicao,
    Estrutura,
    EstruturaComponente,
    ObservacaoIndicador,
    Pesquisa,
    ResultadoRanking,
    SchemaMeta,
    Territorio,
    UniversoEdicao,
)
from .parser import ParsedWorkbook


STATE_CATALOG = {
    "AC": ("12", "Acre", "N"), "AL": ("27", "Alagoas", "NE"),
    "AP": ("16", "Amapá", "N"), "AM": ("13", "Amazonas", "N"),
    "BA": ("29", "Bahia", "NE"), "CE": ("23", "Ceará", "NE"),
    "DF": ("53", "Distrito Federal", "CO"), "ES": ("32", "Espírito Santo", "SE"),
    "GO": ("52", "Goiás", "CO"), "MA": ("21", "Maranhão", "NE"),
    "MT": ("51", "Mato Grosso", "CO"), "MS": ("50", "Mato Grosso do Sul", "CO"),
    "MG": ("31", "Minas Gerais", "SE"), "PA": ("15", "Pará", "N"),
    "PB": ("25", "Paraíba", "NE"), "PR": ("41", "Paraná", "S"),
    "PE": ("26", "Pernambuco", "NE"), "PI": ("22", "Piauí", "NE"),
    "RJ": ("33", "Rio de Janeiro", "SE"), "RN": ("24", "Rio Grande do Norte", "NE"),
    "RS": ("43", "Rio Grande do Sul", "S"), "RO": ("11", "Rondônia", "N"),
    "RR": ("14", "Roraima", "N"), "SC": ("42", "Santa Catarina", "S"),
    "SP": ("35", "São Paulo", "SE"), "SE": ("28", "Sergipe", "NE"),
    "TO": ("17", "Tocantins", "N"),
}
REGIONS = {
    "N": ("1", "Norte"), "NE": ("2", "Nordeste"), "SE": ("3", "Sudeste"),
    "S": ("4", "Sul"), "CO": ("5", "Centro-Oeste"),
}


def engine_for(url: str, *, echo: bool = False) -> Engine:
    return create_engine(url, echo=echo, pool_pre_ping=True)


def initialize_database(engine: Engine) -> str:
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        row = session.get(SchemaMeta, "schema_version")
        if row is None:
            session.add(SchemaMeta(chave="schema_version", valor="4"))
            return "4"
        if row.valor == "2":
            if engine.dialect.name == "postgresql":
                session.execute(
                    text("ALTER TABLE territorio ALTER COLUMN codigo TYPE VARCHAR(80)")
                )
            elif engine.dialect.name != "sqlite":
                raise RuntimeError(
                    f"Migração automática v2→v3 não implementada para {engine.dialect.name}."
                )
            row.valor = "3"
            row.atualizado_em = datetime.now(timezone.utc)
        if row.valor == "3":
            _repair_se_territory_collision(session)
            row.valor = "4"
            row.atualizado_em = datetime.now(timezone.utc)
        if row.valor not in {"4", "5"}:
            raise RuntimeError(
                f"Versão do esquema incompatível: banco={row.valor}, importador=4/5. "
                "Bancos das versões 2 e 3 são migrados automaticamente; versões anteriores "
                "exigem migração separada."
            )
        return row.valor


def _repair_se_territory_collision(session: Session) -> None:
    """Separa Sergipe da região Sudeste em bancos criados até a versão 3."""
    region_se = session.scalar(
        select(Territorio).where(Territorio.tipo == "REGIAO", Territorio.codigo == "SE")
    )
    if region_se is None:
        return
    state_se = session.scalar(
        select(Territorio).where(Territorio.tipo == "UF", Territorio.codigo == "SE")
    )
    created_state = state_se is None
    if state_se is None:
        northeast = session.scalar(
            select(Territorio).where(Territorio.tipo == "REGIAO", Territorio.codigo == "NE")
        )
        state_se = Territorio(
            tipo="UF", codigo="SE", codigo_ibge="28", sigla="SE", nome="Sergipe",
            parent_id=northeast.id if northeast else None,
        )
        session.add(state_se)
        session.flush()
    else:
        state_se.codigo_ibge = state_se.codigo_ibge or "28"
        state_se.sigla = "SE"
        state_se.nome = "Sergipe"

    session.execute(
        update(Territorio)
        .where(
            Territorio.tipo == "MUNICIPIO",
            Territorio.parent_id == region_se.id,
            Territorio.codigo.like("MUN_SE_%"),
        )
        .values(parent_id=state_se.id)
    )
    if not created_state:
        return

    state_editions = select(Edicao.id).join(Pesquisa, Edicao.pesquisa_id == Pesquisa.id).where(
        Pesquisa.codigo == "ESTADOS"
    )
    for model in (UniversoEdicao, ObservacaoIndicador, ResultadoRanking):
        session.execute(
            update(model)
            .where(model.territorio_id == region_se.id, model.edicao_id.in_(state_editions))
            .values(territorio_id=state_se.id)
        )


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _get_or_create_research(session: Session, code: str) -> Pesquisa:
    row = session.scalar(select(Pesquisa).where(Pesquisa.codigo == code))
    if row:
        return row
    names = {
        "ESTADOS": ("Ranking de Competitividade dos Estados", "UF"),
        "MUNICIPIOS": ("Ranking de Competitividade dos Municípios", "MUNICIPIO"),
        "IBID": ("Índice Brasil de Inovação e Desenvolvimento", "UF_REGIAO_BRASIL"),
    }
    try:
        name, level = names[code]
    except KeyError as exc:
        raise ValueError(f"Pesquisa não suportada: {code}") from exc
    row = Pesquisa(codigo=code, nome=name, nivel_territorial=level)
    session.add(row)
    session.flush()
    return row


def _get_or_create_edition(session: Session, research: Pesquisa, year: int) -> Edicao:
    row = session.scalar(
        select(Edicao).where(Edicao.pesquisa_id == research.id, Edicao.ano == year)
    )
    if row:
        return row
    row = Edicao(pesquisa_id=research.id, ano=year)
    session.add(row)
    session.flush()
    return row


def _seed_territories(session: Session) -> dict[tuple[str, str], Territorio]:
    existing = {(row.tipo, row.codigo): row for row in session.scalars(select(Territorio)).all()}
    if ("BRASIL", "BR") not in existing:
        existing[("BRASIL", "BR")] = Territorio(
            tipo="BRASIL", codigo="BR", codigo_ibge="76", sigla="BR", nome="Brasil"
        )
        session.add(existing[("BRASIL", "BR")])
        session.flush()
    for code, (ibge, name) in REGIONS.items():
        key = ("REGIAO", code)
        if key not in existing:
            existing[key] = Territorio(
                tipo="REGIAO", codigo=code, codigo_ibge=ibge, sigla=code, nome=name,
                parent_id=existing[("BRASIL", "BR")].id,
            )
            session.add(existing[key])
    session.flush()
    for uf, (ibge, name, region) in STATE_CATALOG.items():
        key = ("UF", uf)
        if key not in existing:
            existing[key] = Territorio(
                tipo="UF", codigo=uf, codigo_ibge=ibge, sigla=uf, nome=name,
                parent_id=existing[("REGIAO", region)].id,
            )
            session.add(existing[key])
    session.flush()
    return existing


def _resolve_territories(session: Session, parsed: ParsedWorkbook) -> dict[str, Territorio]:
    catalog = _seed_territories(session)
    resolved: dict[str, Territorio] = {}
    for reference, data in parsed.territories.items():
        parent_kind = data.parent_kind
        if data.parent_code and not parent_kind:
            if data.parent_code == "BR":
                parent_kind = "BRASIL"
            elif data.kind == "MUNICIPIO":
                parent_kind = "UF"
            elif data.kind == "REGIAO":
                parent_kind = "BRASIL"
            elif data.kind == "UF":
                parent_kind = "REGIAO"
        parent = catalog.get((parent_kind, data.parent_code)) if data.parent_code else None
        row = catalog.get((data.kind, data.code))
        if row is None:
            row = Territorio(
                tipo=data.kind,
                codigo=data.code,
                codigo_ibge=data.ibge_code,
                sigla=data.code if data.kind in {"UF", "REGIAO", "BRASIL"} else None,
                nome=data.name,
                parent_id=parent.id if parent else None,
            )
            session.add(row)
            session.flush()
            catalog[(data.kind, data.code)] = row
        else:
            if data.ibge_code and not row.codigo_ibge:
                row.codigo_ibge = data.ibge_code
            if data.name and row.nome != data.name and data.kind == "MUNICIPIO":
                row.nome = data.name
            if parent and row.parent_id is None:
                row.parent_id = parent.id
        resolved[reference] = row
    session.flush()
    return resolved


def _decimal(value: float | None) -> Decimal | None:
    return None if value is None else Decimal(str(value))


def _as_population(value) -> int | None:
    if value in (None, "", "-"):
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _chunks(items: list[dict], size: int = 1000) -> Iterable[list[dict]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]


def import_parsed_workbook(
    engine: Engine,
    *,
    parsed: ParsedWorkbook,
    path: Path,
    research_code: str,
    edition_year: int,
    file_type: str,
    source_url: str | None = None,
) -> dict:
    initialize_database(engine)
    digest = file_sha256(path)
    research_code = research_code.upper()
    file_type = file_type.upper()

    with Session(engine) as session, session.begin():
        research = _get_or_create_research(session, research_code)
        edition = _get_or_create_edition(session, research, edition_year)
        existing_file = session.scalar(
            select(ArquivoFonte).where(
                ArquivoFonte.edicao_id == edition.id,
                ArquivoFonte.tipo == file_type,
                ArquivoFonte.sha256 == digest,
            )
        )
        if existing_file:
            successful = session.scalar(
                select(CargaImportacao).where(
                    CargaImportacao.arquivo_fonte_id == existing_file.id,
                    CargaImportacao.status == "SUCESSO",
                )
            )
            if successful:
                return {
                    "status": "IGNORADO",
                    "motivo": "O mesmo arquivo (SHA-256 idêntico) já foi importado.",
                    "arquivo_id": str(existing_file.id),
                    "carga_id": str(successful.id),
                }
        version = session.scalar(
            select(func.count(ArquivoFonte.id)).where(
                ArquivoFonte.edicao_id == edition.id, ArquivoFonte.tipo == file_type
            )
        ) + 1
        source_file = existing_file or ArquivoFonte(
            edicao_id=edition.id,
            tipo=file_type,
            nome_arquivo=path.name,
            url_origem=source_url,
            sha256=digest,
            tamanho_bytes=path.stat().st_size,
            versao=version,
            ativo=False,
            conteudo_detectado=parsed.detected_type,
        )
        if not existing_file:
            session.add(source_file)
            session.flush()
        load = CargaImportacao(
            arquivo_fonte_id=source_file.id,
            status="EM_ANDAMENTO",
            versao_importador=__version__,
            fingerprint_estrutura=parsed.schema_fingerprint,
            avisos=parsed.warnings,
        )
        session.add(load)
        session.flush()
        file_id, load_id, edition_id, research_id = source_file.id, load.id, edition.id, research.id

    try:
        with Session(engine) as session, session.begin():
            territories = _resolve_territories(session, parsed)
            component_map: dict[str, Componente] = {}
            for data in parsed.components:
                component = session.scalar(
                    select(Componente).where(
                        Componente.pesquisa_id == research_id, Componente.codigo == data.code
                    )
                )
                if component is None:
                    component = Componente(pesquisa_id=research_id, codigo=data.code, tipo=data.kind)
                    session.add(component)
                    session.flush()
                elif component.tipo != data.kind:
                    raise ValueError(f"Tipo divergente para o componente {data.code}: {component.tipo} != {data.kind}")
                component_map[data.code] = component

                values = dict(
                    nome=data.name, ordem=data.order, fonte=data.source,
                    unidade_medida=data.unit, descricao=data.description, observacoes=data.notes,
                    atualizado=data.updated, ultimo_ano_disponivel=data.latest_year,
                )
                session.add(
                    ComponenteEdicao(
                        carga_importacao_id=load_id,
                        edicao_id=edition_id,
                        componente_id=component.id,
                        **values,
                    )
                )

            for structure_data in parsed.structures:
                structure = Estrutura(
                    carga_importacao_id=load_id,
                    edicao_id=edition_id,
                    codigo=structure_data.code,
                    nome=structure_data.name,
                )
                session.add(structure)
                session.flush()
                for parent_code, child_code, order in structure_data.hierarchy:
                    session.add(
                        EstruturaComponente(
                            estrutura_id=structure.id,
                            componente_id=component_map[child_code].id,
                            parent_componente_id=component_map[parent_code].id if parent_code else None,
                            ordem_exibicao=order,
                        )
                    )

            session.add_all(
                DisponibilidadeComponente(
                    carga_importacao_id=load_id,
                    edicao_id=edition_id,
                    componente_id=component_map[code].id,
                    ano_referencia=year,
                    disponivel=available,
                )
                for code, year, available in parsed.availability
                if code in component_map
            )

            for territory_code in parsed.territories:
                if territory_code not in territories:
                    raise ValueError(f"Território não reconhecido: {territory_code}")
            included_kinds = {"UF", "MUNICIPIO"}
            if research_code == "IBID":
                included_kinds |= {"REGIAO", "BRASIL"}
            for territory_code, territory_data in sorted(parsed.territories.items()):
                if territory_data.kind not in included_kinds:
                    continue
                profile = parsed.territory_profiles.get(territory_code, {})
                population = _as_population(profile.get("População"))
                session.add(
                    UniversoEdicao(
                        carga_importacao_id=load_id,
                        edicao_id=edition_id,
                        territorio_id=territories[territory_code].id,
                        incluido=True,
                        populacao_referencia=population,
                        atributos=profile,
                    )
                )

            raw_rows = [
                dict(
                    carga_importacao_id=load_id, edicao_id=edition_id,
                    componente_id=component_map[row.component_code].id,
                    territorio_id=territories[row.territory_code].id,
                    ano_referencia=row.year, valor_bruto=_decimal(row.value),
                )
                for row in parsed.raw_values
            ]
            ranking_rows = [
                dict(
                    carga_importacao_id=load_id, edicao_id=edition_id,
                    componente_id=component_map[row.component_code].id,
                    territorio_id=territories[row.territory_code].id,
                    ano_referencia=row.year, nota_normalizada=_decimal(row.score),
                    posicao=row.position, delta_posicao=row.delta,
                )
                for row in parsed.ranking_values
            ]
            for chunk in _chunks(raw_rows):
                session.bulk_insert_mappings(ObservacaoIndicador, chunk)
            for chunk in _chunks(ranking_rows):
                session.bulk_insert_mappings(ResultadoRanking, chunk)

            session.execute(
                update(ArquivoFonte)
                .where(
                    ArquivoFonte.edicao_id == edition_id,
                    ArquivoFonte.tipo == file_type,
                    ArquivoFonte.id != file_id,
                )
                .values(ativo=False)
            )
            source_file = session.get(ArquivoFonte, file_id)
            source_file.ativo = True
            load = session.get(CargaImportacao, load_id)
            load.status = "SUCESSO"
            load.concluida_em = datetime.now(timezone.utc)
            load.linhas_gravadas = len(raw_rows) + len(ranking_rows)

        return {
            "status": "SUCESSO",
            "arquivo_id": str(file_id),
            "carga_id": str(load_id),
            "sha256": digest,
            "observacoes_brutas": len(raw_rows),
            "resultados_ranking": len(ranking_rows),
            "componentes": len(parsed.components),
        }
    except Exception as exc:
        with Session(engine) as session, session.begin():
            load = session.get(CargaImportacao, load_id)
            if load:
                load.status = "FALHA"
                load.concluida_em = datetime.now(timezone.utc)
                load.erro = str(exc)[:10000]
        raise


def database_status(engine: Engine) -> list[dict]:
    with Session(engine) as session:
        rows = session.execute(
            select(
                Pesquisa.codigo,
                Edicao.ano,
                ArquivoFonte.tipo,
                ArquivoFonte.nome_arquivo,
                ArquivoFonte.versao,
                ArquivoFonte.ativo,
                CargaImportacao.status,
                CargaImportacao.linhas_gravadas,
                CargaImportacao.concluida_em,
            )
            .join(Edicao, Edicao.pesquisa_id == Pesquisa.id)
            .join(ArquivoFonte, ArquivoFonte.edicao_id == Edicao.id)
            .join(CargaImportacao, CargaImportacao.arquivo_fonte_id == ArquivoFonte.id)
            .order_by(Edicao.ano.desc(), ArquivoFonte.tipo, ArquivoFonte.versao.desc())
        ).all()
    return [
        {
            "pesquisa": row[0], "edicao": row[1], "tipo": row[2], "arquivo": row[3],
            "versao": row[4], "ativo": row[5], "status": row[6], "linhas": row[7],
            "concluida_em": row[8].isoformat() if row[8] else None,
        }
        for row in rows
    ]


def audit_database(engine: Engine) -> dict:
    """Executa controles relacionais sem alterar fatos importados."""
    initialize_database(engine)
    with Session(engine) as session:
        version = session.scalar(
            select(SchemaMeta.valor).where(SchemaMeta.chave == "schema_version")
        )
        territories = session.scalars(select(Territorio)).all()
        by_id = {row.id: row for row in territories}
        counts: dict[str, int] = {}
        for row in territories:
            counts[row.tipo] = counts.get(row.tipo, 0) + 1

        errors: list[str] = []
        warnings: list[str] = []
        if counts.get("BRASIL", 0) != 1:
            errors.append(f"Esperado 1 território BRASIL; encontrado {counts.get('BRASIL', 0)}.")
        if counts.get("REGIAO", 0) != 5:
            errors.append(f"Esperadas 5 regiões; encontradas {counts.get('REGIAO', 0)}.")
        if counts.get("UF", 0) != 27:
            errors.append(f"Esperadas 27 UFs; encontradas {counts.get('UF', 0)}.")

        for row in territories:
            parent = by_id.get(row.parent_id) if row.parent_id else None
            if row.tipo == "REGIAO" and (parent is None or parent.tipo != "BRASIL"):
                errors.append(f"Região sem Brasil como pai: {row.codigo} - {row.nome}.")
            elif row.tipo == "UF" and (parent is None or parent.tipo != "REGIAO"):
                errors.append(f"UF sem região como pai: {row.codigo} - {row.nome}.")
            elif row.tipo == "MUNICIPIO" and (parent is None or parent.tipo != "UF"):
                errors.append(f"Município sem UF como pai: {row.codigo} - {row.nome}.")

        state_se = next(
            (row for row in territories if row.tipo == "UF" and row.codigo == "SE"), None
        )
        region_se = next(
            (row for row in territories if row.tipo == "REGIAO" and row.codigo == "SE"), None
        )
        if state_se is None or state_se.nome != "Sergipe":
            errors.append("Território UF + SE (Sergipe) ausente ou incorreto.")
        if region_se is None or region_se.nome != "Sudeste":
            errors.append("Território REGIAO + SE (Sudeste) ausente ou incorreto.")
        if state_se and region_se and state_se.id == region_se.id:
            errors.append("Sergipe e Sudeste compartilham indevidamente o mesmo território.")

        successful_researches = set(
            session.scalars(
                select(Pesquisa.codigo)
                .join(Edicao, Edicao.pesquisa_id == Pesquisa.id)
                .join(ArquivoFonte, ArquivoFonte.edicao_id == Edicao.id)
                .join(CargaImportacao, CargaImportacao.arquivo_fonte_id == ArquivoFonte.id)
                .where(CargaImportacao.status == "SUCESSO")
            ).all()
        )
        if "MUNICIPIOS" in successful_researches and counts.get("MUNICIPIO", 0) == 0:
            errors.append("Há carga municipal concluída, mas nenhum município foi encontrado.")
        elif "MUNICIPIOS" not in successful_researches:
            warnings.append("Nenhuma carga municipal concluída para auditar.")
        if "IBID" not in successful_researches:
            warnings.append("Nenhuma carga IBID concluída para auditar.")

        result_counts = dict(
            session.execute(
                select(Pesquisa.codigo, func.count(ResultadoRanking.id))
                .join(Edicao, Edicao.pesquisa_id == Pesquisa.id)
                .join(ResultadoRanking, ResultadoRanking.edicao_id == Edicao.id)
                .group_by(Pesquisa.codigo)
            ).all()
        )
    return {
        "status": "APROVADO" if not errors else "REPROVADO",
        "schema_version": version,
        "territorios": counts,
        "resultados_por_pesquisa": result_counts,
        "erros": errors,
        "avisos": warnings,
    }
