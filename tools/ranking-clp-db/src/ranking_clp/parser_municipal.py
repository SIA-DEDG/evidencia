from __future__ import annotations

import re
import warnings
from datetime import date, datetime
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from .naming import (
    municipal_dimension_code,
    municipal_indicator_code,
    municipal_pillar_code,
    municipality_code,
    normalize_text,
)
from .parser import (
    ComponentData,
    ParsedWorkbook,
    RankingValue,
    RawValue,
    StructureData,
    TerritoryData,
    _as_bool,
    _as_float,
    _as_int,
    _fingerprint,
)

warnings.filterwarnings("ignore", message="Unknown extension is not supported.*", module="openpyxl.*")
warnings.filterwarnings("ignore", message="Conditional Formatting extension is not supported.*", module="openpyxl.*")


REQUIRED_SHEETS = {
    "Base ranking - Dados brutos",
    "Base ranking - Dados corrigidos",
    "Indicadores - Detalhamento",
    "Pilares+dimensões-Detalhamento",
    "Pesos",
    "Glossário de indicadores",
}


def _json_value(value: Any) -> Any:
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _detect_edition_year(glossary_rows: list[tuple[Any, ...]]) -> int:
    for value in reversed(glossary_rows[1]):
        match = re.search(r"\((20\d{2})\)", str(value or ""))
        if match:
            return int(match.group(1))
    raise ValueError("Não foi possível identificar o ano da edição no Glossário de indicadores.")


def _reference_year(value: Any) -> int | None:
    direct = _as_int(value)
    if direct is not None and 1900 <= direct <= 2200:
        return direct
    years = [int(year) for year in re.findall(r"(?:19|20)\d{2}", str(value or ""))]
    return max(years) if years else None


def parse_main_municipalities(path: Path) -> ParsedWorkbook:
    workbook = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    try:
        missing = REQUIRED_SHEETS - set(workbook.sheetnames)
        if missing:
            raise ValueError(f"Não parece ser a planilha principal dos Municípios; faltam abas: {sorted(missing)}")

        glossary_rows = list(workbook["Glossário de indicadores"].iter_rows(values_only=True))
        edition_year = _detect_edition_year(glossary_rows)
        indicators: list[dict[str, Any]] = []
        current_dimension = current_pillar = None
        for row in glossary_rows[2:]:
            indicator_name = row[3] if len(row) > 3 else None
            if not indicator_name:
                continue
            current_dimension = (row[1] if len(row) > 1 else None) or current_dimension
            current_pillar = (row[2] if len(row) > 2 else None) or current_pillar
            if not current_dimension or not current_pillar:
                raise ValueError(f"Indicador sem dimensão/pilar no glossário: {indicator_name}")
            polarity_text = normalize_text(row[5] if len(row) > 5 else None)
            indicators.append(
                {
                    "name": str(indicator_name).strip(),
                    "dimension": str(current_dimension).strip().title(),
                    "pillar": str(current_pillar).strip(),
                    "description": row[4] if len(row) > 4 else None,
                    "order": 1 if "positiva" in polarity_text else -1 if "negativa" in polarity_text else None,
                    "unit": row[6] if len(row) > 6 else None,
                    "notes": row[7] if len(row) > 7 else None,
                    "source": row[8] if len(row) > 8 else None,
                    "latest_year": _reference_year(row[9] if len(row) > 9 else None),
                    "updated": _as_bool(row[11] if len(row) > 11 else None),
                }
            )
        if len(indicators) != 65:
            raise ValueError(f"Esperados 65 indicadores municipais; encontrados {len(indicators)}.")

        components: list[ComponentData] = [ComponentData("GERAL", "GERAL", "Ranking Geral", order=1)]
        hierarchy: list[tuple[str | None, str, int]] = [(None, "GERAL", 1)]
        dimension_codes: dict[str, str] = {}
        pillar_codes: dict[str, str] = {}
        indicator_codes: dict[str, str] = {}

        dimension_order: list[str] = []
        pillar_order: list[tuple[str, str]] = []
        for item in indicators:
            dim_key = normalize_text(item["dimension"])
            pillar_key = normalize_text(item["pillar"])
            if dim_key not in dimension_codes:
                dimension_codes[dim_key] = municipal_dimension_code(item["dimension"])
                dimension_order.append(dim_key)
            if pillar_key not in pillar_codes:
                pillar_codes[pillar_key] = municipal_pillar_code(item["pillar"])
                pillar_order.append((dim_key, pillar_key))

        for order, dim_key in enumerate(dimension_order, start=1):
            name = next(item["dimension"] for item in indicators if normalize_text(item["dimension"]) == dim_key)
            code = dimension_codes[dim_key]
            components.append(ComponentData(code, "DIMENSAO", name, order=1))
            hierarchy.append(("GERAL", code, order))
        for dim_key, pillar_key in pillar_order:
            name = next(item["pillar"] for item in indicators if normalize_text(item["pillar"]) == pillar_key)
            code = pillar_codes[pillar_key]
            components.append(ComponentData(code, "PILAR", name, order=1))
            sibling_order = sum(1 for d, p in pillar_order[: pillar_order.index((dim_key, pillar_key)) + 1] if d == dim_key)
            hierarchy.append((dimension_codes[dim_key], code, sibling_order))

        availability: list[tuple[str, int, bool]] = []
        pillar_child_count: dict[str, int] = {}
        for item in indicators:
            code = municipal_indicator_code(item["name"])
            indicator_codes[normalize_text(item["name"])] = code
            pillar_code = pillar_codes[normalize_text(item["pillar"])]
            pillar_child_count[pillar_code] = pillar_child_count.get(pillar_code, 0) + 1
            components.append(
                ComponentData(
                    code=code,
                    kind="INDICADOR",
                    name=item["name"],
                    pillar_name=item["pillar"],
                    pillar_code=pillar_code,
                    order=item["order"],
                    source=item["source"],
                    unit=item["unit"],
                    description=item["description"],
                    notes=item["notes"],
                    updated=item["updated"],
                    latest_year=item["latest_year"],
                )
            )
            hierarchy.append((pillar_code, code, pillar_child_count[pillar_code]))
            if item["latest_year"]:
                availability.append((code, item["latest_year"], True))

        detail_rows = list(workbook["Indicadores - Detalhamento"].iter_rows(values_only=True))
        header = detail_rows[2]
        info_headers = [str(value).strip() for value in header[:21]]
        block_names = [detail_rows[1][col - 1] for col in range(22, len(header) + 1, 4)]
        if len(block_names) != 65:
            raise ValueError(f"Esperados 65 blocos em Indicadores - Detalhamento; encontrados {len(block_names)}.")
        block_codes: list[str] = []
        for name in block_names:
            code = indicator_codes.get(normalize_text(name))
            if not code:
                raise ValueError(f"Indicador da aba de detalhamento não encontrado no glossário: {name}")
            block_codes.append(code)

        territories: dict[str, TerritoryData] = {}
        profiles: dict[str, dict[str, Any]] = {}
        raw_values: list[RawValue] = []
        ranking_values: list[RankingValue] = []
        for row in detail_rows[3:]:
            uf = str(row[0] or "").strip().upper()
            name = str(row[1] or "").strip()
            if not uf or not name:
                continue
            territory_code = municipality_code(name, uf)
            ibge = str(_as_int(row[2]) or "").zfill(7)
            territories[territory_code] = TerritoryData(
                territory_code, name, "MUNICIPIO", parent_code=uf, ibge_code=ibge
            )
            profiles[territory_code] = {
                info_headers[index]: _json_value(row[index])
                for index in range(min(21, len(row)))
                if row[index] not in (None, "")
            }
            for block_index, code in enumerate(block_codes):
                start = 21 + block_index * 4
                raw = _as_float(row[start] if len(row) > start else None)
                score = _as_float(row[start + 1] if len(row) > start + 1 else None)
                position = _as_int(row[start + 2] if len(row) > start + 2 else None)
                delta = _as_int(row[start + 3] if len(row) > start + 3 else None)
                if raw is not None:
                    raw_values.append(RawValue(code, territory_code, edition_year, raw))
                if score is not None or position is not None or delta is not None:
                    ranking_values.append(RankingValue(code, territory_code, edition_year, score, position, delta))

        aggregate_rows = list(workbook["Pilares+dimensões-Detalhamento"].iter_rows(values_only=True))
        aggregate_names = [aggregate_rows[1][col - 1] for col in range(22, len(aggregate_rows[2]) + 1, 3)]
        aggregate_codes: list[str] = []
        for name in aggregate_names:
            normalized = normalize_text(name)
            if normalized == "ranking geral":
                aggregate_codes.append("GERAL")
            elif normalized.startswith("dimensao "):
                dim_name = normalized.removeprefix("dimensao ")
                if dim_name not in dimension_codes:
                    raise ValueError(f"Dimensão agregada desconhecida: {name}")
                aggregate_codes.append(dimension_codes[dim_name])
            elif normalized in pillar_codes:
                aggregate_codes.append(pillar_codes[normalized])
            else:
                raise ValueError(f"Pilar agregado desconhecido: {name}")

        for row in aggregate_rows[3:]:
            uf = str(row[0] or "").strip().upper()
            name = str(row[1] or "").strip()
            if not uf or not name:
                continue
            territory_code = municipality_code(name, uf)
            for block_index, code in enumerate(aggregate_codes):
                start = 21 + block_index * 3
                score = _as_float(row[start] if len(row) > start else None)
                position = _as_int(row[start + 1] if len(row) > start + 1 else None)
                delta = _as_int(row[start + 2] if len(row) > start + 2 else None)
                if score is not None or position is not None or delta is not None:
                    ranking_values.append(RankingValue(code, territory_code, edition_year, score, position, delta))

        fingerprint_codes = list(indicator_codes.values()) + list(pillar_codes.values()) + list(dimension_codes.values())
        return ParsedWorkbook(
            detected_type="MUNICIPIOS_BASE_PRINCIPAL",
            schema_fingerprint=_fingerprint(workbook.sheetnames, fingerprint_codes),
            components=components,
            availability=availability,
            structures=[StructureData("PADRAO", "Ranking padrão", hierarchy)],
            raw_values=raw_values,
            ranking_values=ranking_values,
            territories=territories,
            territory_profiles=profiles,
            sheet_count=len(workbook.sheetnames),
            warnings=[],
        )
    finally:
        workbook.close()
