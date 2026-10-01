from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Numeric, Date, CheckConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..database import Base
import uuid

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    type = Column(String(10), nullable=False)
    description = Column(String(500), nullable=True)
    date = Column(Date, nullable=False, server_default=func.current_date(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    category = relationship("Category")
    user = relationship("User")

    __table_args__ = (
        CheckConstraint('amount > 0', name='check_amount_positive'),
        CheckConstraint("type IN ('income', 'expense')", name='check_transaction_type'),
        Index('idx_transactions_user_id', 'user_id'),
        Index('idx_transactions_date', 'date'),
        Index('idx_transactions_type', 'type')
    )
