# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Online document request system for North Bangkok University students (ระบบขอเอกสารออนไลน์). Students register, request official documents (transcripts, certificates), choose pickup or mail delivery, pay by bank transfer and upload the slip, then track status. Admins process requests, manage users and view reports. Each new request sends a LINE bot message to a staff group.

Stack: Node.js + Express 4, PostgreSQL (`pg`), JWT auth, multer uploads, and a plain HTML/vanilla JS + Bootstrap 5 (CDN) frontend. There is no build step, no bundler, no linter and no test suite.

### How this code was written (read before trusting any file)

Until 2026-09 there was no AI agent or CLI. The owner asked an AI in a chat window, then copy-pasted snippets onto the server by hand. As a result:
- The **running code and the live PostgreSQL database are the only reliable sources of truth.** `database/schema.sql`, `manuals/*`, code comments and commit messages often describe an intended or earlier state, not what's deployed.
- Paste artifacts are common: comments like "add this after line ~340" or "replace the old endpoint with this", inconsistent indentation, a function duplicated in several files, and stale `.bak` / `.save` copies left next to live files.
- Before relying on a column, endpoint or helper, confirm it exists: grep the code that actually runs, or query `information_schema` in the live DB (read-only). Don't infer it from docs or comments.
- As of 2026-09-28, pm2 had been restarted after the last backend edit, so the files on disk match the running process. If a backend file's mtime is newer than the pm2 start time (`pm2 describe document-request-system`), the running code differs from the file.

## Commands

```bash
npm ci
npm run dev        # nodemon server.js
npm start          # node server.js
# fresh install (see README.md for the full new-server procedure)
psql -d document_request_system -v ON_ERROR_STOP=1 -f database/schema.sql
psql -d document_request_system -v ON_ERROR_STOP=1 -f database/seed.sql
node scripts/create-admin.js <username> <password> "<full name>" <email>
```

The port comes from `PORT` in `.env` (default 3200).

**This directory is the live production deployment.** It runs under pm2 as `document-request-system` with watch disabled:
- Backend changes (`server.js`, `routes/`, `middleware/`, `services/`) take effect only after `pm2 restart document-request-system`. Logs: `pm2 logs document-request-system`.
- Frontend files in `public/` are served statically, so edits go live on the server right away. However, the public domain sits behind **Cloudflare**, and nginx sends `Cache-Control: max-age=14400` for JS. Users can keep getting old copies of individual JS files for 4+ hours, and each file expires on its own schedule, so a new page script can run next to an old `main.js`. Never make a page script depend on a brand-new global from `main.js` without a fallback (see the `escapeHtml` guard at the top of the page scripts). Alternatively, purge the Cloudflare cache after deploying.
- **Cache busting:** every local `<script src="js/...js?v=YYYYMMDD">` in the live HTML pages carries a version query. HTML is not cached by Cloudflare (`cf-cache-status: DYNAMIC`), so changing the query forces browsers to fetch the new JS right away. **Whenever you change any file in `public/js/`, bump `?v=` in every live page**, for example `sed -i -E 's#(src="(\.\./)?js/[a-z-]+\.js)\?v=[0-9a-z]+"#\1?v=<new>"#g' public/*.html public/admin/*.html`. Without it, users keep a stale JS copy in their browser for up to 4h. This happened on 2026-09-28: the users page showed the new page-size dropdown but the old script ignored it.
- `public/uploads/` holds real student payment slips (gitignored). The production database holds thousands of real requests.
- `.env` is gitignored and was removed from git history. Never commit it. `.env.example` lists the keys.
- nginx (`/etc/nginx/sites-available/document`, template in `deploy/nginx.conf.example`) serves `public/` directly, including `/uploads/`, and proxies only `/api/` to Node. A new top-level route outside `/api/` won't reach Express in production.
- The GitHub repo `akkadateoit/document-request-system` is **public**. It is meant to be cloned onto new servers (SaaS direction, one institution per install). README.md has the install steps and lists the institution-specific values that are still hard-coded.

## Architecture

### Server wiring

`server.js` creates its own `pg` Pool and multer instance and injects them into route factories: `require('./routes/auth')(pool)`, `require('./routes/documents')(pool, upload)`, and so on. New route modules should follow the same `module.exports = (pool[, upload]) => router` pattern. The `router` object is created at module scope, outside the factory. `database/connection.js` exports a second pool that nothing uses.

Admin/report routes and the LINE service are loaded in `try/catch`, so a syntax or require error in them is logged as "not found, skipping" and those endpoints return 404 instead of crashing the app. After a restart, check the startup log.

Mounted prefixes:
- `/api/auth` (register, login, `GET /user`)
- `/api/documents` (student)
- `/api/admin` (admin)
- `/api/reports` (admin)
- `/api/test-line` and `/api/line-config`, defined inline in `server.js` with no auth

`/api/admin/line-config` is the authenticated copy of `/api/line-config`.

### Auth

- `middleware/auth.js` (`authenticateJWT`) verifies `Authorization: Bearer <token>` and sets `req.user = { id, student_id, role }`. Tokens expire after 24h.
- `middleware/admin.js` (`isAdmin`) requires `role === 'admin'`.
- `GET /api/auth/user` verifies the token itself instead of using the middleware.
- The frontend stores `token`, `userRole`, `userId`, `userName` and `studentId` in `localStorage` and adds the header to each `fetch` by hand.
- Users log in with `student_id`. Admins are `users` rows with `role='admin'` and `faculty='Admin'`, created through `POST /api/admin/add-admin`.
- Admin password reset sets the password to the fixed value `123456` and returns it.
- `isValidDate` / `isValidIdNumber` (Thai ID is 13 digits, passport is 6–12 alphanumeric) are copied at the bottom of both `routes/auth.js` and `routes/admin.js`. Keep both copies in sync.

### Request data model

- `document_requests` is the order header: `delivery_method` (`pickup`/`mail`), `pickup_location`, `urgent`, `total_price`, `payment_slip_url`, `status`, and `document_type_id`.
- **Pickup location** (added 2026-09-28): when `delivery_method = 'pickup'`, `pickup_location` is `saphanmai` (สะพานใหม่) or `rangsit` (รังสิต). It is enforced by a CHECK constraint and by `PICKUP_LOCATIONS` in `routes/documents.js`. It is NULL for mail and for older requests. The API accepts a missing value so that cached old pages keep working; `request.js` requires the choice. Pickup campuses deliberately do **not** get new `delivery_method` values, so every `delivery_method === 'pickup'` check (urgent fee, pricing, status texts) keeps working. To add a campus, update the CHECK constraint (as a migration), `PICKUP_LOCATIONS`, the radios in `request.html`, `request.pickupLocations` in all locales, and the fallback maps in `formatDeliveryMethod` (`main.js` and the page-script guards) and `services/lineNotification.js`. Display text comes from `formatDeliveryMethod(deliveryMethod, pickupLocation, lang)` in `main.js`. The "ready" status text has a Rangsit variant (`statusInfo.readyPickupRangsit`).
- `document_request_items` holds line items (quantity, price_per_unit, subtotal).
  - The current UI (`public/js/request.js`) always uses `POST /api/documents/request-multiple`. It writes a header plus items, and the header's `document_type_id` is just the first item.
  - `POST /api/documents/request` is a legacy single-document endpoint. It creates no items rows, and the frontend no longer calls it.
  - Read endpoints (`my-requests`, `request/:id`, admin `request/:id`) attach `document_items`, `item_count` and `has_multiple_items` whenever items rows exist. The DB column `has_multiple_items` exists but is never written, so don't rely on it.
  - Queries joining only `document_types` via the header, such as reports' `requestsByType`, the admin list and the dashboard's recent requests, show only the first document of a multi-item order.
- **Pricing is computed on the client, and the web page's rules are the official ones** (the owner decided this):
  - Start with the sum of the items.
  - Add 200 THB when delivery is `mail`.
  - Add 50 THB × the total document count when urgent. Urgent is allowed only for pickup.

  `request.js` sends `total_price` and each item's `price`/`subtotal`, and `request-multiple` stores them as-is. The legacy `/request` endpoint charges a flat +50 for urgent instead, which is not the official rule. If you add server-side price checks, copy the web page's rules. To change fees, update `calculatePrice`, the summary block and `submitRequest` in `request.js`.
- Bank transfer details (bank, account number, account name) are hard-coded in `request.js`. The `BANK_ACCOUNT`/`BANK_NAME` env vars are unused.
- Payment slips are saved by multer to `public/uploads/<timestamp>-<originalname>` and served at `/uploads/...`. A student can re-upload through `POST /api/documents/upload-payment/:request_id`.
- `status_history` is the audit log. Valid statuses are `pending`, `processing`, `ready`, `completed` and `rejected`, checked only in `PUT /api/admin/request/:id/status`. That handler updates the status and inserts history in one transaction. Creating a request writes no initial `pending` history row. Status changes do not notify anyone.
- Admin `DELETE /user/:id` manually deletes history, then items, then requests, then the user, all in one transaction. Admin accounts cannot be deleted.

### Database schema

`database/schema.sql` was regenerated from the production DB with `pg_dump --schema-only` on 2026-09-28, so it now matches production. `database/seed.sql` holds only reference data: 8 faculties and 22 document types. `scripts/create-admin.js` creates or updates an admin account. The old hard-coded admin hash didn't match its documented password. Things to know:
- `users` has no `status` column, so `POST /api/admin/user/:id/toggle-status` always fails. No UI calls it.
- `*.newrangsit` files are an abandoned draft that used a `pickup_rangsit` delivery method. It was superseded by `pickup_location`; don't revive it.
- `request-multiple` runs `CREATE TABLE IF NOT EXISTS document_request_items` on every request.
- Migrations are plain, idempotent SQL files in `database/migrations/` named `YYYY-MM-DD-<name>.sql`. There is no runner and no tracking table, so every file must be safe to re-run (`IF NOT EXISTS`, guarded `DO` blocks). Apply each new file by hand on every existing server, then regenerate `schema.sql` from production with `pg_dump --schema-only --no-owner --no-privileges`, removing the `SET` lines, so fresh installs get the change without running migrations. Never dump data tables other than `faculties`/`document_types` into the repo, because the repo is public.

### i18n (th / en / zh)

- Frontend: `public/js/language.js` loads `public/locales/{th,en,zh}.json`, translates elements with `data-i18n="section.key"`, stores the choice in `localStorage.language`, sets `window.i18n` / `window.currentLang`, and dispatches an `i18nReady` event. Page scripts that build translated DOM wait for that event or poll `window.i18nLoaded`. Add new keys to all three files with the same nesting. Known mismatch: `statusInfo` is at the top level in `en`/`zh` but nested under `admin.statusInfo` in `th`. `status.js` reads the top-level key, so Thai only works through the hard-coded fallback strings. `login.noAccount` exists only in `th`.
- DB: `document_types` and `faculties` have `name_th`/`name_en`/`name_zh` columns, and endpoints choose one by building ``name_${req.query.lang}`` into the SQL string. That value isn't validated, which is an SQL injection risk. Whitelist `th|en|zh` when you touch these queries.
- API messages, LINE messages and reports (`dt.name_th`) are in Thai only.

### Frontend layout

Each page loads `language.js`, then `main.js`, then page-specific scripts. The shared helpers are global functions.

| Page | Scripts after `language.js` + `main.js` |
|---|---|
| `login.html`, `register.html` | `auth.js` |
| `dashboard.html` | `dashboard.js` |
| `request.html` | `request.js` (multi-document cart, pricing, QR code via CDN) |
| `status.html` | `status.js` |
| `request-detail.html` | `student-request-detail.js` |
| `admin/dashboard.html` | `admin-common.js`, `admin-dashboard.js` |
| `admin/reports.html` | `admin-common.js`, `admin-reports.js` |
| `admin/user-detail.html` | `admin-common.js`, `user-detail.js` |
| `admin/requests.html` | `admin.js`, `admin-requests.js` |
| `admin/request-detail.html` | `admin.js`, `request-detail.js` |
| `admin/users.html` | `admin.js`, `users.js` |

`main.js`, `admin.js` and `admin-common.js` each define their own `checkAdmin`, `createStatusBadge`, `translateStatus` and `formatDate`, plus `admin.js`/`admin-common.js` both define `updateRequestStatus` and `setupStatusUpdateModal`. Whichever script loads last wins, so change the copy that the page actually uses (see the table).

The admin navbar is copied into every admin page (`dashboard`, `requests`, `users`, `reports`, `request-detail`, `user-detail`). The copies must stay identical except for which link has `active`, so when you change it, change all six. Admin list pages use a full-width `container-fluid px-3 px-lg-4`.

Dead files that no page loads: `js/reports.js`, `*.bak*`, `*.save`, `*.newrangsit`, `request.bak.html`, `admin/user-detail2.html`, `testjson.html`, and `routes/*.bak.js`. `admin/line-test.html` calls `/api/admin/test-line-notification`, which doesn't exist; the working test endpoint is `/api/test-line`.

### LINE notifications

`services/lineNotification.js` uses `@line/bot-sdk` (`line.Client`, push messages). `notifyNewDocumentRequest` is called from both create endpoints in `routes/documents.js`, and a failure there never fails the request.

Recipients, in order of priority:
1. `LINE_GROUP_ID`
2. `LINE_NOTIFY_USERS` (comma-separated)
3. `LINE_ADMIN_USER_ID`

The first one that is set wins. `GET /api/test-line` sends a real test message to the group and has no auth. `utils/findGroupId.js` is a standalone webhook server for discovering the group ID. See also `manuals/LINE_SETUP.md`.

## Developing new features

There are no automated tests. Verify changes as follows:
- **Smoke-test backend changes against a throwaway DB before restarting production.** Create a temporary database, load `database/schema.sql` + `database/seed.sql`, create an admin with `scripts/create-admin.js`, then run a second server instance: `env DB_NAME=<tmpdb> PORT=3299 LINE_CHANNEL_ACCESS_TOKEN= LINE_GROUP_ID= LINE_NOTIFY_USERS= LINE_ADMIN_USER_ID= node server.js`. Blanking the LINE variables matters, because otherwise test requests send real messages to the staff LINE group (dotenv never overrides variables that are already set). Uploads from the test instance land in the real `public/uploads/`, so delete them afterwards. Exercise the endpoints with `curl`, then drop the DB.
- Frontend edits in `public/` go live the moment they're saved. For risky UI changes, work on a copy page first or test through the port-3299 instance, which serves `public/` too.

Conventions to follow (match the existing code):
- **Endpoint:** add it inside the route factory. Apply `authenticateJWT` (plus `isAdmin` for admin routes) per route. Use `pool.query` with `$n` parameters, and respond with `res.status(...).json({ message: '<Thai text>' })` on errors. Use `pool.connect()` + `BEGIN/COMMIT/ROLLBACK` for multi-statement writes (see `PUT /api/admin/request/:id/status`). Anything that must stay private must live under `/api/`, because nginx serves everything else from `public/`.
- **Page:** copy an existing page's `<head>`/navbar. Load the Bootstrap CDN, `language.js`, `main.js`, then your script (admin pages add `admin-common.js`). Read the token from `localStorage` and send `Authorization: Bearer`. Put every visible string in `data-i18n` keys in all three locale files.
- **Rendering:** the existing code builds tables with `innerHTML` template strings. When you insert user-controlled values (names, addresses, notes), wrap them in `escapeHtml()` (defined in `main.js`) or use `textContent`. This includes values read back from the DOM with `textContent` and then re-inserted as HTML, as in the print receipt in `request-detail.js`. Never embed data inside inline `onclick` JS strings.
- **Libraries** come from CDNs: Bootstrap 5.3, Chart.js, jsPDF + autotable, SheetJS `xlsx`, `html2canvas` and `qrcode`. Thai PDF fonts are in `thai-fonts.js`. There is no npm frontend tooling, so add new libraries the same way.
- **Schema change:** apply the SQL by hand in production, then regenerate `database/schema.sql` (see "Database schema") and commit both the code and the schema together.

## Known bugs

Fixed on 2026-09-28:
- Uploads with long Thai filenames (`ENAMETOOLONG`). Files are now named `<timestamp>-<random hex><ext>`, and older uploads keep their original names.
- Stored XSS in admin and student pages. All user data in HTML templates now goes through `escapeHtml`.
- The app crashed at startup when no LINE token was set. The LINE client is now created lazily.

Still open:
- **LINE notifications fail with HTTP 429 once the LINE Messaging API monthly free-message quota runs out** (confirmed by the owner). Staff then miss new-request alerts, and failures are only logged. Options: a paid LINE plan, fewer messages (e.g. a daily digest), or a second channel such as email.
- SQL injection via `?lang=`. `/api/test-line` and `/api/line-config` have no auth. The server trusts the client-sent `total_price`. See also "Request data model" and "Database schema".
- `GET /api/admin/requests` ignores `page`/`limit`, so `admin-requests.js` fetches every request and paginates client-side. Expect this to slow down as data grows (~3,000 requests as of 2026-09).
- `jwt expired` errors from `GET /api/auth/user` flood the error log. This is expected when a session is over 24h old; it's noise, not a bug.

## Environment

`.env` keys:
- Database and server: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `PORT`, `JWT_SECRET`
- LINE: `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ID`, `LINE_GROUP_ID`, and optionally `LINE_NOTIFY_USERS` or `LINE_ADMIN_USER_ID`
- Present but unused: `BANK_ACCOUNT`, `BANK_NAME`
