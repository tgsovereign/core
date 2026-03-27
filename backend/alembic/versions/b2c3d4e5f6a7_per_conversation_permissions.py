"""per-conversation permissions: move permission_level to conversations, drop agent_configs

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: str = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add permission_level column to conversations with default
    op.add_column(
        'conversations',
        sa.Column('permission_level', sa.String(20), nullable=False, server_default='read_only'),
    )

    # Migrate existing permission levels from agent_configs to conversations
    op.execute("""
        UPDATE conversations c
        SET permission_level = ac.permission_level
        FROM agent_configs ac
        WHERE ac.user_id = c.user_id
    """)

    # Drop agent_configs table
    op.drop_table('agent_configs')

    # Remove the server default (keep the ORM-level default)
    op.alter_column('conversations', 'permission_level', server_default=None)


def downgrade() -> None:
    # Recreate agent_configs table
    op.create_table(
        'agent_configs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('permission_level', sa.String(20), nullable=False, server_default='read_only'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_id'),
    )

    # Drop the column from conversations
    op.drop_column('conversations', 'permission_level')
