# Tender Document Package Builder

AI DevFest 2026 (DIU-CPC, powered by Upay) - Vibe Coding problem: **Tender Document Package Builder**.

- Participant: Arman Ahmed Miraj (registration number: aif_1e9295f677e54647b522)
- GitHub: https://github.com/ArmanAhmedMiraj/aidevfest-tender-package-builder
- Live site (HTTPS): https://armanahmedmiraj.github.io/aidevfest-tender-package-builder/

## What it does

A frontend-only web app for office staff. It turns a set of PDF files into one checked, correctly ordered PDF package for a tender submission. Everything runs in the browser in Google Chrome; no file is ever uploaded anywhere.

1. Open the tender's `requirements.json`. The tender details and the list of required documents appear, sorted by `order`.
2. Add many PDF files at once (choose or drag). Each file shows its name and page count. Non-PDF, damaged, password-protected and empty files are rejected with a clear message. Any file can be removed. Limits: 30 files and 50 MB in total.
3. Match each file to one required document (one file per document, one document per file). Matches can be changed or undone at any time.
4. Enter the expiry date for documents that have an expiry.
5. Statuses update instantly: **Missing**, **Expiry date needed**, **Expired**, **Not provided**, **OK**. A document that expires on the submission deadline day is still OK.
6. Files with identical content (even with different names) are marked **Duplicate** and cannot be matched to different documents.
7. **Generate package** is disabled while any document is Missing, Expiry date needed or Expired, and the reasons are listed.
8. The package downloads as `<tender_id>_Package.pdf`: an English cover page (tender ID, title, procuring entity, bidder, submission deadline, date made, list of included documents in order), then all pages of each included document in `order`, with a footer `<tender_id> | Page X of Y` on every page. The footer sits in a white band added below each page, so it never covers the document's content.
9. The whole app switches between English and Bangla. Document names come from `title_bn` or `title_en`.

## How to use

Open the live site in Chrome, choose `requirements.json`, add the PDF files, match them, enter expiry dates, and press **Generate package**.

## Sample pack result

The sample pack has hidden problems that the app handles:
- two trade licenses (the 2025 one is expired) - match the 2026 license;
- two identical experience certificates under different names - flagged as duplicates;
- `company_logo.png` is not a PDF - rejected;
- `scan_0042.pdf` is an image-only scan (the signed declaration) - use Preview to identify it;
- optional documents (Audited Financial Statement, Manufacturer's Authorization) are not provided - skipped.

The final package made from the sample pack is `output/T-2026-0417_Package.pdf` (16 pages). Screenshots are in `screenshots/`.

## Project structure

- `index.html`, `css/style.css` - the app page
- `js/logic.js` - pure functions (statuses, date checks, sorting, duplicates, matching, limits); no screen code
- `js/pdf.js` - builds the package with pdf-lib
- `js/app.js`, `js/i18n.js`, `js/i18n-extra.js` - screen and English/Bangla text
- `libs/pdf-lib.min.js` - pdf-lib 1.17.1 (MIT), served from this repository, not from a CDN
- `tests.html`, `js/tests.js` - open `tests.html` in Chrome to run 64 automated checks of the logic (every status rule, the same-day boundary, ordering, duplicates, limits, footer text)

## Decisions

- Dates are compared as plain `YYYY-MM-DD` text, never as time-zone dependent date objects.
- An expiry date belongs to the matched file; changing or removing the match clears it.
- Package order follows the `order` field, never file names or upload order.
- The cover is always English, as the problem requires.

## Known limits

- Bangla text is not drawn on the PDF cover (English only).
- Pages are copied into the package as pages; interactive form fields or comments inside source PDFs are not preserved.
- Bonus tasks (index page, seal, CSV export, save/reopen, auto-match, AI help) are not implemented.

## AI use

This project was built with AI assistance (Claude). Each commit message records the prompt used or "Manual edit".

## Licence

MIT - see `LICENSE`. pdf-lib is MIT licensed.