import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.");
  console.error("Run with: npm run seed (or node --env-file=.env.local scripts/seed.mjs)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function generateShortCode() {
  const digits = Math.floor(1000 + Math.random() * 9000);
  const chars = crypto.randomBytes(2).toString("hex").substring(0, 3).toUpperCase();
  return `${digits}-${chars}`;
}

async function getOrCreateUser(email, password, role, fullName, messId = null, room = null) {
  // Check if user already exists
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    console.warn("Could not list users:", listError.message);
  }

  const existing = usersData?.users?.find((u) => u.email === email);
  let userId;

  if (existing) {
    console.log(`User ${email} already exists (${existing.id})`);
    userId = existing.id;
  } else {
    console.log(`Creating user ${email}...`);
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role },
    });

    if (createError) {
      throw new Error(`Failed to create ${email}: ${createError.message}`);
    }
    userId = created.user.id;
  }

  // Upsert profile
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    email,
    full_name: fullName,
    role,
    mess_id: messId,
    hostel_room: room,
  });

  if (profileError) {
    console.warn(`Profile upsert error for ${email}:`, profileError.message);
  }

  return userId;
}

async function seed() {
  console.log("=== Starting MealBack Database Seeding ===");

  // 1. Create messes
  console.log("Creating Mess: Boys Hostel A Mess (MESS-DEMO)...");
  const { data: messA, error: messAError } = await supabase
    .from("messes")
    .upsert(
      {
        name: "Boys Hostel A Mess",
        location: "Campus Block 3, North Wing",
        access_code: "MESS-DEMO",
      },
      { onConflict: "access_code" }
    )
    .select()
    .single();

  if (messAError) {
    console.error("Error creating Boys Hostel A Mess. Ensure supabase/schema.sql has been run first!");
    console.error(messAError.message);
    process.exit(1);
  }

  // Create second mess for testing WRONG_MESS scan case
  const { data: messB } = await supabase
    .from("messes")
    .upsert(
      {
        name: "Girls Hostel B Mess",
        location: "Campus Block 7, South Wing",
        access_code: "MESS-ALT",
      },
      { onConflict: "access_code" }
    )
    .select()
    .single();

  console.log(`Mess A ID: ${messA.id}`);
  if (messB) console.log(`Mess B (Alt) ID: ${messB.id}`);

  // 2. Create demo users
  console.log("\nCreating Demo Users...");
  const studentId = await getOrCreateUser(
    "student@mealback.demo",
    "password123",
    "student",
    "Aarav Sharma (Hostel A)",
    messA.id,
    "Room A-204"
  );

  const buyerId = await getOrCreateUser(
    "buyer@mealback.demo",
    "password123",
    "buyer",
    "Rohan Verma (Day Scholar)"
  );

  const messStaffId = await getOrCreateUser(
    "mess@mealback.demo",
    "password123",
    "mess",
    "Ramesh Kumar (Mess Manager)",
    messA.id
  );

  console.log(`Demo Student ID: ${studentId}`);
  console.log(`Demo Buyer ID: ${buyerId}`);
  console.log(`Demo Mess Staff ID: ${messStaffId}`);

  // 3. Clear existing demo tokens
  console.log("\nCleaning old demo tokens...");
  await supabase.from("tokens").delete().eq("seller_id", studentId);

  // 4. Create sample tokens
  console.log("Creating 8+ sample tokens across lunch & dinner...");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const sampleTokens = [
    // 1. Today's Lunch - Listed (available on Marketplace)
    {
      seller_id: studentId,
      mess_id: messA.id,
      meal_type: "lunch",
      meal_date: todayStr,
      meal_time: "13:30:00",
      cutoff_at: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "listed",
      qr_secret: crypto.randomBytes(24).toString("hex"),
      short_code: generateShortCode(),
    },
    // 2. Today's Dinner - Listed
    {
      seller_id: studentId,
      mess_id: messA.id,
      meal_type: "dinner",
      meal_date: todayStr,
      meal_time: "20:30:00",
      cutoff_at: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 10 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "listed",
      qr_secret: crypto.randomBytes(24).toString("hex"),
      short_code: generateShortCode(),
    },
    // 3. Tomorrow's Breakfast - Listed
    {
      seller_id: studentId,
      mess_id: messA.id,
      meal_type: "breakfast",
      meal_date: tomorrowStr,
      meal_time: "08:30:00",
      cutoff_at: new Date(Date.now() + 14 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 17 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "listed",
      qr_secret: crypto.randomBytes(24).toString("hex"),
      short_code: generateShortCode(),
    },
    // 4. Tomorrow's Lunch - Listed
    {
      seller_id: studentId,
      mess_id: messA.id,
      meal_type: "lunch",
      meal_date: tomorrowStr,
      meal_time: "13:00:00",
      cutoff_at: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 21 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "listed",
      qr_secret: crypto.randomBytes(24).toString("hex"),
      short_code: generateShortCode(),
    },
    // 5. Tomorrow's Dinner - Listed
    {
      seller_id: studentId,
      mess_id: messA.id,
      meal_type: "dinner",
      meal_date: tomorrowStr,
      meal_time: "20:00:00",
      cutoff_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 26 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "listed",
      qr_secret: crypto.randomBytes(24).toString("hex"),
      short_code: generateShortCode(),
    },
    // 6. Active Sold Token (Owned by buyer, ready to scan at Mess A)
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messA.id,
      meal_type: "dinner",
      meal_date: todayStr,
      meal_time: "20:30:00",
      cutoff_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "sold",
      sold_at: new Date().toISOString(),
      qr_secret: "DEMO_ACTIVE_SECRET_MESS_A",
      short_code: "5521-VAL",
    },
    // 7. Already Used Token (For testing ALREADY_USED scan error)
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messA.id,
      meal_type: "lunch",
      meal_date: todayStr,
      meal_time: "13:00:00",
      cutoff_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 1 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "used",
      sold_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
      used_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
      scanned_by: messStaffId,
      qr_secret: "DEMO_USED_SECRET_999",
      short_code: "9999-USD",
    },
    // 8. Expired Token (For testing EXPIRED scan error)
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messA.id,
      meal_type: "breakfast",
      meal_date: todayStr,
      meal_time: "08:00:00",
      cutoff_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "expired",
      qr_secret: "DEMO_EXPIRED_SECRET_777",
      short_code: "7777-EXP",
    },
    // 9. Wrong Mess Token (Belongs to Girls Hostel B Mess, to test WRONG_MESS scan)
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messB ? messB.id : messA.id,
      meal_type: "dinner",
      meal_date: todayStr,
      meal_time: "20:30:00",
      cutoff_at: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      valid_until: new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      face_price: 40.0,
      list_price: 30.0,
      seller_payout: 22.0,
      mess_share: 4.0,
      platform_fee: 4.0,
      status: "sold",
      sold_at: new Date().toISOString(),
      qr_secret: "DEMO_WRONG_MESS_SECRET_444",
      short_code: "4444-WNG",
    },
  ];

  const { error: tokensError } = await supabase.from("tokens").insert(sampleTokens);
  if (tokensError) {
    console.error("Error inserting sample tokens:", tokensError.message);
  } else {
    console.log("Successfully seeded 9 tokens (listed, sold, used, expired, wrong mess)!");
  }

  // Insert wallet entries for student
  console.log("Seeding wallet entries...");
  await supabase.from("wallet_entries").insert([
    {
      user_id: studentId,
      amount: 22.0,
      type: "credit",
      status: "available",
      description: "Meal token redeemed: Lunch (Yesterday)",
    },
    {
      user_id: studentId,
      amount: 22.0,
      type: "credit",
      status: "pending",
      description: "Token sold: Dinner (Tonight - Active)",
    },
  ]);

  console.log("\n=== Seeding Finished Successfully! ===");
  console.log("Demo Credentials:");
  console.log("1. Student:    student@mealback.demo / password123 (Role: student)");
  console.log("2. Buyer:      buyer@mealback.demo   / password123 (Role: buyer)");
  console.log("3. Mess Staff: mess@mealback.demo    / password123 (Role: mess, Access Code: MESS-DEMO)");
  console.log("\nPre-configured Test Codes for Mess Scanner:");
  console.log("- Valid Ready Token:      5521-VAL (or secret: DEMO_ACTIVE_SECRET_MESS_A) -> VERIFIED");
  console.log("- Already Used Token:     9999-USD (or secret: DEMO_USED_SECRET_999)      -> ALREADY_USED");
  console.log("- Expired Token:          7777-EXP (or secret: DEMO_EXPIRED_SECRET_777)   -> EXPIRED");
  console.log("- Wrong Mess Token:       4444-WNG (or secret: DEMO_WRONG_MESS_SECRET_444)-> WRONG_MESS");
}

seed().catch((err) => {
  console.error("Fatal seed error:", err);
  process.exit(1);
});
