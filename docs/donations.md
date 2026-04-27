# Recording donations

A donation is the most common thing you'll record in ProBooks. The flow is designed to be quick — about 15 seconds per donation once you're used to it.

## The Add Donation flow

From the dashboard or any page, click *Add Donation*. You'll see four steps.

### Step 1 — Select the giver

Type the first letters of the member's name. The list filters as you type. If they exist, click their row.

If they're a new giver, click *Add new giver* — you'll be taken to a quick form to add the member, then bounced back here automatically.

### Step 2 — Enter the details

- **Amount** (in pounds, e.g. `25.00`)
- **Date** (defaults to today)
- **Fund** — pick from your charity's list, or if it's a new fund, add it under *Admin → Add Donation Type* first
- **Method** — Cash, Cheque, Standing Order, Card, etc. Free text, but stick to a small set so reports stay clean.
- **Gift Aid status** — *Eligible* if the member has a valid Gift Aid declaration; *Not eligible* otherwise.

### Step 3 — (Optional) Attach to a bank transaction

If the donation has cleared into your bank account and you've imported the bank statement, you can match the donation to that transaction. This stops the same money being counted twice.

### Step 4 — Save

That's it. The donation appears on the dashboard, the member's giving history, and (if eligible) the next Gift Aid claim.

## Gift Aid eligibility

Mark a donation as **Eligible** only if:

1. The member has signed a Gift Aid declaration that's still valid.
2. The donation came from the member personally (not from someone else paying on their behalf).
3. The donation isn't a payment for goods or services (e.g. a meal, a ticket).

If you're unsure, mark it *Not eligible*. You can change it later from the member's edit page.

## Editing or deleting a donation

Open the member's giving history (click *View Giving* on their row in Members), find the donation, click *Edit* or *Delete*.

You can't edit or delete a donation that's part of a Gift Aid claim that's already been submitted to HMRC — that would break the audit trail. If you genuinely need to undo a submitted claim, contact support.

## Bulk import

If you have a spreadsheet of historical donations, contact support — we can import them in one go rather than you typing them in. We'll need:

- Member name (or member ID)
- Date
- Amount
- Fund
- Gift Aid eligibility

## Why the fund matters

The fund a donation is recorded against does three things:

1. Powers the *Donations by Fund* doughnut chart on the dashboard.
2. Filters the *Export Donations* PDF and CSV.
3. Has nothing directly to do with [fund balances](/docs/fund-balances) — those are calculated from bank transactions, not donations.

That last point catches people out. The Ladies Fund balance on the dashboard isn't "all donations marked Ladies Fund" — it's "all bank transactions tagged Ladies Fund". The two normally line up, but only if your bank deposits get tagged with the right transaction type.

## Donation receipt emails

When you save a donation, ProBooks emails the member a receipt — *if* they have an email address and aren't marked *Do not email*. The receipt includes the amount, fund, date and a short thank-you.

You can disable receipts globally per member with the *Do not email* flag (see [Managing members](/docs/members)).
