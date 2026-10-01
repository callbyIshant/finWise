from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    icon: str = Field(..., min_length=1)
    color: str = Field(..., pattern=r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    icon: Optional[str] = Field(None, min_length=1)
    color: Optional[str] = Field(None, pattern=r"^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$")

class CategoryResponse(CategoryBase):
    id: int
    is_default: bool
    user_id: Optional[UUID] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
