import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SCRIPT_DIR = process.cwd();
const HUB_DIR = SCRIPT_DIR;
const REPO_ROOT = path.resolve(HUB_DIR, "..", "..");
const ALLOWED_TENANTS = new Set(["expo-cuu"]);
const EXPECTED_TENANT_ID_BY_SLUG = {
  "expo-cuu": "c1c5cb42-2dab-4516-ad50-73f1475051aa",
};
const DEFAULT_EXPORT_ROOT = path.join(REPO_ROOT, "artifacts", "foodkiosk-catalog-for-pos-kiosk");
const CATEGORY_NAMESPACE = "controlia-pos-simple-category";
const PRODUCT_NAMESPACE = "controlia-pos-simple-product";
const VARIANT_NAMESPACE = "controlia-pos-simple-variant";
const EXPECTED_BUCKET = "catalog-images";
const EXPECTED_DEST_TABLES = ["catalog_categories", "catalog_items", "catalog_variants"];
const SOURCE_HINT_TABLES = ["categories", "products", "kiosk_orders", "kiosk_order_items"];
const RESET_DEPENDENCY_TABLES = [
  "cuts",
  "catalog_categories",
  "catalog_items",
  "catalog_variants",
  "cash_shifts",
  "orders",
  "order_items",
  "order_lines",
  "order_events",
  "ticket_events",
  "print_jobs",
  "command_logs",
  "pos_orders",
  "pos_order_items",
  "pos_order_events",
  "pos_sync_outbox",
  "pos_order_sync_outbox",
  "pos_mutations",
  "pos_sync_mutations",
  "sales_pos_orders",
  "sales_pos_order_items",
  "products",
  "pos_devices",
  "kiosks",
  "pos_users",
];
const V2_RESET_DEPENDENCY_TABLES = [
  "products",
  "sellable_variants",
  "modifier_groups",
  "modifier_options",
  "product_modifier_group_assignments",
  "combo_slots",
  "combo_slot_options",
  "sales_accounts",
  "sales_account_assignments",
  "sales_account_lines",
  "sales_account_line_events",
  "sales_account_payments",
  "sales_account_events",
  "kitchen_ticket_batches",
  "kitchen_ticket_lines",
];
const LEGACY_RESET_DELETE_ORDER = [
  "order_events",
  "order_lines",
  "order_items",
  "orders",
  "catalog_variants",
  "catalog_items",
  "catalog_categories",
];
const FULL_RESET_DELETE_ORDER = [
  "kitchen_ticket_lines",
  "kitchen_ticket_batches",
  "sales_account_line_events",
  "sales_account_payments",
  "sales_account_events",
  "sales_account_lines",
  "sales_account_assignments",
  "sales_accounts",
  "combo_slot_options",
  "combo_slots",
  "product_modifier_group_assignments",
  "modifier_options",
  "modifier_groups",
  "sellable_variants",
  "products",
  ...LEGACY_RESET_DELETE_ORDER,
];
const OBSERVED_NOT_TOUCHED_TABLES = [
  "cash_shifts",
  "cuts",
  "ticket_events",
  "print_jobs",
  "command_logs",
  "pos_sync_outbox",
  "pos_order_sync_outbox",
  "pos_mutations",
  "pos_sync_mutations",
  "pos_orders",
  "pos_order_items",
  "pos_order_events",
  "sales_pos_orders",
  "sales_pos_order_items",
  "products",
  "pos_devices",
  "kiosks",
  "pos_users",
];
const DESTRUCTIVE_RESET_CONFIRMATION = "expo-cuu-delete-legacy-pos-orders-and-catalog";
const DESTRUCTIVE_RESET_CONFIRMATION_WITH_V2 = "expo-cuu-delete-pos-test-data-including-v2";
const OUT_OF_SCOPE_V2_DEPENDENCY_TABLES = [
  "sales_pos_product_recipe_bindings",
  "sales_pos_inventory_modifier_rules",
  "sales_pos_inventory_modifier_rule_matchers",
  "sales_pos_inventory_consumption_events",
  "sales_pos_inventory_consumption_lines",
];

function parseArgs(argv) {
  const args = {
    tenant: "",
    confirmTenant: "",
    confirmDestructiveReset: "",
    sourceDir: "",
    dryRun: true,
    apply: false,
    resetExistingSimpleCatalog: false,
    resetLegacyPosTestData: false,
    resetExpoCuuPosTestDataIncludingV2: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--tenant") {
      args.tenant = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--source-dir") {
      args.sourceDir = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--confirm-tenant") {
      args.confirmTenant = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--confirm-destructive-reset") {
      args.confirmDestructiveReset = String(argv[index + 1] || "").trim();
      index += 1;
      continue;
    }
    if (token === "--apply") {
      args.apply = true;
      args.dryRun = false;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      args.apply = false;
      continue;
    }
    if (token === "--reset-existing-simple-catalog") {
      args.resetExistingSimpleCatalog = true;
      continue;
    }
    if (token === "--reset-legacy-pos-test-data") {
      args.resetLegacyPosTestData = true;
      args.resetExistingSimpleCatalog = true;
      continue;
    }
    if (token === "--reset-expo-cuu-pos-test-data-including-v2") {
      args.resetExpoCuuPosTestDataIncludingV2 = true;
      args.resetLegacyPosTestData = true;
      args.resetExistingSimpleCatalog = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printHelp();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (!args.tenant) {
    throw new Error("Missing required --tenant <tenant-slug>.");
  }

  return args;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/import-foodkiosk-simple-catalog.mjs --tenant expo-cuu [--source-dir <path>] [--dry-run] [--apply] [--reset-legacy-pos-test-data] [--reset-expo-cuu-pos-test-data-including-v2] [--confirm-tenant expo-cuu] [--confirm-destructive-reset expo-cuu-delete-legacy-pos-orders-and-catalog]

Flags:
  --tenant     Required. Only expo-cuu is allowed by default.
  --source-dir Optional. Defaults to latest export under artifacts/foodkiosk-catalog-for-pos-kiosk/.
  --dry-run    Default mode. Validates package and prints planned DB/storage operations.
  --apply      Writes to Supabase DB and Storage. Not used in this iteration.
  --reset-existing-simple-catalog  Plans a destructive reset of the tenant simple catalog before import.
  --reset-legacy-pos-test-data  Plans a destructive reset of legacy/simple POS test data: orders + simple catalog.
  --reset-expo-cuu-pos-test-data-including-v2 Plans a destructive reset of expo-cuu test data including v2 catalog dependencies.
  --confirm-tenant Required together with --apply destructive reset flags. Must exactly match the tenant slug.
  --confirm-destructive-reset Required together with --apply destructive reset flags. Must equal expo-cuu-delete-legacy-pos-orders-and-catalog or expo-cuu-delete-pos-test-data-including-v2 depending on the reset mode.
`);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function resolveLatestExportDir(rootDir) {
  if (!fs.existsSync(rootDir)) {
    throw new Error(`Export root not found: ${rootDir}`);
  }

  const candidates = fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(rootDir, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        fullPath,
        mtimeMs: stat.mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No export directories found under ${rootDir}`);
  }

  return {
    selected: candidates[0].fullPath,
    others: candidates.slice(1).map((entry) => entry.fullPath),
  };
}

function readJsonFile(filePath, expectedKind, validation) {
  if (!fs.existsSync(filePath)) {
    validation.invalidJsonFiles.push({
      file: path.relative(REPO_ROOT, filePath),
      reason: "missing_file",
    });
    throw new Error(`Required file missing: ${filePath}`);
  }

  try {
    const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (expectedKind === "array" && !Array.isArray(value)) {
      validation.invalidJsonFiles.push({
        file: path.relative(REPO_ROOT, filePath),
        reason: "expected_array",
      });
      throw new Error(`Expected array JSON in ${filePath}`);
    }
    if (expectedKind === "object" && (!value || Array.isArray(value) || typeof value !== "object")) {
      validation.invalidJsonFiles.push({
        file: path.relative(REPO_ROOT, filePath),
        reason: "expected_object",
      });
      throw new Error(`Expected object JSON in ${filePath}`);
    }
    return value;
  } catch (error) {
    if (!validation.invalidJsonFiles.some((entry) => entry.file === path.relative(REPO_ROOT, filePath))) {
      validation.invalidJsonFiles.push({
        file: path.relative(REPO_ROOT, filePath),
        reason: error instanceof Error ? error.message : "invalid_json",
      });
    }
    throw error;
  }
}

function isLikelySecret(key, value) {
  const normalizedKey = String(key || "").toLowerCase();
  if (!/(token|secret|api[_-]?key|service[_-]?role|password)/.test(normalizedKey)) {
    return false;
  }
  return typeof value === "string" && value.trim().length > 12;
}

function inspectForSecrets(value, trail, findings) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectForSecrets(item, `${trail}[${index}]`, findings));
    return;
  }
  if (!value || typeof value !== "object") {
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    if (isLikelySecret(key, nested)) {
      findings.push({
        path: `${trail}.${key}`,
      });
    }
    inspectForSecrets(nested, `${trail}.${key}`, findings);
  }
}

function slugify(input) {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function stableUuid(namespace, value) {
  const hash = crypto.createHash("sha1").update(`${namespace}:${value}`).digest("hex");
  const bytes = hash.slice(0, 32).split("");
  bytes[12] = "5";
  const variant = Number.parseInt(bytes[16], 16);
  bytes[16] = ((variant & 0x3) | 0x8).toString(16);
  return [
    bytes.slice(0, 8).join(""),
    bytes.slice(8, 12).join(""),
    bytes.slice(12, 16).join(""),
    bytes.slice(16, 20).join(""),
    bytes.slice(20, 32).join(""),
  ].join("-");
}

function extFromFile(relativePath) {
  const ext = path.extname(relativePath || "").toLowerCase().replace(/^\./, "");
  return ext || "bin";
}

function relativeRepoPath(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}

function buildRepresentativeCategoryImageMap(categories, products, baseDir) {
  const byCategory = new Map();
  for (const product of products) {
    if (!product.category_source_id || !product.local_image_file) continue;
    const fullPath = path.join(baseDir, product.local_image_file);
    if (!fs.existsSync(fullPath)) continue;
    const bucket = byCategory.get(product.category_source_id) || [];
    bucket.push(product);
    byCategory.set(product.category_source_id, bucket);
  }

  const result = new Map();
  for (const category of categories) {
    const candidates = byCategory.get(category.source_id) || [];
    const chosen = candidates
      .slice()
      .sort((left, right) => {
        if (Boolean(left.is_popular) !== Boolean(right.is_popular)) {
          return left.is_popular ? -1 : 1;
        }
        return String(left.name).localeCompare(String(right.name), "es-MX");
      })[0];

    if (!chosen) {
      result.set(category.source_id, null);
      continue;
    }

    result.set(category.source_id, {
      sourceProductId: chosen.source_id,
      localImageFile: chosen.local_image_file,
      ext: extFromFile(chosen.local_image_file),
    });
  }

  return result;
}

function createSupabaseClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) {
    return null;
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchRows(client, table, columns, filterTenantId) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];
  while (true) {
    let query = client.from(table).select(columns).range(from, from + pageSize - 1);
    if (filterTenantId) {
      query = query.eq("tenant_id", filterTenantId);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

async function countRows(client, table, filterTenantId) {
  let query = client.from(table).select("id", { count: "exact", head: true });
  if (filterTenantId) {
    query = query.eq("tenant_id", filterTenantId);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return Number(count || 0);
}

async function listStorageObjects(client, bucket, prefix) {
  const files = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) {
      throw new Error(`storage ${bucket}/${prefix}: ${error.message}`);
    }
    const page = data || [];
    for (const entry of page) {
      if (!entry || !entry.name || entry.id == null) continue;
      files.push(`${prefix}/${entry.name}`);
    }
    if (page.length < 100) break;
    offset += page.length;
  }
  return files;
}

async function inspectDestination(client, tenantSlug, manifest) {
  const inspection = {
    available: Boolean(client),
    projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
    tenant: null,
    bucket: null,
    tables: [],
    columnsByTable: {},
    blockers: [],
    warnings: [],
    appearsToBeSourceProject: false,
  };

  if (!client) {
    inspection.blockers.push("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for destination inspection.");
    return inspection;
  }

  const { data: tableRows, error: tableError } = await client
    .schema("information_schema")
    .from("tables")
    .select("table_schema, table_name")
    .eq("table_schema", "public")
    .in("table_name", ["tenants", ...EXPECTED_DEST_TABLES, ...SOURCE_HINT_TABLES]);

  if (tableError) {
    inspection.warnings.push(`Unable to inspect information_schema.tables: ${tableError.message}`);
  } else {
    inspection.tables = (tableRows || []).map((row) => row.table_name);
  }

  const { data: columnRows, error: columnError } = await client
    .schema("information_schema")
    .from("columns")
    .select("table_name, column_name")
    .eq("table_schema", "public")
    .in("table_name", EXPECTED_DEST_TABLES);

  if (columnError) {
    inspection.warnings.push(`Unable to inspect information_schema.columns: ${columnError.message}`);
  } else {
    for (const row of columnRows || []) {
      const set = inspection.columnsByTable[row.table_name] || new Set();
      set.add(row.column_name);
      inspection.columnsByTable[row.table_name] = set;
    }
  }

  const { data: tenantRows, error: tenantError } = await client
    .from("tenants")
    .select("id, slug, name")
    .eq("slug", tenantSlug)
    .limit(1);

  if (tenantError) {
    inspection.blockers.push(`Unable to resolve tenant ${tenantSlug}: ${tenantError.message}`);
  } else {
    inspection.tenant = (tenantRows || [])[0] || null;
    if (!inspection.tenant) {
      inspection.blockers.push(`Tenant ${tenantSlug} not found in public.tenants.`);
    } else if (EXPECTED_TENANT_ID_BY_SLUG[tenantSlug] && inspection.tenant.id !== EXPECTED_TENANT_ID_BY_SLUG[tenantSlug]) {
      inspection.blockers.push(
        `Tenant ${tenantSlug} resolved to unexpected id ${inspection.tenant.id}. Expected ${EXPECTED_TENANT_ID_BY_SLUG[tenantSlug]}.`,
      );
    }
  }

  const requiredTableChecks = [
    { table: "catalog_categories", select: "id, image_path" },
    { table: "catalog_items", select: "id, image_path" },
    { table: "catalog_variants", select: "id" },
  ];

  for (const check of requiredTableChecks) {
    const { error } = await client.from(check.table).select(check.select).limit(1);
    if (error) {
      inspection.blockers.push(`Table check failed for public.${check.table}: ${error.message}`);
      continue;
    }
    if (!inspection.tables.includes(check.table)) {
      inspection.tables.push(check.table);
    }
  }

  const { data: buckets, error: bucketError } = await client.storage.listBuckets();
  if (bucketError) {
    inspection.blockers.push(`Unable to inspect storage bucket ${EXPECTED_BUCKET}: ${bucketError.message}`);
  } else {
    inspection.bucket = (buckets || []).find((bucket) => bucket.id === EXPECTED_BUCKET) || null;
    if (!inspection.bucket) {
      inspection.blockers.push(`Bucket ${EXPECTED_BUCKET} not found in storage.`);
    }
  }

  const categoryColumns = inspection.columnsByTable.catalog_categories || new Set();
  const itemColumns = inspection.columnsByTable.catalog_items || new Set();
  if (categoryColumns.size > 0 && !categoryColumns.has("image_path")) {
    inspection.blockers.push("Missing required column public.catalog_categories.image_path.");
  }
  if (itemColumns.size > 0 && !itemColumns.has("image_path")) {
    inspection.blockers.push("Missing required column public.catalog_items.image_path.");
  }

  if (!categoryColumns.size) {
    const { error } = await client.from("catalog_categories").select("image_path").limit(1);
    if (error) {
      inspection.blockers.push(`Column check failed for public.catalog_categories.image_path: ${error.message}`);
    }
  }
  if (!itemColumns.size) {
    const { error } = await client.from("catalog_items").select("image_path").limit(1);
    if (error) {
      inspection.blockers.push(`Column check failed for public.catalog_items.image_path: ${error.message}`);
    }
  }

  const sourceTableChecks = [];
  for (const tableName of SOURCE_HINT_TABLES) {
    const { error } = await client.from(tableName).select("id").limit(1);
    if (!error) {
      sourceTableChecks.push(tableName);
    }
  }

  const sourceHintsFound = SOURCE_HINT_TABLES.filter((name) => inspection.tables.includes(name));
  const detectedSourceTables = sourceHintsFound.length ? sourceHintsFound : sourceTableChecks;
  if (detectedSourceTables.length >= 2 && !EXPECTED_DEST_TABLES.some((name) => inspection.tables.includes(name))) {
    inspection.appearsToBeSourceProject = true;
    inspection.blockers.push(
      `Connected Supabase project appears to be the source export project, not the destination simple catalog project. Found source-like tables: ${detectedSourceTables.join(", ")}.`,
    );
  }

  if (
    inspection.projectUrl &&
    manifest &&
    inspection.projectUrl.replace(/\/$/, "") === String(manifest.source_project_url || "").replace(/\/$/, "")
  ) {
    inspection.appearsToBeSourceProject = true;
    inspection.blockers.push(
      `Connected Supabase URL matches export source_project_url (${manifest.source_project_url}). Destination validation is blocked until the correct project is connected.`,
    );
  }

  return inspection;
}

async function inspectResetDependencies(client, destinationInspection, options = {}) {
  const result = {
    available: Boolean(client && destinationInspection?.tenant),
    countsByTable: {},
    deletePlan: [],
    notTouchedTables: [],
    referencedOrderItems: {
      totalLines: 0,
      distinctCatalogItems: 0,
      items: [],
      unreferencedCatalogItems: [],
    },
    storage: {
      existingCategoryObjects: [],
      existingProductObjects: [],
      potentialOrphanObjectsAfterReset: [],
    },
    warnings: [],
    blockers: [],
  };

  if (!result.available) {
    result.warnings.push("Reset dependency inspection skipped because destination tenant inspection is unavailable.");
    return result;
  }

  const tenantId = destinationInspection.tenant.id;
  for (const table of RESET_DEPENDENCY_TABLES) {
    try {
      result.countsByTable[table] = await countRows(client, table, tenantId);
    } catch (error) {
      result.warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  result.deletePlan = LEGACY_RESET_DELETE_ORDER.map((table) => ({
    table,
    count: Number(result.countsByTable[table] || 0),
    tenantFilter: `tenant_id = ${tenantId}`,
    reason:
      table === "order_events"
        ? "Legacy/simple POS order event rows depend on orders."
        : table === "order_lines"
          ? "Legacy/simple POS open-tab lines depend on orders and catalog_items."
          : table === "order_items"
            ? "Legacy/simple POS paid order rows depend on orders and catalog_items."
            : table === "orders"
              ? "Legacy/simple POS test orders must be removed before replacing the simple catalog."
              : table === "catalog_variants"
                ? "Simple catalog variants depend on catalog_items."
                : table === "catalog_items"
                  ? "Simple catalog items are being fully replaced by the imported catalog."
                  : "Simple catalog categories are being fully replaced by the imported catalog.",
    isCatalogDependency: ["catalog_variants", "catalog_items", "catalog_categories", "order_items", "order_lines"].includes(table),
    isLegacySimplePosData: true,
  }));

  result.notTouchedTables = OBSERVED_NOT_TOUCHED_TABLES.map((table) => ({
    table,
    count: Number(result.countsByTable[table] || 0),
    tenantFilter: `tenant_id = ${tenantId}`,
    willDelete: false,
  }));

  try {
    const [orderItems, catalogItems] = await Promise.all([
      fetchRows(
        client,
        "order_items",
        "catalog_item_id, qty, line_total_cents",
        tenantId,
      ),
      fetchRows(client, "catalog_items", "id, name", tenantId),
    ]);
    const itemStats = new Map();
    for (const row of orderItems) {
      if (!row.catalog_item_id) continue;
      const bucket = itemStats.get(row.catalog_item_id) || {
        catalogItemId: row.catalog_item_id,
        lines: 0,
        qty: 0,
        totalCents: 0,
      };
      bucket.lines += 1;
      bucket.qty += Number(row.qty || 0);
      bucket.totalCents += Number(row.line_total_cents || 0);
      itemStats.set(row.catalog_item_id, bucket);
    }

    const catalogNameById = new Map(catalogItems.map((row) => [row.id, row.name]));
    const referencedItems = [...itemStats.values()]
      .map((row) => ({
        ...row,
        name: catalogNameById.get(row.catalogItemId) || null,
      }))
      .sort((left, right) => right.lines - left.lines || String(left.name || "").localeCompare(String(right.name || "")));

    const referencedIds = new Set(referencedItems.map((row) => row.catalogItemId));
    result.referencedOrderItems = {
      totalLines: orderItems.length,
      distinctCatalogItems: referencedItems.length,
      items: referencedItems,
      unreferencedCatalogItems: catalogItems.filter((row) => !referencedIds.has(row.id)),
    };

    if (referencedItems.length > 0) {
      result.warnings.push(
        `Reset would delete ${referencedItems.length} catalog_items currently referenced by ${orderItems.length} order_items rows. Business decision marks them as disposable legacy/simple POS test data.`,
      );
    }
  } catch (error) {
    result.warnings.push(error instanceof Error ? error.message : String(error));
  }

  try {
    const [categoryObjects, productObjects] = await Promise.all([
      listStorageObjects(client, EXPECTED_BUCKET, `${tenantId}/categories`),
      listStorageObjects(client, EXPECTED_BUCKET, `${tenantId}/items`),
    ]);
    result.storage.existingCategoryObjects = categoryObjects;
    result.storage.existingProductObjects = productObjects;
  } catch (error) {
    result.warnings.push(error instanceof Error ? error.message : String(error));
  }

  const forbiddenBlockingTables = result.notTouchedTables.filter(
    (entry) =>
      [
        "ticket_events",
        "print_jobs",
        "command_logs",
        "pos_sync_outbox",
        "pos_order_sync_outbox",
        "pos_mutations",
        "pos_sync_mutations",
        ...(options.includeV2CatalogReset ? [] : ["products"]),
      ].includes(entry.table) && entry.count > 0,
  );
  if (forbiddenBlockingTables.length > 0) {
    result.blockers.push(
      `Detected populated legacy/support tables outside the approved delete set: ${forbiddenBlockingTables.map((entry) => `${entry.table}=${entry.count}`).join(", ")}.`,
    );
  }

  return result;
}

async function inspectV2Dependencies(client, destinationInspection) {
  const result = {
    available: Boolean(client && destinationInspection?.tenant),
    countsByTable: {},
    deletePlan: [],
    warnings: [],
    blockers: [],
    samples: {},
  };

  if (!result.available) {
    result.warnings.push("V2 dependency inspection skipped because destination tenant inspection is unavailable.");
    return result;
  }

  const tenantId = destinationInspection.tenant.id;
  for (const table of V2_RESET_DEPENDENCY_TABLES) {
    try {
      result.countsByTable[table] = await countRows(client, table, tenantId);
    } catch (error) {
      result.warnings.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const table of OUT_OF_SCOPE_V2_DEPENDENCY_TABLES) {
    try {
      result.countsByTable[table] = await countRows(client, table, tenantId);
    } catch (error) {
      result.warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  result.deletePlan = FULL_RESET_DELETE_ORDER.map((table) => ({
    table,
    count: Number(result.countsByTable[table] || 0),
    tenantFilter: `tenant_id = ${tenantId}`,
  }));

  try {
    const [
      productRows,
      variantRows,
      comboSlotRows,
      comboOptionRows,
      accountRows,
      lineRows,
      paymentRows,
      ticketBatchRows,
      ticketLineRows,
    ] = await Promise.all([
      fetchRows(client, "products", "id, name, category_id, product_type, is_active, deleted_at", tenantId),
      fetchRows(client, "sellable_variants", "id, product_id, name, is_default, is_active, deleted_at", tenantId),
      fetchRows(client, "combo_slots", "id, product_id, slot_key, name, selection_mode, is_active, deleted_at", tenantId),
      fetchRows(
        client,
        "combo_slot_options",
        "id, combo_slot_id, linked_product_id, linked_sellable_variant_id, name, is_default, is_active, deleted_at",
        tenantId,
      ),
      fetchRows(
        client,
        "sales_accounts",
        "id, status, folio_text, total_cents, balance_due_cents, service_context, opened_at, closed_at",
        tenantId,
      ),
      fetchRows(
        client,
        "sales_account_lines",
        "id, sales_account_id, product_id, selected_variant_id, line_kind, line_status, product_name_snapshot, created_at",
        tenantId,
      ),
      fetchRows(
        client,
        "sales_account_payments",
        "id, sales_account_id, payment_status, payment_method, amount_paid_cents, paid_at",
        tenantId,
      ),
      fetchRows(
        client,
        "kitchen_ticket_batches",
        "id, sales_account_id, batch_number, batch_status, trigger_type, requested_at",
        tenantId,
      ),
      fetchRows(
        client,
        "kitchen_ticket_lines",
        "id, kitchen_ticket_batch_id, sales_account_id, sales_account_line_id, ticket_action, product_name_snapshot, created_at",
        tenantId,
      ),
    ]);

    result.samples = {
      products: productRows.slice(0, 10),
      sellableVariants: variantRows.slice(0, 10),
      comboSlots: comboSlotRows.slice(0, 10),
      comboSlotOptions: comboOptionRows.slice(0, 10),
      salesAccounts: accountRows.slice(0, 10),
      salesAccountLines: lineRows.slice(0, 20),
      salesAccountPayments: paymentRows.slice(0, 20),
      kitchenTicketBatches: ticketBatchRows.slice(0, 20),
      kitchenTicketLines: ticketLineRows.slice(0, 20),
    };

    if (accountRows.length > 0) {
      const openAccounts = accountRows.filter((row) => row.status === "OPEN").length;
      const paidAccounts = accountRows.filter((row) => row.status === "PAID").length;
      result.warnings.push(
        `Authorized v2 reset will delete sales_accounts=${accountRows.length} (OPEN=${openAccounts}, PAID=${paidAccounts}), sales_account_lines=${lineRows.length}, kitchen_ticket_batches=${ticketBatchRows.length}.`,
      );
    }
    if (paymentRows.length > 0) {
      result.warnings.push(
        `Authorized v2 reset will delete sales_account_payments=${paymentRows.length} captured payments for expo-cuu.`,
      );
    }
  } catch (error) {
    result.warnings.push(error instanceof Error ? error.message : String(error));
  }

  const populatedOutOfScopeDependencies = OUT_OF_SCOPE_V2_DEPENDENCY_TABLES.filter(
    (table) => Number(result.countsByTable[table] || 0) > 0,
  );
  if (populatedOutOfScopeDependencies.length > 0) {
    result.blockers.push(
      `Detected populated dependencies outside the approved reset scope: ${populatedOutOfScopeDependencies
        .map((table) => `${table}=${result.countsByTable[table]}`)
        .join(", ")}.`,
    );
  }

  return result;
}

function buildCategoryPlans({ categories, representativeImages, tenantId, tenantSlug }) {
  return categories.map((category) => {
    const destinationId = stableUuid(CATEGORY_NAMESPACE, `${tenantSlug}:${category.source_id}`);
    const representative = representativeImages.get(category.source_id);
    const imagePath = representative
      ? `${tenantId}/categories/${destinationId}.${representative.ext}`
      : null;
    return {
      sourceId: category.source_id,
      destinationId,
      name: category.name,
      slug: category.slug || slugify(category.name),
      sortOrder: Number.isFinite(category.sort_order) ? Number(category.sort_order) : 0,
      isActive: category.is_active !== false,
      imagePath,
      localImageFile: representative?.localImageFile || null,
      representativeProductImage: Boolean(representative),
      representativeSourceProductId: representative?.sourceProductId || null,
    };
  });
}

function buildProductPlans({ products, categoryPlanBySourceId, tenantId, tenantSlug, sourceDir, warnings }) {
  return products.map((product) => {
    const destinationId = stableUuid(PRODUCT_NAMESPACE, `${tenantSlug}:${product.source_id}`);
    const categoryPlan = categoryPlanBySourceId.get(product.category_source_id);
    const localImageExists = Boolean(
      product.local_image_file && fs.existsSync(path.join(sourceDir, product.local_image_file)),
    );
    if (product.local_image_file && !localImageExists) {
      warnings.push(`Missing local product image file for ${product.name}: ${product.local_image_file}`);
    }
    return {
      sourceId: product.source_id,
      destinationId,
      categorySourceId: product.category_source_id,
      categoryDestinationId: categoryPlan?.destinationId || null,
      name: product.name,
      slug: product.slug || slugify(product.name),
      class: product.class === "drink" ? "drink" : "food",
      priceCents: Number(product.price_cents),
      isActive: product.is_active !== false,
      isSoldOut: product.is_sold_out === true,
      isPopular: product.is_popular === true,
      hasVariants: product.has_variants === true,
      notes: product.notes || null,
      imagePath: localImageExists
        ? `${tenantId}/items/${destinationId}.${extFromFile(product.local_image_file)}`
        : null,
      localImageFile: localImageExists ? product.local_image_file : null,
      sourceImagePath: product.source_image_path || null,
    };
  });
}

function buildVariantPlans({ variants, productPlanBySourceId, tenantSlug }) {
  return variants.map((variant) => {
    const destinationId = stableUuid(VARIANT_NAMESPACE, `${tenantSlug}:${variant.source_id}`);
    return {
      sourceId: variant.source_id,
      destinationId,
      productSourceId: variant.product_source_id || variant.catalog_item_source_id || null,
      productDestinationId:
        productPlanBySourceId.get(variant.product_source_id || variant.catalog_item_source_id || "")?.destinationId || null,
      label: variant.label || null,
      isActive: variant.is_active !== false,
    };
  });
}

function diffCategory(existing, planned) {
  return {
    name: existing.name !== planned.name,
    sort_order: Number(existing.sort_order || 0) !== planned.sortOrder,
    is_active: Boolean(existing.is_active) !== planned.isActive,
    image_path: (existing.image_path || null) !== (planned.imagePath || null),
  };
}

function diffProduct(existing, planned) {
  return {
    category_id: (existing.category_id || null) !== (planned.categoryDestinationId || null),
    name: existing.name !== planned.name,
    class: (existing.class || null) !== planned.class,
    price_cents: Number(existing.price_cents || 0) !== planned.priceCents,
    is_active: Boolean(existing.is_active) !== planned.isActive,
    is_sold_out: Boolean(existing.is_sold_out) !== planned.isSoldOut,
    is_popular: Boolean(existing.is_popular) !== planned.isPopular,
    has_variants: Boolean(existing.has_variants) !== planned.hasVariants,
    image_path: (existing.image_path || null) !== (planned.imagePath || null),
  };
}

function hasAnyTrue(diffObject) {
  return Object.values(diffObject).some(Boolean);
}

function buildOperationPlan({ categoryPlans, productPlans, variantPlans, destinationInspection, existingData }) {
  const warnings = [];
  const blockers = [...destinationInspection.blockers];

  const existingCategoriesById = new Map((existingData.categories || []).map((row) => [row.id, row]));
  const existingProductsById = new Map((existingData.products || []).map((row) => [row.id, row]));

  const existingCategoriesByName = new Map();
  for (const row of existingData.categories || []) {
    const key = slugify(row.name);
    const bucket = existingCategoriesByName.get(key) || [];
    bucket.push(row);
    existingCategoriesByName.set(key, bucket);
  }

  const categoryOps = categoryPlans.map((plan) => {
    const existingById = existingCategoriesById.get(plan.destinationId);
    const sameNameRows = existingCategoriesByName.get(slugify(plan.name)) || [];

    if (existingById) {
      const changes = diffCategory(existingById, plan);
      return {
        ...plan,
        operation: hasAnyTrue(changes) ? "update" : "noop",
        changes,
      };
    }

    const conflictByName = sameNameRows.find((row) => row.id !== plan.destinationId);
    if (conflictByName) {
      warnings.push(
        `Category name conflict for "${plan.name}". Existing row ${conflictByName.id} does not match deterministic import id ${plan.destinationId}.`,
      );
      return {
        ...plan,
        operation: "conflict",
        changes: null,
      };
    }

    return {
      ...plan,
      operation: "insert",
      changes: null,
    };
  });

  const categoryIdBySourceId = new Map(categoryOps.map((entry) => [entry.sourceId, entry.destinationId]));

  const productKeyConflictMap = new Map();
  for (const row of existingData.products || []) {
    const key = `${row.category_id || ""}|${slugify(row.name)}|${Number(row.price_cents || 0)}|${row.class || ""}`;
    const bucket = productKeyConflictMap.get(key) || [];
    bucket.push(row);
    productKeyConflictMap.set(key, bucket);
  }

  const productOps = productPlans.map((plan) => {
    const existingById = existingProductsById.get(plan.destinationId);
    if (!categoryIdBySourceId.has(plan.categorySourceId)) {
      blockers.push(`Product ${plan.name} references missing category source id ${plan.categorySourceId}.`);
      return {
        ...plan,
        operation: "blocked",
        changes: null,
      };
    }

    if (existingById) {
      const changes = diffProduct(existingById, plan);
      return {
        ...plan,
        operation: hasAnyTrue(changes) ? "update" : "noop",
        changes,
      };
    }

    const key = `${plan.categoryDestinationId || ""}|${slugify(plan.name)}|${plan.priceCents}|${plan.class}`;
    const conflicts = productKeyConflictMap.get(key) || [];
    const conflict = conflicts.find((row) => row.id !== plan.destinationId);
    if (conflict) {
      warnings.push(
        `Product conflict for "${plan.name}" (${plan.priceCents}) in category ${plan.categoryDestinationId}. Existing row ${conflict.id} does not match deterministic import id ${plan.destinationId}.`,
      );
      return {
        ...plan,
        operation: "conflict",
        changes: null,
      };
    }

    return {
      ...plan,
      operation: "insert",
      changes: null,
    };
  });

  const variantOps = variantPlans.map((plan) => ({
    ...plan,
    operation: "unsupported",
  }));

  return {
    categoryOps,
    productOps,
    variantOps,
    warnings,
    blockers,
  };
}

function summarizeOperations(operationPlan) {
  const countBy = (entries, value) => entries.filter((entry) => entry.operation === value).length;
  const categoriesWithImage = operationPlan.categoryOps.filter((entry) => entry.imagePath).length;
  const productsWithImage = operationPlan.productOps.filter((entry) => entry.imagePath).length;

  return {
    categories: {
      insert: countBy(operationPlan.categoryOps, "insert"),
      update: countBy(operationPlan.categoryOps, "update"),
      noop: countBy(operationPlan.categoryOps, "noop"),
      conflict: countBy(operationPlan.categoryOps, "conflict"),
      blocked: countBy(operationPlan.categoryOps, "blocked"),
      withImageUpload: categoriesWithImage,
      representativeProductImage: operationPlan.categoryOps.filter((entry) => entry.representativeProductImage).length,
    },
    products: {
      insert: countBy(operationPlan.productOps, "insert"),
      update: countBy(operationPlan.productOps, "update"),
      noop: countBy(operationPlan.productOps, "noop"),
      conflict: countBy(operationPlan.productOps, "conflict"),
      blocked: countBy(operationPlan.productOps, "blocked"),
      withImageUpload: productsWithImage,
    },
    variants: {
      total: operationPlan.variantOps.length,
      unsupported: countBy(operationPlan.variantOps, "unsupported"),
    },
    warnings: operationPlan.warnings.length,
    blockers: operationPlan.blockers.length,
  };
}

function summarizeResetPlan(resetPlan, plannedImagePaths) {
  const existingObjects = [
    ...(resetPlan.storage?.existingCategoryObjects || []),
    ...(resetPlan.storage?.existingProductObjects || []),
  ];
  const futureImageSet = new Set(plannedImagePaths.filter(Boolean));
  const potentialOrphansAfterReset = existingObjects
    .filter((objectPath) => !futureImageSet.has(objectPath))
    .sort((left, right) => left.localeCompare(right, "en"));

  resetPlan.storage.potentialOrphanObjectsAfterReset = potentialOrphansAfterReset;

  return {
    requested: true,
    deletePlan: resetPlan.deletePlan,
    countsByTable: resetPlan.countsByTable,
    notTouchedTables: resetPlan.notTouchedTables,
    referencedOrderItems: {
      totalLines: resetPlan.referencedOrderItems.totalLines,
      distinctCatalogItems: resetPlan.referencedOrderItems.distinctCatalogItems,
      unreferencedCatalogItems: resetPlan.referencedOrderItems.unreferencedCatalogItems.length,
      topReferencedItems: resetPlan.referencedOrderItems.items.slice(0, 10),
    },
    storage: {
      existingCategoryObjects: resetPlan.storage.existingCategoryObjects.length,
      existingProductObjects: resetPlan.storage.existingProductObjects.length,
      potentialOrphanObjectsAfterReset: potentialOrphansAfterReset.length,
      samplePotentialOrphans: potentialOrphansAfterReset.slice(0, 10),
    },
    warnings: resetPlan.warnings,
    blockers: resetPlan.blockers,
  };
}

function summarizeV2ResetPlan(v2Plan) {
  if (!v2Plan) return null;
  return {
    requested: true,
    deletePlan: v2Plan.deletePlan,
    countsByTable: v2Plan.countsByTable,
    warnings: v2Plan.warnings,
    blockers: v2Plan.blockers,
    sample: v2Plan.samples,
  };
}

function buildCategoryRows({ tenantId, operationPlan }) {
  return operationPlan.categoryOps
    .filter((entry) => entry.operation === "insert" || entry.operation === "update")
    .map((entry) => ({
      id: entry.destinationId,
      tenant_id: tenantId,
      name: entry.name,
      sort_order: entry.sortOrder,
      is_active: entry.isActive,
      image_path: entry.imagePath,
      updated_at: new Date().toISOString(),
    }));
}

function buildProductRows({ tenantId, operationPlan }) {
  return operationPlan.productOps
    .filter((entry) => entry.operation === "insert" || entry.operation === "update")
    .map((entry) => ({
      id: entry.destinationId,
      tenant_id: tenantId,
      category_id: entry.categoryDestinationId,
      type: "product",
      class: entry.class,
      name: entry.name,
      price_cents: entry.priceCents,
      is_active: entry.isActive,
      has_variants: entry.hasVariants,
      is_sold_out: entry.isSoldOut,
      is_popular: entry.isPopular,
      image_path: entry.imagePath,
      updated_at: new Date().toISOString(),
    }));
}

function buildUploads(operationPlan) {
  return [
    ...operationPlan.categoryOps
      .filter((entry) => entry.imagePath && entry.localImageFile)
      .map((entry) => ({ path: entry.imagePath, localFile: entry.localImageFile })),
    ...operationPlan.productOps
      .filter((entry) => entry.imagePath && entry.localImageFile)
      .map((entry) => ({ path: entry.imagePath, localFile: entry.localImageFile })),
  ];
}

async function uploadPlanImages({ client, operationPlan, sourceDir }) {
  const uploads = buildUploads(operationPlan);
  for (const upload of uploads) {
    const fullPath = path.join(sourceDir, upload.localFile);
    const bytes = fs.readFileSync(fullPath);
    const contentType = guessContentType(upload.localFile);
    const { error } = await client.storage
      .from(EXPECTED_BUCKET)
      .upload(upload.path, bytes, { upsert: true, contentType });
    if (error) {
      throw new Error(`Unable to upload ${upload.path}: ${error.message}`);
    }
  }
  return uploads.length;
}

async function executeResetPlan({ client, tenantId, resetPlan, label }) {
  const appliedDeletes = [];
  for (const step of resetPlan.deletePlan || []) {
    const { error, count } = await client
      .from(step.table)
      .delete({ count: "exact" })
      .eq("tenant_id", tenantId);
    if (error) {
      throw new Error(
        `${label} failed while deleting ${step.table} for tenant ${tenantId}: ${error.message}. Already deleted: ${appliedDeletes
          .map((entry) => `${entry.table}=${entry.deletedCount}`)
          .join(", ") || "none"}.`,
      );
    }
    appliedDeletes.push({
      table: step.table,
      plannedCount: Number(step.count || 0),
      deletedCount: Number(count || 0),
    });
  }
  return appliedDeletes;
}

async function applyPlan({ client, tenantId, operationPlan, sourceDir, resetPlan, resetLegacyPosTestData }) {
  if (!client) {
    throw new Error("Cannot apply without Supabase client.");
  }

  for (const entry of operationPlan.categoryOps) {
    if (!["insert", "update", "noop"].includes(entry.operation)) {
      throw new Error(`Cannot apply category operation ${entry.operation} for ${entry.name}.`);
    }
  }
  for (const entry of operationPlan.productOps) {
    if (!["insert", "update", "noop"].includes(entry.operation)) {
      throw new Error(`Cannot apply product operation ${entry.operation} for ${entry.name}.`);
    }
  }
  const result = {
    uploadedObjects: 0,
    deletes: [],
    categoriesUpserted: 0,
    productsUpserted: 0,
  };

  if (resetLegacyPosTestData) {
    result.deletes = await executeResetPlan({
      client,
      tenantId,
      resetPlan,
      label: "Tenant reset",
    });
  }

  const categoryRows = buildCategoryRows({ tenantId, operationPlan });

  if (categoryRows.length) {
    const { error } = await client
      .from("catalog_categories")
      .upsert(categoryRows, { onConflict: "id" });
    if (error) {
      throw new Error(`Unable to upsert catalog_categories: ${error.message}`);
    }
    result.categoriesUpserted = categoryRows.length;
  }

  const productRows = buildProductRows({ tenantId, operationPlan });

  if (productRows.length) {
    const { error } = await client
      .from("catalog_items")
      .upsert(productRows, { onConflict: "id" });
    if (error) {
      throw new Error(`Unable to upsert catalog_items: ${error.message}`);
    }
    result.productsUpserted = productRows.length;
  }
  result.uploadedObjects = await uploadPlanImages({ client, operationPlan, sourceDir });
  return result;
}

function guessContentType(fileName) {
  const ext = extFromFile(fileName);
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  return "application/octet-stream";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!ALLOWED_TENANTS.has(args.tenant)) {
    throw new Error(`Tenant ${args.tenant} is not allowed. Allowed tenants: ${[...ALLOWED_TENANTS].join(", ")}`);
  }
  if (args.confirmTenant && args.confirmTenant !== args.tenant) {
    throw new Error(`--confirm-tenant must exactly match --tenant. Received ${args.confirmTenant} vs ${args.tenant}.`);
  }
  if (args.apply && (args.resetExistingSimpleCatalog || args.resetLegacyPosTestData) && args.confirmTenant !== args.tenant) {
    throw new Error(`--apply with --reset-existing-simple-catalog requires --confirm-tenant ${args.tenant}.`);
  }
  if (
    args.apply &&
    args.resetExpoCuuPosTestDataIncludingV2 &&
    args.confirmDestructiveReset !== DESTRUCTIVE_RESET_CONFIRMATION_WITH_V2
  ) {
    throw new Error(
      `--apply with v2 destructive reset requires --confirm-destructive-reset ${DESTRUCTIVE_RESET_CONFIRMATION_WITH_V2}.`,
    );
  }
  if (
    args.apply &&
    (args.resetExistingSimpleCatalog || args.resetLegacyPosTestData) &&
    !args.resetExpoCuuPosTestDataIncludingV2 &&
    args.confirmDestructiveReset !== DESTRUCTIVE_RESET_CONFIRMATION
  ) {
    throw new Error(
      `--apply with destructive reset requires --confirm-destructive-reset ${DESTRUCTIVE_RESET_CONFIRMATION}.`,
    );
  }

  loadEnvFile(path.join(HUB_DIR, ".env.local"));

  const exportSelection = args.sourceDir
    ? { selected: path.resolve(REPO_ROOT, args.sourceDir), others: [] }
    : resolveLatestExportDir(DEFAULT_EXPORT_ROOT);

  const sourceDir = exportSelection.selected;
  const validation = {
    invalidJsonFiles: [],
    missingLocalFiles: [],
    invalidPriceRows: [],
    missingCategoryRefs: [],
    absolutePathRows: [],
    secretLeaks: [],
    warnings: [],
  };

  const manifest = readJsonFile(path.join(sourceDir, "manifest.json"), "object", validation);
  const categories = readJsonFile(path.join(sourceDir, "categories.json"), "array", validation);
  const products = readJsonFile(path.join(sourceDir, "products.json"), "array", validation);
  const variants = readJsonFile(path.join(sourceDir, "variants.json"), "array", validation);
  const imageMap = readJsonFile(path.join(sourceDir, "image-map.json"), "object", validation);

  inspectForSecrets(manifest, "manifest", validation.secretLeaks);
  inspectForSecrets(categories, "categories", validation.secretLeaks);
  inspectForSecrets(products, "products", validation.secretLeaks);
  inspectForSecrets(variants, "variants", validation.secretLeaks);
  inspectForSecrets(imageMap, "imageMap", validation.secretLeaks);

  const categoryIds = new Set(categories.map((row) => row.source_id));
  for (const product of products) {
    if (product.category_source_id != null && !categoryIds.has(product.category_source_id)) {
      validation.missingCategoryRefs.push({
        sourceId: product.source_id,
        categorySourceId: product.category_source_id,
      });
    }
    if (!Number.isInteger(product.price_cents) || Number(product.price_cents) < 0) {
      validation.invalidPriceRows.push({
        sourceId: product.source_id,
        priceCents: product.price_cents,
      });
    }
    if (product.local_image_file && path.isAbsolute(product.local_image_file)) {
      validation.absolutePathRows.push({
        sourceId: product.source_id,
        localImageFile: product.local_image_file,
      });
    }
    if (product.local_image_file) {
      const fullPath = path.join(sourceDir, product.local_image_file);
      if (!fs.existsSync(fullPath)) {
        validation.missingLocalFiles.push({
          sourceId: product.source_id,
          localImageFile: product.local_image_file,
        });
      }
    }
  }

  for (const category of categories) {
    if (category.local_image_file && path.isAbsolute(category.local_image_file)) {
      validation.absolutePathRows.push({
        sourceId: category.source_id,
        localImageFile: category.local_image_file,
      });
    }
    if (category.local_image_file) {
      const fullPath = path.join(sourceDir, category.local_image_file);
      if (!fs.existsSync(fullPath)) {
        validation.missingLocalFiles.push({
          sourceId: category.source_id,
          localImageFile: category.local_image_file,
        });
      }
    }
  }

  const destinationClient = createSupabaseClientFromEnv();
  const destinationInspection = await inspectDestination(destinationClient, args.tenant, manifest);
  if (
    destinationInspection.tenant &&
    EXPECTED_TENANT_ID_BY_SLUG[args.tenant] &&
    destinationInspection.tenant.id !== EXPECTED_TENANT_ID_BY_SLUG[args.tenant]
  ) {
    throw new Error(
      `Tenant id mismatch for ${args.tenant}. Expected ${EXPECTED_TENANT_ID_BY_SLUG[args.tenant]} but got ${destinationInspection.tenant.id}.`,
    );
  }
  const resetDependencyInspection = args.resetExistingSimpleCatalog
    ? await inspectResetDependencies(destinationClient, destinationInspection, {
        includeV2CatalogReset: args.resetExpoCuuPosTestDataIncludingV2,
      })
    : null;
  const v2DependencyInspection = args.resetExpoCuuPosTestDataIncludingV2
    ? await inspectV2Dependencies(destinationClient, destinationInspection)
    : null;

  const tenantId = destinationInspection.tenant?.id || `tenant-slug:${args.tenant}`;
  const representativeImages = buildRepresentativeCategoryImageMap(categories, products, sourceDir);
  const categoryPlans = buildCategoryPlans({
    categories,
    representativeImages,
    tenantId,
    tenantSlug: args.tenant,
  });
  const categoryPlanBySourceId = new Map(categoryPlans.map((entry) => [entry.sourceId, entry]));
  const planWarnings = [...validation.warnings];
  const productPlans = buildProductPlans({
    products,
    categoryPlanBySourceId,
    tenantId,
    tenantSlug: args.tenant,
    sourceDir,
    warnings: planWarnings,
  });
  const productPlanBySourceId = new Map(productPlans.map((entry) => [entry.sourceId, entry]));
  const variantPlans = buildVariantPlans({
    variants,
    productPlanBySourceId,
    tenantSlug: args.tenant,
  });

  let existingData = { categories: [], products: [] };
  if (
    destinationClient &&
    destinationInspection.tenant &&
    destinationInspection.blockers.length === 0
  ) {
    existingData = {
      categories: await fetchRows(
        destinationClient,
        "catalog_categories",
        "id, tenant_id, name, sort_order, is_active, image_path",
        destinationInspection.tenant.id,
      ),
      products: await fetchRows(
        destinationClient,
        "catalog_items",
        "id, tenant_id, category_id, name, class, price_cents, is_active, has_variants, is_sold_out, is_popular, image_path",
        destinationInspection.tenant.id,
      ),
    };
  }
  const effectiveExistingData = args.resetLegacyPosTestData
    ? { categories: [], products: [] }
    : existingData;

  const operationPlan = buildOperationPlan({
    categoryPlans,
    productPlans,
    variantPlans,
    destinationInspection,
    existingData: effectiveExistingData,
  });
  operationPlan.warnings.push(...planWarnings);
  if (resetDependencyInspection) {
    operationPlan.warnings.push(...resetDependencyInspection.warnings);
    operationPlan.blockers.push(...resetDependencyInspection.blockers);
  }
  if (v2DependencyInspection) {
    operationPlan.warnings.push(...v2DependencyInspection.warnings);
    operationPlan.blockers.push(...v2DependencyInspection.blockers);
  }

  const summary = summarizeOperations(operationPlan);
  const plannedImagePaths = [
    ...operationPlan.categoryOps.map((entry) => entry.imagePath),
    ...operationPlan.productOps.map((entry) => entry.imagePath),
  ].filter(Boolean);
  const resetSummary = resetDependencyInspection
    ? summarizeResetPlan(resetDependencyInspection, plannedImagePaths)
    : null;
  const v2ResetSummary = summarizeV2ResetPlan(v2DependencyInspection);
  const effectiveResetSummary =
    args.resetExpoCuuPosTestDataIncludingV2 && v2DependencyInspection
      ? {
          ...resetDependencyInspection,
          deletePlan: v2DependencyInspection.deletePlan,
        }
      : resetDependencyInspection;
  const finalReport = {
    mode: args.apply ? "apply" : "dry-run",
    tenant: args.tenant,
    confirmTenant: args.confirmTenant || null,
    confirmDestructiveReset: args.confirmDestructiveReset || null,
    sourceDir: relativeRepoPath(sourceDir),
    otherExportsDetected: exportSelection.others.map(relativeRepoPath),
    resetExistingSimpleCatalog: args.resetExistingSimpleCatalog,
    resetLegacyPosTestData: args.resetLegacyPosTestData,
    resetExpoCuuPosTestDataIncludingV2: args.resetExpoCuuPosTestDataIncludingV2,
    packageValidation: {
      manifestExportedAt: manifest.exported_at || null,
      counts: manifest.counts || null,
      invalidJsonFiles: validation.invalidJsonFiles,
      missingLocalFiles: validation.missingLocalFiles,
      invalidPriceRows: validation.invalidPriceRows,
      missingCategoryRefs: validation.missingCategoryRefs,
      absolutePathRows: validation.absolutePathRows,
      secretLeaks: validation.secretLeaks,
    },
    destinationInspection: {
      projectUrl: destinationInspection.projectUrl,
      tenant: destinationInspection.tenant,
      bucket: destinationInspection.bucket,
      tables: destinationInspection.tables,
      blockers: destinationInspection.blockers,
      warnings: destinationInspection.warnings,
      appearsToBeSourceProject: destinationInspection.appearsToBeSourceProject,
    },
    resetPlan: resetSummary,
    v2ResetPlan: v2ResetSummary,
    summary,
    categorySample: operationPlan.categoryOps.slice(0, 10),
    productSample: operationPlan.productOps.slice(0, 15),
    warnings: operationPlan.warnings,
    blockers: operationPlan.blockers,
  };

  if (args.apply) {
    if (operationPlan.blockers.length > 0) {
      throw new Error(`Cannot apply while blockers exist:\n- ${operationPlan.blockers.join("\n- ")}`);
    }
    const applyResult = await applyPlan({
      client: destinationClient,
      tenantId: destinationInspection.tenant.id,
      operationPlan,
      sourceDir,
      resetPlan: effectiveResetSummary,
      resetLegacyPosTestData: args.resetLegacyPosTestData,
    });
    finalReport.applyResult = applyResult;
  }

  console.log(JSON.stringify(finalReport, null, 2));
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
