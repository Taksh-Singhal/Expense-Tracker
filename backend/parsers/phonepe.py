from __future__ import annotations

import re
from datetime import datetime

from .base import BaseUPIParser

# ── Module-level constants ─────────────────────────────────────────────────────

_MONTH_MAP: dict[str, int] = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# A single regex captures the full debit transaction.
#
# PhonePe collapses the entire table row into ONE line:
#   "Feb 24, 2026 Paid to SOUMIL SAHAI DEBIT ₹80"
#    ──────────── ──────── ──────────── ───── ───
#    date         prefix   merchant     type  amount
#
# The date (full "Mon DD, YYYY") and the DEBIT/amount are on the same line,
# so we can parse everything with one pass.
_TX_DEBIT_RE = re.compile(
    r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),\s+(\d{4})"
    r"\s+(?:Paid to|Sent to)\s+(.+?)\s+DEBIT\s+[₹₨]?([\d,]+(?:\.\d+)?)$",
    re.IGNORECASE,
)


# ── Parser ─────────────────────────────────────────────────────────────────────

class PhonePeParser(BaseUPIParser):
    """
    Parser for PhonePe UPI PDF statements.

    PDF layout (after text extraction)
    ────────────────────────────────────
    PhonePe renders a 4-column table.  pdfplumber merges the Date, Transaction
    Details, Type, and Amount columns onto ONE line per transaction:

        Feb 24, 2026  Paid to SOUMIL SAHAI  DEBIT  ₹80
        ────────────  ───────────────────── ─────  ───
        date          description           type   amount

    Subsequent lines carry the time (with a Unicode clock glyph), Transaction
    ID, UTR number, and "Paid by" — all irrelevant for extraction.

    CREDIT lines ("Received from … CREDIT ₹X") do NOT start with "Paid to" or
    "Sent to", so they are naturally excluded by the regex.
    """

    def detect(self, first_page_text: str) -> bool:
        return (
            "Transaction Statement for" in first_page_text
            and ("DEBIT" in first_page_text or "CREDIT" in first_page_text)
        )

    def parse(self, pdf: object) -> list[dict]:
        transactions: list[dict] = []
        for page in pdf.pages:
            text = page.extract_text() or ""
            transactions.extend(self._parse_page(text))
        return transactions

    # ── Private helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _parse_page(text: str) -> list[dict]:
        transactions: list[dict] = []

        for line in text.split("\n"):
            m = _TX_DEBIT_RE.match(line.strip())
            if not m:
                continue

            month    = _MONTH_MAP[m.group(1).lower()]
            day      = int(m.group(2))
            year     = int(m.group(3))
            merchant = m.group(4).strip()
            amount   = float(m.group(5).replace(",", ""))

            if amount > 0:
                transactions.append({
                    "merchant": merchant,
                    "amount":   amount,
                    "date":     datetime(year, month, day).date().isoformat(),
                })

        return transactions
