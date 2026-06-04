# UFCL Production Management System (Desktop)

This is a real **Windows desktop app** (Electron) that matches the UI of your HTML prototype, but stores data in **Postgres** (no `localStorage`).

## Setup

1) Install Node.js (LTS), Git, and make sure PostgreSQL is installed and running.
2) Copy `.env.example` to `.env` and update the Postgres connection values if needed.

- macOS / Linux / Git Bash:

```bash
cp .env.example .env
```

- Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3) Run the project setup script:

```bash
npm run setup
```

4) Start the desktop app:

```bash
npm start
```

If you prefer to run the individual steps manually, use:

```bash
npm install
npm run migrate
npm start
```

## Default users

On first migration, the app seeds example users (you can change them later in the Users page):

- `ceo` / `UFCL@1234` (role: `ceo`)
- `operations` / `UFCL@1234` (role: `operations`)
- `sales` / `UFCL@1234` (role: `sales`)
- `finance` / `UFCL@1234` (role: `finance`)
- `logistics` / `UFCL@1234` (role: `logistics`)
- `supervisor` / `UFCL@1234` (role: `supervisor`)
- `storekeeper` / `UFCL@1234` (role: `storekeeper`)

