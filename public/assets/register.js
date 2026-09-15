import {api,togglePassword} from './common.js';
const type=document.getElementById('organizationType'),parent=document.getElementById('parentField');
const parentLabel=document.getElementById('parentLabel'),parentHelp=document.getElementById('parentHelp'),parentCode=document.getElementById('parentCode');
const PARENT_META={
  PEF:['Cantonnement de rattachement','Saisissez le code du Cantonnement auquel ce PEF est lié.','Ex. CANT-BOTRO'],
  CANTONNEMENT:['Direction Régionale de rattachement','Saisissez le code de la Direction Régionale à laquelle ce Cantonnement est lié.','Ex. DR-GBEKE'],
  DIRECTION_REGIONALE:['Direction Départementale de rattachement','Saisissez le code de la Direction Départementale à laquelle cette Direction Régionale est liée.','Ex. DD-BEOUMI']
};
function sync(){
  const isTop=type.value==='DIRECTION_DEPARTEMENTALE';
  parent.classList.toggle('hidden',isTop);
  parentCode.required=!isTop;
  if(!isTop){const m=PARENT_META[type.value];parentLabel.textContent=m[0]+' *';parentHelp.textContent=m[1];parentCode.placeholder=m[2];}
}
type.onchange=sync;sync();
togglePassword(document.getElementById('togglePwd'),document.getElementById('password'));togglePassword(document.getElementById('togglePwd2'),document.getElementById('password2'));
document.getElementById('registerForm').addEventListener('submit',async e=>{e.preventDefault();const msg=document.getElementById('msg');msg.classList.add('hidden');if(document.getElementById('password').value!==document.getElementById('password2').value){msg.textContent='Les mots de passe ne correspondent pas.';msg.classList.remove('hidden');return}const ids=['organizationType','code','name','parentCode','region','department','locality','phone','organizationEmail','displayName','username','email','userPhone','password'];const body={};ids.forEach(id=>body[id]=document.getElementById(id)?.value||'');try{const r=await api('/api/register',{method:'POST',body});msg.textContent=r.message;msg.classList.remove('hidden');msg.classList.remove('error');e.target.reset();sync()}catch(err){msg.textContent=err.message;msg.classList.add('error');msg.classList.remove('hidden')}});
