import {api,togglePassword,withButtonLock} from './common.js?v=1.76';
const form=document.getElementById('loginForm'),msg=document.getElementById('loginMsg'),loginBtn=document.getElementById('loginSubmitBtn');
togglePassword(document.getElementById('togglePwd'),document.getElementById('password'));
form.addEventListener('submit',async e=>{
  e.preventDefault();
  await withButtonLock(loginBtn,async()=>{
    msg.classList.add('hidden');
    try{
      const r=await api('/api/login',{method:'POST',body:{identifier:document.getElementById('identifier').value,password:document.getElementById('password').value}});
      sessionStorage.setItem('sigat_csrf',r.csrf);sessionStorage.removeItem('sigat_last_free_popup');
      location.href=r.forcePasswordChange?'/mon-compte/':r.redirect;
    }catch(err){msg.textContent=err.message;msg.classList.remove('hidden')}
  },'CONNEXION…');
});
const d=document.getElementById('forgotDialog');document.getElementById('forgotBtn').onclick=()=>d.showModal();d.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>d.close());
document.getElementById('forgotForm').addEventListener('submit',async e=>{
  e.preventDefault();const m=document.getElementById('forgotMsg'),btn=document.getElementById('forgotSubmitBtn');
  await withButtonLock(btn,async()=>{
    m.classList.add('hidden');
    try{const r=await api('/api/password-reset-request',{method:'POST',body:{identifier:document.getElementById('forgotIdentifier').value}});m.textContent=r.message;m.classList.remove('hidden')}
    catch(err){m.textContent=err.message;m.classList.remove('hidden')}
  },'ENVOI…');
});
