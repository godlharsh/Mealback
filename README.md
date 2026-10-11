# MealBack 🍲

> **"Skip a meal. Get value back."**  
> A full-stack web application designed for campus hostels. Hostel students who plan to skip mess meals can list them as digital tokens at a lower price. Anyone (hostel students, day scholars, friends, guests) can buy them via a simulated UPI gateway, get an instant one-time QR ticket, and redeem it at the mess counter.

---

## 🌟 Architecture & Highlights

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS + Plus Jakarta Sans + Brand Colors (`#0F3D2E`, `#1F7A4D`, `#F6C945`, `#EAF5EE`, `#E8704A`, `#14281F`, `#5C6B63`)
- **Animations & Feedback**: `framer-motion` page transitions, button taps, and `canvas-confetti` celebrations
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security, Auth, Realtime WebSocket synchronization)
- **Race-Safe Atomic Operations**: PostgreSQL functions (`buy_token`, `verify_and_use_token`, `list_meal_token`) using row locking (`FOR UPDATE`) with `SECURITY DEFINER`
- **QR Generation & Scanning**: `qrcode` for high-resolution ticket QR generation; `html5-qrcode` for camera scanning with manual short code entry fallback
- **Fair-Use Rules**:
  - Maximum **10 meals** per student per calendar month.
  - Cutoff enforced 2 hours prior to serving time.
  - Transparent value split of ₹30 token: **Seller ₹22**, **Mess Share ₹4**, **MealBack Platform ₹4**.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js v20+ or v24+
- A Supabase project

### 2. Environment Setup
The project requires three environment variables. Ensure `.env.local` exists in the project root with the following keys:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

*(Refer to `.env.example` for the variable template. `.env.local` is included in `.gitignore` and must never be committed).*

### 3. Run the SQL Migration in Supabase

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Open the file [`supabase/schema.sql`](supabase/schema.sql) in this repository.
5. Copy the entire contents of `supabase/schema.sql` and paste them into the SQL Editor.
6. Click **Run** (or press `Ctrl+Enter`).
7. Confirm that the tables (`messes`, `profiles`, `tokens`, `payments`, `wallet_entries`, `ratings`), view (`marketplace_tokens`), RLS policies, and RPC functions are created successfully.

### 4. Turn OFF "Confirm Email" in Supabase Auth (Recommended for Demo)

To test signup and login immediately without requiring email verification links:
1. In your Supabase Dashboard, go to **Authentication** &rarr; **Providers**.
2. Click on **Email**.
3. Locate the setting **"Confirm email"** and toggle it **OFF**.
4. Click **Save**.

### 5. Run the Seed Data Script

The seed script initializes the demo messes, accounts, and 9 sample tokens across lunch, dinner, active passes, expired passes, and wrong-mess test tokens:

```bash
npm run seed
```

This sets up:
- **Demo Mess**: `Boys Hostel A Mess` (Access Code: `MESS-DEMO`)
- **Alternate Mess**: `Girls Hostel B Mess` (Access Code: `MESS-ALT`)
- **Student User**: `student@mealback.demo` / `password123`
- **Buyer User**: `buyer@mealback.demo` / `password123`
- **Mess Staff User**: `mess@mealback.demo` / `password123`
- Ready-to-test tokens for scanner verification.

### 6. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 User Roles & Dashboards

| Role | Purpose | Features |
|---|---|---|
| **Hostel Student** | Sells meals & buys | List meals (2h cutoff), live monthly limit counter (X/10), status badges, earnings wallet (₹22/meal), instant notification when bought. |
| **Buyer** | Buys meals | Browse marketplace, meal type/mess filters, DemoUPI simulated checkout, ticket-style QR passes with short codes, meal ratings (1-5 stars). |
| **Mess Staff** | Verifies passes | Camera QR scanner + manual code fallback, massive full-screen verification modals (`VERIFIED`, `ALREADY_USED`, `EXPIRED`, `WRONG_MESS`, `INVALID`), today's meal stats, scan history log. |

---

## 🧪 Comprehensive Testing Checklist

Follow these step-by-step test scenarios to verify every feature:

### ✅ 1. Role Signups
- **Student Signup**:
  - Visit `/signup`. Select **Hostel Student**.
  - Enter name, email, password, and room number (e.g. `Room A-204`).
  - Submit & verify redirect to `/student`.
- **Buyer Signup**:
  - Visit `/signup`. Select **General Buyer**.
  - Enter email and password. Verify redirect to `/buyer/tokens`.
- **Mess Staff Signup**:
  - Visit `/signup`. Select **Mess Staff**.
  - Try submitting without an access code &rarr; Verify error message: *"Mess staff registration requires a Mess Access Code"*.
  - Enter `MESS-DEMO` &rarr; Verify account is created and linked to *Boys Hostel A Mess*, redirecting to `/mess`.

### ✅ 2. List a Meal
- Log in as student (`student@mealback.demo` / `password123`).
- Navigate to **List Meal** (`/student`).
- Check that the live counter shows current quota (e.g. `1/10 Listed This Month`).
- Select Dinner, select today's or tomorrow's date.
- Verify that cutoff preview calculates 2 hours prior to serving time.
- Click **List Token on Marketplace**.
- Verify success toast and new entry in **My Listed Tokens** with a yellow **Listed** badge.

### ✅ 3. Enforce Monthly Limit (10 Meals)
- If a student tries to list an 11th token within the same calendar month:
- The database RPC function `list_meal_token` rejects the insert with:
  *"Monthly listing limit reached! You can only list at most 10 meals per calendar month."*
- The UI disables submission and displays the monthly cap notice.

### ✅ 4. Buy a Meal via DemoUPI
- Log in as buyer (`buyer@mealback.demo` / `password123`) or view marketplace.
- Go to **Marketplace** (`/marketplace`).
- Find a listed dinner token. Check countdown timer and price (₹30, struck-through ₹40).
- Click **Buy Now**.
- In the DemoUPI modal:
  - Verify "Demo payment (test mode)" banner.
  - Click **Pay ₹30**.
  - Observe the realistic 2-second processing state.
  - Celebrate with success confetti!
- Observe automatic redirect to **My Tokens** (`/buyer/tokens`).
- Inspect the minted ticket card:
  - Perforated notches on ticket edges.
  - Crisp high-resolution QR code (encodes only the opaque `qr_secret`).
  - Human-readable short code (e.g. `5521-VAL`).

### ✅ 5. Scan & Verify at Mess Counter (VERIFIED)
- Log in as mess staff (`mess@mealback.demo` / `password123`).
- Go to `/mess`.
- In **Enter Code Fallback**, type `5521-VAL` (or use the green quick shortcut button) and click **Verify Code**.
- Observe the massive green **VERIFIED: "Serve karo!"** screen with meal type and timestamp.
- Click **Next Scan**.
- Navigate to `/mess/stats` &rarr; verify "Meals Served" and "Mess Commission" incremented.
- Check the buyer's screen &rarr; token status automatically flips to gray **Used** with a "Rate This Meal" button.

### ✅ 6. Scan Again (ALREADY_USED)
- In the scanner, enter `9999-USD` (or re-enter `5521-VAL` that was just verified).
- Observe the full-screen red **ALREADY USED!** warning with previous redemption timestamp.

### ✅ 7. Scan an Expired Token (EXPIRED)
- In the scanner, enter `7777-EXP` (or click yellow shortcut).
- Observe the yellow **TOKEN EXPIRED!** alert showing that validity has passed.

### ✅ 8. Scan Token from Another Mess (WRONG_MESS)
- In the scanner, enter `4444-WNG` (or click orange shortcut).
- Observe the orange **WRONG MESS!** alert indicating the token belongs to another mess (*Girls Hostel B Mess*).

---

## 🚢 Vercel Deployment Instructions

1. Push this repository to GitHub or GitLab.
2. Log in to [Vercel](https://vercel.com) and click **Add New** &rarr; **Project**.
3. Import your `mealback` repository.
4. In the **Environment Variables** section, add the three required variables by name:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
5. Click **Deploy**.
6. Once deployed, open your live Vercel URL (HTTPS is enabled by default, ensuring camera QR scanning permissions work seamlessly on mobile browsers).

---

## 🔒 Security Best Practices Implemented

- **Row Level Security (RLS)**: Enforced on all tables. Marketplace views hide seller identity and never expose `qr_secret`.
- **Atomic Concurrency**: Postgres row locking (`FOR UPDATE`) eliminates double-buying and double-scanning race conditions.
- **Server-Only Secret**: `SUPABASE_SECRET_KEY` is strictly confined to server-side routes and never bundled into client assets.
- **Opaque QR Secrets**: QR codes encode exclusively a high-entropy cryptographically random secret string.
