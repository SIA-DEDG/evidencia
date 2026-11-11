from ranking_clp.parser import _as_bool, _as_float, _as_int


def test_missing_markers_are_null():
    assert _as_float("-") is None
    assert _as_int(None) is None


def test_number_parsing():
    assert _as_float("0") == 0.0
    assert _as_int(3.0) == 3


def test_boolean_markers():
    assert _as_bool("sim") is True
    assert _as_bool("x") is True
    assert _as_bool("não") is False

