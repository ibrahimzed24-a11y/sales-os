# ADR-007: Rate limit auth routes

## Status
Accepted

## Context
Signin, signup, and register endpoints had no rate limiting. The in-memory rate limiter in `src/lib/server.ts` was dead code (nothing imported it). Credential stuffing and email enumeration ("Email already registered") were possible.

## Decision
Add rate limiting to `/api/auth/session` (signin/signup) and `/api/auth/register`. Use the existing in-memory limiter pattern (120 requests/minute per IP) or a Redis-backed limiter for multi-instance deploys.

## Consequences
- Slows credential stuffing and enumeration.
- In-memory limiter resets on server restart; not shared across instances.

## Revisit
Replace with Redis-backed rate limiting for multi-instance Vercel/Node deploys.
