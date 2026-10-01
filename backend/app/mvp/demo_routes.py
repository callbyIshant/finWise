import secrets
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from .common import add_defaults, member_json
from .models import Account, Budget, Category, Entry, Member, utcnow
from .security import client_key, issue_session, rate_limit, revoke_session


router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/session", status_code=201)
def demo_session(request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(db, "demo:" + client_key(request), limit=10, minutes=60)
    db.execute(delete(Member).where(Member.is_demo.is_(True), Member.demo_expires_at < utcnow()))
    member = Member(
        email=f"demo-{secrets.token_hex(12)}@example.invalid", full_name="Demo Explorer",
        is_demo=True, demo_expires_at=utcnow() + timedelta(hours=1),
    )
    db.add(member)
    db.flush()
    add_defaults(db, member)
    account = Account(owner_id=member.id, name="Everyday account", kind="bank", opening_balance=Decimal("4800.00"))
    db.add(account)
    db.flush()
    categories = {c.name: c for c in db.scalars(select(Category).where(Category.owner_id == member.id))}
    today = date.today()
    sample = [
        ("Salary", "income", "4250.00", "Monthly pay", 8),
        ("Housing", "expense", "1450.00", "Rent", 6),
        ("Food", "expense", "86.40", "Groceries", 3),
        ("Transport", "expense", "42.50", "Train pass", 2),
        ("Entertainment", "expense", "28.00", "Cinema", 1),
    ]
    for name, kind, amount, note, days in sample:
        db.add(Entry(owner_id=member.id, account_id=account.id, category_id=categories[name].id,
                     kind=kind, amount=Decimal(amount), note=note,
                     occurred_on=today - timedelta(days=min(days, today.day - 1))))
    month = date(today.year, today.month, 1)
    db.add(Budget(owner_id=member.id, category_id=categories["Food"].id, month=month, amount=Decimal("400.00")))
    db.commit()
    revoke_session(request, response, db)
    issue_session(response, db, member)
    return member_json(member)
