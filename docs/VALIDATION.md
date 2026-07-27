# Validation record

Release: **1.0.0**  
Validation date: **July 25, 2026**

## Completed automated and static checks

- JavaScript syntax validation completed with Node.js for every runtime JavaScript file.
- Python syntax validation completed for the browser smoke test.
- SQL migration structural checks passed.
- All 14 application tables are explicitly covered by `ENABLE ROW LEVEL SECURITY`.
- Required role, status, audience, prayer, and team-role enumerations are present.
- Security-definer administrative RPCs are denied to anonymous access.
- Supabase browser client is pinned to version `2.110.8`.
- GitHub Pages publication is limited to the `site/` directory.
- Production demo mode is disabled.

## Browser smoke tests passed

The interface was executed in Chromium at mobile and desktop sizes with isolated production-style demo data. Six scenarios passed:

1. Public user: public navigation, calendar, and church information; no Inbox or Teams.
2. Administrator: five-tab navigation, management access, guest approval, public event creation, and persistence in the interface.
3. Leader: assigned team access, discussion detail, comment creation, and leader tools.
4. Member: assigned-team filtering, no management access, eligible direct-message recipient filtering, and new conversation creation.
5. Pending guest: approval notice, no Inbox or Teams, and private prayer submission.
6. Desktop administrator: responsive application shell at 1440×1000.

Screenshots of the tested states are included under `tests/`.

## Defects found and corrected during validation

- Auth-state changes originally rendered before member and administration data refreshed. The auth listener now refreshes role-specific data before rendering.
- Discussion detail was not selected from the team view. The selected discussion now renders correctly inside Teams.
- Audience/team selector visibility responded to clicks rather than select changes. It now uses the correct change event.
- Anonymous prayer insertion requested a returned row that anonymous users were not permitted to select. Public submission now inserts without requesting restricted data.
- Edited content could overwrite its original author. Existing author IDs are now preserved.
- Phone signup lacked the required SMS-code verification form. SMS signup verification is now implemented.
- Directory-derived contact fields could be changed through a crafted profile update. A database trigger now rejects direct changes by non-administrators.
- Modification timestamps were not consistently updated. Database triggers now maintain them.
- Production demo access was query-string accessible. It now requires an explicit disabled-by-default configuration flag.

## Validation boundary

A live Supabase end-to-end test cannot be completed without the project URL, publishable key, configured email delivery, and configured SMS provider. The supplied code, policies, migration, and browser workflows have been validated locally. Complete the live acceptance procedure in `DEPLOYMENT.md` before inviting real members.
