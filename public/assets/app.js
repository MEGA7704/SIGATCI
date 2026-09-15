import {api,esc,fmtDate,loadSession,showToast,withButtonLock,professionalAlert,professionalConfirm,professionalDialog} from './common.js';
import {MODULE_CONFIG} from './module-config.js';
let session=null,currentPage=1,currentSearch='',lastItems=[];
const moduleKey=document.body.dataset.module||'';
const config=MODULE_CONFIG[moduleKey];

const TYPE_LABEL={PEF:'Poste des Eaux et Forêts',CANTONNEMENT:'Cantonnement',DIRECTION_REGIONALE:'Direction Régionale',DIRECTION_DEPARTEMENTALE:'Direction Départementale'};
const CHILD_LABEL={CANTONNEMENT:'Mes PEF',DIRECTION_REGIONALE:'Mes Cantonnements',DIRECTION_DEPARTEMENTALE:'Mes Directions Régionales'};
function withScope(path){const q=new URLSearchParams(location.search).get('scopeOrg');return q?`${path}?scopeOrg=${encodeURIComponent(q)}`:path;}
function navHTML(user){
  const childLink=CHILD_LABEL[user.organizationType]?`<a href="${withScope('/structures-rattachees/')}">${CHILD_LABEL[user.organizationType]}</a>`:'';
  const userAdminLink=user.role==='ORGANIZATION_ADMIN'?'<a href="/utilisateurs/">Utilisateurs</a>':'';
  const A=p=>withScope(p);
  return `<div class="topbar"><div class="topbar-inner"><a class="logo" href="${A('/dashboard/')}" style="text-decoration:none"><span class="logo-badge">SI</span><span><strong>SIGAT</strong><div class="org-chip" id="orgName">${esc(user.organizationName||'Structure SIGAT')}</div></span></a><nav class="nav"><a href="${A('/dashboard/')}">Tableau de bord</a>${childLink}<div class="nav-group"><button>Administration ▾</button><div class="dropdown"><a href="${A('/personnel/')}">Personnel</a><a href="${A('/documents/')}">Documents</a><a href="${A('/absences/')}">Autorisations d’absence</a><a href="${A('/stages/')}">Stages</a><a href="${A('/convocations/')}">Convocations</a>${userAdminLink}</div></div><div class="nav-group"><button>Activités techniques ▾</button><div class="dropdown"><a href="${A('/missions/')}">Missions</a><a href="${A('/controles/')}">Contrôles</a><a href="${A('/infractions/')}">Infractions</a><a href="${A('/saisies/')}">Saisies</a><a href="${A('/exploitation-forestiere/')}">Exploitation forestière</a><a href="${A('/produits-secondaires/')}">Produits secondaires</a><a href="${A('/transformation-bois/')}">Transformation du bois</a><a href="${A('/sensibilisations/')}">Sensibilisations</a></div></div><div class="nav-group"><button>Environnement ▾</button><div class="dropdown"><a href="${A('/reboisement/')}">Reboisement</a><a href="${A('/ressources-naturelles/')}">Ressources naturelles</a><a href="${A('/feux-brousse/')}">Feux de brousse</a><a href="${A('/faune/')}">Faune</a></div></div><div class="nav-group"><button>Gestion ▾</button><div class="dropdown"><a href="${A('/formations/')}">Formations</a><a href="${A('/materiel/')}">Matériel</a><a href="${A('/finances/')}">Finances</a><a href="${A('/rapports/')}">Rapports</a><a href="${A('/archives/')}">Archives</a></div></div><a href="/parametres/">Paramètres</a></nav><div class="top-actions"><a class="btn btn-secondary btn-sm" href="/mon-compte/">Mon compte</a><button id="logoutBtn" class="btn btn-primary btn-sm">Déconnexion</button><div class="avatar" id="avatar">U</div></div></div></div>`}

async function boot(){
  try{session=await loadSession()}catch{return}
  if(session.user.role==='SUPER_ADMIN'){location.href='/superadmin/dashboard/';return}
  document.body.insertAdjacentHTML('afterbegin',navHTML(session.user));
  document.getElementById('logoutBtn').onclick=e=>withButtonLock(e.currentTarget,logout,'Déconnexion…');
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

function setupModule(){
  document.getElementById('pageTitle').textContent=config.title;
  document.getElementById('pageSubtitle').textContent=config.subtitle;
  const addBtn=document.getElementById('addBtn');
  addBtn.textContent=`Ajouter ${config.singular.toLowerCase()}`;
  addBtn.onclick=()=>openEditor();
  const printBtn=document.createElement('button');
  printBtn.className='btn btn-secondary';printBtn.type='button';printBtn.innerHTML='Imprimer la liste / PDF';
  printBtn.onclick=()=>printCurrentList();
  addBtn.parentElement.insertBefore(printBtn,addBtn);
  document.getElementById('searchInput').addEventListener('input',e=>{clearTimeout(window.__s);window.__s=setTimeout(()=>{currentSearch=e.target.value;currentPage=1;loadRecords()},300)});
  document.getElementById('recordForm').addEventListener('submit',saveRecord);
  document.querySelectorAll('[data-close-editor]').forEach(b=>b.onclick=()=>document.getElementById('editorDialog').close());
  document.getElementById('prevBtn').onclick=()=>{if(currentPage>1){currentPage--;loadRecords()}};
  document.getElementById('nextBtn').onclick=()=>{currentPage++;loadRecords()};
  loadRecords();
}

async function loadRecords(){
  try{
    const scope=new URLSearchParams(location.search).get('scopeOrg');
    const d=await api(`/api/load?module=${encodeURIComponent(moduleKey)}&page=${currentPage}&limit=25&search=${encodeURIComponent(currentSearch)}${scope?`&scopeOrg=${encodeURIComponent(scope)}`:''}`);
    if(currentPage>d.totalPages){currentPage=d.totalPages;return loadRecords()}
    lastItems=d.items||[];renderRows(lastItems);
    document.getElementById('pageInfo').textContent=`Page ${d.page} / ${d.totalPages} — ${d.total} enregistrement(s)`;
    document.getElementById('prevBtn').disabled=d.page<=1;document.getElementById('nextBtn').disabled=d.page>=d.totalPages;
  }catch(e){showToast(e.message,'error')}
}

function renderRows(items){
  const tb=document.getElementById('recordsBody');
  if(!items.length){tb.innerHTML='<tr><td colspan="7" class="muted">Aucune donnée enregistrée.</td></tr>';return}
  tb.innerHTML=items.map(r=>`<tr><td>${esc(r.reference||'—')}</td><td><strong>${esc(r.title)}</strong></td><td>${fmtDate(r.event_date)}</td><td><span class="pill">${esc(r.status)}</span></td><td><strong>${esc(r.source_organization)}</strong>${r.source_path&&r.source_path!==r.source_organization?`<br><span class="muted">${esc(r.source_path)}</span>`:''}</td><td>${fmtDate(r.updated_at)}</td><td><div class="actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-danger btn-sm" data-archive="${r.id}">Archiver</button>`:'<span class="muted">Consultation</span>'}</div></td></tr>`).join('');
  items.forEach(r=>{
    tb.querySelector(`[data-view="${r.id}"]`)?.addEventListener('click',()=>openDetails(r));
    tb.querySelector(`[data-print="${r.id}"]`)?.addEventListener('click',()=>printRecord(r));
    if(!r.owned)return;
    tb.querySelector(`[data-edit="${r.id}"]`)?.addEventListener('click',()=>openEditor(r));
    tb.querySelector(`[data-archive="${r.id}"]`)?.addEventListener('click',e=>archiveRecord(r,e.currentTarget));
  });
}

function fieldLabel(key){const f=config.fields.find(x=>x[0]===key);return f?.[1]||key.replaceAll('_',' ');}
function displayValue(value){if(value===null||value===undefined||value==='')return '—';return String(value);}

function openDetails(record){
  const photo=moduleKey==='personnel'&&record.data?.photo?`<div class="agent-photo-view"><img src="${esc(record.data.photo)}" alt="Photo agent"></div>`:'';
  const rows=[
    ['Référence',record.reference],['Nom / Intitulé',record.title],['Date',fmtDate(record.event_date)],['Statut',record.status],['Service source',record.source_organization],
    ...config.fields.filter(([k])=>k!=='photo').map(([k,l])=>[l,record.data?.[k]])
  ];
  const html=`<div class="detail-layout">${photo}<div class="detail-grid">${rows.map(([l,v])=>`<div class="detail-item"><span>${esc(l)}</span><strong>${esc(displayValue(v))}</strong></div>`).join('')}</div></div>`;
  professionalDialog({title:`${config.singular} — Informations`,html,confirmText:'Fermer'});
}

async function compressImage(file){
  if(!file)return '';
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error('Format photo non accepté. Utilisez JPG, PNG ou WEBP.');
  if(file.size>6*1024*1024) throw new Error('La photo ne doit pas dépasser 6 Mo.');
  const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=dataUrl});
  const maxW=520,maxH=620,ratio=Math.min(1,maxW/img.width,maxH/img.height);
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));
  c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.78);
}

function inclusiveDays(start,end){
  if(!start||!end)return '';
  const a=new Date(`${start}T00:00:00Z`),b=new Date(`${end}T00:00:00Z`);
  if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||b<a)return '';
  return Math.floor((b-a)/86400000)+1;
}
function frenchNumber(n){
  n=Number(n);const u=['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize'];
  if(n>=0&&n<=16)return u[n];
  if(n<20)return 'dix-'+u[n-10];
  const t={20:'vingt',30:'trente',40:'quarante',50:'cinquante',60:'soixante'};
  if(n<70){const d=Math.floor(n/10)*10,r=n%10;return t[d]+(r===0?'':r===1?' et un':'-'+u[r]);}
  if(n<80){const r=n-60;return 'soixante-'+(r<=16?u[r]:'dix-'+u[r-10]);}
  if(n<100){const r=n-80;return 'quatre-vingt'+(r===0?'s':'-'+(r<=16?u[r]:'dix-'+u[r-10]));}
  return String(n);
}
function longFrDate(v){
  if(!v)return '—';
  const d=new Date(`${String(v).slice(0,10)}T00:00:00Z`);if(Number.isNaN(d.getTime()))return fmtDate(v);
  return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'long',year:'numeric',timeZone:'UTC'}).format(d).replace(/^./,c=>c.toUpperCase());
}
function absenceSignerTitle(){
  const t=session?.user?.organizationType;
  if(t==='PEF')return 'Le Chef de poste';
  if(t==='CANTONNEMENT')return 'Le Chef de Cantonnement';
  if(t==='DIRECTION_REGIONALE')return 'Le Directeur Régional';
  if(t==='DIRECTION_DEPARTEMENTALE')return 'Le Directeur Départemental';
  return 'Le Responsable du service';
}
function updateAbsenceDays(){
  if(moduleKey!=='absences')return;
  const a=document.querySelector('#dynamicFields [data-key="date_debut"]');
  const b=document.querySelector('#dynamicFields [data-key="date_fin"]');
  const n=document.querySelector('#dynamicFields [data-key="nombre_jours"]');
  if(n)n.value=inclusiveDays(a?.value,b?.value);
}

function openEditor(record=null){
  const d=document.getElementById('editorDialog');d.classList.add('editor-dialog');
  const isPersonnel=moduleKey==='personnel';
  const isAbsence=moduleKey==='absences';
  d.classList.toggle('personnel-editor',isPersonnel);
  d.classList.toggle('absence-editor',isAbsence);
  document.getElementById('editorTitle').textContent=record?`Modifier — ${config.singular}`:`Ajouter — ${config.singular}`;
  document.getElementById('recordId').value=record?.id||'';
  const refInput=document.getElementById('recordReference');
  const titleInput=document.getElementById('recordTitle');
  const dateInput=document.getElementById('recordDate');
  const statusInput=document.getElementById('recordStatus');
  refInput.value=record?.reference||'';
  titleInput.value=record?.title||'';
  dateInput.value=(record?.event_date||'').slice(0,10);
  statusInput.value=record?.status||'ACTIVE';
  const refField=refInput.closest('.field'),dateField=dateInput.closest('.field'),titleField=titleInput.closest('.field'),statusField=statusInput.closest('.field');
  if(isPersonnel){
    refField.querySelector('label').textContent='Référence';
    dateField.querySelector('label').textContent='Date de prise de service';
    titleField.querySelector('label').textContent='Nom et Prénoms *';
    titleField.classList.remove('full');
    statusField.classList.add('personnel-status-hidden');
  }else if(isAbsence){
    refField.querySelector('label').textContent='Référence / N°';
    dateField.querySelector('label').textContent='Date d’établissement';
    titleField.querySelector('label').textContent='Nom et Prénoms de l’agent *';
    titleField.classList.remove('full');
    statusField.classList.remove('personnel-status-hidden');
    statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="AUTORISÉ">AUTORISÉ</option><option value="ANNULÉ">ANNULÉ</option>';
    statusInput.value=record?.status||'AUTORISÉ';
  }else{
    dateField.querySelector('label').textContent='Date';
    titleField.querySelector('label').textContent='Intitulé / nom principal *';
    titleField.classList.add('full');
    statusField.classList.remove('personnel-status-hidden');
  }
  const area=document.getElementById('dynamicFields');area.innerHTML='';
  for(const [key,label,type,opts] of config.fields){
    const wrap=document.createElement('div');wrap.className='field'+(type==='textarea'?' full':'')+(type==='image'?' photo-field':'');
    const lab=document.createElement('label');lab.textContent=label;wrap.appendChild(lab);
    if(type==='image'){
      const hidden=document.createElement('input');hidden.type='hidden';hidden.dataset.key=key;hidden.value=record?.data?.[key]||'';
      const input=document.createElement('input');input.type='file';input.accept='image/jpeg,image/png,image/webp';
      const preview=document.createElement('div');preview.className='photo-preview';
      const render=()=>{preview.innerHTML=hidden.value?`<img src="${esc(hidden.value)}" alt="Photo de l’agent"><button type="button" class="btn btn-danger btn-sm" data-remove-photo>Retirer</button>`:'<span class="muted">Aucune photo sélectionnée</span>';preview.querySelector('[data-remove-photo]')?.addEventListener('click',()=>{hidden.value='';input.value='';render()})};
      input.addEventListener('change',async()=>{try{if(input.files?.[0])hidden.value=await compressImage(input.files[0]);render()}catch(err){input.value='';professionalAlert('Photo non importée',err.message)}});
      wrap.append(hidden,input,preview);render();area.appendChild(wrap);continue;
    }
    let el;
    if(type==='textarea'){el=document.createElement('textarea');el.rows=2}
    else if(type==='select'){el=document.createElement('select');for(const o of String(opts||'').split('|')){const op=document.createElement('option');op.value=o;op.textContent=o;el.appendChild(op)}}
    else{el=document.createElement('input');el.type=type==='computed'?'number':(type||'text');if(type==='computed'){el.readOnly=true;el.classList.add('computed-field')}}
    el.dataset.key=key;el.value=record?.data?.[key]??'';wrap.appendChild(el);area.appendChild(wrap);
  }
  if(isAbsence){
    const start=document.querySelector('#dynamicFields [data-key="date_debut"]');
    const end=document.querySelector('#dynamicFields [data-key="date_fin"]');
    start?.addEventListener('change',updateAbsenceDays);end?.addEventListener('change',updateAbsenceDays);updateAbsenceDays();
  }
  d.showModal();
}

async function saveRecord(e){
  e.preventDefault();
  if(moduleKey==='absences')updateAbsenceDays();
  const submit=e.submitter||document.querySelector('#recordForm button[type="submit"]');
  return withButtonLock(submit,async()=>{
    const id=document.getElementById('recordId').value;const data={};
    document.querySelectorAll('#dynamicFields [data-key]').forEach(el=>data[el.dataset.key]=el.value);
    const payload={id:id?Number(id):undefined,reference:document.getElementById('recordReference').value,title:document.getElementById('recordTitle').value,eventDate:document.getElementById('recordDate').value,status:document.getElementById('recordStatus').value,data};
    try{await api('/api/save',{method:'POST',body:{module:moduleKey,action:id?'update':'create',payload}});document.getElementById('editorDialog').close();await professionalAlert('Enregistrement réussi',`${config.singular} enregistré(e) avec succès.`);loadRecords()}catch(err){await professionalAlert('Enregistrement impossible',err.message);}
  },'Enregistrement…');
}

async function archiveRecord(r,button){
  const yes=await professionalConfirm('Confirmer l’archivage',`Voulez-vous archiver « ${r.title} » ? L’historique sera conservé.`,{confirmText:'Archiver'});
  if(!yes)return;
  return withButtonLock(button,async()=>{try{await api('/api/save',{method:'POST',body:{module:moduleKey,action:'archive',payload:{id:r.id}}});await professionalAlert('Archivage effectué','L’élément a été archivé avec succès.');loadRecords()}catch(e){await professionalAlert('Archivage impossible',e.message)}},'Archivage…');
}

function printBaseStyles(){return `@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#18231e;margin:0;font-size:12px}.header{display:grid;grid-template-columns:1fr auto 1fr;align-items:start;border-bottom:3px solid #0b4d3b;padding-bottom:12px;margin-bottom:18px}.header .left{font-weight:700;line-height:1.55}.header .center{text-align:center}.sigat{font-size:24px;font-weight:900;color:#0b4d3b;letter-spacing:1px}.header .right{text-align:right;font-weight:700;line-height:1.55}.motto{font-style:italic;font-size:11px}.title{border:1.5px solid #0b4d3b;background:#f3f7f5;color:#0b4d3b;text-align:center;padding:10px;font-size:19px;font-weight:900;margin:16px 0}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:8px 18px;margin-bottom:16px}.meta div,.data div{padding:7px 9px;border-bottom:1px solid #dfe6e2}.label{font-size:10px;text-transform:uppercase;color:#68766f;font-weight:800;display:block;margin-bottom:2px}.value{font-weight:700;white-space:pre-wrap}.data{display:grid;grid-template-columns:repeat(2,1fr);gap:0 16px}.photo{width:105px;height:130px;object-fit:cover;border:1px solid #b8c5bf;border-radius:7px}.agent-head{display:grid;grid-template-columns:1fr 120px;gap:18px}.footer{margin-top:28px;padding-top:10px;border-top:1px solid #dfe6e2;text-align:center;color:#66736d;font-size:10px}.print-actions{position:fixed;top:10px;right:10px}@media print{.print-actions{display:none}}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd7d1;padding:7px;text-align:left}th{background:#eef4f1;color:#0b4d3b}`}

function printRecord(record){
  const w=window.open('','_blank');if(!w){professionalAlert('Impression bloquée','Autorisez les fenêtres contextuelles pour imprimer le document.');return}w.opener=null;
  if(moduleKey==='absences'){
    const d=record.data||{};
    const days=Number(d.nombre_jours||inclusiveDays(d.date_debut,d.date_fin)||0);
    const dayText=days?`${frenchNumber(days)} (${String(days).padStart(2,'0')})`:'—';
    const org=record.source_organization||session?.user?.organizationName||'Service des Eaux et Forêts';
    const path=(record.source_path||org).split('›').map(x=>x.trim()).filter(Boolean);
    const hierarchy=path.map(x=>`<div>${esc(x.toUpperCase())}</div>`).join('');
    const phrase=`Une autorisation d’absence de <strong>${esc(dayText)} jour${days>1?'s':''}</strong> allant du <strong>${esc(longFrDate(d.date_debut))}</strong> au <strong>${esc(longFrDate(d.date_fin))}</strong> inclus est accordée à <strong>${esc([d.grade,record.title].filter(Boolean).join(' '))}</strong>${d.matricule?`, Matricule <strong>${esc(d.matricule)}</strong>`:''}${d.emploi?`, ${esc(d.emploi)}`:''} en service au <strong>${esc(org)}</strong>${d.destination?` en vue de se rendre à <strong>${esc(d.destination)}</strong>`:''}${d.motif?` pour ${esc(d.motif)}`:''}.`;
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>AUTORISATION D’ABSENCE — ${esc(record.title)}</title><style>${printBaseStyles()}
      @page{size:A4;margin:12mm 14mm 14mm}.absence-header{display:grid;grid-template-columns:1fr 130px 1fr;gap:12px;align-items:start;margin-bottom:20px}.absence-ministry{font-weight:700;line-height:1.65;font-size:11px}.absence-emblem{height:78px;border:1px solid #d7dfdb;border-radius:50%;display:grid;place-items:center;text-align:center;color:#0b4d3b;font-weight:900;font-size:11px}.absence-republic{text-align:right;font-weight:800;line-height:1.55}.absence-ref{margin:14px 0 30px;font-weight:700}.absence-title{text-align:center;text-decoration:underline;font-weight:900;font-size:22px;margin:0 0 56px}.absence-body{font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:2;text-align:justify}.absence-body .request{text-align:center;margin-bottom:22px}.absence-sign{width:46%;margin-left:auto;margin-top:64px;text-align:center;font-size:14px}.absence-sign strong{display:block;margin-bottom:70px;text-decoration:underline}.absence-status{margin-top:20px;text-align:center;font-size:10px;color:#6f7b75}.print-actions{font-family:Arial,sans-serif}@media print{.absence-status{display:none}}
    </style></head><body><button class="print-actions" onclick="window.print()">Imprimer / Enregistrer en PDF</button><div class="absence-header"><div class="absence-ministry"><div>MINISTÈRE DES EAUX ET FORÊTS</div><div style="margin-top:5px">CABINET DU MINISTRE</div>${hierarchy}</div><div class="absence-emblem">EAUX<br>ET<br>FORÊTS</div><div class="absence-republic">RÉPUBLIQUE DE CÔTE D’IVOIRE<br><span class="motto">Union – Discipline – Travail</span><div style="margin-top:36px">${esc(record.event_date?longFrDate(record.event_date):'')}</div></div></div><div class="absence-ref">N° ${esc(displayValue(record.reference))}</div><div class="absence-title">AUTORISATION D’ABSENCE</div><div class="absence-body"><div class="request">Vu la demande d’absence en date du <strong>${esc(longFrDate(d.date_demande))}</strong>,</div><p>${phrase}</p></div><div class="absence-sign"><strong>${esc(absenceSignerTitle())}</strong><div style="border-top:1px dotted #777;padding-top:8px">Signature et cachet</div></div><div class="absence-status">Document généré par SIGAT — statut : ${esc(record.status||'AUTORISÉ')}</div><script>setTimeout(()=>window.print(),350)<\/script></body></html>`;
    w.document.open();w.document.write(html);w.document.close();return;
  }
  if(moduleKey==='personnel'){
    const v=(key)=>esc(displayValue(record.data?.[key]));
    const photo=record.data?.photo?`<img class="agent-sheet-photo" src="${esc(record.data.photo)}" alt="Photo de l’agent">`:`<div class="agent-sheet-photo agent-sheet-photo-empty">PHOTO</div>`;
    const title='FICHE DE RENSEIGNEMENT DE L’AGENT';
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title><style>${printBaseStyles()}
      .agent-sheet{border:1px solid #b9c8c1;border-radius:8px;overflow:hidden}.agent-sheet-banner{background:#0b4d3b;color:#fff;text-align:center;padding:10px 14px;font-size:17px;font-weight:900;letter-spacing:.05em}.agent-sheet-top{display:grid;grid-template-columns:1fr 125px;gap:18px;padding:18px;border-bottom:1px solid #dfe6e2}.agent-sheet-photo{width:112px;height:138px;object-fit:cover;border:2px solid #0b4d3b;border-radius:7px;background:#f3f7f5}.agent-sheet-photo-empty{display:grid;place-items:center;color:#8a9791;font-weight:800}.agent-sheet-id{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;align-content:start}.agent-sheet-section{padding:14px 18px 4px}.agent-sheet-section h2{font-size:12px;color:#0b4d3b;text-transform:uppercase;letter-spacing:.08em;border-bottom:2px solid #c9a227;padding-bottom:6px;margin:0 0 8px}.agent-sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}.agent-sheet-cell{padding:8px 0;border-bottom:1px solid #e2e8e5;min-height:47px}.agent-sheet-signatures{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin:28px 18px 12px}.signature-box{text-align:center;padding-top:8px}.signature-line{height:52px;border-bottom:1px dotted #728079;margin-bottom:5px}.document-note{font-size:9px;color:#78847f;margin:10px 18px 15px;text-align:center}
      @media print{.agent-sheet{break-inside:avoid}.header{margin-bottom:12px}.title{display:none}}
    </style></head><body><button class="print-actions" onclick="window.print()">Imprimer / Enregistrer en PDF</button><div class="header"><div class="left">MINISTÈRE DES EAUX ET FORÊTS<br>${esc(session?.user?.organizationName||'')}</div><div class="center"><div class="sigat">SIGAT</div><div>Système Intégré de Gestion Administrative et Technique</div></div><div class="right">RÉPUBLIQUE DE CÔTE D’IVOIRE<br><span class="motto">Union – Discipline – Travail</span></div></div><div class="agent-sheet"><div class="agent-sheet-banner">FICHE DE RENSEIGNEMENT DE L’AGENT</div><div class="agent-sheet-top"><div class="agent-sheet-id"><div class="agent-sheet-cell"><span class="label">Référence</span><span class="value">${esc(displayValue(record.reference))}</span></div><div class="agent-sheet-cell"><span class="label">Date de prise de service</span><span class="value">${esc(fmtDate(record.event_date))}</span></div><div class="agent-sheet-cell" style="grid-column:1/-1"><span class="label">Nom et Prénoms</span><span class="value" style="font-size:16px;color:#0b4d3b">${esc(record.title)}</span></div><div class="agent-sheet-cell"><span class="label">Matricule</span><span class="value">${v('matricule')}</span></div><div class="agent-sheet-cell"><span class="label">Téléphone</span><span class="value">${v('telephone')}</span></div></div><div>${photo}</div></div><div class="agent-sheet-section"><h2>Situation professionnelle et administrative</h2><div class="agent-sheet-grid"><div class="agent-sheet-cell"><span class="label">Emploi</span><span class="value">${v('emploi')}</span></div><div class="agent-sheet-cell"><span class="label">Grade</span><span class="value">${v('grade')}</span></div><div class="agent-sheet-cell"><span class="label">Classe</span><span class="value">${v('classe')}</span></div><div class="agent-sheet-cell"><span class="label">Échelon</span><span class="value">${v('echelon')}</span></div><div class="agent-sheet-cell"><span class="label">Fonction</span><span class="value">${v('fonction')}</span></div><div class="agent-sheet-cell"><span class="label">Qualité</span><span class="value">${v('qualite')}</span></div></div></div><div class="agent-sheet-signatures"><div class="signature-box"><div class="signature-line"></div><strong>Signature de l’agent</strong></div><div class="signature-box"><div class="signature-line"></div><strong>Visa du responsable / Cachet</strong></div></div><div class="document-note">Fiche générée par SIGAT — ${new Date().toLocaleString('fr-FR')}</div></div><script>setTimeout(()=>window.print(),350)<\/script></body></html>`;
    w.document.open();w.document.write(html);w.document.close();return;
  }
  const dataRows=config.fields.filter(([k])=>k!=='photo').map(([k,l])=>`<div><span class="label">${esc(l)}</span><span class="value">${esc(displayValue(record.data?.[k]))}</span></div>`).join('');
  const title=`${config.singular.toUpperCase()} — ${esc(record.title)}`;
  const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${printBaseStyles()}</style></head><body><button class="print-actions" onclick="window.print()">Imprimer / Enregistrer en PDF</button><div class="header"><div class="left">MINISTÈRE DES EAUX ET FORÊTS<br>${esc(session?.user?.organizationName||'')}</div><div class="center"><div class="sigat">SIGAT</div><div>Système Intégré de Gestion Administrative et Technique</div></div><div class="right">RÉPUBLIQUE DE CÔTE D’IVOIRE<br><span class="motto">Union – Discipline – Travail</span></div></div><div class="title">${title}</div><div class="meta"><div><span class="label">Référence</span><span class="value">${esc(displayValue(record.reference))}</span></div><div><span class="label">Date</span><span class="value">${esc(fmtDate(record.event_date))}</span></div><div><span class="label">Nom / Intitulé</span><span class="value">${esc(record.title)}</span></div><div><span class="label">Statut</span><span class="value">${esc(record.status)}</span></div><div><span class="label">Service source</span><span class="value">${esc(record.source_organization||session?.user?.organizationName||'')}</span></div></div><div class="data">${dataRows}</div><div class="footer">Document généré par SIGAT — ${new Date().toLocaleString('fr-FR')}</div><script>setTimeout(()=>window.print(),350)<\/script></body></html>`;
  w.document.open();w.document.write(html);w.document.close();
}

function printCurrentList(){
  if(!lastItems.length){professionalAlert('Impression','Aucune donnée à imprimer sur cette page.');return}
  const w=window.open('','_blank');if(!w){professionalAlert('Impression bloquée','Autorisez les fenêtres contextuelles pour imprimer la liste.');return}w.opener=null;
  const rows=lastItems.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.reference||'—')}</td><td>${esc(r.title)}</td><td>${esc(fmtDate(r.event_date))}</td><td>${esc(r.status)}</td><td>${esc(r.source_organization||'')}</td></tr>`).join('');
  const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(config.title)}</title><style>${printBaseStyles()}</style></head><body><button class="print-actions" onclick="window.print()">Imprimer / Enregistrer en PDF</button><div class="header"><div class="left">MINISTÈRE DES EAUX ET FORÊTS<br>${esc(session?.user?.organizationName||'')}</div><div class="center"><div class="sigat">SIGAT</div><div>Système Intégré de Gestion Administrative et Technique</div></div><div class="right">RÉPUBLIQUE DE CÔTE D’IVOIRE<br><span class="motto">Union – Discipline – Travail</span></div></div><div class="title">${esc(config.title.toUpperCase())}</div><table><thead><tr><th>N°</th><th>Référence</th><th>Intitulé</th><th>Date</th><th>Statut</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table><div class="footer">Page SIGAT ${currentPage} — document généré le ${new Date().toLocaleString('fr-FR')}</div><script>setTimeout(()=>window.print(),350)<\/script></body></html>`;
  w.document.open();w.document.write(html);w.document.close();
}

document.addEventListener('DOMContentLoaded',boot);
