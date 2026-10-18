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

Deployment configuration is in `render.yaml` and `frontend/vercel.json`.
