# data-model.md

## Entity: SSH Key (UserSSHKey)

- Name: `UserSSHKey`
- Storage: MongoDB collection `usersshkeys`
- Fields:
  - `_id`: ObjectId (primary key)
  - `userId`: ObjectId, reference to `users` collection, required
  - `keyName`: String, optional, default `''`
  - `publicKey`: String, required (OpenSSH format)
  - `privateKeyHash`: String, optional, default `''` (non-reversible diagnostic hash)
  - `fingerprint`: String, computed server-side (e.g., `SHA256:...`), unique (sparse index)
  - `createdAt`: Date, default now
  - `updatedAt`: Date, set on save
  - `__v`: Number (Mongoose version)

## Validation Rules

- `publicKey` must match OpenSSH public key regex (e.g., type + base64 + optional comment); invalid keys rejected with 400.
- `fingerprint` computed server-side and set on create; `fingerprint` must be unique (sparse) to support idempotent creates.
- `userId` must reference an existing user (controller-level check).

## State Transitions

- Create: POST → server validates key, computes fingerprint, creates `UserSSHKey`, emits `sshkey.added` event.
- Read: GET → returns list of keys for `userId` (with key metadata, not private material).
- Delete: DELETE → removes key by id if `userId` matches session; emits `sshkey.removed` event.
