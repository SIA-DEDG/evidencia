from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .config import database_url
from .parser import parse_workbook


def _print(value: object) -> None:
    print(json.dumps(value, ensure_ascii=False, indent=2, default=str))


def _add_file_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("arquivo", type=Path)
    parser.add_argument("--pesquisa", choices=["ESTADOS", "MUNICIPIOS", "IBID"], required=True)
    parser.add_argument(
        "--tipo",
        choices=["BASE_PRINCIPAL", "ESG_ODS", "QUADROS_COMPLETOS", "SERIE_HISTORICA"],
        required=True,
    )
    parser.add_argument("--edicao", type=int, required=True, help="Ano da edição, não o ano de referência do dado.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ranking-clp",
        description="Cria e alimenta um PostgreSQL/Supabase com planilhas do Ranking CLP e do IBID.",
    )
    parser.add_argument("--database-url", help="Sobrescreve DATABASE_URL/.env.")
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser("init-db", help="Cria as tabelas ausentes no Supabase.")
    init.add_argument("--echo-sql", action="store_true")

    validate = sub.add_parser("validate", help="Valida e resume uma planilha sem gravar no banco.")
    _add_file_options(validate)

    importer = sub.add_parser("import", help="Valida e importa uma planilha de forma idempotente.")
    _add_file_options(importer)
    importer.add_argument("--url-origem")
    importer.add_argument("--echo-sql", action="store_true")

    pair = sub.add_parser(
        "validate-ibid-pair",
        help="Confere a sobreposição de 2026 entre os quadros completos e a série histórica.",
    )
    pair.add_argument("quadros_completos", type=Path)
    pair.add_argument("serie_historica", type=Path)

    sub.add_parser("status", help="Lista arquivos e cargas existentes.")
    sub.add_parser("audit-db", help="Confere relações territoriais e totais do banco.")
    return parser


def main(argv: list[str] | None = None) -> None:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "validate":
            parsed = parse_workbook(args.arquivo, research=args.pesquisa, file_type=args.tipo)
            _print(parsed.summary())
            return
        if args.command == "validate-ibid-pair":
            from .parser_ibid import compare_ibid_pair

            _print(compare_ibid_pair(args.quadros_completos, args.serie_historica))
            return

        from .database import (
            audit_database,
            database_status,
            engine_for,
            import_parsed_workbook,
            initialize_database,
        )

        url = database_url(args.database_url)
        engine = engine_for(url, echo=getattr(args, "echo_sql", False))
        if args.command == "init-db":
            schema_version = initialize_database(engine)
            _print({"status": "SUCESSO", "schema_version": schema_version})
        elif args.command == "import":
            initialize_database(engine)
            parsed = parse_workbook(args.arquivo, research=args.pesquisa, file_type=args.tipo)
            result = import_parsed_workbook(
                engine,
                parsed=parsed,
                path=args.arquivo,
                research_code=args.pesquisa,
                edition_year=args.edicao,
                file_type=args.tipo,
                source_url=args.url_origem,
            )
            _print(result)
        elif args.command == "status":
            initialize_database(engine)
            _print(database_status(engine))
        elif args.command == "audit-db":
            _print(audit_database(engine))
    except (FileNotFoundError, ValueError, RuntimeError, NotImplementedError) as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
