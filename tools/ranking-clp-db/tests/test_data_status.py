from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import Session

from ranking_clp.database import initialize_database, ranking_data_status
from ranking_clp.models import (
    ArquivoFonte,
    Base,
    CargaImportacao,
    Componente,
    Edicao,
    ObservacaoIndicador,
    Pesquisa,
    ResultadoRanking,
    SchemaMeta,
    Territorio,
)
from ranking_clp.parser import RankingValue, RawValue


def test_nota_sem_valor_bruto_e_marcada_quando_outros_territorios_tem_dado():
    raw = [RawValue("IND", "A", 2026, 12.5)]
    ranking = [
        RankingValue("IND", "A", 2026, score=100.0),
        RankingValue("IND", "B", 2026, score=0.0),
        # Sem valor bruto para ninguém no ano: não há como afirmar que faltou dado.
        RankingValue("IND", "B", 2025, score=0.0),
        # Componentes agregados nunca têm valor bruto.
        RankingValue("GERAL", "B", 2026, score=40.0),
        # Só posição, sem nota atribuída.
        RankingValue("IND", "C", 2026, position=3),
    ]

    assert ranking_data_status(raw, ranking) == [
        "INFORMADO",
        "SEM_DADO_FONTE",
        "INFORMADO",
        "INFORMADO",
        "INFORMADO",
    ]


def test_banco_existente_recebe_situacao_dado_e_marca_cargas_antigas():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add(SchemaMeta(chave="schema_version", valor="5"))
        pesquisa = Pesquisa(codigo="MUNICIPIOS", nome="Municípios", nivel_territorial="MUNICIPIO")
        a = Territorio(tipo="MUNICIPIO", codigo="MUN_A", nome="A")
        b = Territorio(tipo="MUNICIPIO", codigo="MUN_B", nome="B")
        session.add_all([pesquisa, a, b])
        session.flush()
        edicao = Edicao(pesquisa_id=pesquisa.id, ano=2026)
        indicador = Componente(pesquisa_id=pesquisa.id, codigo="IND", tipo="INDICADOR")
        geral = Componente(pesquisa_id=pesquisa.id, codigo="GERAL", tipo="GERAL")
        session.add_all([edicao, indicador, geral])
        session.flush()
        arquivo = ArquivoFonte(
            edicao_id=edicao.id, tipo="BASE_PRINCIPAL", nome_arquivo="municipios.xlsx",
            sha256="a" * 64, tamanho_bytes=1, versao=1, ativo=True,
            conteudo_detectado="MUNICIPIOS_BASE_PRINCIPAL",
        )
        session.add(arquivo)
        session.flush()
        carga = CargaImportacao(
            arquivo_fonte_id=arquivo.id, status="SUCESSO", versao_importador="0.5.0",
            fingerprint_estrutura="b" * 64,
        )
        session.add(carga)
        session.flush()
        comum = dict(carga_importacao_id=carga.id, edicao_id=edicao.id, ano_referencia=2026)
        session.add_all([
            ObservacaoIndicador(**comum, componente_id=indicador.id, territorio_id=a.id, valor_bruto=12),
            ResultadoRanking(**comum, componente_id=indicador.id, territorio_id=a.id, nota_normalizada=100),
            ResultadoRanking(**comum, componente_id=indicador.id, territorio_id=b.id, nota_normalizada=0),
            ResultadoRanking(**comum, componente_id=geral.id, territorio_id=b.id, nota_normalizada=40),
        ])
    # Simula um banco criado antes da coluna existir.
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE resultado_ranking DROP COLUMN situacao_dado"))

    assert initialize_database(engine) == "5"
    initialize_database(engine)  # idempotente

    with Session(engine) as session:
        rows = session.execute(
            select(Componente.codigo, Territorio.codigo, ResultadoRanking.situacao_dado)
            .join(Componente, Componente.id == ResultadoRanking.componente_id)
            .join(Territorio, Territorio.id == ResultadoRanking.territorio_id)
            .order_by(Componente.codigo, Territorio.codigo)
        ).all()
    assert [tuple(row) for row in rows] == [
        ("GERAL", "MUN_B", "INFORMADO"),
        ("IND", "MUN_A", "INFORMADO"),
        ("IND", "MUN_B", "SEM_DADO_FONTE"),
    ]
