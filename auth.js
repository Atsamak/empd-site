import { supabase, supabaseConfigured } from './supabaseClient.js';
const $ = s => document.querySelector(s);
const status = (message, error=false) => { const el=$('#auth-message'); if(el){el.textContent=message;el.dataset.error=String(error);} };
const redirectTo = location.origin + '/espace-membre.html';
const tabs = document.querySelectorAll('[data-auth-mode]');
let mode = 'login';
function setMode(next){mode=next;tabs.forEach(b=>b.classList.toggle('active',b.dataset.authMode===next));$('#auth-name-wrap').hidden=next!=='signup';$('#auth-password-wrap').hidden=next==='magic';$('#auth-form [name="password"]').required=next!=='magic';$('#auth-submit').textContent=next==='signup'?'Créer mon compte':next==='magic'?'Recevoir un lien de connexion':'Se connecter';}
tabs.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.authMode)));
if(!supabaseConfigured){status('Le service sera activé après la configuration du projet Supabase.',true);$('#auth-submit').disabled=true;}
else {
  supabase.auth.getSession().then(({data})=>{if(data.session)location.href='/espace-membre.html';});
  $('#auth-form').addEventListener('submit',async e=>{
    e.preventDefault();const fd=new FormData(e.currentTarget);const email=String(fd.get('email')||'').trim();const password=String(fd.get('password')||'');
    $('#auth-submit').disabled=true;status('Traitement en cours…');
    try{
      if(mode==='signup'){
        const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:String(fd.get('full_name')||'').trim()},emailRedirectTo:redirectTo}});
        if(error)throw error;status('Compte créé. Vérifie ta boîte e-mail pour confirmer ton adresse avant de te connecter.');
      }else if(mode==='magic'){
        const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo,shouldCreateUser:false}});
        if(error)throw error;status('Un lien de connexion vient d’être envoyé si cette adresse correspond à un compte.');
      }else{
        const {error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;location.href='/espace-membre.html';
      }
    }catch(error){status(error.message||'Une erreur est survenue.',true);}
    finally{$('#auth-submit').disabled=false;}
  });
  const googleButton=$('#google-auth');
  googleButton.disabled=true;
  googleButton.title='L’authentification Google sera activée après configuration des identifiants OAuth.';
  googleButton.textContent='Connexion Google — configuration requise';

  $('#forgot-password').addEventListener('click',async()=>{const email=$('#auth-email').value.trim();if(!email){status('Saisis ton adresse e-mail avant de demander la réinitialisation.',true);return;}const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin+'/espace-membre.html'});status(error?error.message:'Si cette adresse est connue, un e-mail de réinitialisation sera envoyé.',Boolean(error));});
}
setMode('login');