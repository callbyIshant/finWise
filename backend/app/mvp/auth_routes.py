import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from .common import add_defaults, member_json
from .models import Account, Member, PasswordReset, Session as LoginSession, utcnow
from .schemas import DeleteAccountIn, LoginIn, PreferencesIn, RegisterIn, ResetConfirmIn, ResetRequestIn
from .security import aware, client_key, current_member, digest, hash_password, issue_session, new_csrf, rate_limit, revoke_session, validate_password_choice, verify_password


router = APIRouter(prefix="/auth", tags=["auth"])
me_router = APIRouter(tags=["profile"])


@router.get("/csrf")
def csrf(request: Request, response: Response):
    return new_csrf(request, response)


@router.post("/register", status_code=201)
def register(payload: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    rate_limit(db, "register:" + client_key(request), limit=8, minutes=60)
    email = str(payload.email).strip().lower()
    if db.scalar(select(Member.id).where(Member.email == email)):
        raise HTTPException(409, "Account already exists")
    validate_password_choice(payload.password, email)
    member = Member(email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password))
    db.add(member)
    try:
        db.flush()
        add_defaults(db, member)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Account already exists") from None
    issue_session(response, db, member)
    return member_json(member)


@router.post("/login")
def login(payload: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = str(payload.email).strip().lower()
    rate_limit(db, "login:" + client_key(request) + ":" + email, limit=8, minutes=15)
    member = db.scalar(select(Member).where(Member.email == email, Member.is_demo.is_(False)))
    if not member or not verify_password(payload.password, member.password_hash):
        raise HTTPException(401, "Invalid email or password")
    revoke_session(request, response, db)
    issue_session(response, db, member)
    return member_json(member)


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    revoke_session(request, response, db)
    return {"ok": True}


@me_router.get("/me")
def me(member: Member = Depends(current_member)):
    return member_json(member)


@me_router.patch("/me/preferences")
def update_preferences(payload: PreferencesIn, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    if member.is_demo:
        raise HTTPException(403, "Demo preferences are fixed")
    if payload.currency != member.currency and db.scalar(select(Account.id).where(Account.owner_id == member.id).limit(1)):
        raise HTTPException(409, "Currency is locked after the first account is added")
    member.currency = payload.currency
    member.timezone = payload.timezone
    db.commit()
    return member_json(member)


@router.post("/password-reset/request")
def request_reset(payload: ResetRequestIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(db, "reset:" + client_key(request), limit=5, minutes=60)
    if not all((settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASSWORD, settings.MAIL_FROM)):
        raise HTTPException(503, "Password reset is not configured")
    member = db.scalar(select(Member).where(Member.email == str(payload.email).lower(), Member.is_demo.is_(False)))
    if member:
        raw = secrets.token_urlsafe(40)
        db.add(PasswordReset(token_hash=digest(raw), member_id=member.id, expires_at=utcnow() + timedelta(minutes=30)))
        db.commit()
        message = EmailMessage()
        message["From"] = settings.MAIL_FROM
        message["To"] = member.email
        message["Subject"] = "Reset your FinWise password"
        message.set_content(f"Open this link to reset your password (valid for 30 minutes):\n{settings.PUBLIC_ORIGIN}/reset?token={raw}\n")
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            smtp.send_message(message)
    return {"message": "If this account exists, a reset link has been sent"}


@router.post("/password-reset/confirm")
def confirm_reset(payload: ResetConfirmIn, request: Request, db: Session = Depends(get_db)):
    rate_limit(db, "reset-confirm:" + client_key(request), limit=10, minutes=60)
    record = db.get(PasswordReset, digest(payload.token))
    if not record or aware(record.expires_at) <= utcnow():
        raise HTTPException(400, "Invalid or expired reset link")
    member = db.get(Member, record.member_id)
    validate_password_choice(payload.password, member.email)
    member.password_hash = hash_password(payload.password)
    db.execute(delete(LoginSession).where(LoginSession.member_id == member.id))
    db.execute(delete(PasswordReset).where(PasswordReset.member_id == member.id))
    db.commit()
    return {"ok": True}


@me_router.delete("/me")
def delete_me(payload: DeleteAccountIn, request: Request, response: Response, member: Member = Depends(current_member), db: Session = Depends(get_db)):
    if not member.is_demo and not verify_password(payload.password, member.password_hash):
        raise HTTPException(403, "Current password is incorrect")
    db.delete(member)
    db.commit()
    response.delete_cookie("fw_session", path="/")
    response.delete_cookie("fw_csrf", path="/")
    return {"ok": True}
