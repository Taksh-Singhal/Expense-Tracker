from __future__ import annotations

from .base import BaseUPIParser
from .mobikwik import MobiKwikParser
from .paytm import PaytmParser
from .phonepe import PhonePeParser
from .gpay import GPayParser

# ── Registry ───────────────────────────────────────────────────────────────────
# Add new parsers here; detection order matters only when two parsers could
# both match the same PDF (which should not happen for distinct providers).

_REGISTRY: list[type[BaseUPIParser]] = [
    MobiKwikParser,
    PaytmParser,
    PhonePeParser,
    GPayParser,
]


# ── Public factory ─────────────────────────────────────────────────────────────

def get_parser(pdf: object) -> BaseUPIParser:
    """
    Detect the UPI provider from the PDF's first page and return an
    appropriate parser instance.

    Parameters
    ----------
    pdf : pdfplumber.PDF
        An already-opened pdfplumber PDF object.

    Returns
    -------
    BaseUPIParser
        A concrete parser whose detect() returned True for this PDF.

    Raises
    ------
    ValueError
        If no registered parser recognises the PDF.
    """
    first_page_text: str = pdf.pages[0].extract_text() or ""

    for parser_cls in _REGISTRY:
        instance = parser_cls()
        if instance.detect(first_page_text):
            return instance

    raise ValueError(
        "Unsupported UPI provider. "
        "Supported providers: MobiKwik, Paytm, PhonePe. "
        "Please upload a statement PDF from one of these providers."
    )
