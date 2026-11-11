from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def new_uuid() -> uuid.UUID:
    return uuid.uuid4()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Pesquisa(Base):
    __tablename__ = "pesquisa"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    nivel_territorial: Mapped[str] = mapped_column(String(20), nullable=False)


class Edicao(Base):
    __tablename__ = "edicao"
    __table_args__ = (UniqueConstraint("pesquisa_id", "ano", name="uq_edicao_pesquisa_ano"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    pesquisa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pesquisa.id"), nullable=False)
    ano: Mapped[int] = mapped_column(Integer, nullable=False)


class ArquivoFonte(Base):
    __tablename__ = "arquivo_fonte"
    __table_args__ = (
        UniqueConstraint("edicao_id", "tipo", "sha256", name="uq_arquivo_edicao_tipo_hash"),
        UniqueConstraint("edicao_id", "tipo", "versao", name="uq_arquivo_edicao_tipo_versao"),
        Index("ix_arquivo_edicao_tipo_ativo", "edicao_id", "tipo", "ativo"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    edicao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("edicao.id"), nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)
    nome_arquivo: Mapped[str] = mapped_column(String(300), nullable=False)
    url_origem: Mapped[str | None] = mapped_column(Text)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    tamanho_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    versao: Mapped[int] = mapped_column(Integer, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    conteudo_detectado: Mapped[str] = mapped_column(String(50), nullable=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class CargaImportacao(Base):
    __tablename__ = "carga_importacao"
    __table_args__ = (Index("ix_carga_arquivo_status", "arquivo_fonte_id", "status"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    arquivo_fonte_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("arquivo_fonte.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    iniciada_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    concluida_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    versao_importador: Mapped[str] = mapped_column(String(30), nullable=False)
    fingerprint_estrutura: Mapped[str] = mapped_column(String(64), nullable=False)
    linhas_gravadas: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avisos: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    erro: Mapped[str | None] = mapped_column(Text)


class Territorio(Base):
    __tablename__ = "territorio"
    __table_args__ = (
        UniqueConstraint("tipo", "codigo", name="uq_territorio_tipo_codigo"),
        Index("ix_territorio_parent", "parent_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    codigo: Mapped[str] = mapped_column(String(80), nullable=False)
    codigo_ibge: Mapped[str | None] = mapped_column(String(20))
    sigla: Mapped[str | None] = mapped_column(String(10))
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("territorio.id"))


class UniversoEdicao(Base):
    __tablename__ = "universo_edicao"
    __table_args__ = (
        UniqueConstraint("carga_importacao_id", "territorio_id", name="uq_universo_carga_territorio"),
        Index("ix_universo_edicao_territorio", "edicao_id", "territorio_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    carga_importacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carga_importacao.id"), nullable=False)
    edicao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("edicao.id"), nullable=False)
    territorio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("territorio.id"), nullable=False)
    incluido: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    motivo_exclusao: Mapped[str | None] = mapped_column(Text)
    populacao_referencia: Mapped[int | None] = mapped_column(Integer)
    atributos: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)


class Componente(Base):
    __tablename__ = "componente"
    __table_args__ = (UniqueConstraint("pesquisa_id", "codigo", name="uq_componente_pesquisa_codigo"),)
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    pesquisa_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("pesquisa.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(80), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)


class ComponenteEdicao(Base):
    __tablename__ = "componente_edicao"
    __table_args__ = (
        UniqueConstraint("carga_importacao_id", "componente_id", name="uq_componente_carga"),
        Index("ix_componente_edicao_consulta", "edicao_id", "componente_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    carga_importacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carga_importacao.id"), nullable=False)
    edicao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("edicao.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("componente.id"), nullable=False)
    nome: Mapped[str] = mapped_column(String(300), nullable=False)
    ordem: Mapped[int | None] = mapped_column(SmallInteger)
    fonte: Mapped[str | None] = mapped_column(Text)
    unidade_medida: Mapped[str | None] = mapped_column(Text)
    descricao: Mapped[str | None] = mapped_column(Text)
    observacoes: Mapped[str | None] = mapped_column(Text)
    atualizado: Mapped[bool | None] = mapped_column(Boolean)
    ultimo_ano_disponivel: Mapped[int | None] = mapped_column(Integer)


class DisponibilidadeComponente(Base):
    __tablename__ = "disponibilidade_componente"
    __table_args__ = (
        UniqueConstraint(
            "carga_importacao_id", "componente_id", "ano_referencia", name="uq_disponibilidade_carga"
        ),
        Index("ix_disponibilidade_consulta", "edicao_id", "componente_id", "ano_referencia"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    carga_importacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carga_importacao.id"), nullable=False)
    edicao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("edicao.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("componente.id"), nullable=False)
    ano_referencia: Mapped[int] = mapped_column(Integer, nullable=False)
    disponivel: Mapped[bool] = mapped_column(Boolean, nullable=False)


class Estrutura(Base):
    __tablename__ = "estrutura"
    __table_args__ = (
        UniqueConstraint("carga_importacao_id", "codigo", name="uq_estrutura_carga_codigo"),
        Index("ix_estrutura_edicao_codigo", "edicao_id", "codigo"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    carga_importacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carga_importacao.id"), nullable=False)
    edicao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("edicao.id"), nullable=False)
    codigo: Mapped[str] = mapped_column(String(30), nullable=False)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)


class EstruturaComponente(Base):
    __tablename__ = "estrutura_componente"
    __table_args__ = (
        UniqueConstraint(
            "estrutura_id", "parent_componente_id", "componente_id", name="uq_estrutura_parent_componente"
        ),
        Index("ix_estrutura_componente_parent", "parent_componente_id"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    estrutura_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("estrutura.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("componente.id"), nullable=False)
    parent_componente_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("componente.id"))
    peso: Mapped[float | None] = mapped_column(Numeric(16, 8))
    ordem_exibicao: Mapped[int | None] = mapped_column(Integer)


class ObservacaoIndicador(Base):
    __tablename__ = "observacao_indicador"
    __table_args__ = (
        UniqueConstraint(
            "carga_importacao_id", "componente_id", "territorio_id", "ano_referencia",
            name="uq_observacao_carga_componente_territorio_ano",
        ),
        Index("ix_observacao_consulta", "edicao_id", "componente_id", "territorio_id", "ano_referencia"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    carga_importacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carga_importacao.id"), nullable=False)
    edicao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("edicao.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("componente.id"), nullable=False)
    territorio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("territorio.id"), nullable=False)
    ano_referencia: Mapped[int] = mapped_column(Integer, nullable=False)
    valor_bruto: Mapped[float] = mapped_column(Numeric(30, 10), nullable=False)


class ResultadoRanking(Base):
    __tablename__ = "resultado_ranking"
    __table_args__ = (
        UniqueConstraint(
            "carga_importacao_id", "componente_id", "territorio_id", "ano_referencia",
            name="uq_resultado_carga_componente_territorio_ano",
        ),
        Index("ix_resultado_consulta", "edicao_id", "componente_id", "territorio_id", "ano_referencia"),
    )
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    carga_importacao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("carga_importacao.id"), nullable=False)
    edicao_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("edicao.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("componente.id"), nullable=False)
    territorio_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("territorio.id"), nullable=False)
    ano_referencia: Mapped[int] = mapped_column(Integer, nullable=False)
    nota_normalizada: Mapped[float | None] = mapped_column(Numeric(20, 10))
    posicao: Mapped[int | None] = mapped_column(Integer)
    delta_posicao: Mapped[int | None] = mapped_column(Integer)


class SchemaMeta(Base):
    __tablename__ = "schema_meta"
    chave: Mapped[str] = mapped_column(String(60), primary_key=True)
    valor: Mapped[str] = mapped_column(String(200), nullable=False)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
