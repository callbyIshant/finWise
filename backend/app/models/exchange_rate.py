from sqlalchemy import Column, String, DateTime, Integer, Numeric, Index, desc
from sqlalchemy.sql import func
from ..database import Base

class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id = Column(Integer, primary_key=True, index=True)
    base = Column(String(5), nullable=False, default='USD')
    target = Column(String(5), nullable=False)
    rate = Column(Numeric(18, 8), nullable=False)
    source = Column(String(100), nullable=False, default='open.er-api.com')
    fetched_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index('idx_exchange_rates_fetched_at', desc('fetched_at')),
        Index('idx_exchange_rates_target', 'target')
    )
