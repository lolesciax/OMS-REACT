# Old Goods Thrift OMS

A React storefront and admin interface with a Flask API and MongoDB database, organized for local development.

```text
frontend/
  public/                 Store images and static assets
  src/
    components/           Shared interface and admin screens
    contexts/             Authentication state
    pages/                Customer screens
    services/             API configuration and authenticated requests
    styles/               Styles scoped to their screens
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
  tests/                  Isolated backend regression tests
  requirements.txt
  run.py
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

The API runs at `http://localhost:5000`. Its health endpoint is `/api/health`. Set `FLASK_DEBUG=1` when you need Flask's local debugger.

Frontend settings live in `frontend/.env`. For a new configuration, use `VITE_API_URL=/api` so Vite proxies API calls and uploads to Flask. Existing frontend and backend `.env` files are preserved during folder cleanup.

## Accounts and payments

- API requests use an HttpOnly cookie backed by a MongoDB session. No account, token, cart, address or checkout data is stored in browser local/session storage. Sessions restore through `/api/auth/session`; mutations use a CSRF token held in memory. Existing plaintext and SHA256 passwords migrate to salted hashes on login. Sign in again after upgrading from the old browser-stored login.
- An admin account is created only when `ADMIN_PASSWORD` is configured and an `admin` account does not already exist. Existing accounts are preserved.
- Set `VITE_GCASH_QR_URL` and `VITE_PAYMAYA_QR_URL` to real merchant QR images in `frontend/.env`. Paths such as `/gcash-qr.png` refer to files placed in `frontend/public/`. Restart Vite after changing these values.
- Shipping is calculated from the delivery province. The server calculates product prices and totals independently of the browser.
- Uploading payment proof reserves inventory and leaves the order pending for admin verification. The workflow is pending → confirmed → processing → shipped → completed. Shipping requires a 12-digit tracking number.
- Password recovery requires the SMTP settings in `backend/.env.example`. Users request an email verification code and submit it with their new password. Codes expire after 15 minutes and can be used once. Recovery reports that it is unavailable when SMTP is not configured.

All uploads now live in `backend/app/static/uploads/`. Legacy `/uploads/products/...` URLs remain supported. Upload files and database records were preserved during consolidation.

See [the MongoDB schema and migration guide](backend/SCHEMA.md) for canonical ObjectId relations, persisted checkout drafts, session expiry, indexes, validators and archived migration originals.

Product edits store prices and stock as numbers. To inspect any older records saved as text, run `py normalize_catalog.py` from `backend/`; add `--apply` to save exact numeric conversions. The repair preserves amounts and quantities and skips concurrent edits. Restart the backend after Python code changes.

## Checks

```powershell
# From the repository root:
npm run lint
npm test
npm run build
npm run format:check

# From backend/:
py -m unittest discover -s tests -v
```

Backend tests mock MongoDB and email; they do not change live records or send messages. Build output is generated in `frontend/dist/` and ignored by Git. Dependencies, Python environments, local secrets, caches and temporary files are also ignored.

## Interface review

The customer screens share navigation, form controls, accessible dialogs and responsive layouts. The admin screens share a separate workspace layout with search, filters, paginated tables and consistent editors.

Typography uses shared 16px body/control text and 14px secondary text, scaled with browser font preferences. Product images show the complete item, and historical upload URLs resolve through the configured backend with a shared fallback for missing photos. API requests have a timeout and readable offline, proxy, and upload errors.

Pages reviewed in order: storefront; sign-in and recovery; registration; bag; checkout and payment proof; account and delivery addresses; order history; admin overview; products; orders; order details; people; discount codes.

Browser checks use fixture accounts and intercepted API responses. They cover mobile overflow, keyboard focus and Escape handling, sign-in return paths, quantity updates, checkout resumption without duplicate orders, proof uploads, profile saving and admin form submissions. Live merchant payment and SMTP delivery still need their own environment checks. The opt-in MongoDB integration suite uses isolated disposable databases. Discount codes can be managed, but checkout redemption is not implemented.

The typography pass checked all 13 pages at 320, 390, 768 and 1440px, plus product/recovery/admin dialogs. The live health and catalog endpoints were also checked, and the storefront loaded all 29 catalog products through the local proxy. Missing original uploads show an “Image unavailable” placeholder and need replacement photos. Browser interaction tests use fixtures; the backend integration suite also exercises real MongoDB session, cart, checkout and normalization operations in isolated databases.

Use `npm run format` to format the frontend and `npm run format:check` to verify formatting.
