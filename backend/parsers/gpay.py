from __future__ import annotations

import re
from datetime import datetime

from .base import BaseUPIParser


_DEBIT_LINE_RE = re.compile(
    r"(\d{1,2}\s[A-Za-z]{3},\s\d{4})\s+Paid to\s+(.+?)\s+₹\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

_DATE_FMT = "%d %b, %Y"


class GPayParser(BaseUPIParser):

    PROVIDER_NAME = "GooglePay"

    # -----------------------------
    # Detection
    # -----------------------------
    def detect(self, first_page_text: str) -> bool:
        normalised = re.sub(r"\s+", "", first_page_text).lower()

        return (
            "upitransactionid" in normalised
            and ("paidto" in normalised or "receivedfrom" in normalised)
        )

    # -----------------------------
    # Parsing
    # -----------------------------
    def parse(self, pdf) -> list[dict]:
        transactions: list[dict] = []
        seen: set[tuple] = set()

        for page in pdf.pages:
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""

            for line in text.splitlines():
                match = _DEBIT_LINE_RE.search(line)
                if not match:
                    continue

                date_raw, merchant, amount_raw = match.groups()

                try:
                    iso_date = datetime.strptime(
                        date_raw.strip(), _DATE_FMT
                    ).date().isoformat()
                except ValueError:
                    continue

                try:
                    amount = float(amount_raw.replace(",", ""))
                except ValueError:
                    continue

                if amount <= 0:
                    continue

                key = (iso_date, merchant.strip(), amount)
                if key in seen:
                    continue
                seen.add(key)

                transactions.append({
                    "merchant": merchant.strip(),
                    "amount": amount,
                    "date": iso_date,
                })

        return transactions