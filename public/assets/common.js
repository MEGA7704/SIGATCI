const inflightMutations=new Map();

export async function api(url, options={}){
  const opts={...options,headers:{...(options.headers||{})}};
  if(opts.body && typeof opts.body!=='string'){
    opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(opts.body);
  }
  const method=(opts.method||'GET').toUpperCase();
  if(method!=='GET'){
    const csrf=sessionStorage.getItem('sigat_csrf'); if(csrf) opts.headers['X-CSRF-Token']=csrf;
  }
  const signature=method==='GET'?null:`${method}|${url}|${opts.body||''}`;
  if(signature&&inflightMutations.has(signature)) return inflightMutations.get(signature);
  const execute=(async()=>{
    const r=await fetch(url,opts); let data={}; try{data=await r.json()}catch{}
    if(r.status===401){sessionStorage.removeItem('sigat_csrf'); if(location.pathname!=='/') location.href='/';}
    if(!r.ok || data.ok===false) throw Object.assign(new Error(data.message||'Erreur'),{status:r.status,code:data.code,data});
    return data;
  })();
  if(!signature) return execute;
  inflightMutations.set(signature,execute);
  try{return await execute}finally{inflightMutations.delete(signature)}
}

export function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
export function fmtDate(v){if(!v)return '—';const d=new Date(v.length===10?v+'T00:00:00':v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('fr-FR');}
export function showToast(msg,type='ok'){
  let t=document.getElementById('toast'); if(!t){t=document.createElement('div');t.id='toast';t.className='sigat-toast';document.body.appendChild(t)}
  t.textContent=msg;t.className=`sigat-toast ${type==='error'?'error':'ok'}`;t.hidden=false;clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.hidden=true,4200);
}
export function togglePassword(button,input){button.addEventListener('click',()=>{input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'◉':'◎';button.setAttribute('aria-label',input.type==='password'?'Afficher le mot de passe':'Masquer le mot de passe')})}
export async function loadSession(){const s=await api('/api/session');sessionStorage.setItem('sigat_csrf',s.csrf);return s;}

export async function withButtonLock(button,task,busyText='Traitement…'){
  if(!button) return task();
  if(button.dataset.busy==='1') return;
  button.dataset.busy='1';
  const oldHtml=button.innerHTML;
  const oldDisabled=button.disabled;
  button.disabled=true;
  button.classList.add('is-busy');
  if(busyText) button.textContent=busyText;
  try{return await task()}finally{button.dataset.busy='0';button.disabled=oldDisabled;button.classList.remove('is-busy');button.innerHTML=oldHtml;}
}

function ensureProfessionalDialog(){
  let d=document.getElementById('sigatProfessionalDialog');
  if(d) return d;
  d=document.createElement('dialog');
  d.id='sigatProfessionalDialog';
  d.className='dialog pro-dialog';
  d.innerHTML=`<div class="dialog-head pro-dialog-head"><div><div class="pro-kicker">SIGAT</div><strong id="proDialogTitle">Information</strong></div><button type="button" class="close-x" id="proDialogX" aria-label="Fermer">×</button></div><div class="dialog-body"><div id="proDialogMessage" class="pro-message"></div><div id="proDialogHtml"></div></div><div class="dialog-foot"><button type="button" class="btn btn-secondary hidden" id="proDialogCancel">Annuler</button><button type="button" class="btn btn-primary" id="proDialogOk">Compris</button></div>`;
  document.body.appendChild(d);
  return d;
}

export function professionalDialog({title='Information',message='',html='',confirmText='Compris',cancelText='',danger=false,copyText='' }={}){
  const d=ensureProfessionalDialog();
  const titleEl=d.querySelector('#proDialogTitle'),msg=d.querySelector('#proDialogMessage'),htmlBox=d.querySelector('#proDialogHtml');
  const okBtn=d.querySelector('#proDialogOk'),cancelBtn=d.querySelector('#proDialogCancel'),xBtn=d.querySelector('#proDialogX');
  titleEl.textContent=title;
  msg.textContent=message||'';
  msg.classList.toggle('hidden',!message);
  htmlBox.innerHTML=html||'';
  okBtn.textContent=confirmText||'Compris';
  okBtn.className=`btn ${danger?'btn-danger-solid':'btn-primary'}`;
  cancelBtn.textContent=cancelText||'Annuler';
  cancelBtn.classList.toggle('hidden',!cancelText);
  if(copyText){
    const copy=document.createElement('button');copy.type='button';copy.className='btn btn-secondary';copy.textContent='Copier';
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(copyText);showToast('Copié.')}catch{showToast('Copie impossible.','error')}};
    htmlBox.appendChild(copy);
  }
  return new Promise(resolve=>{
    let done=false;
    const finish=v=>{if(done)return;done=true;cleanup();try{d.close()}catch{}resolve(v)};
    const cleanup=()=>{okBtn.onclick=null;cancelBtn.onclick=null;xBtn.onclick=null;d.oncancel=null;};
    okBtn.onclick=()=>finish(true);cancelBtn.onclick=()=>finish(false);xBtn.onclick=()=>finish(false);d.oncancel=e=>{e.preventDefault();finish(false)};
    if(!d.open)d.showModal();
  });
}
export function professionalAlert(title,message,options={}){return professionalDialog({title,message,confirmText:options.confirmText||'Compris',html:options.html||'',copyText:options.copyText||''});}
export function professionalConfirm(title,message,options={}){return professionalDialog({title,message,confirmText:options.confirmText||'Confirmer',cancelText:options.cancelText||'Annuler',danger:options.danger!==false});}

// Protection visuelle contre les doubles clics. Les requêtes d'écriture sont aussi dédupliquées dans api().
const clickTimes=new WeakMap();
document.addEventListener('click',e=>{
  const el=e.target.closest('button,.btn');
  if(!el||el.matches('.nav-group>button,.eye-btn,.close-x,[data-allow-rapid]')) return;
  const now=Date.now(),last=clickTimes.get(el)||0;
  if(now-last<800){e.preventDefault();e.stopImmediatePropagation();return;}
  clickTimes.set(el,now);
},true);
