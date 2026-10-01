from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from ..dependencies import get_db, get_current_user
from ..models.user import User
from ..models.exchange_rate import ExchangeRate
from ..schemas.exchange_rate import ExchangeRatesResponse, ExchangeRateResponse, CollectionHistory
from ..services.data_collector import fetch_and_store_rates

router = APIRouter(prefix="/data", tags=["data"])

@router.get("/exchange-rates", response_model=ExchangeRatesResponse)
def get_exchange_rates(db: Session = Depends(get_db)):
    latest = db.query(ExchangeRate).order_by(ExchangeRate.fetched_at.desc()).first()
    if not latest:
        raise HTTPException(status_code=503, detail="Data not yet collected. Try again in a moment.")
        
    rates = db.query(ExchangeRate).filter(ExchangeRate.fetched_at == latest.fetched_at).all()
    rates_dict = {r.target: float(r.rate) for r in rates}
    return {
        "base": latest.base,
        "last_updated": latest.fetched_at,
        "rates": rates_dict
    }

@router.post("/collect", status_code=status.HTTP_202_ACCEPTED)
def trigger_collection(background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    background_tasks.add_task(fetch_and_store_rates)
    return {"message": "Data collection triggered in the background"}

@router.get("/collection-history", response_model=List[CollectionHistory])
def get_collection_history(
    limit: int = Query(10, le=50),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Group by fetched_at
    from sqlalchemy import func
    history = db.query(
        ExchangeRate.fetched_at, 
        ExchangeRate.base,
        func.count(ExchangeRate.id).label("rates_count")
    ).group_by(ExchangeRate.fetched_at, ExchangeRate.base).order_by(ExchangeRate.fetched_at.desc()).limit(limit).all()
    
    return [
        {"fetched_at": row.fetched_at, "base": row.base, "rates_count": row.rates_count}
        for row in history
    ]
