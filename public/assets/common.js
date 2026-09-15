export async function api(url, options={}){
  const opts={...options,headers:{...(options.headers||{})}};
  if(opts.body && typeof opts.body!=='string'){
    opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(opts.body);
  }
  if(opts.method && opts.method.toUpperCase()!=='GET'){
    const csrf=sessionStorage.getItem('sigat_csrf'); if(csrf) opts.headers['X-CSRF-Token']=csrf;
  }
  const r=await fetch(url,opts); let data={}; try{data=await r.json()}catch{}
  if(r.status===401){sessionStorage.removeItem('sigat_csrf'); if(location.pathname!=='/') location.href='/';}
  if(!r.ok || data.ok===false) throw Object.assign(new Error(data.message||'Erreur'),{status:r.status,code:data.code,data});
  return data;
}
export function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
export function fmtDate(v){if(!v)return '—';const d=new Date(v.length===10?v+'T00:00:00':v);return Number.isNaN(d.getTime())?v:d.toLocaleDateString('fr-FR');}
export function showToast(msg,type='ok'){
  let t=document.getElementById('toast'); if(!t){t=document.createElement('div');t.id='toast';t.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9999;max-width:380px;padding:13px 16px;border-radius:12px;color:#fff;font-weight:750;box-shadow:0 12px 35px rgba(0,0,0,.2)';document.body.appendChild(t)}
  t.textContent=msg;t.style.background=type==='error'?'#9f2e2e':'#0b4d3b';t.hidden=false;clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>t.hidden=true,4200);
}
export function togglePassword(button,input){button.addEventListener('click',()=>{input.type=input.type==='password'?'text':'password';button.textContent=input.type==='password'?'◉':'◎';button.setAttribute('aria-label',input.type==='password'?'Afficher le mot de passe':'Masquer le mot de passe')})}
export async function loadSession(){const s=await api('/api/session');sessionStorage.setItem('sigat_csrf',s.csrf);return s;}
