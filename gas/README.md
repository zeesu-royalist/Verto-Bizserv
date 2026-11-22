# Verto Bizserv — Google Apps Script Setup Guide

This backend runs **100% free forever** inside your Google Drive using **Google Sheets** as your database and **Google Drive** for resume storage.

---

## Step 1: Create Your Google Sheet

1. Open [Google Drive](https://drive.google.com/) and click **+ New → Google Sheets**.
2. Rename the spreadsheet at the top to:
   ```
   Verto_Recruitment_Database
   ```

---

## Step 2: Paste the Apps Script Code

1. In your newly created Google Sheet, click **Extensions → Apps Script** in the top menu.
2. Replace all the code in `Code.gs` with the entire contents of [`gas/Code.gs`](./Code.gs).
3. Click the **Save** icon (disk icon or `Cmd + S` / `Ctrl + S`).

---

## Step 3: Run Database Initialization (One-Click)

1. In the Apps Script toolbar dropdown (next to "Debug"), select the function **`initDatabase`**.
2. Click **Run**.
3. Google will ask for authorization once (*"Review Permissions" → Select your Google account → Advanced → Go to Verto Recruitment (unsafe) → Allow*).
4. **Done!** Look at your Google Sheet:
   - Tab 1: **`Candidates`** (All 9 columns + system metadata)
   - Tab 2: **`Users`** (Pre-seeded with Admin: `admin@vertobizserv.in` / `Admin@123`)
   - Tab 3: **`Dropdowns`** (Pre-seeded with Manager and Client options)

---

## Step 4: Deploy as Web App

1. In the Apps Script editor, click the blue **Deploy → New deployment** button (top right).
2. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
3. Configure the settings:
   - **Description**: `Verto Recruitment API`
   - **Execute as**: `Me (your-email@gmail.com)`
   - **Who has access**: `Anyone` *(Required so recruiters can connect from any network without Google Auth popups)*
4. Click **Deploy**.
5. Copy the **Web App URL** (it looks like `https://script.google.com/macros/s/AKfycb.../exec`).

---

## Step 5: Connect Frontend

Add the Web App URL to your project's `.env` file (or frontend config):
```env
VITE_GAS_API_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

Restart your app:
```bash
npm run dev
```

You are ready! Recruiters and Admins can now log in securely from any device, anywhere.
