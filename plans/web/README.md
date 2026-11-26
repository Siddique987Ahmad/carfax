# web — public website

Code: `apps/web`. Stack: Next.js (App Router) + Tailwind CSS, hosted on Vercel, rendered on the server for search engines and slow phones. Languages: English (default) and Urdu on the buyer's path.

The public site starts once the garage pilot is running (product and tech docs): reports are worthless until garages log jobs. API endpoints are owned by the api/ plans, and PDF rendering by workers/07. These plans name them by topic.

Each plan is a thin slice that can be built, tested and shipped on its own. Build them one at a time, in this order. Statuses: `planned` → `in progress` → `done`.

## Pilot (tech doc: weeks 9–14; free reports to test demand)
| # | Plan | Status |
|---|---|---|
| 01 | [Next.js skeleton and deploy](01-skeleton-and-deploy.md) | planned |
| 02 | [English and Urdu](02-languages.md) | planned |
| 03 | [Landing page and SEO basics](03-landing-and-seo.md) | planned |
| 04 | [Terms, privacy and data notice](04-legal-pages.md) | planned |
| 05 | [Garage sign-up page](05-garage-signup.md) | planned |
| 06 | [Search box and number normalisation](06-search.md) | planned |
| 07 | [Free preview](07-free-preview.md) | planned |
| 08 | [Buyer login by phone OTP](08-buyer-login.md) | planned |
| 09 | [Report page](09-report-page.md) | planned |
| 10 | [PDF download and QR verification](10-pdf-and-verification.md) | planned |
| 11 | [Analytics and error tracking](11-analytics-and-errors.md) | planned |
| 12 | [Performance on low-end phones](12-performance-low-end-phones.md) | planned |

## Reports launch (once a city passes the coverage gate)
| # | Plan | Status |
|---|---|---|
| 13 | [Checkout and the per-city coverage gate](13-checkout-and-coverage-gate.md) | planned |
| 14 | [My reports](14-my-reports.md) | planned |
| 15 | [Dealer login and dashboard](15-dealer-dashboard.md) | planned |
| 16 | [Owner claims a car and sees its record](16-owner-claim.md) | planned |
| 17 | [Owner reports a wrong entry](17-owner-disputes.md) | planned |

## Expand (year 2)
| # | Plan | Status |
|---|---|---|
| 18 | [Verified-history badge for dealer listings](18-dealer-verified-badge.md) | planned |

## Needs from other folders
These web plans rely on work that isn't in other plans yet. Add it when those plans are written.

- **api:**
  - Public search returns a count range, not an exact count, and logs hit or miss (web/06, web/07)
  - Garage application endpoint (web/05)
  - "My orders" endpoint (web/14)
  - Owner claim with phone match or chassis match (web/16, api/20)
  - Badge records (web/18)
- **workers/06 + api/17:** reports are stored as frozen copies with a verification code (web/09, web/10).
- **db:**
  - Survey answers (web/09)
  - Owner claims with states (web/16)
  - Dealer badges (web/18)
- **shared:** `normaliseChassisNo` next to `normaliseRegNo` (web/06), plus dispute and garage-application Zod schemas (web/05, web/17).
- **workers/07:** renders PDFs from the web print route `/reports/[orderId]/print` (web/10).
