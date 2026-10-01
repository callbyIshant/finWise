import csv
import io
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from .common import account_json, amount, budget_json, category_json, entry_json, local_month, local_today, owned, validate_links
from .models import Account, Budget, Category, Entry, Member
from .dashboard_service import build_dashboard
from .schemas import AccountIn, AccountPatch, BudgetIn, BudgetPatch, CategoryIn, CategoryPatch, EntryIn, EntryPatch
from .security import current_member


router = APIRouter(tags=["finance"])


def matching_retry(existing: Entry, payload: EntryIn) -> dict:
    if any((existing.account_id != payload.account_id, existing.category_id != payload.category_id,
            existing.amount != payload.amount, existing.kind != payload.kind,
            existing.occurred_on != payload.occurred_on, existing.note != payload.note)):
        raise HTTPException(409, "Idempotency key was used for another transaction")
    return entry_json(existing)


@router.get("/accounts")
def accounts(member: Member = Depends(current_member), db: Session = Depends(get_db)):
    rows = db.scalars(select(Account).where(Account.owner_id == member.id).order_by(Account.created_at)).all()
    return [account_json(db, row) for row in rows]


@router.post("/accounts", status_code=201)
def create_account(payload: AccountIn, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    if member.is_demo and (db.scalar(select(func.count()).select_from(Account).where(Account.owner_id == member.id)) or 0) >= 5:
        raise HTTPException(429, "Demo account limit reached")
    row = Account(owner_id=member.id, name=payload.name.strip(), kind=payload.kind, opening_balance=payload.opening_balance)
    db.add(row)
    db.commit()
    return account_json(db, row)


@router.patch("/accounts/{item_id}")
def patch_account(item_id: UUID, payload: AccountPatch, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    row = owned(db, Account, item_id, member)
    if payload.name is not None:
        row.name = payload.name.strip()
    if payload.archived is not None:
        row.archived = payload.archived
    db.commit()
    return account_json(db, row)


@router.get("/categories")
def categories(member: Member = Depends(current_member), db: Session = Depends(get_db)):
    rows = db.scalars(select(Category).where(Category.owner_id == member.id).order_by(Category.kind, Category.name)).all()
    return [category_json(row) for row in rows]


@router.post("/categories", status_code=201)
def create_category(payload: CategoryIn, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    if member.is_demo and (db.scalar(select(func.count()).select_from(Category).where(Category.owner_id == member.id)) or 0) >= 30:
        raise HTTPException(429, "Demo category limit reached")
    row = Category(owner_id=member.id, name=payload.name.strip(), kind=payload.kind)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Category already exists") from None
    return category_json(row)


@router.patch("/categories/{item_id}")
def patch_category(item_id: UUID, payload: CategoryPatch, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    row = owned(db, Category, item_id, member)
    if row.is_default:
        raise HTTPException(403, "Default categories cannot be edited")
    row.name = payload.name.strip()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Category already exists") from None
    return category_json(row)


@router.delete("/categories/{item_id}", status_code=204)
def delete_category(item_id: UUID, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    row = owned(db, Category, item_id, member)
    if row.is_default:
        raise HTTPException(403, "Default categories cannot be deleted")
    if db.scalar(select(Entry.id).where(Entry.owner_id == member.id, Entry.category_id == item_id).limit(1)) or db.scalar(
        select(Budget.id).where(Budget.owner_id == member.id, Budget.category_id == item_id).limit(1)
    ):
        raise HTTPException(409, "Category is in use")
    db.delete(row)
    db.commit()
    return Response(status_code=204)


@router.get("/transactions")
def transactions(
    page: int = Query(1, ge=1), limit: int = Query(25, ge=1, le=100),
    kind: str | None = Query(None, pattern="^(income|expense)$"),
    account_id: UUID | None = None, category_id: UUID | None = None,
    start_date: date | None = None, end_date: date | None = None,
    member: Member = Depends(current_member), db: Session = Depends(get_db),
):
    if start_date and end_date and (start_date > end_date or (end_date - start_date).days > 3660):
        raise HTTPException(422, "Invalid date range")
    filters = [Entry.owner_id == member.id]
    if kind:
        filters.append(Entry.kind == kind)
    if account_id:
        filters.append(Entry.account_id == account_id)
    if category_id:
        filters.append(Entry.category_id == category_id)
    if start_date:
        filters.append(Entry.occurred_on >= start_date)
    if end_date:
        filters.append(Entry.occurred_on <= end_date)
    total = db.scalar(select(func.count()).select_from(Entry).where(*filters)) or 0
    rows = db.scalars(select(Entry).where(*filters).order_by(Entry.occurred_on.desc(), Entry.created_at.desc())
                      .offset((page - 1) * limit).limit(limit)).all()
    return {"items": [entry_json(row) for row in rows], "total": total, "page": page, "limit": limit}


@router.post("/transactions", status_code=201)
def create_transaction(
    payload: EntryIn, idempotency_key: str | None = Header(default=None, max_length=100),
    member: Member = Depends(current_member), db: Session = Depends(get_db),
):
    if payload.occurred_on > local_today(member):
        raise HTTPException(422, "Transaction date cannot be in the future")
    validate_links(db, member, payload.account_id, payload.category_id, payload.kind)
    if idempotency_key:
        existing = db.scalar(select(Entry).where(Entry.owner_id == member.id, Entry.idempotency_key == idempotency_key))
        if existing:
            return matching_retry(existing, payload)
    if member.is_demo and (db.scalar(select(func.count()).select_from(Entry).where(Entry.owner_id == member.id)) or 0) >= 100:
        raise HTTPException(429, "Demo transaction limit reached")
    row = Entry(owner_id=member.id, idempotency_key=idempotency_key, **payload.model_dump())
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        if idempotency_key:
            existing = db.scalar(select(Entry).where(Entry.owner_id == member.id, Entry.idempotency_key == idempotency_key))
            if existing:
                return matching_retry(existing, payload)
        raise
    return entry_json(row)


@router.get("/transactions/export.csv")
def export_transactions(member: Member = Depends(current_member), db: Session = Depends(get_db)):
    def safe_cell(value: str) -> str:
        return "'" + value if value.lstrip().startswith(("=", "+", "-", "@", "\t", "\r")) else value

    rows = db.scalars(select(Entry).where(Entry.owner_id == member.id).order_by(Entry.occurred_on)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Account", "Category", "Amount", "Note"])
    for row in rows:
        writer.writerow([row.occurred_on.isoformat(), row.kind, safe_cell(row.account.name),
                         safe_cell(row.category.name), amount(row.amount), safe_cell(row.note)])
    return Response(output.getvalue(), media_type="text/csv", headers={
        "Content-Disposition": "attachment; filename=finwise-transactions.csv", "Cache-Control": "no-store",
    })


@router.get("/transactions/{item_id}")
def get_transaction(item_id: UUID, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    return entry_json(owned(db, Entry, item_id, member))


@router.patch("/transactions/{item_id}")
def patch_transaction(item_id: UUID, payload: EntryPatch, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    row = owned(db, Entry, item_id, member)
    changes = payload.model_dump(exclude_unset=True, exclude_none=True)
    account_id = changes.get("account_id", row.account_id)
    category_id = changes.get("category_id", row.category_id)
    kind = changes.get("kind", row.kind)
    validate_links(db, member, account_id, category_id, kind, allow_archived=account_id == row.account_id)
    for key, value in changes.items():
        setattr(row, key, value)
    if row.occurred_on > local_today(member):
        raise HTTPException(422, "Transaction date cannot be in the future")
    db.commit()
    return entry_json(row)


@router.delete("/transactions/{item_id}", status_code=204)
def delete_transaction(item_id: UUID, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    db.delete(owned(db, Entry, item_id, member))
    db.commit()
    return Response(status_code=204)


@router.get("/budgets")
def budgets(month: date | None = None, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    month = month or local_month(member)
    if month.day != 1:
        raise HTTPException(422, "Month must be the first calendar day")
    rows = db.scalars(select(Budget).where(Budget.owner_id == member.id, Budget.month == month)).all()
    return [budget_json(db, row) for row in rows]


@router.post("/budgets", status_code=201)
def create_budget(payload: BudgetIn, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    if member.is_demo and (db.scalar(select(func.count()).select_from(Budget).where(Budget.owner_id == member.id)) or 0) >= 20:
        raise HTTPException(429, "Demo budget limit reached")
    category = owned(db, Category, payload.category_id, member)
    if category.kind != "expense":
        raise HTTPException(422, "Budgets require an expense category")
    row = Budget(owner_id=member.id, **payload.model_dump())
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Budget already exists for this month") from None
    return budget_json(db, row)


@router.patch("/budgets/{item_id}")
def patch_budget(item_id: UUID, payload: BudgetPatch, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    row = owned(db, Budget, item_id, member)
    row.amount = payload.amount
    db.commit()
    return budget_json(db, row)


@router.delete("/budgets/{item_id}", status_code=204)
def delete_budget(item_id: UUID, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    db.delete(owned(db, Budget, item_id, member))
    db.commit()
    return Response(status_code=204)


@router.get("/dashboard")
def dashboard(month: str | None = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$"),
              member: Member = Depends(current_member), db: Session = Depends(get_db)):
    try:
        selected = date.fromisoformat(month + "-01") if month else local_month(member)
    except ValueError:
        raise HTTPException(422, "Invalid month") from None
    return build_dashboard(db, member, selected)
