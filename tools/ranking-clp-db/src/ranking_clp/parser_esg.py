from __future__ import annotations

import re
import warnings
from pathlib import Path
from typing import Any

from openpyxl import load_workbook

from .naming import (
    STATE_NAME_TO_CODE,
    STATE_NAMES,
    municipal_indicator_code,
    municipality_code,
    normalize_text,
)
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

warnings.filterwarnings("ignore", message="Unknown extension is not supported.*", module="openpyxl.*")
warnings.filterwarnings("ignore", message="Conditional Formatting extension is not supported.*", module="openpyxl.*")


ESG_COMPONENTS = {
    "E": ("ESG_E", "Ambiental"),
    "S": ("ESG_S", "Social"),
    "G": ("ESG_G", "Governança"),
}
MUNICIPALITY_UF_CORRECTIONS = {("ceara mirim", "CE"): "RN"}


def _ods_numbers_from_codes(value: Any) -> set[int]:
    return {int(number) for number in re.findall(r"\d+", str(value or "")) if 1 <= int(number) <= 17}


def _ods_numbers_from_targets(value: Any) -> set[int]:
    return {
        int(number)
        for number in re.findall(r"(?<!\d)(\d{1,2})(?=\.)", str(value or ""))
        if 1 <= int(number) <= 17
    }


def _headers(row: tuple[Any, ...]) -> dict[int, str]:
    return {index: normalize_text(value) for index, value in enumerate(row) if value not in (None, "")}


def _find_exact(headers: dict[int, str], *candidates: str) -> int | None:
    normalized = {normalize_text(candidate) for candidate in candidates}
    return next((column for column, text in headers.items() if text in normalized), None)


def _parse_metric_block(
    *,
    row: tuple[Any, ...],
    headers: dict[int, str],
    component_code: str,
    label: str,
    territory_code: str,
    total_kind: str | None = None,
) -> list[RankingValue]:
    if total_kind == "ESG":
        score_col = _find_exact(headers, "Média ESG", "Média do normalizado Total geral ESG")
        position_pattern = re.compile(r"^(?:ranking|posicao) esg (20\d{2})$")
        delta_col = _find_exact(headers, "Delta posição ESG", "Delta de posição ESG")
    elif total_kind == "ODS":
        score_col = _find_exact(headers, "Média ODS", "Nota ODS")
        position_pattern = re.compile(r"^ranking(?: ods)? (20\d{2})$")
        delta_col = _find_exact(headers, "Delta posição ODS", "Delta de posição ODS")
    else:
        score_col = _find_exact(headers, f"{label} normalizado")
        position_pattern = re.compile(
            rf"^(?:ranking|posicao) {re.escape(normalize_text(label))} (20\d{{2}})$"
        )
        delta_candidates = [f"Delta posição {label}", f"Delta de posição {label}"]
        if component_code in {"ESG_E", "ESG_S", "ESG_G"}:
            delta_candidates.extend(
                [f"Delta posição {component_code[-1]}", f"Delta de posição {component_code[-1]}"]
            )
        delta_col = _find_exact(headers, *delta_candidates)

    positions: dict[int, int] = {}
    for column, text in headers.items():
        match = position_pattern.match(text)
        if match:
            value = _as_int(row[column] if len(row) > column else None)
            if value is not None:
                positions[int(match.group(1))] = value
    current_year = max(positions) if positions else None
    score = _as_float(row[score_col] if score_col is not None and len(row) > score_col else None)
    delta = _as_int(row[delta_col] if delta_col is not None and len(row) > delta_col else None)
    if current_year is None and (score is not None or delta is not None):
        raise ValueError(f"Bloco {label} possui nota/delta, mas não possui coluna de posição anual.")

    result = [
        RankingValue(
            component_code,
            territory_code,
            year,
            score if year == current_year else None,
            position,
            delta if year == current_year else None,
        )
        for year, position in sorted(positions.items())
    ]
    if current_year is not None and current_year not in positions and (score is not None or delta is not None):
        result.append(RankingValue(component_code, territory_code, current_year, score, None, delta))
    return result


def _state_territory(name: Any) -> tuple[str, TerritoryData] | None:
    code = STATE_NAME_TO_CODE.get(normalize_text(name))
    if not code:
        return None
    return code, TerritoryData(code, STATE_NAMES[code], "UF", parent_code="BR")


def _municipality_territory(name: Any, uf_value: Any, warnings: list[str]) -> tuple[str, TerritoryData]:
    municipality_name = str(name).strip()
    uf = str(uf_value).strip().upper()
    correction = MUNICIPALITY_UF_CORRECTIONS.get((normalize_text(municipality_name), uf))
    if correction:
        warnings.append(
            f"UF corrigida estruturalmente para {municipality_name}: arquivo={uf}, referência municipal={correction}."
        )
        uf = correction
    code = municipality_code(municipality_name, uf)
    return code, TerritoryData(code, municipality_name, "MUNICIPIO", parent_code=uf)


def _parse_rankings(
    workbook,
    *,
    research: str,
    warnings: list[str],
) -> tuple[list[RankingValue], dict[str, TerritoryData]]:
    results: list[RankingValue] = []
    territories: dict[str, TerritoryData] = {}
    for sheet_name, family in (("Ranking ESG", "ESG"), ("Ranking ODS", "ODS")):
        rows = list(workbook[sheet_name].iter_rows(values_only=True))
        header_row = 2
        headers = _headers(rows[header_row - 1])
        for row in rows[header_row:]:
            name = row[0] if row else None
            if not name or normalize_text(name) in {"maximo", "minimo"}:
                continue
            if research == "ESTADOS":
                resolved = _state_territory(name)
                if not resolved:
                    continue
                territory_code, territory = resolved
            else:
                uf = row[1] if len(row) > 1 else None
                if not uf:
                    continue
                territory_code, territory = _municipality_territory(name, uf, warnings)
            territories[territory_code] = territory

            if family == "ESG":
                for letter, (code, label) in ESG_COMPONENTS.items():
                    results.extend(
                        _parse_metric_block(
                            row=row, headers=headers, component_code=code, label=label,
                            territory_code=territory_code,
                        )
                    )
                results.extend(
                    _parse_metric_block(
                        row=row, headers=headers, component_code="ESG_TOTAL", label="ESG",
                        territory_code=territory_code, total_kind="ESG",
                    )
                )
            else:
                for number in range(1, 18):
                    code = f"ODS_{number:02d}"
                    results.extend(
                        _parse_metric_block(
                            row=row, headers=headers, component_code=code, label=f"ODS {number}",
                            territory_code=territory_code,
                        )
                    )
                results.extend(
                    _parse_metric_block(
                        row=row, headers=headers, component_code="ODS_TOTAL", label="ODS",
                        territory_code=territory_code, total_kind="ODS",
                    )
                )
    return results, territories


def parse_esg_ods(path: Path, *, research: str) -> ParsedWorkbook:
    research = research.upper()
    workbook = load_workbook(path, read_only=True, data_only=True, keep_links=False)
    try:
        required = {"Ranking ESG", "Ranking ODS"}
        if research == "ESTADOS":
            required.add("Índice CLP + ODS e ESG")
            matrix_sheet, start_row = "Índice CLP + ODS e ESG", 3
        elif research == "MUNICIPIOS":
            required.add("Matriz")
            matrix_sheet, start_row = "Matriz", 4
        else:
            raise ValueError(f"Pesquisa desconhecida: {research}")
        missing = required - set(workbook.sheetnames)
        if missing:
            raise ValueError(f"Planilha ESG/ODS incompatível com {research}; faltam abas: {sorted(missing)}")

        components: list[ComponentData] = [
            ComponentData("ESG_TOTAL", "ESG", "ESG Geral"),
            *(ComponentData(code, "ESG", name) for code, name in ESG_COMPONENTS.values()),
            ComponentData("ODS_TOTAL", "ODS", "ODS Geral"),
            *(ComponentData(f"ODS_{number:02d}", "ODS", f"ODS {number}") for number in range(1, 18)),
        ]
        esg_hierarchy: list[tuple[str | None, str, int]] = [(None, "ESG_TOTAL", 1)]
        ods_hierarchy: list[tuple[str | None, str, int]] = [(None, "ODS_TOTAL", 1)]
        for order, letter in enumerate(("E", "S", "G"), start=1):
            esg_hierarchy.append(("ESG_TOTAL", ESG_COMPONENTS[letter][0], order))
        for number in range(1, 18):
            ods_hierarchy.append(("ODS_TOTAL", f"ODS_{number:02d}", number))

        relation_order_esg = {letter: 0 for letter in ESG_COMPONENTS}
        relation_order_ods = {number: 0 for number in range(1, 18)}
        matrix_rows = list(workbook[matrix_sheet].iter_rows(values_only=True))
        indicator_codes: list[str] = []
        for row in matrix_rows[start_row - 1 :]:
            if research == "ESTADOS":
                source_code = row[1] if len(row) > 1 else None
                name = row[3] if len(row) > 3 else None
                pillar = row[2] if len(row) > 2 else None
                esg_value = row[6] if len(row) > 6 else None
                ods_numbers = _ods_numbers_from_codes(row[4] if len(row) > 4 else None)
                code = str(source_code).strip() if source_code else None
            else:
                name = row[3] if len(row) > 3 else None
                pillar = row[2] if len(row) > 2 else None
                esg_value = row[6] if len(row) > 6 else None
                ods_numbers = _ods_numbers_from_targets(row[7] if len(row) > 7 else None)
                code = municipal_indicator_code(name) if name else None
            if not code or not name:
                continue
            indicator_codes.append(code)
            components.append(
                ComponentData(code, "INDICADOR", str(name).strip(), pillar_name=str(pillar or "").strip())
            )
            for letter in sorted(set(str(esg_value or "").upper()) & set(ESG_COMPONENTS)):
                relation_order_esg[letter] += 1
                esg_hierarchy.append((ESG_COMPONENTS[letter][0], code, relation_order_esg[letter]))
            for number in sorted(ods_numbers):
                relation_order_ods[number] += 1
                ods_hierarchy.append((f"ODS_{number:02d}", code, relation_order_ods[number]))

        expected = 100 if research == "ESTADOS" else 65
        if len(indicator_codes) != expected:
            raise ValueError(f"Esperados {expected} indicadores na matriz ESG/ODS; encontrados {len(indicator_codes)}.")
        warnings: list[str] = []
        ranking_values, territories = _parse_rankings(workbook, research=research, warnings=warnings)
        warnings = list(dict.fromkeys(warnings))
        detected = f"{research}_ESG_ODS"
        return ParsedWorkbook(
            detected_type=detected,
            schema_fingerprint=_fingerprint(workbook.sheetnames, indicator_codes),
            components=components,
            availability=[],
            structures=[
                StructureData("ESG", "Estrutura ESG", esg_hierarchy),
                StructureData("ODS", "Objetivos de Desenvolvimento Sustentável", ods_hierarchy),
            ],
            raw_values=[],
            ranking_values=ranking_values,
            territories=territories,
            territory_profiles={},
            sheet_count=len(workbook.sheetnames),
            warnings=warnings,
        )
    finally:
        workbook.close()
