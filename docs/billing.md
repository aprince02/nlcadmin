# Subscription & invoices

ProBooks is a paid service. We use Stripe for billing, which means you can manage your subscription, update your card, and download invoices yourself.

## Plans

- **Monthly — £30/month**, billed every month.
- **Yearly — £300/year**, billed once a year. **Saves £60** compared to monthly.

Both plans include identical features. The yearly plan is for charities who prefer one annual transaction over twelve.

## What's included

- Unlimited members, donations, transactions
- Unlimited Gift Aid CSV exports (free, self-service filing)
- Bank connection (Open Banking)
- All PDF and CSV exports
- Email donor statements
- Member self-update flow
- Email support

Optional, paid separately: **Gift Aid filing service** (1% of receivable, £25 floor, £200 cap). See [Claiming Gift Aid](/docs/giftaid).

## Choosing or changing your plan

Go to *Admin → Billing → Subscription & Invoices*.

- **No subscription yet** — pick Monthly or Yearly and click *Subscribe*. You'll be sent to Stripe Checkout to enter your card details.
- **Already subscribed** — click *Manage Billing* to open the Stripe Customer Portal, where you can switch plans, update your card, view invoices, or cancel.

Switching from Monthly to Yearly mid-period proportionately credits your remaining monthly time toward the yearly bill. Stripe handles the maths.

## What happens if a payment fails

Card declined, expired, frozen — these things happen. Here's the timeline:

1. **Day of failure**: Stripe attempts to charge. If it fails, your subscription enters *past_due* state and ProBooks emails every admin on your account.
2. **Daily reminders**: ProBooks emails admins each morning until billing is fixed.
3. **Write-gate**: While your account is past due, ProBooks **blocks any action that creates or modifies data** — adding donations, editing members, running Gift Aid claims. You can still view and export. This is to protect your data and avoid surprise lock-outs after a long gap.
4. **Resolution**: As soon as you update your card and the payment goes through, write access is restored automatically.

To fix it: *Admin → Billing → Manage Billing* → update card → done.

## Invoices

Every successful payment generates an invoice. Find them in the Stripe Customer Portal: *Admin → Billing → Manage Billing* → scroll to *Billing history*.

Invoices include your charity name and address (so they're acceptable as expense documents) plus the line item, VAT (n/a — we're not VAT-registered) and total.

## Cancelling

In the Stripe Customer Portal, click *Cancel plan*. Your subscription stays active until the end of the current billing period — you don't get a refund for unused time, but you don't lose access until the period ends.

After the period ends:

- Your data **is not deleted**. We keep it for 90 days.
- You can re-subscribe within 90 days and pick up exactly where you left off.
- After 90 days, we contact you about archival or deletion.

## Why we charge

ProBooks runs on real infrastructure: a managed Postgres database, transactional email delivery, Open Banking access, Stripe processing fees, hosting. The £30/month covers our hosting bill and our ongoing development time.

We're a small team. Every paying charity helps us add features that benefit everyone.

## Payment methods

We accept any debit or credit card Stripe supports — which is essentially all major UK cards. We don't currently accept direct debit or bank transfer, but if that's a blocker for your charity, contact support and we'll work something out.

## VAT

ProBooks is not VAT-registered, so invoices don't include VAT. You don't need to do anything special on your side.
