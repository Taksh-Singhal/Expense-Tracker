from __future__ import annotations

import re
from datetime import datetime

from .base import BaseUPIParser

# ── Constants ──────────────────────────────────────────────────────────────────

# Numbers whose x0 exceeds this threshold belong to the Wallet Balance column,
# not the Debit column.  MobiKwik right-aligns debit amounts at x1 ≈ 419 and
# wallet balance at x1 ≈ 511; the gap is unambiguous at x0 ≈ 440.
_WALLET_X_THRESHOLD: float = 440.0

_SKIP_TOKENS   = frozenset({"paid", "to", "rs.", "rs"})
_SKIP_KEYWORDS = ["cashback", "money received", "received from", "pocket upi"]
_DATE_RE        = re.compile(r"\d{2}-\d{2}-\d{4}")
_AMOUNT_RE      = re.compile(r"[\d,]+(?:\.\d+)?")


# ── Internal helpers ───────────────────────────────────────────────────────────

def _cluster_rows(words: list[dict], y_tolerance: float = 4.0) -> list[dict]:
    """Group pdfplumber word dicts into rows by Y-axis proximity."""
    rows: list[dict] = []
    for word in sorted(words, key=lambda w: w.get("top", 0)):
        for row in rows:
            if abs(row["top"] - word.get("top", 0)) <= y_tolerance:
                row["words"].append(word)
                break
        else:
            rows.append({"top": word.get("top", 0), "words": [word]})
    return rows


def _extract_page_transactions(words: list[dict]) -> list[dict]:
    """
    Parse one page's word list into debit transactions.

    MobiKwik column layout
    ──────────────────────
    Date | Transaction Details | Amount | Wallet Balance

    Key rules:
      • A debit row always contains a standalone '-' token.
      • Normal row: '-'  Rs.  <debit_amt>  Rs.  <wallet_bal>
      • Split row (long name): '-'  Rs.  <wallet_bal>  on primary line;
        continuation line carries the actual debit amount.
      • Debit column:  x0 < 440   Wallet-balance column: x0 > 440
    """
    transactions: list[dict] = []
    if not words:
        return transactions

    rows = _cluster_rows(words)
    n    = len(rows)
    i    = 0

    while i < n:
        row_words    = sorted(rows[i]["words"], key=lambda w: w.get("x0", 0))
        texts        = [w.get("text", "").strip() for w in row_words]
        joined_lower = " ".join(texts).lower()

        # Must start with a recognisable date
        date_str = next((t for t in texts if _DATE_RE.fullmatch(t)), None)
        if not date_str:
            i += 1
            continue

        # Skip credit / cashback rows
        if any(kw in joined_lower for kw in _SKIP_KEYWORDS):
            i += 1
            continue

        # Must carry a '-' debit marker
        if "-" not in texts:
            i += 1
            continue

        try:
            iso_date = datetime.strptime(date_str, "%d-%m-%Y").date().isoformat()
        except ValueError:
            i += 1
            continue

        minus_idx = texts.index("-")

        # Collect merchant tokens (everything before '-')
        merchant_tokens: list[str] = []
        for t in texts[:minus_idx]:
            if _DATE_RE.fullmatch(t):     continue
            if t.lower() in _SKIP_TOKENS: continue
            if _AMOUNT_RE.fullmatch(t):   continue
            merchant_tokens.append(t)

        # Find debit amount: first number after '-' in the debit column
        amount: float | None = None
        for w in row_words[minus_idx + 1:]:
            t  = w.get("text", "").strip()
            x0 = float(w.get("x0", 0))
            if t.lower() in ("rs.", "rs"):
                continue
            if _AMOUNT_RE.fullmatch(t):
                if x0 > _WALLET_X_THRESHOLD:
                    break  # wallet-balance number on a split row – ignore
                try:
                    amount = float(t.replace(",", ""))
                except ValueError:
                    pass
                break

        # Handle continuation rows (split amount / multi-line merchant name)
        j = i + 1
        while j < n:
            nw = sorted(rows[j]["words"], key=lambda w: w.get("x0", 0))
            nt = [w.get("text", "").strip() for w in nw]
            nl = " ".join(nt).lower()

            if any(_DATE_RE.fullmatch(t) for t in nt):
                break
            if any(kw in nl for kw in _SKIP_KEYWORDS):
                j += 1
                continue
            if "+" in nt:
                j += 1
                continue

            for w in nw:
                t  = w.get("text", "").strip()
                x0 = float(w.get("x0", 0))
                if t.lower() in ("rs.", "rs", "-", "+"):
                    continue
                if _AMOUNT_RE.fullmatch(t):
                    if amount is None and x0 < _WALLET_X_THRESHOLD:
                        try:
                            amount = float(t.replace(",", ""))
                        except ValueError:
                            pass
                    break
                merchant_tokens.append(t)

            j += 1

        if amount is None or amount <= 0:
            i += 1
            continue

        transactions.append({
            "merchant": " ".join(merchant_tokens).strip() or "Unknown",
            "amount":   amount,
            "date":     iso_date,
        })
        i += 1

    return transactions


# ── Parser class ───────────────────────────────────────────────────────────────

class MobiKwikParser(BaseUPIParser):
    """Parser for MobiKwik wallet PDF statements."""

    def detect(self, first_page_text: str) -> bool:
        normalised = re.sub(r"\s+", "", first_page_text).lower()

        has_mobikwik = "mobikwik" in normalised
        has_wallet   = "wallet" in normalised
        has_statement = "statement" in normalised

        return has_mobikwik or (has_wallet and has_statement)

    def parse(self, pdf: object) -> list[dict]:
        transactions: list[dict] = []
        for page in pdf.pages:
            words = page.extract_words() or []
            transactions.extend(_extract_page_transactions(words))
        return transactions