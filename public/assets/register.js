import {api,togglePassword} from './common.js';
togglePassword(document.getElementById('togglePwd'),document.getElementById('password'));
togglePassword(document.getElementById('togglePwd2'),document.getElementById('password2'));
document.getElementById('registerForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const msg=document.getElementById('msg');msg.classList.add('hidden');
  if(document.getElementById('password').value!==document.getElementById('password2').value){
    msg.textContent='Les mots de passe ne correspondent pas.';msg.classList.remove('hidden');return;
  }
  const ids=['organizationType','name','region','department','locality','phone','organizationEmail','displayName','username','email','userPhone','password'];
  const body={};ids.forEach(id=>body[id]=document.getElementById(id)?.value||'');
  try{
    const r=await api('/api/register',{method:'POST',body});
    msg.textContent=r.organizationCode?`${r.message} Code du service : ${r.organizationCode}.`:r.message;msg.classList.remove('hidden');msg.classList.remove('error');
    if(r.csrf) sessionStorage.setItem('sigat_csrf',r.csrf);
    sessionStorage.removeItem('sigat_last_free_popup');
    e.target.reset();
    // L'inscription ouvre désormais automatiquement la session de l'Administrateur.
    if(r.redirect){
      setTimeout(()=>{ location.href=r.redirect; },900);
    }
  }catch(err){msg.textContent=err.message;msg.classList.add('error');msg.classList.remove('hidden')}
});
