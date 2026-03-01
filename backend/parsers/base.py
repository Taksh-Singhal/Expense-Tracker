from __future__ import annotations

from abc import ABC, abstractmethod


class BaseUPIParser(ABC):
    """
    Abstract base class for all UPI statement parsers.

    Each concrete parser is responsible for:
      1. Detecting whether it can handle a given PDF (detect).
      2. Extracting ONLY debit transactions from that PDF (parse).

    Output contract (all parsers must comply):
        [
            {
                "merchant": str,
                "amount":   float,
                "date":     str  # ISO-8601: YYYY-MM-DD
            },
            ...
        ]
    """

    @abstractmethod
    def detect(self, first_page_text: str) -> bool:
        """Return True if this parser can handle the uploaded PDF."""
        ...

    @abstractmethod
    def parse(self, pdf: object) -> list[dict]:
        """
        Parse the entire PDF and return a list of debit-only transaction dicts.

        Each dict must have exactly:
            merchant (str), amount (float > 0), date (ISO-8601 str)
        """
        ...
