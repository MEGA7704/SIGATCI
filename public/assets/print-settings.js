import {api,esc,loadSession,withButtonLock,professionalAlert,professionalDialog} from './common.js';

let session=null;
const keys=['ministry','cabinet','regionalDirection','departmentalDirection','cantonment','post','structureName','locality','referencePrefix','republic','motto','signerTitle','signerName','signerPosition','emblemData','signatureData','stampData'];
const TYPE_LABEL={PEF:'Poste des Eaux et Forêts',CANTONNEMENT:'Cantonnement',DIRECTION_REGIONALE:'Direction Régionale',DIRECTION_DEPARTEMENTALE:'Direction Départementale'};

function navHTML(user){return `<div class="topbar"><div class="topbar-inner"><a class="logo" href="/dashboard/" style="text-decoration:none"><span class="logo-badge">SI</span><span><strong>SIGAT</strong><div class="org-chip">${esc(user.organizationName||'Structure SIGAT')}</div></span></a><nav class="nav"><a href="/dashboard/">Tableau de bord</a><a href="/parametres/">Paramètres</a></nav><div class="top-actions"><a class="btn btn-secondary btn-sm" href="/mon-compte/">Mon compte</a><button id="logoutBtn" class="btn btn-primary btn-sm">Déconnexion</button><div class="avatar">${esc((user.displayName||'U')[0]?.toUpperCase()||'U')}</div></div></div></div>`}

async function imageToDataUrl(file){
  if(!file)return '';
  if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw new Error('Utilisez une image JPG, PNG ou WEBP.');
  if(file.size>5*1024*1024)throw new Error('L’image ne doit pas dépasser 5 Mo.');
  const raw=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
  const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=raw});
  const max=640,ratio=Math.min(1,max/img.width,max/img.height),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*ratio));c.height=Math.max(1,Math.round(img.height*ratio));c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  return c.toDataURL('image/png');
}
function renderPreview(name){const input=document.querySelector(`[name="${name}"]`),box=document.querySelector(`[data-preview="${name}"]`);if(!box)return;const v=input?.value||'';box.innerHTML=v?`<img src="${esc(v)}" alt="Aperçu"><button type="button" class="btn btn-danger btn-sm" data-remove="${name}">Retirer</button>`:'<span class="muted">Aucune image enregistrée</span>';box.querySelector('[data-remove]')?.addEventListener('click',()=>{input.value='';renderPreview(name)})}
function bindImage(fileId,name){document.getElementById(fileId).addEventListener('change',async e=>{try{const f=e.target.files?.[0];if(!f)return;document.querySelector(`[name="${name}"]`).value=await imageToDataUrl(f);renderPreview(name)}catch(err){await professionalAlert('Image non importée',err.message);e.target.value=''}})}

async function boot(){
  try{session=await loadSession()}catch{return}
  if(session.user.role==='SUPER_ADMIN'){location.href='/superadmin/dashboard/';return}
  if(session.user.role!=='ORGANIZATION_ADMIN'){location.href='/parametres/';return}
  document.body.insertAdjacentHTML('afterbegin',navHTML(session.user));
  document.getElementById('logoutBtn').onclick=async()=>{try{await api('/api/logout',{method:'POST'})}catch{}sessionStorage.clear();location.href='/'};
  bindImage('emblemFile','emblemData');bindImage('signatureFile','signatureData');bindImage('stampFile','stampData');
  const d=await api('/api/print-settings');
  const form=document.getElementById('printSettingsForm');
  keys.forEach(k=>{const el=form.elements[k];if(el)el.value=d.settings?.[k]||''});
  ['emblemData','signatureData','stampData'].forEach(renderPreview);
  form.addEventListener('submit',save);
  document.getElementById('previewBtn').onclick=preview;
}
async function save(e){e.preventDefault();const btn=e.submitter;return withButtonLock(btn,async()=>{const form=e.currentTarget,settings={};keys.forEach(k=>settings[k]=String(form.elements[k]?.value||'').trim());try{await api('/api/print-settings',{method:'POST',body:{settings}});await professionalAlert('Paramètres enregistrés','L’en-tête et la signature seront désormais utilisés sur les impressions de votre structure.')}catch(err){await professionalAlert('Enregistrement impossible',err.message)}},'Enregistrement…')}
function preview(){const f=document.getElementById('printSettingsForm'),v=k=>f.elements[k]?.value||'';const left=[v('ministry'),v('cabinet'),v('regionalDirection'),v('departmentalDirection'),v('cantonment'),v('post')].filter(Boolean).map(x=>`<div style="margin:4px 0;font-weight:700">${esc(x)}</div><div style="font-size:10px;letter-spacing:3px">- - - - -</div>`).join('');const emblem=v('emblemData')?`<img src="${esc(v('emblemData'))}" style="max-width:75px;max-height:75px">`:'';const html=`<div class="print-settings-preview"><div>${left}</div><div style="text-align:center">${emblem}</div><div style="text-align:center"><strong>${esc(v('republic')||'REPUBLIQUE DE COTE D’IVOIRE')}</strong><br><em>${esc(v('motto')||'Union – Discipline – Travail')}</em></div></div><div style="margin-top:14px"><strong>N°____________${v('referencePrefix')?'/'+esc(v('referencePrefix')):''}</strong></div><div style="width:43%;margin:45px 3% 0 auto;text-align:center"><div>${esc(v('signerTitle')||'Le responsable de la structure')}</div><div style="height:50px"></div><strong style="text-decoration:underline">${esc(v('signerName')||'Nom du responsable')}</strong><div>${esc(v('signerPosition'))}</div></div>`;professionalDialog({title:'Aperçu de l’en-tête d’impression',html,confirmText:'Fermer'})}
document.addEventListener('DOMContentLoaded',boot);
