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

# Year from header: "JAN'26", "FEB'26", etc.
_YEAR_RE = re.compile(r"[A-Z]{3}'(\d{2})", re.IGNORECASE)

# A main transaction line always starts with a date token "DD Mon "
_DATE_LINE_RE = re.compile(
    r"^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+",
    re.IGNORECASE,
)

# Amount at the very end of the transaction line
# Debit: "- Rs.45", "- Rs.3,599", "- Rs.19.69"
# Credit: "+ Rs.XX"  → only debit pattern is used; credit acts as skip
_DEBIT_AMOUNT_RE = re.compile(r"-\s*Rs\.([\d,]+(?:\.\d+)?)$", re.IGNORECASE)
_CREDIT_RE       = re.compile(r"\+\s*Rs\.",                    re.IGNORECASE)

# ── Payee extraction regexes ───────────────────────────────────────────────────
# All three patterns capture the merchant name that sits between the transaction
# type prefix and the first "Tag:" or "Note:" annotation that follows.

# "Paid to Sugabojanam Foods Traders Tag: …"
_PAID_TO_RE = re.compile(
    r"Paid to\s+(.+?)\s+(?:Tag:|Note:)", re.IGNORECASE
)

# "Money sent to Ayan Shahid Note: …"
_SENT_TO_RE = re.compile(
    r"Money sent to\s+(.+?)\s+(?:Tag:|Note:)", re.IGNORECASE
)

# "Automatic payment of ₹199 setup for Spotify India Pvt Ltd Tag: …"
_AUTO_INLINE_RE = re.compile(
    r"Automatic payment of.*?setup for\s+(?!(?:Tag:|Note:))(.+?)\s+(?:Tag:|Note:)",
    re.IGNORECASE,
)

# "Automatic payment of ₹199 setup for Note: …" — merchant on the next line
_AUTO_SPLIT_RE = re.compile(
    r"Automatic payment of.*?setup for\s+(?:Tag:|Note:)", re.IGNORECASE
)

# Used to strip non-merchant suffixes from continuation lines
# e.g. "Spotify India Pvt Ltd success 69"  →  "Spotify India Pvt Ltd"
_CONTINUATION_CLEANUP_RE = re.compile(
    r"\s+(?:success|failure|failed|pending|error)\b.*$", re.IGNORECASE
)
_TRAILING_DIGITS_RE = re.compile(r"\s+\d+$")


# ── Parser ─────────────────────────────────────────────────────────────────────

class PaytmParser(BaseUPIParser):
    """
    Parser for Paytm UPI PDF statements.

    PDF layout (after text extraction)
    ────────────────────────────────────
    Paytm renders a 5-column table.  pdfplumber merges all columns into ONE
    line per transaction:

        23 Feb  Paid to Sugabojanam Foods Traders  Tag: # Food  ICICI Bank - 69  - Rs.45
        ──────  ─────────────────────────────────  ───────────  ──────────────   ───────
        date    description                        tag          account          amount

    The subsequent lines for each transaction block are the time, UPI ID, and
    reference number — they are irrelevant for extraction.

    Parsing strategy
    ─────────────────
    Scan every line:
      1. If it starts with "DD Mon " → it is a main transaction line.
      2. Check if it ends with "+ Rs." (credit → skip) or "- Rs.X" (debit).
      3. Extract merchant via payee-specific regexes.
      4. Handle the rare case where "Automatic payment" wraps the service name
         onto the next line.
    """

    def detect(self, first_page_text: str) -> bool:
        return bool(re.search(r"paytm\s+statement", first_page_text, re.IGNORECASE))

    def parse(self, pdf: object) -> list[dict]:
        first_text = pdf.pages[0].extract_text() or ""
        year = self._extract_year(first_text)

        transactions: list[dict] = []
        for page in pdf.pages:
            text = page.extract_text() or ""
            transactions.extend(self._parse_page(text, year))
        return transactions

    # ── Private helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _extract_year(text: str) -> int:
        m = _YEAR_RE.search(text)
        return 2000 + int(m.group(1)) if m else datetime.now().year

    def _parse_page(self, text: str, year: int) -> list[dict]:
        lines = [ln.strip() for ln in text.split("\n")]
        transactions: list[dict] = []
        n = len(lines)

        for i, line in enumerate(lines):
            dm = _DATE_LINE_RE.match(line)
            if not dm:
                continue

            # Skip credit lines
            if _CREDIT_RE.search(line):
                continue

            # Must have a debit amount at the end
            amount_m = _DEBIT_AMOUNT_RE.search(line)
            if not amount_m:
                continue

            amount = float(amount_m.group(1).replace(",", ""))
            if amount <= 0:
                continue

            day      = int(dm.group(1))
            month    = _MONTH_MAP[dm.group(2).lower()]
            date_str = datetime(year, month, day).date().isoformat()

            merchant = self._extract_merchant(line, lines, i)
            if merchant:
                transactions.append(
                    {"merchant": merchant, "amount": amount, "date": date_str}
                )

        return transactions

    def _extract_merchant(
        self, line: str, lines: list[str], i: int
    ) -> str | None:
        # ── "Paid to MERCHANT Tag/Note:" ──────────────────────────────────────
        m = _PAID_TO_RE.search(line)
        if m:
            return m.group(1).strip()

        # ── "Money sent to MERCHANT Tag/Note:" ───────────────────────────────
        m = _SENT_TO_RE.search(line)
        if m:
            return m.group(1).strip()

        # ── "Automatic payment … setup for MERCHANT Tag/Note:" ───────────────
        m = _AUTO_INLINE_RE.search(line)
        if m:
            return m.group(1).strip()

        # ── "Automatic payment … setup for Note/Tag:" (merchant on next line) ─
        if _AUTO_SPLIT_RE.search(line):
            return self._merchant_from_next_line(lines, i)

        return None

    @staticmethod
    def _merchant_from_next_line(lines: list[str], i: int) -> str | None:
        """
        When the automatic-payment merchant name overflows onto the next line
        (e.g. "…setup for Note: Transaction  ICICI Bank - - Rs.99" followed
        by "Spotify India Pvt Ltd success 69"), extract only the merchant part.
        """
        for j in range(i + 1, min(i + 4, len(lines))):
            next_ln = lines[j].strip()
            if not next_ln:
                continue
            # Skip lines that are time stamps, UPI IDs, or a new date
            if _DATE_LINE_RE.match(next_ln):
                break
            if re.match(r"^\d{1,2}:\d{2}", next_ln):        # "9:21 PM"
                continue
            if next_ln.lower().startswith("upi"):            # UPI ID / Ref
                break

            # Strip known noise from the continuation line
            merchant = _CONTINUATION_CLEANUP_RE.sub("", next_ln)
            merchant = _TRAILING_DIGITS_RE.sub("", merchant).strip()
            return merchant or None

        return None
