import sys

from app.privacy.encryption import (
    EncryptionError,
    FieldCipher,
    blind_index,
    decrypt_bytes,
    encrypt_bytes,
    key_id_of,
    normalize_for_index,
)
from app.privacy.redaction import redact_credentials

# The shared global venv has transformers for another project, and Presidio would load it for nothing.
sys.modules.setdefault("transformers", None)

__all__ = [
    "EncryptionError",
    "FieldCipher",
    "blind_index",
    "decrypt_bytes",
    "encrypt_bytes",
    "key_id_of",
    "normalize_for_index",
    "redact_credentials",
]
