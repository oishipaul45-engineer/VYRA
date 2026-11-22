import os
import sqlite3
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175", "http://localhost:5176", "http://127.0.0.1:5176",
        "http://127.0.0.1:5175"
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"]
)

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
