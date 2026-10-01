from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, desc
from typing import Optional, List
from datetime import date, timedelta
from decimal import Decimal
import calendar
from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..models.transaction import Transaction
from ..models.category import Category
from ..schemas.report import ReportSummary, CategoryBreakdown, MonthlyTrend, DailyTrend

router = APIRouter(prefix="/reports", tags=["reports"])

def get_month_range(start_date: Optional[date], end_date: Optional[date]):
    if not start_date or not end_date:
        today = date.today()
        start_date = start_date or date(today.year, today.month, 1)
        _, last_day = calendar.monthrange(today.year, today.month)
        end_date = end_date or date(today.year, today.month, last_day)
    return start_date, end_date

@router.get("/summary", response_model=ReportSummary)
def get_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start, end = get_month_range(start_date, end_date)
    
    txns = db.query(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start,
        Transaction.date <= end
    ).all()
    
    total_income = sum(t.amount for t in txns if t.type == 'income') or Decimal('0.00')
    total_expenses = sum(t.amount for t in txns if t.type == 'expense') or Decimal('0.00')
    net_balance = total_income - total_expenses
    
    days_in_range = max((end - start).days + 1, 1)
    avg_daily_expense = total_expenses / Decimal(days_in_range)
    
    largest_expense = max((t.amount for t in txns if t.type == 'expense'), default=None)
    
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "net_balance": net_balance,
        "transaction_count": len(txns),
        "avg_daily_expense": avg_daily_expense,
        "largest_expense": largest_expense
    }

@router.get("/by-category", response_model=List[CategoryBreakdown])
def get_by_category(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    type: str = Query("expense"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start, end = get_month_range(start_date, end_date)
    
    result = db.query(
        Category.id,
        Category.name,
        func.sum(Transaction.amount).label("total")
    ).join(Transaction).filter(
        Transaction.user_id == current_user.id,
        Transaction.type == type,
        Transaction.date >= start,
        Transaction.date <= end
    ).group_by(Category.id).order_by(desc("total")).all()
    
    total_amount = sum(row.total for row in result) if result else Decimal('1.00') # prevent div zero
    if total_amount == 0:
        total_amount = Decimal('1.00')
        
    breakdown = []
    for row in result:
        breakdown.append({
            "category_id": row.id,
            "category_name": row.name,
            "amount": row.total,
            "percentage": (row.total / total_amount) * 100
        })
        
    return breakdown

@router.get("/monthly-trend", response_model=List[MonthlyTrend])
def get_monthly_trend(
    months: int = Query(6, ge=1, le=12),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = date.today()
    trend = []
    
    for i in range(months - 1, -1, -1):
        # Calculate the start of the month for `i` months ago
        # Very rough estimation for finding past months easily:
        m = today.month - i
        y = today.year
        while m <= 0:
            m += 12
            y -= 1
        
        start_d = date(y, m, 1)
        _, last_day = calendar.monthrange(y, m)
        end_d = date(y, m, last_day)
        
        txns = db.query(Transaction.type, func.sum(Transaction.amount).label("total")).filter(
            Transaction.user_id == current_user.id,
            Transaction.date >= start_d,
            Transaction.date <= end_d
        ).group_by(Transaction.type).all()
        
        inc = Decimal('0.00')
        exp = Decimal('0.00')
        for t, amt in txns:
            if t == 'income': inc = amt
            elif t == 'expense': exp = amt
            
        trend.append({
            "month": start_d.strftime("%b %Y"),
            "income": inc,
            "expense": exp,
            "net": inc - exp
        })
        
    return trend

@router.get("/daily-trend", response_model=List[DailyTrend])
def get_daily_trend(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=29)
        
    txns = db.query(Transaction.date, Transaction.type, func.sum(Transaction.amount).label("total")).filter(
        Transaction.user_id == current_user.id,
        Transaction.date >= start_date,
        Transaction.date <= end_date
    ).group_by(Transaction.date, Transaction.type).all()
    
    daily_data = {}
    curr = start_date
    while curr <= end_date:
        daily_data[curr.strftime("%Y-%m-%d")] = {"income": Decimal('0.00'), "expense": Decimal('0.00')}
        curr += timedelta(days=1)
        
    for d, t, amt in txns:
        d_str = d.strftime("%Y-%m-%d")
        if d_str in daily_data:
            daily_data[d_str][t] = amt
            
    trend = []
    for d, data in sorted(daily_data.items()):
        trend.append({
            "date": d,
            "income": data["income"],
            "expense": data["expense"]
        })
        
    return trend
