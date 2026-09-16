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
  printBtn.onclick=e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…');
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
  tb.innerHTML=items.map(r=>`<tr><td>${esc(r.reference||'—')}</td><td><strong>${esc(r.title)}</strong></td><td>${fmtDate(r.event_date)}</td><td><span class="pill">${esc(r.status)}</span></td><td><strong>${esc(r.source_organization)}</strong>${r.source_path&&r.source_path!==r.source_organization?`<br><span class="muted">${esc(r.source_path)}</span>`:''}</td><td>${fmtDate(r.updated_at)}</td><td><div class="actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-secondary btn-sm" data-archive="${r.id}">Archiver</button><button class="btn btn-danger btn-sm" data-delete="${r.id}">Supprimer</button>`:'<span class="muted">Consultation</span>'}</div></td></tr>`).join('');
  items.forEach(r=>{
    tb.querySelector(`[data-view="${r.id}"]`)?.addEventListener('click',()=>openDetails(r));
    tb.querySelector(`[data-print="${r.id}"]`)?.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>printRecord(r),'Préparation…'));
    if(!r.owned)return;
    tb.querySelector(`[data-edit="${r.id}"]`)?.addEventListener('click',()=>openEditor(r));
    tb.querySelector(`[data-archive="${r.id}"]`)?.addEventListener('click',e=>archiveRecord(r,e.currentTarget));
    tb.querySelector(`[data-delete="${r.id}"]`)?.addEventListener('click',e=>deleteRecord(r,e.currentTarget));
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
  const isConvocation=moduleKey==='convocations';
  d.classList.toggle('personnel-editor',isPersonnel);
  d.classList.toggle('absence-editor',isAbsence);
  d.classList.toggle('convocation-editor',isConvocation);
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
  }else if(isConvocation){
    refField.querySelector('label').textContent='Référence / N°';
    dateField.querySelector('label').textContent="Date d’établissement";
    titleField.querySelector('label').textContent='Nom et Prénoms de la personne convoquée *';
    titleField.classList.remove('full');
    statusField.classList.remove('personnel-status-hidden');
    statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="ÉMISE">ÉMISE</option><option value="REMISE">REMISE</option><option value="PRÉSENTÉ">PRÉSENTÉ</option><option value="ANNULÉ">ANNULÉ</option>';
    statusInput.value=record?.status||'ÉMISE';
  }else{
    dateField.querySelector('label').textContent='Date';
    titleField.querySelector('label').textContent='Intitulé / nom principal *';
    titleField.classList.add('full');
    statusField.classList.remove('personnel-status-hidden');
  }
  const area=document.getElementById('dynamicFields');area.innerHTML='';
  for(const [key,label,type,opts] of config.fields){
    const wrap=document.createElement('div');wrap.className='field'+(type==='textarea'?' full':'')+(type==='image'?' photo-field':'');
    if(isConvocation){
      if(key==='objet_convocation')wrap.classList.add('convocation-object-field');
      if(key==='personne_a_voir')wrap.classList.add('convocation-person-field');
    }
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

async function deleteRecord(r,button){
  const yes=await professionalConfirm('Supprimer définitivement',`Voulez-vous supprimer définitivement « ${r.title} » ? Cette action est irréversible.`,{confirmText:'Supprimer',cancelText:'Annuler',danger:true});
  if(!yes)return;
  return withButtonLock(button,async()=>{try{await api('/api/save',{method:'POST',body:{module:moduleKey,action:'delete',payload:{id:r.id}}});await professionalAlert('Suppression effectuée','L’enregistrement a été supprimé définitivement.');loadRecords()}catch(e){await professionalAlert('Suppression impossible',e.message)}},'Suppression…');
}

let printSettingsCache=null;

async function ensurePrintSettings(){
  if(printSettingsCache)return printSettingsCache;
  const r=await api('/api/print-settings');
  printSettingsCache=r.settings||{};
  return printSettingsCache;
}

function nowFrDateTime(){
  const d=new Date();
  const p=n=>String(n).padStart(2,'0');
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function officialDate(v){
  if(!v)return '';
  const d=new Date(`${String(v).slice(0,10)}T00:00:00`);
  if(Number.isNaN(d.getTime()))return fmtDate(v);
  return new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
}

function printBaseStyles(){return `@page{size:A4 portrait;margin:13mm 14mm 18mm}*{box-sizing:border-box}html,body{background:#fff}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;font-size:11.5px;line-height:1.15;padding-bottom:13mm}.official-header{display:grid;grid-template-columns:minmax(0,1.25fr) 90px minmax(0,1fr);gap:12px;align-items:start;margin-bottom:10px;min-height:116px}.official-left{font-size:10.5px;line-height:1.35;font-weight:500}.official-left .admin-line{display:block;margin:0 0 2px;text-transform:uppercase}.official-left .admin-separator{font-size:8px;letter-spacing:2px;margin:0 0 5px 18px}.official-center{text-align:center;min-height:76px}.official-emblem{max-width:74px;max-height:74px;object-fit:contain}.official-right{text-align:center;font-size:10.5px;line-height:1.35;font-weight:800}.official-right .motto{font-style:italic;font-weight:500;margin-top:2px}.official-right .admin-separator{font-size:8px;letter-spacing:2px;margin-top:2px}.official-reference{font-size:10.5px;margin:4px 0 34px;font-weight:500}.document-title{text-align:center;text-decoration:underline;text-decoration-thickness:1.2px;text-underline-offset:3px;font-size:18px;font-weight:900;margin:34px 0 44px;letter-spacing:.02em}.official-body{width:86%;margin:0 auto;text-align:justify;line-height:1.15}.official-body.wide{width:100%}.official-body p,.absence-body p,.convocation-body p,.document-paragraph{line-height:1.15;margin:0 0 1.7em;text-align:justify}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:7px 18px;margin-bottom:1.7em;text-align:left}.meta>div,.data>div{padding:6px 8px;border-bottom:1px solid #d9dfdc}.label{font-size:9px;text-transform:uppercase;color:#64716b;font-weight:800;display:block;margin-bottom:2px}.value{font-weight:700;white-space:pre-wrap}.data{display:grid;grid-template-columns:repeat(2,1fr);gap:0 16px;text-align:left}.record-print .official-signature{position:fixed;right:14mm;bottom:24mm;width:43%;text-align:center;break-inside:avoid}.official-signature .made-at{font-size:11px;margin:0 0 18px;text-align:center}.official-signature .signer-title{font-size:11px;margin-bottom:28px}.official-signature .signature-media{height:54px;display:flex;justify-content:center;align-items:flex-end;position:relative}.official-signature .signature-image{max-width:145px;max-height:54px;object-fit:contain;position:relative;z-index:2}.official-signature .stamp-image{max-width:80px;max-height:80px;object-fit:contain;position:absolute;right:5%;bottom:-15px;opacity:.82}.official-signature .signer-name{font-weight:900;text-decoration:underline;margin-top:4px}.official-signature .signer-position{font-size:9.5px;margin-top:2px}.official-footer{position:fixed;left:14mm;right:14mm;bottom:5mm;border-top:1px solid #cfd7d3;padding-top:4px;text-align:center;font-size:8.5px;color:#5d6963}.record-print .official-body,.record-print .absence-body,.record-print .agent-sheet{margin-bottom:62mm}.agent-sheet{width:92%;margin-left:auto;margin-right:auto;border:1px solid #bac6c0;border-radius:7px;overflow:hidden}.agent-sheet-top{display:grid;grid-template-columns:1fr 120px;gap:18px;padding:16px;border-bottom:1px solid #dce4e0}.agent-sheet-photo{width:108px;height:132px;object-fit:cover;border:1.5px solid #174c3b;border-radius:5px;background:#f3f5f4}.agent-sheet-photo-empty{display:grid;place-items:center;color:#87928d;font-weight:800}.agent-sheet-id{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;align-content:start}.agent-sheet-section{padding:12px 16px 4px}.agent-sheet-section h2{font-size:11px;color:#174c3b;text-transform:uppercase;letter-spacing:.06em;border-bottom:1.5px solid #b89b44;padding-bottom:5px;margin:0 0 6px}.agent-sheet-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.agent-sheet-cell{padding:7px 0;border-bottom:1px solid #e2e7e4;min-height:43px}.absence-body{width:86%;margin-left:auto;margin-right:auto;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.15;text-align:justify}.absence-body .request{text-align:center;line-height:1.15;margin-bottom:1.7em}.convocation-body{font-family:Georgia,'Times New Roman',serif;font-size:12.2px;line-height:1.15;width:92%;margin-left:auto;margin-right:auto}.convocation-intro{text-align:center;font-weight:600;line-height:1.3;margin:0 auto 14px;width:88%}.convocation-table{width:100%;border-collapse:collapse;margin:0 0 16px;font-size:11.6px}.convocation-table td{border:1px solid #b7b7b7;padding:6px 7px;vertical-align:middle;background:#fff;color:#111}.convocation-table .convocation-label{width:102px;font-weight:800;white-space:nowrap}.convocation-table .convocation-colon{width:16px;text-align:center;font-weight:700}.convocation-table .convocation-value{font-weight:500}.convocation-section{margin:0 0 14px}.convocation-section-title{font-weight:800;margin:0 0 5px}.convocation-box{border:1px solid #c4c4c4;min-height:44px;padding:7px 8px;white-space:pre-wrap;line-height:1.15;text-align:justify}.convocation-person-box{border:1px solid #c4c4c4;min-height:31px;padding:7px 8px;display:grid;grid-template-columns:auto 16px 1fr;align-items:center;gap:2px}.convocation-person-box .label{font-family:Georgia,'Times New Roman',serif;font-size:11.6px;text-transform:none;color:#111;margin:0;font-weight:800}.convocation-person-box .value{font-weight:500}.convocation-final{margin:0 0 1.7em;font-weight:500;text-align:left!important;line-height:1.15}.record-print.convocation-print .official-signature{bottom:20mm}.record-print.convocation-print .official-body{margin-bottom:58mm}.list-print .document-title{margin-top:26px;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:9.5px}th,td{border:1px solid #aebbb5;padding:5px;text-align:left}th{background:#eef2f0;color:#173f33}.no-print{position:fixed;right:12px;top:12px;z-index:9999}@media print{.no-print{display:none!important}.agent-sheet{break-inside:avoid}.official-signature{break-inside:avoid}}
/* V1.18 — Normalisation typographique et marges de tous les imprimés PDF */
@page{size:A4 portrait;margin:1.5cm}
.document-title{font-family:"Cooper Black",Cooper,serif!important;font-size:22pt!important}
.record-print .official-body,.record-print .official-body *,
.record-print .absence-body,.record-print .absence-body *,
.record-print .convocation-body,.record-print .convocation-body *,
.record-print .agent-sheet,.record-print .agent-sheet *,
.record-print .official-signature,.record-print .official-signature *{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:14pt!important}
.list-print .official-body,.list-print .official-body *,
.list-print table,.list-print table *{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:14pt!important}
.record-print .official-signature{right:1.5cm}
.official-footer{display:none!important}
`}


function settingsLine(v){return String(v||'').trim()}
function adminLineHtml(v){const s=settingsLine(v);return s?`<div class="admin-line">${esc(s)}</div><div class="admin-separator">- - - - - -</div>`:''}
function formattedReference(reference,s){
  const raw=String(reference||'').trim();
  const prefix=settingsLine(s.referencePrefix);
  if(raw&&raw!=='—'&&raw.includes('/'))return `N° ${esc(raw)}`;
  const number=raw&&raw!=='—'?esc(raw):'____________';
  return `N°${number}${prefix?`/${esc(prefix)}`:''}`;
}
function officialHeaderHtml(s,{reference='',hideReference=false}={}){
  const left=[s.ministry,s.cabinet,s.regionalDirection,s.departmentalDirection,s.cantonment,s.post].map(adminLineHtml).join('');
  const emblem=s.emblemData?`<img class="official-emblem" src="${esc(s.emblemData)}" alt="Emblème">`:'';
  return `<div class="official-header"><div class="official-left">${left}</div><div class="official-center">${emblem}</div><div class="official-right"><div>${esc(settingsLine(s.republic)||'REPUBLIQUE DE COTE D’IVOIRE')}</div><div class="motto">${esc(settingsLine(s.motto)||'Union – Discipline – Travail')}</div><div class="admin-separator">- - - - - -</div></div></div>${hideReference?'':`<div class="official-reference">${formattedReference(reference,s)}</div>`}`;
}
function officialSignatureHtml(s,date=''){
  const title=settingsLine(s.signerTitle)||absenceSignerTitle();
  const name=settingsLine(s.signerName);
  const position=settingsLine(s.signerPosition);
  const locality=settingsLine(s.locality)||String(session?.user?.organizationName||'').replace(/^(POSTE DES EAUX ET FORÊTS DE|CANTONNEMENT(?: DES EAUX ET FORÊTS)? DE|DIRECTION RÉGIONALE(?: DES EAUX ET FORÊTS)? (?:DU|DE LA|DE L’|DE)|DIRECTION DÉPARTEMENTALE(?: DES EAUX ET FORÊTS)? (?:DU|DE LA|DE L’|DE))\s*/i,'').trim();
  const madeAt=(locality||date)?`Fait à ${esc(locality||'')}${locality&&date?', le ':''}${date?esc(longFrDate(date)):''}`:'';
  const sig=s.signatureData?`<img class="signature-image" src="${esc(s.signatureData)}" alt="Signature">`:'';
  const stamp=s.stampData?`<img class="stamp-image" src="${esc(s.stampData)}" alt="Cachet">`:'';
  return `<div class="official-signature">${madeAt?`<div class="made-at">${madeAt}</div>`:''}<div class="signer-title">${esc(title)}</div><div class="signature-media">${sig}${stamp}</div>${name?`<div class="signer-name">${esc(name)}</div>`:''}${position?`<div class="signer-position">${esc(position)}</div>`:''}</div>`;
}
function officialFooterHtml(){return ''}

function buildPrintDocument({title,body,reference='',date='',settings,signature=true,hideReference=false,documentClass=''}){
  const bodyClass=(signature?'record-print':'list-print')+(documentClass?` ${documentClass}`:'');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title||'Document')}</title><style>${printBaseStyles()}</style></head><body class="${bodyClass}">${officialHeaderHtml(settings,{reference,hideReference})}${body}${signature?officialSignatureHtml(settings,date):''}</body></html>`;
}

async function launchPrint(html){
  return new Promise((resolve,reject)=>{
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');
    frame.style.cssText='position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:.01;pointer-events:none;';
    let started=false,finished=false;
    const done=()=>{if(finished)return;finished=true;setTimeout(()=>frame.remove(),1000);resolve();};
    const fail=e=>{if(finished)return;finished=true;frame.remove();reject(e instanceof Error?e:new Error('Impression impossible.'));};
    const startPrint=()=>{
      if(started||finished)return;started=true;
      try{
        const w=frame.contentWindow;
        if(!w)throw new Error('Fenêtre d’impression indisponible.');
        const images=[...frame.contentDocument.images];
        Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise(r=>{img.onload=img.onerror=r})))
          .then(()=>setTimeout(()=>{try{w.focus();w.print();setTimeout(done,700)}catch(e){fail(e)}},180))
          .catch(fail);
      }catch(e){fail(e)}
    };
    frame.onload=startPrint;
    document.body.appendChild(frame);
    frame.srcdoc=html;
    setTimeout(()=>{if(!started&&!finished&&frame.contentDocument?.readyState==='complete')startPrint()},1800);
  });
}

async function printRecord(record){
  try{
    const s=await ensurePrintSettings();
    let body='';let title='';
    if(moduleKey==='absences'){
      const d=record.data||{};
      const days=Number(d.nombre_jours||inclusiveDays(d.date_debut,d.date_fin)||0);
      const dayText=days?`${frenchNumber(days)} (${String(days).padStart(2,'0')})`:'—';
      const org=record.source_organization||session?.user?.organizationName||'Service des Eaux et Forêts';
      const phrase=`Une autorisation d’absence de <strong>${esc(dayText)} jour${days>1?'s':''}</strong> allant du <strong>${esc(longFrDate(d.date_debut))}</strong> au <strong>${esc(longFrDate(d.date_fin))}</strong> inclus est accordée à <strong>${esc([d.grade,record.title].filter(Boolean).join(' '))}</strong>${d.matricule?`, Matricule <strong>${esc(d.matricule)}</strong>`:''}${d.emploi?`, ${esc(d.emploi)}`:''} en service au <strong>${esc(org)}</strong>${d.destination?` en vue de se rendre à <strong>${esc(d.destination)}</strong>`:''}${d.motif?` pour ${esc(d.motif)}`:''}.`;
      title='AUTORISATION D’ABSENCE';
      body=`<div class="document-title">AUTORISATION D’ABSENCE</div><div class="absence-body"><div class="request">Vu la demande d’absence en date du <strong>${esc(longFrDate(d.date_demande))}</strong>,</div><p>${phrase}</p></div>`;
    }else if(moduleKey==='convocations'){
      const d=record.data||{};
      const civ=String(d.civilite||'M.').trim();
      const presentDate=d.date_presentation?longFrDate(d.date_presentation):'—';
      const presentTime=d.heure?String(d.heure).slice(0,5):'—';
      const structure=record.source_organization||session?.user?.organizationName||'Poste des Eaux et Forêts';
      const objectText=String(d.objet_convocation||d.motif||'').trim();
      const personText=String(d.personne_a_voir||d.voir||'').trim();
      title='CONVOCATION';
      body=`<div class="document-title">CONVOCATION</div><div class="official-body convocation-body"><div class="convocation-intro">Est prié(e) de bien vouloir se présenter au <strong>${esc(structure)}</strong><br>muni d’une pièce d’identité</div><table class="convocation-table"><tbody><tr><td class="convocation-label">M./Mme/Mlle</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(`${civ} ${record.title}`.trim())}</td></tr><tr><td class="convocation-label">Profession</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(displayValue(d.profession))}</td></tr><tr><td class="convocation-label">Domicile</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(displayValue(d.domicile))}</td></tr><tr><td class="convocation-label">Date</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(presentDate)}</td></tr><tr><td class="convocation-label">Heures</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(presentTime)}</td></tr></tbody></table><div class="convocation-section"><div class="convocation-section-title">Objet de la convocation :</div><div class="convocation-box">${esc(objectText)}</div></div><div class="convocation-section"><div class="convocation-person-box"><span class="label">Personne à voir</span><span>:</span><span class="value">${esc(personText)}</span></div></div><p class="convocation-final">Votre présence à la date et à l’heure indiquée est nécessaire.</p></div>`;
    }else if(moduleKey==='personnel'){
      const v=key=>esc(displayValue(record.data?.[key]));
      const photo=record.data?.photo?`<img class="agent-sheet-photo" src="${esc(record.data.photo)}" alt="Photo de l’agent">`:`<div class="agent-sheet-photo agent-sheet-photo-empty">PHOTO</div>`;
      title='FICHE DE RENSEIGNEMENT DE L’AGENT';
      body=`<div class="document-title">FICHE DE RENSEIGNEMENT DE L’AGENT</div><div class="agent-sheet"><div class="agent-sheet-top"><div class="agent-sheet-id"><div class="agent-sheet-cell"><span class="label">Référence</span><span class="value">${esc(displayValue(record.reference))}</span></div><div class="agent-sheet-cell"><span class="label">Date de prise de service</span><span class="value">${esc(fmtDate(record.event_date))}</span></div><div class="agent-sheet-cell" style="grid-column:1/-1"><span class="label">Nom et Prénoms</span><span class="value" style="font-size:15px;color:#174c3b">${esc(record.title)}</span></div><div class="agent-sheet-cell"><span class="label">Matricule</span><span class="value">${v('matricule')}</span></div><div class="agent-sheet-cell"><span class="label">Téléphone</span><span class="value">${v('telephone')}</span></div></div><div>${photo}</div></div><div class="agent-sheet-section"><h2>Situation professionnelle et administrative</h2><div class="agent-sheet-grid"><div class="agent-sheet-cell"><span class="label">Emploi</span><span class="value">${v('emploi')}</span></div><div class="agent-sheet-cell"><span class="label">Grade</span><span class="value">${v('grade')}</span></div><div class="agent-sheet-cell"><span class="label">Classe</span><span class="value">${v('classe')}</span></div><div class="agent-sheet-cell"><span class="label">Échelon</span><span class="value">${v('echelon')}</span></div><div class="agent-sheet-cell"><span class="label">Fonction</span><span class="value">${v('fonction')}</span></div><div class="agent-sheet-cell"><span class="label">Qualité</span><span class="value">${v('qualite')}</span></div></div></div></div>`;
    }else{
      title=(config?.singular||'Document').toUpperCase();
      const dataRows=(config?.fields||[]).filter(([k])=>k!=='photo').map(([k,l])=>`<div><span class="label">${esc(l)}</span><span class="value">${esc(displayValue(record.data?.[k]))}</span></div>`).join('');
      body=`<div class="document-title">${esc(title)}</div><div class="official-body"><div class="meta"><div><span class="label">Référence</span><span class="value">${esc(displayValue(record.reference))}</span></div><div><span class="label">Date</span><span class="value">${esc(fmtDate(record.event_date))}</span></div><div><span class="label">Nom / Intitulé</span><span class="value">${esc(record.title)}</span></div><div><span class="label">Statut</span><span class="value">${esc(record.status)}</span></div><div><span class="label">Service source</span><span class="value">${esc(record.source_organization||session?.user?.organizationName||'')}</span></div></div><div class="data">${dataRows}</div></div>`;
    }
    const html=buildPrintDocument({title,body,reference:record.reference,date:record.event_date,settings:s,signature:true,documentClass:moduleKey==='convocations'?'convocation-print':''});
    await launchPrint(html);
  }catch(e){await professionalAlert('Impression impossible',e.message||'Le document n’a pas pu être préparé.');}
}

async function printCurrentList(){
  if(!lastItems.length){await professionalAlert('Impression','Aucune donnée à imprimer sur cette page.');return}
  try{
    const s=await ensurePrintSettings();
    const rows=lastItems.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.reference||'—')}</td><td>${esc(r.title)}</td><td>${esc(fmtDate(r.event_date))}</td><td>${esc(r.status)}</td><td>${esc(r.source_organization||'')}</td></tr>`).join('');
    const title=config.title.toUpperCase();
    const body=`<div class="document-title">${esc(title)}</div><div class="official-body wide"><table><thead><tr><th>N°</th><th>Référence</th><th>Intitulé</th><th>Date</th><th>Statut</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const html=buildPrintDocument({title,body,settings:s,signature:false,hideReference:true});
    await launchPrint(html);
  }catch(e){await professionalAlert('Impression impossible',e.message||'La liste n’a pas pu être préparée.');}
}

document.addEventListener('DOMContentLoaded',boot);
