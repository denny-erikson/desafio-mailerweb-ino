"""add booking validation constraints

Revision ID: d8382f815670
Revises: eaf8112e78a2
Create Date: 2026-04-18 18:17:24.043299

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8382f815670'
down_revision: Union[str, Sequence[str], None] = 'eaf8112e78a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_check_constraint(
        op.f("ck_bookings_start_before_end"),
        "bookings",
        "start_at < end_at",
    )
    op.create_check_constraint(
        op.f("ck_bookings_min_duration_15_minutes"),
        "bookings",
        "end_at - start_at >= interval '15 minutes'",
    )
    op.create_check_constraint(
        op.f("ck_bookings_max_duration_8_hours"),
        "bookings",
        "end_at - start_at <= interval '8 hours'",
    )
    op.create_check_constraint(
        op.f("ck_bookings_status_canceled_at_consistency"),
        "bookings",
        "("
        "(status = 'ACTIVE' AND canceled_at IS NULL) OR "
        "(status = 'CANCELED' AND canceled_at IS NOT NULL)"
        ")",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        op.f("ck_bookings_status_canceled_at_consistency"),
        "bookings",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_bookings_max_duration_8_hours"),
        "bookings",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_bookings_min_duration_15_minutes"),
        "bookings",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_bookings_start_before_end"),
        "bookings",
        type_="check",
    )
