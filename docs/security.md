# Security & data protection

Charities handle sensitive personal and financial data. This page explains where your data lives, how it's protected, and what we do not have access to.

## Where your data lives

- **Database**: PostgreSQL hosted on Supabase, in their EU-West region (London / Dublin).
- **Application**: hosted on DigitalOcean's UK / EU infrastructure.
- **Email delivery**: via our SMTP provider, also EU-located.
- **Bank connection**: through TrueLayer (FCA-authorised), tokens encrypted before leaving our servers.
- **Payments**: through Stripe (regulated payment processor); we never store card numbers.

All transit between you and ProBooks is over HTTPS (TLS 1.2+).

## Data isolation between charities

Every record in the database is tagged with a `charity_id`. Every database query is scoped by that ID. There is no UI path or API endpoint that can return data from a charity other than your own — this is enforced at the database query level, not just the page rendering level.

The only exception is the **platform admin** role (the ProBooks team), which can see a list of charities for support purposes. We don't routinely access individual donation or member records and do so only when you ask us to (e.g. to import historical data).

## Bank connection security

When you connect a bank account via Open Banking:

- ProBooks **never sees your banking password**. Authorisation happens on your bank's website.
- The access tokens TrueLayer issues us are **encrypted with AES-256** before being written to the database. Even a database leak wouldn't expose them in plaintext.
- Tokens are scoped **read-only**: ProBooks can read transactions and balances but cannot move money.
- You can revoke ProBooks' access at any time from inside your banking app.

## Password security

User passwords are hashed with bcrypt (10 rounds). We can never see your password — if you lose it, we can only send you a reset link, not tell you what it was.

Choose a strong password. We don't currently enforce a complexity policy, but please use something you don't reuse on other sites.

## Member-update self-service links

When you send a member a "please update your details" email, the link contains a 64-character random token. The link:

- Expires after **14 days**
- Is **single use** — once the member submits the form, the token is consumed
- Only allows the member to update their *own* contact details (title, name, email, phone, address). They can't change Gift Aid status, banking name, or anything else.

## Email delivery

We send transactional email (donation receipts, update requests, statements) via authenticated SMTP. We don't send marketing email and don't share your members' email addresses with anyone.

To reduce SMTP abuse and bounce-loops, ProBooks automatically blocks sending to obviously fake addresses (`@example.com`, `@test.com`, etc.). You can also flag individual members as *Do not email*.

## Backups

Supabase takes daily database backups, retained for 7 days. We can restore from any of those backup points within hours.

If you'd like an export of all your charity's data, contact support — we'll provide a CSV bundle.

## Account deletion

If you cancel your subscription, your data is retained for 90 days in case you re-subscribe. After 90 days, we contact you to arrange permanent deletion.

To delete your account immediately, email support and we'll process the deletion within 30 days as required by UK GDPR.

## What we don't do

- We don't sell or share your data with third parties.
- We don't run ads.
- We don't track you across sites.
- We don't store payment card details — Stripe handles all card data.

## Reporting a security issue

If you find a security problem, please email `support@probooksaccounting.co.uk` with the subject line "SECURITY". Don't post it publicly first. We'll respond within one business day and credit responsible disclosure where appropriate.
