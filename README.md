# Vane-MU 🔍

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/ItzCrazyKns/Vane/blob/master/LICENSE)

**Vane-MU** is the multi-user fork of [Vane](https://github.com/ItzCrazyKns/Vane), a privacy-focused AI answering engine. Vane-MU extends Vane with built-in user authentication, role-based access control, and a dedicated admin panel — allowing you to run a private AI search platform for multiple users.

> 📖 **Architecture** — Want to know how Vane works under the hood? See the [Original Vane Architecture Docs](https://github.com/ItzCrazyKns/Vane/tree/master/docs/architecture/README.md).

## ✨ Features

All the original Vane features, plus:

- **🔐 User Authentication** — Local username/password accounts. No third-party SSO required.
- **👤 User Management** — Admins can create, reset passwords, and delete user accounts.
- **🛡️ Role-Based Access Control** — Two roles: `admin` and `user`. Admin-only settings (Models, Search) are hidden from regular users.
- **⚙️ Admin Panel** — A dedicated `/admin` dashboard for managing users and configuring system-wide settings.
- **📊 Per-User History** — Search history is scoped to each user account.
- **🚪 Logout Button** — Available in the sidebar for all users.

## 🏗️ User Roles

| Role | Access |
|------|--------|
| `admin` | Full access: Settings (Preferences, Personalization, Models, Search), Admin Panel, User Management |
| `user` | Settings: Preferences and Personalization only. No access to Models, Search, or Admin Panel. |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- [SearXNG](https://github.com/searxng/searxng) instance (or use the bundled instance via Docker)
- One or more AI provider API keys (OpenAI, Claude, Gemini, Groq, Ollama, etc.)

### Option 1 — Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/stanleyau-xx/Vane-MU.git
cd Vane-MU

# Build with Docker
docker build -t vane-mu .
docker run -d -p 3000:3000 -v vane-mu-data:/home/vane/data --name vane-mu vane-mu
```

Open http://localhost:3000 and complete the first-time setup (this creates the initial admin account).

### Option 2 — Docker Compose

```bash
git clone https://github.com/stanleyau-xx/Vane-MU.git
cd Vane-MU
docker-compose up -d
```

### Option 3 — Local Development

```bash
git clone https://github.com/stanleyau-xx/Vane-MU.git
cd Vane-MU
npm install
npm run dev
```

Then open http://localhost:3000 and complete the setup wizard to create your admin account.

## 🔑 Default Admin Credentials (First Setup)

On first run, the setup wizard prompts you to create an admin account. This is the only time an account can be created without authentication — after that, only admins can add users.

## ⚙️ Admin Panel

Access the admin panel by clicking the **gear icon → Admin Panel** in the sidebar (admin users only).

### User Management

- View all registered users (username, role, creation date)
- Create new user accounts
- Reset a user's password
- Delete user accounts

### System Settings

- **Models** — Configure AI model providers and endpoints (admin only)
- **Search** — Configure SearXNG and search behaviour (admin only)

## 🌐 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SEARXNG_API_URL` | `http://localhost:8080` | SearXNG instance URL |
| `DATABASE_URL` | `file:./data/vane.db` | SQLite database path |
| `SESSION_SECRET` | _(required)_ | Secret for signing session tokens |
| `NEXT_PUBLIC_VERSION` | `1.12.2` | Version shown in Settings footer |

## 🔒 Security Notes

- Passwords are hashed with **bcryptjs**
- Sessions are managed via **HTTP-only cookies** using **jose** (JWT)
- Admin API routes are protected by server-side `requireAdmin` middleware
- Users cannot access or configure AI model providers or search settings
- **JWT_SECRET enforcement**: In production (`NODE_ENV=production`), the app **refuses to start** without a valid `JWT_SECRET` environment variable — there is no fallback. In development, a placeholder key is used with a console warning. To set in production:
  ```bash
  docker run -e JWT_SECRET=your-secret-here -e NODE_ENV=production ...
  ```

## 📁 Project Structure

```
src/
├── app/
│   ├── admin/              # Admin panel page
│   └── api/
│       ├── admin/          # Admin-only API routes (user management, settings)
│       ├── auth/           # Authentication (login, logout, session)
│       └── config/         # Public config API
├── components/
│   ├── admin/              # Admin panel UI components
│   └── Settings/           # Settings dialog and sections
├── lib/
│   ├── hooks/useAuth.tsx   # Authentication context & hooks
│   └── middleware/         # Auth middleware (requireAdmin, etc.)
drizzle/                    # Database migrations
```

## 📝 User Management API

Admin-only endpoints under `/api/admin/`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | List all users |
| `POST` | `/api/admin/users` | Create a new user |
| `PUT` | `/api/admin/users/reset` | Reset a user's password |
| `DELETE` | `/api/admin/users` | Delete a user |
| `GET` | `/api/admin/settings` | Get admin-only settings |
| `PUT` | `/api/admin/settings` | Update admin settings |

## 🔄 Migrating from Single-User Vane

Vane-MU uses a SQLite database (`data/vane.db`) managed by Drizzle ORM. On first launch, run migrations:

```bash
npm run db:migrate
```

Or let the Docker entrypoint handle it automatically.

## 📄 License

MIT — same as the original [Vane](https://github.com/ItzCrazyKns/Vane) project.

## 🙏 Acknowledgements

Vane-MU is built on the excellent work of the [Vane](https://github.com/ItzCrazyKns/Vane) project by ItzCrazyKns. This fork adds multi-user functionality while preserving the privacy-first, self-hosted philosophy of the original.
