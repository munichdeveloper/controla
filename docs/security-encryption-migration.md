# Encryption format migration (F4/F5)

New writes use `v1:` plus Base64 of a 16-byte random PBKDF2 salt, a 12-byte random GCM IV, and ciphertext including the 128-bit authentication tag. PBKDF2-HMAC-SHA256 uses 210,000 iterations and a 256-bit output. The prefix is authenticated as additional data. UTF-8 is used for new plaintext.

The configured master secret is the input to the new per-record derivation. The old fixed-salt master key remains available through the existing API solely to read legacy records. User-derived key handles retain their API compatibility.

Unprefixed records are read with the original ECB key derivation. Reading does not modify the database. Passing the decrypted value through the normal write path produces the new format. Back up the database before rollout and retain the existing configured key: changing it before re-encrypting existing records makes those records unreadable. Migrate all records before removing legacy support or rotating that key. Do not roll back to a version unable to read `v1:` after new records have been written.

Required deployment configuration now has no production fallback: JWT_SECRET, CORE_API_TOKEN, SPRING_DATASOURCE_PASSWORD and CONTROLA_SECURITY_MASTER_KEY. CONTROLA_ADMIN_PASSWORD is needed only when creating the initial admin. Supply values through deployment secrets; do not commit them. Values previously stored in Git must be rotated manually, coordinating encryption-key rotation with data migration.
