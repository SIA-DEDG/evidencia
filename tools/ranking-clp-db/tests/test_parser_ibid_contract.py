from ranking_clp.parser_ibid import (
    AGGREGATE_CODES,
    DIMENSION_TABLES,
    HISTORICAL_SCORE_CODES,
    INDICATOR_CODE_ALIASES,
    IBID_CURRENT_YEAR,
    IBID_HISTORY_IMPORT_YEARS,
    IBID_HISTORY_YEARS,
    IBID_INDICATOR_COUNT,
    SPECS,
    _territory_from_current,
)


def test_ibid_component_contract():
    assert IBID_CURRENT_YEAR == 2026
    assert IBID_INDICATOR_COUNT == 81
    assert IBID_HISTORY_YEARS == tuple(range(2014, 2027))
    assert IBID_HISTORY_IMPORT_YEARS == frozenset(range(2014, 2026))
    assert len(SPECS) == 31
    assert len(AGGREGATE_CODES) == 10
    assert len(HISTORICAL_SCORE_CODES) == 10
    assert sum(len(codes) for codes in DIMENSION_TABLES.values()) == 21
    assert len({spec.code for spec in SPECS}) == 31
    assert len(INDICATOR_CODE_ALIASES) == 5
    assert len(set(INDICATOR_CODE_ALIASES.values())) == 5


def test_sergipe_and_sudeste_have_distinct_parser_references():
    state_ref, state = _territory_from_current("SE", group="A")
    region_ref, region = _territory_from_current("Sudeste", group="B")
    assert state_ref == "UF:SE"
    assert region_ref == "REGIAO:SE"
    assert state.code == region.code == "SE"
    assert state.kind == "UF"
    assert region.kind == "REGIAO"
