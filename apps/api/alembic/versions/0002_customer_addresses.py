"""customer addresses

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from sqlalchemy.dialects import mysql

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

BOOKING_ADDRESS_FK = "fk_bookings_address_id_customer_addresses"


def upgrade() -> None:
    op.create_table(
        "customer_addresses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=40), nullable=False),
        sa.Column("street", sa.String(length=200), nullable=False),
        sa.Column("interior", sa.String(length=60), nullable=False),
        sa.Column("neighbourhood", sa.String(length=120), nullable=False),
        sa.Column("postal_code", sa.String(length=5), nullable=False),
        sa.Column("municipality", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=80), nullable=False),
        sa.Column("directions", sa.String(length=300), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("created_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_customer_addresses_customer_id"), "customer_addresses", ["customer_id"], unique=False
    )
    op.add_column("bookings", sa.Column("address_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        BOOKING_ADDRESS_FK, "bookings", "customer_addresses", ["address_id"], ["id"], ondelete="SET NULL"
    )


def downgrade() -> None:
    op.drop_constraint(BOOKING_ADDRESS_FK, "bookings", type_="foreignkey")
    op.drop_column("bookings", "address_id")
    op.drop_table("customer_addresses")
