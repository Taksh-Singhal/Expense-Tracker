from __future__ import annotations

import re
from datetime import datetime

from .base import BaseUPIParser


# ---------------------------------------------------------------------------
# Month map — used to convert 3-letter abbreviation to int
# ---------------------------------------------------------------------------
_MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "may": 5, "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

# ---------------------------------------------------------------------------
# Year extraction
# pdfplumber gives us the header line: "24 JAN'26 - 23 FEB'26"
# We capture the two-digit year after the apostrophe.
# ---------------------------------------------------------------------------
_YEAR_RE = re.compile(r"[A-Z]{3}'(\d{2})", re.IGNORECASE)

# ---------------------------------------------------------------------------
# Main transaction regex — handles all standard debit lines.
#
# Real extracted text (x_tolerance=3, default):
#   "23 Feb Paid to Sugabojanam Foods Traders Tag: ICICI Bank - - Rs.45"
#   "21 Feb Money sent to Ayan Shahid Tag: ICICI Bank - - Rs.35"
#   "29 Jan Money sent to Mannan Gupta Tag: ICICI Bank - - Rs.19.69"
#   "25 Jan Paid to Seminar and Workshop Fee Tag: ICICI Bank - - Rs.3,599"
#
# \s+ is used throughout instead of literal spaces so the pattern survives
# any level of whitespace collapse pdfplumber may apply on a given run.
#
# Right boundary is "Tag:" or "Note:" — both appear before the account column.
# The amount anchor "-\s*Rs." catches "- Rs.", "-Rs.", "- Rs.", etc.
# Optional "Dr" suffix is stripped after the digits.
#
# Credits ("+ Rs.") never match because the sign in group 4 must be "-".
# ---------------------------------------------------------------------------
_TXN_RE = re.compile(
    r"^(\d{1,2})\s+([A-Za-z]{3})\s+"
    r"(?:Paid\s*to|Money\s*sent\s*to)\s+"
    r"(.+?)"
    r"-\s*Rs\.?\s*([\d,]+(?:\.\d+)?)",
    re.IGNORECASE,
)

# ---------------------------------------------------------------------------
# "Automatic payment" transactions — direction verb differs and merchant name
# wraps onto the NEXT content line in pdfplumber's output.
#
# Example (two consecutive extracted lines):
#   "05 Feb Automatic payment of ₹199 setup for Note: Transaction ICICI Bank - - Rs.99"
#   "Spotify India Pvt Ltd success 69"     ← merchant + note/account residue
# ---------------------------------------------------------------------------
_AUTO_RE = re.compile(
    r"^(\d{1,2})\s+([A-Za-z]{3})\s+Automatic\s+payment",
    re.IGNORECASE,
)

# Amount anchor reused for auto-payment lines (same debit format)
_AMOUNT_TAIL_RE = re.compile(
    r"-\s*Rs\.?\s*([\d,]+(?:\.\d+)?)\s*(?:Dr)?\s*$",
    re.IGNORECASE,
)

# Lines to skip when scanning ahead for the auto-payment merchant name
_SKIP_LINE_RE = re.compile(
    r"^\d{1,2}:\d{2}"          # time stamp  ("9:21 PM")
    r"|^UPI\s"                  # UPI ID / Ref line
    r"|^Page\s"                 # page footer
    r"|^For\s+any"              # "For any queries"
    r"|^Contact"                # "Contact Us"
    r"|^Passbook"               # section header
    r"|^Tag\s*:"                # tag continuation line
    r"|^#",                     # category tag ("#Food")
    re.IGNORECASE,
)


class PaytmParser(BaseUPIParser):
    """
    Parser for Paytm "Passbook Payments History" PDFs.

    Returns list[dict] with keys: merchant (str), amount (float), date (str ISO).
    Only debit transactions ("- Rs.") are returned; credits ("+ Rs.") are skipped.
    """

    PROVIDER_NAME = "Paytm"

    # ------------------------------------------------------------------
    # Detection
    # ------------------------------------------------------------------

    def detect(self, first_page_text: str) -> bool:
        # Normalise before matching so collapsed spaces don't break detection.
        normalised = re.sub(r"\s+", "", first_page_text).lower()
        return (
            "paytm" in normalised
            and ("upi" in normalised or "transaction" in normalised)
        )

    # ------------------------------------------------------------------
    # Parsing
    # ------------------------------------------------------------------

    def parse(self, pdf) -> list[dict]:
        # Extract the statement year from the header on page 1.
        header_text = pdf.pages[0].extract_text() or ""
        year = self._extract_year(header_text)

        results: list[dict] = []
        for page in pdf.pages:
            text = page.extract_text() or ""
            results.extend(self._parse_page(text, year))
        return results

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_year(text: str) -> int:
        """Parse two-digit year from "24 JAN'26 - 23 FEB'26" header."""
        m = _YEAR_RE.search(text)
        return 2000 + int(m.group(1)) if m else datetime.now().year

    @staticmethod
    def _to_iso(year: int, month_abbrev: str, day: str) -> str:
        month = _MONTH_MAP[month_abbrev.lower()]
        return f"{year}-{month:02d}-{int(day):02d}"

    def _parse_page(self, text: str, year: int) -> list[dict]:
        print("====== PAGE TEXT START ======")
        print(text[:1500])
        print("====== PAGE TEXT END ======")
        lines = text.split("\n")
        results: list[dict] = []

        for idx, line in enumerate(lines):

            # ── Standard debits: "Paid to …" / "Money sent to …" ──────────
            m = _TXN_RE.match(line)
            if m:
                day, mon, raw_merchant, amount_raw = m.groups()
                results.append({
                    "merchant": self._clean_merchant(raw_merchant),
                    "amount":   float(amount_raw.replace(",", "")),
                    "date":     self._to_iso(year, mon, day),
                })
                continue

            # ── "Automatic payment" — merchant on next content line ────────
            m = _AUTO_RE.match(line)
            if m:
                day, mon = m.group(1), m.group(2)
                amt_m = _AMOUNT_TAIL_RE.search(line)
                if not amt_m:
                    # No amount on this line — skip safely
                    continue

                merchant = self._find_auto_merchant(lines, idx + 1)
                results.append({
                    "merchant": merchant,
                    "amount":   float(amt_m.group(1).replace(",", "")),
                    "date":     self._to_iso(year, mon, day),
                })
                continue

        return results

    @staticmethod
    def _clean_merchant(raw: str) -> str:
        """Normalise whitespace in merchant names extracted from transaction lines."""
        return re.sub(r"\s+", " ", raw).strip()

    @staticmethod
    def _find_auto_merchant(lines: list[str], start: int) -> str:
        """
        Scan forward from *start* to find the merchant name for an
        "Automatic payment" entry.

        pdfplumber places the merchant on the first non-boilerplate line
        after the direction line.  The line also carries column residue from
        the Note and Account columns, e.g.:
            "Spotify India Pvt Ltd success 69"
        We strip the trailing "<note-word> <account-digits>" artefact.
        """
        for nxt in lines[start : start + 5]:
            nxt = nxt.strip()
            if not nxt or _SKIP_LINE_RE.match(nxt):
                continue
            # Strip trailing: one word (note residue) + bare digits (account suffix)
            # e.g. "Spotify India Pvt Ltd success 69" → "Spotify India Pvt Ltd"
            merchant = re.sub(r"\s+\S+\s+\d{1,4}\s*$", "", nxt).strip()
            # If that over-stripped (merchant was short), fall back to stripping
            # only trailing digits (the account number alone)
            if not merchant:
                merchant = re.sub(r"\s+\d{1,4}\s*$", "", nxt).strip()
            return merchant or "Unknown"

        return "Unknown"
