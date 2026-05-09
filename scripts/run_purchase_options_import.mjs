import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const TENANT_ID = 'c1c5cb42-2dab-4516-ad50-73f1475051aa';
const BASE = process.cwd();
const ROOT = path.resolve(BASE, '..', '..');
const APPLY_CSV = path.join(ROOT, 'docs/modules/kitchen-ops/imports/inventario_purchase_options_apply_511.csv');
const REVIEW_CSV = path.join(ROOT, 'docs/modules/kitchen-ops/imports/inventario_purchase_options_review_21.csv');
const REPORT_MD = path.join(ROOT, 'docs/modules/kitchen-ops/imports/inventario_purchase_options_import_report.md');
const REPORT_JSON = path.join(ROOT, 'docs/modules/kitchen-ops/imports/inventario_purchase_options_import_report.json');

function loadEnv(file) {
  const content = fs.readFileSync(file, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

function parseCsv(text) {
  const rows = [];
  let i = 0; let field = ''; let row = []; let inQ = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQ = true; i++; continue; }
    if (ch === ',') { row.push(field); field = ''; i++; continue; }
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    if (ch === '\r') { i++; continue; }
    field += ch; i++;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function normKey(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toNum(v) {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : NaN;
}

function eqNum(a,b){return Math.abs(Number(a)-Number(b))<1e-9;}

function unitTypeFor(code) {
  const c = normKey(code);
  if (c === 'kg' || c === 'g') return 'mass';
  if (c === 'l' || c === 'ml') return 'volume';
  if (c === 'pza') return 'unit';
  return 'package';
}

async function fetchAll(supabase, table, select, pageSize = 1000) {
  let from = 0;
  const out = [];
  while (true) {
    const { data, error } = await supabase.from(table).select(select).eq('tenant_id', TENANT_ID).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

async function main() {
  loadEnv(path.join(BASE, '.env.local'));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const applyRowsRaw = parseCsv(fs.readFileSync(APPLY_CSV, 'utf8'));
  const reviewRowsRaw = parseCsv(fs.readFileSync(REVIEW_CSV, 'utf8'));
  const headers = applyRowsRaw[0] || [];
  const required = [
    'item_key','supplier_key','purchase_unit_code','inventory_unit_code',
    'quantity_per_purchase_unit','price_per_purchase_unit','confidence','action'
  ];
  for (const c of required) if (!headers.includes(c)) throw new Error(`Missing required column: ${c}`);
  const idx = Object.fromEntries(headers.map((h,i)=>[h,i]));

  const rows = applyRowsRaw.slice(1).filter(r => r.length && r.some(Boolean)).map(r => {
    const obj = {};
    for (const h of headers) obj[h] = r[idx[h]] ?? '';
    return obj;
  });

  const invalid = [];
  for (const [i,r] of rows.entries()) {
    if (String(r.action).trim() !== 'apply') invalid.push(`row ${i+2}: action=${r.action}`);
    if (!(toNum(r.price_per_purchase_unit) > 0)) invalid.push(`row ${i+2}: price<=0`);
    if (!(toNum(r.quantity_per_purchase_unit) > 0)) invalid.push(`row ${i+2}: qty<=0`);
  }
  if (invalid.length) throw new Error(`Abort invalid rows (${invalid.length}): ${invalid.slice(0,20).join('; ')}`);

  const before = {};
  // direct counts
  async function count(table){
    const q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
    const { count, error } = await q;
    if (error) throw new Error(`${table} count: ${error.message}`);
    return count ?? 0;
  }
  before.purchaseOptions = await count('kitchen_inventory_purchase_options');
  before.purchaseOptionsActive = await (async()=>{const {count,error}=await supabase.from('kitchen_inventory_purchase_options').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('is_active',true); if(error) throw error; return count??0;})();
  before.supplierPrices = await count('kitchen_inventory_supplier_prices');
  before.supplierPricesCurrent = await (async()=>{const {count,error}=await supabase.from('kitchen_inventory_supplier_prices').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('is_current',true); if(error) throw error; return count??0;})();
  before.movements = await count('kitchen_inventory_movements');
  const { data: balBeforeData, error: balBeforeErr } = await supabase.from('kitchen_inventory_balances').select('quantity').eq('tenant_id', TENANT_ID);
  if (balBeforeErr) throw balBeforeErr;
  before.balanceRows = (balBeforeData ?? []).length;
  before.balanceQtySum = Number((balBeforeData ?? []).reduce((a,b)=>a+Number(b.quantity??0),0).toFixed(6));
  before.recipes = await count('kitchen_recipe_recipes');
  before.requisitions = await count('event_catering_requisitions');
  before.receipts = await count('event_catering_purchase_receipts');
  before.consumptions = await count('event_catering_consumption_records');

  const [items, suppliers, units, purchaseOptions, supplierPrices] = await Promise.all([
    fetchAll(supabase, 'kitchen_inventory_items', 'id,name,normalized_name,is_active,default_supplier_id'),
    fetchAll(supabase, 'kitchen_inventory_suppliers', 'id,name,normalized_name,is_active'),
    fetchAll(supabase, 'kitchen_inventory_units', 'id,code,name,normalized_name,unit_type,is_active'),
    fetchAll(supabase, 'kitchen_inventory_purchase_options', 'id,item_id,supplier_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_active,is_default,created_at'),
    fetchAll(supabase, 'kitchen_inventory_supplier_prices', 'id,item_id,supplier_id,purchase_option_id,purchase_unit_id,price_per_purchase_unit,is_current,updated_at')
  ]);

  const itemsByKey = new Map();
  for (const it of items) {
    itemsByKey.set(normKey(it.normalized_name || it.name), it);
    itemsByKey.set(normKey(it.name), it);
  }
  const suppliersByKey = new Map();
  for (const s of suppliers) {
    suppliersByKey.set(normKey(s.normalized_name || s.name), s);
    suppliersByKey.set(normKey(s.name), s);
  }
  const unitsByCode = new Map();
  for (const u of units) unitsByCode.set(normKey(u.code), u);

  const stats = {
    rowsRead: rows.length,
    high: rows.filter(r=>r.confidence==='high').length,
    medium: rows.filter(r=>r.confidence==='medium').length,
    itemsFound: 0,
    itemsMissing: 0,
    suppliersReused: 0,
    suppliersCreated: 0,
    unitsReused: 0,
    unitsCreated: 0,
    poCreate: 0,
    poReuse: 0,
    priceCreate: 0,
    priceNoopSameCurrent: 0,
    currentToDeactivate: 0,
    skipped: 0,
    skippedReasons: {},
    duplicateGroupsExisting: 0,
    duplicateExtraExisting: 0,
    appliedRows: 0,
    reusedRows: 0,
    omittedRows: 0,
  };

  // duplicate audit existing
  {
    const grp = new Map();
    for (const o of purchaseOptions.filter(o=>o.is_active)) {
      const k = [o.item_id,o.supplier_id||'',o.purchase_unit_id,o.inventory_unit_id,Number(o.quantity_per_purchase_unit),Number(o.min_purchase_quantity),Number(o.purchase_multiple)].join('|');
      const arr = grp.get(k) || []; arr.push(o); grp.set(k,arr);
    }
    for (const arr of grp.values()) {
      if (arr.length > 1) {
        stats.duplicateGroupsExisting += 1;
        stats.duplicateExtraExisting += arr.length - 1;
      }
    }
  }

  const dryRun = [];
  const applyPlan = [];

  // cache mutable maps for planned creates
  const mutableSuppliersByKey = new Map(suppliersByKey);
  const mutableUnitsByCode = new Map(unitsByCode);
  const mutablePurchaseOptions = [...purchaseOptions];
  const mutableSupplierPrices = [...supplierPrices];

  const mutableItemsByKey = new Map(itemsByKey);

  for (const r of rows) {
    const rowRef = `excel_row:${r.excel_row}`;
    const itemKey = normKey(r.item_key || r.name);
    const supplierKey = normKey(r.supplier_key || r.supplier);
    const puCode = normKey(r.purchase_unit_code);
    const iuCode = normKey(r.inventory_unit_code);
    const qty = Number(r.quantity_per_purchase_unit);
    const price = Number(r.price_per_purchase_unit);

    const item = mutableItemsByKey.get(itemKey);
    if (!item) {
      stats.itemsMissing++; stats.skipped++; stats.omittedRows++;
      stats.skippedReasons.item_not_found = (stats.skippedReasons.item_not_found || 0) + 1;
      dryRun.push({ rowRef, action: 'skip', reason: 'item_not_found', item_key: itemKey });
      continue;
    }
    stats.itemsFound++;

    // supplier resolve/create
    let supplier = mutableSuppliersByKey.get(supplierKey);
    let willCreateSupplier = false;
    if (!supplier) {
      if (!String(r.supplier || '').trim()) {
        stats.skipped++; stats.omittedRows++;
        stats.skippedReasons.missing_supplier_name = (stats.skippedReasons.missing_supplier_name || 0) + 1;
        dryRun.push({ rowRef, action: 'skip', reason: 'missing_supplier_name', item: item.name });
        continue;
      }
      willCreateSupplier = true;
    }

    // units resolve/create
    let pu = mutableUnitsByCode.get(puCode);
    let iu = mutableUnitsByCode.get(iuCode);
    const willCreatePU = !pu;
    const willCreateIU = !iu;

    // prepare candidate PO match
    const findCompatible = () => {
      const candidates = mutablePurchaseOptions.filter(o =>
        o.item_id === item.id &&
        (o.supplier_id || '') === ((supplier && supplier.id) || '') &&
        o.purchase_unit_id === (pu?.id || '__missing__') &&
        o.inventory_unit_id === (iu?.id || '__missing__') &&
        eqNum(o.quantity_per_purchase_unit, qty) &&
        eqNum(o.min_purchase_quantity, 1) &&
        eqNum(o.purchase_multiple, 1)
      );
      const active = candidates.filter(c=>c.is_active);
      if (active.length===0) return { kind: 'none', option: null, all: candidates };
      const def = active.find(a=>a.is_default);
      if (def) return { kind: active.length>1?'duplicate':'single', option: def, all: active };
      const sorted = [...active].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
      return { kind: active.length>1?'duplicate':'single', option: sorted[0], all: active };
    };

    dryRun.push({
      rowRef,
      action: 'apply',
      item: item.name,
      supplier: supplier?.name || r.supplier,
      purchase_unit_code: puCode,
      inventory_unit_code: iuCode,
      qty,
      price,
      willCreateSupplier,
      willCreatePU,
      willCreateIU,
    });

    applyPlan.push({ r, item, supplier, supplierKey, pu, iu, puCode, iuCode, qty, price, willCreateSupplier, willCreatePU, willCreateIU, findCompatible });
  }

  // Dry-run post-resolve tallies
  for (const p of applyPlan) {
    if (p.willCreateSupplier) stats.suppliersCreated++; else stats.suppliersReused++;
    if (p.willCreatePU) stats.unitsCreated++; else stats.unitsReused++;
    if (p.willCreateIU) stats.unitsCreated++; else stats.unitsReused++;
    const match = p.findCompatible();
    if (match.kind === 'single' || match.kind === 'duplicate') {
      stats.poReuse++;
      if (match.kind === 'duplicate') {
        stats.skippedReasons.duplicate_existing = (stats.skippedReasons.duplicate_existing || 0) + 1;
      }
    } else {
      stats.poCreate++;
    }
    // current price impact dry-run
    const existingCurrent = mutableSupplierPrices.find(sp =>
      sp.item_id === p.item.id &&
      sp.supplier_id === (p.supplier?.id || '__new__') &&
      sp.purchase_unit_id === (p.pu?.id || '__new__') &&
      sp.is_current
    );
    if (existingCurrent) {
      if (eqNum(existingCurrent.price_per_purchase_unit, p.price)) stats.priceNoopSameCurrent++;
      else stats.currentToDeactivate++;
    }
    stats.priceCreate++;
  }

  // APPLY
  const exec = {
    suppliersCreated: 0,
    unitsCreated: 0,
    poCreated: 0,
    poReused: 0,
    priceCreated: 0,
    priceNoop: 0,
    currentDeactivated: 0,
    skipped: 0,
    skippedRows: [],
  };

  // helper create supplier/unit
  async function ensureSupplier(plan) {
    if (plan.supplier) return plan.supplier;
    const name = String(plan.r.supplier || '').trim();
    const normalized = normKey(plan.supplierKey).replace(/_/g,' ');
    const { data, error } = await supabase.from('kitchen_inventory_suppliers').insert({
      tenant_id: TENANT_ID,
      name,
      normalized_name: normalized,
      is_active: true,
      notes: 'Fase 9B-4 importación controlada CSV preprocesado',
    }).select('id,name,normalized_name,is_active').single();
    if (error || !data) throw new Error(`create supplier ${name}: ${error?.message}`);
    mutableSuppliersByKey.set(plan.supplierKey, data);
    exec.suppliersCreated++;
    return data;
  }

  async function ensureUnit(codeNorm) {
    const current = mutableUnitsByCode.get(codeNorm);
    if (current) return current;
    const code = codeNorm;
    const name = codeNorm;
    const { data, error } = await supabase.from('kitchen_inventory_units').insert({
      tenant_id: TENANT_ID,
      code,
      name,
      normalized_name: code,
      unit_type: unitTypeFor(code),
      is_base_unit: ['kg','l','pza'].includes(code),
      is_active: true,
    }).select('id,code,name,normalized_name,unit_type,is_active').single();
    if (error || !data) throw new Error(`create unit ${code}: ${error?.message}`);
    mutableUnitsByCode.set(codeNorm, data);
    exec.unitsCreated++;
    return data;
  }

  for (const plan of applyPlan) {
    try {
      const supplier = await ensureSupplier(plan);
      plan.supplier = supplier;
      plan.pu = await ensureUnit(plan.puCode);
      plan.iu = await ensureUnit(plan.iuCode);

      // find compatible again with resolved IDs
      const candidates = mutablePurchaseOptions.filter(o =>
        o.item_id === plan.item.id &&
        (o.supplier_id || '') === supplier.id &&
        o.purchase_unit_id === plan.pu.id &&
        o.inventory_unit_id === plan.iu.id &&
        eqNum(o.quantity_per_purchase_unit, plan.qty) &&
        eqNum(o.min_purchase_quantity, 1) &&
        eqNum(o.purchase_multiple, 1)
      );
      const active = candidates.filter(c=>c.is_active);
      const inactive = candidates.filter(c=>!c.is_active);
      let option = null;

      if (active.length > 0) {
        option = active.find(a=>a.is_default) || [...active].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0];
        exec.poReused++;
      } else if (inactive.length > 0) {
        exec.skipped++;
        exec.skippedRows.push({ excel_row: plan.r.excel_row, reason: 'compatible_option_inactive' });
        continue;
      } else {
        const hasDefaultActiveForItem = mutablePurchaseOptions.some(o=>o.item_id===plan.item.id && o.is_active && o.is_default);
        const { data: ins, error: insErr } = await supabase.from('kitchen_inventory_purchase_options').insert({
          tenant_id: TENANT_ID,
          item_id: plan.item.id,
          supplier_id: supplier.id,
          purchase_unit_id: plan.pu.id,
          inventory_unit_id: plan.iu.id,
          quantity_per_purchase_unit: plan.qty,
          min_purchase_quantity: 1,
          purchase_multiple: 1,
          is_active: true,
          is_default: hasDefaultActiveForItem ? false : true,
          notes: 'Fase 9B-4 importación controlada desde INVENTARIO FEBRERO 2026 preprocesado',
        }).select('id,item_id,supplier_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_active,is_default,created_at').single();
        if (insErr || !ins) throw new Error(`create PO row ${plan.r.excel_row}: ${insErr?.message}`);
        option = ins;
        mutablePurchaseOptions.push(ins);
        exec.poCreated++;
      }

      // supplier price current handling
      const existingCurrent = mutableSupplierPrices.find(sp =>
        sp.item_id===plan.item.id && sp.supplier_id===supplier.id && sp.purchase_unit_id===plan.pu.id && sp.is_current
      );

      if (existingCurrent && eqNum(existingCurrent.price_per_purchase_unit, plan.price) && existingCurrent.purchase_option_id===option.id) {
        exec.priceNoop++;
        continue;
      }

      if (existingCurrent) {
        const { error: updErr } = await supabase
          .from('kitchen_inventory_supplier_prices')
          .update({ is_current: false })
          .eq('tenant_id', TENANT_ID)
          .eq('id', existingCurrent.id);
        if (updErr) throw new Error(`deactivate current price row ${plan.r.excel_row}: ${updErr.message}`);
        existingCurrent.is_current = false;
        exec.currentDeactivated++;
      }

      const { data: priceIns, error: priceErr } = await supabase.from('kitchen_inventory_supplier_prices').insert({
        tenant_id: TENANT_ID,
        item_id: plan.item.id,
        supplier_id: supplier.id,
        purchase_option_id: option.id,
        purchase_unit_id: plan.pu.id,
        price_per_purchase_unit: plan.price,
        currency: 'MXN',
        source_type: 'supplier_list',
        source_ref: 'INVENTARIO FEBRERO 2026',
        valid_from: new Date().toISOString().slice(0,10),
        is_current: true,
        notes: 'Fase 9B-4 importación controlada desde CSV preprocesado',
      }).select('id,item_id,supplier_id,purchase_option_id,purchase_unit_id,price_per_purchase_unit,is_current,updated_at').single();
      if (priceErr || !priceIns) throw new Error(`create price row ${plan.r.excel_row}: ${priceErr?.message}`);
      mutableSupplierPrices.push(priceIns);
      exec.priceCreated++;
      stats.appliedRows++;
      if (active.length > 0) stats.reusedRows++;
    } catch (e) {
      exec.skipped++;
      exec.skippedRows.push({ excel_row: plan.r.excel_row, reason: String(e.message || e) });
    }
  }

  stats.omittedRows += exec.skipped;

  // after counts
  const after = {};
  async function count(table){
    const {count,error}=await supabase.from(table).select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID);
    if(error) throw error; return count??0;
  }
  after.purchaseOptions = await count('kitchen_inventory_purchase_options');
  after.purchaseOptionsActive = await (async()=>{const {count,error}=await supabase.from('kitchen_inventory_purchase_options').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('is_active',true); if(error) throw error; return count??0;})();
  after.supplierPrices = await count('kitchen_inventory_supplier_prices');
  after.supplierPricesCurrent = await (async()=>{const {count,error}=await supabase.from('kitchen_inventory_supplier_prices').select('*',{count:'exact',head:true}).eq('tenant_id',TENANT_ID).eq('is_current',true); if(error) throw error; return count??0;})();
  after.movements = await count('kitchen_inventory_movements');
  const { data: balAfterData, error: balAfterErr } = await supabase.from('kitchen_inventory_balances').select('quantity').eq('tenant_id', TENANT_ID);
  if (balAfterErr) throw balAfterErr;
  after.balanceRows = (balAfterData ?? []).length;
  after.balanceQtySum = Number((balAfterData ?? []).reduce((a,b)=>a+Number(b.quantity??0),0).toFixed(6));
  after.recipes = await count('kitchen_recipe_recipes');
  after.requisitions = await count('event_catering_requisitions');
  after.receipts = await count('event_catering_purchase_receipts');
  after.consumptions = await count('event_catering_consumption_records');

  // duplicate audit after
  {
    const allPo = await fetchAll(supabase, 'kitchen_inventory_purchase_options', 'id,item_id,supplier_id,purchase_unit_id,inventory_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_active,created_at,is_default');
    const grp = new Map();
    for (const o of allPo.filter(o=>o.is_active)) {
      const k=[o.item_id,o.supplier_id||'',o.purchase_unit_id,o.inventory_unit_id,Number(o.quantity_per_purchase_unit),Number(o.min_purchase_quantity),Number(o.purchase_multiple)].join('|');
      const arr=grp.get(k)||[];arr.push(o);grp.set(k,arr);
    }
    let groups=0,extra=0;
    for(const arr of grp.values()){if(arr.length>1){groups++;extra+=arr.length-1;}}
    after.duplicateGroups = groups;
    after.duplicateExtra = extra;
  }

  // items with defaults/current
  after.itemsWithDefaultPo = (await fetchAll(supabase, 'kitchen_inventory_purchase_options', 'item_id,is_default,is_active')).filter(r=>r.is_active&&r.is_default).reduce((s,r)=>s.add(r.item_id), new Set()).size;
  before.itemsWithDefaultPo = purchaseOptions.filter(r=>r.is_active&&r.is_default).reduce((s,r)=>s.add(r.item_id), new Set()).size;
  after.itemsWithCurrentPrice = (await fetchAll(supabase, 'kitchen_inventory_supplier_prices', 'item_id,is_current')).filter(r=>r.is_current).reduce((s,r)=>s.add(r.item_id), new Set()).size;
  before.itemsWithCurrentPrice = supplierPrices.filter(r=>r.is_current).reduce((s,r)=>s.add(r.item_id), new Set()).size;

  const report = {
    source: {
      applyFile: path.relative(BASE, APPLY_CSV),
      reviewFile: path.relative(BASE, REVIEW_CSV),
      rowsApplyRead: rows.length,
      rowsReviewRead: Math.max(0, reviewRowsRaw.length - 1),
    },
    dryRun: stats,
    execution: exec,
    before,
    after,
    invariants: {
      movementsCreated: after.movements - before.movements,
      balancesRowDelta: after.balanceRows - before.balanceRows,
      balancesQtySumDelta: Number((after.balanceQtySum - before.balanceQtySum).toFixed(6)),
      recipesDelta: after.recipes - before.recipes,
      requisitionsDelta: after.requisitions - before.requisitions,
      receiptsDelta: after.receipts - before.receipts,
      consumptionsDelta: after.consumptions - before.consumptions,
      duplicateGroupsAfter: after.duplicateGroups,
      duplicateExtraAfter: after.duplicateExtra,
    }
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

  const md = [];
  md.push('# Inventario Purchase Options Import Report (Fase 9B-4)');
  md.push('');
  md.push(`- Fuente apply: \`${report.source.applyFile}\``);
  md.push(`- Fuente review (no aplicada): \`${report.source.reviewFile}\``);
  md.push(`- Tenant: \`${TENANT_ID}\``);
  md.push('');
  md.push('## Dry-run');
  md.push(`- Filas leídas: ${stats.rowsRead}`);
  md.push(`- High confidence: ${stats.high}`);
  md.push(`- Medium confidence: ${stats.medium}`);
  md.push(`- Items encontrados: ${stats.itemsFound}`);
  md.push(`- Items no encontrados: ${stats.itemsMissing}`);
  md.push(`- Suppliers creados/reutilizados: ${stats.suppliersCreated}/${stats.suppliersReused}`);
  md.push(`- Units creadas/reutilizadas: ${stats.unitsCreated}/${stats.unitsReused}`);
  md.push(`- Purchase options crear/reusar: ${stats.poCreate}/${stats.poReuse}`);
  md.push(`- Supplier prices crear: ${stats.priceCreate}`);
  md.push(`- Current previos a desactivar: ${stats.currentToDeactivate}`);
  md.push(`- Price no-op (mismo current): ${stats.priceNoopSameCurrent}`);
  md.push(`- Duplicados existentes previos (grupos/extras): ${stats.duplicateGroupsExisting}/${stats.duplicateExtraExisting}`);
  md.push('');
  md.push('## Aplicación');
  md.push(`- Filas aplicadas: ${stats.appliedRows}`);
  md.push(`- Filas con PO reutilizada: ${stats.reusedRows}`);
  md.push(`- Filas omitidas: ${stats.omittedRows}`);
  md.push(`- Purchase options creadas/reutilizadas: ${exec.poCreated}/${exec.poReused}`);
  md.push(`- Supplier prices creados: ${exec.priceCreated}`);
  md.push(`- Supplier prices no-op: ${exec.priceNoop}`);
  md.push(`- Current desactivados: ${exec.currentDeactivated}`);
  md.push(`- Suppliers creados: ${exec.suppliersCreated}`);
  md.push(`- Units creadas: ${exec.unitsCreated}`);
  md.push('');
  md.push('## Antes / Después');
  md.push(`- Purchase options: ${before.purchaseOptions} -> ${after.purchaseOptions}`);
  md.push(`- Supplier prices: ${before.supplierPrices} -> ${after.supplierPrices}`);
  md.push(`- Supplier prices current: ${before.supplierPricesCurrent} -> ${after.supplierPricesCurrent}`);
  md.push(`- Items con PO default: ${before.itemsWithDefaultPo} -> ${after.itemsWithDefaultPo}`);
  md.push(`- Items con supplier price current: ${before.itemsWithCurrentPrice} -> ${after.itemsWithCurrentPrice}`);
  md.push('');
  md.push('## Invariantes de alcance');
  md.push(`- kitchen_inventory_movements creados: ${report.invariants.movementsCreated}`);
  md.push(`- kitchen_inventory_balances rows delta: ${report.invariants.balancesRowDelta}`);
  md.push(`- kitchen_inventory_balances qty sum delta: ${report.invariants.balancesQtySumDelta}`);
  md.push(`- recetas delta: ${report.invariants.recipesDelta}`);
  md.push(`- requisiciones delta: ${report.invariants.requisitionsDelta}`);
  md.push(`- recepciones delta: ${report.invariants.receiptsDelta}`);
  md.push(`- consumos delta: ${report.invariants.consumptionsDelta}`);
  md.push(`- duplicados exactos activos después (grupos/extras): ${report.invariants.duplicateGroupsAfter}/${report.invariants.duplicateExtraAfter}`);
  md.push('');
  md.push('## Skips (top)');
  const reasonCounts = {};
  for (const s of exec.skippedRows) reasonCounts[s.reason] = (reasonCounts[s.reason] || 0) + 1;
  for (const [k,v] of Object.entries(reasonCounts).sort((a,b)=>b[1]-a[1]).slice(0,20)) {
    md.push(`- ${k}: ${v}`);
  }
  fs.writeFileSync(REPORT_MD, md.join('\n') + '\n');

  console.log(JSON.stringify({ ok: true, report: path.relative(BASE, REPORT_MD), summary: {
    rowsRead: stats.rowsRead,
    appliedRows: stats.appliedRows,
    omittedRows: stats.omittedRows,
    poCreated: exec.poCreated,
    poReused: exec.poReused,
    priceCreated: exec.priceCreated,
    suppliersCreated: exec.suppliersCreated,
    unitsCreated: exec.unitsCreated,
    movementsDelta: report.invariants.movementsCreated,
    balancesQtyDelta: report.invariants.balancesQtySumDelta,
    duplicateGroupsAfter: report.invariants.duplicateGroupsAfter,
    duplicateExtraAfter: report.invariants.duplicateExtraAfter,
  }}, null, 2));
}

main().catch((e)=>{ console.error(e); process.exit(1); });
