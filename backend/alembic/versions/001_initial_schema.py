"""initial schema

Revision ID: 001
Revises: 
Create Date: 2024-05-18 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('TRUE')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    # Categories table
    op.create_table(
        'categories',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('icon', sa.String(50), nullable=False),
        sa.Column('color', sa.String(7), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default=sa.text('FALSE')),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )

    # Transactions table
    op.create_table(
        'transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category_id', sa.Integer(), sa.ForeignKey('categories.id'), nullable=False),
        sa.Column('amount', sa.Numeric(12, 2), nullable=False),
        sa.Column('type', sa.String(10), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('date', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
        sa.CheckConstraint('amount > 0', name='check_amount_positive'),
        sa.CheckConstraint("type IN ('income', 'expense')", name='check_transaction_type'),
    )
    op.create_index('idx_transactions_user_id', 'transactions', ['user_id'])
    op.create_index('idx_transactions_date', 'transactions', ['date'])
    op.create_index('idx_transactions_type', 'transactions', ['type'])

    # Exchange rates table
    op.create_table(
        'exchange_rates',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('base', sa.String(5), nullable=False, server_default=sa.text("'USD'")),
        sa.Column('target', sa.String(5), nullable=False),
        sa.Column('rate', sa.Numeric(18, 8), nullable=False),
        sa.Column('source', sa.String(100), nullable=False, server_default=sa.text("'open.er-api.com'")),
        sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()')),
    )
    op.create_index('idx_exchange_rates_fetched_at', 'exchange_rates', [sa.text('fetched_at DESC')])
    op.create_index('idx_exchange_rates_target', 'exchange_rates', ['target'])


def downgrade() -> None:
    op.drop_table('exchange_rates')
    op.drop_table('transactions')
    op.drop_table('categories')
    op.drop_table('users')
