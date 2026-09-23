import {api,esc,fmtDate,loadSession,showToast,professionalConfirm,professionalAlert,withButtonLock} from './common.js?v=2.00';

let accountSession=null;
let permissionPages=[];
let users=[];

function permissionCode(pageKey,action){return `page.${pageKey}.${action}`}
function roleLabel(role){return role==='READ_ONLY'?'Consultation':'Membre'}
function permissionCounts(user){
  const set=new Set(user.permissions||[]);let view=0,edit=0;
  for(const page of permissionPages){if(set.has(permissionCode(page.key,'view')))view++;if(set.has(permissionCode(page.key,'edit')))edit++;}
  return {view,edit};
}
function permissionGridHtml(selected=[],role='MEMBER',prefix='create'){
  const set=new Set(selected||[]),readOnly=role==='READ_ONLY';
  return `<div class="permission-grid-head"><span>Page</span><span>Voir</span><span>Modifier</span></div>`+permissionPages.map(page=>{
    const view=permissionCode(page.key,'view'),edit=permissionCode(page.key,'edit');
    const viewChecked=set.has(view)?'checked':'';
    const editChecked=!readOnly&&page.editable&&set.has(edit)?'checked':'';
    return `<div class="permission-grid-row" data-permission-page="${esc(page.key)}"><span class="permission-page-name">${esc(page.label)}</span><label class="permission-check"><input type="checkbox" data-permission-view="${esc(page.key)}" ${viewChecked}> <span>Voir</span></label>${page.editable?`<label class="permission-check"><input type="checkbox" data-permission-edit="${esc(page.key)}" ${editChecked} ${readOnly?'disabled':''}> <span>Modifier</span></label>`:'<span class="permission-na">—</span>'}</div>`;
  }).join('');
}
function bindGridLogic(container,role){
  if(!container)return;
  const readOnly=role==='READ_ONLY';
  container.querySelectorAll('[data-permission-edit]').forEach(edit=>{
    edit.disabled=readOnly;
    if(readOnly)edit.checked=false;
    edit.addEventListener('change',()=>{if(edit.checked){const row=edit.closest('[data-permission-page]');const view=row?.querySelector('[data-permission-view]');if(view)view.checked=true;}});
  });
  container.querySelectorAll('[data-permission-view]').forEach(view=>view.addEventListener('change',()=>{if(!view.checked){const row=view.closest('[data-permission-page]');const edit=row?.querySelector('[data-permission-edit]');if(edit)edit.checked=false;}}));
}
function renderGrid(containerId,selected=[],role='MEMBER'){
  const box=document.getElementById(containerId);if(!box)return;box.innerHTML=permissionGridHtml(selected,role,containerId);bindGridLogic(box,role);
}
function collectPermissions(containerId,role='MEMBER'){
  const box=document.getElementById(containerId);if(!box)return[];const out=[];
  box.querySelectorAll('[data-permission-page]').forEach(row=>{const key=row.dataset.permissionPage;const view=row.querySelector('[data-permission-view]');const edit=row.querySelector('[data-permission-edit]');if(view?.checked)out.push(permissionCode(key,'view'));if(role!=='READ_ONLY'&&edit?.checked)out.push(permissionCode(key,'edit'));});
  return out;
}

async function loadUsers(){
  try{
    const d=await api('/api/users');permissionPages=d.permissionPages||permissionPages;users=d.items||[];
    const tb=document.getElementById('usersBody');if(!tb)return;
    tb.innerHTML=users.map(u=>{const c=permissionCounts(u);return `<tr><td><strong>${esc(u.display_name)}</strong></td><td>${esc(u.username)}</td><td><span class="pill">${esc(roleLabel(u.role_code))}</span></td><td>${esc(u.status)}</td><td><span class="access-summary">${c.view} page(s) en lecture${u.role_code==='MEMBER'?` · ${c.edit} modifiable(s)`:''}</span></td><td>${fmtDate(u.last_login_at)}</td><td><div class="actions"><button class="btn btn-secondary btn-sm" data-access="${u.id}">Accès</button><button class="btn btn-secondary btn-sm" data-reset="${u.id}">Réinitialiser mot de passe</button><button class="btn btn-secondary btn-sm" data-toggle="${u.id}" data-status="${u.status==='ACTIVE'?'DISABLED':'ACTIVE'}">${u.status==='ACTIVE'?'Désactiver':'Activer'}</button><button class="btn btn-danger btn-sm" data-delete="${u.id}">Supprimer</button></div></td></tr>`}).join('')||'<tr><td colspan="7">Aucun utilisateur / membre.</td></tr>';
    for(const u of users){
      tb.querySelector(`[data-access="${u.id}"]`)?.addEventListener('click',()=>openPermissions(u));
      tb.querySelector(`[data-reset="${u.id}"]`)?.addEventListener('click',()=>resetPwd(u.id));
      tb.querySelector(`[data-toggle="${u.id}"]`)?.addEventListener('click',e=>setStatus(u.id,e.currentTarget.dataset.status));
      tb.querySelector(`[data-delete="${u.id}"]`)?.addEventListener('click',()=>delUser(u.id));
    }
    const r=await api('/api/password-requests');const requests=document.getElementById('requestsBox');if(requests)requests.innerHTML=(r.items||[]).filter(x=>x.status==='PENDING').map(x=>`<div class="notice" style="margin-bottom:8px"><strong>${esc(x.display_name||x.username_or_email)}</strong> — ${fmtDate(x.requested_at)} — demande en attente</div>`).join('')||'Aucune demande en attente.';
  }catch(e){const box=document.getElementById('userMsg');if(box)box.innerHTML=`<div class="notice error">${esc(e.message)}</div>`;const b=document.getElementById('addUserBtn');if(b)b.disabled=true;}
}

function openCreateUser(){
  const d=document.getElementById('userDialog');if(!d)return;document.getElementById('userForm')?.reset();renderGrid('createPermissionsGrid',[],document.getElementById('uRole')?.value||'MEMBER');d.showModal();
}
function openPermissions(user){
  const d=document.getElementById('permissionsDialog');if(!d)return;document.getElementById('permissionsUserId').value=user.id;document.getElementById('permissionsUserRole').value=user.role_code;document.getElementById('permissionsUserLabel').textContent=`${user.display_name} — ${roleLabel(user.role_code)}`;renderGrid('editPermissionsGrid',user.permissions||[],user.role_code);d.showModal();
}
async function resetPwd(id){const yes=await professionalConfirm('Réinitialiser le mot de passe','Un mot de passe temporaire sera généré pour cet utilisateur.',{confirmText:'Réinitialiser'});if(!yes)return;try{const r=await api('/api/users/reset-password',{method:'POST',body:{userId:id}});await professionalAlert('Mot de passe temporaire',`Mot de passe temporaire (affiché une seule fois) :\n\n${r.temporaryPassword}`,{copyText:r.temporaryPassword});await loadUsers()}catch(e){await professionalAlert('Réinitialisation impossible',e.message)}}
async function setStatus(id,status){try{await api('/api/users/status',{method:'POST',body:{userId:id,status}});showToast('Statut mis à jour.');await loadUsers()}catch(e){showToast(e.message,'error')}}
async function delUser(id){const yes=await professionalConfirm('Supprimer l’utilisateur','Le compte sera retiré de la liste active. Ses historiques restent conservés pour la traçabilité.',{confirmText:'Supprimer',danger:true});if(!yes)return;try{await api('/api/users/delete',{method:'POST',body:{userId:id}});await professionalAlert('Utilisateur supprimé','Le compte utilisateur a été retiré de la liste active.');await loadUsers()}catch(e){await professionalAlert('Suppression impossible',e.message)}}

function subscriptionIsValidPaid(x){
  return !!x && ['STANDARD','BUSINESS'].includes(String(x.plan||'').toUpperCase()) && !x.expired && Number(x.daysRemaining||0)>=0 && !['SUSPENDED','EXPIRED'].includes(String(x.status||'').toUpperCase());
}
function updatePurchaseButtons(){
  const x=accountSession?.subscription;
  const locked=subscriptionIsValidPaid(x);
  document.querySelectorAll('[data-buy-plan]').forEach(a=>{
    if(!a.dataset.originalHref)a.dataset.originalHref=a.getAttribute('href')||'';
    a.classList.toggle('is-disabled',locked);
    a.setAttribute('aria-disabled',locked?'true':'false');
    if(locked){a.removeAttribute('href');a.setAttribute('tabindex','-1');a.title=`Achat verrouillé : votre abonnement ${String(x.plan||'').toUpperCase()} est valide jusqu’au ${fmtDate(x.end_date)}.`;}
    else{if(a.dataset.originalHref)a.setAttribute('href',a.dataset.originalHref);a.removeAttribute('tabindex');a.removeAttribute('title');}
  });
}
function renderSubscription(){
  const box=document.getElementById('subscriptionSummary');if(!box)return;const x=accountSession?.subscription;
  if(!x){box.innerHTML='<div class="notice">Aucun abonnement actif.</div>';updatePurchaseButtons();return}
  const validPaid=subscriptionIsValidPaid(x);
  const suspended=String(x.status||'').toUpperCase()==='SUSPENDED';
  const message=validPaid?`<div class="notice ok account-subscription-lock" style="margin-top:14px">Votre abonnement ${esc(String(x.plan||'').toUpperCase())} est valide jusqu’au ${esc(fmtDate(x.end_date))}. Les boutons d’achat sont verrouillés jusqu’à son expiration.</div>`:(String(x.plan||'').toUpperCase()==='FREE'&&!x.expired?'<div class="notice account-subscription-free" style="margin-top:14px">Vous utilisez actuellement la formule FREE. Vous pouvez souscrire à STANDARD ou BUSINESS.</div>':(suspended?'<div class="notice error" style="margin-top:14px">Cet abonnement est suspendu administrativement. Contactez le Super Admin pour régulariser la situation.</div>':(x.expired?'<div class="notice error" style="margin-top:14px">Votre période actuelle est expirée. Vous pouvez choisir une formule payante.</div>':'')));
  box.innerHTML=`<div class="cards account-subscription-metrics"><div class="metric"><div class="k">Plan actuel</div><div class="v account-metric-value">${esc(x.plan)}</div></div><div class="metric"><div class="k">Prix</div><div class="v account-metric-value">${Number(x.price||0).toLocaleString('fr-FR')} FCFA</div></div><div class="metric"><div class="k">Expiration</div><div class="v account-metric-value">${fmtDate(x.end_date)}</div></div><div class="metric"><div class="k">Jours restants</div><div class="v account-metric-value">${Number(x.daysRemaining||0)}</div></div></div>${message}`;
  updatePurchaseButtons();
}

function accountTabFromHash(isAdmin){
  const id=String(location.hash||'').replace(/^#/,'');
  const allowed=isAdmin?['securite-compte','gestion-utilisateurs','journal-operations','abonnement']:['securite-compte'];
  return allowed.includes(id)?id:'securite-compte';
}
function showAccountPanel(id,{updateHash=true}={}){
  const isAdmin=accountSession?.user?.role==='ORGANIZATION_ADMIN';
  const allowed=isAdmin?['securite-compte','gestion-utilisateurs','journal-operations','abonnement']:['securite-compte'];
  const target=allowed.includes(id)?id:'securite-compte';
  document.querySelectorAll('[data-account-panel]').forEach(panel=>{panel.hidden=panel.id!==target});
  document.querySelectorAll('[data-account-tab]').forEach(btn=>{const active=btn.dataset.accountTab===target;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',active?'true':'false')});
  if(updateHash&&location.hash!==`#${target}`)history.replaceState(null,'',`#${target}`);
}

function auditActionLabel(action){
  return ({RECORD_CREATED:'Création',RECORD_UPDATED:'Modification',RECORD_DELETED:'Suppression',RECORD_ARCHIVED:'Archivage',RECORD_PRINTED:'Impression',LOGIN_SUCCESS:'Connexion',LOGIN_FAILED:'Échec de connexion',LOGOUT:'Déconnexion',USER_CREATED:'Création utilisateur',USER_PERMISSIONS_CHANGED:'Modification des accès',USER_STATUS_CHANGED:'Changement de statut',PASSWORD_RESET_BY_ADMIN:'Réinitialisation mot de passe',PASSWORD_CHANGED:'Modification mot de passe',PRINT_SETTINGS_UPDATED:'Modification en-tête imprimés'})[String(action||'')]||String(action||'Action');
}
function auditDateTime(v){if(!v)return '—';const d=new Date(String(v).replace(' ','T')+'Z');return Number.isNaN(d.getTime())?String(v):d.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'medium'});}
async function loadAuditLogs(){
  const body=document.getElementById('auditBody');if(!body)return;
  const q=new URLSearchParams();const action=document.getElementById('auditActionFilter')?.value||'',actor=document.getElementById('auditActorFilter')?.value.trim()||'',from=document.getElementById('auditFromFilter')?.value||'',to=document.getElementById('auditToFilter')?.value||'',search=document.getElementById('auditSearchFilter')?.value.trim()||'';
  if(action)q.set('action',action);if(actor)q.set('actor',actor);if(from)q.set('from',from);if(to)q.set('to',to);if(search)q.set('search',search);
  body.innerHTML='<tr><td colspan="4">Chargement…</td></tr>';
  try{const d=await api(`/api/audit-logs?${q.toString()}`);const items=d.items||[];body.innerHTML=items.map(x=>{const a=String(x.action||'');const cls=a.includes('DELETE')||a.includes('ARCHIV')?' is-delete':a.includes('PRINT')?' is-print':a.includes('PASSWORD')||a.includes('LOGIN')||a.includes('SESSION')?' is-security':'';return `<tr><td>${esc(auditDateTime(x.created_at))}</td><td><strong>${esc(x.actor_name||'Système')}</strong></td><td><span class="audit-action-pill${cls}">${esc(auditActionLabel(x.action))}</span></td><td>${esc(x.description||x.target_type||'—')}</td></tr>`}).join('')||'<tr><td colspan="4">Aucune opération correspondant aux filtres.</td></tr>'}catch(e){body.innerHTML=`<tr><td colspan="4" class="error">${esc(e.message)}</td></tr>`}
}

async function initAccount(){
  try{accountSession=await loadSession()}catch{return}
  const isAdmin=accountSession.user.role==='ORGANIZATION_ADMIN';
  const adminBox=document.getElementById('adminAccountSections');
  if(adminBox)adminBox.hidden=!isAdmin;
  if(!isAdmin){
    const n=document.getElementById('memberSubscriptionNotice');
    if(n&&accountSession.subscription?.expired){n.textContent='L’accès aux pages métier de votre structure est actuellement suspendu. Veuillez contacter votre Administrateur.';n.classList.remove('hidden');}
    showAccountPanel('securite-compte',{updateHash:false});
    return;
  }
  renderSubscription();
  showAccountPanel(accountTabFromHash(true),{updateHash:false});
  await Promise.all([loadUsers(),loadAuditLogs()]);
}

document.addEventListener('DOMContentLoaded',()=>{
  const pwdForm=document.getElementById('pwdForm');
  pwdForm?.addEventListener('submit',async e=>{e.preventDefault();const m=document.getElementById('pwdMsg'),btn=e.submitter||pwdForm.querySelector('button[type="submit"]');if(document.getElementById('newPwd').value!==document.getElementById('newPwd2').value){m.textContent='Les nouveaux mots de passe ne correspondent pas.';m.classList.remove('hidden');m.classList.add('error');return}await withButtonLock(btn,async()=>{try{const r=await api('/api/change-password',{method:'POST',body:{currentPassword:document.getElementById('oldPwd').value,newPassword:document.getElementById('newPwd').value}});m.textContent=r.message;m.classList.remove('hidden','error');setTimeout(()=>location.href='/',700)}catch(err){m.textContent=err.message;m.classList.add('error');m.classList.remove('hidden')}},'Modification…')});
  document.getElementById('addUserBtn')?.addEventListener('click',openCreateUser);
  document.querySelectorAll('[data-close-user]').forEach(b=>b.addEventListener('click',()=>document.getElementById('userDialog')?.close()));
  document.querySelectorAll('[data-close-permissions]').forEach(b=>b.addEventListener('click',()=>document.getElementById('permissionsDialog')?.close()));
  document.getElementById('uRole')?.addEventListener('change',e=>renderGrid('createPermissionsGrid',collectPermissions('createPermissionsGrid','MEMBER'),e.target.value));
  document.getElementById('permissionViewAll')?.addEventListener('click',()=>{document.querySelectorAll('#createPermissionsGrid [data-permission-view]').forEach(x=>x.checked=true)});
  document.getElementById('permissionClearAll')?.addEventListener('click',()=>{document.querySelectorAll('#createPermissionsGrid input[type="checkbox"]').forEach(x=>x.checked=false)});
  document.getElementById('userForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter,role=document.getElementById('uRole').value;await withButtonLock(btn,async()=>{try{await api('/api/users/create',{method:'POST',body:{displayName:document.getElementById('uName').value,username:document.getElementById('uUsername').value,email:document.getElementById('uEmail').value,phone:document.getElementById('uPhone').value,role,password:document.getElementById('uPassword').value,permissions:collectPermissions('createPermissionsGrid',role)}});document.getElementById('userDialog').close();showToast('Utilisateur créé avec ses droits d’accès.');await loadUsers()}catch(err){showToast(err.message,'error')}},'Création…')});
  document.getElementById('auditReloadBtn')?.addEventListener('click',e=>withButtonLock(e.currentTarget,loadAuditLogs,'Actualisation…'));
  ['auditActionFilter','auditFromFilter','auditToFilter'].forEach(id=>document.getElementById(id)?.addEventListener('change',loadAuditLogs));
  ['auditActorFilter','auditSearchFilter'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>{clearTimeout(window.__auditTimer);window.__auditTimer=setTimeout(loadAuditLogs,300)}));
  document.getElementById('permissionsForm')?.addEventListener('submit',async e=>{e.preventDefault();const btn=e.submitter,id=Number(document.getElementById('permissionsUserId').value),role=document.getElementById('permissionsUserRole').value;await withButtonLock(btn,async()=>{try{await api('/api/users/permissions',{method:'POST',body:{userId:id,permissions:collectPermissions('editPermissionsGrid',role)}});document.getElementById('permissionsDialog').close();showToast('Droits d’accès mis à jour.');await loadUsers()}catch(err){showToast(err.message,'error')}},'Enregistrement…')});
  document.querySelectorAll('[data-account-tab]').forEach(btn=>btn.addEventListener('click',()=>showAccountPanel(btn.dataset.accountTab)));
  window.addEventListener('hashchange',()=>{if(accountSession)showAccountPanel(accountTabFromHash(accountSession.user.role==='ORGANIZATION_ADMIN'),{updateHash:false})});
  document.querySelectorAll('[data-buy-plan]').forEach(a=>a.addEventListener('click',e=>{if(a.getAttribute('aria-disabled')==='true'){e.preventDefault();showToast('Achat verrouillé : votre abonnement actuel est encore valide.','error')}}));
  initAccount();
});
