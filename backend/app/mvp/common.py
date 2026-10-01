from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Account, Budget, Category, Entry, Member


DEFAULT_CATEGORIES = (
    ("Salary", "income"), ("Other income", "income"),
    ("Food", "expense"), ("Housing", "expense"), ("Transport", "expense"),
    ("Shopping", "expense"), ("Health", "expense"), ("Entertainment", "expense"),
    ("Bills", "expense"), ("Other", "expense"),
)


def add_defaults(db: Session, member: Member) -> None:
    db.add_all(Category(owner_id=member.id, name=name, kind=kind, is_default=True) for name, kind in DEFAULT_CATEGORIES)
    db.flush()


def owned(db: Session, model, item_id: UUID, member: Member):
    item = db.scalar(select(model).where(model.id == item_id, model.owner_id == member.id))
    if not item:
        raise HTTPException(404, "Record not found")
    return item


def validate_links(db: Session, member: Member, account_id: UUID, category_id: UUID, kind: str, *, allow_archived: bool = False):
    account = owned(db, Account, account_id, member)
    category = owned(db, Category, category_id, member)
    if (account.archived and not allow_archived) or category.kind != kind:
        raise HTTPException(422, "Account or category does not match this transaction")
    return account, category


def month_bounds(month: date) -> tuple[date, date]:
    end = date(month.year + (month.month == 12), month.month % 12 + 1, 1)
    return month, end


def local_month(member: Member) -> date:
    from datetime import datetime

    today = datetime.now(ZoneInfo(member.timezone)).date()
    return date(today.year, today.month, 1)


def local_today(member: Member) -> date:
    from datetime import datetime

    return datetime.now(ZoneInfo(member.timezone)).date()


def amount(value: Decimal | None) -> str:
    return f"{value or Decimal('0.00'):.2f}"


def member_json(member: Member) -> dict:
    return {
        "id": str(member.id), "email": None if member.is_demo else member.email,
        "full_name": member.full_name, "currency": member.currency,
        "timezone": member.timezone, "is_demo": member.is_demo,
    }


def account_json(db: Session, account: Account) -> dict:
    totals = db.execute(select(Entry.kind, func.sum(Entry.amount)).where(
        Entry.owner_id == account.owner_id, Entry.account_id == account.id
    ).group_by(Entry.kind)).all()
    net = sum((value if kind == "income" else -value for kind, value in totals), Decimal("0.00"))
    return {
        "id": str(account.id), "name": account.name, "kind": account.kind,
        "opening_balance": amount(account.opening_balance),
        "balance": amount(account.opening_balance + net), "archived": account.archived,
    }


def category_json(category: Category) -> dict:
    return {"id": str(category.id), "name": category.name, "kind": category.kind, "is_default": category.is_default}


def entry_json(entry: Entry) -> dict:
    return {
        "id": str(entry.id), "account_id": str(entry.account_id),
        "category_id": str(entry.category_id), "category_name": entry.category.name,
        "amount": amount(entry.amount), "kind": entry.kind,
        "occurred_on": entry.occurred_on.isoformat(), "note": entry.note,
    }


def budget_json(db: Session, budget: Budget) -> dict:
    start, end = month_bounds(budget.month)
    spent = db.scalar(select(func.sum(Entry.amount)).where(
        Entry.owner_id == budget.owner_id, Entry.category_id == budget.category_id,
        Entry.kind == "expense", Entry.occurred_on >= start, Entry.occurred_on < end,
    )) or Decimal("0.00")
    return {
        "id": str(budget.id), "category_id": str(budget.category_id),
        "category_name": budget.category.name, "month": budget.month.isoformat(),
        "amount": amount(budget.amount), "spent": amount(spent),
        "remaining": amount(budget.amount - spent),
    }
