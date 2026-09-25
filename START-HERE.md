# ZEN — how to put it online (no coding)

You have all the app files and all your keys. This is the clicking part. Go slowly,
tick each box. Nothing here is coding — it's uploading, pasting, and pressing buttons.

There are three short jobs: **A) put your colour list in**, **B) upload the app**,
**C) paste your keys and go live**.

---

## A. Put your colour list in (2 minutes)

1. Find your real colour file (the one with `Code,Hex Code` and all the FA codes).
2. Save it into the `data` folder inside `zen-app`, named exactly **`colours.csv`**.
   (There's a spot ready for it there.)
3. That's it — the app reads every code from this file. You don't edit any code.

---

## B. Upload the app to GitHub (10 minutes)

GitHub is just online storage for the app's files.

1. Go to **github.com** and sign in.
2. Click the **+** at top right → **New repository**.
3. Name it `zen-loom` . Choose **Private**. Click **Create repository**.
4. On the next page, click **uploading an existing file** (a link in the middle).
5. Drag the **whole `zen-app` folder's contents** into the box (all the files and
   folders you have). Wait for them to finish uploading.
6. Click **Commit changes**.

Your app now lives safely on GitHub.

---

## C. Go live on Vercel (15 minutes)

Vercel takes the files from GitHub and turns them into a real website.

1. Go to **vercel.com** and sign in **with your GitHub account**.
2. Click **Add New… → Project**.
3. Find `zen-loom` in the list and click **Import**.
4. **Before** you click Deploy, open the **Environment Variables** section.
5. Add each of these seven, one at a time — **Name** on the left, your real value
   on the right. Copy the names exactly from the `.env.example` file:
   - `GEMINI_API_KEY`
   - `FISH_AUDIO_API_KEY`
   - `FISH_AUDIO_VOICE_ID`
   - `COMPOSIO_API_KEY`
   - `DRIVE_FOLDER_ID`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (and `SUPABASE_SERVICE_KEY` if you made one)
6. Now click **Deploy**. Wait a couple of minutes.
7. Vercel gives you a link like `zen-loom.vercel.app`. That's your app.

---

## D. One-time database setup (5 minutes)

1. Go to your **Supabase** project → **SQL Editor** → **New query**.
2. Open the file `data/supabase-setup.sql`, copy everything in it, paste it in.
3. Click **Run**. This makes the memory ZEN uses.

---

## E. On the tablet

1. Open the Vercel link on the tablet's browser.
2. Add it to the home screen so it opens like an app.
3. Tap the orb, allow the microphone once, and start talking.

---

## If something doesn't work

- **The colour squares are missing:** the `colours.csv` wasn't picked up. In Vercel,
  after uploading, it also runs a small step to read them. If they're missing, tell me.
- **"Server is missing the … key":** that key's name in Vercel doesn't match exactly.
  Check spelling against `.env.example`.
- **Drive didn't save:** the Google account connected in Composio must be the same one
  that owns the folder. Re-check the folder ID.
- **Anything else:** copy the error and send it to me. I'll fix the exact file.

---

## What each file does (so you're not in the dark)

- `app/page.js` — the screen your dad sees (orb, table, log).
- `app/api/brain/` — the ears + brain (Gemini). Hears him, fills the card.
- `app/api/tts/` — the mouth (Fish Audio). Speaks replies.
- `app/api/export/` — the hands. Makes the PDF and files it to Drive (Composio).
- `app/api/card/` — the memory. Saves where he stopped, after every change.
- `lib/` — the shared helpers, including reading your colour list.
- `data/colours.csv` — YOUR colour codes (you put this in).
- `data/supabase-setup.sql` — the one-time memory setup.

Your keys are only ever in Vercel's settings — never in these files. That's what
keeps it safe on the web.
