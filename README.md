# ⏱ Chronos — Client & Time Blocking Planner

A full-stack web app for managing clients and scheduling work with a drag-and-drop weekly planner. Built with React + Vite, backed by Supabase (Postgres + Auth).

---

## 🚀 Deploy in ~15 minutes

### Step 1 — Set up Supabase (free)

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **"New Project"** → give it a name (e.g. "chronos") → set a database password → Create
3. Wait ~2 minutes for the project to spin up
4. Go to **SQL Editor** → click **"New Query"**
5. Open the file `supabase/schema.sql` from this project, paste the entire contents, and click **Run**
   - This creates the `clients` and `blocks` tables with security rules
6. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

### Step 2 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...
```

### Step 3 — Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — you should see the login screen!

---

### Step 4 — Deploy to Vercel (free)

1. Push this project to a GitHub repo:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/chronos-app.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → **"Add New Project"** → import your GitHub repo

3. In the **Environment Variables** section, add:
   - `VITE_SUPABASE_URL` = your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

4. Click **Deploy** — Vercel will build and give you a live URL like `https://chronos-app.vercel.app`

---

## 📁 Project Structure

```
chronos-app/
├── index.html                    # App entry point
├── vite.config.js                # Vite config
├── package.json
├── .env.example                  # Copy to .env and fill in credentials
│
├── supabase/
│   └── schema.sql                # ← Run this in Supabase SQL Editor first!
│
└── src/
    ├── main.jsx                  # React root with AuthProvider
    ├── App.jsx                   # Auth gate (shows login or app)
    ├── supabaseClient.js         # Supabase client instance
    │
    ├── contexts/
    │   └── AuthContext.jsx       # Session state + useAuth() hook
    │
    ├── hooks/
    │   └── useData.js            # useClients() + useBlocks() hooks
    │
    └── components/
        ├── AuthScreen.jsx        # Login / Signup / Reset password
        └── Planner.jsx           # Main app (planner + clients + import)
```

---

## ✨ Features

- **Weekly time-block planner** — drag clients onto the calendar grid
- **Client manager** — color-coded cards with hourly rates and revenue tracking
- **Recurring tasks** — daily, weekly, MWF, T/Th, weekdays, weekends
- **CSV import** — bulk import clients with column mapping and duplicate handling
- **Year filtering** — organize clients by year
- **Auth** — email/password login with Supabase Auth (sign up, reset password)
- **Per-user data** — Row Level Security ensures users only see their own data
- **Real-time persistence** — all changes saved instantly to Supabase Postgres

---

## 🔒 Security

All data is protected by Supabase **Row Level Security (RLS)**. Users can only read and write their own clients and blocks — this is enforced at the database level, not just the frontend.

---

## 🛠 Tech Stack

| Layer       | Technology                      |
|-------------|---------------------------------|
| Frontend    | React 18 + Vite                 |
| Auth        | Supabase Auth (email/password)  |
| Database    | Supabase Postgres               |
| Hosting     | Vercel (free tier)              |
| Styling     | Inline styles (no CSS framework)|

---

## 💡 Next Steps / Ideas

- [ ] Add Google / GitHub OAuth login
- [ ] Invoice generation from time blocks
- [ ] Export weekly schedule as PDF
- [ ] Mobile-responsive layout
- [ ] Team/shared workspaces
- [ ] Stripe integration for client billing
