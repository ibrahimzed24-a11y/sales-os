# ADR-006: Auth required on /api/email/send

## Status
Accepted

## Context
`POST /api/email/send` sends email through Resend using `SENDER_EMAIL`. It had no session/auth check — anyone could send email to arbitrary recipients, creating an open spam/phishing relay.

## Decision
Require a valid session cookie on `/api/email/send`. Return 401 without a session. Only the authenticated user can send email.

## Consequences
- Campaigns and any other email-sending flow must be authenticated.
- Closes the open relay.

## Revisit
Add rate limiting per user on email sending to prevent abuse.
