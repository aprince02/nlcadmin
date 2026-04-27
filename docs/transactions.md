# Recording income & expenses

Transactions are the lines on your bank statement: rent, utility bills, salaries, donations deposited, grants received. ProBooks tracks them so you can produce annual accounts and so fund balances stay accurate.

## Two sources

Transactions can come from two places:

1. **Bank import** — automatically pulled from your linked bank account every six hours. These are the bulk of your transactions.
2. **Manual entry** — for cash, cheques you haven't deposited, or anything that didn't pass through your bank.

Both end up in the same place — *Bank → Transactions by year*.

## Transaction types

Every transaction has a *type*. Types are how you separate your accounts: General, Building, Ladies Fund, Salaries, Utilities, etc.

You define the list under *Admin → Add Transaction Type*. Pick clear, short names. Stick to a small set; ten or fifteen types is plenty for most charities. Avoid overlap (don't have both "Bills" and "Utilities").

## Why types matter for fund balances

The dashboard shows a [Ladies Fund balance](/docs/fund-balances) calculated as:

> opening balance + sum of bank transactions tagged "Ladies Fund" since the opening date

So if a Ladies Fund deposit comes in but you forget to tag it with the type "Ladies Fund", the dashboard balance will be wrong. **Tagging is what makes the balance accurate.**

Tip: most banks include "ladies" or similar in the transaction reference if your members write that on their offerings. ProBooks will try to auto-tag based on the description, but you should always glance at imported transactions to confirm.

## Editing a transaction

1. Open *Bank → Transactions by year* and pick a year.
2. Find the transaction.
3. Click the row to expand it, then *Edit*.
4. You can change the date, description, type, amount, and notes.

Editing a bank-imported transaction's *date* or *amount* is allowed but rarely a good idea — those came from the bank. Stick to changing the type, description, or notes.

## Why two amount columns

Each transaction has a **Paid In** and a **Paid Out** column. Only one will have a value:

- **Paid In** = money coming into the account (donations, grants, transfers)
- **Paid Out** = money leaving (rent, salaries, bills)

This matches the way bank statements are structured and makes monthly summaries clean.

## Yearly transactions view

*Bank → 2026 / 2025 / etc.* shows every transaction for that year, paginated. You can filter by type or search by description.

This is the place to check at year-end before producing accounts: scroll through, fix any mis-tagged rows, and make sure the totals add up.

## Manual transactions

For cash that hasn't been banked, click *Add Transaction* on the year view and fill in date, type, description, amount and whether it's paid-in or paid-out. Use the *Notes* field to record anything unusual.

## Unmatched donations

Sometimes a donation has been recorded in ProBooks but the matching bank deposit hasn't arrived yet (e.g. a cheque waiting to clear). Those donations show in the *Unclaimed Donations* count on the admin console — they'll match up automatically once the bank deposit comes in and is tagged.
