import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const read = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const url = read('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
const serviceKey = read('SUPABASE_SERVICE_ROLE_KEY');

const tenantId = 'c1c5cb42-2dab-4516-ad50-73f1475051aa';
const tenantSlug = 'expo-cuu';
const stamp = Date.now();
const manageEmail = `krecipes.manage.${stamp}@demo.local`;
const viewerEmail = `krecipes.viewer.${stamp}@demo.local`;
const password = `T3st!Kitchen#${String(stamp).slice(-6)}`;

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

const out = { tenantId, tenantSlug, stamp, users: {}, checks: {}, ids: {}, errors: [] };
const must = async (p, label) => {
  const r = await p;
  if (r.error) {
    out.errors.push({ label, message: r.error.message, details: r.error.details, code: r.error.code });
    throw new Error(`${label}: ${r.error.message}`);
  }
  return r.data;
};
const normalize = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

try {
  const tmRows = await must(admin.from('tenant_modules').select('id,module_key,enabled').eq('tenant_id', tenantId), 'select tenant_modules');
  out.checks.tenantModulesBefore = tmRows;
  if (!tmRows.some((r) => r.module_key === 'kitchen_recipes' && r.enabled)) {
    await must(admin.from('tenant_modules').upsert({ tenant_id: tenantId, module_key: 'kitchen_recipes', enabled: true }, { onConflict: 'tenant_id,module_key' }), 'upsert tenant_modules kitchen_recipes');
    out.checks.kitchenRecipesModuleEnabled = true;
  }

  const manageUser = await must(admin.auth.admin.createUser({ email: manageEmail, password, email_confirm: true }), 'create manage user');
  const viewerUser = await must(admin.auth.admin.createUser({ email: viewerEmail, password, email_confirm: true }), 'create viewer user');
  out.users.manage = { id: manageUser.user.id, email: manageEmail };
  out.users.viewer = { id: viewerUser.user.id, email: viewerEmail };

  await must(admin.from('tenant_memberships').insert({ tenant_id: tenantId, user_id: manageUser.user.id, role: 'operator' }), 'insert manage membership');
  await must(admin.from('tenant_memberships').insert({ tenant_id: tenantId, user_id: viewerUser.user.id, role: 'viewer' }), 'insert viewer membership');

  const manageSignIn = await anon.auth.signInWithPassword({ email: manageEmail, password });
  if (manageSignIn.error) throw new Error(`manage sign in failed: ${manageSignIn.error.message}`);
  const viewerSignIn = await anon.auth.signInWithPassword({ email: viewerEmail, password });
  if (viewerSignIn.error) throw new Error(`viewer sign in failed: ${viewerSignIn.error.message}`);

  const manageClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${manageSignIn.data.session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
  const viewerClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${viewerSignIn.data.session.access_token}` } }, auth: { persistSession: false, autoRefreshToken: false } });

  const items = await must(manageClient.from('kitchen_inventory_items').select('id,name,current_unit_cost,default_unit_id,tenant_id').eq('tenant_id', tenantId).gt('current_unit_cost', 0).limit(5), 'select inventory items');
  if (items.length < 2) throw new Error('Not enough inventory items with cost > 0');
  out.checks.itemsUsed = items.slice(0, 3);

  const recipeName = `TEST Receta Costeo Runtime ${stamp}`;
  const recipe = await must(manageClient.from('kitchen_recipe_recipes').insert({ tenant_id: tenantId, name: recipeName, normalized_name: normalize(recipeName), status: 'draft', default_yield_quantity: 1, default_servings: 10, created_by: manageUser.user.id }).select('id,tenant_id,name,normalized_name,default_servings,default_yield_quantity,created_by').single(), 'insert recipe');
  out.ids.recipeId = recipe.id;

  const version = await must(manageClient.from('kitchen_recipe_versions').insert({ tenant_id: tenantId, recipe_id: recipe.id, version_number: 1, status: 'draft', yield_quantity: 1, servings: 10, created_by: manageUser.user.id }).select('id,tenant_id,recipe_id,version_number,status,yield_quantity,servings,created_by').single(), 'insert recipe version');
  out.ids.versionId = version.id;

  const line1 = await must(manageClient.from('kitchen_recipe_lines').insert({ tenant_id: tenantId, recipe_version_id: version.id, line_type: 'inventory_item', item_id: items[0].id, quantity: 2, unit_id: items[0].default_unit_id, waste_percent: 0, created_by: manageUser.user.id }).select('id,quantity,waste_percent').single(), 'insert line1');
  const line2 = await must(manageClient.from('kitchen_recipe_lines').insert({ tenant_id: tenantId, recipe_version_id: version.id, line_type: 'inventory_item', item_id: items[1].id, quantity: 1.5, unit_id: items[1].default_unit_id, waste_percent: 0, created_by: manageUser.user.id }).select('id,quantity,waste_percent').single(), 'insert line2');
  out.ids.lineIds = [line1.id, line2.id];

  const viewerInsert = await viewerClient.from('kitchen_recipe_recipes').insert({ tenant_id: tenantId, name: `TEST viewer denied ${stamp}`, normalized_name: `test_viewer_denied_${stamp}`, default_yield_quantity: 1 });
  out.checks.viewerInsertDenied = Boolean(viewerInsert.error);
  out.checks.viewerInsertDeniedError = viewerInsert.error?.message ?? null;

  const badQty = await manageClient.from('kitchen_recipe_lines').insert({ tenant_id: tenantId, recipe_version_id: version.id, line_type: 'inventory_item', item_id: items[0].id, quantity: 0, unit_id: items[0].default_unit_id, waste_percent: 0 });
  out.checks.quantityConstraintBlocked = Boolean(badQty.error);

  const badWaste = await manageClient.from('kitchen_recipe_lines').insert({ tenant_id: tenantId, recipe_version_id: version.id, line_type: 'inventory_item', item_id: items[0].id, quantity: 1, unit_id: items[0].default_unit_id, waste_percent: 100 });
  out.checks.wasteConstraintBlocked = Boolean(badWaste.error);

  const baseTotal = 2 * Number(items[0].current_unit_cost) + 1.5 * Number(items[1].current_unit_cost);
  out.checks.costBase = { total_cost: baseTotal, cost_per_serving: baseTotal / 10, cost_per_yield_unit: baseTotal };

  const lineWaste = await must(manageClient.from('kitchen_recipe_lines').insert({ tenant_id: tenantId, recipe_version_id: version.id, line_type: 'inventory_item', item_id: items[0].id, quantity: 1, unit_id: items[0].default_unit_id, waste_percent: 10, created_by: manageUser.user.id }).select('id').single(), 'insert waste line');
  out.ids.wasteLineId = lineWaste.id;
  const totalWithWaste = baseTotal + (1 * Number(items[0].current_unit_cost) * 1.1);
  out.checks.costWithWaste = { total_cost: totalWithWaste, increase_vs_base: totalWithWaste - baseTotal };

  const allUnits = await must(manageClient.from('kitchen_inventory_units').select('id,code').eq('tenant_id', tenantId), 'select units');
  const altUnit = allUnits.find((u) => u.id !== items[0].default_unit_id);
  if (altUnit) {
    const mismatchLine = await must(manageClient.from('kitchen_recipe_lines').insert({ tenant_id: tenantId, recipe_version_id: version.id, line_type: 'inventory_item', item_id: items[0].id, quantity: 1, unit_id: altUnit.id, waste_percent: 0, created_by: manageUser.user.id }).select('id,unit_id').single(), 'insert mismatch unit line');
    out.ids.mismatchLineId = mismatchLine.id;

    const conv = await must(manageClient.from('kitchen_inventory_unit_conversions').select('id').eq('tenant_id', tenantId).eq('from_unit_id', altUnit.id).eq('to_unit_id', items[0].default_unit_id).maybeSingle(), 'check conversion direct');
    const convReverse = await must(manageClient.from('kitchen_inventory_unit_conversions').select('id').eq('tenant_id', tenantId).eq('from_unit_id', items[0].default_unit_id).eq('to_unit_id', altUnit.id).maybeSingle(), 'check conversion reverse');
    out.checks.missingConversionLikely = !conv && !convReverse;
  }

  const snapshot = await must(manageClient.from('kitchen_recipe_cost_snapshots').insert({ tenant_id: tenantId, recipe_id: recipe.id, recipe_version_id: version.id, snapshot_type: 'current', total_cost: totalWithWaste, cost_per_serving: totalWithWaste / 10, cost_per_yield_unit: totalWithWaste, currency: 'MXN', costing_payload: { source: 'runtime-test', lines: out.ids.lineIds }, warnings: out.checks.missingConversionLikely ? [{ type: 'missing_conversion', message: 'Test warning' }] : [], created_by: manageUser.user.id }).select('id,total_cost,snapshot_type,created_by').single(), 'insert snapshot');
  out.ids.snapshotId = snapshot.id;

  const viewerSnapshot = await viewerClient.from('kitchen_recipe_cost_snapshots').insert({ tenant_id: tenantId, recipe_id: recipe.id, recipe_version_id: version.id, snapshot_type: 'current', total_cost: 1, currency: 'MXN', costing_payload: {}, warnings: [] });
  out.checks.viewerSnapshotDenied = Boolean(viewerSnapshot.error);
  out.checks.viewerSnapshotDeniedError = viewerSnapshot.error?.message ?? null;

  await must(manageClient.from('kitchen_recipe_versions').update({ status: 'archived' }).eq('tenant_id', tenantId).eq('recipe_id', recipe.id).eq('status', 'active'), 'archive prior actives');
  await must(manageClient.from('kitchen_recipe_versions').update({ status: 'active', activated_at: new Date().toISOString(), activated_by: manageUser.user.id }).eq('tenant_id', tenantId).eq('id', version.id), 'activate version');
  await must(manageClient.from('kitchen_recipe_recipes').update({ status: 'active' }).eq('tenant_id', tenantId).eq('id', recipe.id), 'activate recipe');

  const activeVersions = await must(manageClient.from('kitchen_recipe_versions').select('id,status').eq('tenant_id', tenantId).eq('recipe_id', recipe.id).eq('status', 'active'), 'select active versions');
  out.checks.activeVersionCount = activeVersions.length;

  const counts = {};
  for (const table of ['kitchen_recipe_recipes','kitchen_recipe_versions','kitchen_recipe_lines','kitchen_recipe_cost_snapshots']) {
    const { count, error } = await manageClient.from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId);
    if (error) throw error;
    counts[table] = count;
  }
  out.checks.tenantCounts = counts;

  out.cleanup_sql = `-- TEST CLEANUP (no ejecutar sin revisar)\n-- tenant: ${tenantId}\n-- recipe: ${recipe.id}\n\nDELETE FROM public.kitchen_recipe_cost_snapshots WHERE tenant_id = '${tenantId}' AND recipe_id = '${recipe.id}';\nDELETE FROM public.kitchen_recipe_lines WHERE tenant_id = '${tenantId}' AND recipe_version_id = '${version.id}';\nDELETE FROM public.kitchen_recipe_versions WHERE tenant_id = '${tenantId}' AND recipe_id = '${recipe.id}';\nDELETE FROM public.kitchen_recipe_recipes WHERE tenant_id = '${tenantId}' AND id = '${recipe.id}';`;
  out.cleanup_auth = { manage_user_id: manageUser.user.id, viewer_user_id: viewerUser.user.id, note: 'Eliminar con admin API de Supabase Auth cuando se cierre QA.' };

  console.log(JSON.stringify(out, null, 2));
} catch (error) {
  out.fatal = error instanceof Error ? error.message : String(error);
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}
