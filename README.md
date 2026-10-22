# MealBack 🍲

> **"Skip a meal. Get value back."**  
> A full-stack web application designed for campus hostels. Hostel students who plan to skip mess meals can list them as digital tokens at their own chosen price. Anyone (hostel students, day scholars, friends, guests) can buy them via a simulated UPI gateway, receive an instant one-time QR ticket, and redeem it at the mess counter.

---

## 🌟 Architecture & Highlights

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + Plus Jakarta Sans + Brand Palette (`#0F3D2E`, `#1F7A4D`, `#F6C945`, `#EAF5EE`, `#E8704A`, `#14281F`, `#5C6B63`)
- **Animations & Feedback**: `framer-motion` smooth transitions, interactive modal sheets, and `canvas-confetti` celebrations
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Auth, Realtime WebSocket synchronization)
- **Student-Set Dynamic Pricing**: Students set their own asking price per individual meal listing (₹5–₹1000, default ₹30). Payouts are credited directly to the student's wallet upon verified scan at the mess counter.
- **Race-Safe Atomic Operations**: PostgreSQL functions (`buy_token`, `verify_and_use_token`, `list_meal_token`, `create_mess`) using row locking (`FOR UPDATE`) with `SECURITY DEFINER`
- **QR Generation & Scanning**: `qrcode` for high-resolution ticket QR generation; `html5-qrcode` dynamic client loading for camera scanning with manual short code entry fallback
- **Fair-Use Rules**:
  - Maximum **10 meals** listed per student per calendar month to prevent commercial abuse.
  - Cutoff enforced 2 hours prior to meal serving time.
  - Passes valid until 90 minutes after serving time.

---

## 🚀 Setup & Deployment Guide

### 1. Prerequisites
- Node.js v20+ or v24+
- A Supabase project (URL and keys)

### 2. Environment Setup
The project requires three environment variables in `.env.local` (kept private and untracked in `.gitignore`):

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

*(See `.env.example` for the template. Keys are read only through `process.env` and `SUPABASE_SECRET_KEY` is restricted exclusively to server routes).*

---

### 3. Run Database Migrations in Supabase

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Open [`supabase/schema.sql`](supabase/schema.sql).
5. Copy the entire contents of `supabase/schema.sql` and paste them into the SQL Editor.
6. Click **Run** (or `Ctrl+Enter`).
7. Confirm that tables (`messes`, `profiles`, `tokens`, `payments`, `wallet_entries`, `ratings`), views, RLS policies, and RPC functions are created.

---

### 4. Optional: Clean Test/Demo Data

If demo test rows exist in your Supabase project from initial testing, you can safely wipe demo rows while preserving your real user accounts (such as `harshm6390@gmail.com`):

1. Open [`supabase/cleanup_test_data.sql`](supabase/cleanup_test_data.sql).
2. Review the script.
3. Paste into the Supabase SQL Editor and run.

---

### 5. Supabase Auth Configuration Settings

In your Supabase Dashboard:

1. **Email Confirmation**:
   - Go to **Authentication** &rarr; **Providers** &rarr; **Email**.
   - If you want users to verify their email before using the app, keep **Confirm email** turned **ON**.
   - MealBack includes full email verification handling, resend verification flows, and forgot/reset password pages.
   - For fast local testing without waiting for email delivery, you can toggle **Confirm email** OFF.
2. **Redirect URLs**:
   - Go to **Authentication** &rarr; **URL Configuration**.
   - Add your local host: `http://localhost:3000/**`
   - Add your production Vercel domain: `https://your-mealback.vercel.app/**`
3. **Custom SMTP (For Production)**:
   - For production email deliverability, configure Custom SMTP in **Project Settings** &rarr; **Authentication** &rarr; **SMTP Settings** (e.g. Resend, SendGrid, or AWS SES).

---

### 6. Run Locally

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 User Roles & Flow

| Role | Signup Flow | Key Capabilities |
|---|---|---|
| **Hostel Student** | Signs up with email, password, and room number. | Sets individual asking price per meal, views live monthly quota (X/10), real-time status updates when bought or scanned, earnings wallet with ledger history. |
| **Buyer** | Signs up as General Buyer (day scholars, guests, friends). | Explores active marketplace listings, filters by meal type and mess, simulated UPI checkout, receives dynamic QR ticket with short code, rates redeemed meal (1-5 stars). |
| **Mess Staff** | Either registers a new mess as a Manager (generates a unique access code) or joins with an existing Mess Access Code. | Scans passes via camera or manual short code entry, instantaneous full-screen verification feedback (`VERIFIED`, `ALREADY_USED`, `EXPIRED`, `WRONG_MESS`, `INVALID`), real-time analytics. |

---

## 🚢 Vercel Deployment

1. Push your code to a GitHub or GitLab repository.
2. Import the repository in [Vercel](https://vercel.com).
3. Set the three environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
4. Click **Deploy**.
5. The application includes `vercel.json` configured for low-latency Mumbai deployment (`bom1`).
