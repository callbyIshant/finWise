from datetime import date
from datetime import timedelta
from uuid import UUID

import pytest

from app.config import Settings
from app.config import settings
from app.mvp.models import Member, utcnow
from .conftest import TestSession, csrf, register


def make_account(client, name="Everyday"):
    response = client.post("/api/v1/accounts", headers=csrf(client), json={
        "name": name, "kind": "bank", "opening_balance": "100.00",
    })
    assert response.status_code == 201, response.text
    return response.json()


def category(client, kind, name):
    return next(item for item in client.get("/api/v1/categories").json() if item["kind"] == kind and item["name"] == name)


def make_entry(client, account, category_id, amount="25.50", kind="expense", key="sample-key"):
    return client.post("/api/v1/transactions", headers={**csrf(client), "Idempotency-Key": key}, json={
        "account_id": account["id"], "category_id": category_id, "amount": amount,
        "kind": kind, "occurred_on": date.today().isoformat(), "note": "Groceries",
    })


def test_registration_session_csrf_and_logout(client):
    assert client.post("/api/v1/auth/register", json={}).status_code == 403
    member = register(client)
    assert member["email"] == "alex@example.com"
    assert client.cookies.get("fw_session")
    session_cookie = next(cookie for cookie in client.cookies.jar if cookie.name == "fw_session")
    assert "HttpOnly" in session_cookie._rest
    assert client.get("/api/v1/me").json()["id"] == member["id"]
    assert client.post("/api/v1/accounts", json={"name":"Cash","kind":"cash"}).status_code == 403
    assert client.post("/api/v1/auth/logout", headers=csrf(client)).status_code == 200
    assert client.get("/api/v1/me").status_code == 401


def test_rejects_wrong_origin(client):
    headers = csrf(client)
    headers["Origin"] = "https://attacker.example"
    response = client.post("/api/v1/auth/register", headers=headers, json={
        "email":"outside@example.com", "full_name":"Someone", "password":"is-it-clearer-today-27",
    })
    assert response.status_code == 403


def test_only_current_pages_are_served_with_private_cache_controls(client):
    landing = client.get("/")
    assert landing.status_code == 200
    assert "FinWise" in landing.text and "Pocket Clear" not in landing.text
    assert client.get("/assets/common.js").status_code == 200
    assert client.get("/dashboard.html").status_code == 404
    private_page = client.get("/app")
    assert private_page.headers["cache-control"] == "no-store"
    assert "default-src 'self'" in private_page.headers["content-security-policy"]
    assert client.get("/health").status_code == 200


def test_financial_totals_budget_edit_delete_and_retry(client):
    register(client)
    account = make_account(client)
    food = category(client, "expense", "Food")
    created = make_entry(client, account, food["id"])
    assert created.status_code == 201, created.text
    retried = make_entry(client, account, food["id"])
    assert retried.status_code == 201
    assert retried.json()["id"] == created.json()["id"]
    assert make_entry(client, account, food["id"], amount="26.00").status_code == 409
    month = date.today().replace(day=1).isoformat()
    budget = client.post("/api/v1/budgets", headers=csrf(client), json={
        "category_id": food["id"], "month": month, "amount": "40.00",
    })
    assert budget.status_code == 201, budget.text
    summary = client.get("/api/v1/dashboard").json()
    assert summary["expenses"] == "25.50"
    assert summary["total_balance"] == "74.50"
    assert summary["budgets"][0]["remaining"] == "14.50"
    changed = client.patch("/api/v1/transactions/" + created.json()["id"], headers=csrf(client), json={"amount":"30.25"})
    assert changed.status_code == 200, changed.text
    summary = client.get("/api/v1/dashboard").json()
    assert summary["expenses"] == "30.25"
    assert summary["total_balance"] == "69.75"
    assert client.delete("/api/v1/transactions/" + created.json()["id"], headers=csrf(client)).status_code == 204
    assert client.get("/api/v1/dashboard").json()["expenses"] == "0.00"


def test_user_records_are_isolated(client):
    register(client, "first@example.com")
    account = make_account(client)
    food = category(client, "expense", "Food")
    entry = make_entry(client, account, food["id"]).json()
    budget = client.post("/api/v1/budgets", headers=csrf(client), json={
        "category_id": food["id"], "month": date.today().replace(day=1).isoformat(), "amount":"50.00",
    }).json()
    client.post("/api/v1/auth/logout", headers=csrf(client))
    register(client, "second@example.com")
    own_account = make_account(client, "Second")
    own_food = category(client, "expense", "Food")
    assert client.get("/api/v1/accounts").json()[0]["id"] == own_account["id"]
    assert client.get("/api/v1/transactions").json()["total"] == 0
    assert client.get("/api/v1/transactions/" + entry["id"]).status_code == 404
    assert client.patch("/api/v1/transactions/" + entry["id"], headers=csrf(client), json={"amount":"1.00"}).status_code == 404
    assert client.delete("/api/v1/transactions/" + entry["id"], headers=csrf(client)).status_code == 404
    assert client.patch("/api/v1/accounts/" + account["id"], headers=csrf(client), json={"name":"Stolen"}).status_code == 404
    assert client.patch("/api/v1/budgets/" + budget["id"], headers=csrf(client), json={"amount":"1.00"}).status_code == 404
    assert client.post("/api/v1/transactions", headers=csrf(client), json={
        "account_id": account["id"], "category_id": own_food["id"], "amount":"1.00",
        "kind":"expense", "occurred_on":date.today().isoformat(),
    }).status_code == 404
    assert client.post("/api/v1/budgets", headers=csrf(client), json={
        "category_id": food["id"], "month":date.today().replace(day=1).isoformat(), "amount":"1.00",
    }).status_code == 404
    assert "Groceries" not in client.get("/api/v1/transactions/export.csv").text


def test_invalid_money_and_category_type_are_rejected(client):
    register(client)
    account = make_account(client)
    income = category(client, "income", "Salary")
    assert make_entry(client, account, income["id"], kind="expense").status_code == 422
    assert make_entry(client, account, income["id"], amount="0.001", kind="income").status_code == 422
    assert make_entry(client, account, income["id"], amount="NaN", kind="income").status_code == 422


def test_demo_is_unique_and_sample_writes_do_not_leak(client):
    first = client.post("/api/v1/demo/session", headers=csrf(client))
    assert first.status_code == 201, first.text
    first_id = first.json()["id"]
    assert client.get("/api/v1/dashboard").json()["recent"]
    second = client.post("/api/v1/demo/session", headers=csrf(client))
    assert second.status_code == 201, second.text
    assert second.json()["id"] != first_id
    assert client.get("/api/v1/me").json()["id"] == second.json()["id"]


def test_account_deletion_cascades_and_currency_is_locked(client):
    register(client)
    account = make_account(client)
    food = category(client, "expense", "Food")
    assert make_entry(client, account, food["id"]).status_code == 201
    assert client.patch("/api/v1/me/preferences", headers=csrf(client), json={
        "currency":"USD", "timezone":"Asia/Kolkata",
    }).status_code == 409
    removed = client.request("DELETE", "/api/v1/me", headers=csrf(client), json={"password":"is-it-clearer-today-27"})
    assert removed.status_code == 200, removed.text
    assert client.get("/api/v1/me").status_code == 401


def test_password_reset_revokes_old_sessions(client, monkeypatch):
    register(client)
    sent = []

    class FakeSMTP:
        def __init__(self, *_args, **_kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *_args): pass
        def starttls(self): pass
        def login(self, *_args): pass
        def send_message(self, message): sent.append(message)

    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.example")
    monkeypatch.setattr(settings, "SMTP_USER", "user")
    monkeypatch.setattr(settings, "SMTP_PASSWORD", "secret")
    monkeypatch.setattr(settings, "MAIL_FROM", "FinWise <support@example.com>")
    monkeypatch.setattr("app.mvp.auth_routes.smtplib.SMTP", FakeSMTP)
    requested = client.post("/api/v1/auth/password-reset/request", headers=csrf(client), json={"email":"alex@example.com"})
    assert requested.status_code == 200, requested.text
    assert len(sent) == 1
    token = sent[0].get_content().split("token=")[1].splitlines()[0]
    confirmed = client.post("/api/v1/auth/password-reset/confirm", headers=csrf(client), json={
        "token": token, "password": "a-brighter-next-month-29",
    })
    assert confirmed.status_code == 200, confirmed.text
    assert client.get("/api/v1/me").status_code == 401
    assert client.post("/api/v1/auth/login", headers=csrf(client), json={
        "email":"alex@example.com", "password":"a-brighter-next-month-29",
    }).status_code == 200


def test_expired_demo_is_removed_on_next_demo(client):
    first = client.post("/api/v1/demo/session", headers=csrf(client)).json()
    with TestSession() as db:
        member = db.get(Member, UUID(first["id"]))
        member.demo_expires_at = utcnow() - timedelta(seconds=1)
        db.commit()
    assert client.get("/api/v1/me").status_code == 401
    client.post("/api/v1/demo/session", headers=csrf(client))
    with TestSession() as db:
        assert db.get(Member, UUID(first["id"])) is None


def test_production_requires_secure_neon_connections_and_https():
    configuration = Settings(
        APP_ENV="production", SESSION_SECRET="s" * 48,
        DATABASE_URL="postgresql+psycopg2://user:pass@ep-test-pooler.neon.tech/finwise?sslmode=require",
        MIGRATION_DATABASE_URL="postgresql+psycopg2://user:pass@ep-test.neon.tech/finwise?sslmode=require",
        PUBLIC_ORIGIN="https://finwise.example", SMTP_HOST="smtp.example", SMTP_USER="user",
        SMTP_PASSWORD="password", MAIL_FROM="help@finwise.example",
    )
    configuration.validate_production()
    configuration.PUBLIC_ORIGIN = "http://finwise.example"
    with pytest.raises(RuntimeError, match="HTTPS"):
        configuration.validate_production()
    configuration.PUBLIC_ORIGIN = "https://finwise.example"
    configuration.MIGRATION_DATABASE_URL = configuration.DATABASE_URL
    with pytest.raises(RuntimeError, match="direct"):
        configuration.validate_production()
