# Old Goods Thrift OMS

A React storefront and admin interface with a Flask API and MongoDB database, organized for local development.

```text
frontend/
  public/                 Store images and static assets
  src/
    components/           Shared interface and admin screens
      maintenance/        Independent payment, role, profile, terms and security modules
    contexts/             Authentication state
    hooks/                Checkout drafts, form validation and maintenance editors
    pages/                Customer screens
    services/             API configuration and authenticated requests
    styles/               Tailwind component layers scoped to their screens
    index.css             Tailwind theme, shared styles and base accessibility rules
    utils/                Validation and order workflow rules
  tests/                  Frontend regression tests
  package.json            Frontend dependencies and commands
  vite.config.js          Local API and upload proxy
backend/
  app/
    models/               Database models
    routes/               API endpoints
    static/uploads/       Product photos, payment proofs and receipts
    order_workflow.py     Order status transition rules
    security.py           Password hashing and API authorization
    rate_limits.py        Shared sliding-window request budgets
    proxy.py              Authenticated proxy boundary
  tests/                  Isolated backend regression tests
  requirements.txt
  run.py
  cluster.py              Local balancer and worker supervisor
  Caddyfile               Local Caddy proxy and health checks
shared/
  validation.json         Public field limits shared by forms and the API
package.json              Workspace commands
package-lock.json         One shared dependency lockfile
```

## Run locally

Use Node.js 22 or newer, Python 3.11 or newer, and a MongoDB database.

From the repository root:

```powershell
npm install
npm run dev
```

The frontend normally runs at `http://localhost:5173`. Root commands delegate to the `frontend` workspace; you can also run them from `frontend/`.

In another terminal:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
# For a fresh checkout only; preserve an existing .env file:
Copy-Item .env.example .env
# Edit .env and set MONGODB_URI and a long random SECRET_KEY.
py run.py
```

The standalone API runs with Waitress at `http://localhost:5000`. Its health endpoint is `/api/health`; it checks MongoDB connectivity. Forwarding headers are ignored in standalone mode. The server binds to loopback and keeps traceback responses disabled.

For a local load balancer with two backend workers, stop the standalone API and run from the repository root:

```powershell
py backend/cluster.py --install-caddy  # Windows x64: official binary, verified release checksum
npm run api:cluster
```

The frontend keeps its existing API target on port 5000. Caddy balances requests across private Waitress workers on ports 5101 and 5102, checks their health, and avoids replaying writes after an upstream response failure. The supervisor restarts failed workers and stops all its child processes on Ctrl+C. Both workers use the same MongoDB sessions, rate limits and upload directory, so switching workers does not reset a session or budget. Caddy's admin endpoint and config persistence are disabled. Its executable is cached under ignored `.tmp/tools/`; an existing Caddy installation can be selected with `CADDY_BIN`. See [Caddy proxy configuration](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Worker ports require a private per-launch proxy credential and a loopback peer. Caddy rebuilds an allowlist of request headers and replaces forwarded IP/protocol headers; underscore or mixed-name aliases cannot become trusted WSGI headers. The allowlist preserves content types, cookies, CSRF, origins, CORS preflights, range requests and conditional image requests. Requests directly to a worker are rejected without the private credential. `TRUST_PROXY=1` without a credential fails startup. Public health requests remain rate limited; internal probes require the private credential in a separate header so a client's exhausted budget cannot take healthy workers out of rotation. `TRUSTED_HOSTS` restricts accepted hostnames. This configuration is local only; ports remain bound to loopback. See [Flask's proxy trust guidance](https://flask.palletsprojects.com/en/stable/deploying/proxy_fix/).

Frontend settings live in `frontend/.env`. For a new configuration, use `VITE_API_URL=/api` so Vite proxies API calls and uploads to Flask. Existing frontend and backend `.env` files are preserved during folder cleanup.

## Accounts and payments

- API requests use an HttpOnly cookie backed by a MongoDB session. No account, token, cart, address or checkout data is stored in browser local/session storage. Sessions restore through `/api/auth/session`; mutations use a CSRF token held in memory. Existing plaintext and SHA256 passwords migrate to salted hashes on login. Sign in again after upgrading from the old browser-stored login.
- An admin account is created only when `ADMIN_PASSWORD` is configured and an `admin` account does not already exist. Existing accounts are preserved.
- Open **Admin → Maintenance → Payments** to upload real merchant QR images, set recipient names, and enable GCash or Maya. A payment method stays unavailable until its QR image is configured. Roles, profile choices, terms, and security readiness each have a separate Maintenance module; old Settings links redirect to Payments.
- Login and sign-up require self-hosted ALTCHA verification, checked by the API against a single-use, browser-bound, purpose-specific challenge. No external CAPTCHA account or site key is needed. Install both dependency files when updating. Challenge records expire after five minutes and have a MongoDB TTL index.
- Sign-up validates email syntax/domain labels, username, password confirmation, current account terms, and CAPTCHA. Checkout requires the current order terms. Maintenance → Policies & terms publishes immutable versions; accounts and orders retain the accepted version and server timestamp. The initial terms should be reviewed and customized for the store before launch.
- Public information lives at `/help`, `/faqs`, `/policies`, `/terms`, and `/contact`, with dedicated privacy, shipping, and returns pages. The footer links to each section. **Maintenance → Policies & terms**, **FAQs**, and **Contact details** manage their published database content. FAQs support search, addition, removal and ordering. Concurrent edits are rejected without discarding the administrator’s draft. Review and customize the initial policy and help wording before launch.
- Shipping is calculated from the delivery province. The server calculates product prices and totals independently of the browser.
- Customers can redeem active discount codes at checkout. The server checks expiry, minimum spend and eligible categories, then saves the discount with the order.
- New orders start at pending_payment. Uploading payment proof reserves inventory and starts admin review: pending → confirmed → processing → shipped → completed. Unpaid orders cannot be confirmed. Customer and admin pages share a tracker that distinguishes payment review, preparation, shipment, delivery, and automatic completion. Shipping requires a 12-digit tracking number.
- Product choices survive sign-in and registration. The bag explains quantities reduced by stock changes and passes the displayed quantities to checkout. Checkout offers saved addresses, reports autosave progress, and preserves payment links through session renewal. Customer and admin screens distinguish awaiting payment from submitted proofs; both offer status refresh controls.
- Customer order filters separate unpaid orders from submitted payment proofs. Status checks run every 30 seconds while the page is visible and when returning to the tab. Refreshes retain loaded cards and show a retry message on failure; automatic checks pause during delivery confirmation. Progress labels use the shared tracker, with larger step text and explicit step counts.
- Sign-up availability checks account for mixed-case email addresses on historical accounts without changing those accounts. Failed availability checks defer to server validation at submission. CAPTCHA failures and expiry have an explicit retry action; retrying still requires a valid server-issued challenge.
- Fulfillment records confirmation, preparation, shipment and completion timestamps. Existing automatic completion after the delivery period records its own timestamp and preserves manual receipt confirmations.
- Password recovery requires the SMTP settings in `backend/.env.example`. Users request an email verification code and submit it with their new password. Codes expire after 15 minutes and can be used once. Recovery reports that it is unavailable when SMTP is not configured.

All uploads now live in `backend/app/static/uploads/`. New image uploads require a supported image signature and a maximum size of 5 MB. Legacy `/uploads/products/...` URLs remain supported. Upload files and database records were preserved during consolidation.

See [the MongoDB schema and migration guide](backend/SCHEMA.md) for canonical ObjectId relations, persisted checkout drafts, session expiry, indexes, validators and archived migration originals.

Product edits store prices and stock as numbers. To inspect any older records saved as text, run `py normalize_catalog.py` from `backend/`; add `--apply` to save exact numeric conversions. The repair preserves amounts and quantities and skips concurrent edits. Restart the backend after Python code changes.

## Checks

Maintenance uses a shared module catalog for its overview, grouped navigation and page titles. Each module keeps its own fields, validation and save operation, with consistent loading, retry, draft, discard and save controls. Policy tabs retain drafts; FAQs use collapsible editors with stable identifiers; payment methods save independently. See the [maintenance development guide](frontend/src/components/maintenance/README.md) before adding or changing a module.

Admin maintenance uses reusable validators and field-level feedback. Product names/categories, descriptions, condition, prices, stock, account details, discount codes/scopes/dates, merchant settings, image uploads and shipment tracking are checked before writes. API errors include a `fields` map; editors highlight the relevant controls, focus the first problem, preserve entered values and clear each error when that field changes. Updating an account keeps an unchanged historical username and treats an empty optional password as “keep the existing password.” The frontend sends only editable account fields.

The public limits in `shared/validation.json` are consumed by React and Python; keep this folder alongside `backend/` when moving the project. Prices and discount amounts use ordinary decimal digits with at most two decimal places, up to PHP 1,000,000; stock is an integer from zero to 1,000,000. A zero price remains supported, and zero stock removes a product from the available storefront. Existing condition labels can be retained while new labels use the approved choices. Discount codes use 1–40 letters, numbers, underscores or hyphens, with database uniqueness. Expiration dates follow the Philippine store timezone and can be today or later. Tracking numbers remain exactly 12 ASCII digits; overlong pasted numbers are rejected rather than silently truncated. Shared validation cases are run by both frontend and backend tests.

To maintain the store, use Products to add or edit inventory and categories, People to manage account contact details and availability, Discount codes to create eligible offers, and Settings to maintain merchant identity and QR images. Forms keep their contents after validation/network failures. Changing an account's role or availability affects authorization immediately; your own administrator access remains protected. Check the payment in the merchant wallet before confirming an order, then prepare it and enter its actual tracking number before shipping. Existing order prices and delivery details remain historical snapshots.

Settings also includes **Account roles & preferences**. Role names, assignments and permission selections live in MongoDB rather than a fixed account-role dropdown. Add custom roles there, then assign them in People. The current `admin.access` capability grants the full admin workspace; roles without it have storefront access. Built-in roles cannot lose their protected access, your own access cannot be removed, and assigned custom roles must be reassigned before deletion. Startup migrates historical boolean flags to `roleId` references without replacing explicit assignments or saved catalog labels. The Account page reads profile choices from the database, shows field errors, preserves failed edits, supports discarding changes and uses explicit buttons for address and photo actions. Changing these catalog values requires no frontend rebuild.

The bell opens a persistent **Notifications** inbox for the signed-in account. Customers receive welcome, contact/security, order-placement, payment-submission, payment-verification, preparation, shipping/tracking and delivery updates. Administrators also receive new-order, payment-review, delivery, low-stock/sold-out and payment-setting alerts. Account administration and role-access changes notify affected account holders; successful password resets generate a security notice without exposing the reset code or password. Routine profile/address saves retain their inline confirmation rather than creating unnecessary inbox items.

Inboxes have category and unread filters, read/unread controls, “mark all as read”, cursor pagination, skeleton loading, retry controls and links to the affected order/account/workspace. Unread counts refresh after successful actions, every 30 seconds while visible, and on returning to the tab. These are in-app notifications; they do not send browser push messages or notification emails. Existing SMTP password recovery remains separate.

Notification events are queued atomically inside the changed MongoDB source document and delivered after successful requests. Inbox reads retry queued work after interruptions; a unique recipient/event/audience index makes delivery idempotent. Read states are individual to each recipient, and revoked administrator access immediately hides store-team notifications. Inventory alerts occur at five items or fewer and at zero, once per replenishment cycle. Adding a future notification means enqueueing an event in the same successful business write, never trusting a client-supplied recipient or message. See `backend/app/notifications.py` and `backend/SCHEMA.md`.

Security protections include owner/admin checks for payment and receipt attachments on all three upload URL aliases; MongoDB-backed sliding-window throttling; origin checks for browser mutations alongside session CSRF tokens; no-store API responses; and security headers. Login permits 20 attempts per IP per five minutes, registration five per 15 minutes, recovery emails three per 15 minutes, reset submissions ten per 15 minutes, and availability checks 60 per minute. Login and recovery also have an account budget of three times the IP limit. Limits count successful and unsuccessful requests, return HTTP 429 with `Retry-After`, and fail closed when MongoDB is unavailable. Authentication bodies are limited to 16 KB. Budget timestamps use MongoDB's clock, and atomic updates prevent concurrent workers from overspending a budget.

| Shared budget | Sliding-window limit |
| --- | --- |
| All requests per IP | 120 per 10 seconds and 600 per minute |
| Mutations per IP | 120 per minute |
| Upload reads per IP, across all aliases | 300 per minute |
| Authenticated account requests | 300 per minute |
| Authenticated account mutations | 90 per minute |
| File/receipt uploads per account | 30 per 10 minutes |

HEAD, OPTIONS, malformed JSON, rejected origins and missing routes consume the IP budget. Trailing slashes and query strings share the same endpoint budget. Admin accounts receive the same limits. A new cookie does not reset an account budget; IPv4-mapped addresses are normalized, and IPv6 addresses in one /64 share the IP budget. This controls application request rates; a single machine and MongoDB still have finite network and resource capacity.

Uploads are decoded using Pillow, limited to 5 MB and 20 megapixels, and re-encoded to strip embedded metadata and trailing payloads. Animated uploads retain the first frame. Existing files are preserved; new validation applies to future uploads. HTTPS responses set HSTS; enable `SESSION_COOKIE_SECURE=1` when using HTTPS. Local HTTP keeps secure cookies disabled so sign-in works. The backend requires MongoDB credentials with access only to this application's database. Security references: [Flask security guidance](https://flask.palletsprojects.com/en/stable/web-security/) and [Pillow image security](https://pillow.readthedocs.io/en/stable/handbook/security.html).

```powershell
# From the repository root:
npm run lint
npm test
npm run build
npm run format:check

# From backend/:
py -m unittest discover -s tests -v
```

The default backend tests mock MongoDB and email. Set `OMS_MONGODB_INTEGRATION=1` to include tests against isolated disposable MongoDB databases; SMTP remains mocked. Tests do not change store records or send messages. Build output is generated in `frontend/dist/` and ignored by Git. Dependencies, Python environments, local secrets, caches and temporary files are also ignored.

Set `OMS_CLUSTER_INTEGRATION=1` to include the real Caddy/two-worker test after installing Caddy. It uses ports 5002/5201/5202, an isolated database and temporary shared uploads, checks direct-worker rejection, forged/mixed-name headers, slash/query aliases, shared sessions and limits, multipart payment proof, private image access, health probes, and worker failover/restart, then removes its database and processes. It never uses the store database for request mutations.

## Interface review

The customer screens share navigation, form controls, accessible dialogs and responsive layouts. The admin screens share a separate workspace layout with search, filters, paginated tables and consistent editors.

Styling uses Tailwind CSS with its Vite plugin. Layout utilities live in JSX; reusable controls, descendant styles and interaction states use `@apply` inside `@layer components`. `frontend/src/index.css` owns the color, font and text-size theme. Page styles use `@reference` to share that theme and load with the corresponding route. See the [Tailwind Vite setup](https://tailwindcss.com/docs/installation/using-vite) and [directive reference](https://tailwindcss.com/docs/functions-and-directives) when extending the interface.

Account and admin routes load on demand, including their CSS; Chart.js loads with the overview page. Route splitting keeps these screens out of the initial storefront bundle. Catalog filtering is memoized and defers search results while typing. Admin filtering is memoized, list pagination clamps after records change, and currency formatting reuses one formatter.

The Tailwind review covers all 14 customer/admin pages, with separate checkout review/payment states, at 320, 390, 768 and 1440px. Search controls use one focus ring, mobile navigation keeps consistent spacing, tables support keyboard scrolling, and page-load failures offer a reload action. Browser document titles identify the current page.

The landing opening uses a viewport-height layout with responsive portrait and short-landscape arrangements. Its featured photos, category choices and product grid include only active products with valid positive stock; admin inventory retains sold-out products. Failed hero images give way to other available pieces. The shared footer includes shopping/contact/social navigation, a large brand wordmark, collection links and a back-to-top control that respects reduced-motion preferences. Design references: [MONOCHROME](https://www.behance.net/gallery/170316593/MONOCHROME) for editorial composition and [Ranboo](https://www.awwwards.com/inspiration/ranboo-fashion-hero-typography-footer-design) for typography-led footer structure. Reference images were not copied into the product catalog.

Typography uses shared 16px body/control text and 14px secondary text, scaled with browser font preferences. Product images show the complete item, and historical upload URLs resolve through the configured backend with a shared fallback for missing photos. API requests have a timeout and readable offline, proxy, and upload errors.

Pages reviewed in order: storefront; sign-in and recovery; registration; bag; checkout and payment proof; account and delivery addresses; order history; admin overview; products; orders; order details; people; discount codes; store settings.

Browser checks cover mobile overflow, keyboard focus and Escape handling, sign-in return paths, quantity updates, checkout resumption without duplicate orders, proof uploads, profile saving and admin form submissions. A full purchase was also exercised against an isolated MongoDB database: payment settings, discount creation/redemption, payment proof, admin verification, shipping and customer delivery confirmation. Live merchant payment and SMTP delivery still require real credentials and their own environment checks.

The typography pass checked customer and admin pages at 320, 390, 768 and 1440px, plus product/recovery/admin dialogs. The live health and catalog endpoints were also checked, and the storefront loaded all 29 catalog products through the local proxy. Missing original uploads show an “Image unavailable” placeholder and need replacement photos. The backend integration suite also exercises real MongoDB session, cart, checkout and normalization operations in isolated databases.

Use `npm run format` to format the frontend and `npm run format:check` to verify formatting.

Loading screens use shared Tailwind skeletons for session restoration, lazy routes, storefront cards and hero images, the bag, checkout and shipping quotes, profiles, order history, admin tables/statistics/charts/settings, pagination and availability validation. Image placeholders animate until the image loads and give way to the existing fallback on failure. Skeleton regions announce loading to assistive technology, contain no interactive placeholder controls, and stop shimmering when reduced motion is preferred. Delayed-response browser checks cover all 14 screens at 320, 390 and 1440px, plus image loading, failures and retries.
