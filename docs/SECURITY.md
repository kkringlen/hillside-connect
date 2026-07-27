# Security notes

## Implemented controls

- Every exposed application table has Row Level Security enabled.
- Browser grants are limited separately for `anon` and `authenticated` roles.
- Role, account-status, membership, and audience checks are enforced in Postgres, not only hidden in the interface.
- Private email and phone data are stored separately from directory-visible profile fields.
- Standard members see contact information only when the owner enables directory visibility.
- Administrators see complete member contact information.
- Leaders see complete contact information only for members of teams they lead.
- Guest accounts begin in `pending` status and cannot access member resources.
- Team data is limited to assigned users; management requires an administrator or an approved team leader.
- Security-definer RPCs used for sensitive workflows are denied to anonymous callers.
- Content modification timestamps are set by database triggers.
- Direct-message membership is checked by RLS before messages can be read or inserted.
- No secret or service-role key is used by the frontend.
- Demo mode is disabled in the production configuration.
- A Content Security Policy limits scripts, connections, images, and forms.

## Operational requirements

- Do not commit a Supabase secret key, `service_role` key, database password, Twilio token, or other provider secret.
- Enable CAPTCHA and review Auth rate limits before public promotion.
- Require MFA for administrators and strongly consider it for leaders.
- Give administrator access sparingly.
- Use unique named administrator accounts rather than shared credentials.
- Review the activity log after access changes.
- Apply future schema changes through versioned migrations.
- Keep the Supabase project and SMS provider accounts protected with MFA.
- Publish a privacy notice explaining what member information is collected, who can see it, and how members can request correction or deletion.

## Direct-message moderation

This release does not give administrators routine access to private message bodies. Database administrators could access data through the Supabase dashboard, so that capability should be limited and governed by church policy. A future reporting workflow can expose only conversations that users intentionally report.

## Youth-safety consideration

Before youth accounts are issued, define an adult-to-minor communications policy. A future release should support guardian linkage, two-adult conversations, or mandatory inclusion of another approved leader when required by church policy.
