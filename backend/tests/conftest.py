import os

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["SESSION_SECRET"] = "tests-have-a-long-and-unique-session-secret"
os.environ["PUBLIC_ORIGIN"] = "http://testserver"
os.environ["APP_ENV"] = "test"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)


@event.listens_for(engine, "connect")
def enable_foreign_keys(connection, _record):
    connection.execute("PRAGMA foreign_keys=ON")


TestSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def override_db():
    with TestSession() as db:
        yield db


app.dependency_overrides[get_db] = override_db


@pytest.fixture
def client():
    Base.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(engine)


def csrf(client):
    return {"X-CSRF-Token": client.get("/api/v1/auth/csrf").json()["csrf_token"]}


def register(client, email="alex@example.com"):
    response = client.post("/api/v1/auth/register", headers=csrf(client), json={
        "email": email, "full_name": "Alex Morgan", "password": "is-it-clearer-today-27",
    })
    assert response.status_code == 201, response.text
    return response.json()
