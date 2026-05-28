# FUTO Data Collection Frontend

A static frontend for a FUTO textbook data-collection platform. Contributors can register, log in, view their upload quota and earnings, upload textbook page images, inspect missing pages, request withdrawals, and manage profile/payment settings.

## Features

- Login and registration flow
- Dashboard with user tier, daily quota, balance, and textbook progress
- Multi-step textbook page upload flow
- Missing pages view per textbook
- Withdrawal screen with minimum-balance state, request modal, and withdrawal history
- Settings page for editable profile details and saved payment methods
- Shared API layer with bearer-token handling and automatic logout on `401`
- Responsive UI using the existing CSS component system

## Project Structure

```text
FUTO-data-collection/
  css/
    reset.css
    variables.css
    components.css
    layout.css
    responsive.css
  js/
    api.js
    auth.js
    dashboard.js
    missing-pages.js
    routes.js
    settings.js
    state.js
    ui.js
    upload.js
    withdrawal.js
  pages/
    index.html
    dashboard.html
    upload.html
    missing-pages.html
    withdrawal.html
    settings.html
```

## Pages

- `pages/index.html` - login, registration, and password reset request.
- `pages/dashboard.html` - user overview, textbook cards, upload entry, withdrawal entry.
- `pages/upload.html` - upload wizard for textbook page images.
- `pages/missing-pages.html?book=<id>` - list of missing pages for a selected textbook.
- `pages/withdrawal.html` - withdrawal eligibility, request modal, and history.
- `pages/settings.html` - editable profile details and saved payment methods.

## Running Locally

This is a plain HTML/CSS/JavaScript frontend. There is no build step.

From the repository root:

```bash
python3 -m http.server 5500
```

Then open:

```text
http://localhost:5500/FUTO-data-collection/pages/index.html
```

The backend API is currently configured in `FUTO-data-collection/js/api.js`:

```js
const BASE_URL = "http://localhost:8000";
```

Update `BASE_URL` if your backend runs somewhere else.

## Expected Backend API

The frontend expects these endpoints:

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`

### User

- `GET /api/user/profile`
- `PUT /api/user/profile`
- `GET /api/user/balance`
- `GET /api/user/daily-quota`
- `GET /api/user/tier`

### Textbooks and Uploads

- `GET /api/textbooks`
- `GET /api/textbooks/:id/missing-pages`
- `POST /api/upload/process`

### Withdrawals

- `POST /api/withdrawal/request`
- `POST /api/withdrawal/confirm`
- `GET /api/withdrawal/history`

### Payment Methods

- `GET /api/payment-methods`
- `POST /api/payment-methods`

## Authentication

On successful login or registration, the frontend stores the returned token in local storage using:

```text
futo_auth_token
```

Every API request automatically sends:

```text
Authorization: Bearer <token>
```

If the backend returns `401`, the token is cleared and the user is redirected to the login page.

## Development Notes

- Keep all network requests inside `js/api.js`.
- Keep shared runtime state in `js/state.js`.
- Page-specific behavior should live in the matching page script, such as `dashboard.js`, `upload.js`, or `settings.js`.
- Reuse existing CSS classes before adding new CSS.
- Script order matters on every page:

```html
<script src="../js/routes.js"></script>
<script src="../js/state.js"></script>
<script src="../js/api.js"></script>
<script src="../js/ui.js"></script>
<script src="../js/auth.js"></script>
<script src="../js/page-specific-file.js"></script>
```

## Verification

Run a syntax check for all JavaScript files:

```bash
for f in FUTO-data-collection/js/*.js; do node --check "$f" || exit 1; done
```

You should also test the app manually with the backend running:

- Register a new account
- Log in
- Load dashboard data
- Upload a textbook page
- Open missing pages and upload a selected page
- Add a payment method
- Request and confirm a withdrawal
- Log out

## Current Status

Frontend pages and flows are implemented. Final readiness depends on confirming the backend response shapes and CORS/token behavior against the configured API server.
