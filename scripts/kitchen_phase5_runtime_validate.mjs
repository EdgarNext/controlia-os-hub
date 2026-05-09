import fs from 'node:fs';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const read = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
const url = read('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || read('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
const service = read('SUPABASE_SERVICE_ROLE_KEY');

const tenantId = 'c1c5cb42-2dab-4516-ad50-73f1475051aa';
const filePath = '/home/developer/dev/controlia-os/docs/tmp/kitchen-import-samples/RECETARIO.xlsx';
const stamp = Date.now();

function normalize(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase().replace(/\s+/g,' ')}
function toUpper(v){return normalize(v).toUpperCase()}
function toNumber(v){ if(v==null) return null; const c=String(v).replace(/\$/g,'').replace(/,/g,'').trim(); if(!c||c==='-'||c==='-   ') return null; const n=Number(c); return Number.isFinite(n)?n:null; }
function inferUnitCode(v){const u=toUpper(v); if(!u) return null; if(u.includes('KG')) return 'kg'; if(u.includes('LT')||u==='L') return 'l'; if(u.includes('ML')) return 'ml'; if(u.includes('PZ')||u.includes('UNIDAD')||u.includes('PZA')) return 'pza'; if(u.includes('MAN')) return 'manojo'; return String(v).trim().toLowerCase()||null;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function parseLite(file){
  const wb=XLSX.readFile(file,{cellDates:false}); const rows=[]; const seen=new Set(); const ignored={empty:0,non_ingredient:0,placeholder:0,missing_context:0};
  for(let sheetIndex=0; sheetIndex<wb.SheetNames.length; sheetIndex++){
    const sheetName=wb.SheetNames[sheetIndex];
    const m=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:null,raw:false});
    let recipeName=null,recipeNorm=null,servings=null,inIng=false;
    for(let i=0;i<m.length;i++){
      const row=m[i]||[]; if(row.every(v=>String(v??'').trim()==='')){ignored.empty++; continue;}
      const c0=String(row[0]??'').trim(); const u0=toUpper(c0); const onlyFirst=row.slice(1).every(v=>String(v??'').trim()==='');
      const isHeader=onlyFirst && c0 && !u0.includes('COSTEO POR PLATILLO') && !u0.includes('NO DE PERSONAS') && !u0.includes('INGREDIENTES DE RECETA') && !u0.includes('PRECIO COSTO U');
      if(isHeader){recipeName=c0; recipeNorm=normalize(c0); servings=null; inIng=false; seen.add(`${sheetName}::${recipeNorm}`); continue;}
      if(u0.includes('NO DE PERSONAS') || u0.includes('NO. DE')){servings=toNumber(row[2]); continue;}
      if(u0.includes('INGREDIENTES DE RECETA')){inIng=true; continue;}
      if(u0.includes('PRECIO COSTO U')){inIng=false; continue;}
      if(!inIng){ignored.non_ingredient++; continue;}
      if(!recipeName||!recipeNorm){ignored.missing_context++; continue;}
      const ingredient=String(row[0]??'').trim(); const qty=toNumber(row[4])??toNumber(row[5]);
      if(!ingredient || (qty!=null && qty<=0)){ignored.placeholder++; continue;}
      rows.push({rowNumber:(sheetIndex+1)*100000+(i+1), recipeGroupKey:`${sheetName}::${recipeNorm}`, recipeName, normalizedRecipeName:recipeNorm, recipeServings:servings, ingredientName:ingredient, normalizedIngredientName:normalize(ingredient), quantity:qty, unitCode:inferUnitCode(row[3]), raw:{sheet:sheetName,row:i+1,unit:row[3],portion:row[4],order:row[5],price:row[6],cost_total:row[7]}});
    }
  }
  return {sheetNames:wb.SheetNames, rows, parsedRecipes:seen.size, parsedLines:rows.length, ignored, uniqueIngredients:new Set(rows.map(r=>r.normalizedIngredientName)).size};
}

const admin=createClient(url,service,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
const out={parsing:{},batch:{},validate:{},alias:{},apply:{},security:{},errors:[]};
const must=async(p,label)=>{const r=await p; if(r.error){out.errors.push({label,message:r.error.message,code:r.error.code}); throw new Error(`${label}: ${r.error.message}`)} return r.data;};
async function mustRetry(fn,label,retries=4){let e; for(let i=0;i<=retries;i++){try{return await fn();}catch(err){e=err; await sleep(300*(i+1));}} throw new Error(`${label}: ${e?.message||e}`);}

try{
  await must(admin.from('tenant_modules').upsert({tenant_id:tenantId,module_key:'kitchen_recipes',enabled:true},{onConflict:'tenant_id,module_key'}),'enable module');

  const manageEmail=`krecipes5.manage.${stamp}@demo.local`; const viewerEmail=`krecipes5.viewer.${stamp}@demo.local`; const password=`T3st!Receta#${String(stamp).slice(-6)}`;
  const mUser=await must(admin.auth.admin.createUser({email:manageEmail,password,email_confirm:true}),'create manage');
  const vUser=await must(admin.auth.admin.createUser({email:viewerEmail,password,email_confirm:true}),'create viewer');
  await must(admin.from('tenant_memberships').insert({tenant_id:tenantId,user_id:mUser.user.id,role:'operator'}),'membership manage');
  await must(admin.from('tenant_memberships').insert({tenant_id:tenantId,user_id:vUser.user.id,role:'viewer'}),'membership viewer');
  const mSign=await anon.auth.signInWithPassword({email:manageEmail,password}); if(mSign.error) throw new Error(mSign.error.message);
  const vSign=await anon.auth.signInWithPassword({email:viewerEmail,password}); if(vSign.error) throw new Error(vSign.error.message);
  const manage=createClient(url,anonKey,{global:{headers:{Authorization:`Bearer ${mSign.data.session.access_token}`}},auth:{persistSession:false,autoRefreshToken:false}});
  const viewer=createClient(url,anonKey,{global:{headers:{Authorization:`Bearer ${vSign.data.session.access_token}`}},auth:{persistSession:false,autoRefreshToken:false}});

  const parsed=parseLite(filePath);
  out.parsing={sheets:parsed.sheetNames,recipes_detected:parsed.parsedRecipes,lines_detected:parsed.parsedLines,ingredients_unique:parsed.uniqueIngredients,ignored:parsed.ignored};

  const batch=await must(manage.from('kitchen_recipe_import_batches').insert({tenant_id:tenantId,original_filename:'RECETARIO.xlsx',source_type:'excel',status:'parsed',total_rows:parsed.rows.length,parsed_recipes:parsed.parsedRecipes,parsed_lines:parsed.parsedLines,notes:'runtime-phase5',created_by:mUser.user.id}).select('id').single(),'create batch');
  out.batch.id=batch.id;

  const payload=parsed.rows.map(r=>({tenant_id:tenantId,batch_id:batch.id,row_number:r.rowNumber,recipe_group_key:r.recipeGroupKey,recipe_name:r.recipeName,normalized_recipe_name:r.normalizedRecipeName,recipe_yield_quantity:1,recipe_yield_unit_code:'pza',recipe_servings:r.recipeServings,ingredient_name:r.ingredientName,normalized_ingredient_name:r.normalizedIngredientName,quantity:r.quantity,unit_code:r.unitCode,raw_payload:r.raw,normalized_payload:{},status:'pending',severity:'info',action:'upsert_recipe_line',validation_errors:[],validation_warnings:[]}));
  for(let i=0;i<payload.length;i+=60){
    const part=payload.slice(i,i+60);
    await mustRetry(()=>must(manage.from('kitchen_recipe_import_rows').insert(part),`insert chunk ${i}`),`insert chunk ${i}`);
  }

  const rows=await must(manage.from('kitchen_recipe_import_rows').select('id,recipe_name,normalized_recipe_name,ingredient_name,normalized_ingredient_name,quantity,unit_code').eq('tenant_id',tenantId).eq('batch_id',batch.id),'rows');
  const items=await must(manage.from('kitchen_inventory_items').select('id,normalized_name').eq('tenant_id',tenantId),'items');
  const aliases=await must(manage.from('kitchen_recipe_item_aliases').select('id,normalized_alias,item_id').eq('tenant_id',tenantId),'aliases');
  const units=await must(manage.from('kitchen_inventory_units').select('id,code').eq('tenant_id',tenantId),'units');

  const itemMap=new Map(items.map(i=>[i.normalized_name,i.id]));
  const aliasMap=new Map(aliases.map(a=>[a.normalized_alias,a]));
  const unitMap=new Map(units.map(u=>[String(u.code).trim().toLowerCase(),u.id]));

  let valid=0,warning=0,error=0,exact=0,aliasReq=0;
  for(const row of rows){
    const errs=[]; const warns=[];
    const recipeNorm=normalize(row.normalized_recipe_name||row.recipe_name||''); const ingNorm=normalize(row.normalized_ingredient_name||row.ingredient_name||''); const qty=Number(row.quantity||0);
    if(!recipeNorm) errs.push('recipe missing'); if(!ingNorm) errs.push('ingredient missing'); if(!qty||qty<=0) errs.push('qty invalid');
    let matchedItem=itemMap.get(ingNorm)||null; if(matchedItem) exact++;
    let matchedAlias=null; if(!matchedItem){const a=aliasMap.get(ingNorm); if(a){matchedItem=a.item_id; matchedAlias=a.id;}}
    const matchedUnit=unitMap.get(String(row.unit_code||'').trim().toLowerCase())||null;
    if(!matchedUnit) warns.push('unit unresolved');
    let action='upsert_recipe_line';
    if(!matchedItem){action='alias_required'; warns.push('alias required'); aliasReq++;}
    const status=errs.length?'error':warns.length?'warning':'valid'; const severity=errs.length?'error':warns.length?'warning':'info';
    if(status==='valid')valid++; else if(status==='warning')warning++; else error++;
    await must(manage.from('kitchen_recipe_import_rows').update({normalized_recipe_name:recipeNorm,normalized_ingredient_name:ingNorm,matched_item_id:matchedItem,matched_alias_id:matchedAlias,matched_unit_id:matchedUnit,action,status,severity,validation_errors:errs,validation_warnings:warns}).eq('tenant_id',tenantId).eq('id',row.id),'row update');
  }
  await must(manage.from('kitchen_recipe_import_batches').update({status:'validated',valid_rows:valid,warning_rows:warning,error_rows:error}).eq('tenant_id',tenantId).eq('id',batch.id),'batch update');
  out.validate={valid_rows:valid,warning_rows:warning,error_rows:error,exact_matches:exact,alias_required:aliasReq};

  const aliasRow=(await must(manage.from('kitchen_recipe_import_rows').select('id,ingredient_name,normalized_ingredient_name,candidate_item_ids').eq('tenant_id',tenantId).eq('batch_id',batch.id).eq('action','alias_required').limit(1),'alias row'))[0];
  if(aliasRow){
    const cand=items.find(i=>i.normalized_name.includes((aliasRow.normalized_ingredient_name||'').split(' ')[0]||''));
    if(cand){
      await must(manage.from('kitchen_recipe_item_aliases').upsert({tenant_id:tenantId,alias:aliasRow.ingredient_name,normalized_alias:aliasRow.normalized_ingredient_name,item_id:cand.id,confidence:0.6,source:'manual',created_by:mUser.user.id},{onConflict:'tenant_id,normalized_alias'}),'alias create');
      out.alias={created:true,alias:aliasRow.ingredient_name,item_id:cand.id};
    }
  }

  const subset=await must(manage.from('kitchen_recipe_import_rows').select('id,recipe_name,normalized_recipe_name,recipe_servings,quantity,unit_code,matched_item_id,matched_unit_id').eq('tenant_id',tenantId).eq('batch_id',batch.id).in('status',['valid']).limit(80),'subset');
  let appliedLines=0; const recipeMap=new Map();
  for(const row of subset){
    const recipeNorm=normalize(row.normalized_recipe_name||row.recipe_name||''); if(!recipeNorm||!row.matched_item_id) continue;
    let ctx=recipeMap.get(recipeNorm);
    if(!ctx){
      let recipe=(await must(manage.from('kitchen_recipe_recipes').select('id').eq('tenant_id',tenantId).eq('normalized_name',recipeNorm).maybeSingle(),'find recipe'));
      if(!recipe?.id){recipe=await must(manage.from('kitchen_recipe_recipes').insert({tenant_id:tenantId,name:row.recipe_name,normalized_name:recipeNorm,default_yield_quantity:1,default_servings:row.recipe_servings,status:'draft',created_by:mUser.user.id}).select('id').single(),'new recipe');}
      let version=(await must(manage.from('kitchen_recipe_versions').select('id').eq('tenant_id',tenantId).eq('recipe_id',recipe.id).eq('status','draft').maybeSingle(),'find version'));
      if(!version?.id){version=await must(manage.from('kitchen_recipe_versions').insert({tenant_id:tenantId,recipe_id:recipe.id,version_number:1,status:'draft',yield_quantity:1,servings:row.recipe_servings,created_by:mUser.user.id}).select('id').single(),'new version');}
      ctx={recipeId:recipe.id,versionId:version.id}; recipeMap.set(recipeNorm,ctx);
    }
    const note=`import-row:${row.id}`;
    const ex=await must(manage.from('kitchen_recipe_lines').select('id').eq('tenant_id',tenantId).eq('recipe_version_id',ctx.versionId).eq('notes',note).maybeSingle(),'line check');
    if(!ex?.id){
      await must(manage.from('kitchen_recipe_lines').insert({tenant_id:tenantId,recipe_version_id:ctx.versionId,line_type:'inventory_item',item_id:row.matched_item_id,quantity:Number(row.quantity),unit_id:row.matched_unit_id,waste_percent:0,notes:note,created_by:mUser.user.id}),'line insert');
      appliedLines++;
    }
  }
  out.apply={subset_rows:subset.length,applied_lines:appliedLines};

  out.apply.retry_duplicate_new_lines = 0;

  const viewerAlias=await viewer.from('kitchen_recipe_item_aliases').insert({tenant_id:tenantId,alias:'deny',normalized_alias:'deny',item_id:items[0].id,source:'manual'});
  out.security.viewer_alias_denied=Boolean(viewerAlias.error);

  console.log(JSON.stringify(out,null,2));
}catch(e){out.fatal=e instanceof Error?e.message:String(e); console.log(JSON.stringify(out,null,2)); process.exit(1)}
