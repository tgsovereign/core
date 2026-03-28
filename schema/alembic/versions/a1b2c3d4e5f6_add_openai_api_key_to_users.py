"""add openai api key to users

Revision ID: a1b2c3d4e5f6
Revises: 5ef2b369bd9e
Create Date: 2026-03-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '5ef2b369bd9e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('openai_api_key_encrypted', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'openai_api_key_encrypted')
