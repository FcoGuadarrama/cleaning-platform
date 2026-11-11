"""payment method and SPEI review; subscription cancellation and end

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def _method() -> sa.Enum:
    return sa.Enum("card", "spei", name="paymentmethod", native_enum=False, length=32)


def upgrade() -> None:
    op.add_column("payments", sa.Column("method", _method(), server_default="card", nullable=False))
    op.add_column(
        "payments",
        sa.Column(
            "reviewed_by",
            sa.Integer(),
            nullable=True,
            comment="Agent who confirmed or rejected a SPEI transfer",
        ),
    )
    op.add_column("payments", sa.Column("reviewed_at", mysql.DATETIME(fsp=6), nullable=True))
    op.add_column("payments", sa.Column("review_note", sa.String(length=500), nullable=True))
    op.create_foreign_key("fk_payments_reviewed_by_users", "payments", "users", ["reviewed_by"], ["id"])
    op.add_column(
        "subscriptions",
        sa.Column(
            "payment_method",
            _method(),
            server_default="card",
            nullable=False,
            comment="How renewals are charged: the method of the latest checkout",
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column(
            "cancelled_at",
            mysql.DATETIME(fsp=6),
            nullable=True,
            comment="Customer cancelled: no renewal, ends after the paid cycles",
        ),
    )
    op.add_column("subscriptions", sa.Column("ended_at", mysql.DATETIME(fsp=6), nullable=True))
    op.add_column(
        "subscriptions",
        sa.Column(
            "end_reason",
            sa.Enum("cancelled", "unpaid", name="subscriptionendreason", native_enum=False, length=32),
            nullable=True,
        ),
    )


def downgrade() -> None:
    for column in ("end_reason", "ended_at", "cancelled_at", "payment_method"):
        op.drop_column("subscriptions", column)
    op.drop_constraint("fk_payments_reviewed_by_users", "payments", type_="foreignkey")
    for column in ("review_note", "reviewed_at", "reviewed_by", "method"):
        op.drop_column("payments", column)
