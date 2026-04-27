# Bank connection (Open Banking)

ProBooks connects directly to your charity's bank account via the UK's Open Banking framework. Once linked, every transaction is pulled in automatically, every six hours.

## How the connection works

Open Banking is a regulated way for software to read (but **not** move) money on your bank account. You authorise the connection via your bank's normal login flow — ProBooks never sees your password.

We use TrueLayer as our Open Banking provider. They're FCA-authorised and are the same provider used by major UK fintechs.

## Connecting your bank

1. Go to *Bank → Bank Connection*.
2. Click *Connect bank*. (Currently we support HSBC. Adding more banks is straightforward — contact support if you need a different bank.)
3. You'll be redirected to your bank's website to log in. Use your normal banking credentials.
4. Approve the consent for ProBooks to read transactions and balances.
5. You'll be sent back to ProBooks. Within a minute the first sync runs and your transactions appear.

## What gets pulled in

- **Account balance** — refreshed on every sync.
- **Transactions** — every credit and debit, with date, amount, description, and a credit/debit flag.

We never see anything else. We can't initiate payments, we can't see other accounts, we can't see any saved payees or beneficiaries.

## How often it syncs

The cron job runs every 6 hours: 00:00, 06:00, 12:00, 18:00 UK time. You can also click *Sync Now* at any time on the Bank Connection page.

## The 90-day re-authentication

By UK regulation, the consent you give to read your account expires after **90 days**. ProBooks will email you a few days before expiry asking you to reconnect — it's a 30-second flow, just the bank login again.

Until you reconnect, the sync log will show *consent_expired* and no new transactions come in. Old transactions remain.

## Why a sync says "consent_expired"

A few reasons it can show up sooner than 90 days:

- **You logged into your bank's app and revoked third-party access.** Some banks let you do this from "Manage trusted apps" — if you do that, ProBooks sees consent as gone immediately.
- **You changed your banking password.** Most banks treat this as a new login and require fresh consent.
- **Your bank rotated something on their side.** Rare but happens.

The fix is always the same: reconnect from *Bank → Bank Connection*.

## Manual CSV import (fallback)

If your bank isn't supported, or if Open Banking is down, you can upload a CSV statement instead. Go to *Admin → Import Transactions* and follow the on-screen format guide. We accept the standard CSV exports from most UK banks.

## Why connecting your bank matters

It's not just convenience. Bank connection enables:

- **Automatic donation reconciliation** — the system can suggest which bank transaction matches which donation.
- **Accurate fund balances** — fund balances on the dashboard depend on tagged bank transactions, not donation records. Without bank data, balances are estimates.
- **Real-time current balance** — useful at month-end when you're checking what's actually in the account.

## Security

- The access tokens that let ProBooks read your account are **encrypted at rest** with AES-256 in our database. Even a database leak wouldn't expose them in plaintext.
- Tokens are scoped read-only.
- You can revoke ProBooks' access at any time from inside your banking app, and it takes effect immediately.
