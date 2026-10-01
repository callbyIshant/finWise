from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, or_
from typing import Optional, List
from datetime import date
import uuid
import math
import csv
import io
import json
from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..models.transaction import Transaction
from ..models.category import Category
from ..schemas.transaction import (
    TransactionCreate, 
    TransactionUpdate, 
    TransactionResponse, 
    TransactionList,
    TransactionBulkImportRequest,
    TransactionBulkImportResponse
)

router = APIRouter(prefix="/transactions", tags=["transactions"])

@router.get("/", response_model=TransactionList)
def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    type: Optional[str] = None,
    category_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    sort_by: str = Query("date"),
    order: str = Query("desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    
    if type:
        query = query.filter(Transaction.type == type)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))
        
    if sort_by == "date":
        if order == "desc":
            query = query.order_by(desc(Transaction.date), desc(Transaction.created_at))
        else:
            query = query.order_by(asc(Transaction.date), asc(Transaction.created_at))
    elif sort_by == "amount":
        if order == "desc":
            query = query.order_by(desc(Transaction.amount))
        else:
            query = query.order_by(asc(Transaction.amount))
            
    total = query.count()
    pages = math.ceil(total / limit) if total > 0 else 1
    items = query.offset((page - 1) * limit).limit(limit).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=TransactionResponse)
def create_transaction(
    txn: TransactionCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Check category
    cat = db.query(Category).filter(Category.id == txn.category_id).first()
    if not cat:
        raise HTTPException(status_code=400, detail="Category not found")
    if not cat.is_default and cat.user_id != current_user.id:
        raise HTTPException(status_code=400, detail="Not authorized for this category")
        
    if txn.date > date.today():
        raise HTTPException(status_code=400, detail="Date cannot be in the future")
    if (date.today() - txn.date).days > (5 * 365):
        raise HTTPException(status_code=400, detail="Date cannot be more than 5 years in the past")
        
    new_txn = Transaction(
        user_id=current_user.id,
        category_id=txn.category_id,
        amount=txn.amount,
        type=txn.type,
        description=txn.description,
        date=txn.date
    )
    db.add(new_txn)
    db.commit()
    db.refresh(new_txn)
    return new_txn

@router.get("/export")
def export_transactions(
    format: str = Query("csv", pattern="^(csv|json)$"),
    type: Optional[str] = None,
    category_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Transaction).filter(Transaction.user_id == current_user.id)
    if type:
        query = query.filter(Transaction.type == type)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    
    transactions = query.order_by(desc(Transaction.date), desc(Transaction.created_at)).all()
    today_str = date.today().isoformat()
    
    if format == "json":
        data = [
            {
                "id": str(t.id),
                "date": t.date.isoformat(),
                "amount": float(t.amount),
                "type": t.type,
                "category": t.category.name if t.category else "Uncategorized",
                "category_id": t.category_id,
                "description": t.description or ""
            }
            for t in transactions
        ]
        return Response(
            content=json.dumps(data, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=finwise_export_{today_str}.json"}
        )
    
    # CSV format
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Type", "Category", "Amount", "Description", "ID"])
    for t in transactions:
        writer.writerow([
            t.date.isoformat(),
            t.type,
            t.category.name if t.category else "Uncategorized",
            f"{float(t.amount):.2f}",
            t.description or "",
            str(t.id)
        ])
    
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=finwise_export_{today_str}.csv"}
    )

@router.post("/bulk-import", response_model=TransactionBulkImportResponse, status_code=status.HTTP_201_CREATED)
def bulk_import_transactions(
    payload: TransactionBulkImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not payload.transactions:
        raise HTTPException(status_code=400, detail="No transactions provided")
    
    categories = db.query(Category).filter(
        or_(Category.is_default == True, Category.user_id == current_user.id)
    ).all()
    valid_category_ids = {c.id for c in categories}
    
    created_txns = []
    today = date.today()
    for txn in payload.transactions:
        if txn.category_id not in valid_category_ids:
            raise HTTPException(status_code=400, detail=f"Invalid category ID: {txn.category_id}")
        if txn.date > today:
            raise HTTPException(status_code=400, detail=f"Date cannot be in the future: {txn.date}")
        if (today - txn.date).days > (5 * 365):
            raise HTTPException(status_code=400, detail=f"Date cannot be more than 5 years in the past: {txn.date}")
        
        new_txn = Transaction(
            user_id=current_user.id,
            category_id=txn.category_id,
            amount=txn.amount,
            type=txn.type,
            description=txn.description,
            date=txn.date
        )
        created_txns.append(new_txn)
        
    db.add_all(created_txns)
    db.commit()
    return TransactionBulkImportResponse(
        imported_count=len(created_txns),
        message=f"Successfully imported {len(created_txns)} transactions"
    )

@router.get("/{id}", response_model=TransactionResponse)
def get_transaction(id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    txn = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return txn

@router.put("/{id}", response_model=TransactionResponse)
def update_transaction(
    id: uuid.UUID, 
    txn_update: TransactionUpdate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    txn = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if txn_update.category_id is not None:
        cat = db.query(Category).filter(Category.id == txn_update.category_id).first()
        if not cat or (not cat.is_default and cat.user_id != current_user.id):
            raise HTTPException(status_code=400, detail="Invalid category")
        txn.category_id = txn_update.category_id
        
    if txn_update.amount is not None:
        txn.amount = txn_update.amount
    if txn_update.type is not None:
        txn.type = txn_update.type
    if txn_update.description is not None:
        txn.description = txn_update.description
    if txn_update.date is not None:
        if txn_update.date > date.today():
            raise HTTPException(status_code=400, detail="Date cannot be in the future")
        txn.date = txn_update.date
        
    db.commit()
    db.refresh(txn)
    return txn

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(id: uuid.UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    txn = db.query(Transaction).filter(Transaction.id == id, Transaction.user_id == current_user.id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    db.delete(txn)
    db.commit()
    return None
