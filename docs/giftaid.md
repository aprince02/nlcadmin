# Claiming Gift Aid

Gift Aid is the UK government scheme that lets registered charities reclaim 25p of basic-rate tax on every £1 donated by a UK taxpayer. For most charities it's the single biggest source of income after the donations themselves. ProBooks builds the HMRC submission for you.

## What HMRC requires

For each donation in a claim, HMRC's CSV needs:

- **Title** (Mr / Mrs / Miss / Ms / Dr — they're not picky about exact format)
- **First name**
- **Surname**
- **House number or name**
- **Postcode** (uppercase, with the standard UK space, e.g. `SR4 6AE`)
- **Donation date** (DD/MM/YY)
- **Amount** (£)

If any of those fields are missing for a donation, that donation can't be included in the claim. ProBooks shows you which donations are incomplete so you can fix them.

## The full claim flow

### 1. Open the Gift Aid modal

*Admin → Reports & Exports → Claim Gift Aid*. ProBooks shows a summary: how many unclaimed donations there are, the total amount, and the receivable from HMRC (25% of the total).

### 2. Click Review Records

This loads every unclaimed donation in a table. Rows highlighted **yellow** are missing data — they won't be included in the claim.

### 3. Fix the yellow rows

For each yellow row, type the missing fields directly into the table and click *Save*. The save updates the underlying member record permanently, so next time that member donates, the data will be there. The row turns from yellow to white once it's complete.

You don't have to fix every yellow row — only the ones where you actually have the missing information. Genuinely-incomplete rows can stay yellow and be excluded from this claim.

### 4. Choose how to submit

Once you've fixed what you can, two options appear:

- **Download CSV** — free. You download the file and upload it to HMRC's Charities Online portal yourself. You'll need an HMRC Government Gateway account.
- **Submit for me** — paid service. ProBooks files the claim with HMRC on your behalf within 2 working days. The fee is **1% of the receivable, minimum £25, maximum £200** — charged to your card on file.

Both options mark the included donations as "claimed" so they don't appear in next month's pending pile.

### 5. Confirmation

After choosing, you'll see a confirmation. The claim appears in your *Gift Aid History* (in the same modal area, click *Gift Aid History*) where you can:

- Re-download the CSV any time
- See its status: *Self-downloaded*, *Awaiting filing* (if you paid us to file), or *Submitted to HMRC*

## When to use the paid filing service

The paid service is worthwhile when:

- You don't have an HMRC Government Gateway account and don't want to set one up
- You've never filed a claim before and want to avoid mistakes
- You're handling many small charities and prefer not to log in to each HMRC account

If you file regularly and are comfortable with HMRC's portal, the free CSV download saves the fee.

## What if HMRC rejects the file?

The CSV format we generate is the standard HMRC schedule spreadsheet. Common rejection reasons are usually data issues, not format issues:

- Postcodes that don't match HMRC's records (try the [Royal Mail postcode finder](https://www.royalmail.com/find-a-postcode))
- Surnames with apostrophes or hyphens that don't match the donor's HMRC profile
- Missing house numbers/names

If we filed on your behalf and HMRC rejects, we'll fix the data with you and re-submit at no extra charge. If you filed yourself and HMRC rejects, edit the affected member records and re-download the CSV.

## How often to claim

You can claim as often as you like, but most charities claim either:

- **Quarterly** — keeps the cash flowing, reasonable workload
- **Annually** — at financial year-end, alongside accounts

HMRC processes claims within 4-5 weeks. The money lands directly in your charity bank account.

## Re-downloading a past claim

Open *Gift Aid History*, find the row, click the CSV download button. You can re-download a claim's CSV indefinitely.

## Audit trail

Every claim records:

- When it was made
- Who made it (which user)
- How many records and the total amount
- Submission status

This is your audit trail if HMRC or your independent examiner ever asks.
