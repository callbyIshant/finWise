from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .mvp.auth_routes import me_router, router as auth_router
from .mvp.demo_routes import router as demo_router
from .mvp.finance_routes import router as finance_router
from .mvp.security import check_csrf


settings.validate_production()
FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "mvp"

app = FastAPI(
    title="FinWise API", version="1.0.0",
    docs_url=None if settings.production else "/docs",
    redoc_url=None,
)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(me_router, prefix="/api/v1")
app.include_router(finance_router, prefix="/api/v1")
app.include_router(demo_router, prefix="/api/v1")


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    if request.url.path.startswith("/api/v1/") and request.method not in ("GET", "HEAD", "OPTIONS"):
        try:
            check_csrf(request)
        except HTTPException as error:
            response = JSONResponse({"code": "csrf_rejected", "message": error.detail}, status_code=error.status_code)
            return secure_headers(response, request)
    response = await call_next(request)
    return secure_headers(response, request)


def secure_headers(response, request: Request):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
        "connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    )
    if request.url.path.startswith("/api/") or request.url.path in ("/app", "/login", "/reset", "/onboarding"):
        response.headers["Cache-Control"] = "no-store"
    elif request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache"
    if settings.production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(HTTPException)
async def api_error(request: Request, error: HTTPException):
    codes = {400: "bad_request", 401: "unauthenticated", 403: "forbidden", 404: "not_found",
             409: "conflict", 422: "invalid_request", 429: "rate_limited", 503: "unavailable"}
    return JSONResponse({"code": codes.get(error.status_code, "request_failed"), "message": error.detail},
                        status_code=error.status_code, headers=error.headers)


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    details = [{"field": ".".join(str(part) for part in item["loc"]), "message": item["msg"]} for item in error.errors()]
    return JSONResponse({"code": "validation_error", "message": "Please check the submitted fields", "details": details}, status_code=422)


@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1 FROM members LIMIT 1"))
        return {"status": "ok"}
    except Exception:
        return JSONResponse({"status": "unavailable"}, status_code=503)


@app.get("/")
def landing():
    return FileResponse(FRONTEND / "index.html")


@app.get("/login")
def login_page():
    return FileResponse(FRONTEND / "login.html")


@app.get("/reset")
def reset_page():
    return FileResponse(FRONTEND / "reset.html")


@app.get("/onboarding")
def onboarding_page():
    return FileResponse(FRONTEND / "onboarding.html")


@app.get("/app")
def app_page():
    return FileResponse(FRONTEND / "app.html")


app.mount("/assets", StaticFiles(directory=FRONTEND / "assets"), name="assets")
