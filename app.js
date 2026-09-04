const SUPABASE_URL="https://pghhvymhdfsfedppxquy.supabase.co";
const SUPABASE_KEY="sb_publishable_jhL89bDrMEJKsuStNkp0kw_daup7Rna";
const db=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const state={user:null,profile:null,workspace:null,members:[],movements:[],cards:[],concepts:[],goals:[],goalContributions:[],month:new Date(),movementFilter:"all"};
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n||0));
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const monthKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const monthLabel=d=>d.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
const todayISO=()=>new Date().toISOString().slice(0,10);
const isRealOutflow=x=>x.type==="expense" && (["debit","cash"].includes(x.payment_method)||["card_payment","kueski_payment"].includes(x.movement_role));
const accumulatedBalance=until=>state.movements.filter(x=>x.transaction_date<=until).reduce((sum,x)=>sum+(x.type==="income"?Number(x.amount):isRealOutflow(x)?-Number(x.amount):0),0);
const cardUsed=cid=>Math.max(0,state.movements.filter(x=>x.card_id===cid).reduce((sum,x)=>sum+((x.movement_role==="card_purchase"||x.movement_role==="kueski_purchase"||(x.payment_method==="department_store"&&x.movement_role==="normal"))?Number(x.amount):["card_payment","kueski_payment"].includes(x.movement_role)?-Number(x.amount):0),0));
const cardStatus=p=>p<30?"green":p<60?"yellow":p<80?"orange":"red";
const within24h=c=>Date.now()-new Date(c).getTime()<86400000;
function showModal(h){$("#modalContent").innerHTML=h;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
function notify(m){alert(m)}

async function init(){const {data:{session}}=await db.auth.getSession();if(session)await setUser(session.user);else showLogin();db.auth.onAuthStateChange(async(_,s)=>{if(s)await setUser(s.user);else showLogin()})}
function showLogin(){$("#loginView").classList.remove("hidden");$("#dashboardView").classList.add("hidden")}
async function setUser(u){state.user=u;$("#loginView").classList.add("hidden");$("#dashboardView").classList.remove("hidden");$("#userEmail").textContent=u.email||"";$("#userAvatar").textContent=(u.email||"U")[0].toUpperCase();$("#welcomeTitle").textContent=`Hola, ${u.user_metadata?.full_name?.split(" ")[0]||u.email?.split("@")[0]||"usuario"} 👋`;await ensureProfile();await loadAll()}

async function ensureProfile(){
 const {data}=await db.from("profiles").select("*").eq("id",state.user.id).maybeSingle();
 if(data){state.profile=data;return}
 const {data:p,error}=await db.from("profiles").insert({id:state.user.id,email:state.user.email,display_name:state.user.user_metadata?.full_name||state.user.email?.split("@")[0]}).select().single();
 if(error){console.warn(error);return}state.profile=p;
}
async function ensureWorkspace(){
 let {data,error}=await db.from("workspace_members").select("workspace_id,role,workspaces(*)").eq("user_id",state.user.id).order("created_at",{ascending:true}).limit(1).maybeSingle();
 if(error){console.warn(error);return}
 if(!data){
   const {data:w,error:we}=await db.from("workspaces").insert({name:state.profile?.display_name||"Mis finanzas",type:"individual",owner_id:state.user.id}).select().single();
   if(we){console.warn(we);return}
   const {data:m,error:me}=await db.from("workspace_members").insert({workspace_id:w.id,user_id:state.user.id,role:"owner"}).select().single();
   if(me){console.warn(me);return}
   data={workspace_id:w.id,role:"owner",workspaces:w};
 }
 state.workspace=data.workspaces;
 const {data:members}=await db.from("workspace_members").select("user_id,role,profiles(display_name,email)").eq("workspace_id",state.workspace.id);
 state.members=members||[];updateWorkspaceUI();
}
function updateWorkspaceUI(){
 const w=state.workspace,mode=w?.type||"individual",label=mode==="duo"?"👥 Duo":mode==="family"?"👨‍👩‍👧‍👦 Familiar":"👤 Individual";
 $("#workspaceBtn").textContent=label+(w?.name?` · ${w.name}`:"");$("#inviteBtn").classList.toggle("hidden",mode==="individual");
}
async function loadAll(){
 await ensureWorkspace();const id=state.workspace?.id;if(!id)return;
 const [m,c,co,g,gc]=await Promise.all([
 db.from("movements").select("*").eq("workspace_id",id).order("created_at",{ascending:false}),
 db.from("cards").select("*").eq("workspace_id",id).order("created_at",{ascending:false}),
 db.from("concepts").select("*").eq("workspace_id",id).order("name"),
 db.from("savings_goals").select("*").eq("workspace_id",id).order("created_at",{ascending:false}),
 db.from("savings_goal_contributions").select("*").eq("workspace_id",id).order("contribution_date",{ascending:false})]);
 state.movements=m.data||[];state.cards=c.data||[];state.concepts=co.data||[];state.goals=g.data||[];state.goalContributions=gc.data||[];render();
}
function currentRows(){const k=monthKey(state.month);return state.movements.filter(x=>String(x.transaction_date).slice(0,7)===k)}
function render(){ $("#currentMonthLabel").textContent=monthLabel(state.month);renderHome();renderMovements();renderCards();renderGoals();renderConcepts();renderSummary()}
function renderHome(){
 const r=currentRows(),income=r.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0),real=r.filter(isRealOutflow).reduce((s,x)=>s+Number(x.amount),0),registered=r.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount),0),available=accumulatedBalance(todayISO()),score=income?Math.max(0,Math.min(100,Math.round((1-real/income)*100))):null;
 $("#incomeTotal").textContent=money(income);$("#expenseTotal").textContent=money(registered);$("#availableTotal").textContent=money(available);$("#monthScore").textContent=score===null?"—":`${score}/100`;$("#monthScoreText").textContent=score===null?"Aún no hay ingresos registrados":score>=75?"Buen mes":score>=50?"Mes regular":"Mes complicado";
 $("#recentList").innerHTML=state.movements.slice(0,5).map(movementHTML).join("")||'<div class="empty">Todavía no hay movimientos.</div>';$("#alertsList").innerHTML=buildAlerts();
}
function buildAlerts(){
 const a=[];state.cards.forEach(c=>{const l=Number(c.credit_limit),u=cardUsed(c.id);if(l&&u/l>=.8)a.push(`⚠️ ${esc(c.name)}: crédito utilizado al ${(u/l*100).toFixed(0)}%.`)});
 const r=currentRows(),i=r.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0),o=r.filter(isRealOutflow).reduce((s,x)=>s+Number(x.amount),0);
 if(i&&o>i)a.push("🔴 Este mes tus salidas reales superan tus ingresos.");
 return a.length?a.map(x=>`<div class="movement-item">${x}</div>`).join(""):'<div class="empty">No hay alertas por ahora.</div>';
}
function movementHTML(x){const ok=within24h(x.created_at);return `<div class="movement-item"><div class="movement-left"><div class="movement-icon">${x.type==="income"?"↗":"↘"}</div><div><div class="movement-name">${esc(x.concept_name||x.description||"Movimiento")}</div><div class="movement-meta">${esc(x.transaction_date)} · ${esc(x.payment_method||"")}${x.is_shared?" · Compartido":""}</div></div></div><div class="actions"><strong class="${x.type==="income"?"income-amount":"expense-amount"}">${x.type==="income"?"+":"-"}${money(x.amount)}</strong>${ok?`<button class="icon-btn" onclick="editMovement('${x.id}')">✎</button><button class="icon-btn" onclick="deleteMovement('${x.id}')">×</button>`:"🔒"}</div></div>`}
function renderMovements(){let r=currentRows();if(state.movementFilter!=="all")r=r.filter(x=>state.movementFilter==="income"?x.type==="income":x.type==="expense");$("#movementsList").innerHTML=r.map(movementHTML).join("")||'<div class="empty">No hay movimientos para este mes.</div>'}
function renderCards(){
 $("#cardsGrid").innerHTML=state.cards.map(c=>{
   const l=Number(c.credit_limit),u=cardUsed(c.id),p=l?Math.min(100,u/l*100):0,s=cardStatus(p);
   const schedule=c.product_type==="Kueski"
     ? `<div class="card-schedule"><span>Pago: <strong>${c.due_day?`día ${c.due_day}`:"sin configurar"}</strong></span></div>`
     : `<div class="card-schedule"><span>Corte: <strong>${c.cut_day?`día ${c.cut_day}`:"sin configurar"}</strong></span><span>Pago: <strong>${c.due_day?`día ${c.due_day}`:"sin configurar"}</strong></span></div>`;
   return `<article class="credit-card status-${s}" style="--card-neon:${s==="green"?"#b6ff00":s==="yellow"?"#ffe600":s==="orange"?"#ff8a00":"#ff3b5c"}" onclick="showCard('${c.id}')"><span class="card-type">${esc(c.product_type)}</span><h3>${esc(c.name)}</h3><div class="balance">${money(u)}</div><div class="bar"><i style="width:${p}%"></i></div><div class="card-foot"><span>Usado ${p.toFixed(0)}%</span><span>${money(Math.max(0,l-u))} disponible</span></div>${schedule}</article>`
 }).join("")||'<div class="empty panel">Todavía no tienes tarjetas.</div>';
}
function goalData(g){
 const base=Number(g.current_amount||0);
 const contribs=state.goalContributions.filter(x=>x.goal_id===g.id);
 const contributed=contribs.reduce((s,x)=>s+Number(x.amount||0),0);
 const saved=base+contributed;
 const target=Number(g.target_amount||0);
 const remaining=Math.max(0,target-saved);
 const planned=Number(g.planned_amount||0);
 const freq=g.frequency||"monthly";
 let estimated=null;
 if(remaining<=0){estimated=new Date();}
 else if(planned>0){
   const units=Math.ceil(remaining/planned);
   const d=new Date();
   if(freq==="biweekly") d.setDate(d.getDate()+units*14);
   else d.setMonth(d.getMonth()+units);
   estimated=d;
 }
 return {base,contribs,contributed,saved,target,remaining,planned,freq,estimated};
}
function goalEstimateText(d){if(d.remaining<=0)return "🎉 Meta alcanzada";if(!d.planned)return "Configura una aportación para calcular la fecha";return `Fecha estimada: <strong>${d.estimated.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}</strong>`}
function renderGoals(){
 $("#goalsGrid").innerHTML=state.goals.map(g=>{const d=goalData(g);const p=d.target?Math.min(100,d.saved/d.target*100):0;const freqLabel=d.freq==="biweekly"?"quincena":"mes";return `<article class="goal" onclick="showGoal('${g.id}')"><div class="goal-head"><div><h3>${esc(g.name)}</h3><small class="muted">Meta ${money(d.target)}</small></div><span class="goal-percent">${p.toFixed(0)}%</span></div><div class="amount">${money(d.saved)} <span>/ ${money(d.target)}</span></div><div class="bar"><i style="width:${p}%"></i></div><div class="goal-stats"><span>Faltan <strong>${money(d.remaining)}</strong></span><span>${d.planned?`${money(d.planned)} / ${freqLabel}`:"Sin aportación programada"}</span></div><div class="goal-estimate">${goalEstimateText(d)}</div><button type="button" class="secondary-btn goal-action" onclick="event.stopPropagation();contributionForm('${g.id}')">+ Registrar aportación</button></article>`}).join("")||'<div class="empty panel">Crea tu primera meta.</div>';
}
function conceptHTML(x){return `<div class="concept"><span>${esc(x.name)}</span><button class="icon-btn" onclick="deleteConcept('${x.id}')">×</button></div>`}
function renderConcepts(){const i=state.concepts.filter(x=>x.type==="income"),e=state.concepts.filter(x=>x.type==="expense");$("#incomeConcepts").innerHTML=i.map(conceptHTML).join("")||'<div class="empty">Sin conceptos.</div>';$("#expenseConcepts").innerHTML=e.map(conceptHTML).join("")||'<div class="empty">Sin conceptos.</div>'}
function renderSummary(){
 const r=currentRows(),i=r.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0),registered=r.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount),0),real=r.filter(isRealOutflow).reduce((s,x)=>s+Number(x.amount),0),score=i?Math.max(0,Math.min(100,Math.round((1-real/i)*100))):0;
 $("#summaryPanel").innerHTML=`<div class="summary-hero"><div class="summary-score"><div class="muted">Calificación</div><div class="big">${i?score:"—"}</div><h3>${i?(score>=75?"🟢 Buen mes":score>=50?"🟡 Mes regular":"🔴 Mes complicado"):"Sin datos suficientes"}</h3><p class="muted">${i?`Ingresaste ${money(i)} y tu salida real fue ${money(real)}.`:"Registra ingresos y gastos para generar tu resumen."}</p></div><div class="summary-numbers"><div class="summary-line"><span>Ingresos del mes</span><strong>${money(i)}</strong></div><div class="summary-line"><span>Gastos registrados</span><strong>${money(registered)}</strong></div><div class="summary-line"><span>Salidas reales</span><strong>${money(real)}</strong></div><div class="summary-line"><span>Saldo acumulado</span><strong>${money(accumulatedBalance(todayISO()))}</strong></div></div></div>`;
}
function movementForm(ex=null, forcedType=null){
 const edit=!!ex,type=ex?.type||forcedType||"expense",cs=state.concepts.filter(c=>c.type===type),cards=state.cards;
 showModal(`<form class="form" id="movementForm"><h3>${edit?"Modificar":"Nuevo"} movimiento</h3>
 ${edit?`<label>Tipo<select id="mType"><option value="expense" ${type==="expense"?"selected":""}>Gasto</option><option value="income" ${type==="income"?"selected":""}>Ingreso</option></select></label>`:`<input type="hidden" id="mType" value="${type}">`}
 <label>Concepto<select id="mConcept"><option value="">Seleccionar...</option>${cs.map(c=>`<option value="${esc(c.name)}" ${ex?.concept_name===c.name?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
 <label>Monto<input id="mAmount" type="number" min=".01" step=".01" required value="${ex?.amount||""}"></label>
 <label>Fecha<input id="mDate" type="date" required value="${ex?.transaction_date||todayISO()}"></label>
 <label>Método<select id="mPayment"><option value="debit">Débito</option><option value="cash">Efectivo</option><option value="credit">Tarjeta de crédito</option><option value="department_store">Departamental</option><option value="kueski">Kueski</option><option value="card_payment">Pago de tarjeta</option></select></label>
 <div id="cardSelectWrap"></div>
 <div id="kueskiInstallmentsWrap"></div>
 <label>Clasificación<select id="mShared"><option value="false">Personal</option><option value="true" ${ex?.is_shared?"selected":""}>Compartido</option></select></label>
 <label>Notas (opcional)<input id="mNotes" value="${esc(ex?.notes||"")}"></label>
 <div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar</button></div></form>`);
 const refreshConcepts=()=>{
   const t=$("#mType").value;
   const list=state.concepts.filter(c=>c.type===t);
   $("#mConcept").innerHTML=`<option value="">Seleccionar...</option>${list.map(c=>`<option value="${esc(c.name)}" ${ex?.concept_name===c.name?"selected":""}>${esc(c.name)}</option>`).join("")}`;
 };
 const refresh=()=>{const pm=$("#mPayment").value,w=$("#cardSelectWrap"),kw=$("#kueskiInstallmentsWrap");if(["credit","department_store","kueski","card_payment"].includes(pm))w.innerHTML=`<label>Tarjeta / crédito<select id="mCard">${cards.filter(c=>pm!=="kueski"||c.product_type==="Kueski").map(c=>`<option value="${c.id}" ${ex?.card_id===c.id?"selected":""}>${esc(c.name)} · ${esc(c.product_type)}</option>`).join("")}</select></label>`;else w.innerHTML="";if(pm==="kueski"){const current=Number(ex?.kueski_installments)||1;kw.innerHTML=`<label>¿A cuántas quincenas? <select id="mKueskiInstallments">${Array.from({length:12},(_,i)=>i+1).map(n=>`<option value="${n}" ${n===current?"selected":""}>${n} ${n===1?"quincena":"quincenas"}</option>`).join("")}</select><small class="form-help">Kueski permite dividir la compra de 1 a 12 quincenas.</small></label>`}else if(pm==="credit"||pm==="department_store"){const current=Number(ex?.card_installments)||1;const label=pm==="department_store"?"🛍️ ¿Compra a meses sin intereses?":"💳 ¿Compra a MSI?";kw.innerHTML=`<div class="msi-box"><label><strong>${label}</strong><select id="mCardInstallments"><option value="1" ${current===1?"selected":""}>No, compra normal</option>${[3,6,9,12,18,24].map(n=>`<option value="${n}" ${n===current?"selected":""}>${n} meses sin intereses</option>`).join("")}</select><small class="form-help">Puedes dividir esta compra entre 3 y 24 meses. El total ocupa crédito desde la compra y la mensualidad se calcula automáticamente.</small></label></div>`}else kw.innerHTML=""};
 if($("#mType")) $("#mType").onchange=refreshConcepts;$("#mPayment").onchange=refresh;
 if(ex)$("#mPayment").value=ex.movement_role==="card_payment"?"card_payment":ex.payment_method||"debit";refresh();
 $("#movementForm").onsubmit=async e=>{e.preventDefault();const pm=$("#mPayment").value,isPay=pm==="card_payment",role=isPay?"card_payment":pm==="credit"?"card_purchase":pm==="kueski"?"kueski_purchase":"normal";
 const payload={type:$("#mType").value,concept_name:$("#mConcept").value||null,amount:Number($("#mAmount").value),transaction_date:$("#mDate").value,payment_method:isPay?"debit":pm,is_shared:$("#mShared").value==="true",notes:$("#mNotes").value||null,movement_role:pm==="department_store"?"card_purchase":role,card_id:$("#mCard")?.value||null,kueski_installments:pm==="kueski"?Number($("#mKueskiInstallments")?.value||1):null,card_installments:(pm==="credit"||pm==="department_store")?Number($("#mCardInstallments")?.value||1):null};
 const q=ex?db.from("movements").update(payload).eq("id",ex.id):db.from("movements").insert({...payload,user_id:state.user.id,workspace_id:state.workspace.id});const {error}=await q;if(error)return notify(error.message);closeModal();await loadAll()};
}
async function editMovement(id){const m=state.movements.find(x=>x.id===id);if(!m)return;if(!within24h(m.created_at))return notify("Este movimiento ya está bloqueado.");movementForm(m)}
async function deleteMovement(id){const m=state.movements.find(x=>x.id===id);if(!m||!within24h(m.created_at))return notify("Este movimiento ya está bloqueado.");if(!confirm("¿Eliminar este movimiento?"))return;const {error}=await db.from("movements").delete().eq("id",id);if(error)return notify(error.message);loadAll()}
function cardForm(existing=null){
 const edit=!!existing;
 const type=existing?.product_type||"Tarjeta de crédito";
 showModal(`<form class="form" id="cardForm"><h3>${edit?"Editar tarjeta":"Nueva tarjeta o crédito"}</h3><label>Nombre<input id="cName" required placeholder="Ej. BBVA Oro" value="${esc(existing?.name||"")}"></label><label>Producto<select id="cType" ${edit?"disabled":""}><option ${type==="Tarjeta de crédito"?"selected":""}>Tarjeta de crédito</option><option ${type==="Tarjeta departamental"?"selected":""}>Tarjeta departamental</option><option ${type==="Kueski"?"selected":""}>Kueski</option></select></label><label>Límite de crédito<input id="cLimit" type="number" min="0" required value="${Number(existing?.credit_limit||0)}"></label><div id="cardScheduleFields"></div><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">${edit?"Guardar cambios":"Guardar"}</button></div></form>`);
 const refreshSchedule=()=>{
   const kueski=$("#cType").value==="Kueski";
   $("#cardScheduleFields").innerHTML=kueski
     ? `<label>Día de pago<input id="cDue" type="number" min="1" max="31" placeholder="Ej. 15" value="${existing?.due_day||""}"></label>`
     : `<div class="schedule-fields"><label>Día de corte<input id="cCut" type="number" min="1" max="31" placeholder="Ej. 10" value="${existing?.cut_day||""}"></label><label>Día de pago<input id="cDue" type="number" min="1" max="31" placeholder="Ej. 30" value="${existing?.due_day||""}"></label></div>`;
 };
 $("#cType").onchange=refreshSchedule;
 refreshSchedule();
 $("#cardForm").onsubmit=async e=>{
   e.preventDefault();
   const selectedType=$("#cType").value;
   const payload={name:$("#cName").value.trim(),credit_limit:Number($("#cLimit").value),cut_day:selectedType==="Kueski"?null:(Number($("#cCut").value)||null),due_day:Number($("#cDue").value)||null};
   let result;
   if(edit) result=await db.from("cards").update(payload).eq("id",existing.id).eq("workspace_id",state.workspace.id);
   else result=await db.from("cards").insert({...payload,user_id:state.user.id,workspace_id:state.workspace.id,product_type:selectedType});
   if(result.error)return notify(result.error.message);
   closeModal();await loadAll();
 };
}
async function editCard(id){const c=state.cards.find(x=>x.id===id);if(!c)return;cardForm(c)}
async function deleteCard(id){
 const c=state.cards.find(x=>x.id===id);
 if(!c)return;
 const movementCount=state.movements.filter(x=>x.card_id===id).length;
 const warning=movementCount?`\n\nEsta tarjeta tiene ${movementCount} movimiento${movementCount===1?"":"s"} registrado${movementCount===1?"":"s"}. Se conservarán como historial, pero dejarán de estar vinculados a esta tarjeta.`:"";
 if(!confirm(`¿Eliminar la tarjeta “${c.name}”?${warning}\n\nEsta acción no se puede deshacer.`))return;
 const {error}=await db.from("cards").delete().eq("id",id).eq("workspace_id",state.workspace.id);
 if(error)return notify(error.message);
 closeModal();await loadAll();
}
function conceptForm(){showModal(`<form class="form" id="conceptForm"><h3>Nuevo concepto</h3><label>Tipo<select id="coType"><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label><label>Nombre<input id="coName" required placeholder="Ej. Costco"></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar</button></div></form>`);$("#conceptForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("concepts").insert({user_id:state.user.id,workspace_id:state.workspace.id,type:$("#coType").value,name:$("#coName").value.trim()});if(error)return notify(error.message);closeModal();loadAll()}}
async function deleteConcept(id){if(!confirm("¿Eliminar este concepto?"))return;const {error}=await db.from("concepts").delete().eq("id",id);if(error)return notify(error.message);loadAll()}
function goalForm(){showModal(`<form class="form" id="goalForm"><h3>Nueva meta de ahorro</h3><p class="muted tiny">La fecha estimada se calcula automáticamente según tu meta y tu aportación programada.</p><label>Nombre<input id="gName" required placeholder="Ej. Fondo para casa"></label><label>Meta<input id="gTarget" type="number" min="1" step="0.01" required placeholder="90000"></label><label>Aportación programada<input id="gPlanned" type="number" min="0" step="0.01" required placeholder="1000"></label><label>Frecuencia<select id="gFreq"><option value="monthly">Mensual</option><option value="biweekly">Quincenal</option></select></label><label>Ahorro inicial (opcional)<input id="gInitial" type="number" min="0" step="0.01" value="0"></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar</button></div></form>`);$("#goalForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("savings_goals").insert({user_id:state.user.id,workspace_id:state.workspace.id,name:$("#gName").value.trim(),target_amount:Number($("#gTarget").value),current_amount:Number($("#gInitial").value||0),planned_amount:Number($("#gPlanned").value||0),frequency:$("#gFreq").value});if(error)return notify(error.message);closeModal();loadAll()}}
async function editContribution(id){
 const x=state.goalContributions.find(c=>c.id===id); if(!x)return;
 showModal(`<form class="form" id="editContributionForm"><h3>Editar aportación</h3><p class="muted">Al guardar, el avance y la fecha estimada de la meta se recalcularán automáticamente.</p><label>Monto<input id="egcAmount" type="number" min="0.01" step="0.01" value="${Number(x.amount||0)}" required></label><label>Fecha<input id="egcDate" type="date" value="${esc(x.contribution_date)}" required></label><label>Nota (opcional)<input id="egcNote" value="${esc(x.note||'')}" placeholder="Ej. Aportación extraordinaria"></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar cambios</button></div></form>`);
 $("#editContributionForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("savings_goal_contributions").update({amount:Number($("#egcAmount").value),contribution_date:$("#egcDate").value,note:$("#egcNote").value.trim()||null}).eq("id",id).eq("workspace_id",state.workspace.id);if(error)return notify(error.message);closeModal();await loadAll();showGoal(x.goal_id)};
}
async function deleteContribution(id){
 const x=state.goalContributions.find(c=>c.id===id);if(!x)return;
 if(!confirm(`¿Eliminar la aportación de ${money(x.amount)} del ${x.contribution_date}?\n\nEl saldo y la fecha estimada de la meta se recalcularán.`))return;
 const {error}=await db.from("savings_goal_contributions").delete().eq("id",id).eq("workspace_id",state.workspace.id);if(error)return notify(error.message);await loadAll();showGoal(x.goal_id);
}
async function deleteGoal(id){
 const g=state.goals.find(x=>x.id===id);if(!g)return;
 const d=goalData(g);
 if(!confirm(`¿Eliminar la meta “${g.name}”?\n\nSe eliminarán también sus ${d.contribs.length} aportación${d.contribs.length===1?'':'es'}. Esta acción no se puede deshacer.`))return;
 const {error}=await db.from("savings_goals").delete().eq("id",id).eq("workspace_id",state.workspace.id);if(error)return notify(error.message);closeModal();await loadAll();
}
function showGoal(id){const g=state.goals.find(x=>x.id===id);if(!g)return;const d=goalData(g);const freqLabel=d.freq==="biweekly"?"quincena":"mes";const rows=d.contribs.map(x=>`<div class="goal-contribution"><div class="goal-contribution-main"><div><strong>${money(x.amount)}</strong><small>${esc(x.contribution_date)}${x.note?` · ${esc(x.note)}`:""}</small></div><div class="goal-contribution-actions"><button type="button" class="icon-btn" title="Editar aportación" onclick="editContribution('${x.id}')">✎</button><button type="button" class="icon-btn goal-delete-contribution" title="Eliminar aportación" onclick="deleteContribution('${x.id}')">×</button></div></div></div>`).join("")||'<div class="empty">Todavía no hay aportaciones registradas.</div>';showModal(`<div class="goal-detail"><div class="detail-header"><div><span class="card-type">META DE AHORRO</span><h3>${esc(g.name)}</h3></div><div class="detail-usage">${Math.min(100,d.target?d.saved/d.target*100:0).toFixed(0)}%<small>avance</small></div></div><div class="detail-summary"><div><small>Meta</small><strong>${money(d.target)}</strong></div><div><small>Ahorrado</small><strong>${money(d.saved)}</strong></div><div><small>Falta</small><strong>${money(d.remaining)}</strong></div></div><div class="goal-progress-big"><div class="bar"><i style="width:${Math.min(100,d.target?d.saved/d.target*100:0)}%"></i></div></div><div class="goal-estimate-large">${goalEstimateText(d)}${d.planned?`<small>Con ${money(d.planned)} por ${freqLabel}, recalculada automáticamente con cada aportación.</small>`:""}</div><div class="form-actions goal-main-actions"><button class="primary-btn" onclick="closeModal();contributionForm('${g.id}')">+ Registrar aportación</button><button class="secondary-btn" onclick="goalEditForm('${g.id}')">✎ Editar meta</button><button class="danger-btn" onclick="deleteGoal('${g.id}')">🗑 Eliminar meta</button><button class="danger-btn" onclick="closeModal()">Cerrar</button></div><div class="detail-section"><div class="detail-section-title">💰 Aportaciones</div><div class="goal-contributions">${rows}</div></div></div>`)}
function goalEditForm(id){const g=state.goals.find(x=>x.id===id);if(!g)return;showModal(`<form class="form" id="editGoalForm"><h3>Editar meta</h3><label>Nombre<input id="egName" required value="${esc(g.name)}"></label><label>Meta<input id="egTarget" type="number" min="1" step="0.01" required value="${Number(g.target_amount||0)}"></label><label>Aportación programada<input id="egPlanned" type="number" min="0" step="0.01" required value="${Number(g.planned_amount||0)}"></label><label>Frecuencia<select id="egFreq"><option value="monthly" ${g.frequency==='monthly'?'selected':''}>Mensual</option><option value="biweekly" ${g.frequency==='biweekly'?'selected':''}>Quincenal</option></select></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal();showGoal('${g.id}')">Cancelar</button><button class="primary-btn">Guardar cambios</button></div></form>`);$("#editGoalForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("savings_goals").update({name:$("#egName").value.trim(),target_amount:Number($("#egTarget").value),planned_amount:Number($("#egPlanned").value||0),frequency:$("#egFreq").value}).eq("id",id).eq("workspace_id",state.workspace.id);if(error)return notify(error.message);closeModal();await loadAll();showGoal(id)}}
function contributionForm(goalId){const g=state.goals.find(x=>x.id===goalId);if(!g)return;showModal(`<form class="form" id="contributionForm"><h3>Registrar aportación</h3><p class="muted">La fecha estimada se actualizará automáticamente.</p><label>Monto<input id="gcAmount" type="number" min="0.01" step="0.01" required></label><label>Fecha<input id="gcDate" type="date" value="${todayISO()}" required></label><label>Nota (opcional)<input id="gcNote" placeholder="Ej. Aportación extraordinaria"></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar aportación</button></div></form>`);$("#contributionForm").onsubmit=async e=>{e.preventDefault();const amount=Number($("#gcAmount").value);const {error}=await db.from("savings_goal_contributions").insert({user_id:state.user.id,workspace_id:state.workspace.id,goal_id:goalId,amount,contribution_date:$("#gcDate").value,note:$("#gcNote").value.trim()||null});if(error)return notify(error.message);closeModal();await loadAll();showGoal(goalId)}}
function dateObj(v){const [y,m,d]=String(v).slice(0,10).split("-").map(Number);return y&&m&&d?new Date(y,m-1,d):null}
function isoDate(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`}
function clampDay(y,m,day){return Math.min(day,new Date(y,m,0).getDate())}
function cycleInfo(c){
 const today=dateObj(todayISO()),cut=Number(c.cut_day),due=Number(c.due_day);
 if(!cut)return {label:c.product_type==="Kueski"?"Sin fecha de corte":"Sin fecha de corte configurada",period:null,nextDue:null};
 const y=today.getFullYear(),m=today.getMonth()+1;
 let cutThis=new Date(y,m-1,clampDay(y,m,cut));
 let cutPrev;
 if(today>=cutThis){cutPrev=new Date(y,m-1,clampDay(y,m,cut)); cutThis=new Date(y,m,clampDay(y,m+1,cut));}
 else {cutPrev=new Date(y,m-2,clampDay(y,m-1,cut));}
 const periodStart=new Date(cutPrev.getFullYear(),cutPrev.getMonth(),cutPrev.getDate()+1);
 const periodEnd=today<cutThis?today:cutThis;
 let dueDate=null;
 if(due){
   const base=cutPrev;
   let dy=base.getFullYear(),dm=base.getMonth()+1;
   if(due<=cut){dm++;}
   dueDate=new Date(dy,dm-1,clampDay(dy,dm,due));
   if(dueDate<today){const nc=new Date(base.getFullYear(),base.getMonth()+1,1);dy=nc.getFullYear();dm=nc.getMonth()+1;if(due<=cut)dm++;dueDate=new Date(dy,dm-1,clampDay(dy,dm,due));}
 }
 return {label:`Del ${periodStart.toLocaleDateString("es-MX")} al ${periodEnd.toLocaleDateString("es-MX")}`,period:{start:isoDate(periodStart),end:isoDate(periodEnd)},nextDue:dueDate?dueDate.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"}):null};
}
function kueskiPaymentDate(date){const d=dateObj(date);if(!d)return null;const day=d.getDate();if(day>=25||day<=9){return new Date(d.getFullYear(),d.getMonth()+(day>=25?1:0),15)}return new Date(d.getFullYear(),d.getMonth(),30)}
function kueskiSchedule(purchase){const first=kueskiPaymentDate(purchase.transaction_date);const n=Math.min(12,Math.max(1,Number(purchase.kueski_installments)||1));const amount=Number(purchase.amount)||0;return first?Array.from({length:n},(_,i)=>{const d=new Date(first);d.setDate(d.getDate()+15*i);return {date:d,amount:amount/n,index:i+1,total:n}}):[];}
function cardDueDateForPurchase(card,date){const d=dateObj(date);const cut=Number(card.cut_day),due=Number(card.due_day);if(!d||!cut||!due)return null;const y=d.getFullYear(),m=d.getMonth()+1;let cutDate=new Date(y,m-1,clampDay(y,m,cut));if(d>cutDate)cutDate=new Date(y,m,clampDay(y,m+1,cut));let dy=cutDate.getFullYear(),dm=cutDate.getMonth()+1;if(due<=cut)dm++;return new Date(dy,dm-1,clampDay(dy,dm,due));}
function cardMsiSchedule(purchase,card){const n=Math.max(1,Number(purchase.card_installments)||1),amount=Number(purchase.amount)||0,first=cardDueDateForPurchase(card,purchase.transaction_date);if(n<=1||!first)return [];const base=Math.floor((amount/n)*100)/100;const last=Number((amount-base*(n-1)).toFixed(2));return Array.from({length:n},(_,i)=>{const d=new Date(first.getFullYear(),first.getMonth()+i,clampDay(first.getFullYear(),first.getMonth()+i+1,first.getDate()));return {date:d,amount:i===n-1?last:Number(base.toFixed(2)),index:i+1,total:n};});}
function statementInfo(card){
 const today=dateObj(todayISO()), cut=Number(card.cut_day), due=Number(card.due_day);
 if(!today||!cut||!due)return null;
 const y=today.getFullYear(),m=today.getMonth()+1;
 let currentCut=new Date(y,m-1,clampDay(y,m,cut));
 let lastCut;
 if(today>=currentCut) lastCut=currentCut;
 else lastCut=new Date(y,m-2,clampDay(y,m-1,cut));
 const prevCut=new Date(lastCut.getFullYear(),lastCut.getMonth()-1,clampDay(lastCut.getFullYear(),lastCut.getMonth(),cut));
 const start=new Date(prevCut.getFullYear(),prevCut.getMonth(),prevCut.getDate()+1);
 const end=new Date(lastCut.getFullYear(),lastCut.getMonth(),lastCut.getDate());
 let dueMonth=lastCut.getMonth()+1, dueYear=lastCut.getFullYear();
 if(due<=cut){dueMonth++; if(dueMonth>12){dueMonth=1;dueYear++;}}
 const dueDate=new Date(dueYear,dueMonth-1,clampDay(dueYear,dueMonth,due));
 return {start:isoDate(start),end:isoDate(end),cutDate:lastCut,dueDate,periodLabel:`Del ${start.toLocaleDateString("es-MX")} al ${end.toLocaleDateString("es-MX")}`};
}
function statementAmount(card, rows){
 const info=statementInfo(card); if(!info)return {gross:0,paid:0,pending:0,info:null,items:[]};
 const normal=rows.filter(x=>x.movement_role==="card_purchase" && Number(x.card_installments)<=1 && x.transaction_date>=info.start && x.transaction_date<=info.end);
 const msi=[];
 rows.filter(x=>x.movement_role==="card_purchase" && Number(x.card_installments)>1).forEach(x=>{
   const schedule=cardMsiSchedule(x,card);
   const item=schedule.find(i=>isoDate(i.date)===isoDate(info.dueDate));
   if(item)msi.push({x,amount:item.amount,index:item.index,total:item.total});
 });
 const items=[...normal.map(x=>({x,amount:Number(x.amount),kind:"normal"})),...msi.map(z=>({x:z.x,amount:z.amount,kind:"msi",index:z.index,total:z.total}))];
 const gross=items.reduce((s,i)=>s+Number(i.amount||0),0);
 const paymentsAfterCut=rows.filter(x=>["card_payment","kueski_payment"].includes(x.movement_role)&&x.transaction_date>info.end).reduce((s,x)=>s+Number(x.amount||0),0);
 const pending=Math.max(0,Number((gross-paymentsAfterCut).toFixed(2)));
 return {gross,paymentsAfterCut,paid:Math.min(gross,paymentsAfterCut),pending,info,items};
}
function showCard(id){
 const c=state.cards.find(x=>x.id===id);if(!c)return;
 const used=cardUsed(id),limit=Number(c.credit_limit)||0,available=Math.max(0,limit-used),p=limit?Math.min(100,used/limit*100):0;
 const rows=state.movements.filter(x=>x.card_id===id).sort((a,b)=>String(b.transaction_date).localeCompare(String(a.transaction_date)));
 const purchases=rows.filter(x=>x.movement_role==="card_purchase"||x.movement_role==="kueski_purchase"||(x.payment_method==="department_store"&&x.movement_role==="normal"));
 const payments=rows.filter(x=>["card_payment","kueski_payment"].includes(x.movement_role));
 const purchaseTotal=purchases.reduce((s,x)=>s+Number(x.amount),0),paymentTotal=payments.reduce((s,x)=>s+Number(x.amount),0);
 const sharedTotal=purchases.filter(x=>x.is_shared).reduce((s,x)=>s+Number(x.amount),0),personalTotal=purchases.filter(x=>!x.is_shared).reduce((s,x)=>s+Number(x.amount),0);
 const type=c.product_type, traditional=type!=="Kueski", cycle=traditional?cycleInfo(c):null;
 const statement=traditional?statementAmount(c,rows):null;
 let periodPurchases=purchases;
 if(cycle?.period)periodPurchases=purchases.filter(x=>x.transaction_date>=cycle.period.start&&x.transaction_date<=cycle.period.end);
 const periodTotal=periodPurchases.reduce((s,x)=>s+Number(x.amount),0);
 let nextPayment=cycle?.nextDue||null, nextPaymentAmount=traditional&&statement?statement.pending:null, nextPaymentNote="";
 if(traditional&&statement?.info) nextPaymentNote=`Estado de cuenta del ${statement.info.cutDate.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}.`;
 let kueskiUpcoming=[];
 if(type==="Kueski"){
   kueskiUpcoming=purchases.flatMap(x=>kueskiSchedule(x).map(item=>({x,...item}))).filter(z=>z.date&&z.date>=new Date()).sort((a,b)=>a.date-b.date);
   if(kueskiUpcoming.length){const d=kueskiUpcoming[0].date;const sameDay=kueskiUpcoming.filter(z=>z.date.getTime()===d.getTime());nextPayment=d.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"});nextPaymentAmount=sameDay.reduce((s,z)=>s+z.amount,0);nextPaymentNote=`Incluye ${sameDay.length} ${sameDay.length===1?"quincena programada":"quincenas programadas"} de compras pendientes.`}
   else nextPaymentNote="Sin compras pendientes con fecha de pago calculada.";
 }
 const color=p<30?"green":p<60?"yellow":p<80?"orange":"red";
 let msiUpcoming=[];
 if(type!=="Kueski"){msiUpcoming=purchases.filter(x=>Number(x.card_installments)>1).flatMap(x=>cardMsiSchedule(x,c).map(item=>({x,...item}))).filter(z=>z.date&&z.date>=new Date()).sort((a,b)=>a.date-b.date);}
 const recent=rows.slice(0,8).map(x=>{const isPayment=x.movement_role.includes("payment");const kInfo=x.movement_role==="kueski_purchase"?` · ${Number(x.kueski_installments)||1} ${Number(x.kueski_installments)===1?"quincena":"quincenas"} · ${money(Number(x.amount)/(Number(x.kueski_installments)||1))}/quincena`:Number(x.card_installments)>1?` · MSI ${Number(x.card_installments)} meses · ${money(Number(x.amount)/Number(x.card_installments))}/mes`:"";return `<div class="card-detail-row"><div><strong>${esc(x.concept_name||x.description||"Movimiento")}</strong><small>${esc(x.transaction_date)} · ${x.is_shared?"Compartido":"Personal"}${kInfo}</small></div><strong class="${isPayment?"income-amount":"expense-amount"}">${isPayment?"+":"-"}${money(x.amount)}</strong></div>`}).join("")||'<div class="empty">Sin movimientos registrados en esta tarjeta.</div>';
 const members=state.members.length>1?`<div class="detail-section"><div class="detail-section-title">👥 Participación compartida</div><div class="shared-box"><div><strong>${money(sharedTotal)}</strong><small>Total de compras compartidas</small></div><div class="member-list compact">${state.members.map(m=>`<div class="member"><span>${esc(m.profiles?.display_name||m.profiles?.email||"Integrante")}</span><small>Participación pendiente</small></div>`).join("")}</div><p class="muted tiny">La distribución individual se mostrará aquí cuando definamos cuánto corresponde a cada integrante.</p></div></div>`:"";
 const kueskiCalendar=type==="Kueski"?(()=>{
   const grouped=[];
   kueskiUpcoming.forEach(item=>{
     const key=item.date.toISOString().slice(0,10);
     let g=grouped.find(x=>x.key===key);
     if(!g){g={key,date:item.date,total:0,items:[]};grouped.push(g)}
     g.total+=item.amount;g.items.push(item);
   });
   return grouped.slice(0,12).map(g=>`<div class="kueski-calendar-row"><div><strong>${g.date.toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"})}</strong><small>${g.items.length} ${g.items.length===1?"quincena":"quincenas"}</small></div><strong>${money(g.total)}</strong><div class="kueski-calendar-items">${g.items.map(i=>`<span>${esc(i.x.concept_name||"Compra")} · ${i.index}/${i.total} · ${money(i.amount)}</span>`).join("")}</div></div>`).join("")||'<div class="empty">No hay pagos programados.</div>';
 })():"";
 const msiCalendar=type!=="Kueski"?(()=>{const grouped=[];msiUpcoming.forEach(item=>{const key=item.date.toISOString().slice(0,10);let g=grouped.find(x=>x.key===key);if(!g){g={key,date:item.date,total:0,items:[]};grouped.push(g)}g.total+=item.amount;g.items.push(item)});return grouped.slice(0,12).map(g=>`<div class="kueski-calendar-row"><div><strong>${g.date.toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"})}</strong><small>${g.items.length} ${g.items.length===1?"mensualidad":"mensualidades"}</small></div><strong>${money(g.total)}</strong><div class="kueski-calendar-items">${g.items.map(i=>`<span>${esc(i.x.concept_name||"Compra")} · ${i.index}/${i.total} · ${money(i.amount)}</span>`).join("")}</div></div>`).join("")||'<div class="empty">No hay MSI pendientes.</div>'})():"";
 const msiPurchases=traditional?purchases.filter(x=>Number(x.card_installments)>1):[];
 const normalPurchases=traditional?purchases.filter(x=>Number(x.card_installments)<=1):[];
 const normalOriginalTotal=normalPurchases.reduce((s,x)=>s+Number(x.amount||0),0);
 const msiOriginalTotal=msiPurchases.reduce((s,x)=>s+Number(x.amount||0),0);
 const msiScheduledRemaining=msiPurchases.reduce((sum,x)=>{const schedule=cardMsiSchedule(x,c);return sum+schedule.filter(i=>i.date>=new Date()).reduce((s,i)=>s+Number(i.amount||0),0)},0);
 const msiRemainingInstallments=msiPurchases.reduce((sum,x)=>sum+cardMsiSchedule(x,c).filter(i=>i.date>=new Date()).length,0);
 const msiCards=msiPurchases.map(x=>{const schedule=cardMsiSchedule(x,c),future=schedule.filter(i=>i.date>=new Date()),past=schedule.filter(i=>i.date<new Date()),next=future[0]||null,last=schedule[schedule.length-1];const remaining=future.length;const original=Number(x.amount)||0;const monthly=schedule[0]?.amount||0;return `<div class="msi-purchase-card"><div class="msi-purchase-head"><div><strong>${esc(x.concept_name||x.description||"Compra")}</strong><small>${esc(x.transaction_date)} · ${x.is_shared?"Compartido":"Personal"}</small></div><span class="msi-badge">${Number(x.card_installments)} MSI</span></div><div class="msi-purchase-grid"><div><small>Monto original</small><strong>${money(original)}</strong></div><div><small>Mensualidad</small><strong>${money(monthly)}</strong></div><div><small>Por pagar</small><strong>${remaining}</strong></div><div><small>Termina</small><strong>${last?last.date.toLocaleDateString("es-MX",{day:"numeric",month:"short",year:"numeric"}):"—"}</strong></div></div><div class="msi-progress"><div><span>Progreso programado</span><strong>${past.length}/${Number(x.card_installments)}</strong></div><div class="msi-progress-bar"><i style="width:${Math.min(100,past.length/Number(x.card_installments)*100)}%"></i></div></div><p class="muted tiny">${next?`Próxima mensualidad: ${next.date.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})} · ${money(next.amount)}`:"Sin mensualidades futuras programadas."}</p></div>`}).join("");
 const debtBreakdown=traditional?`<div class="detail-section debt-breakdown"><div class="detail-section-title">📊 Composición de la deuda</div><p class="muted tiny">La deuda actual incluye compras normales, MSI y pagos registrados. Las compras MSI se muestran además con su saldo programado de mensualidades.</p><div class="detail-grid"><div><small>Compras normales</small><strong>${money(normalOriginalTotal)}</strong><span class="detail-sub">Monto original</span></div><div><small>MSI originales</small><strong>${money(msiOriginalTotal)}</strong><span class="detail-sub">Monto financiado</span></div><div><small>MSI pendientes</small><strong>${money(msiScheduledRemaining)}</strong><span class="detail-sub">${msiRemainingInstallments} mensualidades</span></div><div><small>Deuda actual</small><strong>${money(used)}</strong><span class="detail-sub">Después de pagos</span></div></div></div>`:"";
 const msiSection=traditional&&msiPurchases.length?`<div class="detail-section"><div class="detail-section-title">💳 MSI de esta tarjeta</div><p class="muted tiny">Cada compra muestra su mensualidad, las mensualidades programadas por pagar y la fecha de término. Los pagos de tarjeta no se asignan automáticamente a una compra específica.</p><div class="msi-purchases">${msiCards}</div><div class="msi-calendar-title">Calendario próximo</div><div class="kueski-calendar">${msiCalendar}</div></div>`:"";
 const schedule=type==="Kueski"?`<div class="detail-section"><div class="detail-section-title">📅 Próximo pago</div><div class="next-payment"><strong>${nextPaymentAmount!==null?money(nextPaymentAmount):"—"}</strong><span>${nextPayment||"Sin fecha calculada"}</span></div><p class="muted tiny">${esc(nextPaymentNote)}</p></div><div class="detail-section"><div class="detail-section-title">🗓️ Calendario de pagos</div><p class="muted tiny">Aquí puedes ver las siguientes quincenas programadas y qué compras las componen.</p><div class="kueski-calendar">${kueskiCalendar}</div></div>`:`<div class="detail-section"><div class="detail-section-title">📅 Ciclo de la tarjeta</div><div class="detail-grid"><div><small>Fecha de corte</small><strong>${c.cut_day?`Día ${c.cut_day}`:"No configurada"}</strong></div><div><small>Fecha límite</small><strong>${c.due_day?`Día ${c.due_day}`:"No configurada"}</strong></div><div><small>Periodo actual</small><strong>${cycle?.label||"—"}</strong></div><div><small>Próximo pago</small><strong>${nextPaymentAmount!==null?money(nextPaymentAmount):"No configurado"}</strong><span class="detail-sub">${nextPayment||"Sin fecha configurada"}</span></div></div><p class="muted tiny">${esc(nextPaymentNote)}</p></div>`;
 const statementSection=traditional&&statement?.info?`<div class="detail-section statement-section"><div class="detail-section-title">📄 Estado de cuenta</div><div class="statement-head"><div><small>Periodo</small><strong>${statement.info.periodLabel}</strong></div><div><small>Fecha de corte</small><strong>${statement.info.cutDate.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}</strong></div><div><small>Fecha límite</small><strong>${statement.info.dueDate.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})}</strong></div></div><div class="statement-amount"><div><small>${statement.pending>0?"Pago del estado de cuenta":"Estado de cuenta"}</small><strong>${statement.pending>0?money(statement.pending):"✓ Pagado"}</strong></div>${statement.pending>0?`<button type="button" class="primary-btn" onclick="markCardPaid('${c.id}')">✓ Tarjeta pagada</button>`:`<span class="statement-paid-badge">✓ Tarjeta pagada</span>`}</div><div class="statement-breakdown"><span>Compras del estado de cuenta <strong>${money(statement.gross)}</strong></span><span>Pagos aplicados <strong>${money(statement.paid)}</strong></span><span>${statement.pending>0?"Pendiente":"Estado pagado"} <strong>${money(statement.pending)}</strong></span></div><p class="muted tiny">El pago se registra como una salida real de dinero y reduce el Disponible de la app. La tarjeta no vuelve a cero: las compras realizadas después del corte permanecen en el periodo actual.</p></div>`:"";
 showModal(`<div class="card-detail ${color}"><div class="detail-header"><div><span class="card-type">${esc(type)}</span><h3>${esc(c.name)}</h3></div><div class="detail-header-actions"><div class="detail-usage">${p.toFixed(0)}%<small>uso</small></div></div></div><div class="card-detail-actions"><button type="button" class="secondary-btn" onclick="editCard('${c.id}')">✎ Editar tarjeta</button><button type="button" class="danger-btn" onclick="deleteCard('${c.id}')">🗑 Eliminar tarjeta</button></div><div class="detail-summary"><div><small>Límite</small><strong>${money(limit)}</strong></div><div><small>Deuda actual</small><strong>${money(used)}</strong></div><div><small>Disponible</small><strong>${money(available)}</strong></div></div>${statementSection}${schedule}<div class="detail-section"><div class="detail-section-title">🧾 Resumen de compras</div><div class="detail-grid"><div><small>Total compras</small><strong>${money(purchaseTotal)}</strong></div><div><small>Pagos realizados</small><strong>${money(paymentTotal)}</strong></div><div><small>Personal</small><strong>${money(personalTotal)}</strong></div><div><small>Compartido</small><strong>${money(sharedTotal)}</strong></div>${traditional?`<div><small>Compras del periodo</small><strong>${money(periodTotal)}</strong></div><div><small>Compras normales</small><strong>${money(purchases.filter(x=>Number(x.card_installments)<=1).reduce((s,x)=>s+Number(x.amount),0))}</strong></div><div><small>Total original MSI</small><strong>${money(msiPurchases.reduce((s,x)=>s+Number(x.amount),0))}</strong></div>`:""}</div></div>${debtBreakdown}${msiSection}${members}<div class="detail-section"><div class="detail-section-title">🧾 Movimientos recientes</div><div class="card-detail-list">${recent}</div></div></div>`);
}
async function markCardPaid(id){
 const c=state.cards.find(x=>x.id===id); if(!c)return;
 const rows=state.movements.filter(x=>x.card_id===id).sort((a,b)=>String(a.transaction_date).localeCompare(String(b.transaction_date)));
 const st=statementAmount(c,rows);
 if(!st||!st.info)return notify("Configura el día de corte y el día de pago de la tarjeta antes de marcarla como pagada.");
 if(st.pending<=0)return notify("Esta tarjeta ya tiene pagado el último estado de cuenta.");
 const label=st.info.dueDate.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"});
 const amount=Number(st.pending.toFixed(2));
 if(!confirm(`¿Marcar ${c.name} como pagada?\n\nPago del estado de cuenta: ${money(amount)}\nFecha límite: ${label}\n\nEste pago se descontará del Disponible de la app y liberará crédito en la tarjeta. Las compras realizadas después del corte permanecerán en la deuda del periodo actual.`))return;
 const {error}=await db.from("movements").insert({user_id:state.user.id,workspace_id:state.workspace.id,type:"expense",concept_name:`Pago ${c.name}`,amount,transaction_date:todayISO(),payment_method:"debit",is_shared:false,notes:`Pago de estado de cuenta ${st.info.periodLabel}`,movement_role:"card_payment",card_id:id});
 if(error)return notify(error.message);
 await loadAll();
 showCard(id);
 notify(`Pago registrado: ${money(amount)}\n\nSe descontó del Disponible de la app y se liberó crédito por el mismo monto en ${c.name}.`);
}

function workspaceForm(){const mode=state.workspace?.type||"individual";showModal(`<div class="form"><h3>Espacio financiero</h3><p class="muted">Tus datos se comparten únicamente con integrantes de este espacio.</p><div class="choice-grid"><button type="button" class="choice ${mode==="individual"?"selected":""}" data-mode="individual"><strong>👤 Individual</strong><span>Solo tú.</span></button><button type="button" class="choice ${mode==="duo"?"selected":""}" data-mode="duo"><strong>👥 Duo</strong><span>Dos integrantes.</span></button><button type="button" class="choice ${mode==="family"?"selected":""}" data-mode="family"><strong>👨‍👩‍👧‍👦 Familiar</strong><span>Varios integrantes.</span></button></div><label>Nombre del espacio<input id="wName" value="${esc(state.workspace?.name||"")}"></label><div class="invite-box"><strong>Integrantes</strong><div class="member-list">${state.members.map(m=>`<div class="member"><span>${esc(m.profiles?.display_name||m.profiles?.email||"Integrante")}</span><small>${esc(m.role)}</small></div>`).join("")}</div></div><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button id="saveWorkspace" class="primary-btn">Guardar</button></div></div>`);let selected=mode;document.querySelectorAll(".choice").forEach(b=>b.onclick=()=>{selected=b.dataset.mode;document.querySelectorAll(".choice").forEach(x=>x.classList.toggle("selected",x.dataset.mode===selected))});$("#saveWorkspace").onclick=async()=>{const {error}=await db.from("workspaces").update({type:selected,name:$("#wName").value.trim()||null}).eq("id",state.workspace.id);if(error)return notify(error.message);closeModal();loadAll()}}
function inviteForm(){if(state.workspace?.type==="individual")return notify("Primero cambia tu espacio a Duo o Familiar.");showModal(`<form class="form" id="inviteForm"><h3>Invitar integrante</h3><p class="muted">La persona conservará su propia cuenta de Google.</p><label>Correo electrónico<input id="inviteEmail" type="email" required placeholder="persona@gmail.com"></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Crear invitación</button></div></form>`);$("#inviteForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("workspace_invitations").insert({workspace_id:state.workspace.id,invited_email:$("#inviteEmail").value.trim().toLowerCase(),invited_by:state.user.id});if(error)return notify(error.message);closeModal();notify("Invitación creada. La aceptación automática y el envío por correo serán el siguiente paso.")}}
$("#googleLogin").onclick=async()=>{const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});if(error)$("#loginMessage").textContent=error.message};
$("#logoutBtn").onclick=()=>db.auth.signOut();$("#modalClose").onclick=closeModal;$(".modal-backdrop").onclick=closeModal;
$("#workspaceBtn").onclick=workspaceForm;$("#workspaceSideBtn").onclick=workspaceForm;$("#inviteBtn").onclick=inviteForm;$("#addIncomeBtn").onclick=()=>movementForm(null,"income");$("#addExpenseBtn").onclick=()=>movementForm(null,"expense");$("#addCardBtn").onclick=cardForm;$("#addConceptBtn").onclick=conceptForm;$("#addGoalBtn").onclick=goalForm;
$("#prevMonth").onclick=()=>{state.month.setMonth(state.month.getMonth()-1);render()};$("#nextMonth").onclick=()=>{state.month.setMonth(state.month.getMonth()+1);render()};
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.section));document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.movementFilter=b.dataset.filter;renderMovements()});document.querySelectorAll(".text-btn").forEach(b=>b.onclick=()=>go(b.dataset.go));
function go(s){document.querySelectorAll(".page-section").forEach(x=>x.classList.add("hidden"));$("#section-"+s).classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.section===s));$("#pageTitle").textContent={inicio:"Inicio",movimientos:"Movimientos",tarjetas:"Tarjetas",ahorro:"Ahorro",conceptos:"Conceptos",resumen:"Resumen mensual"}[s]}
init();