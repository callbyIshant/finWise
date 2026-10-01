from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..models.category import Category
from ..schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])

@router.get("/", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    categories = db.query(Category).filter((Category.user_id == current_user.id) | (Category.is_default == True)).all()
    return categories

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=CategoryResponse)
def create_category(category: CategoryCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Category).filter(Category.name == category.name, Category.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    new_cat = Category(
        name=category.name,
        icon=category.icon,
        color=category.color,
        user_id=current_user.id
    )
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    return new_cat

@router.put("/{id}", response_model=CategoryResponse)
def update_category(id: int, category: CategoryUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat.is_default:
        raise HTTPException(status_code=403, detail="Cannot edit default categories")
    if cat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if category.name:
        cat.name = category.name
    if category.icon:
        cat.icon = category.icon
    if category.color:
        cat.color = category.color
        
    db.commit()
    db.refresh(cat)
    return cat

@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    if cat.is_default:
        raise HTTPException(status_code=403, detail="Cannot delete default categories")
    if cat.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Simple check for transactions (would need to check actual transactions table in real logic)
    from ..models.transaction import Transaction
    txn_count = db.query(Transaction).filter(Transaction.category_id == id).count()
    if txn_count > 0:
        raise HTTPException(status_code=409, detail="Cannot delete category with associated transactions")
        
    db.delete(cat)
    db.commit()
    return None
