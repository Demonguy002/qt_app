# Quant Aptitude Coach

A responsive personal quantitative-aptitude practice app built with React + Vite. It includes a four-question daily session, three timed levels, selectable topic index, solution reveal, streaks, progress metrics, Bright/Dark/Ocean themes, and optional Supabase cross-device sync.

## Important question-integrity note

The supplied source is a 737-page scanned PDF. Its previous OCR import corrupted digits, mathematical signs, option boundaries and answer keys (for example, the printed Question 29 on PDF page 15 is `217 x 217 + 183 x 183 = ?`; its printed options include `80578`, and the checked answer is option B. The old OCR output changed both the stem and options.)

This build blocks that failure mode: **only question cards marked questionVerified, answerVerified and solutionVerified appear in timed practice**. The current bank contains 21 manually transcribed and recomputed cards from source PDF pages 14-15, with the printed answer table on source PDF page 23 used as a cross-check. The rest of the OCR-imported cards were excluded rather than shown as plausible-looking but corrupted questions.

All 39 source topics and their page ranges remain in the topic catalogue. Chapters without checked quiz cards open in the Book Library, where you load your original PDF from your device. The PDF is opened locally by your browser and is **not uploaded to the Vercel site**. This also avoids redistributing the full copyrighted textbook as public static assets.

## Run locally

1. Install Node.js 18 or later.
2. Extract the ZIP.
3. In this folder run `npm install`.
4. Run `npm run dev`.
5. Open the localhost URL shown by Vite.

## Deploy to Vercel

1. Push this folder to a private GitHub repository.
2. Import it in Vercel. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
3. Deploy. The question bank and worked-solutions PDF are static app assets; your source textbook PDF is not.

## Profile and cross-device history

Without Supabase credentials, profile, theme, streak and practice history are saved in that browser's local storage. A local profile on the laptop does not automatically appear on a phone. To sync the same account and streak across devices, create a Supabase project, run `supabase/schema.sql`, and set these Vercel/local environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then redeploy and create/sign into the same account on both devices. Never put a Supabase service-role key in frontend environment variables.

## Daily practice rules

- Exactly four questions per saved day.
- Beginner: 120 seconds per question.
- Intermediate: 60 seconds per question.
- Pro: 30 seconds per question.
- Timer expiry never reveals the answer.
- After reveal, the right option is green and a wrong selected option is red.
- A practice day is added to the streak only after all four questions are reviewed and the user saves the set.
- A completed date after a missed calendar day displays a reset streak of 0 (as requested); the next consecutive completed date starts again at Day 1.
- You can choose a topic and date (not a future date).

## Solution references

`public/verified-solutions.pdf` contains one worked solution per verified card. In the app, Reveal Answer offers the corresponding page in that PDF plus the original source question page and answer-key page in the local PDF viewer.

## Data files

- `public/question-bank.json`: 39 topic entries + 21 manually verified question cards.
- `public/verified-solutions.pdf`: generated worked-solution booklet.
- `supabase/schema.sql`: optional cloud schema for account profiles and daily history.

## Build

```bash
npm install
npm run validate:bank
npm run build
```


## Bundled source book
The original R.S. Agarwal Quantitative Aptitude PDF is included at `public/source-book.pdf` and is served automatically at `/source-book.pdf`. Users do not need to upload a copy.
