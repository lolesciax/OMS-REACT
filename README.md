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

## Deployment

`render.yaml` configures the Flask API. The root `vercel.json` builds the frontend workspace into `frontend/dist` and proxies API/upload requests to Render. Import the repository root (`./`) for new Vercel projects so the shared validation rules are included in the build.

`frontend/vercel.json` retains the same proxy and SPA rewrites for existing Vercel projects already rooted in `frontend/`. Keep the configuration matching the project's chosen root; no cloud settings need to change during cleanup.

## Generated files

Dependencies, build output, Python caches, local environment files, and `.tmp/` browser-test artifacts are ignored by Git. `portfolio-screenshots/` and its ZIP are generated deliverables; they are kept outside the application source and are also ignored.

## UI theme

The shared Tailwind theme lives in `frontend/src/index.css`.

| Brand color | Hex | Main use |
| --- | --- | --- |
| Linen | `#FFEDE3` | Page backgrounds and light text on brown |
| Tangelo | `#FB4D00` | Highlights, large accents, and the landing action |
| Chocolate Brown | `#49261D` | Primary controls, headings, sidebar selection |
| Botticelli | `#CAE7F7` | Selected states, progress cards, and supporting panels |

Use semantic tokens (`paper`, `primary`, `accent`, `muted`, `control`) in components. Small orange text uses a deeper derived tone for contrast; the bright Tangelo action uses dark ink. Charts read their colors from the same CSS theme. Keep error and warning states distinct from brand decoration.

The responsive browser audit covers public pages, customer account/checkout pages, admin pages, and every maintenance module. Run `npm run test:responsive` with the disposable browser fixture described in `backend/tests/browser_fixture.py`; it never requires production account data. `npm run test:catalog` checks the category selector, reset/sort/search, product details, liked-item sign-in, and desktop signup alignment against that same fixture.
