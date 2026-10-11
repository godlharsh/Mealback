import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.");
  console.error("Run with: npm run seed");
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
  const { data: usersData } = await supabase.auth.admin.listUsers();
  const existing = usersData?.users?.find((u) => u.email === email);
  let userId;

  if (existing) {
    console.log(`✓ User ${email} exists (${existing.id})`);
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
      console.warn(`Could not create ${email}:`, createError.message);
      return null;
    }
    userId = created.user.id;
    console.log(`✓ User ${email} created successfully!`);
  }

  // Try updating profile if table exists
  try {
    await supabase.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      role,
      mess_id: messId,
      hostel_room: room,
    });
  } catch (err) {
    // Table not created yet
  }

  return userId;
}

async function seed() {
  console.log("=== MealBack Seeding & Account Setup ===");

  // 1. Create demo users FIRST so login always works immediately!
  console.log("\n1. Ensuring Auth Demo Accounts exist...");
  const studentId = await getOrCreateUser(
    "student@mealback.demo",
    "password123",
    "student",
    "Aarav Sharma (Hostel A)",
    null,
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
    "Ramesh Kumar (Mess Manager)"
  );

  console.log("✓ All 3 demo auth users ready for sign in!");

  // 2. Check if database tables exist
  console.log("\n2. Checking PostgreSQL database tables...");
  const { data: messesCheck, error: tableError } = await supabase.from("messes").select("id").limit(1);

  if (tableError && tableError.message.includes("Could not find the table")) {
    console.log("\n------------------------------------------------------------------");
    console.log("⚠️  NOTICE: PostgreSQL tables have not been created in Supabase yet.");
    console.log("To create the tables & RPC functions:");
    console.log("1. Go to your Supabase Dashboard -> SQL Editor");
    console.log("2. Open and copy: supabase/schema.sql");
    console.log("3. Paste and click 'Run'.");
    console.log("4. Then run 'npm run seed' again to populate sample tokens!");
    console.log("------------------------------------------------------------------\n");
    return;
  }

  // 3. Create messes
  console.log("Creating Messes...");
  const { data: messA } = await supabase
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

  const messId = messA?.id;
  if (!messId) {
    console.error("Failed to retrieve Mess A ID.");
    return;
  }

  // Link profiles with mess
  if (studentId) {
    await supabase.from("profiles").upsert({
      id: studentId,
      email: "student@mealback.demo",
      full_name: "Aarav Sharma (Hostel A)",
      role: "student",
      mess_id: messId,
      hostel_room: "Room A-204",
    });
  }

  if (messStaffId) {
    await supabase.from("profiles").upsert({
      id: messStaffId,
      email: "mess@mealback.demo",
      full_name: "Ramesh Kumar (Mess Manager)",
      role: "mess",
      mess_id: messId,
    });
  }

  // 4. Create sample tokens
  console.log("Seeding sample tokens across lunch & dinner...");
  const todayStr = new Date().toISOString().split("T")[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const sampleTokens = [
    {
      seller_id: studentId,
      mess_id: messId,
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
    {
      seller_id: studentId,
      mess_id: messId,
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
    {
      seller_id: studentId,
      mess_id: messId,
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
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messId,
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
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messId,
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
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messId,
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
    {
      seller_id: studentId,
      buyer_id: buyerId,
      mess_id: messB ? messB.id : messId,
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

  await supabase.from("tokens").delete().eq("seller_id", studentId);
  const { error: insertError } = await supabase.from("tokens").insert(sampleTokens);
  if (insertError) {
    console.warn("Tokens insert note:", insertError.message);
  } else {
    console.log("✓ Sample tokens seeded successfully!");
  }

  console.log("\n=== Seeding Finished Successfully! ===");
}

seed().catch((err) => {
  console.error("Seed error:", err);
});
