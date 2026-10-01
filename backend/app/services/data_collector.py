import httpx
import logging
from ..database import SessionLocal
from ..models.exchange_rate import ExchangeRate
from ..config import settings
from sqlalchemy.sql import func
from decimal import Decimal

logger = logging.getLogger(__name__)

def fetch_and_store_rates():
    logger.info("Starting exchange rate collection...")
    try:
        with httpx.Client() as client:
            response = client.get(settings.EXCHANGE_RATE_API_URL, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            if data.get("result") != "success":
                logger.error(f"API returned non-success: {data}")
                return
                
            base_currency = data.get("base_code", "USD")
            rates = data.get("rates", {})
            
            db = SessionLocal()
            try:
                # We fetch all rates and insert them
                # A better approach for huge lists might be bulk_insert_mappings
                # but we'll do simple bulk save objects for now.
                new_rates = []
                for target_curr, rate_val in rates.items():
                    new_rates.append(
                        ExchangeRate(
                            base=base_currency,
                            target=target_curr,
                            rate=Decimal(str(rate_val))
                        )
                    )
                db.bulk_save_objects(new_rates)
                db.commit()
                logger.info(f"Successfully collected {len(new_rates)} exchange rates.")
            except Exception as e:
                logger.error(f"Error saving exchange rates: {e}")
                db.rollback()
            finally:
                db.close()
                
    except Exception as e:
        logger.error(f"Failed to fetch exchange rates: {e}")
