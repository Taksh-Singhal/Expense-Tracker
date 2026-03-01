"""
Smart Student Expense Tracker — Backend
========================================
Run with:  uvicorn main:app --reload

Routes
------
GET    /expenses              – list all expenses
POST   /expenses              – create a manual expense
DELETE /expenses/{id}         – delete an expense
POST   /upload-pdf            – parse UPI PDF statement and save debit transactions
GET    /                      – health check

Supported UPI providers for /upload-pdf
---------------------------------------
  MobiKwik · Paytm · PhonePe
"""

from __future__ import annotations

from collections import defaultdict
from typing import List

import pdfplumber
from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRouter
from pydantic import BaseModel
from sqlalchemy import Column, Float, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from parsers import get_parser

# ─────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────

DATABASE_URL = "sqlite:///./expenses.db"

engine       = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Expense(Base):
    __tablename__ = "expenses"

    id       = Column(Integer, primary_key=True, index=True)
    title    = Column(String,  nullable=False)
    amount   = Column(Float,   nullable=False)
    category = Column(String,  default="Miscellaneous")
    date     = Column(String,  nullable=False)   # ISO-8601: YYYY-MM-DD


Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency — yields a DB session and guarantees cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────
# Pydantic schemas
# ─────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    title:    str
    amount:   float
    category: str = "Miscellaneous"
    date:     str                       # YYYY-MM-DD


class ExpenseResponse(ExpenseCreate):
    id: int

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────
# Router
# ─────────────────────────────────────────────

router = APIRouter()


@router.get("/expenses", response_model=List[ExpenseResponse])
def get_expenses(db: Session = Depends(get_db)):
    return db.query(Expense).order_by(Expense.date).all()


@router.post("/expenses", response_model=ExpenseResponse, status_code=201)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    new_exp = Expense(**expense.model_dump())
    db.add(new_exp)
    db.commit()
    db.refresh(new_exp)
    return new_exp


@router.delete("/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db)):
    exp = db.query(Expense).filter(Expense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(exp)
    db.commit()
    return {"message": "Expense deleted successfully"}

@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    updated: ExpenseCreate,
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()

    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense.title = updated.title
    expense.amount = updated.amount
    expense.category = updated.category
    expense.date = updated.date

    db.commit()
    db.refresh(expense)

    return expense


@router.post("/upload-pdf")
def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Accept a UPI statement PDF (MobiKwik, Paytm, or PhonePe), auto-detect
    the provider, extract debit transactions, persist new ones, and return
    a summary.

    Response shape (unchanged from v1 — frontend contract preserved):
        {
            "saved":        int,
            "transactions": [{"merchant": str, "amount": float, "date": str}],
            "total_spent":  float,
            "top_merchant": {"merchant": str, "total_spent": float} | null
        }
    """
    transactions: list[dict] = []

    try:
        with pdfplumber.open(file.file) as pdf:
            parser      = get_parser(pdf)          # detect provider
            transactions = parser.parse(pdf)       # extract debits
    except ValueError as exc:
        # Unknown / unsupported provider
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"PDF processing failed: {exc}")

    if not transactions:
        return {
            "saved":        0,
            "transactions": [],
            "total_spent":  0.0,
            "top_merchant": None,
        }

    # ── Deduplicate and persist ────────────────────────────────────────────────
    saved = 0
    for tx in transactions:
        exists = (
            db.query(Expense)
            .filter(
                Expense.title  == tx["merchant"],
                Expense.amount == tx["amount"],
                Expense.date   == tx["date"],
            )
            .first()
        )
        if exists:
            continue

        db.add(
            Expense(
                title    = tx["merchant"],
                amount   = tx["amount"],
                category = "Miscellaneous",
                date     = tx["date"],
            )
        )
        saved += 1

    db.commit()

    # ── Summary ────────────────────────────────────────────────────────────────
    total_spent: float = sum(t["amount"] for t in transactions)

    spend_by_merchant: dict[str, float] = defaultdict(float)
    for tx in transactions:
        spend_by_merchant[tx["merchant"]] += tx["amount"]

    top_merchant, top_spend = max(spend_by_merchant.items(), key=lambda x: x[1])

    return {
        "saved":        saved,
        "transactions": transactions,
        "total_spent":  total_spent,
        "top_merchant": {"merchant": top_merchant, "total_spent": top_spend},
    }


# ─────────────────────────────────────────────
# Application
# ─────────────────────────────────────────────

app = FastAPI(
    title       = "Smart Student Expense Tracker",
    description = (
        "Upload UPI statement PDFs (MobiKwik / Paytm / PhonePe) "
        "to automatically track debit transactions."
    ),
    version = "3.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173", "http://localhost:5174"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

app.include_router(router)


@app.get("/", tags=["Health"])
def health():
    return {"status": "ok"}