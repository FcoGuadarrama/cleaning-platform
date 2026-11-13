"""inbox notifications, push devices and push preferences

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

CATEGORY = sa.Enum(
    "visits", "billing", "payouts", "operations", name="notificationcategory", native_enum=False, length=32
)


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", CATEGORY, nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False, comment="The outbox topic that caused it"),
        sa.Column("title", sa.String(length=120), nullable=False),
        sa.Column("body", sa.String(length=300), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False, comment="Ids of what it is about, for the deep link"),
        sa.Column(
            "source_key",
            sa.String(length=128),
            nullable=False,
            comment="Key of the outbox message that caused it",
        ),
        sa.Column("read_at", mysql.DATETIME(fsp=6), nullable=True),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_key", "user_id", name="uq_notifications_source_key_user_id"),
    )
    op.create_index("ix_notifications_created_at", "notifications", ["created_at"])
    op.create_index("ix_notifications_user_id_id", "notifications", ["user_id", "id"])
    op.create_table(
        "push_devices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=255), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("last_seen_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.Column(
            "disabled_at",
            mysql.DATETIME(fsp=6),
            nullable=True,
            comment="Expo reported the token unregistered, or the user signed out",
        ),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token"),
    )
    op.create_index("ix_push_devices_user_id", "push_devices", ["user_id"])
    op.create_table(
        "notification_preferences",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category", CATEGORY, nullable=False),
        sa.Column("push_enabled", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "category"),
    )


def downgrade() -> None:
    # Indexes go with their tables: MySQL refuses to drop one a foreign key still needs.
    op.drop_table("notification_preferences")
    op.drop_table("push_devices")
    op.drop_table("notifications")
