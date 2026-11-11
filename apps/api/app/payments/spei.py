"""SPEI bank transfer, confirmed by hand. Owner decision 2026-11-11: an agent checks the business account and
confirms (or rejects) each transfer in the web dashboard; no provider callback exists."""

import secrets

PROVIDER = "spei"
# No 0/O or 1/I: the customer types the reference into their bank app.
_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"


def new_reference() -> str:
    """The transfer concept the customer writes, so the agent can match the deposit to the payment."""
    return "".join(secrets.choice(_ALPHABET) for _ in range(8))
