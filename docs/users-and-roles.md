# Inviting users & permissions

Most charities have one or two people running the books, but you may want a treasurer, a deputy, and an oversight admin. ProBooks has three roles to cover this.

## The three roles

- **User** — can record donations, view members, view transactions, and run reports. Cannot invite other users, edit charity settings, or run Gift Aid claims.
- **Admin** — everything a User can do, plus: invite or remove other users, edit charity settings, run Gift Aid claims, manage transaction and donation types, set fund opening balances, and access billing.
- **Super Admin** — same powers as Admin, plus the ability to create new charities. This role is reserved for the platform team and isn't normally given to charity staff.

## Inviting someone

1. Go to *Admin → Invite User*.
2. Enter their email address.
3. Pick a role (User or Admin).
4. Click **Send Invite**.

They'll receive an email with a link that's valid for **48 hours**. When they click it, they set their own password and sign in for the first time.

## What if they didn't get the email?

A few common reasons:

- **It went to spam.** Ask them to check their junk folder. Future emails from your domain should be safe once they've marked it "Not spam".
- **The email address was wrong.** Open *Admin → Resend Invite*, type the correct address, and a new 48-hour token is generated.
- **The 48-hour window has passed.** Same fix — *Admin → Resend Invite* gives them a fresh link.

## Removing access

Open *Admin → Manage Users*. From there you can:

- **Deactivate a user** — they keep their account but can't sign in. Useful when someone steps down temporarily.
- **Change role** — promote a User to Admin or vice versa.
- **Delete** — permanent. Only do this if the account was created in error.

## What admins should NOT have

A few things are deliberately out of reach for charity Admins, even though they have wide powers:

- They can't see other charities. Each charity is fully separated.
- They can't see encrypted bank credentials or refresh tokens.
- They can't override a member's "Do not email" flag from outside the member edit screen.
- They can't bypass the subscription write-gate. If billing fails, write actions are blocked for everyone, including admins, until billing is restored.

## Role of charity, not the person

Roles attach to the **user account**, not the person. If your treasurer steps down and someone new takes over, you don't migrate the old account — you invite the new person, give them Admin, and deactivate the old one. This keeps the audit trail clean.
