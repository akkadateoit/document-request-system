# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Online document request system for North Bangkok University students (ระบบขอเอกสารออนไลน์). Students register, request official documents (transcripts etc.), pick pickup or mail delivery, upload a payment slip, and track status. Admins process requests, manage users, and view reports. New requests trigger a LINE bot notification to staff.

Stack: Node.js + Express 4, PostgreSQL (`pg`), JWT auth, multer uploads, and a plain HTML/vanilla JS + Bootstrap 5 (CDN) frontend. There is no build step, no bundler, no linter and no test suite.

## Commands

```bash
npm install
npm run dev        # nodemon server.js
npm start          # node server.js
psql -U postgres -d document_request_system -a -f database/schema.sql   # create schema
```

The port comes from `PORT` in `.env` (default 3200).

**This directory is the live production deployment.** It runs under pm2 as `document-request-system` with watch disabled:
- Backend changes (`server.js`, `routes/`, `middleware/`, `services/`) take effect only after `pm2 restart document-request-system`. Logs: `pm2 logs document-request-system`.
- Frontend files in `public/` are served statically, so edits go live right away.
- `public/uploads/` holds real student payment slips (gitignored).

## Architecture

**Server wiring (`server.js`)** creates its own `pg` Pool and multer instance and injects them into route factories: `require('./routes/auth')(pool)`, `require('./routes/documents')(pool, upload)`, and so on. New route modules should follow the same `module.exports = (pool[, upload]) => router` pattern. `database/connection.js` exports a separate pool, but the routes don't use it. Admin/report routes and the LINE service are loaded in `try/catch`, so a require error in them is logged as "not found, skipping" instead of crashing. If admin endpoints return 404, check the startup log.

Mounted prefixes: `/api/auth`, `/api/documents`, `/api/admin`, `/api/reports`, plus `/api/test-line` and `/api/line-config`.

**Auth**: `middleware/auth.js` (`authenticateJWT`) verifies `Authorization: Bearer <token>` and sets `req.user = { id, student_id, role }`. `middleware/admin.js` (`isAdmin`) requires `role === 'admin'`. Tokens expire after 24h. The frontend stores `token`, `userRole`, `userId`, `userName` and `studentId` in `localStorage` and adds the header to each `fetch` by hand.

**Request data model** (`database/schema.sql`):
- `document_requests` is the order header: delivery method (`pickup`/`mail`), `urgent`, `total_price`, `payment_slip_url`, `status`.
- `document_request_items` holds the line items (quantity, price_per_unit, subtotal) for multi-document orders created by `POST /api/documents/request-multiple`. For those orders the header's `document_type_id` is just the first item. `has_multiple_items` in API responses is computed at read time from whether items rows exist, not stored. Older single-document requests (`POST /request`) have no items rows, so queries that read requests must handle both shapes.
- `status_history` is an audit log. Valid statuses are `pending → processing → ready → completed` or `rejected`, enforced in `routes/admin.js` (`PUT /request/:id/status`), which updates the status and inserts history inside one transaction.
- Other schema changes have been applied ad hoc (see `ALTER TABLE ... IF NOT EXISTS`, and a `CREATE TABLE IF NOT EXISTS` inside the request-multiple handler). `manuals/schema.sql` is an older copy that differs from `database/schema.sql`.

**i18n (th / en / zh)** works on both sides:
- Frontend: `public/js/language.js` loads `public/locales/{th,en,zh}.json`, translates elements with `data-i18n="section.key"`, stores the choice in `localStorage.language`, and dispatches an `i18nReady` event. Page scripts that need translations should wait for that event or `window.i18nLoaded`. Add new keys to all three locale files.
- DB: lookup tables have `name_th`/`name_en`/`name_zh` columns, and endpoints pick one with the `?lang=` query param.
- API error messages are hard-coded in Thai.

**Frontend layout**: each HTML page loads `language.js` and `main.js` (shared helpers: `checkAuthStatus`, `logout`, `translateStatus`, `createStatusBadge`, `formatDate`, `formatCurrency`, `showAlert`), then a page-specific script. Student pages are in `public/`, admin pages in `public/admin/`; admin pages also load `admin.js` / `admin-common.js`. Files ending in `.bak`, `.bak.js`, `.save`, `.newrangsit` or `2.html` are stale copies, not used.

**LINE notifications** (`services/lineNotification.js`, `@line/bot-sdk`): `notifyNewDocumentRequest` is called from `routes/documents.js` when a request is created. Recipients come from `LINE_GROUP_ID`, `LINE_ADMIN_USER_ID` or `LINE_NOTIFY_USERS` (comma-separated). Status changes do not send notifications. For setup and finding a group ID, see `manuals/LINE_SETUP.md` and `utils/findGroupId.js`.

## Environment

`.env` keys: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `PORT`, `JWT_SECRET`, `BANK_ACCOUNT`, `BANK_NAME`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ID`, `LINE_GROUP_ID` (and optionally `LINE_ADMIN_USER_ID`, `LINE_NOTIFY_USERS`).
