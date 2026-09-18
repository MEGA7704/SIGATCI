import {api,esc,loadSession,showToast,professionalConfirm,professionalAlert} from './common.js';
const LABEL={PEF:'Poste des Eaux et Forêts',CANTONNEMENT:'Cantonnement',DIRECTION_REGIONALE:'Direction Régionale',DIRECTION_DEPARTEMENTALE:'Direction Départementale'};
let data=null;
async function load(){
  try{
    const s=await loadSession();
    if(s.user.role!=='ORGANIZATION_ADMIN'){location.href='/dashboard/';return}
    data=await api('/api/hierarchy-assignment');
    const o=data.organization;
    document.getElementById('currentOrg').value=`${LABEL[o.type]||o.type} — ${o.name} (${o.code})`;
    const notice=document.getElementById('hierarchyNotice');
    const sel=document.getElementById('parentSelect');
    const save=document.getElementById('saveParent');
    const remove=document.getElementById('removeParent');
    if(!data.expectedParentType){
      notice.innerHTML='<strong>Niveau supérieur :</strong> aucune structure supérieure n’est prévue pour une Direction Régionale dans la hiérarchie actuelle.';
      sel.innerHTML='<option value="">Aucun rattachement supérieur</option>';sel.disabled=true;save.disabled=true;remove.disabled=!o.parentId;
      document.getElementById('parentHelp').textContent='Votre structure constitue le niveau supérieur de la hiérarchie SIGAT actuelle.';
      return;
    }
    const expected=LABEL[data.expectedParentType]||data.expectedParentType;
    document.getElementById('parentSelectLabel').textContent=`${expected} de rattachement`;
    notice.innerHTML=o.parentId?`Rattachement actuel : <strong>${esc(o.parentName)}</strong> (${esc(o.parentCode||'')}).`:'<strong>Aucun rattachement n’est encore défini.</strong> Choisissez librement un service supérieur compatible dans la liste.';
    sel.innerHTML='<option value="">— Choisir un service supérieur —</option>'+data.options.map(x=>`<option value="${x.id}" ${Number(o.parentId)===Number(x.id)?'selected':''}>${esc(x.name)} — ${esc(x.code)}${x.locality?` — ${esc(x.locality)}`:''}</option>`).join('');
    document.getElementById('parentHelp').textContent=data.options.length?`Seules les structures actives de type ${expected} sont proposées.`:`Aucune structure active de type ${expected} n’est actuellement disponible. Vous pourrez revenir plus tard.`;
    save.disabled=!data.options.length;remove.disabled=!o.parentId;
  }catch(e){showToast(e.message,'error')}
}
async function save(parentId){
  try{
    await api('/api/hierarchy-assignment',{method:'POST',body:{parentId}});
    showToast(parentId?'Rattachement enregistré. Les informations remonteront automatiquement selon cette hiérarchie.':'Rattachement retiré.');
    await load();
  }catch(e){showToast(e.message,'error')}
}
document.getElementById('saveParent').onclick=()=>{const v=document.getElementById('parentSelect').value;if(!v){showToast('Sélectionnez un service supérieur.','error');return}save(Number(v))};
document.getElementById('removeParent').onclick=async()=>{const yes=await professionalConfirm('Retirer le rattachement','Les services supérieurs ne verront plus automatiquement vos nouvelles données via ce lien.',{confirmText:'Retirer'});if(yes) save(null)};
load();
