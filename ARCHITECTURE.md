# Leon Client Portal MVP

This project has been refactored from a single secure quote page into a small client portal app that can support multiple clients, multiple projects, and a separate admin workflow.

## Product Surfaces

- Client access
  - OTP login by phone
  - Project list after verification
  - Project detail, proposal, assets, and contract views
- Admin access
  - Separate admin route after login
  - Client, project, whitelist, and access log management

## Current Folder Structure

```text
api/
  _lib/
    auth.js
    supabase.js
  admin-dashboard.js
  approve-quote.js
  get-logs.js
  log-access.js
  portal-data.js
  portal-session.js
  send-otp.js
  sign-contract.js
  upsert-client.js
  upsert-project.js
  upsert-whitelist.js
  verify-otp.js

components/
  shell.js

lib/
  api.js
  config.js
  format.js
  main.js
  state.js

pages/
  admin-dashboard.js
  contract-view.js
  login.js
  portal-home.js
  project-detail.js
  quote-view.js

styles/
  portal.css
```

## Route Model

- `/`
  - portal entry, login, and authenticated shell
- `#/`
  - client portal home
- `#/projects/:projectId`
  - project overview
- `#/projects/:projectId/quote`
  - quote and approval view
- `#/projects/:projectId/contract`
  - contract and signature flow
- `#/admin`
  - admin dashboard

## Data Model

The schema now supports:

- `clients`
- `client_phones`
- `projects`
- `quotes`
- `quote_items`
- `project_assets`
- `contracts`
- `contract_signatures`
- `whitelists`
- `otp_codes`
- `sessions`
- `access_logs`
- `rate_limits`

## Responsibility Split

### Client-facing

- Phone verification
- Session-backed access
- Project-specific content only
- Quote approval
- Contract signing with stored signature records

### Admin-facing

- Manage clients
- Manage projects and quote payloads
- Manage whitelist access
- Review access activity

## Reused From The Prototype

- OTP send and verify flow
- Phone whitelist protection
- Session handling
- Rate limiting
- Access logging
- Supabase plus Vercel deployment model
- Premium restrained visual direction

## Next Logical Extensions

- Asset upload and contract version management inside admin
- Richer project status history
- Signed document export/archive generation
- Stronger admin editing for quote items and assets
- Optional server-side rendering or framework migration if the portal grows further
