import os
import sqlite3
import hashlib
import hmac
import secrets
import time
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

SECRET = os.getenv("VYRA_JWT_SECRET", "")
if len(SECRET) < 32:
    raise RuntimeError("Missing or weak VYRA_JWT_SECRET in backend/.env")

DB_PATH = BASE_DIR / "vyra_users.sqlite3"

def connect():
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    return db

with connect() as db:
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL
        )
    """)
    db.commit()

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.scrypt(
        password.encode("utf-8"),
        salt=salt,
        n=16384,
        r=8,
        p=1,
        dklen=32
    )
    return "scrypt$" + salt.hex() + "$" + key.hex()

def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, salt_hex, key_hex = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = bytes.fromhex(key_hex)
        actual = hashlib.scrypt(
            password.encode("utf-8"),
            salt=bytes.fromhex(salt_hex),
            n=16384,
            r=8,
            p=1,
            dklen=len(expected)
        )
        return hmac.compare_digest(expected, actual)
    except (ValueError, TypeError):
        return False

app = FastAPI(title="VYRA Auth API", version="0.1.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", "http://127.0.0.1:5178", "http://localhost:5178",
        "http://127.0.0.1:5173",
        "http://localhost:5175", "http://localhost:5176", "http://127.0.0.1:5176",
        "http://127.0.0.1:5175"
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type"]
)

# VYRA SECURITY / LOGIN RATE LIMIT V1
# Development-friendly, per-process IP limits. Configure a shared limiter for production.
_rate_lock = threading.Lock()
_rate_events: dict[tuple[str, str], list[float]] = {}


def _rate_limit(ip: str, action: str) -> int:
    """Seconds until retry, or 0 if the request is allowed."""
    now = time.monotonic()
    limit, window = (10, 60) if action == "login" else (5, 300)
    key = (ip, action)
    with _rate_lock:
        # Expire old buckets to avoid indefinitely retaining IP addresses.
        for item in list(_rate_events):
            horizon = 60 if item[1] == "login" else 300
            recent = [t for t in _rate_events[item] if now - t < horizon]
            if recent:
                _rate_events[item] = recent
            else:
                del _rate_events[item]
        visits = _rate_events.setdefault(key, [])
        if len(visits) >= limit:
            return max(1, int(window - (now - visits[0])) + 1)
        visits.append(now)
    return 0


@app.middleware("http")
async def vyra_security_headers(request: Request, call_next):
    if request.method == "POST" and request.url.path in ("/auth/login", "/auth/signup"):
        ip = request.client.host if request.client else "unknown"
        action = "login" if request.url.path.endswith("login") else "signup"
        retry = _rate_limit(ip, action)
        if retry:
            response = JSONResponse(
                status_code=429,
                content={"detail": "Too many attempts. Please try again later."},
                headers={"Retry-After": str(retry)},
            )
        else:
            response = await call_next(request)
    else:
        response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if request.url.path.startswith(("/auth/", "/workspace/")):
        response.headers["Cache-Control"] = "no-store"
    return response

security = HTTPBearer()

class Signup(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)

class Login(BaseModel):
    email: EmailStr
    password: str

class UserPublic(BaseModel):
    id: int
    name: str
    email: EmailStr

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic

def public(user):
    return UserPublic(
        id=user["id"],
        name=user["name"],
        email=user["email"]
    )

def token_for(user):
    expiry = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode(
        {"sub": str(user["id"]), "exp": expiry},
        SECRET,
        algorithm="HS256"
    )

def current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET,
            algorithms=["HS256"]
        )
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session"
        )

    with connect() as db:
        user = db.execute(
            "SELECT id, name, email FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()

    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user

@app.get("/health")
def health():
    return {"status": "ok", "mode": "demo-auth"}

@app.post("/auth/signup", response_model=AuthResponse, status_code=201)
def signup(body: Signup):
    name = body.name.strip()
    email = str(body.email).strip().lower()

    if len(name) < 2:
        raise HTTPException(status_code=422, detail="Name is too short")

    password_hash = hash_password(body.password)

    try:
        with connect() as db:
            cursor = db.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (name, email, password_hash)
            )
            user_id = cursor.lastrowid
            db.commit()
            user = db.execute(
                "SELECT id, name, email FROM users WHERE id = ?",
                (user_id,)
            ).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )

    return AuthResponse(
        access_token=token_for(user),
        user=public(user)
    )

@app.post("/auth/login", response_model=AuthResponse)
def login(body: Login):
    email = str(body.email).strip().lower()

    with connect() as db:
        user = db.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,)
        ).fetchone()

    # Also perform a password-hash operation for unknown accounts.
    if user is None:
        hash_password(body.password)
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )

    return AuthResponse(
        access_token=token_for(user),
        user=public(user)
    )

@app.get("/auth/me", response_model=UserPublic)
def me(user=Depends(current_user)):
    return public(user)

# VYRA account-linked demo workspace. Each account owns its own JSON document.
# Bootstrap is insert-only, so a stale browser cannot replace existing server data.
import json
from typing import Literal
from pydantic import model_validator

class WorkspaceTransaction(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    category: str = Field(min_length=1, max_length=80)
    amount: float = Field(ge=-1000000000, le=1000000000, allow_inf_nan=False)
    date: str = Field(min_length=1, max_length=32)
    note: str | None = Field(default=None, max_length=500)

class WorkspaceVault(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    goal: float = Field(gt=0, le=1000000000, allow_inf_nan=False)
    saved: float = Field(ge=0, le=1000000000, allow_inf_nan=False)
    icon: str = Field(max_length=30)

class WorkspaceCircleExpense(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=100)
    paidBy: str = Field(min_length=1, max_length=40)
    amount: float = Field(gt=0, le=1000000, allow_inf_nan=False)
    splitWith: list[str] = Field(min_length=1, max_length=14)
    date: str = Field(min_length=1, max_length=32)

class WorkspaceCircle(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    members: int = Field(ge=0, le=100000)
    expenses: float = Field(ge=0, le=1000000000, allow_inf_nan=False)
    balance: float = Field(ge=-1000000000, le=1000000000, allow_inf_nan=False)
    roster: list[str] | None = Field(default=None, max_length=14)
    ledger: list[WorkspaceCircleExpense] | None = Field(default=None, max_length=1000)

class WorkspaceState(BaseModel):
    name: str = Field(max_length=100)
    transactions: list[WorkspaceTransaction] = Field(max_length=2000)
    vaults: list[WorkspaceVault] = Field(max_length=200)
    circles: list[WorkspaceCircle] = Field(max_length=200)
    reducedMotion: bool
    hideAmounts: bool

class WorkspaceWrite(BaseModel):
    version: int = Field(ge=1)
    state: WorkspaceState

with connect() as db:
    db.execute("""
        CREATE TABLE IF NOT EXISTS workspaces (
            user_id INTEGER PRIMARY KEY REFERENCES users(id),
            payload TEXT NOT NULL,
            version INTEGER NOT NULL DEFAULT 1,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    db.commit()

def read_workspace(user_id: int):
    with connect() as db:
        row = db.execute(
            "SELECT payload, version FROM workspaces WHERE user_id = ?", (user_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not initialized")
    return {"state": json.loads(row["payload"]), "version": row["version"]}

@app.post('/workspace/me/initialize')
def initialize_workspace(body: WorkspaceState, user=Depends(current_user)):
    data = json.dumps(body.model_dump(), ensure_ascii=False)
    with connect() as db:
        db.execute(
            "INSERT OR IGNORE INTO workspaces (user_id, payload, version) VALUES (?, ?, 1)",
            (user['id'], data)
        )
        db.commit()
    return read_workspace(user['id'])

@app.get('/workspace/me')
def get_workspace(user=Depends(current_user)):
    return read_workspace(user['id'])

@app.put('/workspace/me')
def save_workspace(body: WorkspaceWrite, user=Depends(current_user)):
    data = json.dumps(body.state.model_dump(), ensure_ascii=False)
    with connect() as db:
        cur = db.execute(
            """UPDATE workspaces SET payload = ?, version = version + 1,
               updated_at = CURRENT_TIMESTAMP
               WHERE user_id = ? AND version = ?""",
            (data, user['id'], body.version)
        )
        db.commit()
        if cur.rowcount != 1:
            raise HTTPException(status_code=409, detail="Workspace changed in another session; reload latest data")
    return {"version": body.version + 1}