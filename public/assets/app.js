import {api,esc,fmtDate,loadSession,showToast} from './common.js';
import {MODULE_CONFIG} from './module-config.js';
let session=null,currentPage=1,currentSearch='';
const moduleKey=document.body.dataset.module||'';
const config=MODULE_CONFIG[moduleKey];

const TYPE_LABEL={PEF:'Poste des Eaux et Forêts',CANTONNEMENT:'Cantonnement',DIRECTION_REGIONALE:'Direction Régionale',DIRECTION_DEPARTEMENTALE:'Direction Départementale'};
const CHILD_LABEL={CANTONNEMENT:'Mes PEF',DIRECTION_REGIONALE:'Mes Cantonnements',DIRECTION_DEPARTEMENTALE:'Mes Directions Régionales'};
function withScope(path){const q=new URLSearchParams(location.search).get('scopeOrg');return q?`${path}?scopeOrg=${encodeURIComponent(q)}`:path;}
function navHTML(user){
  const childLink=CHILD_LABEL[user.organizationType]?`<a href="${withScope('/structures-rattachees/')}">${CHILD_LABEL[user.organizationType]}</a>`:'';
  const userAdminLink=user.role==='ORGANIZATION_ADMIN'?'<a href="/utilisateurs/">Utilisateurs</a>':'';
  const A=p=>withScope(p);
  return `<div class="topbar"><div class="topbar-inner"><a class="logo" href="${A('/dashboard/')}" style="text-decoration:none"><span class="logo-badge">SI</span><span><strong>SIGAT</strong><div class="org-chip" id="orgName">${esc(user.organizationName||'Structure SIGAT')}</div></span></a><nav class="nav"><a href="${A('/dashboard/')}">Tableau de bord</a>${childLink}<div class="nav-group"><button>Administration ▾</button><div class="dropdown"><a href="${A('/personnel/')}">Personnel</a><a href="${A('/documents/')}">Documents</a><a href="${A('/absences/')}">Absences</a><a href="${A('/stages/')}">Stages</a><a href="${A('/convocations/')}">Convocations</a>${userAdminLink}</div></div><div class="nav-group"><button>Activités techniques ▾</button><div class="dropdown"><a href="${A('/missions/')}">Missions</a><a href="${A('/controles/')}">Contrôles</a><a href="${A('/infractions/')}">Infractions</a><a href="${A('/saisies/')}">Saisies</a><a href="${A('/exploitation-forestiere/')}">Exploitation forestière</a><a href="${A('/produits-secondaires/')}">Produits secondaires</a><a href="${A('/transformation-bois/')}">Transformation du bois</a><a href="${A('/sensibilisations/')}">Sensibilisations</a></div></div><div class="nav-group"><button>Environnement ▾</button><div class="dropdown"><a href="${A('/reboisement/')}">Reboisement</a><a href="${A('/ressources-naturelles/')}">Ressources naturelles</a><a href="${A('/feux-brousse/')}">Feux de brousse</a><a href="${A('/faune/')}">Faune</a></div></div><div class="nav-group"><button>Gestion ▾</button><div class="dropdown"><a href="${A('/formations/')}">Formations</a><a href="${A('/materiel/')}">Matériel</a><a href="${A('/finances/')}">Finances</a><a href="${A('/rapports/')}">Rapports</a><a href="${A('/archives/')}">Archives</a></div></div><a href="/parametres/">Paramètres</a></nav><div class="top-actions"><a class="btn btn-secondary btn-sm" href="/mon-compte/">Mon compte</a><button id="logoutBtn" class="btn btn-primary btn-sm">Déconnexion</button><div class="avatar" id="avatar">U</div></div></div></div>`}

async function boot(){
  try{session=await loadSession()}catch{return}
  if(session.user.role==='SUPER_ADMIN'){location.href='/superadmin/dashboard/';return}
  document.body.insertAdjacentHTML('afterbegin',navHTML(session.user));
  document.getElementById('logoutBtn').onclick=logout;
  document.getElementById('avatar').textContent=(session.user.displayName||'U').trim()[0]?.toUpperCase()||'U';
  if(session.user.role!=='ORGANIZATION_ADMIN') document.querySelectorAll('[data-admin-only]').forEach(el=>el.remove());
  if(session.user.forcePasswordChange && location.pathname!='/mon-compte/'){location.href='/mon-compte/';return}
  handleSubscription();
  if(moduleKey==='dashboard') loadDashboard(); else if(config) setupModule();
}

async function logout(){try{await api('/api/logout',{method:'POST'})}catch{}sessionStorage.clear();location.href='/'}

function handleSubscription(){
  const s=session.subscription;if(!s)return;
  if(s.expired && location.pathname!='/parametres/abonnement/'){location.href='/parametres/abonnement/';return}
  if(s.plan==='FREE'&&!s.expired){const now=Date.now(),last=Number(sessionStorage.getItem('sigat_last_free_popup')||0);if(!last||now-last>=15*60*1000)showFreePopup();setInterval(()=>{const l=Number(sessionStorage.getItem('sigat_last_free_popup')||0);if(Date.now()-l>=15*60*1000)showFreePopup()},60*1000)}
}
function showFreePopup(){const d=document.getElementById('freePlanDialog');if(!d||d.open)return;sessionStorage.setItem('sigat_last_free_popup',String(Date.now()));d.showModal()}

async function loadDashboard(){
  try{
    const scope=new URLSearchParams(location.search).get('scopeOrg');
    const d=await api(`/api/dashboard${scope?`?scopeOrg=${encodeURIComponent(scope)}`:''}`);
    const map=[['agents','Agents'],['missions','Missions'],['controls','Contrôles'],['offenses','Infractions'],['seizures','Saisies'],['awareness_actions','Sensibilisations'],['plantations','Reboisements'],['fire_incidents','Feux de brousse'],['training_sessions','Formations']];
    document.getElementById('metricCards').innerHTML=map.map(([k,l])=>`<div class="card metric"><div class="k">${l}</div><div class="v">${Number(d.summary[k]||0)}</div><div class="s">Périmètre hiérarchique autorisé</div></div>`).join('');
    const label=TYPE_LABEL[d.organization.type]||d.organization.type;
    const title=document.getElementById('dashboardTitle');if(title)title.textContent=`Tableau de bord — ${label}`;
    const parts=[];for(const [k,v] of Object.entries(d.hierarchyBreakdown||{})){if(v)parts.push(`${v} ${TYPE_LABEL[k]||k}`)}
    document.getElementById('orgScope').textContent=d.organization.type==='PEF'?`Données privées du ${d.organization.name}.`:`Vue consolidée de ${d.organization.name}${parts.length?` — structures subordonnées : ${parts.join(', ')}`:''}.`;
    const principle=document.getElementById('principleText');if(principle)principle.textContent='Chaque service saisit ses propres données. Les services supérieurs consultent automatiquement les données de toutes les structures qui leur sont officiellement rattachées, sans ressaisie.';
  }catch(e){showToast(e.message,'error')}
}

function setupModule(){document.getElementById('pageTitle').textContent=config.title;document.getElementById('pageSubtitle').textContent=config.subtitle;document.getElementById('addBtn').textContent=`Ajouter ${config.singular.toLowerCase()}`;document.getElementById('addBtn').onclick=()=>openEditor();document.getElementById('searchInput').addEventListener('input',e=>{clearTimeout(window.__s);window.__s=setTimeout(()=>{currentSearch=e.target.value;currentPage=1;loadRecords()},300)});document.getElementById('recordForm').addEventListener('submit',saveRecord);document.querySelectorAll('[data-close-editor]').forEach(b=>b.onclick=()=>document.getElementById('editorDialog').close());document.getElementById('prevBtn').onclick=()=>{if(currentPage>1){currentPage--;loadRecords()}};document.getElementById('nextBtn').onclick=()=>{currentPage++;loadRecords()};loadRecords()}

async function loadRecords(){try{const scope=new URLSearchParams(location.search).get('scopeOrg');const d=await api(`/api/load?module=${encodeURIComponent(moduleKey)}&page=${currentPage}&limit=25&search=${encodeURIComponent(currentSearch)}${scope?`&scopeOrg=${encodeURIComponent(scope)}`:''}`);if(currentPage>d.totalPages){currentPage=d.totalPages;return loadRecords()}renderRows(d.items);document.getElementById('pageInfo').textContent=`Page ${d.page} / ${d.totalPages} — ${d.total} enregistrement(s)`;document.getElementById('prevBtn').disabled=d.page<=1;document.getElementById('nextBtn').disabled=d.page>=d.totalPages}catch(e){showToast(e.message,'error')}}

function renderRows(items){const tb=document.getElementById('recordsBody');if(!items.length){tb.innerHTML='<tr><td colspan="7" class="muted">Aucune donnée enregistrée.</td></tr>';return}tb.innerHTML=items.map(r=>`<tr><td>${esc(r.reference||'—')}</td><td><strong>${esc(r.title)}</strong></td><td>${fmtDate(r.event_date)}</td><td><span class="pill">${esc(r.status)}</span></td><td><strong>${esc(r.source_organization)}</strong>${r.source_path&&r.source_path!==r.source_organization?`<br><span class="muted">${esc(r.source_path)}</span>`:''}</td><td>${fmtDate(r.updated_at)}</td><td><div class="actions">${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-danger btn-sm" data-archive="${r.id}">Archiver</button>`:'<span class="muted">Consultation</span>'}</div></td></tr>`).join('');items.forEach(r=>{if(!r.owned)return;tb.querySelector(`[data-edit="${r.id}"]`)?.addEventListener('click',()=>openEditor(r));tb.querySelector(`[data-archive="${r.id}"]`)?.addEventListener('click',()=>archiveRecord(r))})}

function openEditor(record=null){const d=document.getElementById('editorDialog');document.getElementById('editorTitle').textContent=record?`Modifier — ${config.singular}`:`Ajouter — ${config.singular}`;document.getElementById('recordId').value=record?.id||'';document.getElementById('recordReference').value=record?.reference||'';document.getElementById('recordTitle').value=record?.title||'';document.getElementById('recordDate').value=(record?.event_date||'').slice(0,10);document.getElementById('recordStatus').value=record?.status||'ACTIVE';const area=document.getElementById('dynamicFields');area.innerHTML='';for(const [key,label,type,opts] of config.fields){const wrap=document.createElement('div');wrap.className='field'+(type==='textarea'?' full':'');const lab=document.createElement('label');lab.textContent=label;wrap.appendChild(lab);let el;if(type==='textarea'){el=document.createElement('textarea');el.rows=3}else if(type==='select'){el=document.createElement('select');for(const o of String(opts||'').split('|')){const op=document.createElement('option');op.value=o;op.textContent=o;el.appendChild(op)}}else{el=document.createElement('input');el.type=type||'text'}el.dataset.key=key;el.value=record?.data?.[key]??'';wrap.appendChild(el);area.appendChild(wrap)}d.showModal()}

async function saveRecord(e){e.preventDefault();const id=document.getElementById('recordId').value;const data={};document.querySelectorAll('#dynamicFields [data-key]').forEach(el=>data[el.dataset.key]=el.value);const payload={id:id?Number(id):undefined,reference:document.getElementById('recordReference').value,title:document.getElementById('recordTitle').value,eventDate:document.getElementById('recordDate').value,status:document.getElementById('recordStatus').value,data};try{await api('/api/save',{method:'POST',body:{module:moduleKey,action:id?'update':'create',payload}});document.getElementById('editorDialog').close();showToast('Enregistrement effectué.');loadRecords()}catch(err){showToast(err.message,'error')}}
async function archiveRecord(r){if(!confirm(`Archiver « ${r.title} » ?`))return;try{await api('/api/save',{method:'POST',body:{module:moduleKey,action:'archive',payload:{id:r.id}}});showToast('Élément archivé.');loadRecords()}catch(e){showToast(e.message,'error')}}

document.addEventListener('DOMContentLoaded',boot);
