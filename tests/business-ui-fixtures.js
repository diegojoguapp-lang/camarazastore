export const transport = `
export const isSupabaseConfigured = true;
const product = {id:'00000000-0000-4000-8000-000000000001',slug:'parlante',name:'Parlante portatil Ecopower',category_name:'Audio',category_slug:'audio',brand:'Ecopower',model:'EP',retail_price:230000,available_stock_quantity:7,track_inventory:true,main_image_url:'/demo-ecopower.png',gallery_images:[],retail_featured:true};
const category = {id:'00000000-0000-4000-8000-000000000002',name:'Audio',slug:'audio',parent_id:null,image_url:'/demo-ecopower.png',show_on_home:true,home_sort_order:1,product_count:1};
const today = {date_from:'2026-09-06',date_to:'2026-09-06',delivered_count:6,created_count:8,coordinated_count:3,out_for_delivery_count:2,cancelled_count:1,potential_count:11,revenue:1380000,operating_profit:460000,expenses:100000,net_profit:360000,commissions_generated:120000,units_sold:8,cancellation_rate:14.29,cancellation_reasons:[{reason:'no_response',count:1}],channels:[{kind:'direct',delivered_count:4,revenue:920000,operating_profit:300000,commissions_generated:0},{kind:'reseller',delivered_count:2,revenue:460000,operating_profit:160000,commissions_generated:120000}]};
const days = Array.from({length:14},(_,i)=>({business_date:'2026-08-'+String(18+i).padStart(2,'0'),delivered_count:[8,11,7,10,13,6,0][i%7]}));
const data = {business_date:'2026-09-06',settings:{daily_delivered_goal:10,weekly_delivered_goal:60,monthly_delivered_goal:260},today,week:{...today,delivered_count:45,days},month:{...today,delivered_count:45,days:days.slice(0,6)},chart:days,streak:3,days_goal_met:2,best_day:13,finance:{money_current:24000000,inventory_value:15000000,pending_commissions:1300000},ranking:[{id:'r',name:'Maria Fernandez',delivered_month:15,revenue_month:3450000,commission_month:350000,cancelled_month:1}],closure:null,closures:[]};
window.__testStock = 7;
export const supabase = {
rpc:async(name,p={})=>{
  if(['get_retail_home_v3','get_retail_categories_v3','get_retail_catalog_v3','get_retail_product_v3'].includes(name)) name=name.replace('_v3','_v2');
  if(name==='get_admin_business_dashboard') return {data:structuredClone(data),error:null};
  if(name==='admin_save_business_goals') {data.settings={daily_delivered_goal:p.p_daily,weekly_delivered_goal:p.p_weekly,monthly_delivered_goal:p.p_monthly};return {data:data.settings};}
  if(name==='admin_close_business_day') {data.closure={business_date:p.p_date,goal:data.settings.daily_delivered_goal,snapshot:today,closed_at:'2026-09-06T21:00:00Z'};data.closures=[data.closure];return {data:data.closure};}
  if(name==='get_retail_home_v2') return {data:{categories:[category],featured:[product],new_products:[product],sections:[{...category,products:[product]}]}};
  if(name==='get_retail_categories_v2') return {data:[category]};
  if(name==='get_retail_catalog_v2') return {data:[product]};
  if(name==='get_retail_product_v2') return {data:{product,related:[]}};
  if(name==='get_retail_catalog') return {data:[product]};
  if(name==='get_retail_product') return {data:[product]};
  if(name==='validate_retail_cart') return {data:p.p_items.map(i=>({...product,available_stock_quantity:window.__testStock,requested_quantity:i.quantity,is_available:window.__testStock>=i.quantity,issue:window.__testStock>=i.quantity?null:'Stock insuficiente'}))};
  return {data:[]};
},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{url:'https://wa.me/595981000000'}})})})})};
`

export const entry = `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
const admin = location.pathname.startsWith('/admin');
if(admin) await import('/src/styles/main.css');
else await import('/src/storefront/storefront.css');
const Component = admin ? (await import('/src/pages/admin/AdminDashboard.jsx')).AdminDashboard : (await import('/src/storefront/StorefrontApp.jsx')).StorefrontApp;
createRoot(document.getElementById('root')).render(<BrowserRouter>{admin ? <div className="admin-shell ax-shell"><aside className="admin-sidebar ax-sidebar"><strong>Camaraza Store</strong><nav className="admin-nav ax-nav"><a href="/admin">Dashboard</a><a href="/admin/ventas">Ventas</a><a href="/admin/inventario">Inventario</a></nav></aside><div className="admin-main ax-main"><Component/></div></div> : <Component/>}</BrowserRouter>);
`
