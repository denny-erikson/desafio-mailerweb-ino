"""add booking overlap exclusion constraint

Revision ID: 4bf4a86e9c12
Revises: d8382f815670
Create Date: 2026-04-18 18:40:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4bf4a86e9c12"
down_revision: Union[str, Sequence[str], None] = "d8382f815670"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONSTRAINT_NAME = "exclude_active_room_booking_overlap"


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.execute(
        f"""
        ALTER TABLE bookings
        ADD CONSTRAINT {CONSTRAINT_NAME}
        EXCLUDE USING gist (
            room_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        )
        WHERE (status = 'ACTIVE')
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        f"ALTER TABLE bookings DROP CONSTRAINT IF EXISTS {CONSTRAINT_NAME}",
    )
