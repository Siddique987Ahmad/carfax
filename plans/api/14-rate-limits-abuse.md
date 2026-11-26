# api/14 — Rate limits and abuse protection

Status: planned · Phase: pilot · Depends on: api/03

## Goal
Bots can't burn money on OTP messages, scrape the car database through search, or overload the API, before the public website goes live.

## Decisions
- **@nestjs/throttler with a Redis store**, so limits hold across several API instances.
- **Limits by IP, by phone and by account**, set per route group in one config file:

| Route group | Limit (starting point) |
|---|---|
| OTP request | 3 per phone per 15 min, 10 per IP per hour |
| OTP verify | 5 tries per code (api/03) |
| Public search | 20 per IP per hour; a human check after 5 |
| Free reports | 5 per account per day |
| Garage sync | 60 per device per hour |

- **Human check: Cloudflare Turnstile**, free and invisible to most people, required on OTP request from the website and on search after a few tries.
- **Security headers and CORS:** helmet; CORS allowlist of our own domains only; request body limit 1 MB (photos never go through the API).
- **Blocked IPs and phones** list in Redis, editable by ops later.

## Scope
**In:**
- Throttler setup with Redis, per-route limits, Turnstile verification helper
- helmet, CORS allowlist, body size limits
- 429 responses in the standard error format with `retryAfter`

**Out (later items):**
- Admin screen for blocked lists (add to admin later if needed)

## Steps
1. Throttler module with a Redis store and named limits.
2. Turnstile guard used by OTP request (web) and search.
3. helmet, CORS, body limits in the app bootstrap.
4. Tests: limits trigger at the right count and reset; requests from the mobile app are not asked for Turnstile.

## Files and folders touched
- `apps/api/src/common/throttle/*`, `apps/api/src/main.ts`

## Done when
- [ ] The 4th OTP request for one phone within 15 minutes is refused, and no message is sent
- [ ] Search without a valid Turnstile token after 5 tries is refused
- [ ] Limits still apply with two API instances running

## Open questions
- Limits are guesses; review them after a month of real traffic.
