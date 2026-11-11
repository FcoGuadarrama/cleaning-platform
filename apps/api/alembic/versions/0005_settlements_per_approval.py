"""settlements: allow several per staff member and week

A booking completed after its week was approved could never be settled while
(staff_id, week_start) was unique.

Revision ID: 0005
Revises: 0004
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

INDEX = "ix_settlements_staff_week"
# MySQL named the original unique index after its first column.
UNIQUE = "staff_id"


def upgrade() -> None:
    # Create the plain index first: the staff_id foreign key needs an index at all times.
    op.create_index(INDEX, "settlements", ["staff_id", "week_start"])
    op.drop_constraint(UNIQUE, "settlements", type_="unique")


def downgrade() -> None:
    # Fails if a week already holds more than one settlement; merge those by hand before downgrading.
    op.create_unique_constraint(UNIQUE, "settlements", ["staff_id", "week_start"])
    op.drop_index(INDEX, table_name="settlements")
