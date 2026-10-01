import hashlib
import hmac
import secrets
from datetime import timedelta, timezone

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from .models import Member, RateAttempt, Session as LoginSession, utcnow


SESSION_COOKIE = "fw_session"
CSRF_COOKIE = "fw_csrf"
SESSION_DAYS = 7
ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=2)


def validate_password_choice(password: str, email: str | None = None) -> None:
    lowered = password.casefold()
    common = ("password", "qwerty", "123456", "letmein", "welcome", "admin123")
    if any(item in lowered for item in common) or (email and email.split("@", 1)[0].casefold() in lowered):
        raise HTTPException(422, "Choose a less common password")


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        return ph.verify(encoded, password)
    except (VerifyMismatchError, VerificationError):
        return False


def aware(value):
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def current_member(request: Request, db: Session = Depends(get_db)) -> Member:
    raw = request.cookies.get(SESSION_COOKIE)
    session = db.get(LoginSession, digest(raw)) if raw else None
    if not session or aware(session.expires_at) <= utcnow():
        raise HTTPException(401, "Please sign in")
    member = db.get(Member, session.member_id)
    if not member or (member.is_demo and member.demo_expires_at and aware(member.demo_expires_at) <= utcnow()):
        raise HTTPException(401, "Session expired")
    return member


def issue_session(response: Response, db: Session, member: Member) -> None:
    raw = secrets.token_urlsafe(48)
    seconds = 3600 if member.is_demo else SESSION_DAYS * 86400
    db.add(LoginSession(token_hash=digest(raw), member_id=member.id, expires_at=utcnow() + timedelta(seconds=seconds)))
    db.commit()
    response.set_cookie(
        SESSION_COOKIE, raw, max_age=seconds, httponly=True,
        secure=settings.production, samesite="lax", path="/",
    )
    response.delete_cookie(CSRF_COOKIE, path="/")


def revoke_session(request: Request, response: Response, db: Session) -> None:
    raw = request.cookies.get(SESSION_COOKIE)
    if raw:
        session = db.get(LoginSession, digest(raw))
        if session:
            db.delete(session)
            db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")


def _csrf_context(request: Request) -> str:
    raw = request.cookies.get(SESSION_COOKIE)
    return digest(raw) if raw else "anonymous"


def new_csrf(request: Request, response: Response) -> dict[str, str]:
    nonce = secrets.token_urlsafe(24)
    context = _csrf_context(request)
    signature = hmac.new(settings.SESSION_SECRET.encode(), f"{context}:{nonce}".encode(), hashlib.sha256).hexdigest()
    token = f"{nonce}.{signature}"
    response.set_cookie(CSRF_COOKIE, token, max_age=3600, httponly=False, secure=settings.production, samesite="lax", path="/")
    return {"csrf_token": token}


def check_csrf(request: Request) -> None:
    origin = request.headers.get("origin")
    referer = request.headers.get("referer")
    expected_origin = settings.PUBLIC_ORIGIN.rstrip("/")
    if origin and origin.rstrip("/") != expected_origin:
        raise HTTPException(403, "Invalid request origin")
    if not origin and referer and not referer.startswith(expected_origin + "/"):
        raise HTTPException(403, "Invalid request origin")
    if settings.production and not origin and not referer:
        raise HTTPException(403, "Missing request origin")

    cookie = request.cookies.get(CSRF_COOKIE, "")
    header = request.headers.get("x-csrf-token", "")
    if not cookie or not hmac.compare_digest(cookie, header):
        raise HTTPException(403, "Invalid CSRF token")
    try:
        nonce, signature = cookie.split(".", 1)
    except ValueError:
        raise HTTPException(403, "Invalid CSRF token") from None
    expected = hmac.new(
        settings.SESSION_SECRET.encode(), f"{_csrf_context(request)}:{nonce}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(403, "Invalid CSRF token")


def rate_limit(db: Session, key: str, *, limit: int, minutes: int) -> None:
    if secrets.randbelow(100) == 0:
        db.execute(delete(RateAttempt).where(RateAttempt.created_at < utcnow() - timedelta(days=2)))
    key_hash = digest(settings.SESSION_SECRET + ":" + key)
    cutoff = utcnow() - timedelta(minutes=minutes)
    count = db.scalar(select(func.count()).select_from(RateAttempt).where(
        RateAttempt.key_hash == key_hash, RateAttempt.created_at >= cutoff
    )) or 0
    if count >= limit:
        raise HTTPException(429, "Too many attempts. Try again later")
    db.add(RateAttempt(key_hash=key_hash))
    db.commit()


def client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"
