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
  - `fingerprint`: String, computed server-side (e.g., `SHA256:...`), **unique (non-sparse)**; plan includes a startup dedupe aggregation to remove duplicate legacy documents and enforce a deterministic canonical record policy.
  - `createdAt`: Date, default now
  - `updatedAt`: Date, set on save
  - `__v`: Number (Mongoose version)

## Validation Rules

- `publicKey` must match OpenSSH public key regex (e.g., type + base64 + optional comment); invalid keys rejected with 400.
- `fingerprint` computed server-side and set on create; `fingerprint` must be unique (non-sparse) to support idempotent creates; plan includes startup dedupe to clean up legacy duplicates.
- `userId` must reference an existing user (controller-level check).

## State Transitions

- Create: POST → server validates key, computes fingerprint, creates `UserSSHKey`, emits `sshkey.added` event.
- Read: GET → returns list of keys for `userId` (with key metadata, not private material).
- Delete: DELETE → removes key by id if `userId` matches session; emits `sshkey.removed` event.
