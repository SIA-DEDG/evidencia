from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from openpyxl import load_workbook

from .naming import STATE_NAMES, normalize_text, stable_component_code
from .parser import (
    ComponentData,
    ParsedWorkbook,
    RankingValue,
    StructureData,
    TerritoryData,
    _as_float,
    _as_int,
    _fingerprint,
)


IBID_CURRENT_REQUIRED = {
    "Lista de Tabelas", "Tab1A", "Tab1B", "Tab1C", "Estrutura", "Glossário",
    *(f"Tab{number}{suffix}" for number in range(2, 9) for suffix in ("A", "B")),
}
IBID_HISTORY_POSITION_SHEETS = {
    "IBID_série hist": "IBID_GERAL",
    "IBID-contexto_série hist": "IBID_CONTEXTO",
    "IBID-resultado_série hist": "IBID_RESULTADO",
}
IBID_CURRENT_YEAR = 2026
IBID_INDICATOR_COUNT = 81
IBID_HISTORY_YEARS = tuple(range(2014, IBID_CURRENT_YEAR + 1))
IBID_HISTORY_IMPORT_YEARS = frozenset(range(2014, IBID_CURRENT_YEAR))

REGION_NAMES = {
    "norte": ("N", "Norte"),
    "nordeste": ("NE", "Nordeste"),
    "sudeste": ("SE", "Sudeste"),
    "sul": ("S", "Sul"),
    "centro oeste": ("CO", "Centro-Oeste"),
}
HISTORY_REGION_CODES = {"NO": "N", "NE": "NE", "SE": "SE", "SU": "S", "CO": "CO"}


@dataclass(frozen=True, slots=True)
class IbidSpec:
    code: str
    kind: str
    name: str
    parent: str | None
    order: int


SPECS = (
    IbidSpec("IBID_GERAL", "GERAL", "IBID", None, 1),
    IbidSpec("IBID_CONTEXTO", "GRUPO", "IBID - Contexto", "IBID_GERAL", 1),
    IbidSpec("IBID_RESULTADO", "GRUPO", "IBID - Resultado", "IBID_GERAL", 2),
    IbidSpec("IBID_1_1_INSTITUICOES", "PILAR", "Instituições", "IBID_CONTEXTO", 1),
    IbidSpec("IBID_1_2_CAPITAL_HUMANO", "PILAR", "Capital humano", "IBID_CONTEXTO", 2),
    IbidSpec("IBID_1_3_INFRAESTRUTURA", "PILAR", "Infraestrutura", "IBID_CONTEXTO", 3),
    IbidSpec("IBID_1_4_ECONOMIA", "PILAR", "Economia", "IBID_CONTEXTO", 4),
    IbidSpec("IBID_1_5_NEGOCIOS", "PILAR", "Negócios", "IBID_CONTEXTO", 5),
    IbidSpec(
        "IBID_2_1_CONHECIMENTO_TECNOLOGIA", "PILAR", "Conhecimento e tecnologia",
        "IBID_RESULTADO", 1,
    ),
    IbidSpec("IBID_2_2_ECONOMIA_CRIATIVA", "PILAR", "Economia criativa", "IBID_RESULTADO", 2),
    IbidSpec(
        "IBID_1_1_1_AMBIENTE_INSTITUCIONAL", "DIMENSAO", "Ambiente institucional",
        "IBID_1_1_INSTITUICOES", 1,
    ),
    IbidSpec(
        "IBID_1_1_2_AMBIENTE_REGULATORIO", "DIMENSAO", "Ambiente regulatório",
        "IBID_1_1_INSTITUICOES", 2,
    ),
    IbidSpec(
        "IBID_1_1_3_AMBIENTE_NEGOCIOS", "DIMENSAO", "Ambiente de negócios",
        "IBID_1_1_INSTITUICOES", 3,
    ),
    IbidSpec("IBID_1_2_1_EDUCACAO_BASICA", "DIMENSAO", "Educação básica", "IBID_1_2_CAPITAL_HUMANO", 1),
    IbidSpec("IBID_1_2_2_ENSINO_SUPERIOR", "DIMENSAO", "Ensino superior", "IBID_1_2_CAPITAL_HUMANO", 2),
    IbidSpec("IBID_1_2_3_PD", "DIMENSAO", "P&D", "IBID_1_2_CAPITAL_HUMANO", 3),
    IbidSpec("IBID_1_3_1_TICS", "DIMENSAO", "TICs", "IBID_1_3_INFRAESTRUTURA", 1),
    IbidSpec(
        "IBID_1_3_2_INFRAESTRUTURA_GERAL", "DIMENSAO", "Infraestrutura geral",
        "IBID_1_3_INFRAESTRUTURA", 2,
    ),
    IbidSpec(
        "IBID_1_3_3_SUSTENTABILIDADE", "DIMENSAO", "Sustentabilidade",
        "IBID_1_3_INFRAESTRUTURA", 3,
    ),
    IbidSpec("IBID_1_4_1_CREDITO", "DIMENSAO", "Crédito", "IBID_1_4_ECONOMIA", 1),
    IbidSpec("IBID_1_4_2_INVESTIMENTO", "DIMENSAO", "Investimento", "IBID_1_4_ECONOMIA", 2),
    IbidSpec(
        "IBID_1_4_3_INDUSTRIA_COMERCIO_SERVICOS", "DIMENSAO",
        "Indústria, comércio e serviços", "IBID_1_4_ECONOMIA", 3,
    ),
    IbidSpec(
        "IBID_1_5_1_FORCA_TRABALHO_QUALIFICADA", "DIMENSAO",
        "Força de trabalho qualificada", "IBID_1_5_NEGOCIOS", 1,
    ),
    IbidSpec("IBID_1_5_2_APOIO_INOVACAO", "DIMENSAO", "Apoio à inovação", "IBID_1_5_NEGOCIOS", 2),
    IbidSpec(
        "IBID_1_5_3_ABSORCAO_CONHECIMENTO", "DIMENSAO", "Absorção de conhecimento",
        "IBID_1_5_NEGOCIOS", 3,
    ),
    IbidSpec(
        "IBID_2_1_1_CRIACAO_CONHECIMENTO", "DIMENSAO", "Criação de conhecimento",
        "IBID_2_1_CONHECIMENTO_TECNOLOGIA", 1,
    ),
    IbidSpec(
        "IBID_2_1_2_IMPACTO_CONHECIMENTO", "DIMENSAO", "Impacto do conhecimento",
        "IBID_2_1_CONHECIMENTO_TECNOLOGIA", 2,
    ),
    IbidSpec(
        "IBID_2_1_3_DIFUSAO_CONHECIMENTO", "DIMENSAO", "Difusão do conhecimento",
        "IBID_2_1_CONHECIMENTO_TECNOLOGIA", 3,
    ),
    IbidSpec(
        "IBID_2_2_1_ATIVOS_INTANGIVEIS", "DIMENSAO", "Ativos intangíveis",
        "IBID_2_2_ECONOMIA_CRIATIVA", 1,
    ),
    IbidSpec(
        "IBID_2_2_2_BENS_SERVICOS_CRIATIVOS", "DIMENSAO", "Bens e serviços criativos",
        "IBID_2_2_ECONOMIA_CRIATIVA", 2,
    ),
    IbidSpec(
        "IBID_2_2_3_CRIATIVIDADE_ONLINE", "DIMENSAO", "Criatividade online",
        "IBID_2_2_ECONOMIA_CRIATIVA", 3,
    ),
)
SPEC_BY_CODE = {spec.code: spec for spec in SPECS}
AGGREGATE_CODES = tuple(spec.code for spec in SPECS if spec.kind in {"GERAL", "GRUPO", "PILAR"})
DIMENSION_BY_NAMES = {
    (normalize_text(SPEC_BY_CODE[spec.parent].name), normalize_text(spec.name)): spec.code
    for spec in SPECS
    if spec.kind == "DIMENSAO" and spec.parent
}
DIMENSION_BY_NAMES[
    (normalize_text("Infraestrutura"), normalize_text("Tecnologias da informação e comunicação (TICs)"))
] = "IBID_1_3_1_TICS"

# O código técnico de um indicador precisa sobreviver a ajustes editoriais de
# nome, fonte ou dimensão. Estes cinco itens de 2026 continuam sendo as mesmas
# métricas publicadas em 2025; somente o sexto código novo do glossário representa
# um indicador realmente novo.
INDICATOR_CODE_ALIASES = {
    "IBID_I_CAPITAL_HUMANO_EDUCACAO_BASICA_PROPORCAO_DE_MATRICULAD_D33A80":
        "IBID_I_CAPITAL_HUMANO_EDUCACAO_BASICA_MATRICULADOS_NA_EDUCACA_38EC80",
    "IBID_I_ECONOMIA_CREDITO_DESEMBOLSOS_DIRETOS_DO_BNDES_EM_TERMO_A8E7D4":
        "IBID_I_ECONOMIA_INVESTIMENTO_DESEMBOLSOS_DIRETOS_DO_BNDES_EM_F657E2",
    "IBID_I_ECONOMIA_INVESTIMENTO_FINANCIAMENTO_DE_INVESTIMENTOS_E_BCC149":
        "IBID_I_ECONOMIA_CREDITO_FINANCIAMENTO_DE_INVESTIMENTOS_EM_INO_18A075",
    "IBID_I_CONHECIMENTO_E_TECNOLOGIA_DIFUSAO_DO_CONHECIMENTO_EXPO_89A258":
        "IBID_I_CONHECIMENTO_E_TECNOLOGIA_DIFUSAO_DO_CONHECIMENTO_EXPO_AEFF5A",
    "IBID_I_ECONOMIA_CRIATIVA_BENS_E_SERVICOS_CRIATIVOS_EMPREGOS_E_8B45C1":
        "IBID_I_ECONOMIA_CRIATIVA_BENS_E_SERVICOS_CRIATIVOS_EMPREGO_EM_D6B25E",
}

TAB1_COLUMNS = (
    ("IBID_GERAL", 3, 1),
    ("IBID_CONTEXTO", 4, 5),
    ("IBID_1_1_INSTITUICOES", 6, 7),
    ("IBID_1_2_CAPITAL_HUMANO", 8, 9),
    ("IBID_1_3_INFRAESTRUTURA", 10, 11),
    ("IBID_1_4_ECONOMIA", 12, 13),
    ("IBID_1_5_NEGOCIOS", 14, 15),
    ("IBID_RESULTADO", 16, 17),
    ("IBID_2_1_CONHECIMENTO_TECNOLOGIA", 18, 19),
    ("IBID_2_2_ECONOMIA_CRIATIVA", 20, 21),
)
HISTORICAL_SCORE_CODES = tuple(component_code for component_code, _, _ in TAB1_COLUMNS)
DIMENSION_TABLES = {
    2: ("IBID_1_1_1_AMBIENTE_INSTITUCIONAL", "IBID_1_1_2_AMBIENTE_REGULATORIO", "IBID_1_1_3_AMBIENTE_NEGOCIOS"),
    3: ("IBID_1_2_1_EDUCACAO_BASICA", "IBID_1_2_2_ENSINO_SUPERIOR", "IBID_1_2_3_PD"),
    4: ("IBID_1_3_1_TICS", "IBID_1_3_2_INFRAESTRUTURA_GERAL", "IBID_1_3_3_SUSTENTABILIDADE"),
    5: ("IBID_1_4_1_CREDITO", "IBID_1_4_2_INVESTIMENTO", "IBID_1_4_3_INDUSTRIA_COMERCIO_SERVICOS"),
    6: ("IBID_1_5_1_FORCA_TRABALHO_QUALIFICADA", "IBID_1_5_2_APOIO_INOVACAO", "IBID_1_5_3_ABSORCAO_CONHECIMENTO"),
    7: ("IBID_2_1_1_CRIACAO_CONHECIMENTO", "IBID_2_1_2_IMPACTO_CONHECIMENTO", "IBID_2_1_3_DIFUSAO_CONHECIMENTO"),
    8: ("IBID_2_2_1_ATIVOS_INTANGIVEIS", "IBID_2_2_2_BENS_SERVICOS_CRIATIVOS", "IBID_2_2_3_CRIATIVIDADE_ONLINE"),
}


def _territory_ref(kind: str, code: str) -> str:
    return f"{kind}:{code}"


def _territory_from_current(value: Any, *, group: str) -> tuple[str, TerritoryData]:
    text = str(value or "").strip()
    if group == "A":
        code = text.upper()
        if code not in STATE_NAMES:
            raise ValueError(f"UF inválida em tabela IBID: {text!r}")
        return _territory_ref("UF", code), TerritoryData(code, STATE_NAMES[code], "UF")

    normalized = normalize_text(text)
    if normalized in {"media nacional", "brasil"}:
        return _territory_ref("BRASIL", "BR"), TerritoryData("BR", "Brasil", "BRASIL")
    region = REGION_NAMES.get(normalized)
    if not region:
        raise ValueError(f"Região/total inválido em tabela IBID: {text!r}")
    code, name = region
    return _territory_ref("REGIAO", code), TerritoryData(
        code, name, "REGIAO", parent_code="BR", parent_kind="BRASIL"
    )


def _data_rows(ws, *, group: str, territory_col: int) -> list[tuple[int, str, TerritoryData]]:
    expected = 27 if group == "A" else 6
    result: list[tuple[int, str, TerritoryData]] = []
    for row in range(8, ws.max_row + 1):
        value = ws.cell(row, territory_col).value
        if value in (None, ""):
            if result:
                break
            continue
        try:
            key, territory = _territory_from_current(value, group=group)
        except ValueError:
            if result:
                break
            continue
        result.append((row, key, territory))
    if len(result) != expected:
        raise ValueError(
            f"{ws.title}: esperados {expected} territórios do grupo {group}; encontrados {len(result)}."
        )
    return result


def _base_components(*, include_dimensions: bool, include_indicators: bool, workbook=None) -> tuple[
    list[ComponentData], list[tuple[str | None, str, int]], list[str]
]:
    selected = [
        spec for spec in SPECS
        if include_dimensions or spec.kind in {"GERAL", "GRUPO", "PILAR"}
    ]
    components = [ComponentData(spec.code, spec.kind, spec.name, order=spec.order) for spec in selected]
    hierarchy = [(spec.parent, spec.code, spec.order) for spec in selected]
    warnings: list[str] = []
    if not include_indicators:
        return components, hierarchy, warnings
    if workbook is None:
        raise ValueError("Workbook obrigatório para ler o Glossário do IBID.")

    ws = workbook["Glossário"]
    indicator_order: dict[str, int] = {}
    indicator_count = 0
    for row in range(7, ws.max_row + 1):
        pillar = ws.cell(row, 2).value
        dimension = ws.cell(row, 3).value
        indicator = ws.cell(row, 4).value
        source = ws.cell(row, 5).value
        if indicator in (None, ""):
            continue
        dimension_code = DIMENSION_BY_NAMES.get((normalize_text(pillar), normalize_text(dimension)))
        if not dimension_code:
            raise ValueError(
                f"Glossário, linha {row}: dimensão não reconhecida: pilar={pillar!r}, dimensão={dimension!r}."
            )
        component_code = stable_component_code(
            "IBID_I", f"{pillar} | {dimension} | {indicator}"
        )
        component_code = INDICATOR_CODE_ALIASES.get(component_code, component_code)
        indicator_order[dimension_code] = indicator_order.get(dimension_code, 0) + 1
        components.append(
            ComponentData(
                component_code, "INDICADOR", str(indicator).strip(),
                pillar_name=str(pillar).strip() if pillar else None,
                pillar_code=dimension_code,
                order=indicator_order[dimension_code],
                source=str(source).strip() if source else None,
                notes="Definição de indicador presente no glossário; o arquivo não fornece valor bruto.",
            )
        )
        hierarchy.append((dimension_code, component_code, indicator_order[dimension_code]))
        indicator_count += 1
    if indicator_count != IBID_INDICATOR_COUNT:
        raise ValueError(
            f"Glossário do IBID: esperados {IBID_INDICATOR_COUNT} indicadores; "
            f"encontrados {indicator_count}."
        )
    return components, hierarchy, warnings


def parse_ibid_quadros_completos(path: Path) -> ParsedWorkbook:
    workbook = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    try:
        missing = IBID_CURRENT_REQUIRED - set(workbook.sheetnames)
        if missing:
            raise ValueError(f"Planilha IBID de quadros completos incompatível; faltam abas: {sorted(missing)}")
        components, hierarchy, warnings = _base_components(
            include_dimensions=True, include_indicators=True, workbook=workbook
        )
        if normalize_text(workbook["Tab4A"].cell(7, 8).value).startswith("1 2 3 sustentabilidade"):
            warnings.append(
                "A fonte identifica Sustentabilidade como 1.2.3; importada internamente como 1.3.3, sob Infraestrutura."
            )

        territories: dict[str, TerritoryData] = {}
        ranking_values: list[RankingValue] = []
        expected_by_group: dict[str, set[str]] = {}
        for group in ("A", "B"):
            ws = workbook[f"Tab1{group}"]
            rows = _data_rows(ws, group=group, territory_col=2)
            expected_by_group[group] = {key for _, key, _ in rows}
            for row, key, territory in rows:
                territories[key] = territory
                for component_code, score_col, position_col in TAB1_COLUMNS:
                    score = _as_float(ws.cell(row, score_col).value)
                    position = _as_int(ws.cell(row, position_col).value)
                    if score is None:
                        raise ValueError(f"{ws.title}!{ws.cell(row, score_col).coordinate}: nota ausente.")
                    ranking_values.append(
                        RankingValue(
                            component_code, key, IBID_CURRENT_YEAR,
                            score=score, position=position,
                        )
                    )

        for number, dimension_codes in DIMENSION_TABLES.items():
            for group in ("A", "B"):
                ws = workbook[f"Tab{number}{group}"]
                rows = _data_rows(ws, group=group, territory_col=1)
                keys = {key for _, key, _ in rows}
                if keys != expected_by_group[group]:
                    raise ValueError(f"{ws.title}: conjunto territorial diverge da Tab1{group}.")
                for row, key, territory in rows:
                    territories[key] = territory
                    for index, component_code in enumerate(dimension_codes):
                        score_col = 4 + index * 2
                        position_col = score_col + 1
                        score = _as_float(ws.cell(row, score_col).value)
                        position = _as_int(ws.cell(row, position_col).value)
                        if score is None:
                            raise ValueError(f"{ws.title}!{ws.cell(row, score_col).coordinate}: nota ausente.")
                        ranking_values.append(
                            RankingValue(
                                component_code, key, IBID_CURRENT_YEAR,
                                score=score, position=position,
                            )
                        )

        expected_components = 31 + IBID_INDICATOR_COUNT
        if len(components) != expected_components or len(territories) != 33 or len(ranking_values) != 1023:
            raise ValueError(
                f"Totais estruturais inesperados no IBID {IBID_CURRENT_YEAR}: "
                f"componentes={len(components)}, territórios={len(territories)}, resultados={len(ranking_values)}."
            )
        return ParsedWorkbook(
            detected_type="IBID_QUADROS_COMPLETOS",
            schema_fingerprint=_fingerprint(workbook.sheetnames, (c.code for c in components)),
            components=components,
            availability=[],
            structures=[StructureData("IBID", "Estrutura de classificação do IBID", hierarchy)],
            raw_values=[],
            ranking_values=ranking_values,
            territories=territories,
            territory_profiles={},
            sheet_count=len(workbook.sheetnames),
            warnings=warnings,
        )
    finally:
        workbook.close()


def _history_territories(ws) -> tuple[dict[str, TerritoryData], list[tuple[int, str]]]:
    territories: dict[str, TerritoryData] = {}
    rows: list[tuple[int, str]] = []
    for row in range(4, 31):
        code = str(ws.cell(row, 2).value or "").strip().upper()
        if code not in STATE_NAMES:
            raise ValueError(f"{ws.title}, linha {row}: UF histórica inválida: {code!r}.")
        key = _territory_ref("UF", code)
        territories[key] = TerritoryData(code, STATE_NAMES[code], "UF")
        rows.append((row, key))
    for row in range(33, 39):
        source_code = str(ws.cell(row, 2).value or "").strip().upper()
        if source_code == "BR":
            key = _territory_ref("BRASIL", "BR")
            territories[key] = TerritoryData("BR", "Brasil", "BRASIL")
        else:
            code = HISTORY_REGION_CODES.get(source_code)
            if not code:
                raise ValueError(f"{ws.title}, linha {row}: região histórica inválida: {source_code!r}.")
            name = next(name for code_name, name in REGION_NAMES.values() if code_name == code)
            key = _territory_ref("REGIAO", code)
            territories[key] = TerritoryData(
                code, name, "REGIAO", parent_code="BR", parent_kind="BRASIL"
            )
        rows.append((row, key))
    return territories, rows


def _historical_scores(
    workbook, *, years: Iterable[int]
) -> tuple[dict[str, TerritoryData], dict[tuple[str, str, int], float]]:
    selected_years = set(years)
    territories: dict[str, TerritoryData] = {}
    scores: dict[tuple[str, str, int], float] = {}
    for year in IBID_HISTORY_YEARS:
        ws = workbook[f"IBID {year}"]
        sheet_year = _as_int(ws.cell(1, 1).value)
        if sheet_year != year:
            raise ValueError(f"{ws.title}: ano interno {sheet_year!r} diverge do nome da aba.")
        sheet_territories, rows = _history_territories(ws)
        territories.update(sheet_territories)
        if year not in selected_years:
            continue
        for row, territory_key in rows:
            for component_code, col in zip(HISTORICAL_SCORE_CODES, range(3, 13), strict=True):
                score = _as_float(ws.cell(row, col).value)
                if score is None:
                    raise ValueError(f"{ws.title}!{ws.cell(row, col).coordinate}: nota histórica ausente.")
                scores[(component_code, territory_key, year)] = score
    return territories, scores


def _historical_positions(
    workbook, *, years: Iterable[int]
) -> dict[tuple[str, str, int], int]:
    selected_years = set(years)
    positions: dict[tuple[str, str, int], int] = {}
    for sheet_name, component_code in IBID_HISTORY_POSITION_SHEETS.items():
        ws = workbook[sheet_name]
        year_columns = {
            _as_int(ws.cell(7, col).value): col
            for col in range(2, ws.max_column + 1)
            if _as_int(ws.cell(7, col).value) in IBID_HISTORY_YEARS
        }
        if set(year_columns) != set(IBID_HISTORY_YEARS):
            raise ValueError(f"{sheet_name}: cabeçalho histórico de anos incompleto.")
        found_ufs: set[str] = set()
        for row in range(9, ws.max_row + 1):
            code = str(ws.cell(row, 1).value or "").strip().upper()
            if code not in STATE_NAMES:
                if found_ufs:
                    break
                continue
            found_ufs.add(code)
            territory_key = _territory_ref("UF", code)
            for year in selected_years:
                position = _as_int(ws.cell(row, year_columns[year]).value)
                if position is None:
                    raise ValueError(f"{sheet_name}, UF {code}, ano {year}: posição ausente.")
                positions[(component_code, territory_key, year)] = position
        if len(found_ufs) != 27:
            raise ValueError(f"{sheet_name}: esperadas 27 UFs; encontradas {len(found_ufs)}.")
    return positions


def parse_ibid_serie_historica(path: Path) -> ParsedWorkbook:
    workbook = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    try:
        required = set(IBID_HISTORY_POSITION_SHEETS) | {f"IBID {year}" for year in IBID_HISTORY_YEARS}
        missing = required - set(workbook.sheetnames)
        if missing:
            raise ValueError(f"Série histórica do IBID incompatível; faltam abas: {sorted(missing)}")
        components, hierarchy, warnings = _base_components(
            include_dimensions=False, include_indicators=False
        )
        territories, scores = _historical_scores(
            workbook, years=IBID_HISTORY_IMPORT_YEARS
        )
        positions = _historical_positions(workbook, years=IBID_HISTORY_IMPORT_YEARS)
        keys = sorted(set(scores) | set(positions))
        ranking_values = [
            RankingValue(
                component_code=component_code,
                territory_code=territory_key,
                year=year,
                score=scores.get((component_code, territory_key, year)),
                position=positions.get((component_code, territory_key, year)),
            )
            for component_code, territory_key, year in keys
        ]
        warnings.append(
            f"Os valores de {IBID_CURRENT_YEAR} da série histórica foram reservados para "
            f"conferência; a fonte canônica de {IBID_CURRENT_YEAR} é QUADROS_COMPLETOS."
        )
        expected_results = len(IBID_HISTORY_IMPORT_YEARS) * 33 * len(HISTORICAL_SCORE_CODES)
        if len(components) != 10 or len(territories) != 33 or len(ranking_values) != expected_results:
            raise ValueError(
                "Totais estruturais inesperados na série histórica do IBID: "
                f"componentes={len(components)}, territórios={len(territories)}, resultados={len(ranking_values)}."
            )
        return ParsedWorkbook(
            detected_type="IBID_SERIE_HISTORICA",
            schema_fingerprint=_fingerprint(workbook.sheetnames, (c.code for c in components)),
            components=components,
            availability=[
                (component.code, year, True)
                for component in components
                for year in sorted(IBID_HISTORY_IMPORT_YEARS)
            ],
            structures=[StructureData("IBID", "Estrutura histórica do IBID", hierarchy)],
            raw_values=[],
            ranking_values=ranking_values,
            territories=territories,
            territory_profiles={},
            sheet_count=len(workbook.sheetnames),
            warnings=warnings,
        )
    finally:
        workbook.close()


def compare_ibid_pair(current_path: Path, history_path: Path) -> dict[str, Any]:
    current = parse_ibid_quadros_completos(current_path)
    workbook = load_workbook(history_path, read_only=True, data_only=True, keep_links=False)
    try:
        _, historical_scores = _historical_scores(workbook, years={IBID_CURRENT_YEAR})
        historical_positions = _historical_positions(workbook, years={IBID_CURRENT_YEAR})
    finally:
        workbook.close()

    current_scores = {
        (row.component_code, row.territory_code, row.year): row.score
        for row in current.ranking_values
        if row.component_code in AGGREGATE_CODES and row.year == IBID_CURRENT_YEAR
    }
    current_positions = {
        (row.component_code, row.territory_code, row.year): row.position
        for row in current.ranking_values
        if row.component_code in set(IBID_HISTORY_POSITION_SHEETS.values())
        and row.territory_code.startswith("UF:")
        and row.year == IBID_CURRENT_YEAR
    }
    differences: list[dict[str, Any]] = []
    for key in sorted(set(current_scores) | set(historical_scores)):
        current_value = current_scores.get(key)
        historical_value = historical_scores.get(key)
        if current_value is None or historical_value is None or abs(current_value - historical_value) > 1e-12:
            differences.append(
                {"tipo": "NOTA", "chave": key, "quadros": current_value, "historico": historical_value}
            )
    for key in sorted(set(current_positions) | set(historical_positions)):
        current_value = current_positions.get(key)
        historical_value = historical_positions.get(key)
        if current_value != historical_value:
            differences.append(
                {"tipo": "POSICAO", "chave": key, "quadros": current_value, "historico": historical_value}
            )
    return {
        "status": "SUCESSO" if not differences else "DIVERGENCIA",
        "notas_comparadas": len(set(current_scores) | set(historical_scores)),
        "posicoes_comparadas": len(set(current_positions) | set(historical_positions)),
        "divergencias": differences,
    }
