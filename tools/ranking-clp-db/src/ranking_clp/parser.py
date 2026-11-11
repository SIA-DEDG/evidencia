from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from openpyxl import load_workbook


MAIN_STATES_REQUIRED = {"Índice", "Descrições", "Geral"}
IGNORED_SHEETS = {"Índice", "Descrições", "Planilha2"}


@dataclass(slots=True)
class ComponentData:
    code: str
    kind: str
    name: str
    pillar_name: str | None = None
    pillar_code: str | None = None
    order: int | None = None
    source: str | None = None
    unit: str | None = None
    description: str | None = None
    notes: str | None = None
    updated: bool | None = None
    latest_year: int | None = None


@dataclass(slots=True)
class RawValue:
    component_code: str
    territory_code: str
    year: int
    value: float


@dataclass(slots=True)
class RankingValue:
    component_code: str
    territory_code: str
    year: int
    score: float | None = None
    position: int | None = None
    delta: int | None = None


@dataclass(slots=True)
class TerritoryData:
    code: str
    name: str
    kind: str
    parent_code: str | None = None
    ibge_code: str | None = None
    parent_kind: str | None = None


@dataclass(slots=True)
class StructureData:
    code: str
    name: str
    hierarchy: list[tuple[str | None, str, int]]


@dataclass(slots=True)
class ParsedWorkbook:
    detected_type: str
    schema_fingerprint: str
    components: list[ComponentData]
    availability: list[tuple[str, int, bool]]
    structures: list[StructureData]
    raw_values: list[RawValue]
    ranking_values: list[RankingValue]
    territories: dict[str, TerritoryData]
    territory_profiles: dict[str, dict[str, Any]]
    sheet_count: int
    warnings: list[str] = field(default_factory=list)

    def summary(self) -> dict[str, Any]:
        by_kind: dict[str, int] = {}
        for component in self.components:
            by_kind[component.kind] = by_kind.get(component.kind, 0) + 1
        return {
            "tipo_detectado": self.detected_type,
            "abas": self.sheet_count,
            "componentes": by_kind,
            "disponibilidades": len(self.availability),
            "observacoes_brutas": len(self.raw_values),
            "resultados_ranking": len(self.ranking_values),
            "territorios": len(self.territories),
            "estruturas": {structure.code: len(structure.hierarchy) for structure in self.structures},
            "fingerprint_estrutura": self.schema_fingerprint,
            "avisos": self.warnings,
        }


def _value(rows: list[tuple[Any, ...]], row: int, col: int) -> Any:
    try:
        return rows[row - 1][col - 1]
    except IndexError:
        return None


def _as_int(value: Any) -> int | None:
    if value is None or value == "-" or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(number):
        return None
    return int(round(number))


def _as_float(value: Any) -> float | None:
    if value is None or value == "-" or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _as_bool(value: Any) -> bool | None:
    if value is None or value == "":
        return None
    normalized = str(value).strip().casefold()
    if normalized in {"sim", "s", "x", "true", "1"}:
        return True
    if normalized in {"não", "nao", "n", "false", "0"}:
        return False
    return None


def _year_columns(rows: list[tuple[Any, ...]], header_row: int, start_col: int = 7) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    width = len(rows[header_row - 1]) if header_row <= len(rows) else 0
    for col in range(start_col, width + 1):
        year = _as_int(_value(rows, header_row, col))
        if year is not None and 1900 <= year <= 2200:
            result.append((col, year))
    return result


def _find_label_row(rows: list[tuple[Any, ...]], label: str, col: int = 5) -> int:
    wanted = label.strip().casefold()
    for row_number in range(1, len(rows) + 1):
        value = _value(rows, row_number, col)
        if isinstance(value, str) and value.strip().casefold() == wanted:
            return row_number
    raise ValueError(f"Rótulo obrigatório não encontrado: {label!r}")


def _table_by_territory(
    rows: list[tuple[Any, ...]], *, label: str, number_kind: str
) -> dict[tuple[str, int], float | int]:
    label_row = _find_label_row(rows, label)
    header_row = label_row + 1
    years = _year_columns(rows, header_row)
    if not years:
        raise ValueError(f"Cabeçalho de anos ausente após {label!r}")

    result: dict[tuple[str, int], float | int] = {}
    started = False
    for row_number in range(header_row + 1, len(rows) + 1):
        name = _value(rows, row_number, 5)
        code = _value(rows, row_number, 6)
        if code and isinstance(code, str) and 2 <= len(code.strip()) <= 12:
            started = True
            territory = code.strip().upper()
            for col, year in years:
                parsed = _as_int(_value(rows, row_number, col)) if number_kind == "int" else _as_float(
                    _value(rows, row_number, col)
                )
                if parsed is not None:
                    result[(territory, year)] = parsed
        elif started and name is None:
            break
    return result


def _raw_table(rows: list[tuple[Any, ...]], component_code: str) -> tuple[list[RawValue], dict[str, str]]:
    years = _year_columns(rows, 4)
    values: list[RawValue] = []
    territories: dict[str, str] = {}
    for row_number in range(6, min(len(rows), 34) + 1):
        name = _value(rows, row_number, 5)
        code = _value(rows, row_number, 6)
        if not isinstance(name, str) or not name.strip():
            continue
        territory_code = str(code).strip().upper() if code else "BR"
        if name.strip().upper() == "BRASIL":
            territory_code = "BR"
        territories[territory_code] = name.strip()
        for col, year in years:
            number = _as_float(_value(rows, row_number, col))
            if number is not None:
                values.append(RawValue(component_code, territory_code, year, number))
    return values, territories


def _ranking_tables(rows: list[tuple[Any, ...]], component_code: str) -> tuple[list[RankingValue], dict[str, str]]:
    scores = _table_by_territory(rows, label="Dados Normalizados", number_kind="float")
    positions = _table_by_territory(rows, label="Posições", number_kind="int")
    deltas = _table_by_territory(rows, label="Delta Posições", number_kind="int")
    keys = sorted(set(scores) | set(positions) | set(deltas))
    values = [
        RankingValue(
            component_code=component_code,
            territory_code=territory,
            year=year,
            score=_as_float(scores.get((territory, year))),
            position=_as_int(positions.get((territory, year))),
            delta=_as_int(deltas.get((territory, year))),
        )
        for territory, year in keys
    ]

    label_row = _find_label_row(rows, "Dados Normalizados")
    territories: dict[str, str] = {}
    for row_number in range(label_row + 2, len(rows) + 1):
        name = _value(rows, row_number, 5)
        code = _value(rows, row_number, 6)
        if isinstance(code, str) and isinstance(name, str):
            territories[code.strip().upper()] = name.strip()
        elif territories and name is None:
            break
    return values, territories


def _index_metadata(rows: list[tuple[Any, ...]]) -> tuple[dict[str, dict[str, Any]], list[tuple[str, int, bool]]]:
    headers = {str(value).strip(): col for col, value in enumerate(rows[1], start=1) if value is not None}
    required = {"Código", "Pilar", "Indicador", "Ordem", "Fonte", "Atualizado"}
    missing = required - headers.keys()
    if missing:
        raise ValueError(f"Aba Índice sem colunas obrigatórias: {sorted(missing)}")
    years = {col: int(name) for name, col in headers.items() if str(name).isdigit() and 1900 <= int(name) <= 2200}
    metadata: dict[str, dict[str, Any]] = {}
    availability: list[tuple[str, int, bool]] = []
    for row in rows[2:]:
        code = row[headers["Código"] - 1] if len(row) >= headers["Código"] else None
        if not code:
            continue
        code = str(code).strip()
        if code.casefold() == "geral":
            code = "GERAL"
        metadata[code] = {
            "pillar_name": row[headers["Pilar"] - 1],
            "name": row[headers["Indicador"] - 1],
            "order": _as_int(row[headers["Ordem"] - 1]),
            "source": row[headers["Fonte"] - 1],
            "updated": _as_bool(row[headers["Atualizado"] - 1]),
        }
        for col, year in years.items():
            marker = row[col - 1] if len(row) >= col else None
            availability.append((code, year, _as_bool(marker) is True))
    return metadata, availability


def _description_metadata(rows: list[tuple[Any, ...]]) -> dict[str, dict[str, Any]]:
    headers = {str(value).strip(): col for col, value in enumerate(rows[1], start=1) if value is not None}
    code_col = headers.get("Código")
    if not code_col:
        raise ValueError("Aba Descrições sem a coluna Código")
    result: dict[str, dict[str, Any]] = {}
    for row in rows[2:]:
        code = row[code_col - 1] if len(row) >= code_col else None
        if not code:
            continue
        def get(*names: str) -> Any:
            for name in names:
                col = headers.get(name)
                if col and len(row) >= col:
                    return row[col - 1]
            return None
        result[str(code).strip()] = {
            "unit": get("Unidade de Medida"),
            "description": get("Descrições Sintéticas", "Descrição Sintética"),
            "notes": get("Observações Gerais e Lembretes:", "Observações Gerais e Lembretes"),
        }
    return result


def _fingerprint(sheet_names: Iterable[str], indicator_codes: Iterable[str]) -> str:
    payload = json.dumps(
        {"sheets": sorted(sheet_names), "indicators": sorted(indicator_codes), "parser_schema": 1},
        ensure_ascii=False,
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def parse_main_states(path: Path) -> ParsedWorkbook:
    workbook = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    try:
        sheet_names = workbook.sheetnames
        missing = MAIN_STATES_REQUIRED - set(sheet_names)
        if missing:
            raise ValueError(f"Não parece ser a planilha principal dos Estados; faltam abas: {sorted(missing)}")

        index_rows = list(workbook["Índice"].iter_rows(values_only=True))
        description_rows = list(workbook["Descrições"].iter_rows(values_only=True))
        index, availability = _index_metadata(index_rows)
        descriptions = _description_metadata(description_rows)
        pillar_sheets: list[str] = []
        for name in sheet_names:
            if name in IGNORED_SHEETS or name == "Geral":
                continue
            rows = list(workbook[name].iter_rows(min_row=1, max_row=4, values_only=True))
            if _value(rows, 4, 3) == "Nota do Pilar":
                pillar_sheets.append(name)
        indicator_codes = {
            code
            for code, metadata in index.items()
            if str(metadata.get("name") or "").strip() not in {"Nota do Pilar", "Nota Geral"}
        }

        pillar_name_to_code: dict[str, str] = {}
        components: list[ComponentData] = [ComponentData("GERAL", "GERAL", "Ranking Geral", order=1)]
        raw_values: list[RawValue] = []
        ranking_values: list[RankingValue] = []
        territory_names: dict[str, str] = {}
        hierarchy: list[tuple[str | None, str, int]] = [(None, "GERAL", 1)]

        for display_order, sheet_name in enumerate(pillar_sheets, start=1):
            rows = list(workbook[sheet_name].iter_rows(values_only=True))
            pillar_name = str(_value(rows, 2, 3) or sheet_name).strip()
            pillar_name_to_code[pillar_name] = sheet_name
            latest = _as_int(_value(rows, _find_label_row(rows, "Dados Normalizados") + 3, 3))
            components.append(
                ComponentData(
                    sheet_name, "PILAR", pillar_name, order=_as_int(_value(rows, 6, 3)),
                    source=_value(rows, 8, 3), description=_value(rows, 10, 3),
                    unit=_value(rows, 17, 3), latest_year=latest,
                )
            )
            hierarchy.append(("GERAL", sheet_name, display_order))
            parsed_rankings, names = _ranking_tables(rows, sheet_name)
            ranking_values.extend(parsed_rankings)
            territory_names.update(names)

        general_rows = list(workbook["Geral"].iter_rows(values_only=True))
        general_latest = _as_int(_value(general_rows, _find_label_row(general_rows, "Dados Normalizados") + 3, 3))
        components[0].source = _value(general_rows, 8, 3)
        components[0].description = _value(general_rows, 10, 3)
        components[0].unit = _value(general_rows, 17, 3)
        components[0].latest_year = general_latest
        parsed_rankings, names = _ranking_tables(general_rows, "GERAL")
        ranking_values.extend(parsed_rankings)
        territory_names.update(names)

        pillar_child_order: dict[str, int] = {}
        warnings: list[str] = []
        for code in sorted(indicator_codes):
            if code not in workbook.sheetnames:
                warnings.append(f"Indicador {code} está no Índice, mas não possui aba própria.")
                continue
            rows = list(workbook[code].iter_rows(values_only=True))
            meta = index[code]
            detail = descriptions.get(code, {})
            pillar_name = str(meta.get("pillar_name") or _value(rows, 2, 3) or "").strip()
            pillar_code = pillar_name_to_code.get(pillar_name)
            if not pillar_code:
                pillar_code = code.split("_", 1)[0]
                warnings.append(f"Pilar de {code} associado pelo prefixo ({pillar_code}).")
            latest_row = _find_label_row(rows, "Dados Normalizados") + 3
            components.append(
                ComponentData(
                    code=code,
                    kind="INDICADOR",
                    name=str(meta.get("name") or _value(rows, 4, 3) or code),
                    pillar_name=pillar_name,
                    pillar_code=pillar_code,
                    order=meta.get("order"),
                    source=meta.get("source") or _value(rows, 8, 3),
                    unit=detail.get("unit") or _value(rows, 17, 3),
                    description=detail.get("description") or _value(rows, 10, 3),
                    notes=detail.get("notes"),
                    updated=meta.get("updated"),
                    latest_year=_as_int(_value(rows, latest_row, 3)),
                )
            )
            pillar_child_order[pillar_code] = pillar_child_order.get(pillar_code, 0) + 1
            hierarchy.append((pillar_code, code, pillar_child_order[pillar_code]))
            raws, raw_names = _raw_table(rows, code)
            rankings, ranking_names = _ranking_tables(rows, code)
            raw_values.extend(raws)
            ranking_values.extend(rankings)
            territory_names.update(raw_names)
            territory_names.update(ranking_names)

        territories = {
            code: TerritoryData(
                code=code,
                name=name,
                kind="BRASIL" if code == "BR" else "UF",
                parent_code=None if code == "BR" else "BR",
            )
            for code, name in territory_names.items()
        }

        return ParsedWorkbook(
            detected_type="ESTADOS_BASE_PRINCIPAL",
            schema_fingerprint=_fingerprint(sheet_names, indicator_codes),
            components=components,
            availability=availability,
            structures=[StructureData("PADRAO", "Ranking padrão", hierarchy)],
            raw_values=raw_values,
            ranking_values=ranking_values,
            territories=territories,
            territory_profiles={},
            sheet_count=len(sheet_names),
            warnings=warnings,
        )
    finally:
        workbook.close()


def parse_workbook(path: str | Path, *, research: str, file_type: str) -> ParsedWorkbook:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(path)
    research = research.upper()
    file_type = file_type.upper()
    if research == "ESTADOS" and file_type == "BASE_PRINCIPAL":
        return parse_main_states(path)
    if research == "MUNICIPIOS" and file_type == "BASE_PRINCIPAL":
        from .parser_municipal import parse_main_municipalities

        return parse_main_municipalities(path)
    if file_type == "ESG_ODS":
        from .parser_esg import parse_esg_ods

        return parse_esg_ods(path, research=research)
    if research == "IBID" and file_type == "QUADROS_COMPLETOS":
        from .parser_ibid import parse_ibid_quadros_completos

        return parse_ibid_quadros_completos(path)
    if research == "IBID" and file_type == "SERIE_HISTORICA":
        from .parser_ibid import parse_ibid_serie_historica

        return parse_ibid_serie_historica(path)
    raise NotImplementedError(
        f"Leitor ainda não validado para pesquisa={research}, tipo={file_type}. "
        "Anexe uma amostra dessa planilha antes de importá-la."
    )
