from __future__ import annotations

import argparse
import hashlib
import json
import re
import unicodedata
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import psycopg
from openpyxl import load_workbook
from psycopg.rows import dict_row
from psycopg.types.json import Json


IMPORTER_VERSION = "governance-metadata-1.1"

SPHERE_FULL_NAMES = {
    "Exclusivo Exec. Estadual": "Exclusivo do Poder Executivo Estadual",
    "Exec. Estadual e Federal": "Poder Executivo Estadual e Federal",
    "Exec. Estadual e Municipal": "Poder Executivo Estadual e Municipal",
    "Exec. Estadual, Municipal e Federal": "Poder Executivo Estadual, Municipal e Federal",
    "Exec. Municipal": "Poder Executivo Municipal",
}


@dataclass(frozen=True)
class WeightRow:
    dimension: str | None
    dimension_weight: Decimal | None
    pillar: str
    ranking_weight: Decimal
    parent_weight: Decimal


def normalize(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"[^a-z0-9]+", " ", text.casefold()).strip()


def decimal(value: object) -> Decimal:
    if value is None or isinstance(value, bool):
        raise ValueError(f"Peso inválido: {value!r}")
    return Decimal(str(value))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def load_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def read_weights(path: Path) -> tuple[dict[str, Decimal], list[WeightRow]]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        state_sheet = workbook["Estados - Pilares"]
        state_weights: dict[str, Decimal] = {}
        for pillar, weight in state_sheet.iter_rows(min_row=4, max_col=2, values_only=True):
            if normalize(pillar) == "total":
                break
            if pillar and weight is not None:
                state_weights[str(pillar).strip()] = decimal(weight)

        municipal_sheet = workbook["Municípios - Dimensões e Pilar"]
        municipal_weights: list[WeightRow] = []
        for dimension, dimension_weight, pillar, _count, ranking_weight, parent_weight in municipal_sheet.iter_rows(
            min_row=4, max_col=6, values_only=True
        ):
            if normalize(dimension) == "total":
                break
            if not dimension or not pillar:
                continue
            municipal_weights.append(
                WeightRow(
                    dimension=str(dimension).strip(),
                    dimension_weight=decimal(dimension_weight),
                    pillar=str(pillar).strip(),
                    ranking_weight=decimal(ranking_weight),
                    parent_weight=decimal(parent_weight),
                )
            )
    finally:
        workbook.close()

    if len(state_weights) != 10:
        raise ValueError(f"Esperados 10 pesos estaduais; encontrados {len(state_weights)}.")
    if len(municipal_weights) != 13:
        raise ValueError(f"Esperados 13 pesos municipais; encontrados {len(municipal_weights)}.")
    if abs(sum(state_weights.values()) - Decimal("1")) > Decimal("0.002"):
        raise ValueError("Os pesos estaduais não totalizam aproximadamente 100%.")

    dimension_weights: dict[str, Decimal] = {}
    child_totals: defaultdict[str, Decimal] = defaultdict(Decimal)
    ranking_total = Decimal(0)
    for row in municipal_weights:
        dimension_key = normalize(row.dimension)
        previous = dimension_weights.setdefault(dimension_key, row.dimension_weight)
        if previous != row.dimension_weight:
            raise ValueError(f"Peso divergente para a dimensão {row.dimension}.")
        child_totals[dimension_key] += row.parent_weight
        ranking_total += row.ranking_weight
        if abs(row.dimension_weight * row.parent_weight - row.ranking_weight) > Decimal("0.000000001"):
            raise ValueError(f"Peso hierárquico divergente para o pilar {row.pillar}.")
    if abs(sum(dimension_weights.values()) - Decimal("1")) > Decimal("0.000000001"):
        raise ValueError("Os pesos das dimensões municipais não totalizam 100%.")
    if abs(ranking_total - Decimal("1")) > Decimal("0.000000001"):
        raise ValueError("Os pesos municipais no ranking não totalizam 100%.")
    for dimension_key, total in child_totals.items():
        if abs(total - Decimal("1")) > Decimal("0.000000001"):
            raise ValueError(f"Os pesos dos pilares de {dimension_key} não totalizam 100%.")
    return state_weights, municipal_weights


def read_spheres(path: Path) -> list[dict]:
    workbook = load_workbook(path, read_only=True, data_only=True)
    try:
        sheet = workbook["Indicadores"]
        rows = []
        for code, pillar, indicator, sphere, new_in_2026, note in sheet.iter_rows(
            min_row=2, max_col=6, values_only=True
        ):
            if not code:
                continue
            rows.append(
                {
                    "code": str(code).strip(),
                    "pillar": str(pillar or "").strip(),
                    "indicator": str(indicator or "").strip(),
                    "sphere": SPHERE_FULL_NAMES.get(
                        str(sphere or "").strip(),
                        str(sphere or "").strip(),
                    ),
                    "new_in_2026": normalize(new_in_2026) == "sim",
                    "note": str(note or "").strip() or None,
                }
            )
    finally:
        workbook.close()
    if len(rows) != 100:
        raise ValueError(f"Esperadas 100 classificações de esfera; encontradas {len(rows)}.")
    if any(not row["sphere"] for row in rows):
        raise ValueError("Há indicador sem esfera na planilha.")
    return rows


def edition_id(cursor, research: str, year: int) -> uuid.UUID:
    cursor.execute(
        """
        SELECT e.id
        FROM edicao e
        JOIN pesquisa p ON p.id = e.pesquisa_id
        WHERE p.codigo = %s AND e.ano = %s
        """,
        (research, year),
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Edição {research}/{year} não encontrada no banco.")
    return row["id"]


def active_structure(cursor, edition: uuid.UUID, research: str) -> uuid.UUID:
    structure_code = "IBID" if research == "IBID" else "PADRAO"
    cursor.execute(
        """
        SELECT s.id, count(ec.id) AS edges
        FROM estrutura s
        JOIN carga_importacao ci ON ci.id = s.carga_importacao_id AND ci.status = 'SUCESSO'
        JOIN arquivo_fonte af ON af.id = ci.arquivo_fonte_id AND af.ativo
        LEFT JOIN estrutura_componente ec ON ec.estrutura_id = s.id
        WHERE s.edicao_id = %s AND s.codigo = %s
        GROUP BY s.id, ci.concluida_em
        ORDER BY count(ec.id) DESC, ci.concluida_em DESC
        LIMIT 1
        """,
        (edition, structure_code),
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError(f"Estrutura ativa {structure_code} não encontrada para {research}.")
    return row["id"]


def components(cursor, edition: uuid.UUID, research: str) -> list[dict]:
    cursor.execute(
        """
        SELECT DISTINCT ON (c.id) c.id, c.codigo, c.tipo, ce.nome
        FROM componente c
        JOIN pesquisa p ON p.id = c.pesquisa_id
        JOIN componente_edicao ce ON ce.componente_id = c.id AND ce.edicao_id = %s
        JOIN carga_importacao ci ON ci.id = ce.carga_importacao_id AND ci.status = 'SUCESSO'
        JOIN arquivo_fonte af ON af.id = ci.arquivo_fonte_id AND af.ativo
        WHERE p.codigo = %s
        ORDER BY c.id, ci.concluida_em DESC
        """,
        (edition, research),
    )
    return cursor.fetchall()


def structure_edges(cursor, structure: uuid.UUID) -> list[dict]:
    cursor.execute(
        """
        SELECT ec.id, ec.parent_componente_id, ec.componente_id, ec.peso
        FROM estrutura_componente ec
        WHERE ec.estrutura_id = %s
        """,
        (structure,),
    )
    return cursor.fetchall()


def responsibility_load(cursor, edition: uuid.UUID) -> uuid.UUID:
    cursor.execute(
        """
        SELECT ci.id
        FROM carga_importacao ci
        JOIN arquivo_fonte af ON af.id = ci.arquivo_fonte_id
        WHERE af.edicao_id = %s AND af.tipo = 'RESPONSAVEIS_INDICADORES'
          AND af.ativo AND ci.status = 'SUCESSO'
        ORDER BY ci.concluida_em DESC
        LIMIT 1
        """,
        (edition,),
    )
    row = cursor.fetchone()
    if not row:
        raise ValueError("Carga ativa de responsáveis não encontrada.")
    return row["id"]


def validate_organization_sources(cursor, ibid_path: Path, clp_path: Path) -> None:
    actual_hashes = {"IBID": sha256(ibid_path), "CLP": sha256(clp_path)}
    cursor.execute(
        """
        SELECT p.codigo AS research, af.sha256
        FROM arquivo_fonte af
        JOIN edicao e ON e.id = af.edicao_id
        JOIN pesquisa p ON p.id = e.pesquisa_id
        JOIN carga_importacao ci ON ci.arquivo_fonte_id = af.id AND ci.status = 'SUCESSO'
        WHERE af.tipo = 'RESPONSAVEIS_INDICADORES' AND af.ativo
          AND p.codigo IN ('ESTADOS', 'MUNICIPIOS', 'IBID')
        """
    )
    active_hashes = {row["research"]: row["sha256"] for row in cursor.fetchall()}
    expected = {
        "IBID": active_hashes.get("IBID"),
        "ESTADOS": active_hashes.get("ESTADOS"),
        "MUNICIPIOS": active_hashes.get("MUNICIPIOS"),
    }
    if actual_hashes["IBID"] != expected["IBID"]:
        raise ValueError("O arquivo IBID não corresponde à carga de responsáveis ativa no banco.")
    if actual_hashes["CLP"] not in {expected["ESTADOS"]} or actual_hashes["CLP"] not in {expected["MUNICIPIOS"]}:
        raise ValueError("O arquivo CLP não corresponde às cargas de responsáveis ativas no banco.")


def responsibilities(cursor, load: uuid.UUID) -> dict[uuid.UUID, dict]:
    cursor.execute(
        """
        SELECT ri.id AS responsibility_id, ri.componente_id, ri.tipo_relacao,
               ri.esfera_predominante, ri.justificativa,
               ro.id AS link_id, ro.orgao_id, ro.papel, ro.ordem, ro.base_legal,
               o.nome AS orgao_nome
        FROM responsabilidade_indicador ri
        LEFT JOIN responsabilidade_orgao ro ON ro.responsabilidade_indicador_id = ri.id
        LEFT JOIN orgao o ON o.id = ro.orgao_id
        WHERE ri.carga_importacao_id = %s
        ORDER BY ri.componente_id, ro.ordem, o.nome
        """,
        (load,),
    )
    grouped: dict[uuid.UUID, dict] = {}
    for row in cursor.fetchall():
        entry = grouped.setdefault(
            row["componente_id"],
            {
                "id": row["responsibility_id"],
                "type": row["tipo_relacao"],
                "sphere": row["esfera_predominante"],
                "justification": row["justificativa"],
                "organizations": [],
            },
        )
        if row["link_id"]:
            entry["organizations"].append(
                {
                    "id": row["link_id"],
                    "organization_id": row["orgao_id"],
                    "organization": row["orgao_nome"],
                    "role": row["papel"],
                    "order": row["ordem"],
                    "legal_basis": row["base_legal"],
                }
            )
    return grouped


def unique_component(component_rows: list[dict], component_type: str, name: str) -> dict:
    key = normalize(name)
    matches = [row for row in component_rows if row["tipo"] == component_type and normalize(row["nome"]) == key]
    if len(matches) != 1:
        options = [row["nome"] for row in component_rows if row["tipo"] == component_type]
        raise ValueError(
            f"Componente {component_type} {name!r} teve {len(matches)} correspondências. Opções: {options}"
        )
    return matches[0]


def edge_for(edges: list[dict], child: uuid.UUID, parent: uuid.UUID | None = None) -> dict:
    matches = [row for row in edges if row["componente_id"] == child]
    if parent is not None:
        matches = [row for row in matches if row["parent_componente_id"] == parent]
    if len(matches) != 1:
        raise ValueError(f"Aresta da estrutura não é única para o componente {child} e pai {parent}.")
    return matches[0]


def build_plan(cursor, weights_path: Path, spheres_path: Path) -> dict:
    cursor.execute("SELECT valor FROM schema_meta WHERE chave = 'schema_version'")
    schema_row = cursor.fetchone()
    if not schema_row or schema_row["valor"] != "5":
        raise ValueError(f"Este importador exige schema 5; encontrado {schema_row!r}.")

    state_weights, municipal_weights = read_weights(weights_path)
    sphere_rows = read_spheres(spheres_path)
    contexts: dict[str, dict] = {}
    for research, year in (("ESTADOS", 2026), ("MUNICIPIOS", 2026), ("IBID", 2025)):
        current_edition = edition_id(cursor, research, year)
        current_structure = active_structure(cursor, current_edition, research)
        current_components = components(cursor, current_edition, research)
        current_edges = structure_edges(cursor, current_structure)
        current_load = responsibility_load(cursor, current_edition)
        contexts[research] = {
            "year": year,
            "edition": current_edition,
            "structure": current_structure,
            "components": current_components,
            "component_by_id": {row["id"]: row for row in current_components},
            "edges": current_edges,
            "responsibility_load": current_load,
            "responsibilities": responsibilities(cursor, current_load),
        }

    weight_updates: dict[uuid.UUID, dict] = {}
    state = contexts["ESTADOS"]
    for name, weight in state_weights.items():
        component = unique_component(state["components"], "PILAR", name)
        edge = edge_for(state["edges"], component["id"])
        weight_updates[edge["id"]] = {
            "research": "ESTADOS",
            "component": component["nome"],
            "old": edge["peso"],
            "new": weight,
        }

    municipal = contexts["MUNICIPIOS"]
    seen_dimensions: set[uuid.UUID] = set()
    for row in municipal_weights:
        dimension = unique_component(municipal["components"], "DIMENSAO", row.dimension or "")
        pillar = unique_component(municipal["components"], "PILAR", row.pillar)
        if dimension["id"] not in seen_dimensions:
            dimension_edge = edge_for(municipal["edges"], dimension["id"])
            weight_updates[dimension_edge["id"]] = {
                "research": "MUNICIPIOS",
                "component": dimension["nome"],
                "old": dimension_edge["peso"],
                "new": row.dimension_weight,
            }
            seen_dimensions.add(dimension["id"])
        pillar_edge = edge_for(municipal["edges"], pillar["id"], dimension["id"])
        weight_updates[pillar_edge["id"]] = {
            "research": "MUNICIPIOS",
            "component": pillar["nome"],
            "parent": dimension["nome"],
            "old": pillar_edge["peso"],
            "new": row.parent_weight,
            "ranking_weight": row.ranking_weight,
        }

    sphere_updates = []
    state_by_code = {row["codigo"]: row for row in state["components"]}
    for source_row in sphere_rows:
        component = state_by_code.get(source_row["code"])
        if not component or component["tipo"] != "INDICADOR":
            raise ValueError(f"Indicador estadual não encontrado pelo código {source_row['code']}.")
        if normalize(component["nome"]) != normalize(source_row["indicator"]):
            raise ValueError(
                f"Nome divergente para {source_row['code']}: banco={component['nome']!r}, "
                f"planilha={source_row['indicator']!r}."
            )
        responsibility = state["responsibilities"].get(component["id"])
        if not responsibility:
            raise ValueError(f"Responsabilidade não encontrada para {source_row['code']}.")
        sphere_updates.append(
            {
                "responsibility_id": responsibility["id"],
                "component_id": component["id"],
                "code": component["codigo"],
                "component": component["nome"],
                "old": responsibility["sphere"],
                "new": source_row["sphere"],
                "new_in_2026": source_row["new_in_2026"],
                "note": source_row["note"],
            }
        )

    sphere_override = {row["component_id"]: row["new"] for row in sphere_updates}
    aggregate_rows = []
    for research, context in contexts.items():
        children: defaultdict[uuid.UUID | None, list[uuid.UUID]] = defaultdict(list)
        for edge in context["edges"]:
            children[edge["parent_componente_id"]].append(edge["componente_id"])

        def indicator_descendants(component_id: uuid.UUID) -> list[uuid.UUID]:
            found: list[uuid.UUID] = []
            stack = list(children.get(component_id, []))
            visited: set[uuid.UUID] = set()
            while stack:
                child = stack.pop()
                if child in visited:
                    continue
                visited.add(child)
                child_data = context["component_by_id"].get(child)
                if child_data and child_data["tipo"] == "INDICADOR":
                    found.append(child)
                stack.extend(children.get(child, []))
            return found

        for component in context["components"]:
            if component["tipo"] not in {"PILAR", "DIMENSAO"}:
                continue
            descendants = indicator_descendants(component["id"])
            if not descendants:
                raise ValueError(f"{research}/{component['nome']} não possui indicadores descendentes.")
            organization_stats: dict[uuid.UUID, dict] = {}
            spheres: set[str] = set()
            linked_indicators = 0
            for indicator_id in descendants:
                responsibility = context["responsibilities"].get(indicator_id)
                if not responsibility:
                    continue
                linked_indicators += 1
                sphere = sphere_override.get(indicator_id, responsibility["sphere"])
                if sphere:
                    spheres.add(sphere)
                for organization in responsibility["organizations"]:
                    stats = organization_stats.setdefault(
                        organization["organization_id"],
                        {
                            "id": organization["organization_id"],
                            "name": organization["organization"],
                            "principal": 0,
                            "co_responsible": 0,
                            "legal_bases": Counter(),
                        },
                    )
                    if organization["role"] == "PRINCIPAL":
                        stats["principal"] += 1
                    else:
                        stats["co_responsible"] += 1
                    if organization["legal_basis"]:
                        stats["legal_bases"][organization["legal_basis"]] += 1
            if not organization_stats:
                raise ValueError(f"Nenhum órgão agregado para {research}/{component['nome']}.")
            organizations = sorted(
                organization_stats.values(),
                key=lambda item: (-(item["principal"] + item["co_responsible"]), -item["principal"], item["name"]),
            )
            for order, organization in enumerate(organizations, start=1):
                organization["role"] = "PRINCIPAL" if organization["principal"] else "CORRESPONSAVEL"
                organization["order"] = order
                organization["legal_basis"] = (
                    organization["legal_bases"].most_common(1)[0][0]
                    if organization["legal_bases"]
                    else None
                )
                del organization["legal_bases"]
            current = context["responsibilities"].get(component["id"])
            aggregate_rows.append(
                {
                    "research": research,
                    "year": context["year"],
                    "edition_id": context["edition"],
                    "load_id": context["responsibility_load"],
                    "component_id": component["id"],
                    "component": component["nome"],
                    "component_type": component["tipo"],
                    "existing": current,
                    "relation_type": "AGREGADA",
                    "sphere": next(iter(spheres)) if len(spheres) == 1 else "Múltipla",
                    "justification": (
                        f"Vínculo agregado automaticamente a partir de {linked_indicators} "
                        f"indicadores descendentes da edição {context['year']}."
                    ),
                    "organizations": organizations,
                }
            )

    return {
        "contexts": contexts,
        "weights": weight_updates,
        "spheres": sphere_updates,
        "aggregates": aggregate_rows,
    }


def serializable(value):
    if isinstance(value, dict):
        return {str(key): serializable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [serializable(item) for item in value]
    if isinstance(value, (uuid.UUID, Decimal, datetime)):
        return str(value)
    if isinstance(value, Counter):
        return dict(value)
    return value


def public_summary(plan: dict) -> dict:
    aggregate_by_research = Counter(row["research"] for row in plan["aggregates"])
    organization_links = Counter()
    for row in plan["aggregates"]:
        organization_links[row["research"]] += len(row["organizations"])
    return {
        "weights": {
            "total": len(plan["weights"]),
            "by_research": dict(Counter(row["research"] for row in plan["weights"].values())),
            "already_equal": sum(
                1
                for row in plan["weights"].values()
                if row["old"] is not None
                and abs(Decimal(row["old"]) - row["new"]) <= Decimal("0.000000005")
            ),
        },
        "spheres": {
            "total": len(plan["spheres"]),
            "already_equal": sum(1 for row in plan["spheres"] if row["old"] == row["new"]),
            "categories": dict(Counter(row["new"] for row in plan["spheres"])),
            "new_in_2026": sum(1 for row in plan["spheres"] if row["new_in_2026"]),
        },
        "aggregate_responsibilities": {
            "total": len(plan["aggregates"]),
            "by_research": dict(aggregate_by_research),
            "organization_links_by_research": dict(organization_links),
            "existing": sum(1 for row in plan["aggregates"] if row["existing"]),
        },
    }


def ensure_source_load(
    cursor,
    *,
    edition: uuid.UUID,
    file_type: str,
    path: Path,
    detected_type: str,
    lines_written: int,
) -> tuple[uuid.UUID, bool]:
    digest = sha256(path)
    cursor.execute(
        """
        SELECT af.id AS file_id, ci.id AS load_id
        FROM arquivo_fonte af
        JOIN carga_importacao ci ON ci.arquivo_fonte_id = af.id AND ci.status = 'SUCESSO'
        WHERE af.edicao_id = %s AND af.tipo = %s AND af.sha256 = %s
        ORDER BY ci.concluida_em DESC
        LIMIT 1
        """,
        (edition, file_type, digest),
    )
    existing = cursor.fetchone()
    if existing:
        cursor.execute(
            "UPDATE carga_importacao SET linhas_gravadas = %s WHERE id = %s",
            (lines_written, existing["load_id"]),
        )
        return existing["load_id"], False

    cursor.execute(
        "SELECT coalesce(max(versao), 0) + 1 AS version FROM arquivo_fonte WHERE edicao_id = %s AND tipo = %s",
        (edition, file_type),
    )
    version = cursor.fetchone()["version"]
    now = datetime.now(timezone.utc)
    file_id = uuid.uuid4()
    load_id = uuid.uuid4()
    cursor.execute(
        "UPDATE arquivo_fonte SET ativo = false WHERE edicao_id = %s AND tipo = %s",
        (edition, file_type),
    )
    cursor.execute(
        """
        INSERT INTO arquivo_fonte
          (id, edicao_id, tipo, nome_arquivo, url_origem, sha256, tamanho_bytes,
           versao, ativo, conteudo_detectado, criado_em)
        VALUES (%s, %s, %s, %s, NULL, %s, %s, %s, true, %s, %s)
        """,
        (
            file_id, edition, file_type, path.name, digest, path.stat().st_size,
            version, detected_type, now,
        ),
    )
    cursor.execute(
        """
        INSERT INTO carga_importacao
          (id, arquivo_fonte_id, status, iniciada_em, concluida_em, versao_importador,
           fingerprint_estrutura, linhas_gravadas, avisos, erro)
        VALUES (%s, %s, 'SUCESSO', %s, %s, %s, %s, %s, %s, NULL)
        """,
        (
            load_id, file_id, now, now, IMPORTER_VERSION, digest,
            lines_written, Json([]),
        ),
    )
    return load_id, True


def apply_plan(cursor, plan: dict, weights_path: Path, spheres_path: Path) -> dict:
    for edge_id, row in plan["weights"].items():
        cursor.execute(
            "UPDATE estrutura_componente SET peso = %s WHERE id = %s",
            (row["new"], edge_id),
        )
        if cursor.rowcount != 1:
            raise RuntimeError(f"Aresta {edge_id} não foi atualizada exatamente uma vez.")

    for row in plan["spheres"]:
        cursor.execute(
            "UPDATE responsabilidade_indicador SET esfera_predominante = %s WHERE id = %s",
            (row["new"], row["responsibility_id"]),
        )
        if cursor.rowcount != 1:
            raise RuntimeError(f"Esfera de {row['code']} não foi atualizada exatamente uma vez.")

    for row in plan["aggregates"]:
        existing = row["existing"]
        responsibility_id = existing["id"] if existing else uuid.uuid4()
        if existing:
            cursor.execute(
                """
                UPDATE responsabilidade_indicador
                SET tipo_relacao = %s, esfera_predominante = %s, justificativa = %s
                WHERE id = %s
                """,
                (row["relation_type"], row["sphere"], row["justification"], responsibility_id),
            )
            cursor.execute(
                "DELETE FROM responsabilidade_orgao WHERE responsabilidade_indicador_id = %s",
                (responsibility_id,),
            )
        else:
            cursor.execute(
                """
                INSERT INTO responsabilidade_indicador
                  (id, carga_importacao_id, edicao_id, componente_id,
                   tipo_relacao, esfera_predominante, justificativa)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    responsibility_id, row["load_id"], row["edition_id"], row["component_id"],
                    row["relation_type"], row["sphere"], row["justification"],
                ),
            )
        for organization in row["organizations"]:
            cursor.execute(
                """
                INSERT INTO responsabilidade_orgao
                  (id, responsabilidade_indicador_id, orgao_id, papel, ordem, base_legal)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (
                    uuid.uuid4(), responsibility_id, organization["id"], organization["role"],
                    organization["order"], organization["legal_basis"],
                ),
            )

    for context in plan["contexts"].values():
        cursor.execute(
            """
            UPDATE carga_importacao ci
            SET linhas_gravadas = counts.total
            FROM (
              SELECT count(DISTINCT ri.id)::int + count(ro.id)::int AS total
              FROM responsabilidade_indicador ri
              LEFT JOIN responsabilidade_orgao ro ON ro.responsabilidade_indicador_id = ri.id
              WHERE ri.carga_importacao_id = %s
            ) counts
            WHERE ci.id = %s
            """,
            (context["responsibility_load"], context["responsibility_load"]),
        )

    source_loads = []
    state = plan["contexts"]["ESTADOS"]
    municipal = plan["contexts"]["MUNICIPIOS"]
    for research, context, line_count in (
        ("ESTADOS", state, 10),
        ("MUNICIPIOS", municipal, 16),
    ):
        load_id, created = ensure_source_load(
            cursor,
            edition=context["edition"],
            file_type="PESOS_COMPONENTES",
            path=weights_path,
            detected_type=f"PESOS_{research}_2026",
            lines_written=line_count,
        )
        source_loads.append({"research": research, "type": "PESOS_COMPONENTES", "load_id": load_id, "created": created})
    load_id, created = ensure_source_load(
        cursor,
        edition=state["edition"],
        file_type="ESFERAS_INDICADORES",
        path=spheres_path,
        detected_type="ESFERAS_ESTADOS_2026",
        lines_written=100,
    )
    source_loads.append({"research": "ESTADOS", "type": "ESFERAS_INDICADORES", "load_id": load_id, "created": created})
    return {"source_loads": source_loads}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Importa pesos, esferas e vínculos agregados de governança.")
    parser.add_argument("--ibid-orgs", type=Path, required=True)
    parser.add_argument("--clp-orgs", type=Path, required=True)
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--spheres", type=Path, required=True)
    parser.add_argument("--database-url")
    parser.add_argument("--apply", action="store_true", help="Grava as alterações; sem esta opção apenas valida.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    for path in (args.ibid_orgs, args.clp_orgs, args.weights, args.spheres):
        if not path.is_file():
            raise FileNotFoundError(path)
    env = load_env(Path(".env"))
    database_url = args.database_url or env.get("SUPABASE_URL") or env.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("SUPABASE_URL ou DATABASE_URL não configurada.")

    with psycopg.connect(database_url, row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SET statement_timeout = '60s'")
            validate_organization_sources(cursor, args.ibid_orgs, args.clp_orgs)
            plan = build_plan(cursor, args.weights, args.spheres)
            summary = public_summary(plan)
            if not args.apply:
                connection.rollback()
                print(json.dumps({"status": "VALIDADO", **summary}, ensure_ascii=False, indent=2))
                return

            backup_dir = Path("backups")
            backup_dir.mkdir(exist_ok=True)
            timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_path = backup_dir / f"governance-metadata-before-{timestamp}.json"
            backup = {
                "created_at": datetime.now(timezone.utc).isoformat(),
                "weights": plan["weights"],
                "spheres": plan["spheres"],
                "aggregates": [
                    {
                        "research": row["research"],
                        "component": row["component"],
                        "component_id": row["component_id"],
                        "existing": row["existing"],
                    }
                    for row in plan["aggregates"]
                ],
            }
            backup_path.write_text(
                json.dumps(serializable(backup), ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            try:
                result = apply_plan(cursor, plan, args.weights, args.spheres)
                connection.commit()
            except Exception:
                connection.rollback()
                raise
            print(
                json.dumps(
                    {
                        "status": "IMPORTADO",
                        **summary,
                        **serializable(result),
                        "backup": str(backup_path.resolve()),
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )


if __name__ == "__main__":
    main()
