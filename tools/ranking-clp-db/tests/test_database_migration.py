from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from ranking_clp.database import initialize_database
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
    UniversoEdicao,
)


def test_territory_code_supports_municipal_identifiers():
    assert Territorio.__table__.c.codigo.type.length == 80


def test_schema_v2_is_upgraded_to_v4():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add(SchemaMeta(chave="schema_version", valor="2"))

    initialize_database(engine)

    with Session(engine) as session:
        version = session.scalar(select(SchemaMeta.valor).where(SchemaMeta.chave == "schema_version"))
    assert version == "4"


def test_schema_v5_is_accepted_without_downgrade():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add(SchemaMeta(chave="schema_version", valor="5"))

    initialize_database(engine)

    with Session(engine) as session:
        version = session.scalar(select(SchemaMeta.valor).where(SchemaMeta.chave == "schema_version"))
    assert version == "5"


def test_schema_v3_repairs_sergipe_and_sudeste_collision():
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session, session.begin():
        session.add(SchemaMeta(chave="schema_version", valor="3"))
        brasil = Territorio(tipo="BRASIL", codigo="BR", nome="Brasil")
        session.add(brasil)
        session.flush()
        nordeste = Territorio(tipo="REGIAO", codigo="NE", nome="Nordeste", parent_id=brasil.id)
        sudeste = Territorio(tipo="REGIAO", codigo="SE", nome="Sudeste", parent_id=brasil.id)
        session.add_all([nordeste, sudeste])
        session.flush()
        municipio = Territorio(
            tipo="MUNICIPIO", codigo="MUN_SE_ARACAJU_TESTE", nome="Aracaju", parent_id=sudeste.id
        )
        pesquisa = Pesquisa(codigo="ESTADOS", nome="Estados", nivel_territorial="UF")
        session.add_all([municipio, pesquisa])
        session.flush()
        edicao = Edicao(pesquisa_id=pesquisa.id, ano=2026)
        session.add(edicao)
        session.flush()
        arquivo = ArquivoFonte(
            edicao_id=edicao.id, tipo="BASE_PRINCIPAL", nome_arquivo="estados.xlsx",
            sha256="a" * 64, tamanho_bytes=1, versao=1, ativo=True,
            conteudo_detectado="ESTADOS_BASE_PRINCIPAL",
        )
        componente = Componente(pesquisa_id=pesquisa.id, codigo="GERAL", tipo="GERAL")
        session.add_all([arquivo, componente])
        session.flush()
        carga = CargaImportacao(
            arquivo_fonte_id=arquivo.id, status="SUCESSO", versao_importador="0.3.0",
            fingerprint_estrutura="b" * 64,
        )
        session.add(carga)
        session.flush()
        session.add_all([
            UniversoEdicao(
                carga_importacao_id=carga.id, edicao_id=edicao.id,
                territorio_id=sudeste.id, incluido=True,
            ),
            ObservacaoIndicador(
                carga_importacao_id=carga.id, edicao_id=edicao.id,
                componente_id=componente.id, territorio_id=sudeste.id,
                ano_referencia=2025, valor_bruto=1,
            ),
            ResultadoRanking(
                carga_importacao_id=carga.id, edicao_id=edicao.id,
                componente_id=componente.id, territorio_id=sudeste.id,
                ano_referencia=2025, nota_normalizada=1, posicao=1,
            ),
        ])

    initialize_database(engine)

    with Session(engine) as session:
        version = session.get(SchemaMeta, "schema_version")
        sergipe = session.scalar(
            select(Territorio).where(Territorio.tipo == "UF", Territorio.codigo == "SE")
        )
        sudeste = session.scalar(
            select(Territorio).where(Territorio.tipo == "REGIAO", Territorio.codigo == "SE")
        )
        municipio = session.scalar(select(Territorio).where(Territorio.tipo == "MUNICIPIO"))
        universo = session.scalar(select(UniversoEdicao))
        observacao = session.scalar(select(ObservacaoIndicador))
        resultado = session.scalar(select(ResultadoRanking))
        assert version.valor == "4"
        assert sergipe is not None and sergipe.nome == "Sergipe" and sergipe.codigo_ibge == "28"
        assert sudeste is not None and sudeste.id != sergipe.id
        assert municipio.parent_id == sergipe.id
        assert universo.territorio_id == sergipe.id
        assert observacao.territorio_id == sergipe.id
        assert resultado.territorio_id == sergipe.id
