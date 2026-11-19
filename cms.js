import { supabase, supabaseConfigured } from './supabaseClient.js';

const $ = (selector, root = document) => root.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel = value => value ? new Date(value).toLocaleDateString('fr-FR') : '';
const safeHref = value => { try { const u = new URL(String(value || ''), location.origin); return ['http:','https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
const notify = (message, error = false) => {
  let node = $('#cms-toast');
  if (!node) { node = document.createElement('div'); node.id = 'cms-toast'; node.className = 'cms-toast'; document.body.append(node); }
  node.textContent = message; node.dataset.error = String(error); node.classList.add('visible');
  window.setTimeout(() => node.classList.remove('visible'), 4200);
};
const fileUrl = path => {
  const { data } = supabase.storage.from('empd-media').getPublicUrl(path);
  return data.publicUrl;
};
async function uploadFile(file, folder) {
  if (!file) return null;
  if (!['image/jpeg','image/png','image/webp','image/gif','application/pdf'].includes(file.type)) throw new Error('Format non autorisé. Utilise JPG, PNG, WEBP, GIF ou PDF.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Le fichier dépasse la limite de 15 Mo.');
  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'');
  const path = folder + '/' + crypto.randomUUID() + '.' + ext;
  const { error } = await supabase.storage.from('empd-media').upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  return fileUrl(path);
}
async function currentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) return null;
  const { data: role, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle();
  if (roleError) throw roleError;
  return { user, role: role?.role || 'member' };
}
function injectAccountLinks() {
  const nav = $('.nav');
  if (!nav || nav.querySelector('[data-cms-account]')) return;
  const link = document.createElement('a');
  link.href = '/connexion.html'; link.textContent = 'Espace membre'; link.dataset.cmsAccount = 'true';
  nav.append(link);
}
const editablePages = [
  ['/index.html','Accueil'],['/notre-ecole.html','Notre école'],['/enseignements.html','Enseignements'],
  ['/louange.html','Louange & adoration'],['/empd-tv.html','EMPD TV'],['/galerie.html','Galerie'],
  ['/ressources.html','Ressources'],['/publications.html','Publications'],['/contact.html','Contact']
];
async function applyPageSettings() {
  const {data,error} = await supabase.from('site_settings').select('setting_key,setting_value').like('setting_key','page:%');
  if (error) return;
  const pathname = location.pathname === '/' ? '/index.html' : location.pathname;
  const setting = (data || []).find(item => item.setting_key === 'page:' + pathname)?.setting_value || {};
  const home = pathname === '/index.html';
  const title = home ? $('.hero-title-3d') : $('.page-hero h1');
  const intro = home ? $('.hero-content > p') : $('.page-hero p');
  const banner = home ? $('.hero') : $('.page-hero');
  if (setting.title && title) title.textContent = setting.title;
  if (setting.intro && intro) intro.textContent = setting.intro;
  if (setting.hero_image && banner) banner.style.setProperty('--hero', `url("${safeHref(setting.hero_image)}")`);
}
async function loadPublicContent() {
  if (!supabaseConfigured) return;
  await applyPageSettings();
  const [posts, resources, gallery, videos] = await Promise.all([
    supabase.from('publications').select('*').eq('status','published').order('published_at',{ascending:false}).limit(30),
    supabase.from('resources').select('*').eq('status','published').order('created_at',{ascending:false}).limit(30),
    supabase.from('gallery_items').select('*').eq('status','published').order('created_at',{ascending:false}).limit(60),
    supabase.from('media_videos').select('*').eq('status','published').order('created_at',{ascending:false}).limit(30)
  ]);
  for (const result of [posts,resources,gallery,videos]) if (result.error) console.warn('EMPD CMS:',result.error.message);
  const postRows = posts.data || [];
  const postCard = p => `<article class="publication-card home-publication-card">${p.image_url ? `<img src="${safeHref(p.image_url)}" alt="" loading="lazy">` : ''}<div><span class="eyebrow">${escapeHtml(p.category)} · ${dateLabel(p.published_at || p.created_at)}</span><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.body)}</p></div></article>`;
  const home = $('#home-publication-list');
  if (home) home.innerHTML = postRows.length ? postRows.slice(0,3).map(postCard).join('') : '<p class="empty-state">Les prochaines publications de l’EMPD apparaîtront ici.</p>';
  const postList = $('#publication-list');
  if (postList) postList.innerHTML = posts.error
    ? '<p class="empty-state">Les publications ne peuvent pas être chargées pour le moment. Réessaie plus tard.</p>'
    : postRows.length ? postRows.map(postCard).join('') : '<p class="empty-state">Aucune publication pour le moment.</p>';

  const categoryPage = {
    '/enseignements.html': {category:'Enseignement', title:'Publications et enseignements'},
    '/louange.html': {category:'Louange & adoration', title:'Actualités de la louange'}
  }[location.pathname];
  if (categoryPage) {
    const target = $('.inner-main');
    if (target && !$('#cms-category-publications')) {
      const section = document.createElement('section');
      section.id = 'cms-category-publications';
      section.className = 'cms-public-section';
      section.innerHTML = `<h2>${escapeHtml(categoryPage.title)}</h2><div class="publication-grid" id="cms-category-publication-list"></div>`;
      target.append(section);
    }
    const list = $('#cms-category-publication-list');
    const matching = postRows.filter(post => post.category === categoryPage.category);
    if (list) list.innerHTML = posts.error
      ? '<p class="empty-state">Les publications de cette rubrique sont momentanément indisponibles.</p>'
      : matching.map(postCard).join('') || '<p class="empty-state">Aucune publication dans cette rubrique pour le moment.</p>';
  }

  const resourceList = $('#managed-resource-list');
  if (resourceList) resourceList.innerHTML = (resources.data || []).map(r => `<article class="publication-card"><div><span class="eyebrow">${escapeHtml(r.category)}</span><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.description)}</p><div class="resource-actions">${r.external_url ? `<a class="text-link" href="${safeHref(r.external_url)}" target="_blank" rel="noopener">Consulter ↗</a>` : ''}${r.file_url ? `<a class="btn download-btn" href="${safeHref(r.file_url)}" target="_blank" rel="noopener">Télécharger ↗</a>` : ''}</div></div></article>`).join('') || '<p class="empty-state">Les ressources ajoutées par l’EMPD apparaîtront ici.</p>';
  if (location.pathname.endsWith('/galerie.html')) {
    const target = $('.inner-main');
    if (target && !$('#cms-gallery')) {
      const section = document.createElement('section'); section.id='cms-gallery'; section.className='cms-public-section';
      section.innerHTML='<h2>Galerie de l’EMPD</h2><div class="cms-gallery-grid" id="cms-gallery-grid"></div>';
      target.append(section);
    }
    const grid = $('#cms-gallery-grid');
    if (grid) grid.innerHTML = (gallery.data || []).map(g => `<figure class="cms-gallery-item"><img src="${safeHref(g.image_url)}" alt="${escapeHtml(g.alt_text || g.title)}" loading="lazy"><figcaption><b>${escapeHtml(g.title)}</b><span>${escapeHtml(g.description)}</span></figcaption></figure>`).join('') || '<p class="empty-state">Les images de nos activités seront bientôt publiées.</p>';
  }
  if (location.pathname.endsWith('/empd-tv.html')) {
    const target = $('.inner-main');
    if (target && !$('#cms-videos')) {
      const section = document.createElement('section'); section.id='cms-videos'; section.className='cms-public-section';
      section.innerHTML='<h2>Vidéos et enseignements EMPD</h2><div class="cms-video-grid" id="cms-video-grid"></div>';
      target.append(section);
    }
    const grid = $('#cms-video-grid');
    if (grid) grid.innerHTML = (videos.data || []).map(v => `<article class="cms-video-card">${v.thumbnail_url ? `<img src="${safeHref(v.thumbnail_url)}" alt="" loading="lazy">` : ''}<div><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.description)}</p><a class="text-link" href="${safeHref(v.video_url)}" target="_blank" rel="noopener">Regarder la vidéo ↗</a></div></article>`).join('') || '<p class="empty-state">Les prochaines vidéos de l’EMPD apparaîtront ici.</p>';
  }
}
const modules = {
  publications: { table:'publications', label:'Publications', fields:[
    ['title','Titre','text',true],['category','Catégorie','select',true,['Actualité','Enseignement','Louange & adoration','Annonce','Méditation']],
    ['body','Contenu','textarea',true],['image_url','Image','file',false],['status','Visibilité','select',true,['published','draft']]
  ]},
  gallery_items: { table:'gallery_items', label:'Galerie', fields:[
    ['title','Titre de la photo','text',true],['description','Description','textarea',false],['category','Catégorie','select',true,['Activités','Rencontres','Formations','Communauté','Événements']],
    ['alt_text','Texte alternatif','text',false],['event_date','Date de l’événement','date',false],['image_url','Photo','file',true],['status','Visibilité','select',true,['published','draft']]
  ]},
  resources: { table:'resources', label:'Ressources', fields:[
    ['title','Nom de la ressource','text',true],['category','Type','select',true,['Document PDF','Vidéo','Lien biblique','Audio','Autre']],
    ['description','Description','textarea',false],['file_url','Fichier PDF (facultatif)','file',false],['external_url','Lien externe (facultatif)','url',false],['status','Visibilité','select',true,['published','draft']]
  ]},
  media_videos: { table:'media_videos', label:'EMPD TV', fields:[
    ['title','Titre de la vidéo','text',true],['description','Description','textarea',false],['video_url','Lien YouTube ou vidéo','url',true],
    ['thumbnail_url','Image de couverture (facultatif)','file',false],['category','Rubrique','text',false],['status','Visibilité','select',true,['published','draft']]
  ]}
};
let activeModule = 'publications';
let editing = null;
async function adminDashboard(account) {
  const wrap = $('.admin-wrap');
  if (!wrap) return;
  wrap.innerHTML = `<div class="cms-admin-head"><div><span class="eyebrow">Espace sécurisé EMPD</span><h1>Tableau de bord</h1><p>Connecté : ${escapeHtml(account.user.email)} · Administrateur</p></div><button class="btn outline" id="cms-signout">Déconnexion</button></div>
  <div class="cms-admin-stats" id="cms-admin-stats"></div>
  <nav class="cms-tabs" aria-label="Gestion du site">
    <button data-module="publications">Publications</button><button data-module="gallery_items">Galerie</button><button data-module="media_videos">EMPD TV</button><button data-module="resources">Ressources</button><button data-module="pages">Pages du site</button><button data-module="members">Membres</button>
  </nav><section class="cms-admin-panel" id="cms-admin-panel"></section>`;
  $('#cms-signout').addEventListener('click', async()=>{await supabase.auth.signOut();location.reload();});
  wrap.querySelectorAll('[data-module]').forEach(b=>b.addEventListener('click',()=>{activeModule=b.dataset.module;editing=null;renderAdminModule();}));
  const [p,g,r,v,m] = await Promise.all([
    supabase.from('publications').select('id',{count:'exact',head:true}),
    supabase.from('gallery_items').select('id',{count:'exact',head:true}),
    supabase.from('resources').select('id',{count:'exact',head:true}),
    supabase.from('media_videos').select('id',{count:'exact',head:true}),
    supabase.from('profiles').select('id',{count:'exact',head:true})
  ]);
  $('#cms-admin-stats').innerHTML = [['Publications',p.count],['Photos',g.count],['Ressources',r.count],['Vidéos',v.count],['Membres',m.count]].map(([label,count])=>`<div><b>${count ?? '—'}</b><span>${label}</span></div>`).join('');
  renderAdminModule();
}
function fieldMarkup(field, record={}) {
  const [name,label,type,required,options] = field;
  const value = record[name] ?? (name === 'status' ? 'published' : '');
  if (type==='textarea') return `<label>${label}<textarea name="${name}" rows="4" ${required?'required':''}>${escapeHtml(value)}</textarea></label>`;
  if (type==='select') return `<label>${label}<select name="${name}" ${required?'required':''}>${options.map(o=>`<option value="${escapeHtml(o)}" ${value===o?'selected':''}>${escapeHtml(o==='draft'?'Brouillon':o==='published'?'Publié':o)}</option>`).join('')}</select></label>`;
  if (type==='file') return `<label>${label}<input type="file" name="${name}" accept="${name.includes('file')?'application/pdf,image/*':'image/*'}" ${required && !value?'required':''}> ${value?'<small>Un fichier est déjà associé. Sélectionne un nouveau fichier pour le remplacer.</small>':''}</label>`;
  return `<label>${label}<input type="${type}" name="${name}" value="${escapeHtml(value)}" ${required?'required':''}></label>`;
}
async function renderPageSettings(panel) {
  const {data,error} = await supabase.from('site_settings').select('setting_key,setting_value').like('setting_key','page:%');
  if (error) { panel.innerHTML = `<p class="admin-warning">${escapeHtml(error.message)}</p>`; return; }
  const settings = new Map((data || []).map(row => [row.setting_key,row.setting_value || {}]));
  const selected = editablePages[0][0];
  panel.innerHTML = `<div class="cms-module-heading"><div><h2>Pages du site</h2><p>Modifie les titres, les introductions et les images de bannière sans toucher au code.</p></div></div>
    <form id="cms-page-form" class="cms-form">
      <label>Page à modifier<select name="page">${editablePages.map(([path,label])=>`<option value="${path}">${label}</option>`).join('')}</select></label>
      <label>Titre principal<input name="title" maxlength="180"></label>
      <label>Texte d’introduction<textarea name="intro" rows="4" maxlength="1200"></textarea></label>
      <label>Image de bannière (facultatif)<input name="hero_image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label>
      <p id="cms-page-image-current" class="cms-help"></p>
      <div class="cms-form-actions"><button class="btn gold" type="submit">Enregistrer les modifications</button></div>
    </form>`;
  const form = $('#cms-page-form');
  const fill = () => {
    const value = settings.get('page:' + form.elements.page.value) || {};
    form.elements.title.value = value.title || '';
    form.elements.intro.value = value.intro || '';
    form.elements.hero_image.value = '';
    $('#cms-page-image-current').textContent = value.hero_image ? 'Une bannière est déjà enregistrée. Choisis un nouveau fichier pour la remplacer.' : 'Aucune bannière personnalisée enregistrée pour cette page.';
  };
  form.elements.page.addEventListener('change',fill);
  fill();
  form.addEventListener('submit',async event => {
    event.preventDefault();
    const page = form.elements.page.value;
    const previous = settings.get('page:' + page) || {};
    const file = form.elements.hero_image.files?.[0];
    try {
      const hero_image = file?.size ? await uploadFile(file,'page-banners') : (previous.hero_image || null);
      const setting_value = {title:form.elements.title.value.trim(),intro:form.elements.intro.value.trim(),hero_image};
      const {error:saveError} = await supabase.from('site_settings').upsert({
        setting_key:'page:' + page,setting_value,updated_by:accountUserId,updated_at:new Date().toISOString()
      },{onConflict:'setting_key'});
      if (saveError) throw saveError;
      settings.set('page:' + page,setting_value);
      notify('Les éléments de cette page ont été enregistrés.');
      fill();
    } catch (saveError) { notify(saveError.message || 'Impossible d’enregistrer cette page.',true); }
  });
}
async function renderAdminModule() {
  const panel = $('#cms-admin-panel'); if (!panel) return;
  panel.innerHTML = '<p>Chargement…</p>';
  if (activeModule==='members') return renderMembers(panel);
  if (activeModule==='pages') return renderPageSettings(panel);
  const mod = modules[activeModule];
  const {data,error} = await supabase.from(mod.table).select('*').order('created_at',{ascending:false}).limit(100);
  if (error) { panel.innerHTML=`<p class="admin-warning">${escapeHtml(error.message)}</p>`; return; }
  panel.innerHTML = `<div class="cms-module-heading"><div><h2>${mod.label}</h2><p>Ajoute, modifie, publie ou retire du contenu.</p></div><button class="btn gold" id="cms-new">+ Ajouter</button></div>
    <form id="cms-item-form" class="cms-form" hidden><div class="cms-form-grid">${mod.fields.map(f=>fieldMarkup(f,editing||{})).join('')}</div><div class="cms-form-actions"><button class="btn gold" type="submit">${editing?'Enregistrer les modifications':'Enregistrer'}</button><button class="btn outline" type="button" id="cms-cancel">Annuler</button></div></form>
    <div class="cms-record-list">${(data||[]).map(row=>`<article class="cms-record"><div><b>${escapeHtml(row.title)}</b><p>${escapeHtml(row.category||row.description||'')}</p><small>${row.status==='published'?'Publié':'Brouillon'} · ${dateLabel(row.created_at)}</small></div><div class="cms-record-actions"><button data-edit="${row.id}" class="cms-small-btn">Modifier</button><button data-delete="${row.id}" class="cms-small-btn danger">Supprimer</button></div></article>`).join('')||'<p class="empty-state">Aucun élément pour le moment.</p>'}</div>`;
  const form = $('#cms-item-form');
  $('#cms-new').addEventListener('click',()=>{editing=null;form.reset();form.hidden=false;form.scrollIntoView({behavior:'smooth',block:'start'});});
  $('#cms-cancel').addEventListener('click',()=>{form.hidden=true;editing=null;});
  panel.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',async()=>{const found=(data||[]).find(x=>x.id===btn.dataset.edit);editing=found;await renderAdminModule();const f=$('#cms-item-form');f.hidden=false;f.scrollIntoView({behavior:'smooth',block:'start'});}));
  panel.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',async()=>{if(!confirm('Supprimer définitivement cet élément ?'))return;const {error}=await supabase.from(mod.table).delete().eq('id',btn.dataset.delete);if(error)notify(error.message,true);else{notify('Élément supprimé.');renderAdminModule();}}));
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const submitButton=form.querySelector('button[type="submit"]');
    submitButton.disabled=true;
    const fd=new FormData(form);
    const payload={};
    try{
      for(const field of mod.fields){
        const [name,,type]=field;
        if(type==='file'){
          const file=fd.get(name);
          if(file?.size)payload[name]=await uploadFile(file,activeModule);
        }else{
          const value=fd.get(name);
          if(value!==null)payload[name]=String(value).trim();
        }
      }
      if(activeModule==='publications' && payload.status==='published' && (!editing?.published_at || editing.status!=='published')){
        payload.published_at=new Date().toISOString();
      }
      payload.created_by=accountUserId;
      const query=editing
        ? supabase.from(mod.table).update(payload).eq('id',editing.id)
        : supabase.from(mod.table).insert(payload);
      const {data:saved,error}=await query.select('id,title,status').single();
      if(error)throw error;
      if(!saved)throw new Error('Supabase n’a confirmé aucun enregistrement.');
      notify(editing?'Modifications enregistrées.':'Contenu ajouté avec succès.');
      editing=null;
      await renderAdminModule();
      await loadPublicContent();
    }catch(error){
      console.error('EMPD CMS save:',error);
      notify('Enregistrement impossible : '+(error.message||'erreur inconnue'),true);
    }finally{
      if(submitButton.isConnected)submitButton.disabled=false;
    }
  });
}
let accountUserId = null;
async function renderMembers(panel) {
  const {data,error}=await supabase.from('profiles').select('id,email,full_name,created_at').order('created_at',{ascending:false}).limit(100);
  if(error){panel.innerHTML=`<p class="admin-warning">${escapeHtml(error.message)}</p>`;return;}
  const {data:roles,error:roleError}=await supabase.from('user_roles').select('user_id,role');
  if(roleError){panel.innerHTML='<p class="admin-warning">'+escapeHtml(roleError.message)+'</p>';return;}
  const roleMap=new Map((roles||[]).map(r=>[r.user_id,r.role]));
  panel.innerHTML=`
    <div class="cms-module-heading"><div><h2>Gestion des membres</h2><p>Génère un lien d’invitation sécurisé à partager par WhatsApp, SMS ou e-mail, sans envoi automatique.</p></div></div>
    <form id="cms-invite-form" class="cms-form">
      <div class="cms-form-grid">
        <label>Nom complet (facultatif)<input name="full_name" maxlength="100" autocomplete="name"></label>
        <label>Adresse e-mail<input name="email" type="email" maxlength="254" required autocomplete="email" placeholder="personne@exemple.com"></label>
        <label>Rôle à attribuer<select name="role"><option value="member">Membre</option><option value="admin">Administrateur</option></select></label>
      </div>
      <div class="cms-form-actions"><button class="btn gold" type="submit">Générer le lien d’invitation</button></div>
      <p class="cms-help">Aucun e-mail n’est envoyé. Après génération, copie le lien et transmets-le personnellement à la personne invitée. La durée de validité dépend du réglage d’expiration des liens dans Supabase.</p>
      <p id="cms-invite-message" role="status" aria-live="polite"></p>
      <div id="cms-invite-link-wrap" hidden>
        <label>Lien personnel à transmettre<textarea id="cms-invite-link" rows="3" readonly></textarea></label>
        <div class="cms-form-actions"><button class="btn outline" type="button" id="cms-copy-invite">Copier le lien</button></div>
      </div>
    </form>
    <h2>Comptes existants</h2>
    <div class="cms-record-list">${(data||[]).map(p=>{const role=roleMap.get(p.id)||'member';return `<article class="cms-record"><div><b>${escapeHtml(p.full_name||'Membre')}</b><p>${escapeHtml(p.email||p.id)}</p><small>Inscrit le ${dateLabel(p.created_at)}</small></div><div class="cms-record-actions"><select data-role-user="${p.id}" ${p.id===accountUserId?'disabled title="Tu ne peux pas modifier ton propre rôle ici."':''}><option value="member" ${role==='member'?'selected':''}>Membre</option><option value="admin" ${role==='admin'?'selected':''}>Administrateur</option></select></div></article>`;}).join('')||'<p class="empty-state">Aucun membre pour le moment.</p>'}</div>`;
  const inviteForm=$('#cms-invite-form');
  inviteForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=inviteForm.querySelector('button[type="submit"]');
    const message=$('#cms-invite-message');
    const fd=new FormData(inviteForm);
    button.disabled=true;message.textContent='Création du lien sécurisé…';message.dataset.error='false';
    try{
      const {data:result,error:invokeError}=await supabase.functions.invoke('invite-member',{body:{
        email:String(fd.get('email')||'').trim(),
        full_name:String(fd.get('full_name')||'').trim(),
        role:String(fd.get('role')||'member')
      }});
      if(invokeError){
        let detail='';
        try{const payload=await invokeError.context?.json();detail=payload?.error||'';}catch{}
        throw new Error(detail||invokeError.message||'Impossible d’envoyer l’invitation.');
      }
      if(!result?.ok)throw new Error(result?.error||'La demande n’a pas abouti.');
      if(!result?.invitation_link)throw new Error('Le lien d’invitation n’a pas été retourné.');
      $('#cms-invite-link').value=result.invitation_link;
      $('#cms-invite-link-wrap').hidden=false;
      message.textContent=`Lien créé pour ${result.email}. Rôle attribué : ${result.role==='admin'?'administrateur':'membre'}. Copie-le et transmets-le à cette personne.`;
      inviteForm.reset();
      notify('Lien d’invitation créé. Il reste à le transmettre.');
      $('#cms-copy-invite').onclick=async()=>{
        const link=$('#cms-invite-link').value;
        try{await navigator.clipboard.writeText(link);notify('Lien copié dans le presse-papiers.');}
        catch{$('#cms-invite-link').focus();$('#cms-invite-link').select();notify('Sélectionne le lien puis copie-le avec Ctrl+C.');}
      };
    }catch(err){message.textContent=err.message||'Une erreur est survenue.';message.dataset.error='true';}
    finally{const current=$('#cms-invite-form button[type="submit"]');if(current)current.disabled=false;}
  });
  panel.querySelectorAll('[data-role-user]').forEach(select=>select.addEventListener('change',async()=>{
    const previous=roleMap.get(select.dataset.roleUser)||'member';
    const next=select.value;
    if(!confirm(next==='admin'?'Donner les droits administrateur à ce membre ?':'Retirer les droits administrateur de ce membre ?')){select.value=previous;return;}
    select.disabled=true;
    const {error}=await supabase.from('user_roles').update({role:next}).eq('user_id',select.dataset.roleUser);
    if(error){notify(error.message,true);select.value=previous;}else{roleMap.set(select.dataset.roleUser,next);notify('Rôle mis à jour.');}
    select.disabled=select.dataset.roleUser===accountUserId;
  }));
}
async function startAdmin() {
  const wrap=$('.admin-wrap'); if(!wrap)return;
  if(!supabaseConfigured){wrap.innerHTML='<h1>Configuration Supabase requise</h1><p class="admin-warning">Le tableau de bord sera activé après la création du projet Supabase et la configuration des clés publiques du site.</p>';return;}
  try {
    const account=await currentUser();
    if(!account){wrap.innerHTML=`<div class="cms-auth-card"><span class="eyebrow">Accès réservé</span><h1>Connexion à l’administration</h1><p>Connecte-toi avec le compte administrateur EMPD.</p><form id="cms-admin-login"><label>Adresse e-mail<input name="email" type="email" required autocomplete="username"></label><label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label><button class="btn gold" type="submit">Se connecter</button></form><p><a href="/connexion.html">Créer un compte membre / se connecter ↗</a></p><p id="cms-auth-error" role="status"></p></div>`;
      $('#cms-admin-login').addEventListener('submit',async e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const {error}=await supabase.auth.signInWithPassword({email:fd.get('email'),password:fd.get('password')});if(error)$('#cms-auth-error').textContent=error.message;else location.reload();});
      return;
    }
    if(account.role!=='admin'){wrap.innerHTML='<div class="cms-auth-card"><h1>Accès non autorisé</h1><p>Ce compte est enregistré comme membre. Les fonctions de gestion sont réservées aux administrateurs EMPD.</p><button class="btn outline" id="cms-signout">Déconnexion</button></div>';$('#cms-signout').addEventListener('click',async()=>{await supabase.auth.signOut();location.reload();});return;}
    accountUserId=account.user.id;await adminDashboard(account);
  } catch(error){wrap.innerHTML=`<p class="admin-warning">${escapeHtml(error.message)}</p>`;}
}
injectAccountLinks();
if(location.pathname.endsWith('/admin.html')) startAdmin();
else if(supabaseConfigured) loadPublicContent().catch(error=>console.warn('EMPD CMS:',error.message));