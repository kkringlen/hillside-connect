# Supabase and GitHub Pages deployment

Supabase is the backend for this release. GitHub Pages is the frontend host. The app is not uploaded to Supabase as a website; instead, the browser app connects securely to Supabase using the publishable key and the signed-in user's JWT. Database authorization is enforced by Row Level Security.

## 1. Prepare a Supabase project

Using a new Supabase project is safest for the first deployment because the supplied migration creates the complete application schema.

In the Supabase dashboard:

1. Open the project.
2. Open **SQL Editor**.
3. Create a new query.
4. Copy the complete contents of `supabase/migrations/001_initial_schema.sql`.
5. Run it once.
6. Confirm that the query ends successfully with `COMMIT` and no errors.

The migration creates:

- Auth-linked public and private member profiles
- Teams and approved team assignments
- Announcements and events
- Prayer requests and moderation status
- Direct conversations and messages
- Team messages, discussions, and comments
- Activity history
- Role-aware database helper functions and RPCs
- Row Level Security policies and limited grants
- Realtime publications
- Seeded ministry teams

Do not repeatedly run the migration against a partially configured production database. Future changes should be added as new migration files.

## 2. Configure authentication

### Email

Under **Authentication → Sign In / Providers**:

1. Keep Email enabled.
2. Keep email confirmation enabled for production.
3. Customize the confirmation and password-reset email templates with the Hillside name if desired.

### Phone

Phone signup and login require an SMS provider.

1. Enable Phone under **Authentication → Sign In / Providers**.
2. Configure an SMS provider supported by Supabase, such as Twilio, MessageBird, or Vonage.
3. Keep phone confirmation enabled.
4. Test SMS delivery before inviting members.
5. Review SMS rate limits and provider charges.

This app supports phone-and-password authentication and presents the SMS verification form needed after phone signup. Because mobile numbers can be recycled, enabling MFA for accounts with elevated access is recommended.

### Bot and abuse protection

Before broad public use:

1. Open **Authentication → Bot and Abuse Protection**.
2. Configure CAPTCHA.
3. Review Authentication rate limits.
4. Avoid reducing limits until normal traffic patterns are understood.

## 3. Configure the frontend

Open `site/config.js` and replace the placeholders:

```javascript
window.HILLSIDE_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_YOUR_KEY',
  SITE_NAME: 'Hillside Connect',
  DEFAULT_COUNTRY_CODE: '+1',
  ENABLE_DEMO_MODE: false
};
```

Find these values in the Supabase project’s API settings.

Use only the **publishable** key. The publishable key is designed for browser applications when RLS is enabled. Never use a secret or `service_role` key in this file.

## 4. Test locally before publishing

Run:

```bash
python -m http.server 8080 --directory site
```

Open:

```text
http://localhost:8080
```

For local email confirmation and password-reset testing, add this temporary allowed redirect in Supabase Auth URL Configuration:

```text
http://localhost:8080/**
```

Do not open `index.html` directly with a `file://` address. Authentication storage and browser security work correctly through an HTTP server.

## 5. Create the GitHub repository

1. Create a new GitHub repository, such as `hillside-connect`.
2. Upload all files and folders from this production package.
3. Ensure the default branch is named `main`.
4. Commit the completed `site/config.js`.
5. Open **Settings → Pages**.
6. Under **Build and deployment**, select **GitHub Actions** as the source.
7. Push to `main` or manually run **Deploy Hillside Connect** under the Actions tab.

The supplied workflow publishes only the `site/` directory. Database migration files, tests, and internal documentation are not part of the public website artifact.

Your address will normally be:

```text
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/
```

## 6. Configure Supabase redirect URLs

After GitHub Pages provides the final URL, open **Authentication → URL Configuration** in Supabase.

Set **Site URL** to the exact production address, including the repository path and trailing slash when applicable:

```text
https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY_NAME/
```

Add the same exact address to **Redirect URLs**. Keep `http://localhost:8080/**` only while local testing is needed.

Exact production URLs are safer than broad wildcard patterns.

## 7. Create the first administrator

1. Open the deployed app.
2. Create an account using the email address that should own the app.
3. Confirm the email.
4. In Supabase SQL Editor, open `supabase/bootstrap-admin.sql`.
5. Replace both occurrences of `YOUR_EMAIL@example.com` with the registered email address.
6. Run the script.
7. Sign out and back in.
8. Confirm the management diamond appears in the upper-right corner and opens **Administration**.

All later guest-to-member approvals, leader promotions, deactivations, and team assignments can be completed through the app.

## 8. Conduct the live acceptance test

Use at least four separate browser profiles or devices:

1. **Administrator:** verify all content, approvals, roles, contact data, and team assignments.
2. **Leader:** verify only assigned team-management tools and leadership prayer moderation.
3. **Member:** verify member-only content, assigned teams, directory privacy, discussions, and direct messages.
4. **Pending guest:** verify public information and private prayer submission only; Inbox, Teams, member directory, and prayer wall must remain unavailable.

Also verify:

- Email confirmation and password reset return to the correct GitHub Pages URL.
- Phone signup sends an SMS and accepts its code.
- A second device sees newly created shared content.
- Realtime updates appear without a manual refresh.
- Deactivated accounts cannot continue using the application.
- A user who hides phone/email data does not expose it to standard members.
- An administrator and a leader of that member’s team can still see the authorized contact information.

## 9. Backups and ongoing changes

- Enable or verify database backups appropriate to the Supabase plan.
- Keep every database change in a new file under `supabase/migrations/`.
- Test schema changes in a separate project before production.
- Do not edit production tables manually unless the change is documented.
- Review inactive accounts, administrator access, team assignments, and SMS usage periodically.
