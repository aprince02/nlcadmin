# Exports & PDFs

ProBooks generates three kinds of reports — Transactions, Donations, and Totals — each available as a PDF (for printing or sending to trustees) or a CSV (for opening in Excel). You can download the file or have ProBooks email it.

## Where to find exports

*Admin → Reports & Exports* card. Each export opens a small modal where you pick a date range and the action (download or email).

## Export Transactions

A line-by-line listing of every transaction in your bank account for a date range, optionally filtered by type.

- **PDF** — formatted for printing, with charity name, period and a totals footer.
- **CSV** — raw data for spreadsheet work.

Common uses: end-of-year accounts, sending to your independent examiner, copying numbers into your annual return.

## Export Donations

A line-by-line listing of every donation, optionally filtered by fund.

- **PDF** — donor-by-donor or chronological, with totals per fund.
- **CSV** — raw data with member ID, date, amount, fund, method and Gift Aid flag.

Common uses: thank-you letters, year-end summaries by donor, reconciling against bank deposits.

## Export Totals

Aggregated numbers for a date range — totals by fund, totals by type, monthly summary.

- **PDF** — high-level summary, two or three pages.
- **CSV** — same numbers in a spreadsheet-friendly layout.

This is the report most charities use for trustees' meetings.

## Download vs Email

- **Download** generates the file and serves it to your browser. Good for instant use.
- **Email (both)** for Totals, or **Email** for the others, sends the PDF (and CSV, where applicable) to whatever address you type. Useful when you need to forward the file to your examiner or trustee.

When you choose Email, an email field appears. Type the recipient's address and click *Generate*. The email comes from your charity's configured email address.

## Donor statement (per-member)

For Gift Aid evidence and individual thank-you letters, you can generate a single-donor statement.

1. Go to Members.
2. Click *View Giving* on the donor's row.
3. Click *Download PDF* (or *Email PDF*).
4. Pick a date range (default: this calendar year).

The donor statement shows every donation in the period, totals, and the Gift Aid status of each.

## Tips on date ranges

- Choose **calendar year** (1 Jan to 31 Dec) for HMRC-style records.
- Choose **financial year** (e.g. 1 Apr to 31 Mar) for Charity Commission accounts.
- Pick a smaller range (e.g. one month) to keep PDFs readable when there are many transactions.

## File sizes

Earlier versions of ProBooks produced very large PDFs (16 MB+ for a full year of totals). PDF compression is now on by default, and a 12-month totals export is typically 200-500 KB. If you ever see a multi-MB PDF, please let support know.

## Troubleshooting

- **Email never arrives** — check the recipient address for typos. ProBooks blocks sending to obvious placeholder addresses (`@example.com`, `@test.com`, etc.). Check spam in the recipient's mailbox.
- **CSV won't open in Excel** — the file is UTF-8. In Excel, use *Data → From Text/CSV* and pick UTF-8 encoding rather than double-clicking.
- **PDF is slow to generate** — for very large date ranges (5+ years), the server has more work to do. Try splitting it into yearly exports.
