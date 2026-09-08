// Fixtures exclusivamente para pruebas visuales. No se importan desde src.
export const transport = `
export const isSupabaseConfigured=true;
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Asuncion',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const profile={id:'r1',full_name:'Revendedora de prueba',role:'reseller',is_active:true,reseller_code:'REV-001'};
const account={id:'a1',name:'Efectivo',account_type:'cash',is_cash_account:true,is_active:true,current_balance:100000,initial_balance:0,day_income:100000,day_expense:0,day_count:1};
const bank={...account,id:'a2',name:'Banco',account_type:'bank',is_cash_account:false};
const product={id:'p1',name:'Drone con camara',brand:'Camaraza',model:'V2',main_image_url:'/demo-ecopower.png',stock_quantity:10,reserved_stock_quantity:2,wholesale_price:100000,suggested_price:150000,cost_price:80000,admin_details:{sku:'DR-01',retail_price:150000}};
const balances={estimated:50000,available:50000,liquidating:25000,paid:150000,pending_adjustments:0};
let rows=['confirmed','out_for_delivery','delivered_paid'].map((status,i)=>({id:'s'+i,sale_number:i+1,status,operation_date:day,customer_name_snapshot:'Cliente de prueba',customer_phone_snapshot:'0981123456',customer_name:'Cliente de prueba',delivery_city:'Asuncion',fulfillment_type:'delivery',sale_type:'reseller',product_name_snapshot:product.name,product_sale_price:150000,delivery_charged:20000,total_collected:170000,payment_method:'cash',financial_account_id:'a1',account:{name:'Efectivo'},cash_tendered_amount:200000,customer_contacted_at:null,main_image_url:product.main_image_url,reseller_commission:50000,items:[{id:'i'+i,sort_order:0,quantity:1,product_name_snapshot:product.name,product}]}));
window.__calls=[];
const tables={sales:rows,profiles:[profile],business_settings:[{id:true,default_cash_account_id:'a1',default_transfer_account_id:'a2'}],financial_movements:[],cash_sessions:[]};
export const supabase={auth:{getUser:async()=>({data:{user:{id:'r1'}}}),getSession:async()=>({data:{session:{user:{id:'r1'}}}}),signOut:async()=>({})},
from(name){ let data=tables[name]||[];let single=false;const builder=new Proxy({}, {get(_,method){if(method==='then')return resolve=>resolve({data:single?data[0]||null:data,error:null});return (...args)=>{if(method==='eq')data=data.filter(r=>r[args[0]]===args[1] || name==='profiles');if(method==='in')data=data.filter(r=>args[1].includes(r[args[0]]));if(method==='range')data=data.slice(args[0],args[1]+1);if(method==='single'||method==='maybeSingle')single=true;return builder}}});return builder},
async rpc(name,p={}){window.__calls.push({name,p});
if(name==='get_my_operation_home_v2')return {data:{today:{rows,total:rows.length},balances,weeks:[{start_date:'2026-09-07',orders:3,delivered:1,sales:150000,commission:50000},{start_date:'2026-08-31',orders:5,delivered:4,sales:600000,commission:200000}]}};
if(name==='get_my_operation_sales_v2')return {data:{rows:rows.filter(r=>!p.p_status||r.status===p.p_status),total:rows.length}};
if(name==='get_my_commission_balances_v2')return {data:balances};
if(name==='get_commission_sales_v2')return {data:rows.slice(0,1)};
if(name==='admin_operate_sale_v2'){let r=rows.find(r=>r.id===p.p_sale_id);if(p.p_next_status)r.status=p.p_next_status;if(p.p_contacted!==undefined)r.customer_contacted_at=p.p_contacted?new Date().toISOString():null;return {data:null}};
if(name==='get_financial_account_balances'||name==='admin_cash_day_v2')return {data:[account,bank]};
if(name==='get_admin_finance_dashboard')return {data:{}};
if(name==='admin_search_sale_products_v2')return {data:[product]};
if(name==='admin_manage_account_v2'||name==='admin_set_collection_defaults')return {data:null};
throw new Error('RPC sin fixture: '+name);
}};
`

export const entry = `
import React from 'react';import {createRoot} from 'react-dom/client';import {BrowserRouter} from 'react-router-dom';
import '/src/styles/main.css';
const pages={
'/admin/operacion':['/src/pages/admin/DailyOperations.jsx','DailyOperations'],
'/admin/ventas/nueva':['/src/pages/admin/SaleForm.jsx','SaleForm'],
'/admin/finanzas':['/src/pages/admin/FinanceAdmin.jsx','FinanceAdmin'],
'/admin/caja':['/src/pages/admin/CashAdmin.jsx','CashAdmin'],
'/panel':['/src/pages/panel/PanelHome.jsx','PanelHome'],
'/panel/ventas':['/src/pages/panel/PanelSales.jsx','PanelSales']};
const [path,name]=pages[location.pathname];const Page=(await import(/* @vite-ignore */ path))[name];
createRoot(document.getElementById('root')).render(<BrowserRouter>{location.pathname.startsWith('/admin')?<div className="admin-shell ax-shell"><aside className="admin-sidebar ax-sidebar"><strong>Camaraza Store</strong></aside><main className="admin-main ax-main"><Page/></main></div>:<Page/>}</BrowserRouter>);
`
