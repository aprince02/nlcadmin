# Managing members

A **member** is anyone whose details you want to keep on file: regular donors, occasional donors, the leadership team, or simply people on your charity register. Members are the foundation of every donation record and every Gift Aid claim.

## Adding a member

There are two ways:

1. **From the Members page**, click *Add Member* and fill in the form.
2. **From the Add Donation flow**, when the giver doesn't already exist, click *Add new giver* — this creates a member and a donation in one step.

The second route is faster for typical use. Most charities only ever add members through the donation flow.

## What's required, what isn't

For Gift Aid, HMRC requires:

- **Title** (Mr / Mrs / Miss / Ms / Dr / Rev — pick the closest)
- **First name** and **Surname** — exactly as they appear on the donor's bank account or written on the envelope
- **House number or name**
- **Postcode** — full UK postcode, ProBooks normalises spacing automatically

For everyday use, also keep:

- **Email** — used for donation receipts and update-details requests
- **Phone number** — useful for contact when email isn't an option
- **Address Line 1 and 2, City** — appears on donor statements

## "Do not email" flag

Some members give you a placeholder email (`admin@mail.com`, `test@email.com`, etc.) because they don't actually use email. Sending to those addresses fills your SMTP queue with bouncing retries.

To stop that:

1. Open the member's edit modal.
2. Tick **Do not email this member** under the email field.
3. Save.

That member is now skipped silently by all outgoing emails — donation receipts, update-detail requests, statement emails. The members list will show a small *No email* badge next to their email.

ProBooks also auto-detects obvious placeholder addresses (anything `@example.com`, `@test.com`, `@mail.com`, `@admin.com`, etc.) and won't send to them even without the flag set. The flag is for cases that aren't obviously fake — e.g. an address that's syntactically valid but the member never reads.

## Postcode formatting

UK postcodes for HMRC must be uppercase with a single space before the last three characters: `SR4 6AE`, not `sr46ae` or `SR4  6AE`.

ProBooks normalises this automatically when you save a member, so you can type it however you like. If you see a postcode in the wrong format somewhere, edit the member and re-save — it'll be cleaned up.

## House number vs house name

The Gift Aid CSV needs *something* for the address — either the number (`14`) or the name (`Rose Cottage`). Either is fine. The field is called **House No.** but accepts text.

If a member has neither (e.g. a flat without a number), put the building name or the most identifiable element. HMRC's matching is forgiving as long as the postcode is right.

## Marking a member inactive

Use *Admin → Inactive Donors* to bulk-mark members who haven't given for a long time. Inactive members:

- Don't appear in the default members list
- Don't appear in the *Select Giver* dropdown when adding a donation
- Are excluded from Gift Aid claim runs

You can still find them by toggling the *Show inactive* filter on the Members page.

## Member self-update

ProBooks can email a member a secure single-use link that lets them update their own contact details — useful when you have addresses or phone numbers that are years out of date.

From the member's edit page, click *Send update request*. They get an email with a link that's valid for 14 days and can only be used once. Whatever they save flows back into the member record.

The member can update: title, name, email, phone, address, postcode. They can't change banking name or anything Gift Aid related.
