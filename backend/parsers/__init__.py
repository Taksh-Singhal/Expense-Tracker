"""
parsers
=======
UPI statement PDF parsing package.

Public API
----------
get_parser(pdf) → BaseUPIParser
    Detect the UPI provider and return the correct parser instance.

Supported providers
-------------------
- MobiKwik
- Paytm
- PhonePe

To add a new provider:
  1. Create parsers/<provider>.py implementing BaseUPIParser.
  2. Import the class in parsers/registry.py and append it to _REGISTRY.
"""

from .base import BaseUPIParser
from .registry import get_parser

__all__ = ["BaseUPIParser", "get_parser"]
