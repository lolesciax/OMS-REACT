# MongoDB data model

MongoDB owns persistent application state. React keeps only the currently displayed state in memory. The frontend uses neither local storage nor session storage.

| Collection | Owner and purpose |
| --- | --- |
| `users` | One account/profile, hashed password, embedded address book with stable address IDs. `_id` is the canonical account ID; `user_id` is a unique display code. |
| `products` | Current catalog details, numeric price and integer stock. |
| `carts` | One cart per `user_id` **ObjectId**, with embedded `{product_id: ObjectId, qty: integer, selected: boolean}` entries. Catalog details come from `products` when read. |
| `checkouts` | One draft per `userId` ObjectId. Contains product references/quantities, delivery edits, payment method, and a reserved `orderId`. Expires after 30 days. Prices are read from the catalog. |
| `orders` | `userId` and item `id` reference account/product ObjectIds. Item names, paid prices, delivery address and totals are historical snapshots. Mutable catalog stock is not duplicated. |
| `sessions` | SHA256 digest of an opaque session ID, `userId` ObjectId, password version, CSRF secret and expiry. Expires after one day. |
| `counters` | Atomic sequences for `USR-` and `PROD-` display IDs. |
| `normalization_backups` | Originals archived before a migration changes or merges a document; grouped by `runId`. Not application data and not exposed by the API. |

MongoDB indexes enforce one cart and one checkout per account, unique usernames/display account IDs, order lookup by owner/date, and TTL expiry for sessions/checkouts. Collection validators enforce reference types and positive integer item quantities. A shared email on historical accounts is preserved; accounts are never merged based on email.

Accounts with orders cannot be deleted. Deleting an unused account also removes its sessions, cart and checkout draft, so account-owned state does not become orphaned.

Session IDs travel only in the `oms_session` HttpOnly, SameSite=Lax cookie. Mutations require the session's CSRF token, which is restored from `/api/auth/session` and kept in memory. Logout revokes the database session. Password changes and account deactivation invalidate sessions. TTL deletion is asynchronous, so the API also checks expiry on every session/draft read.

The session response sends `Clear-Site-Data: "storage"` to remove legacy browser-stored data on supporting browsers, without deleting the HttpOnly cookie. Session/auth/checkout responses are not cached.

`PUT /api/checkout` starts a draft from selected cart entries or buy-now product IDs. `PATCH` saves delivery/payment edits, and `GET` restores the draft or pending order. The reserved order ID makes order submission idempotent across retries and reloads. Payment proof removes only the matching checkout. Older unpaid orders remain accessible through order history.

## Migration

Stop the local backend before applying a migration, then run from `backend/`:

```powershell
py normalize_database.py          # preview only
py normalize_database.py --apply  # archives originals, normalizes, creates indexes/validators
py normalize_database.py          # should report zero changes
py run.py
```

Legacy username/display-ID references are resolved to `_id`. Duplicate carts merge by product reference, using the largest quantity rather than adding aliases together; duplicate entries are deselected for review. Every replaced/deleted source document is backed up first. Ambiguous or unmatched ownership aborts the preview. Account and order documents are never deleted. Originals can be reviewed by `runId` in `normalization_backups`; do not expose that collection to clients.

Run the normal mocked tests with `py -m unittest discover -s tests -v`. To include real MongoDB integration tests:

```powershell
$env:OMS_MONGODB_INTEGRATION='1'
py -m unittest discover -s tests -v
```

Integration tests create uniquely named `oms_test_...` databases and remove only those databases during cleanup. They cover session cookies/restoration/revocation/expiry, CSRF, cart writes, checkout persistence, canonical references, duplicate-order prevention, proof cleanup, atomic IDs and migration idempotency.
