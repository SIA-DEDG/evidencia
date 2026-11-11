from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote


def load_dotenv(path: Path = Path(".env")) -> None:
    """Carrega um .env simples sem sobrescrever variáveis já definidas."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def database_url(explicit: str | None = None) -> str:
    load_dotenv()
    value = explicit or os.getenv("DATABASE_URL") or os.getenv("SUPABASE_URL")
    if not value:
        raise RuntimeError(
            "DATABASE_URL ou SUPABASE_URL não definida. Informe a URI do Supabase no .env."
        )
    if value.startswith("postgres://"):
        value = "postgresql+psycopg://" + value[len("postgres://") :]
    elif value.startswith("postgresql://") and "+psycopg" not in value:
        value = "postgresql+psycopg://" + value[len("postgresql://") :]
    return value


def build_database_url(
    *, host: str, user: str, password: str, database: str = "postgres", port: int = 5432
) -> str:
    """Ajuda opcional para senhas que contenham @, :, / ou outros caracteres reservados."""
    return (
        f"postgresql+psycopg://{quote(user, safe='')}:{quote(password, safe='')}"
        f"@{host}:{port}/{database}?sslmode=require"
    )

