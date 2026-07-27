# Hillside Connect 1.0.0

Hillside Connect is a mobile-first church communications application backed by Supabase Auth, Postgres, Row Level Security, and Realtime. The frontend is a static website that can be deployed to GitHub Pages. Supabase stores the shared users and church data; it does not host this frontend.

## Included functionality

- Roles: administrator, leader, member, and guest
- Guest accounts that require administrator approval before conversion to active members
- Email/password and phone/password signup and login
- SMS verification for phone signup and phone-number changes
- Public, member, leader, and team-specific visibility
- Public calendar, events, sermons/video links, giving links, church information, and prayer submission
- Member prayer wall with leadership moderation
- Direct-message inbox
- Official team messages separated from collaborative team discussions
- Team membership and team-level leader/member/read-only roles
- Member-directory privacy controls
- Administrator account approval, role, status, and team-assignment controls
- Administrator and leader content-management tools
- Realtime refreshes for announcements, events, prayers, messages, and team activity

## Repository layout

- `site/` — deployable frontend
- `supabase/migrations/001_initial_schema.sql` — complete database schema, functions, grants, policies, team seed data, and Realtime publication setup
- `supabase/bootstrap-admin.sql` — promotes the first registered account to administrator
- `.github/workflows/deploy-pages.yml` — GitHub Pages deployment workflow
- `docs/DEPLOYMENT.md` — exact setup and deployment procedure
- `docs/SECURITY.md` — security and production-hardening notes
- `docs/VALIDATION.md` — completed validation record and remaining live-project acceptance checks
- `tests/` — browser smoke test, structural validation, and validation screenshots

## Begin here

Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) in order. The essential sequence is:

1. Create or choose a Supabase project.
2. Run the supplied SQL migration.
3. Configure email and phone authentication.
4. enter the project URL and **publishable** key in `site/config.js`.
5. Deploy `site/` through the included GitHub Pages workflow.
6. Configure the final GitHub Pages address in Supabase Auth URL Configuration.
7. Register the initial owner account and run `supabase/bootstrap-admin.sql`.
8. Test a second guest account, approval, team assignment, messaging, and privacy.

## Local preview

From the repository root:

```bash
python -m http.server 8080 --directory site
```

Open `http://localhost:8080`.

The production configuration disables demo mode. To conduct isolated UI tests, set `ENABLE_DEMO_MODE: true` in `site/config.js`, open `?demo=1`, and return it to `false` before deployment.

## Critical key rule

Only place the Supabase **publishable key** in `site/config.js`. Never place a secret key or legacy `service_role` key in browser code, GitHub, or GitHub Pages.
