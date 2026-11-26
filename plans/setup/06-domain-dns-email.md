# setup/06 — Domain, DNS and email

Status: planned · Phase: pre-pilot · Depends on: setup/02 (domain bought)

## Goal
Each app has its address, the team has business email, and the domain is set up so admin login cookies work and messages aren't marked as spam.

## Decisions
- **Cloudflare for DNS** (free plan), since R2 and Cloudflare Pages are already planned.
- **One parent domain for everything,** so the admin login cookie can be `SameSite=Lax` (admin/06):

| Address | App |
|---|---|
| `<domain>.pk`, `www.` | Public site (Vercel) |
| `api.<domain>.pk` | API |
| `admin.<domain>.pk` | Admin panel (Cloudflare Pages) |
| `staging.`, `api.staging.`, `admin.staging.` | Staging copies |

- **Business email on the domain** (Google Workspace or Zoho), with SPF, DKIM and DMARC. Meta and payment providers check it.
- **No transactional email in the MVP.** Customers get WhatsApp or SMS only.

## Scope
**In:**
- Move DNS to Cloudflare; create the records above (pointing at staging first)
- Team mailboxes and shared addresses (`support@`, `billing@`)
- SPF, DKIM and DMARC records
- HTTPS on every address

**Out (later items):**
- Hosting setup itself (setup/08, setup/09)

## Steps
1. Point the domain's name servers to Cloudflare.
2. Set up the email provider and its DNS records.
3. Create the subdomain records once each host exists.
4. Check HTTPS and email authentication with an online checker.

## Files and folders touched
- `infra/dns.md` (record list; no secrets)

## Done when
- [ ] Every address above loads over HTTPS
- [ ] Mail from the domain passes SPF, DKIM and DMARC
- [ ] A login cookie set by `api.` is sent from `admin.` in the browser

## Open questions
- Brand and domain name: the product doc says the final brand isn't decided. A placeholder domain works for staging, but Meta verification should use the final one.
