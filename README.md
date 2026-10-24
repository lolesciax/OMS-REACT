# Old Goods Thrift OMS

Old Goods Thrift is a case-study project for an online secondhand clothing store. It combines a customer storefront with an admin workspace for managing the store.

## Features

- Customers can browse available products, save favorites, manage a cart, place orders, and track order status.
- Admins can review store activity and manage products, stock, orders, customers, and discount codes.
- Maintenance tools configure catalog choices, payment details, and store information.
- Sold-out products remain available to admins but are hidden from the customer storefront.

## Tech stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Python, Flask
- **Database:** MongoDB

## Project structure

- `frontend/` — storefront, admin interface, and frontend tests
- `backend/` — API, database access, uploads, and backend tests
- `shared/` — validation rules used by both frontend and backend

## Run locally

Requirements: Node.js 22+, Python 3.11+, and MongoDB.

1. Install frontend dependencies from the project root:

   ```sh
   npm install
   ```

2. Configure `backend/.env` with `MONGODB_URI` and a strong `SECRET_KEY`, then install and start the API:

   ```sh
   cd backend
   py -m pip install -r requirements.txt
   py run.py
   ```

3. In another terminal, start the frontend from the project root:

   ```sh
   npm run dev
   ```

The local frontend runs at `http://localhost:5173` and the API at `http://localhost:5000`.

## Verification

Run frontend checks from the repository root:

```sh
npm run lint
npm test
npm run format:check
npm run build
```

Run the backend regression suite from `backend/`:

```sh
py -m unittest discover -s tests
```

Database integration tests use disposable test databases and require explicit opt-in; see `backend/tests/test_mongodb_integration.py`.

## Loading behavior

The initial session check allows up to 90 seconds for a sleeping API to wake, retries only the read-only bootstrap request, and shows a retry screen if that deadline expires. Startup skeletons follow the green storefront and workspace layouts. The startup status appears after 1.2 seconds to avoid flashing on fast connections; the wake-up explanation appears after 8 seconds.

Session refreshes keep the current page mounted. Public content refreshes retain the same document while loading, clear it when changing document paths, and ignore canceled responses. Run `npm run test:startup` with the local browser fixture and Chrome debugging session to verify delayed startup, session restoration, refresh continuity, and stale-response handling.

## Public response caching

The API caches successful public product responses for 15 seconds and published help/policy responses for 60 seconds. Each worker uses a thread-safe LRU capped at 64 entries and 4 MiB total (1 MiB per response). `PUBLIC_CACHE_ENABLED=0` disables it.

Successful product, order, checkout, or admin mutations clear the local cache and increment a shared `settings.public_cache_revision` document in MongoDB. Workers check that revision before using a cached response. A failed revision read bypasses the cache; an invalidation-write failure is logged and other workers' entries expire within their short TTL. Direct database edits also become visible by TTL, or immediately with a `Cache-Control: no-cache` request.

Public JSON responses include ETags and use `private, no-cache, max-age=0, must-revalidate`: the browser can reuse unchanged bytes after a 304 response, while shared/CDN caching remains disabled. `X-Store-Cache: HIT` or `MISS` makes server-cache behavior visible in browser network tools. Errors, health checks, authentication/CAPTCHA, account/admin data, protected catalog options, carts, checkout, orders, notifications, and private attachments remain uncached. Authoritative stock, price, payment, and policy-version validation still reads MongoDB directly. No localStorage or service-worker cache is added.

## Deployment

`render.yaml` configures the Flask API. The root `vercel.json` builds the frontend workspace into `frontend/dist` and proxies API/upload requests to Render. Import the repository root (`./`) for new Vercel projects so the shared validation rules are included in the build.

`frontend/vercel.json` retains the same proxy and SPA rewrites for existing Vercel projects already rooted in `frontend/`. Keep the configuration matching the project's chosen root; no cloud settings need to change during cleanup.

## Generated files

Dependencies, build output, Python caches, local environment files, and `.tmp/` browser-test artifacts are ignored by Git. `portfolio-screenshots/` and its ZIP are generated deliverables; they are kept outside the application source and are also ignored.

## UI theme

The shared Tailwind theme lives in `frontend/src/index.css`.

| Brand color | Hex | Main use |
| --- | --- | --- |
| Cream | `#FCFBF7` | Page backgrounds and light text on forest |
| Forest | `#344C3C` | Primary buttons, headings, sidebar selection |
| Sage | `#E7EDDC` | Selected states, progress cards, supporting panels |
| Leaf | `#B9C89D` | Decorative accents and highlights |
| Terracotta | `#A34C32` | Complementary links and prices |

Use semantic tokens (`paper`, `primary`, `accent`, `muted`, `control`) in components. Charts read their colors from the same CSS theme. Keep error and warning states distinct from brand decoration.

Shared commerce navigation lives in `CustomerNavigation` and `Breadcrumbs`. Customer account links, help navigation, checkout steps, and mobile-menu styling use `frontend/src/styles/commerce.css`; customer and admin content styles stay in their area stylesheets. Add customer route labels to `CustomerNavigation` when adding a page. `useHashNavigation` resolves in-page destinations after lazy routes render, including search and saved-item links into the collection.

The responsive browser audit covers public pages, customer account/checkout pages, admin pages, and every maintenance module. Run `npm run test:responsive` with the disposable browser fixture described in `backend/tests/browser_fixture.py`; it never requires production account data. `npm run test:catalog` checks the category selector, reset/sort/search, product details, liked-item sign-in, and desktop signup alignment against that same fixture.
