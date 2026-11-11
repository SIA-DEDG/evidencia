from __future__ import annotations

import hashlib
import re
import unicodedata


STATE_NAMES = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas",
    "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo",
    "GO": "Goiás", "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul",
    "MG": "Minas Gerais", "PA": "Pará", "PB": "Paraíba", "PR": "Paraná",
    "PE": "Pernambuco", "PI": "Piauí", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RS": "Rio Grande do Sul", "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina",
    "SP": "São Paulo", "SE": "Sergipe", "TO": "Tocantins",
}


def normalize_text(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii").casefold()
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def slug(value: object, *, max_length: int = 48) -> str:
    normalized = normalize_text(value).upper().replace(" ", "_")
    return normalized[:max_length].strip("_") or "SEM_NOME"


def stable_component_code(prefix: str, name: object) -> str:
    normalized = normalize_text(name)
    suffix = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:6].upper()
    return f"{prefix}_{slug(name, max_length=54)}_{suffix}"


def municipal_indicator_code(name: object) -> str:
    return stable_component_code("MUN_I", name)


def municipal_pillar_code(name: object) -> str:
    return stable_component_code("MUN_P", name)


def municipal_dimension_code(name: object) -> str:
    return stable_component_code("MUN_D", name)


def municipality_code(name: object, uf: object) -> str:
    normalized = normalize_text(name)
    suffix = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:8].upper()
    return f"MUN_{str(uf).strip().upper()}_{slug(name, max_length=42)}_{suffix}"


STATE_NAME_TO_CODE = {normalize_text(name): code for code, name in STATE_NAMES.items()}

