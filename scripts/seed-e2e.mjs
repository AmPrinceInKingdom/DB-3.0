import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

const presetEnvKeys = new Set(Object.keys(process.env));

function parseEnvValue(raw) {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath, { allowOverrideFromFile = false } = {}) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalIndex = trimmed.indexOf("=");
    if (equalIndex <= 0) continue;

    const key = trimmed.slice(0, equalIndex).trim();
    const value = parseEnvValue(trimmed.slice(equalIndex + 1));
    if (!key) continue;

    if (presetEnvKeys.has(key)) continue;
    if (!allowOverrideFromFile && process.env[key] !== undefined) continue;
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  const projectRoot = process.cwd();
  loadEnvFile(path.join(projectRoot, ".env"));
  loadEnvFile(path.join(projectRoot, ".env.local"), {
    allowOverrideFromFile: true,
  });
}

loadLocalEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const seededAdmin = {
  email: process.env.E2E_ADMIN_EMAIL?.trim().toLowerCase() || "e2e-admin@dealbazaar.test",
  password: process.env.E2E_ADMIN_PASSWORD?.trim() || "DealBazaar@2026#E2E",
  firstName: process.env.E2E_ADMIN_FIRST_NAME?.trim() || "E2E",
  lastName: process.env.E2E_ADMIN_LAST_NAME?.trim() || "Admin",
};

const seededCustomer = {
  email: process.env.E2E_CUSTOMER_EMAIL?.trim().toLowerCase() || "e2e-customer@dealbazaar.test",
  password: process.env.E2E_CUSTOMER_PASSWORD?.trim() || "DealBazaar@2026#Customer",
  firstName: process.env.E2E_CUSTOMER_FIRST_NAME?.trim() || "E2E",
  lastName: process.env.E2E_CUSTOMER_LAST_NAME?.trim() || "Customer",
};

const seededProducts = [
  {
    slug: "16tb-usb-3-2-flash-drive",
    name: "16TB USB 3.2 Flash Drive",
    sku: "E2E-USB32-16TB",
    category: { name: "Electronics", slug: "electronics" },
    brand: { name: "ByteCore", slug: "bytecore" },
    shortDescription: "High-speed compact storage with durable metal body.",
    description:
      "Deterministic E2E seeded product for checkout, cart, and product-details regression tests.",
    price: "3890",
    oldPrice: "4790",
    stockQuantity: 120,
    imageUrl:
      "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    trending: true,
    bestSeller: true,
    newArrival: true,
  },
  {
    slug: "bluetooth-smart-glasses",
    name: "Bluetooth Smart Glasses",
    sku: "E2E-GLASS-BT",
    category: { name: "Electronics", slug: "electronics" },
    brand: { name: "VisionLab", slug: "visionlab" },
    shortDescription: "Open-ear audio eyewear with blue light protection.",
    description:
      "Second deterministic E2E product used for multi-item cart selection and checkout coverage.",
    price: "26870",
    oldPrice: "36170",
    stockQuantity: 80,
    imageUrl:
      "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1200&q=80",
    featured: true,
    trending: false,
    bestSeller: false,
    newArrival: true,
  },
];

async function upsertSingle(table, payload, onConflict, select = "*") {
  const { data, error } = await supabase
    .from(table)
    .upsert(payload, { onConflict })
    .select(select)
    .single();

  if (error) {
    throw new Error(`[${table}] ${error.message}`);
  }

  return data;
}

async function ensureDefaultPlatformData() {
  await upsertSingle(
    "supported_currencies",
    {
      code: "LKR",
      name: "Sri Lankan Rupee",
      symbol: "Rs.",
      decimals: 0,
      is_active: true,
      is_base: true,
    },
    "code",
    "code",
  );

  await upsertSingle(
    "shipping_methods",
    {
      code: "STANDARD",
      name: "Standard Delivery",
      description: "Reliable island-wide delivery",
      base_fee: "450",
      estimated_days_min: 2,
      estimated_days_max: 7,
      is_active: true,
    },
    "code",
    "code",
  );
}

async function upsertAuthUser(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await upsertSingle(
    "users",
    {
      email: input.email,
      password_hash: passwordHash,
      role: input.role,
      status: "ACTIVE",
      email_verified_at: new Date().toISOString(),
    },
    "email",
    "id,email,role",
  );

  await upsertSingle(
    "user_profiles",
    {
      user_id: user.id,
      first_name: input.firstName,
      last_name: input.lastName,
      preferred_currency: "LKR",
      preferred_shipping_method_code: "STANDARD",
      preferred_language: "en",
      theme_preference: "system",
    },
    "user_id",
    "user_id",
  );

  if (input.role === "ADMIN" || input.role === "SUPER_ADMIN") {
    await upsertSingle(
      "admins",
      {
        user_id: user.id,
        can_manage_admins: true,
        notes: "Deterministic E2E admin account",
      },
      "user_id",
      "user_id",
    );
  }

  return user;
}

async function upsertDeterministicProduct(definition) {
  const category = await upsertSingle(
    "categories",
    {
      name: definition.category.name,
      slug: definition.category.slug,
      description: `${definition.category.name} category for deterministic E2E coverage`,
      is_active: true,
      sort_order: 1,
      seo_keywords: [],
    },
    "slug",
    "id",
  );

  const brand = await upsertSingle(
    "brands",
    {
      name: definition.brand.name,
      slug: definition.brand.slug,
      is_active: true,
    },
    "slug",
    "id",
  );

  const product = await upsertSingle(
    "products",
    {
      category_id: category.id,
      brand_id: brand.id,
      name: definition.name,
      slug: definition.slug,
      sku: definition.sku,
      short_description: definition.shortDescription,
      description: definition.description,
      status: "ACTIVE",
      stock_status: "IN_STOCK",
      current_price: definition.price,
      old_price: definition.oldPrice,
      stock_quantity: definition.stockQuantity,
      featured: definition.featured,
      trending: definition.trending,
      best_seller: definition.bestSeller,
      new_arrival: definition.newArrival,
      seo_keywords: ["e2e", "deal-bazaar", "deterministic"],
      published_at: new Date().toISOString(),
    },
    "slug",
    "id,slug,name",
  );

  const { error: deleteImageError } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", product.id);
  if (deleteImageError) {
    throw new Error(`[product_images] ${deleteImageError.message}`);
  }

  const { error: insertImageError } = await supabase.from("product_images").insert([
    {
      product_id: product.id,
      image_url: definition.imageUrl,
      alt_text: definition.name,
      sort_order: 0,
      is_main: true,
    },
    {
      product_id: product.id,
      image_url: definition.imageUrl,
      alt_text: `${definition.name} gallery`,
      sort_order: 1,
      is_main: false,
    },
  ]);
  if (insertImageError) {
    throw new Error(`[product_images] ${insertImageError.message}`);
  }

  return product;
}

async function main() {
  await ensureDefaultPlatformData();

  const admin = await upsertAuthUser({
    ...seededAdmin,
    role: "SUPER_ADMIN",
  });

  const customer = await upsertAuthUser({
    ...seededCustomer,
    role: "CUSTOMER",
  });

  const seeded = [];
  for (const product of seededProducts) {
    const row = await upsertDeterministicProduct(product);
    seeded.push(row);
  }

  console.log("E2E deterministic seed completed:");
  console.log(`- Admin: ${admin.email} (${admin.role})`);
  console.log(`- Customer: ${customer.email} (${customer.role})`);
  console.log(`- Products: ${seeded.map((item) => item.slug).join(", ")}`);
  console.log("");
  console.log("Suggested env for admin smoke:");
  console.log(`E2E_ADMIN_EMAIL=${admin.email}`);
  console.log(`E2E_ADMIN_PASSWORD=${seededAdmin.password}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed deterministic E2E data:", error.message);
    process.exitCode = 1;
  });
