# Kriyadocs Engineering PMO

Live, shared program management dashboard for the Kriyadocs Engineering team.
All data is stored in Firebase — every edit is instantly visible to everyone with the URL.

---

## STEP 1 — Create a Firebase Project (free, ~5 min)

1. Go to https://console.firebase.google.com
2. Click "Add project" → name it "kriyadocs-pmo" → Create
3. On the dashboard, click the </> (Web) icon
4. App nickname: "kriyadocs-pmo" → Register app
5. COPY the firebaseConfig values shown — you will need these next

Then create the database:
6. Left sidebar → Build → Firestore Database → Create database
7. Choose "Start in test mode" → Next → pick region (asia-south1 for India) → Enable

---

## STEP 2 — Paste Your Config into the App

Open js/data.js in any text editor and fill in FIREBASE_CONFIG at the top:

  apiKey:            "your value here"
  authDomain:        "your value here"
  projectId:         "your value here"
  storageBucket:     "your value here"
  messagingSenderId: "your value here"
  appId:             "your value here"

Save the file.

---

## STEP 3 — Upload to GitHub

1. Go to github.com → New repository → name: kriyadocs-pmo → Private → Create
2. Click "uploading an existing file"
3. Drag all files from INSIDE the unzipped folder (index.html, css/, js/, README.md)
4. Commit changes

---

## STEP 4 — Deploy on Netlify (free live URL)

1. Go to netlify.com → Add new site → Import from Git → GitHub
2. Select the kriyadocs-pmo repo
3. Leave build settings blank → Deploy site
4. Your live URL: https://kriyadocs-pmo.netlify.app (or similar)
5. Share that URL — everyone opens it and sees the same live data

---

## Future Updates

- Edit data: use the UI forms directly — no code needed ever
- Edit the app itself: edit any file on GitHub → Netlify auto-redeploys in 30 seconds
- Add a project on your phone → leadership sees it on their laptop instantly

---

## Free Tier Limits (Firebase)
- 50,000 reads / day
- 20,000 writes / day
- More than enough for a team of 20-30 people
