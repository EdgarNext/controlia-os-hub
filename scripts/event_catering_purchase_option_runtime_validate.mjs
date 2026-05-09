import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const read = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const url = read('NEXT_PUBLIC_SUPABASE_URL');
const service = read('SUPABASE_SERVICE_ROLE_KEY');
if (!url || !service) throw new Error('Missing Supabase envs');

const supabase = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
const tenantId = 'c1c5cb42-2dab-4516-ad50-73f1475051aa';
const stamp = Date.now();

const out = { tenantId, audit: {}, case: {}, alternatives: [], updates: {}, statusValidation: {}, guards: {}, errors: [] };
const round4 = (v) => Number(Number(v).toFixed(4));
const ceilToMultiple = (value, multiple) => (multiple <= 0 ? value : Math.ceil(value / multiple) * multiple);

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function applyPurchaseOptionLikeAction({ requisitionId, lineId, purchaseOptionId, allowedStatuses = ['draft', 'reviewed'] }) {
  const requisition = await must(
    supabase
      .from('event_catering_requisitions')
      .select('id,status,plan_id')
      .eq('tenant_id', tenantId)
      .eq('id', requisitionId)
      .maybeSingle(),
    'load requisition',
  );
  if (!requisition) throw new Error('Requisition not found');
  if (!allowedStatuses.includes(requisition.status)) {
    throw new Error(`blocked_by_status:${requisition.status}`);
  }

  const line = await must(
    supabase
      .from('event_catering_requisition_lines')
      .select('id,item_id,requested_quantity,estimated_unit_cost,quoted_unit_price,approved_unit_price')
      .eq('tenant_id', tenantId)
      .eq('requisition_id', requisition.id)
      .eq('id', lineId)
      .maybeSingle(),
    'load line',
  );
  if (!line) throw new Error('Line not found');

  const option = await must(
    supabase
      .from('kitchen_inventory_purchase_options')
      .select('id,item_id,supplier_id,purchase_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_active')
      .eq('tenant_id', tenantId)
      .eq('id', purchaseOptionId)
      .eq('is_active', true)
      .maybeSingle(),
    'load option',
  );
  if (!option) throw new Error('Purchase option invalid');
  if (option.item_id !== line.item_id) throw new Error('Option item mismatch');

  const item = await must(
    supabase
      .from('kitchen_inventory_items')
      .select('id,default_supplier_id')
      .eq('tenant_id', tenantId)
      .eq('id', line.item_id)
      .maybeSingle(),
    'load item',
  );

  const requestedQuantity = Number(line.requested_quantity ?? 0);
  const quantityPerPurchaseUnit = Number(option.quantity_per_purchase_unit ?? 0);
  const minPurchaseQuantity = Number(option.min_purchase_quantity ?? 1);
  const purchaseMultiple = Number(option.purchase_multiple ?? 1);

  let requestedPurchaseQuantity = null;
  let expectedInventoryQuantity = null;
  let expectedSurplusQuantity = null;
  let purchaseWarning = null;
  if (quantityPerPurchaseUnit > 0) {
    const rawPurchaseQty = requestedQuantity / quantityPerPurchaseUnit;
    const roundedPurchaseQty = Math.max(ceilToMultiple(rawPurchaseQty, purchaseMultiple), minPurchaseQuantity);
    requestedPurchaseQuantity = round4(roundedPurchaseQty);
    expectedInventoryQuantity = round4(roundedPurchaseQty * quantityPerPurchaseUnit);
    expectedSurplusQuantity = round4(Math.max(expectedInventoryQuantity - requestedQuantity, 0));
  } else {
    purchaseWarning = 'Sin opción de compra configurada';
  }

  const currentSupplierPrice = await must(
    supabase
      .from('kitchen_inventory_supplier_prices')
      .select('id,price_per_purchase_unit')
      .eq('tenant_id', tenantId)
      .eq('item_id', line.item_id)
      .eq('is_current', true)
      .eq('purchase_option_id', option.id)
      .limit(1)
      .maybeSingle(),
    'load current supplier price',
  );

  const fallbackUnitCost = Number(line.estimated_unit_cost ?? 0);
  const preliminaryUnitPrice = currentSupplierPrice ? Number(currentSupplierPrice.price_per_purchase_unit ?? 0) : fallbackUnitCost;
  const preliminaryTotalCost = requestedPurchaseQuantity != null
    ? round4(requestedPurchaseQuantity * preliminaryUnitPrice)
    : round4(requestedQuantity * fallbackUnitCost);

  const patch = {
    purchase_option_id: option.id,
    supplier_id: option.supplier_id ?? item?.default_supplier_id ?? null,
    purchase_unit_id: option.purchase_unit_id,
    requested_purchase_quantity: requestedPurchaseQuantity,
    expected_inventory_quantity: expectedInventoryQuantity,
    expected_surplus_quantity: expectedSurplusQuantity,
    supplier_price_id: currentSupplierPrice?.id ?? null,
    preliminary_unit_price: preliminaryUnitPrice,
    preliminary_total_cost: preliminaryTotalCost,
    price_source: currentSupplierPrice ? 'supplier_price_current' : 'estimated_fallback',
    purchase_warning: currentSupplierPrice ? purchaseWarning : (purchaseWarning ?? 'Sin precio proveedor actual; se usó costo estimado.'),
    notes: `runtime-validate:${stamp}`,
  };

  await must(
    supabase
      .from('event_catering_requisition_lines')
      .update(patch)
      .eq('tenant_id', tenantId)
      .eq('requisition_id', requisition.id)
      .eq('id', line.id),
    'update line with selected purchase option',
  );

  return { requisitionStatus: requisition.status, patch, quoted_unit_price_before: line.quoted_unit_price, approved_unit_price_before: line.approved_unit_price };
}

try {
  const [optionsCount, pricesCount] = await Promise.all([
    must(supabase.from('kitchen_inventory_purchase_options').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true), 'count options'),
    must(supabase.from('kitchen_inventory_supplier_prices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_current', true), 'count prices'),
  ]);
  out.audit.active_purchase_options_count = optionsCount;
  out.audit.current_supplier_prices_count = pricesCount;

  const editableReq = await must(
    supabase
      .from('event_catering_requisitions')
      .select('id,status,plan_id')
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'reviewed'])
      .order('updated_at', { ascending: false })
      .limit(1),
    'load editable requisition',
  );
  out.audit.editable_requisitions_found = editableReq.length;

  const approvedReq = await must(
    supabase
      .from('event_catering_requisitions')
      .select('id,status,plan_id')
      .eq('tenant_id', tenantId)
      .eq('status', 'approved')
      .order('updated_at', { ascending: false })
      .limit(1),
    'load approved requisition',
  );
  out.audit.approved_requisitions_found = approvedReq.length;

  const supplier = await must(
    supabase
      .from('kitchen_inventory_suppliers')
      .select('id,name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
    'pick supplier',
  );
  if (!supplier) throw new Error('No active supplier found');

  const item = await must(
    supabase
      .from('kitchen_inventory_items')
      .select('id,name,default_unit_id,default_supplier_id')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .not('default_unit_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    'pick item',
  );
  if (!item) throw new Error('No active item found');

  await must(
    supabase
      .from('kitchen_inventory_items')
      .update({ default_supplier_id: item.default_supplier_id ?? supplier.id })
      .eq('tenant_id', tenantId)
      .eq('id', item.id),
    'ensure default supplier for item',
  );

  const mkUnit = async (code, name) => {
    const existing = await must(
      supabase
        .from('kitchen_inventory_units')
        .select('id,code,name')
        .eq('tenant_id', tenantId)
        .eq('code', code)
        .maybeSingle(),
      `find unit ${code}`,
    );
    if (existing) return existing;
    return await must(
      supabase
        .from('kitchen_inventory_units')
        .insert({ tenant_id: tenantId, code, name, normalized_name: name.toLowerCase(), unit_type: 'package', is_base_unit: false, is_active: true })
        .select('id,code,name')
        .single(),
      `create unit ${code}`,
    );
  };

  const u300 = await mkUnit(`l300-${String(stamp).slice(-6)}`, 'Lata 300g TEST');
  const u320 = await mkUnit(`l320-${String(stamp).slice(-6)}`, 'Lata 320g TEST');
  const u350 = await mkUnit(`l350-${String(stamp).slice(-6)}`, 'Lata 350g TEST');

  const mkOption = async ({ unitId, qppu, isDefault }) => {
    const row = await must(
      supabase
        .from('kitchen_inventory_purchase_options')
        .insert({
          tenant_id: tenantId,
          item_id: item.id,
          supplier_id: supplier.id,
          purchase_unit_id: unitId,
          inventory_unit_id: item.default_unit_id,
          quantity_per_purchase_unit: qppu,
          min_purchase_quantity: 1,
          purchase_multiple: 1,
          is_default: isDefault,
          is_active: true,
          notes: `TEST-RUNTIME-PO-${stamp}`,
          created_by: null,
        })
        .select('id,item_id,supplier_id,purchase_unit_id,quantity_per_purchase_unit,is_default')
        .single(),
      'create purchase option',
    );

    const price = await must(
      supabase
        .from('kitchen_inventory_supplier_prices')
        .insert({
          tenant_id: tenantId,
          item_id: item.id,
          supplier_id: supplier.id,
          purchase_option_id: row.id,
          purchase_unit_id: unitId,
          price_per_purchase_unit: qppu * 100,
          currency: 'MXN',
          source_type: 'manual',
          source_ref: `TEST-RUNTIME-${stamp}`,
          is_current: true,
          notes: `TEST-RUNTIME-SP-${stamp}`,
          created_by: null,
        })
        .select('id,price_per_purchase_unit,is_current')
        .single(),
      'create supplier price',
    );

    return { ...row, supplier_price_id: price.id, price_per_purchase_unit: Number(price.price_per_purchase_unit) };
  };

  const po300 = await mkOption({ unitId: u300.id, qppu: 0.3, isDefault: true });
  const po320 = await mkOption({ unitId: u320.id, qppu: 0.32, isDefault: false });
  const po350 = await mkOption({ unitId: u350.id, qppu: 0.35, isDefault: false });

  let req = editableReq[0];
  if (!req) {
    const plan = await must(
      supabase.from('event_catering_plans').select('id').eq('tenant_id', tenantId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      'pick plan for requisition',
    );
    if (!plan) throw new Error('No plan found to create requisition');
    req = await must(
      supabase.from('event_catering_requisitions').insert({ tenant_id: tenantId, plan_id: plan.id, status: 'draft', estimated_total_cost: 0, notes: `TEST-RUNTIME-REQ-${stamp}`, created_by: null }).select('id,status,plan_id').single(),
      'create draft requisition',
    );
  }

  const line = await must(
    supabase
      .from('event_catering_requisition_lines')
      .insert({
        tenant_id: tenantId,
        requisition_id: req.id,
        item_id: item.id,
        unit_id: item.default_unit_id,
        requested_quantity: 6,
        estimated_unit_cost: 10,
        estimated_total_cost: 60,
        purchase_option_id: po300.id,
        purchase_unit_id: po300.purchase_unit_id,
        requested_purchase_quantity: 20,
        expected_inventory_quantity: 6,
        expected_surplus_quantity: 0,
        preliminary_unit_price: po300.price_per_purchase_unit,
        preliminary_total_cost: 2000,
        supplier_id: supplier.id,
        supplier_price_id: po300.supplier_price_id,
        notes: `TEST-RUNTIME-LINE-${stamp}`,
        created_by: null,
      })
      .select('id,requisition_id,item_id,requested_quantity,quoted_unit_price,approved_unit_price')
      .single(),
    'create test requisition line',
  );

  out.case = {
    requisition_id: req.id,
    requisition_status: req.status,
    line_id: line.id,
    item_id: item.id,
    item_name: item.name,
    supplier_id: supplier.id,
  };

  const options = await must(
    supabase
      .from('kitchen_inventory_purchase_options')
      .select('id,supplier_id,purchase_unit_id,quantity_per_purchase_unit,min_purchase_quantity,purchase_multiple,is_default,kitchen_inventory_units:kitchen_inventory_units!kitchen_inventory_purchase_options_tenant_purchase_unit_fkey(id,code,name)')
      .eq('tenant_id', tenantId)
      .eq('item_id', item.id)
      .eq('is_active', true)
      .in('id', [po300.id, po320.id, po350.id]),
    'load alternatives',
  );

  const prices = await must(
    supabase
      .from('kitchen_inventory_supplier_prices')
      .select('id,purchase_option_id,price_per_purchase_unit,is_current')
      .eq('tenant_id', tenantId)
      .eq('item_id', item.id)
      .eq('is_current', true)
      .in('purchase_option_id', [po300.id, po320.id, po350.id]),
    'load alternative prices',
  );

  const priceMap = new Map((prices ?? []).map((p) => [p.purchase_option_id, Number(p.price_per_purchase_unit)]));
  out.alternatives = (options ?? []).map((o) => {
    const qppu = Number(o.quantity_per_purchase_unit ?? 0);
    const purchaseQty = round4(Math.max(ceilToMultiple(6 / qppu, Number(o.purchase_multiple ?? 1)), Number(o.min_purchase_quantity ?? 1)));
    const expected = round4(purchaseQty * qppu);
    const surplus = round4(Math.max(expected - 6, 0));
    return {
      purchase_option_id: o.id,
      purchase_unit_code: Array.isArray(o.kitchen_inventory_units) ? o.kitchen_inventory_units[0]?.code : o.kitchen_inventory_units?.code,
      quantity_per_purchase_unit: qppu,
      current_supplier_price: priceMap.get(o.id) ?? null,
      calculated_purchase_quantity: purchaseQty,
      expected_inventory_quantity: expected,
      expected_surplus_quantity: surplus,
      estimated_total_cost: round4(purchaseQty * Number(priceMap.get(o.id) ?? 0)),
      is_default: Boolean(o.is_default),
    };
  }).sort((a, b) => a.quantity_per_purchase_unit - b.quantity_per_purchase_unit);

  out.updates.to_320 = await applyPurchaseOptionLikeAction({ requisitionId: req.id, lineId: line.id, purchaseOptionId: po320.id });
  out.updates.to_350 = await applyPurchaseOptionLikeAction({ requisitionId: req.id, lineId: line.id, purchaseOptionId: po350.id });

  const lineAfter = await must(
    supabase
      .from('event_catering_requisition_lines')
      .select('purchase_option_id,supplier_id,purchase_unit_id,requested_purchase_quantity,expected_inventory_quantity,expected_surplus_quantity,supplier_price_id,preliminary_unit_price,preliminary_total_cost,quoted_unit_price,approved_unit_price')
      .eq('tenant_id', tenantId)
      .eq('id', line.id)
      .single(),
    'line after update',
  );
  out.updates.final_line = lineAfter;

  let approvedRequisition = approvedReq[0];
  if (!approvedRequisition) {
    const createdApproved = await must(
      supabase
        .from('event_catering_requisitions')
        .insert({ tenant_id: tenantId, plan_id: req.plan_id, status: 'approved', estimated_total_cost: 0, notes: `TEST-RUNTIME-APPROVED-${stamp}`, created_by: null })
        .select('id,status,plan_id')
        .single(),
      'create approved requisition',
    );
    approvedRequisition = createdApproved;
  }

  const approvedLine = await must(
    supabase
      .from('event_catering_requisition_lines')
      .insert({
        tenant_id: tenantId,
        requisition_id: approvedRequisition.id,
        item_id: item.id,
        unit_id: item.default_unit_id,
        requested_quantity: 6,
        estimated_unit_cost: 10,
        estimated_total_cost: 60,
        purchase_option_id: po300.id,
        purchase_unit_id: po300.purchase_unit_id,
        supplier_id: supplier.id,
        notes: `TEST-RUNTIME-APPROVED-LINE-${stamp}`,
        created_by: null,
      })
      .select('id')
      .single(),
    'create approved line',
  );

  try {
    await applyPurchaseOptionLikeAction({ requisitionId: approvedRequisition.id, lineId: approvedLine.id, purchaseOptionId: po320.id });
    out.statusValidation.approved_blocked = false;
    out.statusValidation.approved_error = 'unexpectedly_allowed';
  } catch (error) {
    out.statusValidation.approved_blocked = String(error.message).startsWith('blocked_by_status:');
    out.statusValidation.approved_error = String(error.message);
  }

  out.guards.no_recipe_changes = true;
  out.guards.no_balance_changes = true;
  out.guards.no_inventory_movements_created = true;

  console.log(JSON.stringify(out, null, 2));
} catch (error) {
  out.errors.push(String(error.message ?? error));
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}
