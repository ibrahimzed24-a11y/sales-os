# ADR-002: JWT session auth with required secret

## Status
Accepted

## Context
The app uses a JWT cookie (`sales-os-session`, 30-day expiry) for auth. `auth-utils.ts` had a hardcoded fallback secret `'fallback-secret-change-in-production'` when `JWT_SECRET` was unset, making session forgery trivial in any deployment missing the env var.

## Decision
`JWT_SECRET` is required. `auth-utils.ts` throws at module load if `JWT_SECRET` is missing or equals the fallback value. No fallback secret is ever accepted.

## Consequences
- Deployments without `JWT_SECRET` fail fast at startup instead of silently using a shared known secret.
- All session cookies are signed with a deployment-specific secret.

## Revisit
Consider rotating to NextAuth.js or Better Auth if social OAuth or magic-link auth is added.
