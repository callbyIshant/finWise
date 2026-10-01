from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, EmailStr, Field, field_validator


def money(value: object, positive: bool = True) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError("Invalid amount") from None
    if not amount.is_finite() or amount.as_tuple().exponent < -2 or abs(amount) > Decimal("999999999999.99"):
        raise ValueError("Amount must have at most two decimal places")
    if positive and amount <= 0:
        raise ValueError("Amount must be positive")
    return amount.quantize(Decimal("0.01"))


def clean_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Name cannot be blank")
    return value


class RegisterIn(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=12, max_length=256)

    @field_validator("full_name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return clean_name(value)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class PreferencesIn(BaseModel):
    currency: Literal["INR", "USD", "EUR", "GBP"] = "INR"
    timezone: str = Field(max_length=64)

    @field_validator("timezone")
    @classmethod
    def valid_zone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown timezone") from None
        return value


class AccountIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Literal["cash", "bank"]
    opening_balance: Decimal = Decimal("0.00")

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return clean_name(value)

    @field_validator("opening_balance", mode="before")
    @classmethod
    def valid_amount(cls, value):
        return money(value, positive=False)


class AccountPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    archived: bool | None = None

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str | None):
        return clean_name(value) if value is not None else None


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: Literal["income", "expense"]

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return clean_name(value)


class CategoryPatch(BaseModel):
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value: str) -> str:
        return clean_name(value)


class EntryIn(BaseModel):
    account_id: UUID
    category_id: UUID
    amount: Decimal
    kind: Literal["income", "expense"]
    occurred_on: date
    note: str = Field(default="", max_length=500)

    @field_validator("amount", mode="before")
    @classmethod
    def valid_amount(cls, value):
        return money(value)

    @field_validator("occurred_on")
    @classmethod
    def valid_date(cls, value: date):
        if value.year < 2000:
            raise ValueError("Date must be in or after 2000")
        return value


class EntryPatch(BaseModel):
    account_id: UUID | None = None
    category_id: UUID | None = None
    amount: Decimal | None = None
    kind: Literal["income", "expense"] | None = None
    occurred_on: date | None = None
    note: str | None = Field(default=None, max_length=500)

    @field_validator("amount", mode="before")
    @classmethod
    def valid_amount(cls, value):
        return money(value) if value is not None else None

    @field_validator("occurred_on")
    @classmethod
    def valid_date(cls, value):
        return EntryIn.valid_date(value) if value is not None else None


class BudgetIn(BaseModel):
    category_id: UUID
    month: date
    amount: Decimal

    @field_validator("month")
    @classmethod
    def first_of_month(cls, value: date):
        if value.day != 1:
            raise ValueError("Month must be the first calendar day")
        return value

    @field_validator("amount", mode="before")
    @classmethod
    def valid_amount(cls, value):
        return money(value)


class BudgetPatch(BaseModel):
    amount: Decimal

    @field_validator("amount", mode="before")
    @classmethod
    def valid_amount(cls, value):
        return money(value)


class ResetRequestIn(BaseModel):
    email: EmailStr


class ResetConfirmIn(BaseModel):
    token: str
    password: str = Field(min_length=12, max_length=256)


class DeleteAccountIn(BaseModel):
    password: str
