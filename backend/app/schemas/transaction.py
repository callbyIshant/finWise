from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
import datetime as dt
from decimal import Decimal
from .category import CategoryResponse

class TransactionBase(BaseModel):
    category_id: int
    amount: Decimal = Field(..., gt=0, le=999999999.99)
    type: str = Field(..., pattern="^(income|expense)$")
    description: Optional[str] = Field(None, max_length=500)
    date: dt.date

class TransactionCreate(TransactionBase):
    pass

class TransactionUpdate(BaseModel):
    category_id: Optional[int] = None
    amount: Optional[Decimal] = Field(None, gt=0, le=999999999.99)
    type: Optional[str] = Field(None, pattern="^(income|expense)$")
    description: Optional[str] = Field(None, max_length=500)
    date: Optional[dt.date] = None

class TransactionResponse(TransactionBase):
    id: UUID
    user_id: UUID
    created_at: dt.datetime
    updated_at: dt.datetime
    category: CategoryResponse
    model_config = ConfigDict(from_attributes=True)

class TransactionList(BaseModel):
    items: List[TransactionResponse]
    total: int
    page: int
    limit: int
    pages: int

class TransactionBulkImportRequest(BaseModel):
    transactions: List[TransactionCreate]

class TransactionBulkImportResponse(BaseModel):
    imported_count: int
    message: str
