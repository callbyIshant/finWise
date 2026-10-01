"""Disposable production-mode API smoke test against a migrated Neon branch.

Run with APP_ENV=production and the branch's pooled/direct URLs in the
environment. This script creates and then deletes one isolated test member.
"""

import os
import secrets
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient

from app.main import app


origin = os.environ["PUBLIC_ORIGIN"]


with TestClient(app, base_url=origin) as client:
    assert client.get("/health").status_code == 200

    def write(method: str, path: str, payload: dict):
        token = client.get("/api/v1/auth/csrf").json()["csrf_token"]
        response = client.request(method, path, json=payload, headers={
            "Origin": origin, "X-CSRF-Token": token,
        })
        assert response.status_code < 400, (path, response.status_code, response.text)
        return response.json()

    email = f"smoke-{secrets.token_hex(8)}@example.com"
    password = "strong-preview-smoke-2026"
    write("POST", "/api/v1/auth/register", {
        "email": email, "full_name": "Preview Smoke", "password": password,
    })
    try:
        account = write("POST", "/api/v1/accounts", {
            "name": "Smoke cash", "kind": "cash", "opening_balance": "100.00",
        })
        category = next(item for item in client.get("/api/v1/categories").json() if item["name"] == "Food")
        today = datetime.now(ZoneInfo("Asia/Kolkata")).date()
        write("POST", "/api/v1/transactions", {
            "account_id": account["id"], "category_id": category["id"],
            "kind": "expense", "amount": "12.50", "occurred_on": today.isoformat(),
            "note": "Smoke test",
        })
        summary = client.get("/api/v1/dashboard").json()
        assert summary["expenses"] == "12.50"
        assert summary["total_balance"] == "87.50"
    finally:
        write("DELETE", "/api/v1/me", {"password": password})
    assert client.get("/api/v1/me").status_code == 401

print("Neon production-mode smoke passed; test member deleted")
