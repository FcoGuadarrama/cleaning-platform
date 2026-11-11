"""transactional outbox; index to prune idempotency keys by age

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "outbox_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "key",
            sa.String(length=128),
            nullable=False,
            comment="topic:subject id; receivers use it as their idempotency key",
        ),
        sa.Column("topic", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "sent", "dead", name="outboxstatus", native_enum=False, length=32),
            nullable=False,
        ),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column(
            "available_at",
            mysql.DATETIME(fsp=6),
            nullable=False,
            comment="Not delivered before this: retry backoff or a claim's lease",
        ),
        sa.Column("last_error", sa.String(length=1000), nullable=True),
        sa.Column("sent_at", mysql.DATETIME(fsp=6), nullable=True),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("key"),
    )
    op.create_index("ix_outbox_messages_status_available_at", "outbox_messages", ["status", "available_at"])
    op.create_index("ix_idempotency_keys_created_at", "idempotency_keys", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_idempotency_keys_created_at", table_name="idempotency_keys")
    op.drop_table("outbox_messages")
