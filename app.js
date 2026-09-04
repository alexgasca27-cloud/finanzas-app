const SUPABASE_URL = "https://pghhvymhdfsfedppxquy.supabase.co";
const SUPABASE_KEY = "sb_publishable_jhL89bDrMEJKsuStNkp0kw_daup7Rna";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null,
  profile: null,
  movements: [],
  cards: [],
  concepts: [],
  goals: [],
  month: new Date(),
  movementFilter: "all"
};

const $ = (s) => document.querySelector(s);
const money = (n) => new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(Number(n||0));
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
const monthLabel = (d) => d.toLocaleDateString("es-MX",{month:"long",year:"numeric"});
const esc = (s) => String(s ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const within24h = (created) => Date.now() - new Date(created).getTime() < 86400000;

function showModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
function notify(msg){alert(msg)}

async function init(){
  const {data:{session}} = await db.auth.getSession();
  if(session) await setUser(session.user);
  else showLogin();
  db.auth.onAuthStateChange(async (_event, session)=>{ if(session) await setUser(session.user); else showLogin(); });
}
function showLogin(){$("#loginView").classList.remove("hidden");$("#dashboardView").classList.add("hidden")}
async function setUser(user){
  state.user=user;
  $("#loginView").classList.add("hidden"); $("#dashboardView").classList.remove("hidden");
  $("#userEmail").textContent=user.email||"";
  $("#userAvatar").textContent=(user.email||"U").charAt(0).toUpperCase();
  $("#welcomeTitle").textContent=`Hola, ${user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "usuario"} 👋`;
  await ensureProfile();
  await loadAll();
}
async function ensureProfile(){
  const {data} = await db.from("profiles").select("*").eq("id",state.user.id).maybeSingle();
  if(data){state.profile=data;return}
  const {data:newProfile,error}=await db.from("profiles").insert({id:state.user.id,email:state.user.email,display_name:state.user.user_metadata?.full_name||state.user.email?.split("@")[0]}).select().single();
  if(!error) state.profile=newProfile;
}
async function loadAll(){
  const [m,c,co,g] = await Promise.all([
    db.from("movements").select("*").order("created_at",{ascending:false}),
    db.from("cards").select("*").order("created_at",{ascending:false}),
    db.from("concepts").select("*").order("name"),
    db.from("savings_goals").select("*").order("created_at",{ascending:false})
  ]);
  state.movements=m.data||[]; state.cards=c.data||[]; state.concepts=co.data||[]; state.goals=g.data||[];
  render();
}
function render(){
  $("#currentMonthLabel").textContent=monthLabel(state.month);
  renderHome(); renderMovements(); renderCards(); renderGoals(); renderConcepts(); renderSummary();
}
function currentMovements(){
  const key=monthKey(state.month);
  return state.movements.filter(x=>String(x.transaction_date).slice(0,7)===key.slice(0,7));
}
function renderHome(){
  const rows=currentMovements();
  const income=rows.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0);
  const expenses=rows.filter(x=>x.type==="expense" && x.payment_method!=="credit").reduce((s,x)=>s+Number(x.amount),0);
  const available=income-expenses;
  $("#incomeTotal").textContent=money(income); $("#expenseTotal").textContent=money(expenses); $("#availableTotal").textContent=money(available);
  const pct=income?expenses/income:0;
  const score=income?Math.max(0,Math.min(100,Math.round((1-pct)*100))):null;
  $("#monthScore").textContent=score===null?"—":`${score}/100`;
  $("#monthScoreText").textContent=score===null?"Aún no hay ingresos registrados":score>=75?"Buen mes":score>=50?"Mes regular":"Mes complicado";
  const recent=state.movements.slice(0,5);
  $("#recentList").innerHTML=recent.length?recent.map(movementHTML).join(""):'<div class="empty">Todavía no hay movimientos.</div>';
  $("#alertsList").innerHTML=buildAlerts();
}
function buildAlerts(){
  const alerts=[];
  state.cards.forEach(c=>{
    if(Number(c.credit_limit)>0){
      const used=Number(c.credit_used||0)/Number(c.credit_limit);
      if(used>=.8) alerts.push(`⚠️ ${esc(c.name)}: crédito utilizado al ${(used*100).toFixed(0)}%.`);
    }
  });
  const rows=currentMovements();
  if(rows.some(x=>x.type==="expense" && x.payment_method==="credit")) alerts.push("💳 Hay compras con crédito que todavía no representan una salida de dinero.");
  return alerts.length?alerts.map(x=>`<div class="movement-item">${x}</div>`).join(""):'<div class="empty">No hay alertas por ahora.</div>';
}
function movementHTML(x){
  const editable=within24h(x.created_at);
  const concept=x.concept_name||x.description||"Movimiento";
  return `<div class="movement-item">
    <div class="movement-left"><div class="movement-icon">${x.type==="income"?"↗":"↘"}</div><div><div class="movement-name">${esc(concept)}</div><div class="movement-meta">${esc(x.transaction_date)} · ${esc(x.payment_method||"")}${x.is_shared?" · Compartido":""}</div></div></div>
    <div class="actions"><strong class="${x.type==="income"?"income-amount":"expense-amount"}">${x.type==="income"?"+":"-"}${money(x.amount)}</strong>
    ${editable?`<button class="icon-btn" onclick="editMovement('${x.id}')">✎</button><button class="icon-btn" onclick="deleteMovement('${x.id}')">×</button>`:"<span title='Bloqueado después de 24 horas'>🔒</span>"}</div>
  </div>`;
}
function renderMovements(){
  let rows=currentMovements();
  if(state.movementFilter!=="all") rows=rows.filter(x=>state.movementFilter==="income"?x.type==="income":x.type==="expense");
  $("#movementsList").innerHTML=rows.length?rows.map(movementHTML).join(""):'<div class="empty">No hay movimientos para este mes.</div>';
}
function renderCards(){
  $("#cardsGrid").innerHTML=state.cards.length?state.cards.map(c=>{
    const limit=Number(c.credit_limit||0), used=Number(c.credit_used||0), pct=limit?Math.min(100,used/limit*100):0;
    const level=pct>=90?"critical":pct>=75?"high":pct>=50?"medium":"low";
    return `<article class="credit-card ${level}" onclick="showCard('${c.id}')"><span class="card-type">${esc(c.product_type)}</span><h3>${esc(c.name)}</h3><div class="balance">${money(used)}</div><div class="bar"><i style="width:${pct}%"></i></div><div class="card-foot"><span>Usado ${pct.toFixed(0)}%</span><span>${money(Math.max(0,limit-used))} disponible</span></div></article>`;
  }).join(""):'<div class="empty panel">Todavía no tienes tarjetas o créditos registrados.</div>';
}
function renderGoals(){
  $("#goalsGrid").innerHTML=state.goals.length?state.goals.map(g=>{const p=Number(g.target_amount)?Math.min(100,Number(g.current_amount||0)/Number(g.target_amount)*100):0;return `<article class="goal"><h3>${esc(g.name)}</h3><div class="muted">${esc(g.target_date||"Sin fecha objetivo")}</div><div class="amount">${money(g.current_amount)} / ${money(g.target_amount)}</div><div class="bar"><i style="width:${p}%"></i></div><small>${p.toFixed(0)}% completado</small></article>`}).join(""):'<div class="empty panel">Crea tu primera meta de ahorro.</div>';
}
function renderConcepts(){
  const inc=state.concepts.filter(x=>x.type==="income"), exp=state.concepts.filter(x=>x.type==="expense");
  $("#incomeConcepts").innerHTML=inc.length?inc.map(conceptHTML).join(""):'<div class="empty">Sin conceptos.</div>';
  $("#expenseConcepts").innerHTML=exp.length?exp.map(conceptHTML).join(""):'<div class="empty">Sin conceptos.</div>';
}
function conceptHTML(x){return `<div class="concept"><span>${esc(x.name)}</span><button class="icon-btn" onclick="deleteConcept('${x.id}')">×</button></div>`}
function renderSummary(){
  const rows=currentMovements();
  const income=rows.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0);
  const expense=rows.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount),0);
  const realExpense=rows.filter(x=>x.type==="expense" && x.payment_method!=="credit").reduce((s,x)=>s+Number(x.amount),0);
  const score=income?Math.max(0,Math.min(100,Math.round((1-realExpense/income)*100))):0;
  const verdict=score>=75?"🟢 Buen mes":score>=50?"🟡 Mes regular":"🔴 Mes complicado";
  $("#summaryPanel").innerHTML=`<div class="summary-hero"><div class="summary-score"><div class="muted">Calificación</div><div class="big">${income?score:"—"}</div><h3>${income?verdict:"Sin datos suficientes"}</h3><p class="muted">${income?`Ingresaste ${money(income)} y tu salida real de dinero fue ${money(realExpense)}.`:"Registra ingresos y gastos para generar tu resumen."}</p></div><div class="summary-numbers"><div class="summary-line"><span>Ingresos</span><strong>${money(income)}</strong></div><div class="summary-line"><span>Gastos registrados</span><strong>${money(expense)}</strong></div><div class="summary-line"><span>Salidas reales</span><strong>${money(realExpense)}</strong></div><div class="summary-line"><span>Balance del mes</span><strong>${money(income-realExpense)}</strong></div></div></div>`;
}

function movementForm(existing=null){
  const isEdit=!!existing;
  const concepts=state.concepts.filter(x=>x.type===(existing?.type||"expense"));
  showModal(`<form class="form" id="movementForm"><h3>${isEdit?"Modificar":"Nuevo"} movimiento</h3>
    <label>Tipo<select id="mType"><option value="expense" ${existing?.type==="expense"?"selected":""}>Gasto</option><option value="income" ${existing?.type==="income"?"selected":""}>Ingreso</option></select></label>
    <label>Concepto<select id="mConcept"><option value="">Seleccionar...</option>${concepts.map(c=>`<option value="${esc(c.name)}" ${existing?.concept_name===c.name?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
    <label>Monto<input id="mAmount" type="number" min="0.01" step="0.01" required value="${existing?.amount||""}"></label>
    <label>Fecha<input id="mDate" type="date" required value="${existing?.transaction_date||new Date().toISOString().slice(0,10)}"></label>
    <label>Método de pago<select id="mPayment"><option value="debit">Débito</option><option value="cash">Efectivo</option><option value="credit">Tarjeta de crédito</option><option value="department_store">Departamental</option><option value="kueski">Kueski</option></select></label>
    <label>Clasificación<select id="mShared"><option value="false">Personal</option><option value="true" ${existing?.is_shared?"selected":""}>Compartido</option></select></label>
    <div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar</button></div>
  </form>`);
  $("#mType").onchange=()=>movementForm(existing);
  if(existing) $("#mPayment").value=existing.payment_method||"debit";
  $("#movementForm").onsubmit=async e=>{e.preventDefault();const payload={type:$("#mType").value,concept_name:$("#mConcept").value||null,amount:Number($("#mAmount").value),transaction_date:$("#mDate").value,payment_method:$("#mPayment").value,is_shared:$("#mShared").value==="true"};let q=existing?db.from("movements").update(payload).eq("id",existing.id):db.from("movements").insert({...payload,user_id:state.user.id});const {error}=await q;if(error) return notify(error.message);closeModal();await loadAll();};
}
async function editMovement(id){const m=state.movements.find(x=>x.id===id);if(!m)return;if(!within24h(m.created_at))return notify("Este movimiento ya está bloqueado porque pasaron 24 horas.");movementForm(m)}
async function deleteMovement(id){const m=state.movements.find(x=>x.id===id);if(!m)return;if(!within24h(m.created_at))return notify("Este movimiento ya está bloqueado porque pasaron 24 horas.");if(!confirm("¿Eliminar este movimiento?"))return;const {error}=await db.from("movements").delete().eq("id",id);if(error)return notify(error.message);await loadAll()}
function cardForm(){
  showModal(`<form class="form" id="cardForm"><h3>Nueva tarjeta o crédito</h3>
    <label>Nombre<input id="cName" required placeholder="Ej. BBVA Oro"></label>
    <label>Producto<select id="cType"><option>Tarjeta de crédito</option><option>Tarjeta departamental</option><option>Kueski</option></select></label>
    <label>Límite de crédito<input id="cLimit" type="number" min="0" step="0.01" required></label>
    <label>Fecha de corte (si aplica)<input id="cCut" type="number" min="1" max="31" placeholder="Ej. 15"></label>
    <label>Fecha de pago (si aplica)<input id="cDue" type="number" min="1" max="31" placeholder="Ej. 5"></label>
    <div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar</button></div>
  </form>`);
  $("#cardForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("cards").insert({user_id:state.user.id,name:$("#cName").value,product_type:$("#cType").value,credit_limit:Number($("#cLimit").value),cut_day:Number($("#cCut").value)||null,due_day:Number($("#cDue").value)||null});if(error)return notify(error.message);closeModal();await loadAll()}
}
function conceptForm(){
  showModal(`<form class="form" id="conceptForm"><h3>Nuevo concepto</h3><label>Tipo<select id="coType"><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label><label>Nombre<input id="coName" required placeholder="Ej. Costco"></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar</button></div></form>`);
  $("#conceptForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("concepts").insert({user_id:state.user.id,type:$("#coType").value,name:$("#coName").value.trim()});if(error)return notify(error.message);closeModal();await loadAll()}
}
async function deleteConcept(id){if(!confirm("¿Eliminar este concepto?"))return;const {error}=await db.from("concepts").delete().eq("id",id);if(error)return notify(error.message);await loadAll()}
function goalForm(){
  showModal(`<form class="form" id="goalForm"><h3>Nueva meta de ahorro</h3><label>Nombre<input id="gName" required placeholder="Ej. Fondo de emergencia"></label><label>Meta<input id="gTarget" type="number" min="1" required></label><label>Fecha objetivo<input id="gDate" type="date"></label><div class="form-actions"><button type="button" class="danger-btn" onclick="closeModal()">Cancelar</button><button class="primary-btn">Guardar</button></div></form>`);
  $("#goalForm").onsubmit=async e=>{e.preventDefault();const {error}=await db.from("savings_goals").insert({user_id:state.user.id,name:$("#gName").value,target_amount:Number($("#gTarget").value),target_date:$("#gDate").value||null});if(error)return notify(error.message);closeModal();await loadAll()}
}
function showCard(id){const c=state.cards.find(x=>x.id===id);if(!c)return;const pct=Number(c.credit_limit)?Number(c.credit_used||0)/Number(c.credit_limit)*100:0;showModal(`<div class="form"><h3>${esc(c.name)}</h3><p class="muted">${esc(c.product_type)}</p><div class="summary-numbers"><div class="summary-line"><span>Límite</span><strong>${money(c.credit_limit)}</strong></div><div class="summary-line"><span>Crédito utilizado</span><strong>${money(c.credit_used)}</strong></div><div class="summary-line"><span>Disponible</span><strong>${money(Math.max(0,Number(c.credit_limit)-Number(c.credit_used||0)))}</strong></div><div class="summary-line"><span>Uso</span><strong>${pct.toFixed(1)}%</strong></div>${c.cut_day?`<div class="summary-line"><span>Corte</span><strong>Día ${c.cut_day}</strong></div>`:""}${c.due_day?`<div class="summary-line"><span>Pago</span><strong>Día ${c.due_day}</strong></div>`:""}</div></div>`)}
$("#googleLogin").onclick=async()=>{const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});if(error)$("#loginMessage").textContent=error.message};
$("#logoutBtn").onclick=()=>db.auth.signOut();
$("#modalClose").onclick=closeModal; $(".modal-backdrop").onclick=closeModal;
$("#addMovementBtn").onclick=()=>movementForm(); $("#addCardBtn").onclick=cardForm; $("#addConceptBtn").onclick=conceptForm; $("#addGoalBtn").onclick=goalForm;
$("#prevMonth").onclick=()=>{state.month.setMonth(state.month.getMonth()-1);render()};
$("#nextMonth").onclick=()=>{state.month.setMonth(state.month.getMonth()+1);render()};
document.querySelectorAll(".nav-item").forEach(btn=>btn.onclick=()=>go(btn.dataset.section));
document.querySelectorAll(".filter").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));btn.classList.add("active");state.movementFilter=btn.dataset.filter;renderMovements()});
document.querySelectorAll(".text-btn").forEach(btn=>btn.onclick=()=>go(btn.dataset.go));
function go(section){document.querySelectorAll(".page-section").forEach(x=>x.classList.add("hidden"));$(`#section-${section}`).classList.remove("hidden");document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.section===section));$("#pageTitle").textContent={inicio:"Inicio",movimientos:"Movimientos",tarjetas:"Tarjetas",ahorro:"Ahorro",conceptos:"Conceptos",resumen:"Resumen mensual"}[section]}
init();