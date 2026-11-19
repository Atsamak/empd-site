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
const allowedMimeTypes = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.oasis.opendocument.text','application/vnd.oasis.opendocument.presentation','application/vnd.oasis.opendocument.spreadsheet','text/plain','text/csv','application/zip','audio/mpeg','audio/mp4','audio/wav','audio/ogg','video/mp4','video/webm','video/quicktime']);
const documentAccept = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.odt,.odp,.ods,.txt,.csv,.zip,.mp3,.m4a,.wav,.ogg,.mp4,.webm,.mov,image/*';
const mediaAccept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
const mimeFromName = name => ({doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pdf:'application/pdf',txt:'text/plain',csv:'text/csv',zip:'application/zip',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',ogg:'audio/ogg',mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif'})[String(name).split('.').pop().toLowerCase()] || '';
async function uploadFile(file, folder, accepted = allowedMimeTypes) {
  if (!file) return null;
  const mimeType = file.type || mimeFromName(file.name);
  if (!accepted.has(mimeType)) throw new Error('Ce format de fichier n’est pas autorisé.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Le fichier dépasse la limite de 50 Mo.');
  const ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'');
  const path = folder + '/' + crypto.randomUUID() + '.' + ext;
  const { error } = await supabase.storage.from('empd-media').upload(path, file, { upsert: false, contentType: mimeType });
  if (error) throw error;
  return { url:fileUrl(path), name:file.name, mimeType, size:file.size, path };
}
const downloadHref = (value, name = '') => { try { const url = new URL(safeHref(value)); url.searchParams.set('download', name); return url.href; } catch { return '#'; } };
const mediaPreview = (url, mime, name = '') => {
  if (!url) return '';
  const source = escapeHtml(safeHref(url));
  const kind = String(mime || mimeFromName(name || url.split('?')[0].split('/').pop()) || '').toLowerCase();
  if (kind.startsWith('image/')) return '<img class="cms-inline-image" src="' + source + '" alt="Image de la publication" loading="lazy">';
  if (kind.startsWith('video/')) return '<video class="cms-inline-media" controls preload="metadata" src="' + source + '"></video>';
  if (kind.startsWith('audio/')) return '<audio class="cms-inline-audio" controls preload="metadata" src="' + source + '"></audio>';
  if (kind === 'application/pdf' || String(url).toLowerCase().split(/[?#]/)[0].endsWith('.pdf') || String(name).toLowerCase().endsWith('.pdf')) {
    return '<div class="cms-pdf-preview"><iframe src="' + source + '#toolbar=1&navpanes=0" title="Aperçu du document PDF" loading="lazy"></iframe><p>Si le document ne s’affiche pas, utilise le bouton de téléchargement.</p></div>';
  }
  return '';
};
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
  const postCard = p => `<article class="publication-card home-publication-card"><div class="publication-content"><span class="eyebrow">${escapeHtml(p.category)} · ${dateLabel(p.published_at || p.created_at)}</span><h3>${escapeHtml(p.title)}</h3>${p.body ? `<p>${escapeHtml(p.body)}</p>` : ''}${mediaPreview(p.image_url, p.image_mime_type || 'image/jpeg')}${p.image_url ? `<a class="btn download-btn" href="${downloadHref(p.image_url)}">Télécharger l’image ⤓</a>` : ''}${mediaPreview(p.attachment_url,p.attachment_mime_type,p.attachment_name)}${p.attachment_url ? `<a class="btn download-btn" href="${downloadHref(p.attachment_url,p.attachment_name)}">Télécharger ${escapeHtml(p.attachment_name || 'la pièce jointe')} ⤓</a>` : ''}</div></article>`;
  const home = $('#home-publication-list');
  if (home) home.innerHTML = postRows.length ? postRows.slice(0,3).map(postCard).join('') : '<p class="empty-state">Les prochaines publications de l’EMPD apparaîtront ici.</p>';
  const postList = $('#publication-list');
  if (postList) postList.innerHTML = posts.error
    ? '<p class="empty-state">Les publications ne peuvent pas être chargées pour le moment. Réessaie plus tard.</p>'
    : postRows.length ? postRows.map(postCard).join('') : '<p class="empty-state">Aucune publication pour le moment.</p>';

  if (location.pathname.endsWith('/publications.html')) {
    const target = $('.inner-main');
    const list = $('#publication-list');
    if (target && list && !$('#cms-publications')) {
      const section = document.createElement('section');
      section.id = 'cms-publications';
      section.className = 'cms-public-section';
      section.innerHTML = '<h2>Dernieres publications</h2>';
      section.append(list);
      target.prepend(section);
    }
  }
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
      target.prepend(section);
    }
    const list = $('#cms-category-publication-list');
    const matching = postRows.filter(post => post.category === categoryPage.category);
    if (list) list.innerHTML = posts.error
      ? '<p class="empty-state">Les publications de cette rubrique sont momentanément indisponibles.</p>'
      : matching.map(postCard).join('') || '<p class="empty-state">Aucune publication dans cette rubrique pour le moment.</p>';
  }

  const resourceList = $('#managed-resource-list');
  if (resourceList) resourceList.innerHTML = (resources.data || []).map(r => `<article class="publication-card resource-card">${mediaPreview(r.file_url,r.file_mime_type)}<div><span class="eyebrow">${escapeHtml(r.category)}${r.file_size ? ' · '+(r.file_size/1048576).toFixed(1)+' Mo' : ''}</span><h3>${escapeHtml(r.title)}</h3><p>${escapeHtml(r.description)}</p><div class="resource-actions">${r.external_url ? `<a class="text-link" href="${safeHref(r.external_url)}" target="_blank" rel="noopener">Consulter ↗</a>` : ''}${r.file_url ? `<a class="btn download-btn" href="${downloadHref(r.file_url,r.file_name)}">Télécharger ${escapeHtml(r.file_name || 'la ressource')} ↓</a>` : ''}</div></div></article>`).join('') || '<p class="empty-state">Les ressources ajoutées par l’EMPD apparaîtront ici.</p>';
  if (location.pathname.endsWith('/ressources.html')) {
    const target = $('.inner-main');
    const list = $('#managed-resource-list');
    if (target && list && !$('#cms-resources')) {
      const section = document.createElement('section');
      section.id = 'cms-resources';
      section.className = 'cms-public-section';
      section.innerHTML = '<h2>Ressources publiees</h2>';
      section.append(list);
      target.prepend(section);
    }
  }
  if (location.pathname.endsWith('/galerie.html')) {
    const target = $('.inner-main');
    if (target && !$('#cms-gallery')) {
      const section = document.createElement('section'); section.id='cms-gallery'; section.className='cms-public-section';
      section.innerHTML='<h2>Galerie de l’EMPD</h2><div class="cms-gallery-grid" id="cms-gallery-grid"></div>';
      target.prepend(section);
    }
    const grid = $('#cms-gallery-grid');
    if (grid) grid.innerHTML = (gallery.data || []).map(g => `<figure class="cms-gallery-item">${g.media_type === 'video' || String(g.media_mime_type || '').startsWith('video/') ? `<video controls preload="metadata" src="${safeHref(g.image_url)}" aria-label="${escapeHtml(g.title)}"></video>` : `<img src="${safeHref(g.image_url)}" alt="${escapeHtml(g.alt_text || g.title)}" loading="lazy">`}<figcaption><b>${escapeHtml(g.title)}</b><span>${escapeHtml(g.description)}</span>${g.media_name ? `<a class="text-link" href="${downloadHref(g.image_url,g.media_name)}">Télécharger le média ↓</a>` : ''}</figcaption></figure>`).join('') || '<p class="empty-state">Les photos et vidéos de nos activités seront bientôt publiées.</p>';
  }
  if (location.pathname.endsWith('/empd-tv.html')) {
    const target = $('.inner-main');
    if (target && !$('#cms-videos')) {
      const section = document.createElement('section'); section.id='cms-videos'; section.className='cms-public-section';
      section.innerHTML='<h2>Vidéos et enseignements EMPD</h2><div class="cms-video-grid" id="cms-video-grid"></div>';
      target.prepend(section);
    }
    const grid = $('#cms-video-grid');
    if (grid) grid.innerHTML = (videos.data || []).map(v => `<article class="cms-video-card">${v.thumbnail_url ? `<img src="${safeHref(v.thumbnail_url)}" alt="" loading="lazy">` : ''}<div><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.description)}</p>${String(v.video_mime_type || '').startsWith('video/') ? `<video class="cms-inline-media" controls preload="metadata" src="${safeHref(v.video_url)}"></video><a class="text-link" href="${downloadHref(v.video_url,v.video_file_name)}">Télécharger la vidéo ↓</a>` : `<a class="text-link" href="${safeHref(v.video_url)}" target="_blank" rel="noopener">Regarder la vidéo ↗</a>`}</div></article>`).join('') || '<p class="empty-state">Les prochaines vidéos de l’EMPD apparaîtront ici.</p>';
  }
}
const modules = {
  publications: { table:'publications', label:'Publications', fields:[
    ['title','Titre (facultatif si tu ajoutes un média)','text',false],['category','Catégorie','select',false,['Actualité','Enseignement','Louange & adoration','Annonce','Méditation']],
    ['body','Description (facultative)','textarea',false],['image_url','Image de couverture (facultatif)','file',false,null,'image/*'],
    ['attachment_url','Document Word, PDF, présentation, audio ou vidéo (facultatif)','file',false,null,documentAccept],['status','Visibilité','select',true,['published','draft']]
  ]},
  gallery_items: { table:'gallery_items', label:'Galerie', fields:[
    ['image_url','Importer directement une image ou une vidéo','file',true,null,mediaAccept],
    ['status','Visibilité','select',true,['published','draft']]
  ]},
  resources: { table:'resources', label:'Ressources', fields:[
    ['title','Nom de la ressource','text',true],['category','Type','select',true,['Document Word','Document PDF','Présentation','Tableur Excel','Vidéo','Audio','Image','Archive ZIP','Autre']],
    ['description','Description','textarea',false],['file_url','Fichier à télécharger','file',false,null,documentAccept],['external_url','Lien externe (facultatif)','url',false],['status','Visibilité','select',true,['published','draft']]
  ]},
  media_videos: { table:'media_videos', label:'EMPD TV', fields:[
    ['video_url','Importer une vidéo MP4, WEBM ou MOV, ou coller un lien YouTube/Vimeo','media',false],
    ['status','Visibilité','select',true,['published','draft']]
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
  if (type==='file') return `<label>${label}<input type="file" name="${name}" accept="${field[5] || documentAccept}" ${required && !value?'required':''}> <small>Formats courants acceptés · taille maximale : 50 Mo. ${value?'Un fichier est déjà associé ; sélectionne un nouveau fichier pour le remplacer.':''}</small></label>`;
  if (type==='media') return `<label>${label}<input type="url" name="${name}" value="${escapeHtml(value)}" placeholder="https://…"><small>Ou importe directement une vidéo MP4, WEBM ou MOV (50 Mo maximum).</small><input type="file" name="video_upload" accept="video/mp4,video/webm,video/quicktime"></label>`;
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
      const hero_image = file?.size ? (await uploadFile(file,'page-banners',new Set(['image/jpeg','image/png','image/webp','image/gif']))).url : (previous.hero_image || null);
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
    <form id="cms-item-form" class="cms-form" hidden><div class="cms-form-grid">${mod.fields.map(f=>fieldMarkup(f,editing||{})).join('')}</div><div class="cms-form-actions"><button class="btn gold" type="submit">${editing?'Enregistrer les modifications':'Enregistrer'}</button><button class="btn outline" type="button" id="cms-cancel">Annuler</button></div><p id="cms-save-status" class="cms-save-status" role="status" aria-live="polite"></p></form>
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
    const statusLine=$('#cms-save-status');
    const originalLabel=submitButton.textContent;
    const setProgress=(message,label)=>{if(statusLine)statusLine.textContent=message;submitButton.textContent=label||'En cours...';};
    setProgress('Preparation du contenu...','Preparation...');
    const fd=new FormData(form);
    const payload={};
    try{
      for(const field of mod.fields){
        const [name,,type]=field;
        if(type==='file'){
          const file=fd.get(name);
          if(file?.size){
            const accepted = field[5] === 'image/*' ? new Set(['image/jpeg','image/png','image/webp','image/gif']) : field[5] === mediaAccept ? new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']) : allowedMimeTypes;
            setProgress('Televersement de '+file.name+'...','Televersement...');
            const uploaded=await uploadFile(file,activeModule,accepted);
            payload[name]=uploaded.url;
            if(activeModule==='publications' && name==='attachment_url'){payload.attachment_name=uploaded.name;payload.attachment_mime_type=uploaded.mimeType;payload.attachment_size=uploaded.size;}
            if(activeModule==='resources' && name==='file_url'){payload.file_name=uploaded.name;payload.file_mime_type=uploaded.mimeType;payload.file_size=uploaded.size;}
            if(activeModule==='gallery_items' && name==='image_url'){payload.media_type=uploaded.mimeType.startsWith('video/')?'video':'image';payload.media_name=uploaded.name;payload.media_mime_type=uploaded.mimeType;payload.media_size=uploaded.size;payload.title=uploaded.name.replace(/\.[^.]+$/,'').trim() || 'Média EMPD';payload.alt_text=payload.title;payload.description='';}
          }else if(editing && name==='image_url' && activeModule==='gallery_items') payload.media_type=editing.media_type||'image';
        }else if(type==='media'){
          const uploadedFile=fd.get('video_upload');
          const url=String(fd.get(name)||'').trim();
          if(uploadedFile?.size){
            setProgress('Televersement de '+uploadedFile.name+'...','Televersement...');
            const uploaded=await uploadFile(uploadedFile,activeModule,new Set(['video/mp4','video/webm','video/quicktime']));
            payload.video_url=uploaded.url;payload.video_mime_type=uploaded.mimeType;payload.video_file_name=uploaded.name;payload.video_size=uploaded.size;payload.title=uploaded.name.replace(/\.[^.]+$/,'').trim() || 'Vidéo EMPD';payload.description='';
          }else if(url){
            if(!/^https?:\/\//i.test(url)) throw new Error('Le lien vidéo doit commencer par http:// ou https://.');
            payload.video_url=url;
            payload.title=editing?.title || 'Vidéo EMPD';payload.description=editing?.description || '';
            if(!editing || url!==editing.video_url){payload.video_mime_type=null;payload.video_file_name=null;payload.video_size=null;}
          }else if(!editing) throw new Error('Ajoute un lien vidéo ou importe un fichier vidéo.');
        }else{
          const value=fd.get(name);
          if(value!==null)payload[name]=String(value).trim();
        }
      }
      if(activeModule==='publications'){
        const imageFile=fd.get('image_url');
        const attachmentFile=fd.get('attachment_url');
        const mediaName=payload.attachment_name || (attachmentFile?.size ? attachmentFile.name : '') || (imageFile?.size ? imageFile.name : '') || editing?.attachment_name || '';
        if(!String(payload.title||'').trim()) payload.title=editing?.title || mediaName.replace(/\.[^.]+$/,'').trim() || 'Publication EMPD';
        if(!String(payload.body||'').trim()) payload.body='';
        if(!String(payload.category||'').trim()) payload.category=editing?.category || 'Actualité';
      }
      if(activeModule==='publications' && payload.status==='published' && (!editing?.published_at || editing.status!=='published')){
        payload.published_at=new Date().toISOString();
      }
      if(activeModule==='gallery_items'){
        if(!payload.image_url && !editing?.image_url) throw new Error('Selectionne une image ou une video avant de publier dans la galerie.');
        payload.title=payload.title || editing?.title || payload.media_name?.replace(/\.[^.]+$/,'').trim() || 'Media EMPD';
        payload.description=String(payload.description ?? editing?.description ?? '').trim();
        payload.alt_text=payload.alt_text || editing?.alt_text || payload.title;
        payload.category=payload.category || editing?.category || 'Activit\u00e9s';
        payload.media_type=payload.media_type || editing?.media_type || 'image';
      }
      if(activeModule==='media_videos'){
        if(!payload.video_url && !editing?.video_url) throw new Error('Ajoute un lien YouTube/Vimeo ou importe une video avant de publier sur EMPD TV.');
        payload.title=payload.title || editing?.title || 'Video EMPD';
        payload.description=String(payload.description ?? editing?.description ?? '').trim();
        payload.category=payload.category || editing?.category || 'EMPD TV';
      }
      if(activeModule==='resources'){
        payload.description=String(payload.description ?? editing?.description ?? '').trim();
        payload.category=payload.category || editing?.category || 'Autre';
        if(!payload.file_url && !payload.external_url && !editing?.file_url && !editing?.external_url) throw new Error('Ajoute un fichier ou un lien externe pour publier cette ressource.');
      }
      if(!editing) payload.created_by=accountUserId;
      setProgress('Enregistrement dans la base de donnees...','Publication...');
      const query=editing
        ? supabase.from(mod.table).update(payload).eq('id',editing.id)
        : supabase.from(mod.table).insert(payload);
      const {data:saved,error}=await query.select('id,title,status').single();
      if(error)throw error;
      if(!saved)throw new Error('Supabase n’a confirmé aucun enregistrement.');
      const wasEditing=Boolean(editing);
      editing=null;
      form.reset();
      notify(wasEditing?'Modifications enregistrees.':'Publication en ligne ! Les visiteurs peuvent maintenant la voir.');
      setProgress('Enregistrement termine avec succes.','Termine !');
      renderAdminModule().catch(error=>notify('Publication enregistree, mais actualisation de la liste impossible : '+error.message,true));
      loadPublicContent().catch(error=>console.warn('EMPD CMS refresh:',error.message));
    }catch(error){
      console.error('EMPD CMS save:',error);
      notify('Enregistrement impossible : '+(error.message||'erreur inconnue'),true);
      setProgress('Echec : '+(error.message||'erreur inconnue'),'Reessayer');
    }finally{
      if(submitButton.isConnected){submitButton.disabled=false;if(!statusLine?.textContent.startsWith('Echec'))submitButton.textContent=originalLabel;}
    }
  });
}
let accountUserId = null;
async function renderMembers(panel) {
  panel.innerHTML = '<p>Chargement des comptes…</p>';
  const {data:result,error:invokeError}=await supabase.functions.invoke('list-members',{body:{}});
  if(invokeError){
    let detail='';
    try{const payload=await invokeError.context?.json();detail=payload?.error||'';}catch{}
    panel.innerHTML=`<p class="admin-warning">${escapeHtml(detail||invokeError.message||'Impossible de charger les comptes.')}</p><p>Vérifie que le service de gestion des membres est déployé.</p>`;
    return;
  }
  if(!result?.ok||!Array.isArray(result.members)){
    panel.innerHTML=`<p class="admin-warning">${escapeHtml(result?.error||'Réponse invalide du service membres.')}</p>`;
    return;
  }
  const members=result.members;
  const dateTime=value=>value?new Date(value).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'Jamais connecté';
  panel.innerHTML=`
    <div class="cms-module-heading"><div><h2>Ajouter un membre ou un administrateur</h2><p>Crée un lien d’invitation et choisis directement les droits du nouveau compte.</p></div></div>
    <form id="cms-invite-form" class="cms-form">
      <div class="cms-form-grid">
        <label>Nom complet (facultatif)<input name="full_name" maxlength="100" autocomplete="name"></label>
        <label>Adresse e-mail<input name="email" type="email" maxlength="254" required autocomplete="email" placeholder="personne@exemple.com"></label>
        <label>Type de compte<select name="role"><option value="member">Membre</option><option value="admin">Administrateur</option></select></label>
      </div>
      <div class="cms-form-actions"><button class="btn gold" type="submit">Créer l’invitation</button></div>
      <p class="cms-help">Choisis « Administrateur » pour donner immédiatement les droits de gestion. Aucun e-mail n’est envoyé automatiquement : copie le lien et transmets-le par WhatsApp, SMS ou e-mail.</p>
      <p id="cms-invite-message" role="status" aria-live="polite"></p>
      <div id="cms-invite-link-wrap" hidden>
        <label>Lien personnel à transmettre<textarea id="cms-invite-link" rows="3" readonly></textarea></label>
        <div class="cms-form-actions"><button class="btn outline" type="button" id="cms-copy-invite">Copier le lien</button></div>
      </div>
    </form>
    <div class="cms-module-heading"><div><h2>Adresses e-mail des comptes</h2><p>${members.length} compte(s) enregistré(s). La dernière connexion indique la dernière authentification connue, pas une présence en direct.</p></div></div>
    <label class="cms-member-search">Rechercher un membre<input id="cms-member-filter" type="search" placeholder="Nom ou adresse e-mail…"></label>
    <div class="cms-record-list" id="cms-member-list">${members.map(member=>{
      const role=member.role==='admin'?'Administrateur':'Membre';
      const subscribed=member.newsletter_subscribed?'Abonné aux actualités':'Non abonné';
      return `<article class="cms-record cms-member-record" data-search="${escapeHtml((member.full_name+' '+member.email).toLowerCase())}">
        <div class="cms-member-details"><b>${escapeHtml(member.full_name||'Membre')}</b><p><a href="mailto:${escapeHtml(member.email)}">${escapeHtml(member.email||'Adresse indisponible')}</a></p>
        <small>Compte créé : ${dateTime(member.created_at)} · Dernière connexion : ${dateTime(member.last_sign_in_at)}</small>
        <small>${role} · ${subscribed}</small></div>
        <div class="cms-record-actions"><select data-role-user="${escapeHtml(member.id)}" aria-label="Rôle de ${escapeHtml(member.email)}" ${member.id===accountUserId?'disabled title="Tu ne peux pas modifier ton propre rôle ici."':''}>
          <option value="member" ${member.role!=='admin'?'selected':''}>Membre</option><option value="admin" ${member.role==='admin'?'selected':''}>Administrateur</option>
        </select></div>
      </article>`;
    }).join('')||'<p class="empty-state">Aucun membre pour le moment.</p>'}</div>`;
  const filter=$('#cms-member-filter');
  filter.addEventListener('input',()=>{
    const query=filter.value.trim().toLocaleLowerCase('fr');
    panel.querySelectorAll('.cms-member-record').forEach(row=>{row.hidden=!row.dataset.search.includes(query);});
  });
  const inviteForm=$('#cms-invite-form');
  inviteForm.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=inviteForm.querySelector('button[type="submit"]');
    const message=$('#cms-invite-message');
    const fd=new FormData(inviteForm);
    button.disabled=true;message.textContent='Création du lien sécurisé…';message.dataset.error='false';
    try{
      const {data:invitation,error:invokeError}=await supabase.functions.invoke('invite-member',{body:{
        email:String(fd.get('email')||'').trim(),
        full_name:String(fd.get('full_name')||'').trim(),
        role:String(fd.get('role')||'member')
      }});
      if(invokeError){
        let detail='';
        try{const payload=await invokeError.context?.json();detail=payload?.error||'';}catch{}
        throw new Error(detail||invokeError.message||'Impossible de créer l’invitation.');
      }
      if(!invitation?.ok)throw new Error(invitation?.error||'La demande n’a pas abouti.');
      if(!invitation?.invitation_link)throw new Error('Le lien d’invitation n’a pas été retourné.');
      $('#cms-invite-link').value=invitation.invitation_link;
      $('#cms-invite-link-wrap').hidden=false;
      message.textContent=`Invitation créée pour ${invitation.email}. Rôle : ${invitation.role==='admin'?'administrateur':'membre'}. Copie le lien et transmets-le à la personne.`;
      inviteForm.reset();
      notify('Invitation créée. Il reste à transmettre le lien.');
      $('#cms-copy-invite').onclick=async()=>{
        const link=$('#cms-invite-link').value;
        try{await navigator.clipboard.writeText(link);notify('Lien copié dans le presse-papiers.');}
        catch{$('#cms-invite-link').focus();$('#cms-invite-link').select();notify('Sélectionne le lien puis copie-le avec Ctrl+C.');}
      };
    }catch(err){message.textContent=err.message||'Une erreur est survenue.';message.dataset.error='true';}
    finally{button.disabled=false;}
  });
  panel.querySelectorAll('[data-role-user]').forEach(select=>select.addEventListener('change',async()=>{
    const member=members.find(item=>item.id===select.dataset.roleUser);
    const previous=member?.role||'member';
    const next=select.value;
    if(!confirm(next==='admin'?'Donner les droits administrateur à ce membre ?':'Retirer les droits administrateur de ce membre ?')){select.value=previous;return;}
    select.disabled=true;
    try{
      const {data:result,error}=await supabase.functions.invoke('set-member-role',{body:{user_id:select.dataset.roleUser,role:next}});
      if(error){let detail='';try{const payload=await error.context?.json();detail=payload?.error||'';}catch{}throw new Error(detail||error.message||'Impossible de modifier le rôle.');}
      if(!result?.ok)throw new Error(result?.error||'La modification du rôle a échoué.');
      member.role=next;notify(next==='admin'?'Droits administrateur accordés.':'Droits administrateur révoqués.');
    }catch(error){notify(error.message||'Impossible de modifier le rôle.',true);select.value=previous;}
    finally{select.disabled=select.dataset.roleUser===accountUserId;}
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