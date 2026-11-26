# garage-app/13 — Bill and sending it on WhatsApp

Status: planned · Phase: pre-pilot · Depends on: garage-app/12

## Goal
After a job, the customer gets a clean bill on WhatsApp from the garage, which is one of the main reasons owners will use the app.

## Decisions
- **MVP: send from the garage's own WhatsApp using a `wa.me` link** with the bill as pre-filled text. It costs nothing, works without Meta business approval, and the customer sees a number they already know.
- **Later: WhatsApp Business Cloud API** (sent by workers/) for automatic sending and PDF attachments. Meta charges per message, and setup needs business verification. Switch once reminders prove their value.

| | `wa.me` link (MVP) | Cloud API (later) |
|---|---|---|
| Cost | Free | Per-message fee to Meta |
| Setup | None | Business verification, templates |
| Sender | Garage's own number | One company number (or per garage) |
| Automatic | No, one tap per bill | Yes |
| PDF attached | Via share sheet | Yes |

- **The bill text** includes the garage name and phone, date, car, work lines with prices, total, next service due, and one line saying the car's service record (not personal details) may appear in history reports. The product doc requires this notice.
- **"Share PDF"** makes a PDF on the phone (`expo-print`) and opens Android's share sheet, for customers who want a file.

## Scope
**In:**
- Bill preview screen
- Bill text in Urdu or English (the garage's language)
- "Send on WhatsApp" (wa.me with the customer's number) and "Share PDF"
- Mark the bill as sent on the job

**Out (later items):**
- Automatic sending through the Cloud API (workers/)

## Steps
1. Bill text template with translation.
2. Preview screen.
3. wa.me link builder (number in international format, text URL-encoded).
4. PDF with `expo-print` and the share sheet.
5. Save the "sent" state.

## Files and folders touched
- `apps/garage-app/app/(app)/job/[id]/bill.tsx`, `apps/garage-app/src/features/bill/*`

## Done when
- [ ] Tapping "Send" opens WhatsApp in the customer's chat with the bill filled in, in one tap
- [ ] The PDF opens and looks right on another phone
- [ ] Every bill carries the record notice

## Open questions
- Many garages use WhatsApp Business on the shop phone. Check that wa.me opens the Business app when both are installed.
