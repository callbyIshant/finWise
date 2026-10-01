"""Add isolated MVP schema without deleting prototype records.

Revision ID: 002
Revises: 001
"""

from alembic import op
import sqlalchemy as sa


revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "members",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("timezone", sa.String(64), nullable=False),
        sa.Column("is_demo", sa.Boolean(), nullable=False),
        sa.Column("demo_expires_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_members_email", "members", ["email"])

    op.create_table(
        "accounts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("kind", sa.String(12), nullable=False),
        sa.Column("opening_balance", sa.Numeric(14, 2), nullable=False),
        sa.Column("archived", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('cash', 'bank')", name="account_kind"),
    )
    op.create_index("ix_accounts_owner", "accounts", ["owner_id"])

    op.create_table(
        "app_categories",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("kind", sa.String(7), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.CheckConstraint("kind IN ('income', 'expense')", name="category_kind"),
        sa.UniqueConstraint("owner_id", "name", "kind", name="uq_category_owner_name_kind"),
    )
    op.create_index("ix_categories_owner", "app_categories", ["owner_id"])

    op.create_table(
        "entries",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", sa.Uuid(), sa.ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("category_id", sa.Uuid(), sa.ForeignKey("app_categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("kind", sa.String(7), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(500), nullable=False),
        sa.Column("idempotency_key", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("amount > 0", name="entry_amount_positive"),
        sa.CheckConstraint("kind IN ('income', 'expense')", name="entry_kind"),
        sa.UniqueConstraint("owner_id", "idempotency_key", name="uq_entry_owner_idempotency"),
    )
    op.create_index("ix_entries_owner_date", "entries", ["owner_id", "occurred_on"])
    op.create_index("ix_entries_owner_category_date", "entries", ["owner_id", "category_id", "occurred_on"])

    op.create_table(
        "budgets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category_id", sa.Uuid(), sa.ForeignKey("app_categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.CheckConstraint("amount > 0", name="budget_amount_positive"),
        sa.UniqueConstraint("owner_id", "category_id", "month", name="uq_budget_owner_category_month"),
    )
    op.create_index("ix_budgets_owner_month", "budgets", ["owner_id", "month"])

    op.create_table(
        "app_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("member_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sessions_member", "app_sessions", ["member_id"])

    op.create_table(
        "password_resets",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("member_id", sa.Uuid(), sa.ForeignKey("members.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "rate_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("key_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_rate_attempts_key_hash", "rate_attempts", ["key_hash"])


def downgrade() -> None:
    for name in ("rate_attempts", "password_resets", "app_sessions", "budgets", "entries", "app_categories", "accounts", "members"):
        op.drop_table(name)
