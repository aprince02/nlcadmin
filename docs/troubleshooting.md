# Common issues

A short list of things people hit, with the fix for each.

## Bank sync says "consent_expired"

**Cause.** The 90-day Open Banking consent has expired, you've changed your bank password, or the connection was revoked from your banking app.

**Fix.** Go to *Bank → Bank Connection*, click *Reconnect*. The bank login flow runs again; takes about 30 seconds.

If this is happening sooner than 90 days and you haven't touched your banking, contact support — there's a chance two ProBooks instances are sharing the same connection (e.g. test and production).

## Donation receipt didn't reach the member

**Most common cause.** Their email is missing, marked as "do not email", or matches a placeholder pattern (e.g. `admin@mail.com`).

**Fix.** Open their member record. If the email is present and real, look for the *Do not email* checkbox under it — untick it if needed. Save.

If the email is genuinely a placeholder, leave it as is and consider phoning the donor instead. ProBooks deliberately won't send to obvious placeholders to avoid SMTP retries.

## Ladies Fund balance looks wrong

**Most common cause.** Bank transactions aren't tagged with the type "Ladies Fund", so they don't count toward the balance.

**Fix.** Go to *Bank → Transactions by year*, find the relevant transactions, and edit each to set the type. The dashboard balance updates next time you reload.

See [Fund balances](/docs/fund-balances) for the full explanation.

## "No payment method on file" when subscribing

**Cause.** You've started the subscription flow but haven't completed Stripe Checkout, or your card was declined and the previous payment method was removed.

**Fix.** Go to *Admin → Billing → Manage Billing*. The Stripe portal will prompt you to add or update a card.

## Page looks broken / styles haven't updated

**Cause.** Browser caching. We bump our CSS version on every release, but sometimes browsers hold on to the old file.

**Fix.** Hard refresh: **Ctrl+F5** (Windows/Linux) or **Cmd+Shift+R** (Mac). If that still doesn't work, clear the browser's cache for `probooksaccounting.co.uk`.

## Gift Aid CSV has missing rows

**Cause.** Those donations have incomplete data (missing postcode, surname, house number, etc.).

**Fix.** From the Gift Aid modal, click *Review Records*. Yellow rows are the incomplete ones. Type the missing data into the table cells, click Save on each row, and then download the CSV again. The fixed rows will be included.

## I can't find a member

**Possibilities:**

- They're marked **inactive**. Toggle the *Show inactive* filter on the Members page.
- They were typed with a slight name variation (e.g. "Smith" vs "Smyth"). Use the search box with a fragment.
- They were never added. Check the donations list to see if their giving was recorded against another member by mistake.

## I deleted a donation by mistake

Contact support — we keep an audit trail and can usually restore deleted records within a few days.

In the meantime, don't worry about double-entry. Each donation has a unique ID, so re-creating it gives you a different record (and won't appear in the original Gift Aid claim if there was one).

## The "Send Update Request" button does nothing

**Cause.** Either the member has no email address, has *Do not email* set, or has a placeholder email that ProBooks blocks.

**Fix.** Look at the flash message at the top of the page after clicking — it tells you which of these applies. Update the member's email or untick *Do not email* and try again.

## "Error rendering dashboard"

**Cause.** Usually a corrupt date or amount in the transactions table that the dashboard query can't parse. Most often it's `paid_in` or `paid_out` containing whitespace instead of an empty string.

**Fix.** Contact support with the timestamp from the error. We can spot the bad row and fix it for you.

## Can't connect bank — bank not in list

We currently only support HSBC. If you bank elsewhere, please contact support and we'll prioritise adding your bank — we just need to flip a config flag and run a test.

## I see another charity's data

This should be impossible by design — every database query is scoped by your charity ID. If it ever happens, **stop and report it to support immediately** as a security issue.
