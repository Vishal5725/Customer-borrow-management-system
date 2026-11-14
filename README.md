# Customer Borrow Management System

A full-stack shop credit and payment tracking application built with Django REST Framework on the backend and React + Vite on the frontend. It helps a shop owner manage customers, item borrowing, payments, and dashboard reporting while also giving customers a clean portal to view their borrow history and pay dues.

## Project overview

This application is designed for a retail or micro-finance shop where customers borrow items or goods on credit. The system tracks:

- customers and their borrowing history
- item catalog with rates and stock metadata
- borrow entries created by the admin
- customer payment submissions and admin verification
- shop settings for WhatsApp contact and UPI QR code
- admin and customer dashboards with totals and summaries

The project is split into:

- backend: Django REST API with JWT authentication
- frontend: React SPA for admin and customer roles
- database: SQLite by default for local development

## Tech stack

### Backend
- Python 3
- Django 5
- Django REST Framework
- djangorestframework-simplejwt
- django-cors-headers
- django-filter
- drf-spectacular
- SQLite database in local development

### Frontend
- React 18
- Vite
- React Router DOM
- Axios
- Tailwind CSS
- Lucide React
- React Hot Toast

## Main features

### Admin features
- login with admin credentials
- manage customer accounts
- bulk create and delete customer records
- manage shop items and rates
- create borrow entries for customers
- review customer payments and verify them
- view dashboard totals: customers, entries, borrowed amount, due amount, collected amount
- configure shop WhatsApp number and UPI QR image

### Customer features
- login as a customer
- view personal dashboard summary
- view borrowing entries and outstanding balances
- see payment history and pending verification status
- submit payment details (cash or online/UPI)
- access QR code and WhatsApp flow to pay dues

## Project structure

```text
.
├── backend/
│   ├── accounts/
│   │   ├── migrations/
│   │   ├── models.py
│   │   ├── permissions.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── backend/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── shop/
│   │   ├── migrations/
│   │   ├── admin.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── db.sqlite3
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   ├── .env
│   ├── package.json
│   ├── package-lock.json
│   ├── vite.config.js
│   └── index.html
├── .gitignore
└── README.md
```

## Backend API highlights

The Django backend exposes routes under:

- `/api/auth/` for login, refresh token, logout, and customer management
- `/api/shop/` for items, borrows, payments, settings, and dashboards

### Authentication
- JWT-based login via `/api/auth/login/`
- refresh via `/api/auth/token/refresh/`
- current-user details via `/api/auth/me/`

### Examples of key endpoints
- `GET /api/shop/dashboard/admin/`
- `GET /api/shop/dashboard/customer/`
- `GET /api/shop/items/`
- `POST /api/shop/borrows/`
- `GET /api/shop/borrows/summary/`
- `POST /api/shop/payments/`
- `POST /api/shop/payments/<id>/verify/`
- `GET /api/shop/settings/`

## Frontend application structure

The React app contains:

- `src/App.jsx` — route definitions and role-based protection
- `src/pages/admin/*` — admin dashboard, customers, borrows, payments, settings
- `src/pages/customer/*` — customer dashboard, borrow list, payment details
- `src/components/*` — common layout and reusable UI blocks
- `src/context/AuthContext.jsx` — login/logout state and authenticated user context
- `src/services/api.js` — centralized API calls with JWT handling

## Local setup

### 1) Clone the repository

```bash
git clone https://github.com/Vishal5725/Customer-borrow-management-system.git
cd "Customer-borrow-management-system"
```

### 2) Set up the backend

```bash
cd backend
python -m venv .venv
# PowerShell:
.\.venv\Scripts\Activate.ps1
# Command Prompt:
# .\.venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

### 3) Set up the frontend

Open a new terminal in the project root and run:

```bash
cd frontend
npm install
npm run dev
```

Then visit:

- frontend: `http://localhost:5173`
- backend API: `http://127.0.0.1:8000/api`

## Environment configuration

The frontend includes a local environment file at `frontend/.env`:

```env
VITE_API_URL = "http://127.0.0.1:8000/api"
```

The backend can use Django settings values such as:

- `OWNER_WHATSAPP_NUMBER`
- `UPI_QR_IMAGE_URL`

These may be supplied through environment variables or a `.env` file when deploying or customizing the app.

## Default admin workflow

1. Create an admin user with `python manage.py createsuperuser`.
2. Log in to the frontend as admin.
3. Create customer accounts.
4. Add products/items with rates.
5. Create borrow entries.
6. Review customer payment entries and verify them.
7. Configure WhatsApp and QR via the settings page.

## Notes

- The app uses SQLite for local development and is suitable for a simple single-deployment setup.
- For production deployment, consider moving to PostgreSQL, securing environment variables, and hardening Django settings.
- The backend uses JWT authentication for secure request handling between the frontend and API.

## License

This project is intended for local development and internal business use. Add your preferred license if you plan to distribute or publish the project publicly.
