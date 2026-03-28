"""rename event_type to event_config jsonb

Revision ID: e95e65dfc2c6
Revises: 8ae5c74402aa
Create Date: 2026-03-27 22:50:59.191841

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "e95e65dfc2c6"
down_revision: Union[str, Sequence[str], None] = "8ae5c74402aa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("agent_tasks", "event_type")
    op.add_column(
        "agent_tasks", sa.Column("event_config", postgresql.JSONB(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("agent_tasks", "event_config")
    op.add_column(
        "agent_tasks", sa.Column("event_type", sa.String(length=100), nullable=True)
    )
