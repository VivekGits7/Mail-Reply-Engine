import hashlib
import hmac
import json
import os
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import settings

FORMAT_VERSION = 1
NONCE_BYTES = 12


class EncryptionError(Exception):
    pass


@lru_cache(maxsize=1)
def _keys() -> Tuple[str, Dict[str, AESGCM]]:
    keys = settings.pii_keys
    if not keys:
        raise EncryptionError("PII encryption keys are not configured")
    return settings.PII_ACTIVE_KEY_ID, {
        key_id: AESGCM(key) for key_id, key in keys.items()
    }


@lru_cache(maxsize=1)
def _index_key() -> bytes:
    if not settings.PII_INDEX_KEY:
        raise EncryptionError("PII index key is not configured")
    return settings.pii_index_key


def _aad(table: str, column: str, row_id: Any) -> bytes:
    return f"{table}.{column}.{row_id}".encode()


def normalize_for_index(value: str) -> str:
    return " ".join(value.split()).lower()


def blind_index(value: Optional[str]) -> Optional[bytes]:
    if value is None or not value.strip():
        return None
    return hmac.new(
        _index_key(), normalize_for_index(value).encode(), hashlib.sha256
    ).digest()


def encrypt_bytes(data: bytes, *, table: str, column: str, row_id: Any) -> bytes:
    active_id, ciphers = _keys()
    nonce = os.urandom(NONCE_BYTES)
    sealed = ciphers[active_id].encrypt(nonce, data, _aad(table, column, row_id))
    key_id = active_id.encode()
    return bytes([FORMAT_VERSION, len(key_id)]) + key_id + nonce + sealed


def decrypt_bytes(blob: bytes, *, table: str, column: str, row_id: Any) -> bytes:
    blob = bytes(blob)
    if len(blob) < 2 or blob[0] != FORMAT_VERSION:
        raise EncryptionError("Unknown ciphertext format")
    key_len = blob[1]
    key_id = blob[2 : 2 + key_len].decode()
    nonce_start = 2 + key_len
    nonce = blob[nonce_start : nonce_start + NONCE_BYTES]
    sealed = blob[nonce_start + NONCE_BYTES :]
    _, ciphers = _keys()
    cipher = ciphers.get(key_id)
    if cipher is None:
        raise EncryptionError(f"No key loaded for key id {key_id}")
    try:
        return cipher.decrypt(nonce, sealed, _aad(table, column, row_id))
    except InvalidTag:
        raise EncryptionError(
            "Ciphertext does not belong to this row and column"
        ) from None


def key_id_of(blob: bytes) -> str:
    blob = bytes(blob)
    return blob[2 : 2 + blob[1]].decode()


class FieldCipher:
    def __init__(self, table: str, row_id: Any):
        self.table = table
        self.row_id = row_id

    def enc(self, column: str, value: Optional[str]) -> Optional[bytes]:
        if value is None:
            return None
        return encrypt_bytes(
            value.encode(), table=self.table, column=column, row_id=self.row_id
        )

    def dec(self, column: str, blob: Optional[bytes]) -> Optional[str]:
        if blob is None:
            return None
        return decrypt_bytes(
            blob, table=self.table, column=column, row_id=self.row_id
        ).decode()

    def enc_json(self, column: str, value: Any) -> Optional[bytes]:
        if value is None:
            return None
        return encrypt_bytes(
            json.dumps(value, default=str).encode(),
            table=self.table,
            column=column,
            row_id=self.row_id,
        )

    def dec_json(self, column: str, blob: Optional[bytes], default: Any = None) -> Any:
        if blob is None:
            return default
        return json.loads(
            decrypt_bytes(blob, table=self.table, column=column, row_id=self.row_id)
        )
