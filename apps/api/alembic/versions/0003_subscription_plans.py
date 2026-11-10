"""subscription plans

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=300), nullable=False),
        sa.Column("days_per_week", sa.Integer(), nullable=False),
        sa.Column("visit_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price_minor", sa.BigInteger(), nullable=False),
        sa.Column("staff_earning_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("terms", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("replaces_id", sa.Integer(), nullable=True),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.ForeignKeyConstraint(
            ["replaces_id"], ["subscription_plans.id"], name="fk_subscription_plans_replaces_id"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("replaces_id"),
    )


def downgrade() -> None:
    op.drop_table("subscription_plans")
