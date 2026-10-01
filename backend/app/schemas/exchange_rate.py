from pydantic import BaseModel, ConfigDict
from datetime import datetime
from decimal import Decimal
from typing import Dict

class ExchangeRatesResponse(BaseModel):
    base: str
    last_updated: datetime
    rates: Dict[str, float]

class ExchangeRateResponse(BaseModel):
    base: str
    target: str
    rate: Decimal
    fetched_at: datetime
    model_config = ConfigDict(from_attributes=True)

class CollectionHistory(BaseModel):
    fetched_at: datetime
    rates_count: int
    base: str
