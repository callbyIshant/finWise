from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .common import account_json, amount, budget_json, entry_json, month_bounds
from .models import Account, Budget, Entry, Member


def build_dashboard(db: Session, member: Member, selected: date) -> dict:
    start, end = month_bounds(selected)
    rows = db.scalars(select(Entry).where(
        Entry.owner_id == member.id, Entry.occurred_on >= start, Entry.occurred_on < end,
    )).all()
    income = sum((row.amount for row in rows if row.kind == "income"), Decimal("0.00"))
    expenses = sum((row.amount for row in rows if row.kind == "expense"), Decimal("0.00"))
    by_category = {}
    for row in rows:
        if row.kind == "expense":
            key = str(row.category_id)
            item = by_category.setdefault(key, {
                "category_id": key, "category_name": row.category.name, "amount": Decimal("0.00"),
            })
            item["amount"] += row.amount
    account_rows = db.scalars(select(Account).where(
        Account.owner_id == member.id, Account.archived.is_(False),
    )).all()
    account_data = [account_json(db, row) for row in account_rows]
    budget_rows = db.scalars(select(Budget).where(
        Budget.owner_id == member.id, Budget.month == selected,
    )).all()
    recent = db.scalars(select(Entry).where(Entry.owner_id == member.id)
                        .order_by(Entry.occurred_on.desc(), Entry.created_at.desc()).limit(6)).all()
    return {
        "month": selected.strftime("%Y-%m"), "currency": member.currency,
        "income": amount(income), "expenses": amount(expenses), "net_cash_flow": amount(income - expenses),
        "accounts": account_data,
        "total_balance": amount(sum((Decimal(row["balance"]) for row in account_data), Decimal("0.00"))),
        "spending": [{**item, "amount": amount(item["amount"])} for item in sorted(
            by_category.values(), key=lambda value: value["amount"], reverse=True,
        )],
        "budgets": [budget_json(db, row) for row in budget_rows],
        "recent": [entry_json(row) for row in recent],
        "empty": not bool(db.scalar(select(Entry.id).where(Entry.owner_id == member.id).limit(1))),
    }
