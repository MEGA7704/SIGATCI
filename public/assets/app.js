import {api,esc,fmtDate,loadSession,showToast,withButtonLock,professionalAlert,professionalConfirm,professionalDialog} from './common.js';
import {MODULE_CONFIG} from './module-config.js';
let session=null,currentPage=1,currentSearch='',lastItems=[],currentStageType='MISE_STAGE',editorStageType='MISE_STAGE',currentDocumentType='CESSATION_SERVICE',editorDocumentType='CESSATION_SERVICE',currentConvocationView='CONVOCATIONS',editorConvocationView='CONVOCATIONS',currentForestType='RECHERCHE_PARCELLAIRE',editorForestType='RECHERCHE_PARCELLAIRE',currentWoodType='EXPLOITANTS_SECONDAIRES',editorWoodType='EXPLOITANTS_SECONDAIRES',currentFireType='CREE',editorFireType='CREE',currentFaunaType='OBSERVATIONS',editorFaunaType='OBSERVATIONS',currentMissionType='DISPOSITION',editorMissionType='DISPOSITION',editorOffensePvRecord=null,pendingSmartSourceRecord=null;
const moduleKey=document.body.dataset.module||'';
const woodContext=document.body.dataset.woodContext||'transformation';
const config=MODULE_CONFIG[moduleKey];
function stageTypeOf(record){
  const t=String(record?.data?._stage_type||'').toUpperCase();
  return t==='MISE_STAGE'||t==='FIN_STAGE'?t:'FIN_STAGE';
}
function stageConfig(type=currentStageType){return config?.stageTypes?.[type]||null}
function documentTypeOf(record){
  const t=String(record?.data?._document_type||'').toUpperCase();
  if(['CESSATION_SERVICE','CESSATION_CONGE','REPRISE_SERVICE','PRISE_SERVICE_MUTATION','DEMANDE_EXPLICATION','ABSENCE'].includes(t))return t;
  const legacy=String(record?.data?.type||'').toUpperCase();
  if(legacy.includes('CESSATION'))return 'CESSATION_SERVICE';
  if(legacy.includes('REPRISE'))return 'REPRISE_SERVICE';
  return currentDocumentType;
}
function documentConfig(type=currentDocumentType){return config?.documentTypes?.[type]||null}
function forestTypeOf(record){const t=String(record?.data?._forest_type||'').toUpperCase();return ['RECHERCHE_PARCELLAIRE','PEPINIERE','PLANTATION_CREEE','REBOISEMENT'].includes(t)?t:'RECHERCHE_PARCELLAIRE'}
function forestConfig(type=currentForestType){return config?.exploitationTypes?.[type]||null}
function woodTypeOf(record){const t=String(record?.data?._wood_type||'').toUpperCase();return ['EXPLOITANTS_SECONDAIRES','PRODUITS_QTE','UNITES_BOIS'].includes(t)?t:'UNITES_BOIS'}
function woodConfig(type=currentWoodType){return config?.woodTypes?.[type]||null}
function fireTypeOf(record){const t=String(record?.data?._fire_type||'').toUpperCase();return ['REDYNAMISE','CREE','RENOUVELE','DEGATS'].includes(t)?t:'DEGATS'}
function fireConfig(type=currentFireType){return config?.fireTypes?.[type]||null}
function faunaTypeOf(record){const t=String(record?.data?._fauna_type||'').toUpperCase();return ['OBSERVATIONS','CONFLITS'].includes(t)?t:'OBSERVATIONS'}
function faunaConfig(type=currentFaunaType){return config?.faunaTypes?.[type]||null}
function missionTypeOf(record){const t=String(record?.data?._mission_type||record?.data?._offense_type||'').toUpperCase();return ['DISPOSITION','REALISEE','REPRESSION','PV_INFRACTION'].includes(t)?t:'REALISEE'}
function missionConfig(type=currentMissionType){return config?.missionTypes?.[type]||null}
function normalizeWoodText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()}
function woodVisibleFields(type=currentWoodType,data={}){
  const fields=(woodConfig(type)?.fields||[]).filter(([, , fieldType])=>fieldType!=='section');
  if(type!=='UNITES_BOIS')return fields;
  const exercant=normalizeWoodText(data?.type_exercant);
  const isUnit=exercant==='unites de transformation'||!exercant;
  const unitKeys=new Set(['type_exercant','region','departement','localite','nom_usine','activites_principales','nom_operateur','contact_operateur','coord_x','coord_y']);
  const otherKeys=new Set(['type_exercant','service_rattachement','localite','nom_operateur','contact_operateur','coord_x','coord_y','numero_permis','date_delivrance']);
  return fields.filter(([key])=>(isUnit?unitKeys:otherKeys).has(key));
}
function effectiveModule(type=null){
  if(moduleKey==='documents')return documentConfig(type||currentDocumentType)?.backendModule||'documents';
  if(moduleKey==='convocations'&&currentConvocationView==='PV')return 'convocation_pv';
  if(moduleKey==='missions'){
    const t=String(type||currentMissionType).toUpperCase();
    if(t==='REPRESSION')return 'infractions';
    if(t==='PV_INFRACTION')return 'offense_pv';
    return 'missions';
  }
  return moduleKey;
}
function activeFields(record=null){
  if(moduleKey==='stages')return stageConfig(record?stageTypeOf(record):editorStageType)?.fields||[];
  if(moduleKey==='documents')return documentConfig(record?documentTypeOf(record):editorDocumentType)?.fields||[];
  if(moduleKey==='convocations'&&editorConvocationView==='PV')return config?.pvFields||[];
  if(moduleKey==='exploitation-forestiere')return forestConfig(record?forestTypeOf(record):editorForestType)?.fields||[];
  if(moduleKey==='transformation-bois')return woodConfig(record?woodTypeOf(record):editorWoodType)?.fields||[];
  if(moduleKey==='feux-brousse')return fireConfig(record?fireTypeOf(record):editorFireType)?.fields||[];
  if(moduleKey==='faune')return faunaConfig(record?faunaTypeOf(record):editorFaunaType)?.fields||[];
  if(moduleKey==='missions'){
    const t=record?missionTypeOf(record):editorMissionType;
    return t==='PV_INFRACTION'?(config?.offensePvFields||[]):(missionConfig(t)?.fields||[]);
  }
  return config?.fields||[];
}
function activeSingular(record=null){
  if(moduleKey==='stages')return stageConfig(record?stageTypeOf(record):editorStageType)?.singular||'Stage';
  if(moduleKey==='documents')return documentConfig(record?documentTypeOf(record):editorDocumentType)?.singular||'Document administratif';
  if(moduleKey==='convocations'&&editorConvocationView==='PV')return config?.pvSingular||'Procès-verbal de rencontre';
  if(moduleKey==='exploitation-forestiere')return forestConfig(record?forestTypeOf(record):editorForestType)?.singular||'Enregistrement forestier';
  if(moduleKey==='transformation-bois')return woodConfig(record?woodTypeOf(record):editorWoodType)?.singular||'Enregistrement';
  if(moduleKey==='feux-brousse')return fireConfig(record?fireTypeOf(record):editorFireType)?.singular||'Enregistrement feux de brousse';
  if(moduleKey==='faune')return faunaConfig(record?faunaTypeOf(record):editorFaunaType)?.singular||'Enregistrement faune';
  if(moduleKey==='missions'){
    const t=record?missionTypeOf(record):editorMissionType;
    return t==='PV_INFRACTION'?'Procès-verbal d’infraction':(missionConfig(t)?.singular||'Mission');
  }
  return config?.singular||'Document';
}


/* V1.28 — Préremplissage intelligent transversal.
   Les liaisons ci-dessous réutilisent uniquement les données de la structure connectée.
   Les valeurs injectées restent toujours modifiables par l'utilisateur. */
const SMART_AUTOFILL={
  documents:{
    CESSATION_SERVICE:{sourceModule:'personnel',label:'Agent concerné',help:"Sélectionnez un agent pour reprendre automatiquement son identité et sa situation administrative. Tous les champs restent modifiables.",copyTitle:true,map:{grade_appellation:'data.grade',matricule:'data.matricule',emploi:'data.emploi',classe:'data.classe',echelon:'data.echelon',ancien_service:'$source_organization'}},
    CESSATION_CONGE:{sourceModule:'personnel',label:'Agent concerné',help:"Sélectionnez un agent pour reprendre automatiquement son identité et sa situation administrative. Les informations du congé restent à compléter et tous les champs sont modifiables.",copyTitle:true,map:{grade_appellation:'data.grade',matricule:'data.matricule',emploi:'data.emploi',classe:'data.classe',echelon:'data.echelon'}},
    REPRISE_SERVICE:{sourceModule:'documents',sourceDocumentType:'CESSATION_CONGE',label:'Cessation de service / congé existante',help:"Sélectionnez une cessation de service / congé déjà enregistrée : SIGAT reprend automatiquement l’agent, la période, la décision et la date prévue de reprise. Tous les champs restent modifiables.",copyTitle:true,map:{grade_appellation:'data.grade_appellation',matricule:'data.matricule',emploi:'data.emploi',option_emploi:'data.option_emploi',classe:'data.classe',echelon:'data.echelon',service_reprise:'$source_organization',date_cessation:'data.date_cessation',certificat_cessation_numero:'$reference',certificat_cessation_date:'$event_date',certificat_cessation_origine:'$source_responsible',duree_conge_jours:'data.duree_conge_jours',type_conge:'data.type_conge',decision_numero:'data.decision_numero',decision_date:'data.decision_date',decision_autorite:'data.decision_autorite',date_reprise:'data.date_reprise_prevue',heure_reprise:'data.heure_reprise_prevue'}},
    PRISE_SERVICE_MUTATION:{sourceModule:'documents',sourceDocumentType:'CESSATION_SERVICE',label:'Cessation de service / mutation existante',help:"Sélectionnez une cessation de service / mutation déjà enregistrée pour reprendre automatiquement l’identité de l’agent, l’ancienne affectation et la décision de mutation. Tous les champs restent modifiables.",copyTitle:true,map:{grade_appellation:'data.grade_appellation',matricule:'data.matricule',emploi:'data.emploi',option_emploi:'data.option_emploi',classe:'data.classe',echelon:'data.echelon',ancien_service:'data.ancien_service',nouvelle_affectation:'data.nouvelle_affectation',decision_numero:'data.decision_numero',decision_date:'data.decision_date',decision_objet:'data.decision_objet'}},
    DEMANDE_EXPLICATION:{sourceModule:'personnel',label:'Agent concerné',help:"Sélectionnez un agent pour reprendre automatiquement son nom, son matricule, son emploi / qualité et son service. Tous les champs restent modifiables pour cette demande.",copyTitle:true,map:{matricule:'data.matricule',emploi_qualite:'data.emploi',service_affectation:'$source_organization'}},
    ABSENCE:{sourceModule:'personnel',label:'Agent existant',help:"Sélectionnez un agent pour reprendre automatiquement son nom, son matricule, son emploi et son grade.",copyTitle:true,map:{grade:'data.grade',matricule:'data.matricule',emploi:'data.emploi'}}
  },
  absences:{sourceModule:'personnel',label:'Agent existant',help:"Sélectionnez un agent pour reprendre automatiquement son nom, son matricule, son emploi et son grade.",copyTitle:true,map:{grade:'data.grade',matricule:'data.matricule',emploi:'data.emploi'}},
  convocations:{
    CONVOCATIONS:{sourceModule:'personnel',label:'Personne déjà enregistrée dans le personnel',help:"Le nom et la profession sont proposés automatiquement, puis restent modifiables.",copyTitle:true,map:{profession:'data.emploi'}},
    PV:{sourceModule:'convocations',label:'Convocation à l’origine de la rencontre',help:"Sélectionnez la convocation concernée : la personne, la date, l’heure, l’objet et le responsable sont préremplis. Tous les champs restent modifiables.",copyTitle:true,map:{convocation_reference:'$reference',profession:'data.profession',domicile:'data.domicile',date_rencontre:'data.date_presentation',heure_debut:'data.heure',objet_rencontre:'data.objet_convocation',personne_a_voir:'data.personne_a_voir'},sourceIdKey:'_source_convocation_id'}
  },
  missions:{sourceModule:'personnel',label:'Chef de mission',help:"Choisissez un agent pour renseigner le chef de mission. Le champ reste modifiable.",map:{chef_mission:'$title'}},
  controles:{sourceModule:'personnel',label:"Agent / chef d’équipe",help:"Choisissez un agent pour initialiser l’équipe. Vous pouvez ensuite compléter ou modifier librement.",map:{equipe:'$title'}},
  formations:{sourceModule:'personnel',label:'Participant à ajouter',help:"Choisissez un agent pour initialiser la liste des participants. Le contenu reste modifiable.",map:{participants:'$title'}},
  materiel:{sourceModule:'personnel',label:'Responsable du matériel',help:"Choisissez un agent pour renseigner le responsable. Le champ reste modifiable.",map:{responsable:'$title'}},
  sensibilisations:{sourceModule:'personnel',label:'Agent en charge',help:"Choisissez un agent pour renseigner automatiquement l’agent en charge de la sensibilisation. Le champ reste modifiable.",map:{agent_charge:'$title'}},
  saisies:{sourceModule:'infractions',label:'Dossier d’infraction lié',help:"Sélectionnez une infraction existante pour reprendre sa référence dans le dossier de saisie.",map:{dossier:'$reference'}},
  stages:{
    FIN_STAGE:{sourceModule:'stages',sourceStageType:'MISE_STAGE',ongoingOnly:true,label:'Stage en cours à clôturer',help:"SIGAT présente les stages en cours de votre structure. La sélection préremplit l’attestation de fin de stage ; tous les champs restent modifiables.",copyTitle:true,map:{qualite_stagiaire:'data.qualite_stagiaire',matricule_stagiaire:'data.matricule_stagiaire',date_debut:'data.date_debut',date_fin:'data.date_fin',lettre_mise_stage_numero:'data.note_service_numero',lettre_mise_stage_date:'data.note_service_date'},sourceIdKey:'_source_stage_id'}
  }
};

function smartProfile(){
  const entry=SMART_AUTOFILL[moduleKey];
  if(!entry)return null;
  if(moduleKey==='stages')return entry[editorStageType]||null;
  if(moduleKey==='documents')return entry[editorDocumentType]||null;
  if(moduleKey==='convocations')return entry[editorConvocationView]||null;
  return entry;
}
function ownLoadUrl(module,{stageType='',documentType='',limit=100}={}){
  const q=new URLSearchParams({module,page:'1',limit:String(limit),search:'',ownedOnly:'1'});
  if(stageType)q.set('stageType',stageType);
  if(documentType)q.set('documentType',documentType);
  return `/api/load?${q.toString()}`;
}
function smartStageKey(r){
  const data=r?.data||{};
  const matricule=String(data.matricule_stagiaire||'').trim().toLowerCase().replace(/\s+/g,'');
  if(matricule)return `m:${matricule}`;
  return `n:${String(r?.title||'').trim().toLowerCase()}|${String(data.date_debut||'').slice(0,10)}`;
}
async function loadSmartCandidates(profile,record=null){
  if(profile.sourceModule==='convocations'&&moduleKey==='convocations'&&editorConvocationView==='PV'){
    const [convResp,pvResp]=await Promise.all([
      api(ownLoadUrl('convocations',{limit:100})),
      api(ownLoadUrl('convocation_pv',{limit:100}))
    ]);
    const currentPvId=Number(record?.id||0);
    const currentSourceId=Number(record?.data?._source_convocation_id||0);
    const used=new Set((pvResp.items||[]).filter(x=>Number(x.id)!==currentPvId&&String(x.status||'').toUpperCase()!=='ANNULÉ').map(x=>Number(x.data?._source_convocation_id||0)).filter(Boolean));
    return (convResp.items||[]).filter(x=>Number(x.id)===currentSourceId||!used.has(Number(x.id)));
  }
  if(profile.ongoingOnly&&profile.sourceModule==='stages'){
    const [startsResp,endsResp]=await Promise.all([
      api(ownLoadUrl('stages',{stageType:'MISE_STAGE'})),
      api(ownLoadUrl('stages',{stageType:'FIN_STAGE'}))
    ]);
    const currentId=Number(record?.id||0);
    const currentSourceId=Number(record?.data?._source_stage_id||0);
    const finals=(endsResp.items||[]).filter(r=>Number(r.id)!==currentId&&String(r.status||'').toUpperCase()!=='ANNULÉE');
    const endedIds=new Set(finals.map(r=>Number(r.data?._source_stage_id||0)).filter(Boolean));
    const endedKeys=new Set(finals.map(smartStageKey));
    return (startsResp.items||[]).filter(r=>{
      const status=String(r.status||'').toUpperCase();
      if(Number(r.id)===currentSourceId)return true;
      if(['ANNULÉE','ARCHIVED','TERMINÉ'].includes(status))return false;
      if(endedIds.has(Number(r.id)))return false;
      return !endedKeys.has(smartStageKey(r));
    });
  }
  const resp=await api(ownLoadUrl(profile.sourceModule,{stageType:profile.sourceStageType||'',documentType:profile.sourceDocumentType||''}));
  return resp.items||[];
}
function smartCandidateLabel(profile,r){
  if(profile.sourceModule==='stages'){
    const d=r.data||{};
    const parts=[r.title,d.matricule_stagiaire,d.date_debut&&d.date_fin?`${fmtDate(d.date_debut)} → ${fmtDate(d.date_fin)}`:d.date_debut?fmtDate(d.date_debut):''].filter(Boolean);
    return parts.join(' — ');
  }
  if(profile.sourceModule==='personnel'){
    const d=r.data||{};return [r.title,d.matricule,d.fonction||d.emploi].filter(Boolean).join(' — ');
  }
  if(profile.sourceModule==='documents')return [r.title,r.reference,r.event_date?fmtDate(r.event_date):''].filter(Boolean).join(' — ');
  if(profile.sourceModule==='convocations'){const d=r.data||{};return [r.title,r.reference,d.date_presentation?fmtDate(d.date_presentation):'',d.objet_convocation].filter(Boolean).join(' — ')}
  return [r.reference,r.title].filter(Boolean).join(' — ');
}
function smartGet(r,path){
  if(path==='$title')return r?.title??'';
  if(path==='$reference')return r?.reference??'';
  if(path==='$event_date')return String(r?.event_date||'').slice(0,10);
  if(path==='$source_organization')return r?.source_organization??session?.user?.organizationName??'';
  if(path==='$source_responsible')return stageResponsibleIntro(r);
  if(path.startsWith('data.'))return r?.data?.[path.slice(5)]??'';
  return '';
}
function setEditorDataValue(key,value,{append=false}={}){
  const el=document.querySelector(`#dynamicFields [data-key="${CSS.escape(key)}"]`);
  if(!el)return;
  const next=String(value??'');
  if(append&&el.value&&next&&!el.value.split(/\n|,/).map(x=>x.trim().toLowerCase()).includes(next.trim().toLowerCase())) el.value=`${el.value.trim()}\n${next}`;
  else if(!append||!el.value) el.value=next;
  el.dispatchEvent(new Event('change',{bubbles:true}));
}
function applySmartCandidate(profile,r){
  if(!r)return;
  if(profile.copyTitle)document.getElementById('recordTitle').value=r.title||'';
  for(const [target,source] of Object.entries(profile.map||{})){
    const append=['participants','equipe'].includes(target);
    setEditorDataValue(target,smartGet(r,source),{append});
  }
  const sourceKey=profile.sourceIdKey||'_smart_source_id';
  const hidden=document.querySelector(`#dynamicFields [data-key="${CSS.escape(sourceKey)}"]`);
  if(hidden)hidden.value=String(r.id||'');
  const sourceModule=document.querySelector('#dynamicFields [data-key="_smart_source_module"]');
  if(sourceModule)sourceModule.value=profile.sourceModule||'';
  showToast('Champs préremplis. Vous pouvez les modifier avant l’enregistrement.');
}
async function mountSmartAutofill(record=null){
  const profile=smartProfile();
  const area=document.getElementById('dynamicFields');
  if(!area)return;
  const info=document.createElement('div');
  info.className='field full smart-system-note';
  info.innerHTML='<div class="smart-note"><strong>Assistance intelligente SIGAT</strong><span>Les données déjà enregistrées sont réutilisées lorsqu’un rapprochement est possible. Les champs préremplis restent toujours modifiables.</span></div>';
  area.prepend(info);
  if(!profile)return;
  const wrap=document.createElement('div');wrap.className='field full smart-autofill-field';
  const label=document.createElement('label');label.textContent=profile.label||'Préremplissage intelligent';
  const select=document.createElement('select');select.className='smart-source-select';select.disabled=true;
  select.innerHTML='<option value="">Chargement des données…</option>';
  const help=document.createElement('small');help.className='smart-help';help.textContent=profile.help||'';
  const sourceId=document.createElement('input');sourceId.type='hidden';sourceId.dataset.key=profile.sourceIdKey||'_smart_source_id';sourceId.value=record?.data?.[profile.sourceIdKey||'_smart_source_id']||'';
  const sourceModule=document.createElement('input');sourceModule.type='hidden';sourceModule.dataset.key='_smart_source_module';sourceModule.value=profile.sourceModule||'';
  wrap.append(label,select,help,sourceId,sourceModule);info.after(wrap);
  try{
    const candidates=await loadSmartCandidates(profile,record);
    select.innerHTML='<option value="">— Saisie manuelle / ne pas préremplir —</option>';
    for(const r of candidates){const op=document.createElement('option');op.value=String(r.id);op.textContent=smartCandidateLabel(profile,r);select.appendChild(op)}
    const current=String(sourceId.value||'');if(current&&candidates.some(r=>String(r.id)===current))select.value=current;
    select.disabled=false;
    if(!candidates.length){help.textContent=`${profile.help||''} Aucun enregistrement correspondant n’est actuellement disponible.`.trim()}
    select.addEventListener('change',()=>{
      const selected=candidates.find(r=>String(r.id)===select.value);
      if(!selected){sourceId.value='';return}
      applySmartCandidate(profile,selected);
    });
    if(pendingSmartSourceRecord){
      const wanted=candidates.find(r=>String(r.id)===String(pendingSmartSourceRecord.id));
      if(wanted){select.value=String(wanted.id);applySmartCandidate(profile,wanted)}
      pendingSmartSourceRecord=null;
    }
  }catch(err){select.innerHTML='<option value="">Préremplissage indisponible — saisie manuelle possible</option>';help.textContent=err.message||'Impossible de charger les données existantes.'}
}

async function mountHistorySuggestions(record=null){
  try{
    const stageType=moduleKey==='stages'?editorStageType:'';
    const historyModule=moduleKey==='documents'?effectiveModule(editorDocumentType):(moduleKey==='convocations'&&editorConvocationView==='PV'?'convocation_pv':moduleKey);
    const documentType=moduleKey==='documents'&&historyModule==='documents'?editorDocumentType:'';
    const resp=await api(ownLoadUrl(historyModule,{stageType,documentType}));
    const items=(resp.items||[]).filter(r=>Number(r.id)!==Number(record?.id||0));
    const title=document.getElementById('recordTitle');
    if(title&&items.length){
      const id=`smart-title-${moduleKey}`;let dl=document.getElementById(id);if(dl)dl.remove();dl=document.createElement('datalist');dl.id=id;
      [...new Set(items.map(r=>String(r.title||'').trim()).filter(Boolean))].slice(0,80).forEach(v=>{const o=document.createElement('option');o.value=v;dl.appendChild(o)});
      document.body.appendChild(dl);title.setAttribute('list',id);
    }
    for(const el of document.querySelectorAll('#dynamicFields input[data-key][type="text"]')){
      if(String(el.dataset.key||'').startsWith('_'))continue;
      const key=el.dataset.key,values=[...new Set(items.map(r=>String(r.data?.[key]??'').trim()).filter(Boolean))].slice(0,80);
      if(!values.length)continue;
      const id=`smart-${moduleKey}-${key}`;let dl=document.getElementById(id);if(dl)dl.remove();dl=document.createElement('datalist');dl.id=id;values.forEach(v=>{const o=document.createElement('option');o.value=v;dl.appendChild(o)});document.body.appendChild(dl);el.setAttribute('list',id);
    }
  }catch{/* Les suggestions sont une aide : la saisie manuelle reste disponible. */}
}

const TYPE_LABEL={PEF:'Poste des Eaux et Forêts',CANTONNEMENT:'Cantonnement',DIRECTION_REGIONALE:'Direction Régionale',DIRECTION_DEPARTEMENTALE:'Direction Départementale'};
const CHILD_LABEL={CANTONNEMENT:'Mes PEF',DIRECTION_DEPARTEMENTALE:'Mes Cantonnements',DIRECTION_REGIONALE:'Mes Directions Départementales'};
function withScope(path){const q=new URLSearchParams(location.search).get('scopeOrg');return q?`${path}?scopeOrg=${encodeURIComponent(q)}`:path;}
function navHTML(user){
  const childLink=CHILD_LABEL[user.organizationType]?`<a href="${withScope('/structures-rattachees/')}">${CHILD_LABEL[user.organizationType]}</a>`:'';
  const userAdminLink=user.role==='ORGANIZATION_ADMIN'?'<a href="/utilisateurs/">Utilisateurs</a>':'';
  const A=p=>withScope(p);
  return `<div class="topbar"><div class="topbar-inner"><a class="logo" href="${A('/dashboard/')}" style="text-decoration:none"><img class="sigat-logo-nav" src="/assets/sigat-logo.png" alt="Logo SIGAT"><span><strong>SIGAT</strong><div class="org-chip" id="orgName">${esc(user.organizationName||'Structure SIGAT')}</div></span></a><button class="mobile-menu-btn" id="mobileMenuBtn" type="button" aria-expanded="false" aria-controls="mainNav"><span aria-hidden="true">☰</span><span>Menu</span></button><nav class="nav" id="mainNav"><a href="${A('/dashboard/')}">Tableau de bord</a>${childLink}<div class="nav-group"><button type="button">Administration ▾</button><div class="dropdown"><a href="${A('/personnel/')}">Personnel</a><a href="${A('/documents/')}">Documents administratifs</a><a href="${A('/stages/')}">Stages</a><a href="${A('/convocations/')}">Convocations</a>${userAdminLink}</div></div><div class="nav-group"><button type="button">Activités techniques ▾</button><div class="dropdown"><a href="${A('/activites-minef/')}">Activités du MINEF</a><a href="${A('/missions/')}">Missions</a><a href="${A('/controles/')}">Contrôles</a><a href="${A('/infractions/')}">Infractions</a><a href="${A('/saisies/')}">Saisies</a><a href="${A('/exploitation-forestiere/')}">Exploitation forestière</a><a href="${A('/produits-secondaires/')}">Produits secondaires</a><a href="${A('/transformation-bois/')}">Transformation du bois</a><a href="${A('/sensibilisations/')}">Sensibilisations</a></div></div><div class="nav-group"><button type="button">Environnement ▾</button><div class="dropdown"><a href="${A('/reboisement/')}">Reboisement</a><a href="${A('/ressources-naturelles/')}">Ressources naturelles</a><a href="${A('/feux-brousse/')}">Feux de brousse</a><a href="${A('/faune/')}">Faune</a></div></div><div class="nav-group"><button type="button">Gestion ▾</button><div class="dropdown"><a href="${A('/formations/')}">Formations</a><a href="${A('/materiel/')}">Matériel</a><a href="${A('/finances/')}">Finances</a><a href="${A('/rapports/')}">Rapports</a><a href="${A('/archives/')}">Archives</a></div></div><a href="/parametres/">Paramètres</a></nav><div class="top-actions"><a class="btn btn-secondary btn-sm" href="/mon-compte/">Mon compte</a><button id="logoutBtn" class="btn btn-primary btn-sm">Déconnexion</button><div class="avatar" id="avatar">U</div></div></div></div>`
}

function bindResponsiveNav(){
  const toggle=document.getElementById('mobileMenuBtn');
  const nav=document.getElementById('mainNav');
  if(!toggle||!nav)return;
  const close=()=>{nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false');nav.querySelectorAll('.nav-group.is-open').forEach(g=>g.classList.remove('is-open'))};
  toggle.addEventListener('click',()=>{const open=!nav.classList.contains('is-open');nav.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',open?'true':'false')});
  nav.querySelectorAll('.nav-group>button').forEach(btn=>btn.addEventListener('click',e=>{if(matchMedia('(max-width:1100px)').matches){e.preventDefault();const group=btn.closest('.nav-group');const willOpen=!group.classList.contains('is-open');nav.querySelectorAll('.nav-group.is-open').forEach(g=>g!==group&&g.classList.remove('is-open'));group.classList.toggle('is-open',willOpen)}}));
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',close));
  addEventListener('resize',()=>{if(innerWidth>1100)close()});
}


async function boot(){
  try{session=await loadSession()}catch{return}
  if(session.user.role==='SUPER_ADMIN'){location.href='/superadmin/dashboard/';return}
  document.body.insertAdjacentHTML('afterbegin',navHTML(session.user));
  bindResponsiveNav();
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

function bindCommonModuleControls(){
  document.getElementById('searchInput').addEventListener('input',e=>{clearTimeout(window.__s);window.__s=setTimeout(()=>{currentSearch=e.target.value;currentPage=1;loadRecords()},300)});
  document.getElementById('recordForm').addEventListener('submit',saveRecord);
  document.querySelectorAll('[data-close-editor]').forEach(b=>b.onclick=()=>document.getElementById('editorDialog').close());
  document.getElementById('prevBtn').onclick=()=>{if(currentPage>1){currentPage--;loadRecords()}};
  document.getElementById('nextBtn').onclick=()=>{currentPage++;loadRecords()};
}

function setupStageModule(){
  document.getElementById('pageTitle').textContent=config.title;
  document.getElementById('pageSubtitle').textContent=config.subtitle;
  bindCommonModuleControls();
  const printBtn=document.getElementById('printListBtn');
  if(printBtn)printBtn.onclick=e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…');
  document.querySelectorAll('[data-stage-tab]').forEach(btn=>btn.addEventListener('click',()=>setStageView(btn.dataset.stageTab)));
  setStageView('MISE_STAGE');
}

function setStageView(type){
  if(!['MISE_STAGE','FIN_STAGE'].includes(type))type='MISE_STAGE';
  currentStageType=type;editorStageType=type;currentPage=1;
  document.querySelectorAll('[data-stage-tab]').forEach(btn=>{const on=btn.dataset.stageTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const cfg=stageConfig(type)||{};
  const title=document.getElementById('stageViewTitle');if(title)title.textContent=cfg.label||'Stages';
  const sub=document.getElementById('stageViewSubtitle');if(sub)sub.textContent=type==='MISE_STAGE'?'Enregistrement et édition des attestations de mise en stage.':'Enregistrement et édition des attestations de fin de stage.';
  const addBtn=document.getElementById('addBtn');
  if(addBtn){addBtn.textContent=cfg.addLabel||'Ajouter';addBtn.onclick=()=>openEditor(null,type)}
  loadRecords();
}

function setupDocumentsModule(){
  document.getElementById('pageTitle').textContent=config.title;
  document.getElementById('pageSubtitle').textContent=config.subtitle;
  bindCommonModuleControls();
  const printBtn=document.getElementById('printListBtn');
  if(printBtn)printBtn.onclick=e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…');
  document.querySelectorAll('[data-document-tab]').forEach(btn=>btn.addEventListener('click',()=>setDocumentView(btn.dataset.documentTab)));
  const requested=String(new URLSearchParams(location.search).get('view')||'').toUpperCase();
  setDocumentView(['CESSATION_SERVICE','CESSATION_CONGE','REPRISE_SERVICE','PRISE_SERVICE_MUTATION','DEMANDE_EXPLICATION','ABSENCE'].includes(requested)?requested:'CESSATION_SERVICE');
}

function setDocumentView(type){
  if(!['CESSATION_SERVICE','CESSATION_CONGE','REPRISE_SERVICE','PRISE_SERVICE_MUTATION','DEMANDE_EXPLICATION','ABSENCE'].includes(type))type='CESSATION_SERVICE';
  currentDocumentType=type;editorDocumentType=type;currentPage=1;
  document.querySelectorAll('[data-document-tab]').forEach(btn=>{const on=btn.dataset.documentTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const cfg=documentConfig(type)||{};
  const title=document.getElementById('documentViewTitle');if(title)title.textContent=cfg.label||'Documents administratifs';
  const sub=document.getElementById('documentViewSubtitle');
  if(sub)sub.textContent=type==='CESSATION_SERVICE'?'Rédaction et gestion des certificats de cessation de service liés aux mutations.':type==='CESSATION_CONGE'?'Rédaction et gestion des certificats de cessation de service pour congé.':type==='REPRISE_SERVICE'?'Rédaction et gestion des certificats de reprise de service après congé.':type==='PRISE_SERVICE_MUTATION'?'Rédaction et gestion des certificats de prise de service après mutation.':type==='DEMANDE_EXPLICATION'?"Rédaction, impression et suivi des demandes d’explication écrite adressées aux agents.":"Rédaction, édition PDF et gestion des autorisations d’absence.";
  const addBtn=document.getElementById('addBtn');
  if(addBtn){addBtn.textContent=cfg.addLabel||'Ajouter';addBtn.onclick=()=>openEditor(null,null,type)}
  const url=new URL(location.href);url.searchParams.set('view',type);history.replaceState(null,'',url.pathname+url.search);
  loadRecords();
}


function setupForestModule(){
  document.getElementById('pageTitle').textContent=config.title;
  document.getElementById('pageSubtitle').textContent=config.subtitle;
  bindCommonModuleControls();
  const printBtn=document.getElementById('printListBtn');
  if(printBtn)printBtn.onclick=e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…');
  document.querySelectorAll('[data-forest-tab]').forEach(btn=>btn.addEventListener('click',()=>setForestView(btn.dataset.forestTab)));
  bindForestFilters();
  const requested=String(new URLSearchParams(location.search).get('view')||'').toUpperCase();
  setForestView(['RECHERCHE_PARCELLAIRE','PEPINIERE','PLANTATION_CREEE','REBOISEMENT'].includes(requested)?requested:'RECHERCHE_PARCELLAIRE');
}

function setForestView(type){
  if(!['RECHERCHE_PARCELLAIRE','PEPINIERE','PLANTATION_CREEE','REBOISEMENT'].includes(type))type='RECHERCHE_PARCELLAIRE';
  currentForestType=type;editorForestType=type;currentPage=1;
  document.querySelectorAll('[data-forest-tab]').forEach(btn=>{const on=btn.dataset.forestTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const cfg=forestConfig(type)||{};
  const title=document.getElementById('forestViewTitle');if(title)title.textContent=cfg.label||'Exploitation forestière';
  const sub=document.getElementById('forestViewSubtitle');if(sub)sub.textContent=type==='RECHERCHE_PARCELLAIRE'?'Localisation et suivi des parcelles forestières.':type==='PEPINIERE'?'Production, distribution et disponibilité des plants en pépinière.':type==='PLANTATION_CREEE'?'Enregistrement des plantations forestières créées.':'Suivi des reboisements particuliers, agroforestiers, antérieurs et compensatoires.';
  const addBtn=document.getElementById('addBtn');if(addBtn){addBtn.textContent=cfg.addLabel||'Ajouter';addBtn.onclick=()=>openEditor(null,null,null,null,type)}
  updateForestTableHead(type);updateForestFilterVisibility(type);
  const url=new URL(location.href);url.searchParams.set('view',type);history.replaceState(null,'',url.pathname+url.search);
  loadRecords();
}

function updateForestTableHead(type){
  const head=document.getElementById('forestTableHead');if(!head)return;
  const map={
    RECHERCHE_PARCELLAIRE:['Date','Sous-préfecture','Localité','Essence','Superficie (ha)','Coordonnées X / Y','Contact propriétaire','Actions'],
    PEPINIERE:['Date','Localisation','Sous-préfecture','Essence','Plants produits','Plants distribués','Plants disponibles','Contact responsable','Actions'],
    PLANTATION_CREEE:['Date','Localité','Bénéficiaire','Superficie (ha)','Essence','Densité','Total plants','Coordonnées X / Y','Actions'],
    REBOISEMENT:['Date','Type','Localité','Bénéficiaire','Superficie (ha)','Essence','Total plants','Entreprise responsable','Actions']
  };
  head.innerHTML='<tr>'+map[type].map(v=>`<th>${esc(v)}</th>`).join('')+'</tr>';
}

function bindForestFilters(){
  const ids=['forestYearFilter','forestDateFilter','forestSousPrefFilter','forestLocaliteFilter','forestEssenceFilter','forestReboisementTypeFilter'];
  ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;const ev=el.tagName==='INPUT'&&el.type==='text'?'input':'change';el.addEventListener(ev,()=>{clearTimeout(window.__forestFilterTimer);window.__forestFilterTimer=setTimeout(()=>{currentPage=1;loadRecords()},220)})});
  document.getElementById('forestResetFilters')?.addEventListener('click',()=>{ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});currentSearch='';const q=document.getElementById('searchInput');if(q)q.value='';currentPage=1;loadRecords()});
}
function updateForestFilterVisibility(type){
  const set=(id,on)=>{const el=document.getElementById(id);if(el){el.hidden=!on;if(!on)el.value=''}};
  set('forestSousPrefFilter',type==='RECHERCHE_PARCELLAIRE'||type==='PEPINIERE');
  set('forestLocaliteFilter',type!=='PEPINIERE');
  set('forestEssenceFilter',true);
  set('forestReboisementTypeFilter',type==='REBOISEMENT');
}


function woodAllowedTypes(){
  return woodContext==='produits-secondaires'?['EXPLOITANTS_SECONDAIRES','PRODUITS_QTE']:['UNITES_BOIS'];
}
function woodDefaultType(){return woodContext==='produits-secondaires'?'EXPLOITANTS_SECONDAIRES':'UNITES_BOIS'}

function setupWoodModule(){
  const isSecondary=woodContext==='produits-secondaires';
  document.getElementById('pageTitle').textContent=isSecondary?'Produits secondaires':'Transformation du bois';
  document.getElementById('pageSubtitle').textContent=isSecondary?'Exploitants et productions des produits secondaires.':'Unités de transformation du bois, déligneuses, menuiseries et dépôts-ventes.';
  bindCommonModuleControls();
  const printBtn=document.getElementById('printListBtn');
  if(printBtn)printBtn.onclick=e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…');
  document.querySelectorAll('[data-wood-tab]').forEach(btn=>btn.addEventListener('click',()=>setWoodView(btn.dataset.woodTab)));
  bindWoodFilters();
  const requested=String(new URLSearchParams(location.search).get('view')||'').toUpperCase();
  const allowed=woodAllowedTypes();
  setWoodView(allowed.includes(requested)?requested:woodDefaultType());
}

function setWoodView(type){
  const allowed=woodAllowedTypes();
  if(!allowed.includes(type))type=woodDefaultType();
  currentWoodType=type;editorWoodType=type;currentPage=1;
  document.querySelectorAll('[data-wood-tab]').forEach(btn=>{const on=btn.dataset.woodTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const cfg=woodConfig(type)||{};
  const title=document.getElementById('woodViewTitle');if(title)title.textContent=cfg.label||(woodContext==='produits-secondaires'?'Produits secondaires':'Transformation du bois');
  const sub=document.getElementById('woodViewSubtitle');if(sub)sub.textContent=type==='EXPLOITANTS_SECONDAIRES'?'Répertoire des opérateurs, produits exploités et références de leurs autorisations.':type==='PRODUITS_QTE'?'Suivi des quantités de produits secondaires exploités et des carnets associés.':'Unités de transformation, déligneuses, menuiseries et dépôts-ventes.';
  const addBtn=document.getElementById('addBtn');if(addBtn){addBtn.textContent=cfg.addLabel||'Ajouter';addBtn.onclick=()=>openEditor()}
  updateWoodTableHead(type);updateWoodFilterVisibility(type);
  const url=new URL(location.href);url.searchParams.set('view',type);history.replaceState(null,'',url.pathname+url.search);
  loadRecords();
}

function updateWoodTableHead(type){
  const head=document.getElementById('woodTableHead');if(!head)return;
  const map={
    EXPLOITANTS_SECONDAIRES:['Opérateur','Contact','Produit exploité','N° permis','Date délivrance','Localité','Service forestier de suivi','Actions'],
    PRODUITS_QTE:['Statut opérateur','Charbon de bois','Bois de feu','Mortiers','Kinkeliba','Fruit de karité','Bambou de chine','Actions'],
    UNITES_BOIS:["Type d’exerçant",'Région / Département','Localité','Usine / Opérateur','Activité / Service','Contact','Coordonnées X / Y','Permis / Date','Actions']
  };
  head.innerHTML='<tr>'+map[type].map(v=>`<th>${esc(v)}</th>`).join('')+'</tr>';
}

function bindWoodFilters(){
  const ids=['woodYearFilter','woodDateFilter','woodLocaliteFilter','woodNatureFilter','woodStatusFilter','woodExercantFilter','woodRegionFilter','woodDepartementFilter'];
  ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;const ev=el.tagName==='INPUT'&&el.type==='text'?'input':'change';el.addEventListener(ev,()=>{clearTimeout(window.__woodFilterTimer);window.__woodFilterTimer=setTimeout(()=>{currentPage=1;loadRecords()},220)})});
  document.getElementById('woodYearFilter')?.addEventListener('input',()=>{clearTimeout(window.__woodYearTimer);window.__woodYearTimer=setTimeout(()=>{currentPage=1;loadRecords()},220)});
  document.getElementById('woodResetFilters')?.addEventListener('click',()=>{ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});currentSearch='';const q=document.getElementById('searchInput');if(q)q.value='';currentPage=1;loadRecords()});
}
function updateWoodFilterVisibility(type){
  const set=(id,on)=>{const el=document.getElementById(id);if(el){el.hidden=!on;if(!on)el.value=''}};
  set('woodYearFilter',type!=='PRODUITS_QTE');
  set('woodDateFilter',type!=='PRODUITS_QTE');
  set('woodLocaliteFilter',type!=='PRODUITS_QTE');
  set('woodNatureFilter',type==='EXPLOITANTS_SECONDAIRES');
  set('woodStatusFilter',type==='PRODUITS_QTE');
  set('woodExercantFilter',type==='UNITES_BOIS');
  set('woodRegionFilter',type==='UNITES_BOIS');
  set('woodDepartementFilter',type==='UNITES_BOIS');
}

function woodProductSummary(qty,carnet,unit){
  const q=String(qty??'').trim(),c=String(carnet??'').trim();
  if(!q&&!c)return '—';
  return `${q||'0'} ${unit}${c?` · carnet ${c}`:''}`;
}

function mountWoodEditorLogic(record=null){
  if(editorWoodType!=='UNITES_BOIS')return;
  const typeEl=document.querySelector('#dynamicFields [data-key="type_exercant"]');if(!typeEl)return;
  const unitKeys=new Set(['region','departement','nom_usine','activites_principales']);
  const otherKeys=new Set(['service_rattachement','numero_permis','date_delivrance']);
  const section=document.querySelector('#dynamicFields [data-section-key="__section_autorisation"]');
  const update=()=>{
    const isUnit=normalizeWoodText(typeEl.value)==='unites de transformation';
    unitKeys.forEach(k=>{const w=document.querySelector(`#dynamicFields [data-field-key="${k}"]`);if(w){w.hidden=!isUnit;if(!isUnit){const e=w.querySelector('[data-key]');if(e)e.value=''}}});
    otherKeys.forEach(k=>{const w=document.querySelector(`#dynamicFields [data-field-key="${k}"]`);if(w){w.hidden=isUnit;if(isUnit){const e=w.querySelector('[data-key]');if(e)e.value=''}}});
    if(section)section.hidden=isUnit;
  };
  typeEl.addEventListener('change',update);update();
}

function setupConvocationsModule(){
  document.getElementById('pageTitle').textContent=config.title;
  document.getElementById('pageSubtitle').textContent=config.subtitle;
  bindCommonModuleControls();
  const printBtn=document.getElementById('printListBtn');
  if(printBtn)printBtn.onclick=e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…');
  document.querySelectorAll('[data-convocation-tab]').forEach(btn=>btn.addEventListener('click',()=>setConvocationView(btn.dataset.convocationTab)));
  const requested=String(new URLSearchParams(location.search).get('view')||'').toUpperCase();
  setConvocationView(requested==='PV'?'PV':'CONVOCATIONS');
}

function setConvocationView(type){
  if(!['CONVOCATIONS','PV'].includes(type))type='CONVOCATIONS';
  currentConvocationView=type;editorConvocationView=type;currentPage=1;
  document.querySelectorAll('[data-convocation-tab]').forEach(btn=>{const on=btn.dataset.convocationTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const title=document.getElementById('convocationViewTitle');if(title)title.textContent=type==='PV'?'Procès-verbaux des rencontres':'Convocations';
  const sub=document.getElementById('convocationViewSubtitle');if(sub)sub.textContent=type==='PV'?'Rédaction, modification, impression et suppression des procès-verbaux issus des convocations.':'Rédaction, impression et suivi des convocations administratives.';
  const head=document.getElementById('convocationNameHeader');if(head)head.textContent=type==='PV'?'Personne concernée':'Personne / intitulé';
  const addBtn=document.getElementById('addBtn');
  if(addBtn){addBtn.textContent=type==='PV'?'Ajouter procès-verbal':'Ajouter convocation';addBtn.onclick=()=>openEditor()}
  const url=new URL(location.href);url.searchParams.set('view',type);history.replaceState(null,'',url.pathname+url.search);
  loadRecords();
}

async function manageConvocationPv(convocation){
  try{
    const scope=new URLSearchParams(location.search).get('scopeOrg');
    const q=new URLSearchParams({module:'convocation_pv',page:'1',limit:'10',search:'',sourceConvocationId:String(convocation.id)});
    if(scope)q.set('scopeOrg',scope);
    const resp=await api(`/api/load?${q.toString()}`);
    const existing=(resp.items||[])[0]||null;
    setConvocationView('PV');
    if(existing){
      editorConvocationView='PV';
      if(existing.owned)openEditor(existing);
      else openDetails(existing);
      return;
    }
    if(!convocation.owned){await professionalAlert('Procès-verbal','Aucun procès-verbal n’est encore enregistré pour cette convocation.');return}
    pendingSmartSourceRecord=convocation;
    openEditor(null,null,null,convocation);
  }catch(e){await professionalAlert('Procès-verbal',e.message||'Impossible d’ouvrir le procès-verbal lié à cette convocation.')}
}


function setupFireModule(){
  document.getElementById('pageTitle').textContent=config.title;
  document.getElementById('pageSubtitle').textContent=config.subtitle;
  bindCommonModuleControls();
  document.getElementById('printListBtn')?.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…'));
  document.querySelectorAll('[data-fire-tab]').forEach(btn=>btn.addEventListener('click',()=>setFireView(btn.dataset.fireTab)));
  bindFireFilters();
  const requested=String(new URLSearchParams(location.search).get('view')||'').toUpperCase();
  setFireView(['CREE','REDYNAMISE','RENOUVELE','DEGATS'].includes(requested)?requested:'CREE');
}
function setFireView(type){
  if(!['CREE','REDYNAMISE','RENOUVELE','DEGATS'].includes(type))type='CREE';
  currentFireType=type;editorFireType=type;currentPage=1;
  document.querySelectorAll('[data-fire-tab]').forEach(btn=>{const on=btn.dataset.fireTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const cfg=fireConfig(type)||{};
  document.getElementById('fireViewTitle').textContent=cfg.label||'Feux de brousse';
  document.getElementById('fireViewSubtitle').textContent=type==='DEGATS'?'Enregistrement, localisation et suivi des dégâts causés par les feux de brousse.':'Gestion des comités villageois de lutte contre les feux de brousse.';
  const addBtn=document.getElementById('addBtn');if(addBtn){addBtn.textContent=cfg.addLabel||'Ajouter';addBtn.onclick=()=>openEditor(null,null,null,null,null,type)}
  updateFireTableHead(type);updateFireFilterVisibility(type);
  const url=new URL(location.href);url.searchParams.set('view',type);history.replaceState(null,'',url.pathname+url.search);loadRecords();
}
function updateFireTableHead(type){
  const head=document.getElementById('fireTableHead');if(!head)return;
  const cols=type==='DEGATS'?['Date constat','Sous-préfecture','Village','Nature des dégâts','Superficie détruite (ha)','Personnes impactées','Observations','Actions']:['Département','Sous-préfecture','Village','Acte de création','Président du comité','Contact','Actions'];
  head.innerHTML='<tr>'+cols.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr>';
}
function bindFireFilters(){
  const ids=['fireDepartmentFilter','fireSousPrefFilter','fireVillageFilter','fireDateFilter','fireNatureFilter'];
  ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;const ev=el.type==='text'?'input':'change';el.addEventListener(ev,()=>{clearTimeout(window.__fireFilterTimer);window.__fireFilterTimer=setTimeout(()=>{currentPage=1;loadRecords()},220)})});
  document.getElementById('fireResetFilters')?.addEventListener('click',()=>{ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});currentSearch='';const q=document.getElementById('searchInput');if(q)q.value='';currentPage=1;loadRecords()});
}
function updateFireFilterVisibility(type){
  const set=(id,on)=>{const el=document.getElementById(id);if(el){el.hidden=!on;if(!on)el.value=''}};
  set('fireDepartmentFilter',type!=='DEGATS');set('fireSousPrefFilter',true);set('fireVillageFilter',true);set('fireDateFilter',type==='DEGATS');set('fireNatureFilter',type==='DEGATS');
}

function setupFaunaModule(){
  document.getElementById('pageTitle').textContent=config.title;document.getElementById('pageSubtitle').textContent=config.subtitle;bindCommonModuleControls();
  document.getElementById('printListBtn')?.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…'));
  document.querySelectorAll('[data-fauna-tab]').forEach(btn=>btn.addEventListener('click',()=>setFaunaView(btn.dataset.faunaTab)));bindFaunaFilters();
  const requested=String(new URLSearchParams(location.search).get('view')||'').toUpperCase();setFaunaView(['OBSERVATIONS','CONFLITS'].includes(requested)?requested:'OBSERVATIONS');
}
function setFaunaView(type){
  if(!['OBSERVATIONS','CONFLITS'].includes(type))type='OBSERVATIONS';currentFaunaType=type;editorFaunaType=type;currentPage=1;
  document.querySelectorAll('[data-fauna-tab]').forEach(btn=>{const on=btn.dataset.faunaTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const cfg=faunaConfig(type)||{};document.getElementById('faunaViewTitle').textContent=cfg.label||'Faune';document.getElementById('faunaViewSubtitle').textContent=type==='OBSERVATIONS'?'Suivi des espèces animales rencontrées et de leurs zones d’observation.':'Enregistrement et suivi des conflits homme-faune et des actions menées.';
  const addBtn=document.getElementById('addBtn');if(addBtn){addBtn.textContent=cfg.addLabel||'Ajouter';addBtn.onclick=()=>openEditor(null,null,null,null,null,null,type)}
  updateFaunaTableHead(type);updateFaunaFilterVisibility(type);const url=new URL(location.href);url.searchParams.set('view',type);history.replaceState(null,'',url.pathname+url.search);loadRecords();
}
function updateFaunaTableHead(type){const head=document.getElementById('faunaTableHead');if(!head)return;const cols=type==='OBSERVATIONS'?['Date d’observation','Espèces animales','Zone d’observation','Commentaires utiles','Actions']:['S/Préfecture','Village','Type de conflit','Animaux impliqués','Dégâts recensés','Personnes impactées H/F','Action menée','Actions'];head.innerHTML='<tr>'+cols.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr>'}
function bindFaunaFilters(){const ids=['faunaDateFilter','faunaSpeciesFilter','faunaZoneFilter','faunaSousPrefFilter','faunaVillageFilter','faunaConflictFilter'];ids.forEach(id=>{const el=document.getElementById(id);if(!el)return;const ev=el.type==='text'?'input':'change';el.addEventListener(ev,()=>{clearTimeout(window.__faunaFilterTimer);window.__faunaFilterTimer=setTimeout(()=>{currentPage=1;loadRecords()},220)})});document.getElementById('faunaResetFilters')?.addEventListener('click',()=>{ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});currentSearch='';const q=document.getElementById('searchInput');if(q)q.value='';currentPage=1;loadRecords()})}
function updateFaunaFilterVisibility(type){const set=(id,on)=>{const el=document.getElementById(id);if(el){el.hidden=!on;if(!on)el.value=''}};set('faunaDateFilter',type==='OBSERVATIONS');set('faunaSpeciesFilter',type==='OBSERVATIONS');set('faunaZoneFilter',type==='OBSERVATIONS');set('faunaSousPrefFilter',type==='CONFLITS');set('faunaVillageFilter',type==='CONFLITS');set('faunaConflictFilter',type==='CONFLITS')}

function setupMissionsModule(){
  document.getElementById('pageTitle').textContent=config.title;document.getElementById('pageSubtitle').textContent=config.subtitle;bindCommonModuleControls();
  document.getElementById('printListBtn')?.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…'));
  document.querySelectorAll('[data-mission-tab]').forEach(btn=>btn.addEventListener('click',()=>setMissionView(btn.dataset.missionTab)));
  const requested=String(new URLSearchParams(location.search).get('view')||'').toUpperCase();setMissionView(['DISPOSITION','REALISEE','REPRESSION'].includes(requested)?requested:'DISPOSITION');
}
function setMissionView(type){
  if(!['DISPOSITION','REALISEE','REPRESSION'].includes(type))type='DISPOSITION';currentMissionType=type;editorMissionType=type;currentPage=1;
  document.querySelectorAll('[data-mission-tab]').forEach(btn=>{const on=btn.dataset.missionTab===type;btn.classList.toggle('is-active',on);btn.setAttribute('aria-selected',on?'true':'false')});
  const cfg=missionConfig(type)||{};document.getElementById('missionViewTitle').textContent=cfg.label||'Missions';document.getElementById('missionViewSubtitle').textContent=type==='DISPOSITION'?'Planification des missions de contrôle et de leur fréquence.':type==='REALISEE'?'Enregistrement des missions de contrôle effectivement réalisées.':'Enregistrement des infractions constatées, saisies associées et procès-verbaux.';
  const addBtn=document.getElementById('addBtn');if(addBtn){addBtn.textContent=cfg.addLabel||'Ajouter';addBtn.onclick=()=>openEditor(null,null,null,null,null,null,null,type)}
  updateMissionTableHead(type);const url=new URL(location.href);url.searchParams.set('view',type);history.replaceState(null,'',url.pathname+url.search);loadRecords();
}
function updateMissionTableHead(type){const head=document.getElementById('missionTableHead');if(!head)return;const cols=type==='DISPOSITION'?['Libellé de la mission','Fréquence dans le temps','Actions']:type==='REALISEE'?['N° mission','Libellé','Chef de mission','Autres participants','Objectif','Résultat','Actions']:['Objet de l’infraction','Personne mise en cause','Contact','Liée à une mission','Objets saisis','Observations','Actions'];head.innerHTML='<tr>'+cols.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr>'}

function setEditorFieldValue(key,value){const el=document.querySelector(`#dynamicFields [data-key="${key}"]`);if(el&&value!==undefined&&value!==null)el.value=String(value)}
async function manageOffensePv(offense){
  try{
    const scope=new URLSearchParams(location.search).get('scopeOrg');const q=new URLSearchParams({module:'offense_pv',page:'1',limit:'10',search:'',sourceOffenseId:String(offense.id)});if(scope)q.set('scopeOrg',scope);
    const resp=await api(`/api/load?${q.toString()}`);const existing=(resp.items||[])[0]||null;
    if(existing){editorMissionType='PV_INFRACTION';editorOffensePvRecord=existing;if(existing.owned)openEditor(existing,null,null,null,null,null,null,'PV_INFRACTION');else openDetails(existing);return}
    if(!offense.owned){await professionalAlert('Procès-verbal','Aucun P-V n’est encore enregistré pour cette affaire.');return}
    editorOffensePvRecord=null;openEditor(null,null,null,null,null,null,null,'PV_INFRACTION');
    const d=offense.data||{};setEditorFieldValue('_source_offense_id',offense.id);setEditorFieldValue('personne_mise_cause',d.personne_mise_cause);setEditorFieldValue('objet_infraction',d.objet_infraction);setEditorFieldValue('objets_saisis',d.objets_saisis);setEditorFieldValue('agents_redacteurs',d.agents_arrestation);document.getElementById('recordTitle').value=`P-V — ${d.personne_mise_cause||offense.title||'Infraction'}`;
  }catch(e){await professionalAlert('Procès-verbal',e.message||'Impossible d’ouvrir le P-V lié à cette affaire.')}
}
function setupModule(){
  if(moduleKey==='stages'){setupStageModule();return}
  if(moduleKey==='documents'){setupDocumentsModule();return}
  if(moduleKey==='convocations'){setupConvocationsModule();return}
  if(moduleKey==='exploitation-forestiere'){setupForestModule();return}
  if(moduleKey==='transformation-bois'){setupWoodModule();return}
  if(moduleKey==='feux-brousse'){setupFireModule();return}
  if(moduleKey==='faune'){setupFaunaModule();return}
  if(moduleKey==='missions'){setupMissionsModule();return}
  document.getElementById('pageTitle').textContent=config.title;
  document.getElementById('pageSubtitle').textContent=config.subtitle;
  const addBtn=document.getElementById('addBtn');
  addBtn.textContent=`Ajouter ${config.singular.toLowerCase()}`;
  addBtn.onclick=()=>openEditor();
  const printBtn=document.createElement('button');
  printBtn.className='btn btn-secondary';printBtn.type='button';printBtn.innerHTML='Imprimer la liste / PDF';
  printBtn.onclick=e=>withButtonLock(e.currentTarget,()=>printCurrentList(),'Préparation…');
  addBtn.parentElement.insertBefore(printBtn,addBtn);
  bindCommonModuleControls();
  if(moduleKey==='sensibilisations') bindAwarenessFilters();
  if(moduleKey==='activites-minef') bindMinefActivityFilters();
  loadRecords();
}

function bindMinefActivityFilters(){
  const ids=['minefActivityYearFilter','minefActivityDateFilter','minefActivityTypeFilter','minefActivityCategoryFilter','minefActivityOrganizerFilter'];
  ids.forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{currentPage=1;loadRecords()}));
  for(const id of ['minefActivityYearFilter','minefActivityOrganizerFilter']){
    const el=document.getElementById(id);
    el?.addEventListener('input',()=>{clearTimeout(window.__minefActivityFilterTimer);window.__minefActivityFilterTimer=setTimeout(()=>{currentPage=1;loadRecords()},250)});
  }
  document.getElementById('minefActivityResetFilters')?.addEventListener('click',()=>{
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    currentSearch='';const q=document.getElementById('searchInput');if(q)q.value='';currentPage=1;loadRecords();
  });
}

function bindAwarenessFilters(){
  const ids=['awarenessYearFilter','awarenessDateFilter','awarenessTypeFilter'];
  ids.forEach(id=>document.getElementById(id)?.addEventListener('change',()=>{currentPage=1;loadRecords()}));
  const year=document.getElementById('awarenessYearFilter');
  year?.addEventListener('input',()=>{clearTimeout(window.__awarenessYearTimer);window.__awarenessYearTimer=setTimeout(()=>{currentPage=1;loadRecords()},250)});
  document.getElementById('awarenessResetFilters')?.addEventListener('click',()=>{
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});currentSearch='';const q=document.getElementById('searchInput');if(q)q.value='';currentPage=1;loadRecords();
  });
}

async function loadRecords(){
  try{
    const scope=new URLSearchParams(location.search).get('scopeOrg');
    const dataModule=effectiveModule();
    const stageFilter=moduleKey==='stages'?`&stageType=${encodeURIComponent(currentStageType)}`:'';
    const documentFilter=moduleKey==='documents'&&dataModule==='documents'?`&documentType=${encodeURIComponent(currentDocumentType)}`:'';
    const minefActivityFilter=moduleKey==='activites-minef'?`&year=${encodeURIComponent(document.getElementById('minefActivityYearFilter')?.value||'')}&activityDate=${encodeURIComponent(document.getElementById('minefActivityDateFilter')?.value||'')}&activityType=${encodeURIComponent(document.getElementById('minefActivityTypeFilter')?.value||'')}&activityCategory=${encodeURIComponent(document.getElementById('minefActivityCategoryFilter')?.value||'')}&organizer=${encodeURIComponent(document.getElementById('minefActivityOrganizerFilter')?.value||'')}`:'';
    const awarenessFilter=moduleKey==='sensibilisations'?`&year=${encodeURIComponent(document.getElementById('awarenessYearFilter')?.value||'')}&activityDate=${encodeURIComponent(document.getElementById('awarenessDateFilter')?.value||'')}&awarenessType=${encodeURIComponent(document.getElementById('awarenessTypeFilter')?.value||'')}`:'';
    const forestFilter=moduleKey==='exploitation-forestiere'?`&forestType=${encodeURIComponent(currentForestType)}&year=${encodeURIComponent(document.getElementById('forestYearFilter')?.value||'')}&activityDate=${encodeURIComponent(document.getElementById('forestDateFilter')?.value||'')}&sousPrefecture=${encodeURIComponent(document.getElementById('forestSousPrefFilter')?.value||'')}&localite=${encodeURIComponent(document.getElementById('forestLocaliteFilter')?.value||'')}&essence=${encodeURIComponent(document.getElementById('forestEssenceFilter')?.value||'')}&reboisementType=${encodeURIComponent(document.getElementById('forestReboisementTypeFilter')?.value||'')}`:'';
    const woodFilter=moduleKey==='transformation-bois'?`&woodType=${encodeURIComponent(currentWoodType)}&year=${encodeURIComponent(document.getElementById('woodYearFilter')?.value||'')}&activityDate=${encodeURIComponent(document.getElementById('woodDateFilter')?.value||'')}&localite=${encodeURIComponent(document.getElementById('woodLocaliteFilter')?.value||'')}&natureProduit=${encodeURIComponent(document.getElementById('woodNatureFilter')?.value||'')}&operatorStatus=${encodeURIComponent(document.getElementById('woodStatusFilter')?.value||'')}&exercantType=${encodeURIComponent(document.getElementById('woodExercantFilter')?.value||'')}&region=${encodeURIComponent(document.getElementById('woodRegionFilter')?.value||'')}&departement=${encodeURIComponent(document.getElementById('woodDepartementFilter')?.value||'')}`:'';
    const fireFilter=moduleKey==='feux-brousse'?`&fireType=${encodeURIComponent(currentFireType)}&department=${encodeURIComponent(document.getElementById('fireDepartmentFilter')?.value||'')}&sousPrefecture=${encodeURIComponent(document.getElementById('fireSousPrefFilter')?.value||'')}&village=${encodeURIComponent(document.getElementById('fireVillageFilter')?.value||'')}&activityDate=${encodeURIComponent(document.getElementById('fireDateFilter')?.value||'')}&natureDegats=${encodeURIComponent(document.getElementById('fireNatureFilter')?.value||'')}`:'';
    const faunaFilter=moduleKey==='faune'?`&faunaType=${encodeURIComponent(currentFaunaType)}&activityDate=${encodeURIComponent(document.getElementById('faunaDateFilter')?.value||'')}&species=${encodeURIComponent(document.getElementById('faunaSpeciesFilter')?.value||'')}&zone=${encodeURIComponent(document.getElementById('faunaZoneFilter')?.value||'')}&sousPrefecture=${encodeURIComponent(document.getElementById('faunaSousPrefFilter')?.value||'')}&village=${encodeURIComponent(document.getElementById('faunaVillageFilter')?.value||'')}&conflictType=${encodeURIComponent(document.getElementById('faunaConflictFilter')?.value||'')}`:'';
    const missionFilter=moduleKey==='missions'?`&missionType=${encodeURIComponent(currentMissionType)}`:'';
    const d=await api(`/api/load?module=${encodeURIComponent(dataModule)}&page=${currentPage}&limit=25&search=${encodeURIComponent(currentSearch)}${stageFilter}${documentFilter}${minefActivityFilter}${awarenessFilter}${forestFilter}${woodFilter}${fireFilter}${faunaFilter}${missionFilter}${scope?`&scopeOrg=${encodeURIComponent(scope)}`:''}`);
    if(currentPage>d.totalPages){currentPage=d.totalPages;return loadRecords()}
    lastItems=d.items||[];renderRows(lastItems);
    document.getElementById('pageInfo').textContent=`Page ${d.page} / ${d.totalPages} — ${d.total} enregistrement(s)`;
    document.getElementById('prevBtn').disabled=d.page<=1;document.getElementById('nextBtn').disabled=d.page>=d.totalPages;
  }catch(e){showToast(e.message,'error')}
}

function renderRows(items){
  const tb=document.getElementById('recordsBody');
  const isPersonnelRegister=moduleKey==='personnel';
  const isAwarenessRegister=moduleKey==='sensibilisations';
  const isMinefActivityRegister=moduleKey==='activites-minef';
  const isForestRegister=moduleKey==='exploitation-forestiere';
  const isWoodRegister=moduleKey==='transformation-bois';
  const isFireRegister=moduleKey==='feux-brousse';
  const isFaunaRegister=moduleKey==='faune';
  const isMissionRegister=moduleKey==='missions';
  if(!items.length){tb.innerHTML='<tr><td colspan="12" class="muted">Aucune donnée enregistrée.</td></tr>';return}
  const isConvocationRegister=moduleKey==='convocations'&&currentConvocationView==='CONVOCATIONS';
  const isPvRegister=moduleKey==='convocations'&&currentConvocationView==='PV';
  const actionsHtml=r=>`<div class="actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}">PDF</button>${isConvocationRegister?`<button class="btn btn-primary btn-sm" data-pv="${r.id}">Procès-verbal</button>`:''}${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-secondary btn-sm" data-archive="${r.id}">Archiver</button><button class="btn btn-danger btn-sm" data-delete="${r.id}">Supprimer</button>`:'<span class="muted">Consultation</span>'}</div>`;
  const personnelActionsHtml=r=>`<div class="actions personnel-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}" title="Voir la fiche complète" aria-label="Voir la fiche complète">👁</button><button class="btn btn-secondary btn-sm" data-print="${r.id}" title="Imprimer PDF" aria-label="Imprimer PDF">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}" title="Modifier" aria-label="Modifier">✎</button><button class="btn btn-secondary btn-sm" data-archive="${r.id}" title="Archiver" aria-label="Archiver">A</button><button class="btn btn-danger btn-sm" data-delete="${r.id}" title="Supprimer" aria-label="Supprimer">×</button>`:'<span class="muted">Consult.</span>'}</div>`;
  if(isPersonnelRegister){
    tb.innerHTML=items.map((r,i)=>{const d=r.data||{};const order=(currentPage-1)*25+i+1;return `<tr><td class="personnel-order">${order}</td><td><strong>${esc(r.title)}</strong></td><td>${esc(personnelSexeShort(d.sexe))}</td><td>${esc(displayValue(d.matricule))}</td><td>${esc(displayValue(d.emploi))}</td><td>${esc(displayValue(d.fonction))}</td><td>${esc(fmtDate(d.date_naissance))}</td><td>${esc(displayValue(d.telephone))}</td><td>${esc(fmtDate(d.date_prise_service_gbeke))}</td><td>${personnelActionsHtml(r)}</td></tr>`}).join('');
  }else if(isMinefActivityRegister){
    const activityActionsHtml=r=>`<div class="actions compact-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-danger btn-sm" data-delete="${r.id}">Supprimer</button>`:'<span class="muted">Consult.</span>'}</div>`;
    tb.innerHTML=items.map(r=>{const d=r.data||{};return `<tr><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td><strong>${esc(displayValue(d.type_activite))}</strong></td><td>${esc(displayValue(d.categorie_minef))}</td><td title="${esc(d.intitule_activite||r.title||'')}">${esc(displayValue(d.intitule_activite||r.title))}</td><td>${esc(displayValue(d.organisateur))}</td><td title="${esc(d.commentaire||'')}">${esc(displayValue(d.commentaire))}</td><td>${activityActionsHtml(r)}</td></tr>`}).join('');
  }else if(isAwarenessRegister){
    const awarenessActionsHtml=r=>`<div class="actions awareness-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}" title="Voir">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}" title="PDF">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}" title="Modifier">✎</button><button class="btn btn-danger btn-sm" data-delete="${r.id}" title="Supprimer">×</button>`:'<span class="muted">Consult.</span>'}</div>`;
    tb.innerHTML=items.map(r=>{const d=r.data||{};const hommes=Number(d.hommes||0),femmes=Number(d.femmes||0),total=hommes+femmes;const type=d.type_sensibilisation||d.theme||r.title||'—';return `<tr><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td title="${esc(type)}"><strong>${esc(type)}</strong></td><td title="${esc(displayValue(d.lieu))}">${esc(displayValue(d.lieu))}</td><td title="${esc(displayValue(d.cible))}">${esc(displayValue(d.cible))}</td><td class="awareness-count">H : ${hommes} · F : ${femmes} · Total : <strong>${total}</strong></td><td>${awarenessActionsHtml(r)}</td></tr>`}).join('');
  }else if(isForestRegister){
    const forestActionsHtml=r=>`<div class="actions forest-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}" title="Voir">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}" title="PDF">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}" title="Modifier">✎</button><button class="btn btn-danger btn-sm" data-delete="${r.id}" title="Supprimer">×</button>`:'<span class="muted">Consult.</span>'}</div>`;
    tb.innerHTML=items.map(r=>{const d=r.data||{};const coord=[d.coord_x,d.coord_y].filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').join(' / ')||'—';const a=forestActionsHtml(r);if(currentForestType==='PEPINIERE')return `<tr><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.localisation))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.nbr_plants_produits))}</td><td>${esc(displayValue(d.nbr_plants_distribues))}</td><td><strong>${esc(displayValue(d.nbr_plants_disponibles))}</strong></td><td>${esc(displayValue(d.contact_responsable))}</td><td>${a}</td></tr>`;if(currentForestType==='PLANTATION_CREEE')return `<tr><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(displayValue(d.beneficiaire))}</td><td>${esc(displayValue(d.superficie))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.densite))}</td><td>${esc(displayValue(d.nombre_total_plants))}</td><td>${esc(coord)}</td><td>${a}</td></tr>`;if(currentForestType==='REBOISEMENT')return `<tr><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.type_reboisement))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(displayValue(d.beneficiaire))}</td><td>${esc(displayValue(d.superficie))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.nombre_total_plants))}</td><td>${esc(displayValue(d.entreprise_responsable))}</td><td>${a}</td></tr>`;return `<tr><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.superficie_parcelle))}</td><td>${esc(coord)}</td><td>${esc(displayValue(d.contact_proprietaire))}</td><td>${a}</td></tr>`}).join('');
  }else if(isWoodRegister){
    const woodActionsHtml=r=>`<div class="actions wood-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}" title="Voir">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}" title="PDF">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}" title="Modifier">✎</button><button class="btn btn-danger btn-sm" data-delete="${r.id}" title="Supprimer">×</button>`:'<span class="muted">Consult.</span>'}</div>`;
    tb.innerHTML=items.map(r=>{const d=r.data||{},a=woodActionsHtml(r);if(currentWoodType==='EXPLOITANTS_SECONDAIRES')return `<tr><td title="${esc(displayValue(d.nom_operateur||r.title))}"><strong>${esc(displayValue(d.nom_operateur||r.title))}</strong></td><td>${esc(displayValue(d.contact))}</td><td title="${esc(displayValue(d.nature_produit))}">${esc(displayValue(d.nature_produit))}</td><td>${esc(displayValue(d.numero_permis))}</td><td>${esc(fmtDate(d.date_delivrance||r.event_date))}</td><td>${esc(displayValue(d.localite))}</td><td title="${esc(displayValue(d.service_suivi))}">${esc(displayValue(d.service_suivi))}</td><td>${a}</td></tr>`;if(currentWoodType==='PRODUITS_QTE')return `<tr><td><strong>${esc(displayValue(d.statut_operateur))}</strong></td><td>${esc(woodProductSummary(d.charbon_qte_sacs,d.charbon_nbr_carnet,'sac'))}</td><td>${esc(woodProductSummary(d.bois_feu_qte_t,d.bois_feu_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.mortiers_qte_t,d.mortiers_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.kinkeliba_qte_t,d.kinkeliba_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.karite_qte_t,d.karite_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.bambou_qte_t,d.bambou_nbr_carnet,'T'))}</td><td>${a}</td></tr>`;const coord=[d.coord_x,d.coord_y].filter(v=>v!==null&&v!==undefined&&String(v).trim()!=='').join(' / ')||'—';const regDep=[d.region,d.departement].filter(Boolean).join(' / ')||'—';const name=d.nom_usine||d.nom_operateur||r.title||'—';const activity=d.activites_principales||d.service_rattachement||'—';const permit=[d.numero_permis,d.date_delivrance?fmtDate(d.date_delivrance):''].filter(Boolean).join(' / ')||'—';return `<tr><td>${esc(displayValue(d.type_exercant))}</td><td title="${esc(regDep)}">${esc(regDep)}</td><td>${esc(displayValue(d.localite))}</td><td title="${esc(name)}"><strong>${esc(name)}</strong></td><td title="${esc(activity)}">${esc(activity)}</td><td>${esc(displayValue(d.contact_operateur))}</td><td>${esc(coord)}</td><td>${esc(permit)}</td><td>${a}</td></tr>`}).join('');
  }else if(isFireRegister){
    const a=r=>`<div class="actions compact-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-danger btn-sm" data-delete="${r.id}">Supprimer</button>`:'<span class="muted">Consult.</span>'}</div>`;
    tb.innerHTML=items.map(r=>{const d=r.data||{},ac=a(r);if(currentFireType==='DEGATS')return `<tr><td>${esc(fmtDate(d.date_constat||r.event_date))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.village))}</td><td>${esc(displayValue(d.nature_degats))}</td><td>${esc(displayValue(d.superficie_detruite))}</td><td>${esc(displayValue(d.personnes_impactees))}</td><td>${esc(displayValue(d.observations))}</td><td>${ac}</td></tr>`;return `<tr><td>${esc(displayValue(d.departement))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td><strong>${esc(displayValue(d.village))}</strong></td><td>${esc(displayValue(d.acte_creation))}</td><td>${esc(displayValue(d.president_nom))}</td><td>${esc(displayValue(d.president_contact))}</td><td>${ac}</td></tr>`}).join('');
  }else if(isFaunaRegister){
    const a=r=>`<div class="actions compact-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}">PDF</button>${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-danger btn-sm" data-delete="${r.id}">Supprimer</button>`:'<span class="muted">Consult.</span>'}</div>`;
    tb.innerHTML=items.map(r=>{const d=r.data||{},ac=a(r);if(currentFaunaType==='CONFLITS')return `<tr><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.village))}</td><td>${esc(displayValue(d.type_conflit))}</td><td>${esc(displayValue(d.nombre_animaux))}</td><td>${esc(displayValue(d.degats_recenses))}</td><td>H : ${esc(displayValue(d.hommes_impactes))} · F : ${esc(displayValue(d.femmes_impactees))}</td><td>${esc(displayValue(d.action_menee))}</td><td>${ac}</td></tr>`;return `<tr><td>${esc(fmtDate(d.date_observation||r.event_date))}</td><td><strong>${esc(displayValue(d.especes_animales))}</strong></td><td>${esc(displayValue(d.zone_observation))}</td><td>${esc(displayValue(d.commentaires_utiles))}</td><td>${ac}</td></tr>`}).join('');
  }else if(isMissionRegister){
    const a=r=>`<div class="actions compact-actions"><button class="btn btn-secondary btn-sm" data-view="${r.id}">Voir</button><button class="btn btn-secondary btn-sm" data-print="${r.id}">PDF</button>${currentMissionType==='REPRESSION'?`<button class="btn btn-primary btn-sm" data-offense-pv="${r.id}">P-V</button>`:''}${r.owned?`<button class="btn btn-secondary btn-sm" data-edit="${r.id}">Modifier</button><button class="btn btn-danger btn-sm" data-delete="${r.id}">Supprimer</button>`:'<span class="muted">Consult.</span>'}</div>`;
    tb.innerHTML=items.map(r=>{const d=r.data||{},ac=a(r);if(currentMissionType==='DISPOSITION')return `<tr><td><strong>${esc(displayValue(d.libelle_mission||r.title))}</strong></td><td>${esc(displayValue(d.frequence))}</td><td>${ac}</td></tr>`;if(currentMissionType==='REALISEE')return `<tr><td><strong>${esc(displayValue(d.numero_mission||r.reference))}</strong></td><td>${esc(displayValue(d.libelle_mission==='Autre'?d.libelle_mission_autre:d.libelle_mission))}</td><td>${esc(displayValue(d.chef_mission))}</td><td>${esc(displayValue(d.autres_agents_participants))}</td><td>${esc(displayValue(d.objectif_mission))}</td><td>${esc(displayValue(d.resultat))}</td><td>${ac}</td></tr>`;return `<tr><td>${esc(displayValue(d.objet_infraction))}</td><td><strong>${esc(displayValue(d.personne_mise_cause))}</strong></td><td>${esc(displayValue(d.contact_mis_cause))}</td><td>${esc(String(d.liee_mission||'').toLowerCase()==='oui'?(d.mission_liee_label||'Oui'):'Non')}</td><td>${esc(displayValue(d.objets_saisis))}</td><td>${esc(displayValue(d.observations))}</td><td>${ac}</td></tr>`}).join('');
  }else{
    tb.innerHTML=items.map(r=>`<tr><td>${esc(r.reference||'—')}</td><td><strong>${esc(r.title)}</strong>${isPvRegister&&r.data?.convocation_reference?`<br><span class="muted">Convocation : ${esc(r.data.convocation_reference)}</span>`:''}</td><td>${fmtDate(r.event_date)}</td><td><span class="pill">${esc(r.status)}</span></td><td><strong>${esc(r.source_organization)}</strong>${r.source_path&&r.source_path!==r.source_organization?`<br><span class="muted">${esc(r.source_path)}</span>`:''}</td><td>${fmtDate(r.updated_at)}</td><td>${actionsHtml(r)}</td></tr>`).join('');
  }
  items.forEach(r=>{
    tb.querySelector(`[data-view="${r.id}"]`)?.addEventListener('click',()=>openDetails(r));
    tb.querySelector(`[data-print="${r.id}"]`)?.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>printRecord(r),'Préparation…'));
    if(isConvocationRegister)tb.querySelector(`[data-pv="${r.id}"]`)?.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>manageConvocationPv(r),'Ouverture…'));
    if(isMissionRegister&&currentMissionType==='REPRESSION')tb.querySelector(`[data-offense-pv="${r.id}"]`)?.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>manageOffensePv(r),'Ouverture…'));
    if(!r.owned)return;
    tb.querySelector(`[data-edit="${r.id}"]`)?.addEventListener('click',()=>openEditor(r,null,moduleKey==='documents'?currentDocumentType:null,null,moduleKey==='exploitation-forestiere'?forestTypeOf(r):null));
    tb.querySelector(`[data-archive="${r.id}"]`)?.addEventListener('click',e=>archiveRecord(r,e.currentTarget));
    tb.querySelector(`[data-delete="${r.id}"]`)?.addEventListener('click',e=>deleteRecord(r,e.currentTarget));
  });
}
function fieldLabel(key,record=null){const f=activeFields(record).find(x=>x[0]===key);return f?.[1]||key.replaceAll('_',' ');}
function displayValue(value){if(value===null||value===undefined||value==='')return '—';return String(value);}
function personnelSexeShort(value){
  if(value===null||value===undefined||value==='')return '—';
  const s=String(value).trim().toUpperCase();
  if(s==='M'||s.startsWith('MASC')||s==='HOMME')return 'M';
  if(s==='F'||s.startsWith('FÉM')||s.startsWith('FEM')||s==='FEMME')return 'F';
  return String(value);
}

function openDetails(record){
  if(moduleKey==='personnel'){
    const d=record.data||{};
    const rows=[
      ['Nom et prénoms',record.title],['Sexe',d.sexe],['Matricule',d.matricule],['Emploi',d.emploi],['Fonction',d.fonction],['Date de naissance',fmtDate(d.date_naissance)],['Date de prise de service au MINEF',fmtDate(d.date_prise_service_minef)],['Date de prise de service dans la Région de Gbêkê',fmtDate(d.date_prise_service_gbeke)],['Grade',d.grade],['Classe',d.classe],['Échelon',d.echelon],['Handicap',d.handicap],['Numéro de téléphone',d.telephone]
    ];
    const photo=d.photo?`<div class="agent-photo-view"><img src="${esc(d.photo)}" alt="Photo de l’agent"></div>`:'';
    const html=`<div class="detail-layout">${photo}<div class="detail-grid">${rows.map(([l,v])=>`<div class="detail-item"><span>${esc(l)}</span><strong>${esc(displayValue(v))}</strong></div>`).join('')}</div></div>`;
    professionalDialog({title:'Agent — Informations',html,confirmText:'Fermer'});return;
  }
  const photo=moduleKey==='personnel'&&record.data?.photo?`<div class="agent-photo-view"><img src="${esc(record.data.photo)}" alt="Photo agent"></div>`:'';
  const rows=[
    ['Référence',record.reference],['Nom / Intitulé',record.title],['Date',fmtDate(record.event_date)],['Statut',record.status],['Service source',record.source_organization],
    ...(moduleKey==='stages'?[['Type de document',stageConfig(stageTypeOf(record))?.label||'Stage']]:[]),
    ...(moduleKey==='transformation-bois'?woodVisibleFields(woodTypeOf(record),record.data||{}):activeFields(record).filter(([, ,t])=>t!=='section'&&t!=='image')).filter(([k])=>k!=='photo').map(([k,l])=>[l,record.data?.[k]])
  ];
  const html=`<div class="detail-layout">${photo}<div class="detail-grid">${rows.map(([l,v])=>`<div class="detail-item"><span>${esc(l)}</span><strong>${esc(displayValue(v))}</strong></div>`).join('')}</div></div>`;
  professionalDialog({title:`${activeSingular(record)} — Informations`,html,confirmText:'Fermer'});
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
  if(!(moduleKey==='absences'||(moduleKey==='documents'&&editorDocumentType==='ABSENCE')))return;
  const a=document.querySelector('#dynamicFields [data-key="date_debut"]');
  const b=document.querySelector('#dynamicFields [data-key="date_fin"]');
  const n=document.querySelector('#dynamicFields [data-key="nombre_jours"]');
  if(n)n.value=inclusiveDays(a?.value,b?.value);
}


function normalizeForestText(v){return String(v||'').trim().toLocaleLowerCase('fr-FR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ')}
async function loadAllOwnForestReboisements(){
  const items=[];let page=1,totalPages=1;
  do{
    const q=new URLSearchParams({module:'exploitation-forestiere',page:String(page),limit:'100',search:'',ownedOnly:'1',forestType:'REBOISEMENT'});
    const d=await api(`/api/load?${q.toString()}`);items.push(...(d.items||[]));totalPages=Number(d.totalPages||1);page++;
  }while(page<=totalPages&&page<=100);
  return items;
}
function mountForestEditorLogic(record=null){
  const area=document.getElementById('dynamicFields');if(!area)return;
  const q=k=>area.querySelector(`[data-key="${k}"]`);
  if(editorForestType==='REBOISEMENT'){
    const type=q('type_reboisement'),enterprise=q('entreprise_responsable');
    const wrap=enterprise?.closest('.field');
    const update=()=>{const show=normalizeForestText(type?.value)==='compensatoires suivis';if(wrap)wrap.hidden=!show;if(enterprise&&!show)enterprise.value=''};
    type?.addEventListener('change',update);update();
  }
  if(editorForestType==='PLANTATION_CREEE'||editorForestType==='REBOISEMENT'){
    const superficie=q('superficie'),densite=q('densite'),total=q('nombre_total_plants');
    const calculate=()=>{if(!total||String(total.value||'').trim())return;const s=Number(superficie?.value||0),d=Number(densite?.value||0);if(s>0&&d>0)total.value=String(Math.round(s*d))};
    superficie?.addEventListener('input',calculate);densite?.addEventListener('input',calculate);calculate();
  }
  if(editorForestType==='PEPINIERE'){
    const essence=q('essence'),produced=q('nbr_plants_produits'),distributed=q('nbr_plants_distribues'),available=q('nbr_plants_disponibles');
    let reboisements=[];
    const update=()=>{
      const e=normalizeForestText(essence?.value);let dist=0;
      if(e)for(const r of reboisements){const d=r.data||{};if(normalizeForestText(d.essence)===e)dist+=Number(d.nombre_total_plants||0)||0}
      if(distributed)distributed.value=String(Math.max(0,Math.round(dist)));
      const prod=Number(produced?.value||0)||0;if(available)available.value=String(Math.max(0,Math.round(prod-dist)));
    };
    essence?.addEventListener('input',update);produced?.addEventListener('input',update);
    loadAllOwnForestReboisements().then(items=>{reboisements=items;update()}).catch(()=>update());
  }
}

function openEditor(record=null,stageTypeOverride=null,documentTypeOverride=null,smartSourceRecord=null,forestTypeOverride=null,fireTypeOverride=null,faunaTypeOverride=null,missionTypeOverride=null){
  const d=document.getElementById('editorDialog');d.classList.add('editor-dialog');
  const isPersonnel=moduleKey==='personnel';
  const isDocument=moduleKey==='documents';
  const isConvocationModule=moduleKey==='convocations';
  const isStage=moduleKey==='stages';
  const isAwareness=moduleKey==='sensibilisations';
  const isMinefActivity=moduleKey==='activites-minef';
  const isForest=moduleKey==='exploitation-forestiere';
  const isWood=moduleKey==='transformation-bois';
  const isFire=moduleKey==='feux-brousse';
  const isFauna=moduleKey==='faune';
  const isMission=moduleKey==='missions';
  const isFormation=moduleKey==='formations';
  if(isStage)editorStageType=stageTypeOverride||(record?stageTypeOf(record):currentStageType);
  if(isDocument)editorDocumentType=documentTypeOverride||(record?documentTypeOf(record):currentDocumentType);
  if(isConvocationModule)editorConvocationView=currentConvocationView;
  if(isForest)editorForestType=forestTypeOverride||(record?forestTypeOf(record):currentForestType);
  if(isWood)editorWoodType=record?woodTypeOf(record):currentWoodType;
  if(isFire)editorFireType=fireTypeOverride||(record?fireTypeOf(record):currentFireType);
  if(isFauna)editorFaunaType=faunaTypeOverride||(record?faunaTypeOf(record):currentFaunaType);
  if(isMission)editorMissionType=missionTypeOverride||(record?missionTypeOf(record):currentMissionType);
  if(smartSourceRecord)pendingSmartSourceRecord=smartSourceRecord;
  const isConvocation=isConvocationModule&&editorConvocationView==='CONVOCATIONS';
  const isConvocationPv=isConvocationModule&&editorConvocationView==='PV';
  const isAbsence=moduleKey==='absences'||(isDocument&&editorDocumentType==='ABSENCE');
  const isServiceDocument=isDocument&&['CESSATION_SERVICE','CESSATION_CONGE','REPRISE_SERVICE','PRISE_SERVICE_MUTATION'].includes(editorDocumentType);
  const isExplanationDocument=isDocument&&editorDocumentType==='DEMANDE_EXPLICATION';
  d.classList.toggle('personnel-editor',isPersonnel);
  d.classList.toggle('absence-editor',isAbsence);
  d.classList.toggle('convocation-editor',isConvocation);
  d.classList.toggle('pv-editor',isConvocationPv);
  d.classList.toggle('stage-editor',isStage);
  d.classList.toggle('document-service-editor',isServiceDocument);
  d.classList.toggle('document-explanation-editor',isExplanationDocument);
  d.classList.toggle('awareness-editor',isAwareness);
  d.classList.toggle('minef-activity-editor',isMinefActivity);
  d.classList.toggle('forest-editor',isForest);
  d.classList.toggle('wood-editor',isWood);
  d.classList.toggle('fire-editor',isFire);
  d.classList.toggle('fauna-editor',isFauna);
  d.classList.toggle('mission-editor',isMission);
  d.classList.toggle('formation-editor',isFormation);
  const singular=activeSingular(record);
  document.getElementById('editorTitle').textContent=record?`Modifier — ${singular}`:`Ajouter — ${singular}`;
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
  titleInput.required=true;
  refField.classList.remove('personnel-base-hidden');dateField.classList.remove('personnel-base-hidden');titleField.classList.remove('personnel-base-hidden');statusField.classList.remove('personnel-status-hidden');statusField.hidden=false;
  if(isPersonnel){
    refField.classList.add('personnel-base-hidden');
    dateField.classList.add('personnel-base-hidden');
    titleField.querySelector('label').textContent='Nom et Prénoms *';
    titleField.classList.remove('full');
    statusField.classList.add('personnel-status-hidden');
  }else if(isMinefActivity){
    refField.classList.add('personnel-base-hidden');
    dateField.classList.add('personnel-base-hidden');
    titleField.classList.add('personnel-base-hidden');
    statusField.classList.add('personnel-status-hidden');
    statusField.hidden=true;
    titleInput.required=false;
    titleInput.value=record?.title||record?.data?.intitule_activite||'Activité';
    statusInput.value=record?.status||'ACTIVE';
  }else if(isAwareness){
    refField.classList.add('personnel-base-hidden');
    dateField.classList.add('personnel-base-hidden');
    titleField.classList.add('personnel-base-hidden');
    statusField.classList.add('personnel-status-hidden');
    titleInput.required=false;
    titleInput.value=record?.title||record?.data?.type_sensibilisation||record?.data?.theme||'Sensibilisation';
    statusInput.value=record?.status||'ACTIVE';
  }else if(isForest){
    refField.classList.add('personnel-base-hidden');
    dateField.classList.add('personnel-base-hidden');
    titleField.classList.add('personnel-base-hidden');
    statusField.classList.add('personnel-status-hidden');
    titleInput.required=false;
    titleInput.value=record?.title||forestConfig(editorForestType)?.label||'Exploitation forestière';
    statusInput.value=record?.status||'ACTIVE';
  }else if(isWood){
    refField.classList.add('personnel-base-hidden');dateField.classList.add('personnel-base-hidden');titleField.classList.add('personnel-base-hidden');statusField.classList.add('personnel-status-hidden');titleInput.required=false;titleInput.value=record?.title||woodConfig(editorWoodType)?.label||'Transformation du bois';statusInput.value=record?.status||'ACTIVE';
  }else if(isFire||isFauna||(isMission&&editorMissionType!=='PV_INFRACTION')||isFormation){
    refField.classList.add('personnel-base-hidden');dateField.classList.add('personnel-base-hidden');titleField.classList.add('personnel-base-hidden');statusField.classList.add('personnel-status-hidden');titleInput.required=false;
    if(isFire)titleInput.value=record?.title||fireConfig(editorFireType)?.label||'Feux de brousse';
    if(isFauna)titleInput.value=record?.title||faunaConfig(editorFaunaType)?.label||'Faune';
    if(isMission)titleInput.value=record?.title||missionConfig(editorMissionType)?.label||'Mission';
    if(isFormation)titleInput.value=record?.title||record?.data?.theme||'Formation';
    statusInput.value=record?.status||'ACTIVE';
  }else if(isMission&&editorMissionType==='PV_INFRACTION'){
    refField.querySelector('label').textContent='Référence / N° du P-V';dateField.querySelector('label').textContent='Date d’établissement du P-V';titleField.querySelector('label').textContent='Affaire / personne mise en cause *';titleField.classList.remove('full');statusField.classList.remove('personnel-status-hidden');statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="ÉTABLI">ÉTABLI</option><option value="VALIDÉ">VALIDÉ</option><option value="ANNULÉ">ANNULÉ</option>';statusInput.value=record?.status||'ÉTABLI';
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
  }else if(isConvocationPv){
    refField.querySelector('label').textContent='Référence / N° du procès-verbal';
    dateField.querySelector('label').textContent="Date d’établissement du procès-verbal";
    titleField.querySelector('label').textContent='Personne convoquée / personne concernée *';
    titleField.classList.remove('full');
    statusField.classList.remove('personnel-status-hidden');
    statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="ÉTABLI">ÉTABLI</option><option value="VALIDÉ">VALIDÉ</option><option value="ANNULÉ">ANNULÉ</option>';
    statusInput.value=record?.status||'ÉTABLI';
  }else if(isStage){
    refField.querySelector('label').textContent='Référence / N° attestation';
    dateField.querySelector('label').textContent="Date d’établissement";
    titleField.querySelector('label').textContent='Nom et Prénoms du stagiaire *';
    titleField.classList.remove('full');
    statusField.classList.remove('personnel-status-hidden');
    if(editorStageType==='MISE_STAGE'){
      statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="EN COURS">EN COURS</option><option value="ÉMISE">ÉMISE</option><option value="TERMINÉ">TERMINÉ</option><option value="ANNULÉE">ANNULÉE</option>';
      statusInput.value=record?.status||'EN COURS';
    }else{
      statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="ÉMISE">ÉMISE</option><option value="ANNULÉE">ANNULÉE</option>';
      statusInput.value=record?.status||'ÉMISE';
    }
  }else if(isExplanationDocument){
    refField.querySelector('label').textContent='Référence / N°';
    dateField.querySelector('label').textContent="Date d’établissement";
    titleField.querySelector('label').textContent='Nom et Prénoms de l’agent *';
    titleField.classList.remove('full');
    statusField.classList.remove('personnel-status-hidden');
    statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="ÉMISE">ÉMISE</option><option value="RÉPONDUE">RÉPONDUE</option><option value="ANNULÉE">ANNULÉE</option>';
    statusInput.value=record?.status||'ÉMISE';
  }else if(isServiceDocument){
    refField.querySelector('label').textContent='Référence / N° certificat';
    dateField.querySelector('label').textContent="Date d’établissement";
    titleField.querySelector('label').textContent='Nom et Prénoms de l’agent *';
    titleField.classList.remove('full');
    statusField.classList.remove('personnel-status-hidden');
    statusInput.innerHTML='<option value="BROUILLON">BROUILLON</option><option value="ÉMIS">ÉMIS</option><option value="ANNULÉ">ANNULÉ</option>';
    statusInput.value=record?.status||'ÉMIS';
  }else{
    dateField.querySelector('label').textContent='Date';
    titleField.querySelector('label').textContent='Intitulé / nom principal *';
    titleField.classList.add('full');
    statusField.classList.remove('personnel-status-hidden');
  }
  const area=document.getElementById('dynamicFields');area.innerHTML='';
  if(isMission&&editorMissionType==='PV_INFRACTION'){const hidden=document.createElement('input');hidden.type='hidden';hidden.dataset.key='_source_offense_id';hidden.value=record?.data?._source_offense_id||'';area.appendChild(hidden)}
  for(const [key,label,type,opts] of activeFields(record)){
    if(type==='section'){
      const section=document.createElement('div');section.className='form-section-heading full';section.dataset.sectionKey=key;section.innerHTML=`<strong>${esc(label)}</strong>`;area.appendChild(section);continue;
    }
    const wrap=document.createElement('div');wrap.className='field'+(type==='textarea'?' full':'')+(type==='image'?' photo-field':'');wrap.dataset.fieldKey=key;
    if(isConvocation){
      if(key==='objet_convocation')wrap.classList.add('convocation-object-field');
      if(key==='personne_a_voir')wrap.classList.add('convocation-person-field');
    }
    if(isConvocationPv&&['objet_rencontre','personnes_presentes','resume_echanges','conclusions_decisions','observations'].includes(key))wrap.classList.add('pv-wide-field');
    if(isStage&&key==='theme')wrap.classList.add('stage-theme-field');
    if(isStage&&key==='note_service_origine')wrap.classList.add('stage-wide-field');
    if(isServiceDocument&&['decision_objet','certificat_cessation_origine','decision_autorite','type_conge','lieu_conge'].includes(key))wrap.classList.add('document-wide-field');
    if(isExplanationDocument&&['texte_demande','reponse_agent'].includes(key))wrap.classList.add('document-explanation-wide-field');
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
    else if(['mission-select','mission-realisee-select','agent-select','created-fire-select'].includes(type)){el=document.createElement('select');const op=document.createElement('option');op.value='';op.textContent=type==='created-fire-select'?'— Sélectionner un comité créé —':'— Sélectionner —';el.appendChild(op);if(type==='mission-select'){const other=document.createElement('option');other.value='Autre';other.textContent='Autre';el.appendChild(other)}}
    else{el=document.createElement('input');el.type=type==='computed'?'number':'text';if(!['computed','computed-text'].includes(type))el.type=type||'text';if(['computed','computed-text'].includes(type)){el.readOnly=true;el.classList.add('computed-field')}}
    el.dataset.key=key;
    let initialValue=record?.data?.[key]??'';
    if(isAwareness&&key==='type_sensibilisation'&&!initialValue)initialValue=record?.data?.theme||record?.title||'';
    if(isAwareness&&key==='date_activite'&&!initialValue)initialValue=(record?.event_date||'').slice(0,10);
    if(isMinefActivity&&key==='date_activite'&&!initialValue)initialValue=(record?.event_date||'').slice(0,10);
    if(isForest&&key==='date_activite'&&!initialValue)initialValue=(record?.event_date||'').slice(0,10);
    if(isFire&&key==='date_constat'&&!initialValue)initialValue=(record?.event_date||'').slice(0,10);
    if(isFauna&&key==='date_observation'&&!initialValue)initialValue=(record?.event_date||'').slice(0,10);
    if(isFormation&&key==='date_activite'&&!initialValue)initialValue=(record?.event_date||'').slice(0,10);
    if(isMission&&editorMissionType==='PV_INFRACTION'&&key==='date_pv'&&!initialValue)initialValue=(record?.event_date||'').slice(0,10);
    el.value=initialValue;
    if(isConvocationPv&&!record&&key==='lieu_rencontre')el.value=session?.user?.organizationName||'';
    if(isStage&&!record&&key==='qualite_stagiaire')el.value='élève Sous-officier';
    if(isStage&&!record&&editorStageType==='MISE_STAGE'&&key==='note_service_origine')el.value='Direction des Ressources Humaines et de la Formation du Ministère des Eaux et Forêts';
    if(isServiceDocument&&!record&&key==='option_emploi')el.value='Eaux et Forêts';
    if(isServiceDocument&&!record&&editorDocumentType==='CESSATION_SERVICE'&&key==='decision_objet')el.value='portant mutation des Agents Techniques du Ministère des Eaux et Forêts';
    if(isServiceDocument&&!record&&editorDocumentType==='CESSATION_SERVICE'&&key==='ancien_service')el.value=session?.user?.organizationName||'';
    if(isServiceDocument&&!record&&editorDocumentType==='CESSATION_CONGE'&&key==='type_conge')el.value='congé administratif annuel';
    if(isServiceDocument&&!record&&editorDocumentType==='CESSATION_CONGE'&&key==='annee_conge')el.value=String(new Date().getFullYear());
    if(isServiceDocument&&!record&&editorDocumentType==='REPRISE_SERVICE'&&key==='type_conge')el.value='congé administratif';
    if(isServiceDocument&&!record&&editorDocumentType==='REPRISE_SERVICE'&&key==='service_reprise')el.value=session?.user?.organizationName||'';
    if(isServiceDocument&&!record&&editorDocumentType==='PRISE_SERVICE_MUTATION'&&key==='decision_objet')el.value='portant mutation des Agents Techniques du Ministère des Eaux et Forêts';
    if(isServiceDocument&&!record&&editorDocumentType==='PRISE_SERVICE_MUTATION'&&key==='nouvelle_affectation')el.value=session?.user?.organizationName||'';
    if(isExplanationDocument&&!record&&key==='civilite')el.value='Monsieur';
    if(isExplanationDocument&&!record&&key==='service_affectation')el.value=session?.user?.organizationName||'';
    if(isExplanationDocument&&!record&&key==='delai_reponse_heures')el.value='48';
    wrap.appendChild(el);area.appendChild(wrap);
  }
  if(!isPersonnel){
    const ampliationsWrap=document.createElement('div');
    ampliationsWrap.className='field full ampliations-toggle-field document-ampliations-field';
    const ampliationsChecked=['1','true','yes','oui'].includes(String(record?.data?._show_ampliations||'').toLowerCase());
    const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
    const hasDocumentAmpliations=hasOwn(record?.data,'_ampliations');
    const hasDocumentAmpliationNumbers=hasOwn(record?.data,'_ampliation_numbers');
    const initialAmpliations=hasDocumentAmpliations?String(record?.data?._ampliations||''):String(printSettingsCache?.ampliations||'');
    const initialAmpliationNumbers=hasDocumentAmpliationNumbers?String(record?.data?._ampliation_numbers||''):String(printSettingsCache?.ampliationNumbers||'');
    ampliationsWrap.innerHTML=`<div class="document-ampliations-head"><div><strong>AMPLIATIONS du document</strong><small>Les destinataires sont préremplis depuis Paramètres → En-tête des imprimés. Vous pouvez les modifier ici : ces changements resteront propres à ce document et ne modifieront ni les paramètres généraux ni les autres documents.</small></div><label class="ampliations-toggle"><input type="checkbox" data-key="_show_ampliations" ${ampliationsChecked?'checked':''}><span><strong>Afficher sur le PDF</strong><small>Active ou masque les ampliations uniquement pour ce document.</small></span></label></div><div class="document-ampliations-grid"><div class="field"><label>Destinataires / ampliations</label><textarea rows="5" data-key="_ampliations" placeholder="Un destinataire par ligne">${esc(initialAmpliations)}</textarea></div><div class="field"><label>Nombres / exemplaires</label><textarea rows="5" data-key="_ampliation_numbers" placeholder="Un nombre par ligne">${esc(initialAmpliationNumbers)}</textarea></div></div>`;
    area.appendChild(ampliationsWrap);
    if(!hasDocumentAmpliations||!hasDocumentAmpliationNumbers){
      const docId=String(record?.id||'');
      ensurePrintSettings().then(settings=>{
        const currentId=String(document.getElementById('recordId')?.value||'');
        if(currentId!==docId)return;
        const dest=ampliationsWrap.querySelector('[data-key="_ampliations"]');
        const nums=ampliationsWrap.querySelector('[data-key="_ampliation_numbers"]');
        if(!hasDocumentAmpliations&&dest&&!dest.value.trim())dest.value=String(settings?.ampliations||'');
        if(!hasDocumentAmpliationNumbers&&nums&&!nums.value.trim())nums.value=String(settings?.ampliationNumbers||'');
      }).catch(()=>{});
    }
  }
  if(isAbsence){
    const start=document.querySelector('#dynamicFields [data-key="date_debut"]');
    const end=document.querySelector('#dynamicFields [data-key="date_fin"]');
    start?.addEventListener('change',updateAbsenceDays);end?.addEventListener('change',updateAbsenceDays);updateAbsenceDays();
  }
  if(isForest)mountForestEditorLogic(record);
  if(isWood)mountWoodEditorLogic(record);
  if(isFire)mountFireEditorLogic(record);
  if(isMission)mountMissionEditorLogic(record);
  if(isFormation)mountFormationEditorLogic(record);
  if(isMinefActivity)mountMinefActivityEditorLogic(record);
  const foot=d.querySelector('.dialog-foot');foot?.querySelector('[data-pv-print-dialog]')?.remove();
  if(isMission&&editorMissionType==='PV_INFRACTION'&&record&&foot){const b=document.createElement('button');b.type='button';b.className='btn btn-secondary';b.dataset.pvPrintDialog='1';b.textContent='Imprimer le P-V';b.addEventListener('click',e=>withButtonLock(e.currentTarget,()=>printRecord(record),'Préparation…'));foot.insertBefore(b,foot.lastElementChild)}
  d.showModal();
  mountSmartAutofill(record);
  mountHistorySuggestions(record);
}


async function fetchOwnModuleItems(module,extra={}){
  const out=[];let page=1,totalPages=1;
  do{
    const q=new URLSearchParams({module,page:String(page),limit:'100',search:'',ownedOnly:'1'});
    Object.entries(extra||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null&&String(v)!=='')q.set(k,String(v))});
    const r=await api(`/api/load?${q.toString()}`);out.push(...(r.items||[]));totalPages=Number(r.totalPages||1);page++;
  }while(page<=totalPages&&page<=100);
  return out;
}
function editorFieldWrap(key){return document.querySelector(`#dynamicFields [data-field-key="${key}"]`)}
function setFieldVisibility(key,show,{clear=false}={}){const w=editorFieldWrap(key);if(!w)return;w.hidden=!show;if(!show&&clear){const el=w.querySelector('[data-key]');if(el)el.value=''}}
async function mountFireEditorLogic(record=null){
  if(!['REDYNAMISE','RENOUVELE'].includes(editorFireType))return;
  const area=document.getElementById('dynamicFields');if(!area)return;
  const q=k=>area.querySelector(`[data-key="${k}"]`);
  const village=q('village'),departement=q('departement'),sous=q('sous_prefecture'),acte=q('acte_creation'),president=q('president_nom'),contact=q('president_contact');
  if(!village)return;
  const currentVillage=String(record?.data?.village||village.value||'');
  try{
    const created=await fetchOwnModuleItems('feux-brousse',{fireType:'CREE'});
    const rows=created
      .filter(r=>String(r?.data?.village||'').trim())
      .sort((a,b)=>String(a.data?.village||'').localeCompare(String(b.data?.village||''),'fr',{sensitivity:'base'}));
    village.innerHTML='<option value="">— Sélectionner un comité créé —</option>';
    rows.forEach(r=>{
      const d=r.data||{};const op=document.createElement('option');
      op.value=String(d.village||'');
      op.textContent=[d.village,d.sous_prefecture,d.departement].filter(Boolean).join(' — ');
      op.dataset.departement=String(d.departement||'');op.dataset.sousPrefecture=String(d.sous_prefecture||'');op.dataset.acte=String(d.acte_creation||'');op.dataset.president=String(d.president_nom||'');op.dataset.contact=String(d.president_contact||'');op.dataset.sourceId=String(r.id||'');
      village.appendChild(op);
    });
    if(currentVillage && !Array.from(village.options).some(o=>o.value===currentVillage)){
      const legacy=document.createElement('option');legacy.value=currentVillage;legacy.textContent=`${currentVillage} — comité enregistré`;village.appendChild(legacy);
    }
    village.value=currentVillage;
  }catch(e){
    console.warn('Liste des comités créés',e);
    if(currentVillage){const op=document.createElement('option');op.value=currentVillage;op.textContent=currentVillage;village.appendChild(op);village.value=currentVillage}
  }
  const autofill=()=>{
    const op=village.selectedOptions?.[0];if(!op||!op.value)return;
    if(departement)departement.value=op.dataset.departement||departement.value||'';
    if(sous)sous.value=op.dataset.sousPrefecture||sous.value||'';
    if(acte)acte.value=op.dataset.acte||acte.value||'';
    if(president)president.value=op.dataset.president||president.value||'';
    if(contact)contact.value=op.dataset.contact||contact.value||'';
  };
  village.addEventListener('change',autofill);
  // Pour une nouvelle redynamisation / un nouveau renouvellement, le choix du village
  // récupère automatiquement les informations du comité créé. Tous les champs restent modifiables.
  if(!record && village.value)autofill();
}

async function mountMissionEditorLogic(record=null){
  const area=document.getElementById('dynamicFields');if(!area)return;
  const q=k=>area.querySelector(`[data-key="${k}"]`);
  if(editorMissionType==='REALISEE'){
    const mission=q('libelle_mission'),other=q('libelle_mission_autre'),chef=q('chef_mission'),numero=q('numero_mission');if(numero&&!record)numero.placeholder='Attribué automatiquement à l’enregistrement';
    try{
      const dispositions=await fetchOwnModuleItems('missions',{missionType:'DISPOSITION'});
      if(mission){
        const current=String(record?.data?.libelle_mission||mission.value||'');
        mission.innerHTML='<option value="">— Sélectionner —</option>'+dispositions.map(r=>`<option value="${esc(r.data?.libelle_mission||r.title||'')}">${esc(r.data?.libelle_mission||r.title||'')}</option>`).join('')+'<option value="Autre">Autre</option>';
        mission.value=current;
      }
      const agents=await fetchOwnModuleItems('personnel');
      if(chef){const current=String(record?.data?.chef_mission||chef.value||'');chef.innerHTML='<option value="">— Sélectionner —</option>'+agents.map(r=>`<option value="${esc(r.title||'')}">${esc(r.title||'')}${r.data?.matricule?` — ${esc(r.data.matricule)}`:''}</option>`).join('');chef.value=current}
    }catch(e){console.warn('Préremplissage mission',e)}
    const updateOther=()=>setFieldVisibility('libelle_mission_autre',String(mission?.value||'')==='Autre',{clear:String(mission?.value||'')!=='Autre'});
    mission?.addEventListener('change',updateOther);updateOther();
  }
  if(editorMissionType==='REPRESSION'){
    const linked=q('liee_mission'),mission=q('mission_liee_id');
    try{
      const realised=await fetchOwnModuleItems('missions',{missionType:'REALISEE'});
      if(mission){const current=String(record?.data?.mission_liee_id||mission.value||'');mission.innerHTML='<option value="">— Sélectionner —</option>'+realised.map(r=>{const d=r.data||{};const label=`${d.numero_mission||r.reference||`Mission ${r.id}`} — ${d.libelle_mission==='Autre'?d.libelle_mission_autre:(d.libelle_mission||r.title||'')}`;return `<option value="${r.id}">${esc(label)}</option>`}).join('');mission.value=current}
    }catch(e){console.warn('Liste missions réalisées',e)}
    const updateLink=()=>{const yes=String(linked?.value||'').toLowerCase()==='oui';setFieldVisibility('mission_liee_id',yes,{clear:!yes});setFieldVisibility('agents_arrestation',!yes,{clear:yes})};
    linked?.addEventListener('change',updateLink);updateLink();
  }
}
function mountMinefActivityEditorLogic(record=null){
  const type=document.querySelector('#dynamicFields [data-key="type_activite"]');if(!type)return;
  const update=()=>{
    const minef=normalizeWoodText(type.value)==='activites du minef';
    setFieldVisibility('categorie_minef',minef,{clear:!minef});
  };
  type.addEventListener('change',update);update();
}

function mountFormationEditorLogic(record=null){
  const theme=document.querySelector('#dynamicFields [data-key="theme"]');if(!theme)return;
  const update=()=>{const other=normalizeWoodText(theme.value).startsWith('autres');setFieldVisibility('theme_autre',other,{clear:!other})};
  theme.addEventListener('change',update);update();
}

async function saveRecord(e){
  e.preventDefault();
  if(moduleKey==='absences'||(moduleKey==='documents'&&editorDocumentType==='ABSENCE'))updateAbsenceDays();
  const submit=e.submitter||document.querySelector('#recordForm button[type="submit"]');
  return withButtonLock(submit,async()=>{
    const id=document.getElementById('recordId').value;const data={};
    document.querySelectorAll('#dynamicFields [data-key]').forEach(el=>data[el.dataset.key]=el.type==='checkbox'?(el.checked?'1':'0'):el.value);
    if(moduleKey==='stages')data._stage_type=editorStageType;
    if(moduleKey==='documents'&&editorDocumentType!=='ABSENCE')data._document_type=editorDocumentType;
    const payload={id:id?Number(id):undefined,reference:document.getElementById('recordReference').value,title:document.getElementById('recordTitle').value,eventDate:document.getElementById('recordDate').value,status:document.getElementById('recordStatus').value,data};
    if(moduleKey==='personnel'){
      payload.eventDate=data.date_prise_service_gbeke||data.date_prise_service_minef||'';
      payload.status='ACTIVE';
    }
    if(moduleKey==='activites-minef'){
      if(normalizeWoodText(data.type_activite)!=='activites du minef')data.categorie_minef='';
      payload.title=data.intitule_activite||'Activité';
      payload.eventDate=data.date_activite||'';
      payload.status='ACTIVE';
      payload.reference=payload.reference||'';
    }
    if(moduleKey==='sensibilisations'){
      payload.title=data.type_sensibilisation||'Sensibilisation';
      payload.eventDate=data.date_activite||'';
      payload.status='ACTIVE';
      payload.reference=payload.reference||'';
    }
    if(moduleKey==='exploitation-forestiere'){
      data._forest_type=editorForestType;
      payload.eventDate=data.date_activite||'';
      payload.status='ACTIVE';
      payload.reference=payload.reference||'';
      payload.title=editorForestType==='RECHERCHE_PARCELLAIRE'?`${data.localite||'Parcelle'}${data.essence?` — ${data.essence}`:''}`:editorForestType==='PEPINIERE'?`${data.localisation||'Pépinière'}${data.essence?` — ${data.essence}`:''}`:editorForestType==='PLANTATION_CREEE'?`${data.beneficiaire||data.localite||'Plantation forestière'}`:`${data.beneficiaire||data.localite||'Reboisement'}${data.type_reboisement?` — ${data.type_reboisement}`:''}`;
      if(editorForestType==='REBOISEMENT'&&normalizeForestText(data.type_reboisement)!=='compensatoires suivis')data.entreprise_responsable='';
    }
    if(moduleKey==='transformation-bois'){
      data._wood_type=editorWoodType;
      payload.status='ACTIVE';payload.reference=payload.reference||'';
      if(editorWoodType==='EXPLOITANTS_SECONDAIRES'){
        payload.title=data.nom_operateur||'Exploitant de produits secondaires';payload.eventDate=data.date_delivrance||'';
      }else if(editorWoodType==='PRODUITS_QTE'){
        payload.title=`Produits secondaires — ${data.statut_operateur||'opérateur'}`;payload.eventDate='';
      }else{
        const isUnit=normalizeWoodText(data.type_exercant)==='unites de transformation';
        payload.title=(isUnit?data.nom_usine:data.nom_operateur)||data.localite||'Unité / exerçant du bois';payload.eventDate=data.date_delivrance||'';
        if(isUnit){data.service_rattachement='';data.numero_permis='';data.date_delivrance=''}else{data.region='';data.departement='';data.nom_usine='';data.activites_principales=''}
      }
    }
    if(moduleKey==='feux-brousse'){
      data._fire_type=editorFireType;payload.status='ACTIVE';payload.reference=payload.reference||'';
      if(editorFireType==='DEGATS'){payload.eventDate=data.date_constat||'';payload.title=`${data.village||'Dégâts'} — ${data.nature_degats||'Feu de brousse'}`}
      else{payload.eventDate='';payload.title=`${data.village||'Comité'} — ${fireConfig(editorFireType)?.label||'Comité de lutte contre les feux de brousse'}`}
    }
    if(moduleKey==='faune'){
      data._fauna_type=editorFaunaType;payload.status='ACTIVE';payload.reference=payload.reference||'';
      if(editorFaunaType==='OBSERVATIONS'){payload.eventDate=data.date_observation||'';payload.title=data.especes_animales||'Observation de la faune'}
      else{payload.eventDate='';payload.title=`${data.village||'Conflit'} — ${data.type_conflit||'Conflit homme-faune'}`}
    }
    if(moduleKey==='formations'){
      const isOther=normalizeWoodText(data.theme).startsWith('autres');if(!isOther)data.theme_autre='';
      payload.title=isOther?(data.theme_autre||'Autre formation'):(data.theme||'Formation');payload.eventDate=data.date_activite||'';payload.status='ACTIVE';payload.reference=payload.reference||'';
    }
    if(moduleKey==='missions'){
      payload.status='ACTIVE';payload.reference=payload.reference||'';
      if(editorMissionType==='PV_INFRACTION'){
        data._mission_type='PV_INFRACTION';payload.eventDate=data.date_pv||'';payload.title=payload.title||`P-V — ${data.personne_mise_cause||'Infraction'}`;
      }else if(editorMissionType==='DISPOSITION'){
        data._mission_type='DISPOSITION';payload.eventDate='';payload.title=data.libelle_mission||'Disposition de mission de contrôle';
      }else if(editorMissionType==='REALISEE'){
        data._mission_type='REALISEE';if(String(data.libelle_mission||'')!=='Autre')data.libelle_mission_autre='';payload.eventDate='';payload.title=(data.libelle_mission==='Autre'?data.libelle_mission_autre:data.libelle_mission)||'Mission de contrôle réalisée';
      }else if(editorMissionType==='REPRESSION'){
        data._offense_type='REPRESSION';data._mission_type='REPRESSION';const linked=String(data.liee_mission||'').toLowerCase()==='oui';
        if(linked){data.agents_arrestation='';const sel=document.querySelector('#dynamicFields [data-key="mission_liee_id"]');data.mission_liee_label=sel?.selectedOptions?.[0]?.textContent||data.mission_liee_label||''}else{data.mission_liee_id='';data.mission_liee_label=''}
        payload.eventDate='';payload.title=data.personne_mise_cause||data.objet_infraction||'Répression d’infraction';
      }
    }
    const saveModule=moduleKey==='documents'?effectiveModule(editorDocumentType):(moduleKey==='convocations'&&editorConvocationView==='PV'?'convocation_pv':(moduleKey==='missions'?effectiveModule(editorMissionType):moduleKey));
    try{await api('/api/save',{method:'POST',body:{module:saveModule,action:id?'update':'create',payload}});document.getElementById('editorDialog').close();await professionalAlert('Enregistrement réussi',`${activeSingular()} enregistré(e) avec succès.`);loadRecords()}catch(err){await professionalAlert('Enregistrement impossible',err.message);}
  },'Enregistrement…');
}

async function archiveRecord(r,button){
  const yes=await professionalConfirm('Confirmer l’archivage',`Voulez-vous archiver « ${r.title} » ? L’historique sera conservé.`,{confirmText:'Archiver'});
  if(!yes)return;
  const actionModule=moduleKey==='documents'?effectiveModule(currentDocumentType):(moduleKey==='convocations'&&currentConvocationView==='PV'?'convocation_pv':(moduleKey==='missions'?effectiveModule(currentMissionType):moduleKey));
  return withButtonLock(button,async()=>{try{await api('/api/save',{method:'POST',body:{module:actionModule,action:'archive',payload:{id:r.id}}});await professionalAlert('Archivage effectué','L’élément a été archivé avec succès.');loadRecords()}catch(e){await professionalAlert('Archivage impossible',e.message)}},'Archivage…');
}

async function deleteRecord(r,button){
  const yes=await professionalConfirm('Supprimer définitivement',`Voulez-vous supprimer définitivement « ${r.title} » ? Cette action est irréversible.`,{confirmText:'Supprimer',cancelText:'Annuler',danger:true});
  if(!yes)return;
  const actionModule=moduleKey==='documents'?effectiveModule(currentDocumentType):(moduleKey==='convocations'&&currentConvocationView==='PV'?'convocation_pv':(moduleKey==='missions'?effectiveModule(currentMissionType):moduleKey));
  return withButtonLock(button,async()=>{try{await api('/api/save',{method:'POST',body:{module:actionModule,action:'delete',payload:{id:r.id}}});await professionalAlert('Suppression effectuée','L’enregistrement a été supprimé définitivement.');loadRecords()}catch(e){await professionalAlert('Suppression impossible',e.message)}},'Suppression…');
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
/* V1.20 — Marges et typographie finales de tous les imprimés PDF */
@page{size:A4 portrait;margin:1.5cm 1.2cm 1.2cm 1.2cm}
.document-title{font-family:"Cooper Black",Cooper,serif!important;font-size:20pt!important}
.record-print .official-body,.record-print .official-body *,
.record-print .absence-body,.record-print .absence-body *,
.record-print .convocation-body,.record-print .convocation-body *,
.record-print .agent-sheet,.record-print .agent-sheet *,
.record-print .official-signature,.record-print .official-signature *{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:13pt!important}
.list-print .official-body,.list-print .official-body *,
.list-print table,.list-print table *{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:13pt!important}
.record-print .official-signature{right:1.2cm}
.official-footer{display:none!important}

/* V1.21 — Bloc date + signature flexible, sans chevauchement */
body.record-print{
  min-height:270mm;
  padding-bottom:0!important;
  display:flex;
  flex-direction:column;
}
.record-print .print-main{flex:0 0 auto;min-width:0}
.record-print .official-signature,
.record-print.convocation-print .official-signature{
  position:static!important;
  right:auto!important;
  bottom:auto!important;
  width:43%;
  margin-left:auto;
  margin-top:auto;
  padding-top:9mm;
  text-align:center;
  break-inside:avoid!important;
  page-break-inside:avoid!important;
  flex:0 0 auto;
  line-height:1.2;
}
.record-print .official-body,
.record-print .absence-body,
.record-print .agent-sheet,
.record-print.convocation-print .official-body{margin-bottom:0!important}
.official-signature .made-at{
  margin:0 0 5mm;
  line-height:1.2;
  text-align:center;
  white-space:normal;
}
.official-signature .signer-title{
  margin:0 0 7mm;
  line-height:1.2;
  text-align:center;
}
.official-signature .signature-media{
  min-height:18mm;
  height:auto;
  display:flex;
  justify-content:center;
  align-items:flex-end;
  gap:4mm;
  position:relative;
  margin:0 0 3mm;
}
.official-signature .signature-image{
  max-width:42mm;
  max-height:18mm;
  width:auto;
  height:auto;
  object-fit:contain;
  position:static;
}
.official-signature .stamp-image{
  max-width:24mm;
  max-height:24mm;
  width:auto;
  height:auto;
  object-fit:contain;
  position:static;
  opacity:.82;
}
.official-signature .signer-name{
  margin:0;
  line-height:1.2;
  text-align:center;
  overflow-wrap:anywhere;
}
.official-signature .signer-position{
  margin-top:1.5mm;
  line-height:1.2;
  text-align:center;
  overflow-wrap:anywhere;
}
@media print{
  body.record-print{min-height:270mm}
  .record-print .official-signature{break-inside:avoid!important;page-break-inside:avoid!important}
}

/* V1.22 — Typographie spécifique : Autorisations d’absence uniquement */
.record-print.absence-print .document-title{
  font-family:"Cooper Black",Cooper,serif!important;
  font-size:22pt!important;
}
.record-print.absence-print .absence-body,
.record-print.absence-print .absence-body *{
  font-family:"Arial Narrow",Arial,sans-serif!important;
  font-size:14pt!important;
  line-height:1.5!important;
}
.record-print.absence-print .absence-body .request,
.record-print.absence-print .absence-body p{
  line-height:1.5!important;
}

/* V1.23 — AMPLIATIONS et zone basse flexible */
.official-bottom-row{
  width:100%;
  margin-top:auto;
  padding-top:9mm;
  display:grid;
  grid-template-columns:minmax(0,1fr) minmax(0,1fr);
  gap:8mm;
  align-items:end;
  break-inside:avoid;
  page-break-inside:avoid;
  flex:0 0 auto;
}
.official-bottom-row .official-signature{
  position:static!important;
  right:auto!important;
  bottom:auto!important;
  width:100%!important;
  margin:0!important;
  padding-top:0!important;
  align-self:end;
}
.official-ampliations-placeholder{min-width:0}
.official-ampliations{
  min-width:0;
  align-self:end;
  font-family:"Arial Narrow",Arial,sans-serif!important;
  font-size:12pt!important;
  line-height:1.15;
  text-align:left;
  overflow-wrap:anywhere;
}
.official-ampliations .ampliations-title{
  font-family:"Arial Narrow",Arial,sans-serif!important;
  font-size:14pt!important;
  line-height:1.15;
  font-weight:800;
  text-decoration:underline;
  text-underline-offset:2px;
  margin-bottom:2.5mm;
}
.official-ampliations .ampliations-content{
  display:table;
  width:56mm;
  max-width:100%;
  border-collapse:collapse;
  table-layout:fixed;
}
.official-ampliations .ampliation-row{display:table-row}
.official-ampliations .ampliation-label{
  display:table-cell;
  width:47mm;
  min-width:0;
  overflow-wrap:anywhere;
  padding:.65mm 0;
  vertical-align:baseline;
}
.official-ampliations .ampliation-number{
  display:table-cell;
  width:9mm;
  padding:.65mm 0;
  text-align:center;
  font-weight:700;
  white-space:nowrap;
  vertical-align:baseline;
}
@media print{
  .official-bottom-row{break-inside:avoid!important;page-break-inside:avoid!important}
}

/* V1.27 — Attestations de mise et fin de stage */
.record-print.stage-print .stage-document-title{
  width:88%;
  margin:24px auto 38px;
  border:1.2px solid #111;
  padding:7px 10px;
  text-align:center;
  font-family:"Cooper Black",Cooper,serif!important;
  font-size:20pt!important;
  font-weight:900;
  line-height:1.05;
  letter-spacing:.01em;
}
.record-print.stage-print .stage-body,
.record-print.stage-print .stage-body *{
  font-family:"Arial Narrow",Arial,sans-serif!important;
  font-size:13pt!important;
}
.record-print.stage-print .stage-body{width:94%;line-height:1.35;text-align:justify}
.record-print.stage-print .stage-body p{line-height:1.35;margin:0 0 1.55em;text-align:justify}

/* V1.29 — Certificats de cessation / reprise de service */
.record-print.service-document-print .service-document-title{margin-top:28px;margin-bottom:42px}
.record-print.service-document-print .service-document-body,
.record-print.service-document-print .service-document-body *{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:13pt!important}
.record-print.service-document-print .service-document-body{width:92%;line-height:1.35;text-align:justify}
.record-print.service-document-print .service-document-body p{line-height:1.35;margin:0 0 1.65em;text-align:justify}

/* V1.32 — Procès-verbal lié à une convocation */
.record-print.pv-print .pv-body,
.record-print.pv-print .pv-body *{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:13pt!important}
.record-print.pv-print .pv-body{width:92%;line-height:1.35;text-align:justify}
.record-print.pv-print .pv-body p{line-height:1.35;margin:0 0 1.55em;text-align:justify;white-space:normal}
.record-print.pv-print .document-title{margin-top:30px;margin-bottom:40px}

/* V1.35 — Demande d’explication écrite */
.record-print.explanation-print .explanation-document-title{margin-top:28px;margin-bottom:30px}
.record-print.explanation-print .explanation-body,
.record-print.explanation-print .explanation-body *{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:13pt!important}
.record-print.explanation-print .explanation-body{width:96%;line-height:1.35;text-align:justify}
.record-print.explanation-print .explanation-address{width:90%;margin:0 auto 7mm!important;text-align:center!important;line-height:1.35!important}
.record-print.explanation-print .explanation-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:0 auto 8mm;font-size:13pt!important}
.record-print.explanation-print .explanation-table th{border:1px solid #111;background:#fff;color:#111;text-align:center;font-weight:900;padding:2.5mm 2mm;line-height:1.1}
.record-print.explanation-print .explanation-table td{border:1px solid #111;width:50%;height:88mm;min-height:88mm;vertical-align:top;padding:4mm 3mm;text-align:justify;line-height:1.35}
.record-print.explanation-print .explanation-text,.record-print.explanation-print .explanation-response{white-space:normal;overflow-wrap:anywhere}
.record-print.explanation-print .explanation-deadline{margin:8mm 0 0!important;line-height:1.35!important;text-align:justify!important}

/* V1.40 — Liste générale du personnel en A4 paysage */
.list-print.personnel-list-print .personnel-list-title{font-family:"Cooper Black",Cooper,serif!important;font-size:20pt!important;margin:16px 0 18px!important;line-height:1.05!important}
.list-print.personnel-list-print .official-header{margin-bottom:5mm;min-height:0}
.list-print.personnel-list-print .official-body{width:100%!important;margin:0!important}
.list-print.personnel-list-print .personnel-print-table{width:100%;table-layout:fixed;border-collapse:collapse;font-family:"Arial Narrow",Arial,sans-serif!important;font-size:7.2pt!important;line-height:1.05!important}
.list-print.personnel-list-print .personnel-print-table th,
.list-print.personnel-list-print .personnel-print-table td{font-family:"Arial Narrow",Arial,sans-serif!important;font-size:7.2pt!important;line-height:1.05!important;border:1px solid #555;padding:1.5mm .8mm;vertical-align:middle;overflow-wrap:anywhere;word-break:normal}
.list-print.personnel-list-print .personnel-print-table th{font-weight:800;text-align:center;background:#f2f4f3;color:#111}
.list-print.personnel-list-print .personnel-print-table td:first-child{text-align:center;width:5%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(1){width:4%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(2){width:13%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(3){width:4%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(4){width:6%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(5){width:8%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(6){width:8%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(7){width:6%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(8){width:8%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(9){width:9%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(10){width:6%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(11){width:5%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(12){width:5%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(13){width:7%}
.list-print.personnel-list-print .personnel-print-table th:nth-child(14){width:11%}

/* V1.37 — En-tête général : 10 pt, interligne 1, seul le chiffre de référence en rouge/gras */
.official-left,
.official-right,
.official-reference{
  font-size:10pt!important;
  line-height:1!important;
}
.official-left .admin-line,
.official-right .motto,
.official-reference{
  line-height:1!important;
}
.official-left .admin-separator,
.official-right .admin-separator{
  line-height:1!important;
}
.official-reference .reference-prefix,
.official-reference .reference-nondigit,
.official-reference .reference-suffix{
  color:#111!important;
  font-weight:500!important;
}
.official-reference .reference-number{
  color:#d00000!important;
  font-weight:900!important;
}
.official-ampliations{
  font-size:10pt!important;
  line-height:1.15!important;
  font-weight:400!important;
}
.official-ampliations .ampliations-title{
  font-size:12pt!important;
  line-height:1.15!important;
  font-weight:800!important;
}
.official-ampliations .ampliation-label,
.official-ampliations .ampliation-number{
  font-size:10pt!important;
  line-height:1.15!important;
  font-weight:400!important;
}

/* V1.45 — Fiche de renseignement de l’agent, A4 portrait professionnelle */
@page{size:A4 portrait;margin:1.5cm 1.2cm 1.2cm 1.2cm}
body.list-print.personnel-sheet-print{font-family:"Arial Narrow",Arial,sans-serif!important;padding-bottom:0!important}
.personnel-sheet-print .official-header{margin-bottom:3mm;min-height:0}
.personnel-sheet-print .official-reference{margin:1.5mm 0 5mm!important}
.personnel-sheet-print .agent-profile-title{
  width:78%;margin:0 auto 5mm;padding:3.2mm 5mm 2.8mm;
  background:linear-gradient(135deg,#074c42,#0a6c5b);color:#fff;
  border-radius:3mm;box-shadow:0 1.2mm 2.5mm rgba(0,0,0,.12);
  text-align:center;border-bottom:1mm solid #c89b2c;
}
.personnel-sheet-print .agent-profile-title-main{
  font-family:"Cooper Black",Cooper,serif!important;font-size:18pt!important;
  line-height:1.05!important;font-weight:900!important;letter-spacing:.02em;
}
.personnel-sheet-print .agent-profile-subtitle{
  font-family:"Arial Narrow",Arial,sans-serif!important;font-size:8.5pt!important;
  line-height:1.15!important;letter-spacing:.11em;margin-top:1.5mm;font-weight:500!important;
}
.personnel-sheet-print .agent-profile{width:100%;font-family:"Arial Narrow",Arial,sans-serif!important;font-size:9.6pt!important;line-height:1.1!important}
.personnel-sheet-print .agent-profile *{font-family:"Arial Narrow",Arial,sans-serif!important}
.personnel-sheet-print .agent-profile-section{
  border:1px solid #a9c9c2;border-radius:2mm;overflow:hidden;margin:0 0 3.2mm;background:#fff;break-inside:avoid;page-break-inside:avoid;
}
.personnel-sheet-print .agent-section-title{
  background:linear-gradient(90deg,#064b43,#0b6d5f);color:#fff;font-size:10.5pt!important;
  font-weight:900!important;line-height:1!important;padding:2.3mm 4mm;letter-spacing:.01em;
}
.personnel-sheet-print .agent-section-number{color:#e2b342;font-size:11pt!important;margin-right:1.2mm}
.personnel-sheet-print .agent-identity-layout{display:grid;grid-template-columns:minmax(0,1fr) 34mm;gap:4mm;padding:3mm 4mm 3.5mm;align-items:stretch}
.personnel-sheet-print .agent-identity-fields{display:grid;grid-template-columns:1fr;gap:1.7mm}
.personnel-sheet-print .agent-photo-frame{display:flex;align-items:center;justify-content:center;border-left:1px solid #d4e4e0;padding-left:3mm}
.personnel-sheet-print .agent-sheet-photo{width:31mm!important;height:38mm!important;object-fit:cover;border:1px solid #075548!important;border-radius:2mm!important;background:#f2f6f5}
.personnel-sheet-print .agent-sheet-photo-empty{display:grid!important;place-items:center;color:#83918d;font-size:8pt!important;font-weight:800!important}
.personnel-sheet-print .agent-info-row{display:grid;grid-template-columns:43% 57%;min-height:8.4mm;border:1px solid #dbe7e4;border-radius:1.2mm;overflow:hidden;background:#fff}
.personnel-sheet-print .agent-info-label{display:flex;align-items:center;padding:1.4mm 3mm;background:#eef5f3;color:#183f38;font-size:9pt!important;line-height:1.05!important;font-weight:800!important}
.personnel-sheet-print .agent-info-value{display:flex;align-items:center;padding:1.4mm 3mm;color:#111;font-size:9.6pt!important;line-height:1.05!important;font-weight:700!important;min-width:0;overflow-wrap:anywhere}
.personnel-sheet-print .agent-professional-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm;padding:3mm 4mm 3.5mm}
.personnel-sheet-print .agent-professional-grid>div{display:grid;gap:1.7mm;align-content:start}
.personnel-sheet-print .agent-split-sections{display:grid;grid-template-columns:1.12fr .88fr;gap:3mm;align-items:stretch}
.personnel-sheet-print .agent-split-sections .agent-profile-section{margin-bottom:3.2mm;height:100%}
.personnel-sheet-print .agent-section-content{padding:3mm 4mm;display:grid;gap:1.7mm}
.personnel-sheet-print .agent-contact-section{margin-bottom:0}
.personnel-sheet-print .agent-contact-layout{display:grid;grid-template-columns:minmax(0,1fr) 58mm;gap:5mm;align-items:center;padding:3mm 4mm 3.5mm}
.personnel-sheet-print .agent-contact-field{min-width:0}
.personnel-sheet-print .agent-signature-box-wrap{display:grid;grid-template-columns:auto 32mm;gap:2.5mm;align-items:center;justify-content:end;font-size:9pt!important;white-space:nowrap}
.personnel-sheet-print .agent-signature-box{height:14mm;border:1px solid #075548;border-radius:1.5mm;background:#fff}
@media print{
  .personnel-sheet-print .agent-profile,.personnel-sheet-print .agent-profile-section{break-inside:avoid!important;page-break-inside:avoid!important}
}

`}


function settingsLine(v){return String(v||'').trim()}
function adminLineHtml(v){const s=settingsLine(v);return s?`<div class="admin-line">${esc(s)}</div><div class="admin-separator">- - - - - -</div>`:''}
function formattedReference(reference,s){
  const raw=String(reference||'').trim();
  const prefix=settingsLine(s.referencePrefix);
  let number='____________', suffix=prefix;
  if(raw&&raw!=='—'){
    const slashIndex=raw.indexOf('/');
    if(slashIndex>=0){
      number=raw.slice(0,slashIndex).replace(/^N[°ºo]?\s*/i,'').trim()||'____________';
      suffix=raw.slice(slashIndex+1).trim()||prefix;
    }else{
      number=raw.replace(/^N[°ºo]?\s*/i,'').trim()||'____________';
    }
  }
  // Seuls les chiffres du numéro deviennent rouges et gras. Le préfixe N°,
  // les séparateurs/lettres éventuels et le suffixe administratif restent noirs.
  const numberHtml=Array.from(number).map(ch=>/\d/.test(ch)
    ?`<span class="reference-number">${esc(ch)}</span>`
    :`<span class="reference-nondigit">${esc(ch)}</span>`).join('');
  return `<span class="reference-prefix">N°</span>${numberHtml}${suffix?`/<span class="reference-suffix">${esc(suffix)}</span>`:''}`;
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
function normalizedAmpliationRows(s){
  const destinations=String(s?.ampliations||'').replace(/\r/g,'').split('\n');
  const numbers=String(s?.ampliationNumbers||'').replace(/\r/g,'').split('\n');
  const rows=[];
  destinations.forEach((raw,i)=>{
    const label=String(raw||'').trim().replace(/^[-–—•*]+\s*/,'');
    if(!label)return;
    rows.push({label,number:String(numbers[i]||'').trim()});
  });
  return rows;
}
function officialAmpliationsHtml(s){
  const rows=normalizedAmpliationRows(s);
  if(!rows.length)return '<div class="official-ampliations-placeholder"></div>';
  const content=rows.map(row=>`<div class="ampliation-row"><div class="ampliation-label">- ${esc(row.label)}</div><div class="ampliation-number">${row.number?esc(row.number):''}</div></div>`).join('');
  return `<div class="official-ampliations"><div class="ampliations-title">AMPLIATIONS</div><div class="ampliations-content">${content}</div></div>`;
}
function officialFooterHtml(){return ''}

function buildPrintDocument({title,body,reference='',date='',settings,signature=true,hideReference=false,documentClass='',showAmpliations=false}){
  const bodyClass=(signature?'record-print':'list-print')+(documentClass?` ${documentClass}`:'');
  const bottom=signature?`<div class="official-bottom-row">${showAmpliations&&settingsLine(settings.ampliations)?officialAmpliationsHtml(settings):'<div class="official-ampliations-placeholder"></div>'}${officialSignatureHtml(settings,date)}</div>`:'';
  const orientationStyle=documentClass.includes('personnel-list-print')?'@page{size:A4 landscape;margin:1.5cm 1.2cm 1.2cm 1.2cm}':'';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title||'Document')}</title><style>${printBaseStyles()}${orientationStyle}</style></head><body class="${bodyClass}"><main class="print-main">${officialHeaderHtml(settings,{reference,hideReference})}${body}</main>${bottom}</body></html>`;
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

function stageDate(v){
  if(!v)return '—';
  const d=new Date(`${String(v).slice(0,10)}T00:00:00Z`);if(Number.isNaN(d.getTime()))return fmtDate(v);
  const weekdays=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  const months=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${weekdays[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2,'0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function stageShortDate(v){
  if(!v)return '—';
  const d=new Date(`${String(v).slice(0,10)}T00:00:00Z`);if(Number.isNaN(d.getTime()))return fmtDate(v);
  const months=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
  return `${String(d.getUTCDate()).padStart(2,'0')} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function stageTime(v){
  const m=String(v||'').match(/^(\d{1,2}):(\d{2})/);if(!m)return String(v||'—');
  return `${String(m[1]).padStart(2,'0')} h ${m[2]} mn`;
}
function stageResponsibleIntro(record){
  const org=String(record.source_organization||session?.user?.organizationName||'Service des Eaux et Forêts').trim();
  const type=record.source_type||session?.user?.organizationType;
  if(type==='PEF'){
    const m=org.match(/poste\s+(?:des\s+)?eaux\s+et\s+for[eê]ts\s+de\s+(.+)/i);
    return `Le Chef de poste des Eaux et Forêts de ${m?m[1]:org}`;
  }
  if(type==='CANTONNEMENT')return `Le Chef de Cantonnement de ${org.replace(/^Cantonnement\s+(?:de\s+)?/i,'')}`;
  if(type==='DIRECTION_REGIONALE')return `Le Directeur Régional de ${org.replace(/^Direction\s+Régionale\s+(?:du|de la|de l’|de l')?\s*/i,'')}`;
  if(type==='DIRECTION_DEPARTEMENTALE')return `Le Directeur Départemental de ${org.replace(/^Direction\s+Départementale\s+(?:de\s+)?/i,'')}`;
  return `Le Responsable de ${org}`;
}

async function printRecord(record){
  try{
    const s=await ensurePrintSettings();
    let body='';let title='';
    if(moduleKey==='stages'){
      const d=record.data||{};const stageType=stageTypeOf(record);const org=record.source_organization||session?.user?.organizationName||'Service des Eaux et Forêts';
      const intro=stageResponsibleIntro(record);const qual=String(d.qualite_stagiaire||'élève Sous-officier').trim();
      const ident=`${esc(qual)} <strong>${esc(record.title)}</strong>${d.matricule_stagiaire?` <strong>(${esc(d.matricule_stagiaire)})</strong>`:''}`;
      if(stageType==='MISE_STAGE'){
        const months=Number(d.duree_mois||0);const duration=months?`${esc(frenchNumber(months))} (${String(months).padStart(2,'0')}) mois`:'—';
        title='ATTESTATION DE MISE EN STAGE';
        body=`<div class="stage-document-title">ATTESTATION DE MISE EN STAGE</div><div class="official-body stage-body"><p>${esc(intro)}, soussigné(e), atteste que ${ident}, mis(e) en stage par la note de service <strong>N° ${esc(displayValue(d.note_service_numero))}</strong> du <strong>${esc(stageShortDate(d.note_service_date))}</strong>${d.note_service_origine?` émanant de <strong>${esc(d.note_service_origine)}</strong>`:''}, a effectivement commencé son stage au <strong>${esc(org)}</strong> le <strong>${esc(stageDate(d.date_debut))}</strong> à <strong>${esc(stageTime(d.heure_debut))}</strong>.</p><p>En outre, cette période d’apprentissage s’étendra sur une durée de <strong>${duration}</strong> allant du <strong>${esc(stageDate(d.date_debut))}</strong> au <strong>${esc(stageDate(d.date_fin))}</strong> inclus.</p><p>Ce stage aura pour thème : <strong>« ${esc(displayValue(d.theme))} »</strong>.</p><p>En foi de quoi, la présente attestation de mise en stage lui est délivrée, pour servir et valoir ce que de droit partout où besoin sera.</p></div>`;
      }else{
        title='ATTESTATION DE FIN DE STAGE';
        body=`<div class="stage-document-title">ATTESTATION DE FIN DE STAGE</div><div class="official-body stage-body"><p>${esc(intro)}, soussigné(e), atteste que ${ident}${d.niveau_recrutement?`, recrue de niveau <strong>${esc(d.niveau_recrutement)}</strong>`:''}, mis(e) à la disposition du <strong>${esc(org)}</strong> sur la période allant du <strong>${esc(stageDate(d.date_debut))}</strong> au <strong>${esc(stageDate(d.date_fin))}</strong> suivant la lettre de mise en stage <strong>N° ${esc(displayValue(d.lettre_mise_stage_numero))}</strong> du <strong>${esc(stageShortDate(d.lettre_mise_stage_date))}</strong> a effectivement suivi avec assiduité et intérêt le stage sur ladite période.</p><p>En foi de quoi, il est établi la présente attestation de fin de stage pour servir et valoir ce que de droit.</p></div>`;
      }
    }else if(moduleKey==='documents'&&currentDocumentType==='CESSATION_SERVICE'){
      const d=record.data||{};const intro=stageResponsibleIntro(record);
      const employment=[d.emploi,d.option_emploi?`(Option ${d.option_emploi})`:'' ].filter(Boolean).join(' ');
      const identity=`${d.grade_appellation?`${esc(d.grade_appellation)} `:''}<strong>${esc(record.title)}</strong>${d.matricule?`, Matricule <strong>${esc(d.matricule)}</strong>`:''}${employment?`, ${esc(employment)}`:''}${d.classe?` de <strong>${esc(d.classe)}</strong>`:''}${d.echelon?`, <strong>${esc(d.echelon)}</strong>`:''}`;
      const decisionText=[d.decision_numero?`par Décision <strong>N° ${esc(d.decision_numero)}</strong>`:'',d.decision_date?`du <strong>${esc(stageShortDate(d.decision_date))}</strong>`:'',d.decision_objet?esc(d.decision_objet):''].filter(Boolean).join(' ');
      title='CERTIFICAT DE CESSATION DE SERVICE';
      body=`<div class="document-title service-document-title">CERTIFICAT DE CESSATION DE SERVICE</div><div class="official-body service-document-body"><p>${esc(intro)}, soussigné(e), atteste que ${identity}${d.ancien_service?`, précédemment en service au <strong>${esc(d.ancien_service)}</strong>`:''}${d.nouvelle_affectation?` et muté au <strong>${esc(d.nouvelle_affectation)}</strong>`:''}${decisionText?` ${decisionText}`:''}, cesse service le <strong>${esc(stageDate(d.date_cessation))}</strong> pour rejoindre son nouveau poste d’affectation.</p><p>En foi de quoi, le présent certificat est établi pour servir et valoir ce que de droit.</p></div>`;
    }else if(moduleKey==='documents'&&currentDocumentType==='CESSATION_CONGE'){
      const d=record.data||{};const intro=stageResponsibleIntro(record);const days=Number(d.duree_conge_jours||0);const duration=days?`${esc(frenchNumber(days))} (${String(days).padStart(2,'0')}) jours`:'— jour(s)';
      const employment=[d.emploi,d.option_emploi?`(Option ${d.option_emploi})`:'' ].filter(Boolean).join(' ');
      const identity=`${d.grade_appellation?`${esc(d.grade_appellation)} `:''}<strong>${esc(record.title)}</strong>${d.matricule?`, Matricule <strong>${esc(d.matricule)}</strong>`:''}${employment?`, ${esc(employment)}`:''}${d.classe?` <strong>${esc(d.classe)}</strong>`:''}${d.echelon?`, <strong>${esc(d.echelon)}</strong>`:''}`;
      const leaveType=String(d.type_conge||'congé administratif annuel').trim();
      title='CERTIFICAT DE CESSATION DE SERVICE';
      body=`<div class="document-title service-document-title">CERTIFICAT DE CESSATION DE SERVICE</div><div class="official-body service-document-body"><p>${esc(intro)}, soussigné(e), certifie que ${identity}, bénéficiaire d’un <strong>${esc(leaveType)}</strong> de <strong>${duration}</strong>${d.annee_conge?` au titre de l’année <strong>${esc(d.annee_conge)}</strong>`:''}${d.decision_numero?` conformément à la décision <strong>N° ${esc(d.decision_numero)}</strong>`:''}${d.decision_date?` du <strong>${esc(stageShortDate(d.decision_date))}</strong>`:''}${d.decision_autorite?` de <strong>${esc(d.decision_autorite)}</strong>`:''}, cesse ses activités professionnelles le <strong>${esc(stageShortDate(d.date_cessation))}</strong>${d.lieu_conge?` pour en jouir à ses frais à <strong>${esc(d.lieu_conge)}</strong>`:''}.</p><p>À l’issue de ce ${esc(leaveType)}${days?` de <strong>${esc(days)} jours</strong>`:''}, l’intéressé(e) reprendra service à son poste habituel le <strong>${esc(stageShortDate(d.date_reprise_prevue))}</strong>${d.heure_reprise_prevue?` à <strong>${esc(stageTime(d.heure_reprise_prevue))}</strong>`:''}.</p><p>En foi de quoi, le présent certificat est établi pour servir et valoir ce que de droit.</p></div>`;
    }else if(moduleKey==='documents'&&currentDocumentType==='REPRISE_SERVICE'){
      const d=record.data||{};const intro=stageResponsibleIntro(record);const days=Number(d.duree_conge_jours||0);const duration=days?`${esc(frenchNumber(days))} (${String(days).padStart(2,'0')}) jours`:'— jour(s)';
      const employment=[d.emploi,d.option_emploi?`(Option ${d.option_emploi})`:'' ].filter(Boolean).join(' ');
      const identity=`${d.grade_appellation?`${esc(d.grade_appellation)} `:''}<strong>${esc(record.title)}</strong>${d.matricule?`, Matricule <strong>${esc(d.matricule)}</strong>`:''}${employment?`, ${esc(employment)}`:''}${d.classe?` de <strong>${esc(d.classe)}</strong>`:''}${d.echelon?`, <strong>${esc(d.echelon)}</strong>`:''}`;
      const leaveType=String(d.type_conge||'congé administratif').trim();
      const resumePlace=d.service_reprise?`à son ancien poste, <strong>${esc(d.service_reprise)}</strong>`:'à son ancien poste';
      title='CERTIFICAT DE REPRISE DE SERVICE';
      body=`<div class="document-title service-document-title">CERTIFICAT DE REPRISE DE SERVICE</div><div class="official-body service-document-body"><p>${esc(intro)}, soussigné(e), certifie que ${identity}, qui a cessé ses activités professionnelles le <strong>${esc(stageShortDate(d.date_cessation))}</strong>${d.certificat_cessation_numero?` conformément au certificat de cessation de service <strong>N° ${esc(d.certificat_cessation_numero)}</strong>`:''}${d.certificat_cessation_date?` du <strong>${esc(stageShortDate(d.certificat_cessation_date))}</strong>`:''}${d.certificat_cessation_origine?` émanant de <strong>${esc(d.certificat_cessation_origine)}</strong>`:''} pour bénéficier de <strong>${duration}</strong> de ${esc(leaveType)}${d.decision_numero?` suivant la décision <strong>N° ${esc(d.decision_numero)}</strong>`:''}${d.decision_date?` du <strong>${esc(stageShortDate(d.decision_date))}</strong>`:''}${d.decision_autorite?` de <strong>${esc(d.decision_autorite)}</strong>`:''} a repris le service ${resumePlace} le <strong>${esc(stageShortDate(d.date_reprise))}</strong>${d.heure_reprise?` à <strong>${esc(stageTime(d.heure_reprise))}</strong>`:''}.</p><p>En foi de quoi, le présent certificat est établi pour servir et valoir ce que de droit.</p></div>`;
    }else if(moduleKey==='documents'&&currentDocumentType==='PRISE_SERVICE_MUTATION'){
      const d=record.data||{};const intro=stageResponsibleIntro(record);
      const employment=[d.emploi,d.option_emploi?`(Option ${d.option_emploi})`:'' ].filter(Boolean).join(' ');
      const identity=`${d.grade_appellation?`${esc(d.grade_appellation)} `:''}<strong>${esc(record.title)}</strong>${d.matricule?`, Matricule <strong>${esc(d.matricule)}</strong>`:''}${employment?`, ${esc(employment)}`:''}${d.categorie?`, Catégorie <strong>${esc(d.categorie)}</strong>`:''}${d.grade_administratif?`, Grade <strong>${esc(d.grade_administratif)}</strong>`:''}${d.classe?`, <strong>${esc(d.classe)}</strong>`:''}${d.echelon?`, <strong>${esc(d.echelon)}</strong>`:''}`;
      const decisionText=[d.decision_numero?`suivant la Décision <strong>N° ${esc(d.decision_numero)}</strong>`:'',d.decision_date?`du <strong>${esc(stageShortDate(d.decision_date))}</strong>`:'',d.decision_objet?esc(d.decision_objet):''].filter(Boolean).join(' ');
      title='CERTIFICAT DE PRISE DE SERVICE';
      body=`<div class="document-title service-document-title">CERTIFICAT DE PRISE DE SERVICE</div><div class="official-body service-document-body"><p>${esc(intro)}, soussigné(e), certifie que ${identity}${d.ancien_service?`, précédemment en service au <strong>${esc(d.ancien_service)}</strong>`:''}${d.nouvelle_affectation?`, muté(e) au <strong>${esc(d.nouvelle_affectation)}</strong>`:''}${decisionText?`, ${decisionText}`:''}, a pris service le <strong>${esc(stageDate(d.date_prise_service))}</strong> à son nouveau poste.</p><p>En foi de quoi, le présent certificat de prise de service est établi pour servir et valoir ce que de droit.</p></div>`;
    }else if(moduleKey==='documents'&&currentDocumentType==='DEMANDE_EXPLICATION'){
      const d=record.data||{};
      const civilite=String(d.civilite||'Monsieur').trim();
      const matricule=String(d.matricule||'').trim();
      const emploi=String(d.emploi_qualite||'').trim();
      const service=String(d.service_affectation||record.source_organization||session?.user?.organizationName||'').trim();
      const texte=String(d.texte_demande||'').trim();
      const reponse=String(d.reponse_agent||'').trim();
      const delai=Number(d.delai_reponse_heures||48);
      const delaiTexte=Number.isFinite(delai)&&delai>0?String(delai):'48';
      title='DEMANDE D’EXPLICATION ÉCRITE';
      body=`<div class="document-title explanation-document-title">DEMANDE D’EXPLICATION ÉCRITE</div><div class="official-body explanation-body"><p class="explanation-address">Adressée à <strong>${esc(civilite)} ${esc(record.title)}</strong>${matricule?`, matricule <strong>${esc(matricule)}</strong>`:''}${emploi?`, <strong>${esc(emploi)}</strong>`:''}${service?`, en service au <strong>${esc(service)}</strong>`:''}.</p><table class="explanation-table"><thead><tr><th>TEXTE</th><th>RÉPONSE</th></tr></thead><tbody><tr><td><div class="explanation-text">${esc(texte).split('\n').join('<br>')}</div><p class="explanation-deadline">Veuillez expliquer dans un délai de <strong>${esc(delaiTexte)} heures</strong> cette situation.</p></td><td><div class="explanation-response">${reponse?esc(reponse).split('\n').join('<br>'):'&nbsp;'}</div></td></tr></tbody></table></div>`;
    }else if(moduleKey==='absences'||(moduleKey==='documents'&&currentDocumentType==='ABSENCE')){
      const d=record.data||{};
      const days=Number(d.nombre_jours||inclusiveDays(d.date_debut,d.date_fin)||0);
      const dayText=days?`${frenchNumber(days)} (${String(days).padStart(2,'0')})`:'—';
      const org=record.source_organization||session?.user?.organizationName||'Service des Eaux et Forêts';
      const phrase=`Une autorisation d’absence de <strong>${esc(dayText)} jour${days>1?'s':''}</strong> allant du <strong>${esc(longFrDate(d.date_debut))}</strong> au <strong>${esc(longFrDate(d.date_fin))}</strong> inclus est accordée à <strong>${esc([d.grade,record.title].filter(Boolean).join(' '))}</strong>${d.matricule?`, Matricule <strong>${esc(d.matricule)}</strong>`:''}${d.emploi?`, ${esc(d.emploi)}`:''} en service au <strong>${esc(org)}</strong>${d.destination?` en vue de se rendre à <strong>${esc(d.destination)}</strong>`:''}${d.motif?` pour ${esc(d.motif)}`:''}.`;
      title='AUTORISATION D’ABSENCE';
      body=`<div class="document-title">AUTORISATION D’ABSENCE</div><div class="absence-body"><div class="request">Vu la demande d’absence en date du <strong>${esc(longFrDate(d.date_demande))}</strong>,</div><p>${phrase}</p></div>`;
    }else if(moduleKey==='convocations'&&currentConvocationView==='CONVOCATIONS'){
      const d=record.data||{};
      const civ=String(d.civilite||'M.').trim();
      const presentDate=d.date_presentation?longFrDate(d.date_presentation):'—';
      const presentTime=d.heure?String(d.heure).slice(0,5):'—';
      const structure=record.source_organization||session?.user?.organizationName||'Poste des Eaux et Forêts';
      const objectText=String(d.objet_convocation||d.motif||'').trim();
      const personText=String(d.personne_a_voir||d.voir||'').trim();
      title='CONVOCATION';
      body=`<div class="document-title">CONVOCATION</div><div class="official-body convocation-body"><div class="convocation-intro">Est prié(e) de bien vouloir se présenter au <strong>${esc(structure)}</strong><br>muni d’une pièce d’identité</div><table class="convocation-table"><tbody><tr><td class="convocation-label">M./Mme/Mlle</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(`${civ} ${record.title}`.trim())}</td></tr><tr><td class="convocation-label">Profession</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(displayValue(d.profession))}</td></tr><tr><td class="convocation-label">Domicile</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(displayValue(d.domicile))}</td></tr><tr><td class="convocation-label">Date</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(presentDate)}</td></tr><tr><td class="convocation-label">Heures</td><td class="convocation-colon">:</td><td class="convocation-value">${esc(presentTime)}</td></tr></tbody></table><div class="convocation-section"><div class="convocation-section-title">Objet de la convocation :</div><div class="convocation-box">${esc(objectText)}</div></div><div class="convocation-section"><div class="convocation-person-box"><span class="label">Personne à voir</span><span>:</span><span class="value">${esc(personText)}</span></div></div><p class="convocation-final">Votre présence à la date et à l’heure indiquée est nécessaire.</p></div>`;
    }else if(moduleKey==='convocations'&&currentConvocationView==='PV'){
      const d=record.data||{};
      const meetingDate=d.date_rencontre?longFrDate(d.date_rencontre):'—';
      const start=d.heure_debut?stageTime(d.heure_debut):'—';
      const end=d.heure_fin?stageTime(d.heure_fin):'';
      const sourceRef=String(d.convocation_reference||'').trim();
      const place=String(d.lieu_rencontre||record.source_organization||session?.user?.organizationName||'').trim();
      title='PROCÈS-VERBAL DE RENCONTRE';
      body=`<div class="document-title">PROCÈS-VERBAL DE RENCONTRE</div><div class="official-body pv-body"><p>Le <strong>${esc(meetingDate)}</strong> à <strong>${esc(start)}</strong>${end?`, jusqu’à <strong>${esc(end)}</strong>`:''}, s’est tenue à <strong>${esc(place||'—')}</strong> une rencontre faisant suite à la convocation${sourceRef?` <strong>N° ${esc(sourceRef)}</strong>`:''} adressée à <strong>${esc(d.personne_convoquee||record.title)}</strong>${d.profession?`, ${esc(d.profession)}`:''}${d.domicile?`, domicilié(e) à ${esc(d.domicile)}`:''}.</p><p><strong>Objet de la rencontre :</strong><br>${esc(displayValue(d.objet_rencontre))}</p>${d.personne_a_voir?`<p><strong>Responsable / personne ayant reçu le convoqué :</strong><br>${esc(d.personne_a_voir)}</p>`:''}${d.personnes_presentes?`<p><strong>Personnes présentes :</strong><br>${esc(d.personnes_presentes).split('\n').join('<br>')}</p>`:''}<p><strong>Déroulement / résumé des échanges :</strong><br>${esc(displayValue(d.resume_echanges)).split('\n').join('<br>')}</p><p><strong>Conclusions / décisions arrêtées :</strong><br>${esc(displayValue(d.conclusions_decisions)).split('\n').join('<br>')}</p>${d.observations?`<p><strong>Observations :</strong><br>${esc(d.observations).split('\n').join('<br>')}</p>`:''}<p>En foi de quoi, le présent procès-verbal est établi pour servir et valoir ce que de droit.</p></div>`;
    }else if(moduleKey==='exploitation-forestiere'){
      const d=record.data||{};const type=forestTypeOf(record);const cfg=forestConfig(type)||{};
      title=String(cfg.label||'Exploitation forestière').toUpperCase();
      const dataRows=(cfg.fields||[]).filter(([k])=>!['_forest_type'].includes(k)).map(([k,l])=>`<div><span class="label">${esc(l)}</span><span class="value">${esc(displayValue(d[k]))}</span></div>`).join('');
      body=`<div class="document-title">${esc(title)}</div><div class="official-body"><div class="meta"><div><span class="label">Date</span><span class="value">${esc(fmtDate(d.date_activite||record.event_date))}</span></div><div><span class="label">Service source</span><span class="value">${esc(record.source_organization||session?.user?.organizationName||'')}</span></div></div><div class="data">${dataRows}</div></div>`;
    }else if(moduleKey==='transformation-bois'){
      const d=record.data||{};const type=woodTypeOf(record);const cfg=woodConfig(type)||{};
      title=String(cfg.label||'Transformation du bois').toUpperCase();
      let dataRows='';
      if(type==='PRODUITS_QTE'){
        const rows=[
          ['Statut de l’opérateur',d.statut_operateur],['Charbon de bois — Qté (sac)',d.charbon_qte_sacs],['Charbon de bois — Nbr carnet',d.charbon_nbr_carnet],
          ['Bois de feu — Qté (T)',d.bois_feu_qte_t],['Bois de feu — Nbr carnet',d.bois_feu_nbr_carnet],['Mortiers — Qté (T)',d.mortiers_qte_t],['Mortiers — Nbr carnet',d.mortiers_nbr_carnet],
          ['Kinkeliba — Qté (T)',d.kinkeliba_qte_t],['Kinkeliba — Nbr carnet',d.kinkeliba_nbr_carnet],['Fruit de karité — Qté (T)',d.karite_qte_t],['Fruit de karité — Nbr carnet',d.karite_nbr_carnet],
          ['Bambou de chine — Qté (T)',d.bambou_qte_t],['Bambou de chine — Nbr carnet',d.bambou_nbr_carnet]
        ];
        dataRows=rows.map(([l,v])=>`<div><span class="label">${esc(l)}</span><span class="value">${esc(displayValue(v))}</span></div>`).join('');
      }else{
        dataRows=woodVisibleFields(type,d).map(([k,l])=>`<div><span class="label">${esc(l)}</span><span class="value">${esc(displayValue(d[k]))}</span></div>`).join('');
      }
      body=`<div class="document-title">${esc(title)}</div><div class="official-body"><div class="meta"><div><span class="label">Service source</span><span class="value">${esc(record.source_organization||session?.user?.organizationName||'')}</span></div>${record.event_date?`<div><span class="label">Date</span><span class="value">${esc(fmtDate(record.event_date))}</span></div>`:''}</div><div class="data">${dataRows}</div></div>`;
    }else if(['feux-brousse','faune','missions','formations'].includes(moduleKey)){
      const d=record.data||{};
      let dynTitle=activeSingular(record).toUpperCase();
      if(moduleKey==='feux-brousse')dynTitle=String(fireConfig(fireTypeOf(record))?.label||dynTitle).toUpperCase();
      if(moduleKey==='faune')dynTitle=String(faunaConfig(faunaTypeOf(record))?.label||dynTitle).toUpperCase();
      if(moduleKey==='missions')dynTitle=missionTypeOf(record)==='PV_INFRACTION'?'PROCÈS-VERBAL D’INFRACTION':String(missionConfig(missionTypeOf(record))?.label||dynTitle).toUpperCase();
      if(moduleKey==='formations')dynTitle='FORMATION / RENFORCEMENT DES CAPACITÉS';
      title=dynTitle;
      const rows=activeFields(record).filter(([, ,t])=>t!=='section').map(([k,l,t])=>{
        if(t==='image')return d[k]?`<div class="print-photo-row"><span class="label">${esc(l)}</span><span class="value"><img src="${esc(d[k])}" alt="${esc(l)}" style="max-width:42mm;max-height:35mm;object-fit:contain"></span></div>`:'';
        let value=d[k];
        if(t==='date')value=fmtDate(value);
        if(k==='mission_liee_id'&&value){value=`Mission liée #${value}`}
        return `<div><span class="label">${esc(l)}</span><span class="value">${esc(displayValue(value))}</span></div>`;
      }).join('');
      body=`<div class="document-title">${esc(title)}</div><div class="official-body"><div class="meta"><div><span class="label">Nom / Intitulé</span><span class="value">${esc(record.title)}</span></div><div><span class="label">Service source</span><span class="value">${esc(record.source_organization||session?.user?.organizationName||'')}</span></div></div><div class="data">${rows}</div></div>`;
    }else if(moduleKey==='personnel'){
      const d=record.data||{};
      const v=key=>esc(displayValue(d[key]));
      title='FICHE DE RENSEIGNEMENT DE L’AGENT';
      const photoHtml=d.photo?`<img class="agent-sheet-photo" src="${esc(d.photo)}" alt="Photo de l’agent">`:`<div class="agent-sheet-photo agent-sheet-photo-empty">PHOTO</div>`;
      const field=(label,value)=>`<div class="agent-info-row"><span class="agent-info-label">${esc(label)}</span><span class="agent-info-value">${value}</span></div>`;
      body=`<div class="agent-profile-title"><div class="agent-profile-title-main">FICHE DE RENSEIGNEMENT DE L’AGENT</div><div class="agent-profile-subtitle">INFORMATIONS PERSONNELLES ET PROFESSIONNELLES</div></div><div class="agent-profile"><section class="agent-profile-section agent-identity-section"><div class="agent-section-title"><span class="agent-section-number">1.</span> IDENTITÉ DE L’AGENT</div><div class="agent-identity-layout"><div class="agent-identity-fields">${field('Nom et prénoms',esc(record.title))}${field('Matricule',v('matricule'))}${field('Sexe',v('sexe'))}${field('Date de naissance',esc(fmtDate(d.date_naissance)))}</div><div class="agent-photo-frame">${photoHtml}</div></div></section><section class="agent-profile-section"><div class="agent-section-title"><span class="agent-section-number">2.</span> SITUATION PROFESSIONNELLE</div><div class="agent-professional-grid"><div>${field('Emploi',v('emploi'))}${field('Fonction',v('fonction'))}</div><div>${field('Grade',v('grade'))}${field('Classe',v('classe'))}${field('Échelon',v('echelon'))}</div></div></section><div class="agent-split-sections"><section class="agent-profile-section"><div class="agent-section-title"><span class="agent-section-number">3.</span> INFORMATIONS ADMINISTRATIVES</div><div class="agent-section-content">${field('Date de prise de service au MINEF',esc(fmtDate(d.date_prise_service_minef)))}${field('Date de prise de service dans la Région de Gbêkê',esc(fmtDate(d.date_prise_service_gbeke)))}</div></section><section class="agent-profile-section"><div class="agent-section-title"><span class="agent-section-number">4.</span> SITUATION PARTICULIÈRE</div><div class="agent-section-content">${field('Handicap',v('handicap'))}</div></section></div><section class="agent-profile-section agent-contact-section"><div class="agent-section-title"><span class="agent-section-number">5.</span> COORDONNÉES</div><div class="agent-contact-layout"><div class="agent-contact-field">${field('Numéro de téléphone',v('telephone'))}</div><div class="agent-signature-box-wrap"><span>Signature de l’agent</span><div class="agent-signature-box"></div></div></div></section></div>`;
    }else{
      title=(config?.singular||'Document').toUpperCase();
      const dataRows=(config?.fields||[]).filter(([k])=>k!=='photo').map(([k,l])=>`<div><span class="label">${esc(l)}</span><span class="value">${esc(displayValue(record.data?.[k]))}</span></div>`).join('');
      body=`<div class="document-title">${esc(title)}</div><div class="official-body"><div class="meta"><div><span class="label">Référence</span><span class="value">${esc(displayValue(record.reference))}</span></div><div><span class="label">Date</span><span class="value">${esc(fmtDate(record.event_date))}</span></div><div><span class="label">Nom / Intitulé</span><span class="value">${esc(record.title)}</span></div><div><span class="label">Statut</span><span class="value">${esc(record.status)}</span></div><div><span class="label">Service source</span><span class="value">${esc(record.source_organization||session?.user?.organizationName||'')}</span></div></div><div class="data">${dataRows}</div></div>`;
    }
    const showAmpliations=['1','true','yes','oui'].includes(String(record.data?._show_ampliations||'').toLowerCase());
    const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj||{},key);
    const documentSettings={...s};
    if(hasOwn(record.data,'_ampliations'))documentSettings.ampliations=String(record.data?._ampliations||'');
    if(hasOwn(record.data,'_ampliation_numbers'))documentSettings.ampliationNumbers=String(record.data?._ampliation_numbers||'');
    const documentClass=moduleKey==='convocations'?(currentConvocationView==='PV'?'pv-print':'convocation-print'):(moduleKey==='absences'||(moduleKey==='documents'&&currentDocumentType==='ABSENCE'))?'absence-print':moduleKey==='stages'?'stage-print':moduleKey==='personnel'?'personnel-sheet-print':(moduleKey==='documents'&&['CESSATION_SERVICE','CESSATION_CONGE','REPRISE_SERVICE','PRISE_SERVICE_MUTATION'].includes(currentDocumentType))?'service-document-print':(moduleKey==='documents'&&currentDocumentType==='DEMANDE_EXPLICATION')?'explanation-print':'';
    const html=buildPrintDocument({title,body,reference:record.reference,date:record.event_date,settings:documentSettings,signature:moduleKey!=='personnel',showAmpliations:moduleKey==='personnel'?false:showAmpliations,documentClass});
    await launchPrint(html);
  }catch(e){await professionalAlert('Impression impossible',e.message||'Le document n’a pas pu être préparé.');}
}

async function loadAllPersonnelForPrint(){
  const scope=new URLSearchParams(location.search).get('scopeOrg');
  const items=[];let page=1,totalPages=1;
  do{
    const q=new URLSearchParams({module:'personnel',page:String(page),limit:'100',search:''});
    if(scope)q.set('scopeOrg',scope);
    const d=await api(`/api/load?${q.toString()}`);
    items.push(...(d.items||[]));
    totalPages=Number(d.totalPages||1);page++;
  }while(page<=totalPages&&page<=200);
  return items;
}
function personnelListTitle(settings){
  const raw=settingsLine(settings?.post)||String(session?.user?.organizationName||'POSTE DES EAUX ET FORETS DE DIABO');
  const structure=raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
  return `LISTE DU PERSONNEL DU ${structure}`;
}

async function printCurrentList(){
  if(!lastItems.length){await professionalAlert('Impression','Aucune donnée à imprimer sur cette page.');return}
  try{
    const s=await ensurePrintSettings();
    if(moduleKey==='personnel'){
      const personnel=await loadAllPersonnelForPrint();
      if(!personnel.length){await professionalAlert('Impression','Aucun agent à imprimer.');return}
      const rows=personnel.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(r.title)}</td><td>${esc(displayValue(d.sexe))}</td><td>${esc(displayValue(d.matricule))}</td><td>${esc(displayValue(d.emploi))}</td><td>${esc(displayValue(d.fonction))}</td><td>${esc(fmtDate(d.date_naissance))}</td><td>${esc(fmtDate(d.date_prise_service_minef))}</td><td>${esc(fmtDate(d.date_prise_service_gbeke))}</td><td>${esc(displayValue(d.grade))}</td><td>${esc(displayValue(d.classe))}</td><td>${esc(displayValue(d.echelon))}</td><td>${esc(displayValue(d.handicap))}</td><td>${esc(displayValue(d.telephone))}</td></tr>`}).join('');
      const title=personnelListTitle(s);
      const body=`<div class="document-title personnel-list-title">${esc(title)}</div><div class="official-body wide"><table class="personnel-print-table"><thead><tr><th>N° d’ordre</th><th>Nom et prénoms</th><th>Sexe</th><th>Matricule</th><th>Emploi</th><th>Fonction</th><th>Date de naissance</th><th>Prise de service au MINEF</th><th>Prise de service Région de Gbêkê</th><th>Grade</th><th>Classe</th><th>Échelon</th><th>Handicap</th><th>N° téléphone</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      const html=buildPrintDocument({title,body,settings:s,signature:false,hideReference:true,documentClass:'personnel-list-print'});
      await launchPrint(html);return;
    }
    if(moduleKey==='exploitation-forestiere'){
      const cfg=forestConfig(currentForestType)||{};const title=`REGISTRE — ${String(cfg.label||'EXPLOITATION FORESTIÈRE').toUpperCase()}`;
      let headers=[],rows='';
      if(currentForestType==='PEPINIERE'){
        headers=['N°','Date','Localisation','Sous-préfecture','Essence','Produits','Distribués','Disponibles','Responsable'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.localisation))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.nbr_plants_produits))}</td><td>${esc(displayValue(d.nbr_plants_distribues))}</td><td>${esc(displayValue(d.nbr_plants_disponibles))}</td><td>${esc(displayValue(d.contact_responsable))}</td></tr>`}).join('');
      }else if(currentForestType==='PLANTATION_CREEE'){
        headers=['N°','Date','Localité','Bénéficiaire','Contact','Superficie','Essence','Densité','Total plants','Coordonnées'];
        rows=lastItems.map((r,i)=>{const d=r.data||{},coord=[d.coord_x,d.coord_y].filter(Boolean).join(' / ')||'—';return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(displayValue(d.beneficiaire))}</td><td>${esc(displayValue(d.contact_beneficiaire))}</td><td>${esc(displayValue(d.superficie))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.densite))}</td><td>${esc(displayValue(d.nombre_total_plants))}</td><td>${esc(coord)}</td></tr>`}).join('');
      }else if(currentForestType==='REBOISEMENT'){
        headers=['N°','Date','Type','Localité','Bénéficiaire','Contact','Superficie','Essence','Densité','Total plants','Entreprise'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.type_reboisement))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(displayValue(d.beneficiaire))}</td><td>${esc(displayValue(d.contact_beneficiaire))}</td><td>${esc(displayValue(d.superficie))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.densite))}</td><td>${esc(displayValue(d.nombre_total_plants))}</td><td>${esc(displayValue(d.entreprise_responsable))}</td></tr>`}).join('');
      }else{
        headers=['N°','Date','Sous-préfecture','Localité','Essence','Superficie','Coordonnées','Contact propriétaire'];
        rows=lastItems.map((r,i)=>{const d=r.data||{},coord=[d.coord_x,d.coord_y].filter(Boolean).join(' / ')||'—';return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(displayValue(d.essence))}</td><td>${esc(displayValue(d.superficie_parcelle))}</td><td>${esc(coord)}</td><td>${esc(displayValue(d.contact_proprietaire))}</td></tr>`}).join('');
      }
      const body=`<div class="document-title">${esc(title)}</div><div class="official-body wide"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
      const html=buildPrintDocument({title,body,settings:s,signature:false,hideReference:true});await launchPrint(html);return;
    }
    if(moduleKey==='transformation-bois'){
      const cfg=woodConfig(currentWoodType)||{};const title=`REGISTRE — ${String(cfg.label||'TRANSFORMATION DU BOIS').toUpperCase()}`;
      let headers=[],rows='';
      if(currentWoodType==='EXPLOITANTS_SECONDAIRES'){
        headers=['N°','Opérateur','Contact','Produit exploité','N° permis','Date délivrance','Localité','Service de suivi'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(displayValue(d.nom_operateur||r.title))}</td><td>${esc(displayValue(d.contact))}</td><td>${esc(displayValue(d.nature_produit))}</td><td>${esc(displayValue(d.numero_permis))}</td><td>${esc(fmtDate(d.date_delivrance||r.event_date))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(displayValue(d.service_suivi))}</td></tr>`}).join('');
      }else if(currentWoodType==='PRODUITS_QTE'){
        headers=['N°','Statut','Charbon','Bois de feu','Mortiers','Kinkeliba','Fruit de karité','Bambou de chine'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(displayValue(d.statut_operateur))}</td><td>${esc(woodProductSummary(d.charbon_qte_sacs,d.charbon_nbr_carnet,'sac'))}</td><td>${esc(woodProductSummary(d.bois_feu_qte_t,d.bois_feu_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.mortiers_qte_t,d.mortiers_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.kinkeliba_qte_t,d.kinkeliba_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.karite_qte_t,d.karite_nbr_carnet,'T'))}</td><td>${esc(woodProductSummary(d.bambou_qte_t,d.bambou_nbr_carnet,'T'))}</td></tr>`}).join('');
      }else{
        headers=['N°','Type','Région','Département','Localité','Usine / opérateur','Contact','Coordonnées','Permis'];
        rows=lastItems.map((r,i)=>{const d=r.data||{},coord=[d.coord_x,d.coord_y].filter(Boolean).join(' / ')||'—';const name=d.nom_usine||d.nom_operateur||r.title||'—';const permit=[d.numero_permis,d.date_delivrance?fmtDate(d.date_delivrance):''].filter(Boolean).join(' / ')||'—';return `<tr><td>${i+1}</td><td>${esc(displayValue(d.type_exercant))}</td><td>${esc(displayValue(d.region))}</td><td>${esc(displayValue(d.departement))}</td><td>${esc(displayValue(d.localite))}</td><td>${esc(name)}</td><td>${esc(displayValue(d.contact_operateur))}</td><td>${esc(coord)}</td><td>${esc(permit)}</td></tr>`}).join('');
      }
      const body=`<div class="document-title">${esc(title)}</div><div class="official-body wide"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
      const html=buildPrintDocument({title,body,settings:s,signature:false,hideReference:true});await launchPrint(html);return;
    }
    if(moduleKey==='feux-brousse'){
      const cfg=fireConfig(currentFireType)||{};const title=`REGISTRE — ${String(cfg.label||'FEUX DE BROUSSE').toUpperCase()}`;let headers=[],rows='';
      if(currentFireType==='DEGATS'){
        headers=['N°','Date constat','Sous-préfecture','Village','Nature des dégâts','Superficie (ha)','Personnes impactées','Observations'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_constat||r.event_date))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.village))}</td><td>${esc(displayValue(d.nature_degats))}</td><td>${esc(displayValue(d.superficie_detruite))}</td><td>${esc(displayValue(d.personnes_impactees))}</td><td>${esc(displayValue(d.observations))}</td></tr>`}).join('');
      }else{
        headers=['N°','Département','Sous-préfecture','Village','Acte de création','Président','Contact'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(displayValue(d.departement))}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.village))}</td><td>${esc(displayValue(d.acte_creation))}</td><td>${esc(displayValue(d.president_nom))}</td><td>${esc(displayValue(d.president_contact))}</td></tr>`}).join('');
      }
      const body=`<div class="document-title">${esc(title)}</div><div class="official-body wide"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;await launchPrint(buildPrintDocument({title,body,settings:s,signature:false,hideReference:true}));return;
    }
    if(moduleKey==='faune'){
      const cfg=faunaConfig(currentFaunaType)||{};const title=`REGISTRE — ${String(cfg.label||'FAUNE').toUpperCase()}`;let headers=[],rows='';
      if(currentFaunaType==='CONFLITS'){
        headers=['N°','Sous-préfecture','Village','Type de conflit','Animaux impliqués','Dégâts','Hommes impactés','Femmes impactées','Action menée'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(displayValue(d.sous_prefecture))}</td><td>${esc(displayValue(d.village))}</td><td>${esc(displayValue(d.type_conflit))}</td><td>${esc(displayValue(d.nombre_animaux))}</td><td>${esc(displayValue(d.degats_recenses))}</td><td>${esc(displayValue(d.hommes_impactes))}</td><td>${esc(displayValue(d.femmes_impactees))}</td><td>${esc(displayValue(d.action_menee))}</td></tr>`}).join('');
      }else{
        headers=['N°','Date','Espèces rencontrées','Zone d’observation','Commentaires'];
        rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_observation||r.event_date))}</td><td>${esc(displayValue(d.especes_animales))}</td><td>${esc(displayValue(d.zone_observation))}</td><td>${esc(displayValue(d.commentaires_utiles))}</td></tr>`}).join('');
      }
      const body=`<div class="document-title">${esc(title)}</div><div class="official-body wide"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;await launchPrint(buildPrintDocument({title,body,settings:s,signature:false,hideReference:true}));return;
    }
    if(moduleKey==='missions'){
      const cfg=missionConfig(currentMissionType)||{};const title=`REGISTRE — ${String(cfg.label||'MISSIONS').toUpperCase()}`;let headers=[],rows='';
      if(currentMissionType==='DISPOSITION'){
        headers=['N°','Libellé de la mission','Fréquence'];rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(displayValue(d.libelle_mission||r.title))}</td><td>${esc(displayValue(d.frequence))}</td></tr>`}).join('');
      }else if(currentMissionType==='REALISEE'){
        headers=['N°','N° mission','Libellé','Chef de mission','Participants','Objectif','Résultat'];rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(displayValue(d.numero_mission||r.reference))}</td><td>${esc(displayValue(d.libelle_mission==='Autre'?d.libelle_mission_autre:d.libelle_mission))}</td><td>${esc(displayValue(d.chef_mission))}</td><td>${esc(displayValue(d.autres_agents_participants))}</td><td>${esc(displayValue(d.objectif_mission))}</td><td>${esc(displayValue(d.resultat))}</td></tr>`}).join('');
      }else{
        headers=['N°','Objet infraction','Personne mise en cause','Contact','Mission liée ?','Objets saisis','Observations'];rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(displayValue(d.objet_infraction))}</td><td>${esc(displayValue(d.personne_mise_cause))}</td><td>${esc(displayValue(d.contact_mis_cause))}</td><td>${esc(displayValue(d.liee_mission))}</td><td>${esc(displayValue(d.objets_saisis))}</td><td>${esc(displayValue(d.observations))}</td></tr>`}).join('');
      }
      const body=`<div class="document-title">${esc(title)}</div><div class="official-body wide"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;await launchPrint(buildPrintDocument({title,body,settings:s,signature:false,hideReference:true}));return;
    }
    if(moduleKey==='formations'){
      const title='REGISTRE DES FORMATIONS';const rows=lastItems.map((r,i)=>{const d=r.data||{},theme=normalizeWoodText(d.theme).startsWith('autres')?(d.theme_autre||d.theme):d.theme;return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(theme))}</td><td>${esc(displayValue(d.hommes))}</td><td>${esc(displayValue(d.femmes))}</td><td>${esc(displayValue((Number(d.hommes||0)||0)+(Number(d.femmes||0)||0)))}</td><td>${esc(displayValue(d.observations))}</td></tr>`}).join('');
      const body=`<div class="document-title">${title}</div><div class="official-body wide"><table><thead><tr><th>N°</th><th>Date</th><th>Thème</th><th>Hommes</th><th>Femmes</th><th>Total</th><th>Observations</th></tr></thead><tbody>${rows}</tbody></table></div>`;await launchPrint(buildPrintDocument({title,body,settings:s,signature:false,hideReference:true}));return;
    }
    if(moduleKey==='activites-minef'){
      const title='REGISTRE DES ACTIVITÉS MENÉES';
      const rows=lastItems.map((r,i)=>{const d=r.data||{};return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(displayValue(d.type_activite))}</td><td>${esc(displayValue(d.categorie_minef))}</td><td>${esc(displayValue(d.intitule_activite||r.title))}</td><td>${esc(displayValue(d.organisateur))}</td><td>${esc(displayValue(d.commentaire))}</td></tr>`}).join('');
      const body=`<div class="document-title">${title}</div><div class="official-body wide"><table><thead><tr><th>N°</th><th>Date</th><th>Type d’activité</th><th>Cadre MINEF</th><th>Intitulé</th><th>Organisateur</th><th>Commentaire</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      const html=buildPrintDocument({title,body,settings:s,signature:false,hideReference:true});
      await launchPrint(html);return;
    }
    if(moduleKey==='sensibilisations'){
      const rows=lastItems.map((r,i)=>{const d=r.data||{};const h=Number(d.hommes||0),f=Number(d.femmes||0);return `<tr><td>${i+1}</td><td>${esc(fmtDate(d.date_activite||r.event_date))}</td><td>${esc(d.type_sensibilisation||d.theme||r.title||'—')}</td><td>${esc(displayValue(d.lieu))}</td><td>${esc(displayValue(d.cible))}</td><td>${h}</td><td>${f}</td><td>${h+f}</td><td>${esc(displayValue(d.agent_charge))}</td></tr>`}).join('');
      const title='REGISTRE DES SENSIBILISATIONS';
      const body=`<div class="document-title">${title}</div><div class="official-body wide"><table><thead><tr><th>N°</th><th>Date</th><th>Type</th><th>Lieu</th><th>Cible</th><th>Hommes</th><th>Femmes</th><th>Total</th><th>Agent en charge</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      const html=buildPrintDocument({title,body,settings:s,signature:false,hideReference:true});
      await launchPrint(html);return;
    }
    const rows=lastItems.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.reference||'—')}</td><td>${esc(r.title)}</td><td>${esc(fmtDate(r.event_date))}</td><td>${esc(r.status)}</td><td>${esc(r.source_organization||'')}</td></tr>`).join('');
    const title=moduleKey==='stages'?(currentStageType==='MISE_STAGE'?'REGISTRE DES MISES EN STAGE':'REGISTRE DES FINS DE STAGE'):moduleKey==='documents'?(currentDocumentType==='CESSATION_SERVICE'?'REGISTRE DES CESSATIONS DE SERVICE / MUTATION':currentDocumentType==='CESSATION_CONGE'?'REGISTRE DES CESSATIONS DE SERVICE / CONGÉ':currentDocumentType==='REPRISE_SERVICE'?'REGISTRE DES REPRISES DE SERVICE / CONGÉ':currentDocumentType==='PRISE_SERVICE_MUTATION'?'REGISTRE DES PRISES DE SERVICE / MUTATION':currentDocumentType==='DEMANDE_EXPLICATION'?'REGISTRE DES DEMANDES D’EXPLICATION':'REGISTRE DES AUTORISATIONS D’ABSENCE'):moduleKey==='convocations'?(currentConvocationView==='PV'?'REGISTRE DES PROCÈS-VERBAUX DE RENCONTRE':'REGISTRE DES CONVOCATIONS'):config.title.toUpperCase();
    const body=`<div class="document-title">${esc(title)}</div><div class="official-body wide"><table><thead><tr><th>N°</th><th>Référence</th><th>Intitulé</th><th>Date</th><th>Statut</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const html=buildPrintDocument({title,body,settings:s,signature:false,hideReference:true});
    await launchPrint(html);
  }catch(e){await professionalAlert('Impression impossible',e.message||'La liste n’a pas pu être préparée.');}
}

document.addEventListener('DOMContentLoaded',boot);
