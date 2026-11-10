"""contracted subscriptions, their cycles, and visits/payments linked to a cycle

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

BOOKING_CYCLE_FK = "fk_bookings_subscription_cycle_id"
PAYMENT_CYCLE_FK = "fk_payments_subscription_cycle_id"
PAYMENT_TARGET_CK = "ck_payments_one_target"


def _status(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name, native_enum=False, length=32)


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("staff_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column("status", _status("subscriptionstatus", "held", "active", "expired"), nullable=False),
        sa.Column("weekdays", sa.JSON(), nullable=False),
        sa.Column(
            "visit_start", sa.Time(), nullable=False, comment="Local start time in the business time zone"
        ),
        sa.Column("address", sa.String(length=500), nullable=False),
        sa.Column("address_id", sa.Integer(), nullable=True),
        sa.Column("plan_name", sa.String(length=80), nullable=False),
        sa.Column("days_per_week", sa.Integer(), nullable=False),
        sa.Column("visits_per_cycle", sa.Integer(), nullable=False),
        sa.Column("visit_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("price_minor", sa.BigInteger(), nullable=False),
        sa.Column("staff_earning_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("terms", sa.Text(), nullable=False),
        sa.Column("terms_accepted_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.ForeignKeyConstraint(
            ["address_id"],
            ["customer_addresses.id"],
            name="fk_subscriptions_address_id_customer_addresses",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["plan_id"], ["subscription_plans.id"]),
        sa.ForeignKeyConstraint(["staff_id"], ["staff_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    for column in ("customer_id", "staff_id", "status"):
        op.create_index(op.f(f"ix_subscriptions_{column}"), "subscriptions", [column], unique=False)

    op.create_table(
        "subscription_cycles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False, comment="Last day of the cycle, inclusive"),
        sa.Column("status", _status("cyclestatus", "held", "confirmed", "expired"), nullable=False),
        sa.Column("hold_expires_at", mysql.DATETIME(fsp=6), nullable=True),
        sa.Column("price_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subscription_id", "sequence"),
    )
    for column in ("subscription_id", "status"):
        op.create_index(
            op.f(f"ix_subscription_cycles_{column}"), "subscription_cycles", [column], unique=False
        )

    op.alter_column("bookings", "offering_id", existing_type=mysql.INTEGER(), nullable=True)
    op.add_column("bookings", sa.Column("subscription_cycle_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_bookings_subscription_cycle_id"), "bookings", ["subscription_cycle_id"])
    op.create_foreign_key(
        BOOKING_CYCLE_FK, "bookings", "subscription_cycles", ["subscription_cycle_id"], ["id"]
    )

    op.alter_column("payments", "booking_id", existing_type=mysql.INTEGER(), nullable=True)
    op.add_column("payments", sa.Column("subscription_cycle_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_payments_subscription_cycle_id"), "payments", ["subscription_cycle_id"])
    op.create_foreign_key(
        PAYMENT_CYCLE_FK, "payments", "subscription_cycles", ["subscription_cycle_id"], ["id"]
    )
    op.create_check_constraint(
        PAYMENT_TARGET_CK, "payments", "(booking_id IS NULL) <> (subscription_cycle_id IS NULL)"
    )


def downgrade() -> None:
    op.drop_constraint(PAYMENT_TARGET_CK, "payments", type_="check")
    op.drop_constraint(PAYMENT_CYCLE_FK, "payments", type_="foreignkey")
    op.drop_index(op.f("ix_payments_subscription_cycle_id"), table_name="payments")
    op.drop_column("payments", "subscription_cycle_id")
    op.alter_column("payments", "booking_id", existing_type=mysql.INTEGER(), nullable=False)

    op.drop_constraint(BOOKING_CYCLE_FK, "bookings", type_="foreignkey")
    op.drop_index(op.f("ix_bookings_subscription_cycle_id"), table_name="bookings")
    op.drop_column("bookings", "subscription_cycle_id")
    op.alter_column("bookings", "offering_id", existing_type=mysql.INTEGER(), nullable=False)

    op.drop_table("subscription_cycles")
    op.drop_table("subscriptions")
