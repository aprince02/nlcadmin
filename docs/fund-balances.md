# Fund balances on the Dashboard

Many charities operate restricted funds — money that can only be spent on a specific purpose. The Ladies Fund is the most common one we see. ProBooks tracks the running balance of that fund on the Dashboard so you can answer "how much is in the Ladies Fund right now?" instantly.

## The challenge

When you start using ProBooks, the Ladies Fund probably already has money in it from years of past giving and spending. ProBooks doesn't know about that history — it only knows what you record from this point forward.

The solution is an **opening balance**: you tell ProBooks "on this date, the fund had this much in it", and from there the system adds and subtracts based on transactions.

## How the balance is calculated

Once an opening balance is set, the dashboard shows:

> **Current balance** = opening balance + (income tagged Ladies Fund since opening date) − (expenses tagged Ladies Fund since opening date)

The key word is **tagged**. Only transactions whose *type* is "Ladies Fund" count. A donation marked Ladies Fund doesn't directly affect this number — it's the bank deposit (with type Ladies Fund) that does.

## Setting the opening balance

You need Admin permissions.

1. Go to the Dashboard.
2. Find the **Ladies Fund** card.
3. Click *Set Opening Balance* (first time) or *Edit Opening* (to change it).
4. Enter the **opening date** — the date you want ProBooks to start counting from. Usually the day before your first ProBooks transaction.
5. Enter the **opening amount** — what was in the fund on that date.
6. Save.

The card immediately re-renders with current balance, opening, income since, and expenses since.

## Common pitfalls

### "Income since" and "Expenses since" are zero

This usually means transactions exist but aren't tagged with type "Ladies Fund". Open *Bank → Transactions by year*, find the relevant rows, and edit each one to set the type. The balance updates next time you reload the dashboard.

ProBooks matches the type case-insensitively and trims spaces, so "ladies fund", "Ladies Fund", and "LADIES FUND" all count.

### Balance is double what I expected

You may have set the opening balance to today, but already have past transactions tagged Ladies Fund — those still get added to the opening. Either:

- Move the opening date back to before your first tagged transaction, or
- Untag transactions before the opening date so they don't double-count.

### Balance is half what I expected

Opposite problem — opening date is too far back, but you've also recorded an opening balance that already includes some of the post-date income. Pick one source of truth: either the opening figure represents the fund *as of* the opening date and all later transactions add to it, or the opening date is the day you started ProBooks and earlier history isn't tagged.

The cleanest pattern:

- Pick the date you started using ProBooks.
- Look at your last paper/spreadsheet records for what the fund balance was on that date.
- Enter that as the opening.
- From there, tag every Ladies Fund deposit and expense in ProBooks consistently.

## Adding more funds

We currently only show Ladies Fund on the dashboard because that's what we kept being asked about. If you have other restricted funds (Building, Missions, etc.) that you'd like balances for, contact support — adding more is a five-minute job.

## Why donations don't directly affect the balance

It's tempting to expect donations marked "Ladies Fund" to push the balance up. They don't, because:

- A donation is a *promise* of money. Until it's actually deposited at the bank, you don't have it.
- A bank transaction is the *actual* money movement. That's the source of truth.

If you've recorded a Ladies Fund donation but no matching deposit yet, the balance won't move — and that's correct. Once the deposit comes in (and is tagged Ladies Fund), the balance updates.
