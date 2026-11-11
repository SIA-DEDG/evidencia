from ranking_clp.naming import municipal_indicator_code, municipality_code, normalize_text


def test_accent_and_case_normalization():
    assert normalize_text("Ceará-Mirim") == normalize_text("CEARA MIRIM")


def test_municipality_code_is_stable_and_uses_uf():
    assert municipality_code("Ceará-Mirim", "RN") == municipality_code("CEARA MIRIM", "rn")
    assert municipality_code("Bom Jesus", "PI") != municipality_code("Bom Jesus", "RS")
    assert len(municipality_code("São José dos Pinhais", "PR")) <= 80


def test_indicator_code_is_stable():
    assert municipal_indicator_code("Emissões de gases") == municipal_indicator_code("EMISSOES DE GASES")
