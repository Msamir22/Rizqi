const { createHash, createHmac } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_ANDROID_SUPABASE_URL = "http://10.0.2.2:54321";

const E2E_USER_FULL_NAME = "Monyvi E2E";
const FIXED_NOW = "2026-04-08T12:00:00.000Z";
const E2E_MARKET_RATE_ID = "00000000-0000-0000-0006-000000000001";

const CATEGORY_IDS = {
  shopping: "00000000-0000-0000-0001-000000000004",
  income: "00000000-0000-0000-0001-000000000011",
  other: "00000000-0000-0000-0001-000000000013",
};

const E2E_TABLE_DELETE_ORDER = [
  "transactions",
  "transfers",
  "recurring_payments",
  "budgets",
  "debts",
  "assets",
  "daily_snapshot_assets",
  "daily_snapshot_balance",
  "daily_snapshot_net_worth",
  "bank_details",
  "accounts",
  "user_category_settings",
  "categories",
  "profiles",
];
const AUTH_USER_PAGE_SIZE = 1000;

function deterministicUuid(namespace, label) {
  const hex = createHash("sha256")
    .update(`monyvi:e2e:${namespace}:${label}`)
    .digest("hex")
    .slice(0, 32);
  const chars = hex.split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const uuidHex = chars.join("");
  return [
    uuidHex.slice(0, 8),
    uuidHex.slice(8, 12),
    uuidHex.slice(12, 16),
    uuidHex.slice(16, 20),
    uuidHex.slice(20, 32),
  ].join("-");
}

function buildSeedIds(userId) {
  return {
    accounts: {
      cash: deterministicUuid(userId, "account:cash"),
      bank: deterministicUuid(userId, "account:bank"),
      wallet: deterministicUuid(userId, "account:wallet"),
    },
    bankDetails: {
      nbe: deterministicUuid(userId, "bank-detail:nbe"),
      qnb: deterministicUuid(userId, "bank-detail:qnb"),
    },
    transactions: {
      expense: deterministicUuid(userId, "transaction:expense"),
      income: deterministicUuid(userId, "transaction:income"),
    },
    transfers: {
      atm: deterministicUuid(userId, "transfer:atm"),
    },
  };
}

function base64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function createLocalSupabaseJwt(jwtSecret, role) {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: "supabase",
    ref: "localhost",
    role,
    iat: 1644431792,
    exp: 4102444800,
  };
  const signingInput = `${base64Url(header)}.${base64Url(payload)}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(signingInput)
    .digest("base64url");

  return `${signingInput}.${signature}`;
}

function requiredRemoteEnv(env, name) {
  const value = env[name];
  if (value) return value;
  throw new Error(`${name} is required when E2E_SUPABASE_MODE=remote`);
}

function requiredLocalEnv(env, name) {
  const value = env[name];
  if (value) return value;
  throw new Error(`${name} is required when E2E_SUPABASE_MODE=local`);
}

function getE2eSeedConfig(env = process.env) {
  const mode = env.E2E_SUPABASE_MODE === "remote" ? "remote" : "local";
  const isLocal = mode === "local";
  const localJwtSecret = isLocal ? env.E2E_LOCAL_JWT_SECRET : null;

  function getLocalJwt(role) {
    return createLocalSupabaseJwt(
      localJwtSecret ?? requiredLocalEnv(env, "E2E_LOCAL_JWT_SECRET"),
      role
    );
  }

  return {
    mode,
    supabaseUrl:
      env.E2E_SUPABASE_URL ??
      env.SUPABASE_URL ??
      (isLocal
        ? LOCAL_SUPABASE_URL
        : requiredRemoteEnv(env, "EXPO_PUBLIC_SUPABASE_URL")),
    appSupabaseUrl:
      env.EXPO_PUBLIC_SUPABASE_URL ??
      (isLocal ? LOCAL_ANDROID_SUPABASE_URL : env.E2E_SUPABASE_URL),
    serviceRoleKey:
      env.SUPABASE_SERVICE_ROLE_KEY ??
      (isLocal
        ? getLocalJwt("service_role")
        : requiredRemoteEnv(env, "SUPABASE_SERVICE_ROLE_KEY")),
    anonKey:
      env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
      (isLocal
        ? getLocalJwt("anon")
        : requiredRemoteEnv(env, "EXPO_PUBLIC_SUPABASE_ANON_KEY")),
    email:
      env.MAESTRO_E2E_EMAIL ??
      (isLocal
        ? requiredLocalEnv(env, "MAESTRO_E2E_EMAIL")
        : requiredRemoteEnv(env, "MAESTRO_E2E_EMAIL")),
    password:
      env.MAESTRO_E2E_PASSWORD ??
      (isLocal
        ? requiredLocalEnv(env, "MAESTRO_E2E_PASSWORD")
        : requiredRemoteEnv(env, "MAESTRO_E2E_PASSWORD")),
  };
}

async function assertNoError(result, label) {
  if (result && result.error) {
    throw new Error(`${label} failed: ${result.error.message}`);
  }
  return result;
}

async function ensureE2eUser(client, config) {
  const existingUser = await findE2eUser(client, config.email);
  if (existingUser) {
    await assertNoError(
      await client.auth.admin.updateUserById(existingUser.id, {
        password: config.password,
        email_confirm: true,
        user_metadata: { full_name: E2E_USER_FULL_NAME },
      }),
      "sync E2E user credentials"
    );
    return existingUser.id;
  }

  const createResult = await assertNoError(
    await client.auth.admin.createUser({
      email: config.email,
      password: config.password,
      email_confirm: true,
      user_metadata: { full_name: E2E_USER_FULL_NAME },
    }),
    "create E2E user"
  );

  return createResult.data.user.id;
}

async function findE2eUser(client, email) {
  let page = 1;

  while (true) {
    const usersResult = await assertNoError(
      await client.auth.admin.listUsers({
        page,
        perPage: AUTH_USER_PAGE_SIZE,
      }),
      "list E2E users"
    );
    const users = usersResult.data.users;
    const existingUser = users.find((user) => user.email === email);
    if (existingUser) {
      return existingUser;
    }

    if (users.length < AUTH_USER_PAGE_SIZE) {
      return null;
    }

    page += 1;
  }
}

async function deleteScopedRows(client, table, userId, seedIds) {
  if (table === "bank_details") {
    const deleteBuilder = client.from(table).delete();
    if (typeof deleteBuilder.in !== "function") {
      return assertNoError(
        await deleteBuilder.eq("account_id", seedIds.accounts.bank),
        `delete ${table}`
      );
    }

    return assertNoError(
      await deleteBuilder.in("account_id", Object.values(seedIds.accounts)),
      `delete ${table}`
    );
  }

  return assertNoError(
    await client.from(table).delete().eq("user_id", userId),
    `delete ${table}`
  );
}

async function upsertRows(client, table, rows, options) {
  const result = await client.from(table).upsert(rows, options);
  await assertNoError(result, `upsert ${table}`);
}

function buildSeedRows(userId) {
  const seedIds = buildSeedIds(userId);
  const currentTimestamp = new Date().toISOString();
  const currentDate = currentTimestamp.slice(0, 10);

  return {
    marketRate: {
      id: E2E_MARKET_RATE_ID,
      aed_usd: 0.2723,
      aud_usd: 0.66,
      bhd_usd: 2.65,
      btc_usd: 65000,
      cad_usd: 0.74,
      chf_usd: 1.1,
      cny_usd: 0.14,
      dkk_usd: 0.146,
      dzd_usd: 0.0074,
      egp_usd: 0.02,
      eur_usd: 1.09,
      gbp_usd: 1.27,
      gold_usd_per_gram: 75,
      hkd_usd: 0.128,
      inr_usd: 0.012,
      iqd_usd: 0.00076,
      isk_usd: 0.0072,
      jod_usd: 1.41,
      jpy_usd: 0.0065,
      kpw_usd: 0.0011,
      krw_usd: 0.00073,
      kwd_usd: 3.25,
      lyd_usd: 0.21,
      mad_usd: 0.1,
      myr_usd: 0.21,
      nok_usd: 0.094,
      nzd_usd: 0.61,
      omr_usd: 2.6,
      palladium_usd_per_gram: 32,
      platinum_usd_per_gram: 31,
      qar_usd: 0.2747,
      rub_usd: 0.011,
      sar_usd: 0.2667,
      sek_usd: 0.096,
      sgd_usd: 0.74,
      silver_usd_per_gram: 0.95,
      timestamp_currency: currentTimestamp,
      timestamp_metal: currentTimestamp,
      tnd_usd: 0.32,
      try_usd: 0.031,
      updated_at: currentTimestamp,
      zar_usd: 0.054,
      created_at: currentTimestamp,
    },
    profile: {
      user_id: userId,
      display_name: E2E_USER_FULL_NAME,
      preferred_currency: "EGP",
      preferred_language: "en",
      theme: "SYSTEM",
      sms_detection_enabled: false,
      onboarding_completed: true,
      setup_guide_completed: true,
      onboarding_flags: {},
      notification_settings: {
        sms_transaction_confirmation: true,
        recurring_reminders: true,
        budget_alerts: true,
        low_balance_warnings: false,
      },
      deleted: false,
      created_at: FIXED_NOW,
      updated_at: FIXED_NOW,
    },
    accounts: [
      {
        id: seedIds.accounts.cash,
        user_id: userId,
        name: "E2E Cash",
        type: "CASH",
        balance: 2500,
        currency: "EGP",
        is_default: true,
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
      {
        id: seedIds.accounts.bank,
        user_id: userId,
        name: "E2E NBE Bank",
        type: "BANK",
        balance: 12430.55,
        currency: "EGP",
        is_default: false,
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
      {
        id: seedIds.accounts.wallet,
        user_id: userId,
        name: "E2E Wallet",
        type: "DIGITAL_WALLET",
        balance: 950,
        currency: "EGP",
        is_default: false,
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
    ],
    bankDetails: [
      {
        id: seedIds.bankDetails.nbe,
        account_id: seedIds.accounts.bank,
        bank_name: "NBE",
        card_last_4: "4321",
        sms_sender_name: "NBE",
        account_number: "00004321",
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
      {
        id: seedIds.bankDetails.qnb,
        account_id: seedIds.accounts.bank,
        bank_name: "QNB",
        card_last_4: "5566",
        sms_sender_name: "QNB",
        account_number: "00005566",
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
    ],
    transactions: [
      {
        id: seedIds.transactions.expense,
        user_id: userId,
        account_id: seedIds.accounts.cash,
        amount: 125,
        currency: "EGP",
        type: "EXPENSE",
        category_id: CATEGORY_IDS.shopping,
        counterparty: "E2E Grocery",
        note: "Seeded expense",
        date: currentDate,
        source: "MANUAL",
        is_draft: false,
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
      {
        id: seedIds.transactions.income,
        user_id: userId,
        account_id: seedIds.accounts.bank,
        amount: 3000,
        currency: "EGP",
        type: "INCOME",
        category_id: CATEGORY_IDS.income,
        counterparty: "E2E Payroll",
        note: "Seeded income",
        date: currentDate,
        source: "MANUAL",
        is_draft: false,
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
    ],
    transfers: [
      {
        id: seedIds.transfers.atm,
        user_id: userId,
        from_account_id: seedIds.accounts.bank,
        to_account_id: seedIds.accounts.cash,
        amount: 500,
        currency: "EGP",
        exchange_rate: null,
        converted_amount: null,
        notes: "Seeded cash withdrawal",
        date: currentDate,
        deleted: false,
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW,
      },
    ],
  };
}

async function seedE2eData(client, config) {
  const userId = config.userId ?? (await ensureE2eUser(client, config));
  const seedIds = buildSeedIds(userId);
  const rows = buildSeedRows(userId);

  for (const table of E2E_TABLE_DELETE_ORDER) {
    await deleteScopedRows(client, table, userId, seedIds);
  }

  await upsertRows(client, "profiles", rows.profile, {
    onConflict: "user_id",
  });
  await upsertRows(client, "accounts", rows.accounts, { onConflict: "id" });
  await upsertRows(client, "bank_details", rows.bankDetails, {
    onConflict: "id",
  });
  await upsertRows(client, "transactions", rows.transactions, {
    onConflict: "id",
  });
  await upsertRows(client, "transfers", rows.transfers, { onConflict: "id" });
  await upsertRows(client, "market_rates", rows.marketRate, {
    onConflict: "id",
  });

  return { userId };
}

async function resetE2eData(client, config) {
  const userId = config.userId ?? (await ensureE2eUser(client, config));
  const seedIds = buildSeedIds(userId);

  for (const table of E2E_TABLE_DELETE_ORDER) {
    await deleteScopedRows(client, table, userId, seedIds);
  }

  return { userId };
}

async function main() {
  const config = getE2eSeedConfig();
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const action = process.argv[2] ?? "seed";
  if (action !== "seed" && action !== "reset") {
    throw new Error(`Unknown e2e seed action: ${action}`);
  }

  if (action === "reset") {
    const result = await resetE2eData(client, config);
    console.log(
      `Reset E2E data for ${config.email} (${result.userId}) on ${config.mode} Supabase`
    );
    return;
  }

  const result = await seedE2eData(client, config);
  console.log(
    `Seeded E2E data for ${config.email} (${result.userId}) on ${config.mode} Supabase`
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

module.exports = {
  E2E_TABLE_DELETE_ORDER,
  E2E_MARKET_RATE_ID,
  createLocalSupabaseJwt,
  getE2eSeedConfig,
  resetE2eData,
  seedE2eData,
};
