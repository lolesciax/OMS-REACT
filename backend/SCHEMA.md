# MongoDB data model

MongoDB owns persistent application state. React keeps only the currently displayed state in memory. The frontend uses neither local storage nor session storage.

| Collection | Owner and purpose |
| --- | --- |
| `users` | One account/profile, hashed password, embedded address book with stable address IDs. `_id` is the canonical account ID; `user_id` is a unique display code. |
| `roles` | Unique permanent `code`, editable `label`, validated `permissions`, active flag, and protected built-in role marker. Accounts reference a role by `roleId` ObjectId. |
| `account_options` | Singleton `profile` document holding admin-maintained gender choices; blank remains an available privacy choice. |
| `notifications` | Per-account inbox entries: canonical `userId`, unique `eventKey`/audience, category, safe internal destination, title/message, creation/event time and individual `readAt`. Store-team entries require current administrator access. |
| `products` | Current catalog details, numeric price and integer stock. |
| `carts` | One cart per `user_id` **ObjectId**, with embedded `{product_id: ObjectId, qty: integer, selected: boolean}` entries. Catalog details come from `products` when read. |
| `checkouts` | One draft per `userId` ObjectId. Contains product references/quantities, delivery edits, payment method, and a reserved `orderId`. Expires after 30 days. Prices are read from the catalog. |
| `orders` | `userId` and item `id` reference account/product ObjectIds. Item names, paid prices, delivery address and totals are historical snapshots. Mutable catalog stock is not duplicated. |
| `sessions` | SHA256 digest of an opaque session ID, `userId` ObjectId, password version, CSRF secret and expiry. Expires after one day. |
| `rate_limits` | Hashed scope/IP or account keys, bounded timestamp arrays, atomic sliding-window decisions and TTL expiry. |
| `settings` | Singleton `payments` document containing merchant names, enabled flags and uploaded QR paths for GCash and Maya. Admin-only writes; public reads expose only payment instructions. |
| `policy_versions` | Immutable account/order terms, privacy, shipping and returns publications. `settings.terms` holds current version ObjectIds. |
| `captcha_challenges` | Single-use ALTCHA challenge, browser binding digest, purpose, verification secret and expiry. The collection has a TTL index and is never exposed directly. |
| `discounts` | Unique discount codes, percentage/fixed amounts, eligible categories, minimum spend, expiry and active status. |
| `counters` | Atomic sequences for `USR-` and `PROD-` display IDs. |
| `normalization_backups` | Originals archived before a migration changes or merges a document; grouped by `runId`. Not application data and not exposed by the API. |

MongoDB indexes enforce one cart and one checkout per account, unique usernames/display account IDs, order lookup by owner/date, and TTL expiry for sessions/checkouts. Collection validators enforce reference types and positive integer item quantities. A shared email on historical accounts is preserved; accounts are never merged based on email.

New registrations and newly assigned emails use a partial unique email index (`emailUnique: true`); historical shared addresses are retained. New accounts and orders record `termsAcceptance.version` as an ObjectId and `acceptedAt` as a server timestamp. Older records remain valid without an invented acceptance. Changing a policy publishes a new document; earlier accepted versions remain available in the database.

`settings.faqs` and `settings.support` store admin-maintained help content in `data`, with an integer `revision` and `updatedAt`. Updates require the current revision and reject concurrent changes with 409. FAQ identifiers remain stable across reorder operations. Public content endpoints expose only the published content fields. Startup defaults use `$setOnInsert` and preserve edited content and policy pointers. Maintenance separates payments, roles, profile choices, policies/terms, FAQs, contact details, and security readiness.

Accounts with orders cannot be deleted. Deleting an unused account also removes its sessions, cart and checkout draft, so account-owned state does not become orphaned.

Session IDs travel only in the `oms_session` HttpOnly, SameSite=Lax cookie. Mutations require the session's CSRF token, which is restored from `/api/auth/session` and kept in memory. Logout revokes the database session. Password changes and account deactivation invalidate sessions. TTL deletion is asynchronous, so the API also checks expiry on every session/draft read.

Session checks do not clear browser storage. Session identity, carts, checkouts and likes remain server-owned. API responses are not cached; private attachment responses also specify `private`.

`PUT /api/checkout` starts a draft from selected cart entries or buy-now product IDs. `PATCH` saves delivery/payment/discount edits, and `GET` restores the draft or pending order. The exposed `checkoutId` is the reserved `orderId`, so replacing a draft invalidates requests from stale tabs. Autosave includes an editor ID and increasing version; `editorVersions` rejects out-of-order edits from that editor. The reserved order ID makes order submission idempotent across retries and reloads. Payment proof removes only the matching checkout. Older unpaid orders remain accessible through order history.

`POST /api/checkout/quote` reads current catalog prices and validates the discount without changing the draft. Order submission recalculates all amounts and saves `discountCode` and `discountAmount` with the historical totals. Discount expiry uses the Philippines calendar date. New order and fulfillment timestamps use UTC; API datetimes include an explicit UTC offset. Historical stored timestamps are preserved.

Cart responses include `requestedQty` and `quantityAdjusted` when stored quantities exceed current stock. The storefront submits its displayed selected quantities; `fromCart` API requests also cap selected quantities to available stock and skip unavailable products. Starting a new draft clears old editor-version history while its new order ID rejects older tabs. Fulfillment writes `confirmedAt`, `processingAt`, `shippedAt` and `completedAt`; automatic completion additionally writes `autoCompletedAt` and checks that the order is still eligible before updating it.

Profile avatars, QR images, product photos and receipts are stored as upload files, with paths in MongoDB. New images require complete decoding, matching PNG/JPEG/GIF/WebP content, a 5 MB limit and a 20 megapixel limit. Images are re-encoded without metadata or appended content; animated uploads keep their first frame. Payment and receipt images require an active owner/admin session on every upload URL alias. Orphaned private attachments return 404. Delivery confirmation requires the authenticated order owner and a shipped order; retries return the completed order without uploading another receipt.

`rate_limits` contains hashed scope/IP or account keys, bounded `attempts` timestamp arrays, the last `allowed` decision, `checkedAt`, and `expiresAt` with a TTL index. A single MongoDB update pipeline removes old attempts, checks the budget, and records an accepted attempt atomically. `$$NOW` supplies MongoDB's clock. Rejected attempts do not expand the array; no budget exceeds 600 entries. Limits are shared by API workers and survive restarts. Old timestamps stop blocking immediately, independently of MongoDB's TTL cleanup. No raw IP, username or password is stored in these records. The earlier `auth_limits` collection is no longer read or written; its existing TTL index expires its historical records.

## Migration

Notification outboxes are embedded as `_notificationOutbox` arrays in changed `orders`, `users`, `products`, `roles` and `settings` documents. Events commit with their business mutation, then recipient entries are upserted using the unique `(userId, eventKey, audience)` index. The event is acknowledged only after all recipient writes succeed; a crash or delivery failure leaves it available for retry. Inbox reads perform bounded delivery retries using a sparse outbox-key index. One failed source does not block other sources. Notification delivery failure does not change a successful business response into an error. Internal outboxes and inventory cycle identifiers are stripped by the JSON provider.

Notifications are account-owned, including all read/read-all mutations. Store-team scope is checked against the current database role on every request, so role revocation hides older staff notifications as well as future ones. Read-all uses the server snapshot timestamp returned with the inbox to avoid clearing later arrivals. Entries persist across sign-out/restart and use cursor pagination. No client API creates notifications. No notifications are backfilled for historical actions before this feature was installed.

On startup, role initialization inserts missing built-in roles and profile options with `$setOnInsert`; saved admin changes are preserved. Accounts without a role reference are assigned the role matching their historical `isAdmin` flag, then that flag is removed. Explicit role references take precedence. Runtime access resolves the current MongoDB role on each request; inactive, deleted or malformed references grant no store permissions. The response's `isAdmin` value is a derived compatibility field for existing navigation, never a writable account privilege. The enforced capability registry stays in application code. Currently `admin.access` grants the entire store workspace; custom roles without it have storefront access. These are not granular per-page staff permissions.

Use Maintenance → Account roles and Profile choices to maintain roles and profile choices, and People to assign roles. Built-in access, the signed-in administrator's access and assigned roles are protected against destructive changes. Removed profile choices remain valid only when retaining an account's unchanged historical selection. Role codes are immutable and unique; only unassigned custom roles can be deleted.

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

Integration tests create uniquely named `oms_test_...` databases and remove only those databases during cleanup. They cover session cookies/restoration/revocation/expiry, CSRF, cart writes, checkout persistence and revisions, canonical references, duplicate-order prevention, discounts, payment settings, upload validation, receipt ownership, account validation, atomic IDs and migration idempotency. Password recovery uses mocked SMTP.

For manual browser checks, `py tests/browser_fixture.py` starts an isolated API on port 5001, seeds disposable accounts/products and writes connection metadata to `.tmp/browser-fixture.json`. Start Vite with `OMS_BACKEND_URL=http://127.0.0.1:5001`. If using a different frontend origin, set `CORS_ORIGINS` on the fixture process to that exact browser origin, for example `http://127.0.0.1:5181`. Shut down the fixture using its authenticated `/__test__/shutdown` endpoint so its disposable database is removed; never use this fixture as the store server.
