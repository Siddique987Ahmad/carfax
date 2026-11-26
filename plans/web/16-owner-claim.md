# web/16 — Owner claims a car and sees its record

Status: planned · Phase: reports launch · Depends on: web/08, web/09

## Goal
A car owner can see their own car's record for free, which the product doc promises, without letting anyone claim someone else's car.

## Decisions
- **A phone OTP alone doesn't prove ownership.** The tech doc's "claim by registration + OTP" only proves the person owns the phone. So:
  - **Automatic approval** if the phone matches a customer phone recorded for that car by a partner garage. The check runs on the server and reveals nothing.
  - **Otherwise,** the owner enters the **full chassis number** from the registration book, and it must match (api/20).
  - **No document uploads or manual review in the MVP.** Add them only if real owners can't claim with these two methods.
- **What the owner sees** is the same as a report (web/09), free, plus "Report a wrong entry" on each job (web/17).
- **One car can have more than one claim over time.** A new owner's claim ends the old one's access, so a seller can't keep watching a sold car.

## Scope
**In:**
- `/my-car`: claim form (plate or chassis, login), automatic match or upload, claim status
- Owner's car page using the report components
- API: owner claim endpoint (`/owner/claim`, as in the tech doc) with the phone match and chassis match (api/20)

**Out (later items):**
- Dispute form (web/17)

## Steps
1. Agree with the API on the claim states (matched, refused, ended).
2. Build the claim form and status page.
3. Build the chassis-number fallback with a clear message when it doesn't match.
4. Build the owner's car page from the report components.

## Files and folders touched
- `apps/web/src/app/[locale]/my-car/*`, `apps/web/src/components/report/*`

## Done when
- [ ] A phone matching a garage customer for that car is approved at once
- [ ] A claim with neither a phone match nor a chassis match is refused and sees nothing
- [ ] An approved claim by a new owner ends the previous owner's access

## Open questions
- Is a registration book photo enough proof, or should we also ask for the owner's CNIC? A CNIC is very sensitive personal data, so it's better avoided.
