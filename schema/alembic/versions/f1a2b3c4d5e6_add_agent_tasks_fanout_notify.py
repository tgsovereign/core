"""add agent_tasks_fanout notify trigger

Revision ID: f1a2b3c4d5e6
Revises: e95e65dfc2c6
Create Date: 2026-03-30 12:00:00.000000
"""

from typing import Sequence, Union

from alembic import op

revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, None] = "e95e65dfc2c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION notify_agent_tasks_fanout()
        RETURNS trigger AS $$
        DECLARE
            rec RECORD;
            payload TEXT;
        BEGIN
            IF TG_OP = 'DELETE' THEN
                rec := OLD;
            ELSE
                rec := NEW;
            END IF;

            payload := json_build_object(
                'op', TG_OP,
                'id', rec.id,
                'task_type', rec.task_type,
                'enabled', rec.enabled
            )::text;

            PERFORM pg_notify('agent_tasks_fanout', payload);

            RETURN rec;
        END;
        $$ LANGUAGE plpgsql;
    """)

    op.execute("""
        CREATE TRIGGER trg_agent_tasks_fanout
        AFTER INSERT OR UPDATE OR DELETE
        ON agent_tasks
        FOR EACH ROW
        EXECUTE FUNCTION notify_agent_tasks_fanout();
    """)


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_agent_tasks_fanout ON agent_tasks;")
    op.execute("DROP FUNCTION IF EXISTS notify_agent_tasks_fanout();")
