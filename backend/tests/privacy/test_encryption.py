import uuid

import pytest

from app.privacy.encryption import (
    EncryptionError,
    FieldCipher,
    blind_index,
    decrypt_bytes,
    encrypt_bytes,
    key_id_of,
)


def test_field_cipher_round_trips_text_and_json():
    cipher = FieldCipher("people", uuid.uuid4())
    assert (
        cipher.dec("full_name", cipher.enc("full_name", "Rahul Sharma"))
        == "Rahul Sharma"
    )
    assert cipher.dec_json(
        "profile", cipher.enc_json("profile", {"gender": "Male"})
    ) == {"gender": "Male"}
    assert (
        cipher.enc("full_name", None) is None and cipher.dec("full_name", None) is None
    )


def test_ciphertext_never_contains_the_plain_value():
    blob = FieldCipher("people", uuid.uuid4()).enc(
        "personal_email", "rahul.sharma@gmail.com"
    )
    assert b"rahul" not in blob


def test_ciphertext_copied_to_another_row_fails():
    blob = FieldCipher("people", uuid.uuid4()).enc("full_name", "Rahul Sharma")
    with pytest.raises(EncryptionError):
        FieldCipher("people", uuid.uuid4()).dec("full_name", blob)


def test_ciphertext_copied_to_another_column_fails():
    row_id = uuid.uuid4()
    blob = FieldCipher("people", row_id).enc("full_name", "Rahul Sharma")
    with pytest.raises(EncryptionError):
        FieldCipher("people", row_id).dec("manager_name", blob)


def test_new_values_use_the_active_key_and_old_keys_still_decrypt(monkeypatch):
    from app.privacy import encryption

    row_id = uuid.uuid4()
    active, ciphers = encryption._keys()
    assert (
        key_id_of(encrypt_bytes(b"x", table="t", column="c", row_id=row_id)) == active
    )
    monkeypatch.setattr(encryption, "_keys", lambda: ("test-old", ciphers))
    old_blob = encrypt_bytes(b"legacy", table="t", column="c", row_id=row_id)
    monkeypatch.undo()
    assert key_id_of(old_blob) == "test-old"
    assert decrypt_bytes(old_blob, table="t", column="c", row_id=row_id) == b"legacy"


def test_blind_index_ignores_case_and_spacing_but_differs_per_value():
    assert blind_index(" Rahul.Sharma@Gmail.com ") == blind_index(
        "rahul.sharma@gmail.com"
    )
    assert blind_index("rahul.sharma@gmail.com") != blind_index("amit.roy@gmail.com")
    assert blind_index("") is None and blind_index(None) is None
