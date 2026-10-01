from pydantic import BaseModel
from typing import List, Optional
from decimal import Decimal

class ReportSummary(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    net_balance: Decimal
    transaction_count: int
    avg_daily_expense: Decimal
    largest_expense: Optional[Decimal]

class CategoryBreakdown(BaseModel):
    category_id: int
    category_name: str
    amount: Decimal
    percentage: Decimal

class MonthlyTrend(BaseModel):
    month: str
    income: Decimal
    expense: Decimal
    net: Decimal

class DailyTrend(BaseModel):
    date: str
    income: Decimal
    expense: Decimal
