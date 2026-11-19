import { supabase, supabaseConfigured } from './supabaseClient.js';

const READ_KEY = 'empd-site-notifications-read-v1';
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const readIds = () => {
  try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); }
  catch { return new Set(); }
};
const saveReadIds = ids => {
  try { localStorage.setItem(READ_KEY, JSON.stringify([...ids].slice(-300))); } catch {}
};
const safeTarget = value => /^\/(?!\/)[a-z0-9/_-]+\.html(?:#[a-z0-9_-]+)?$/i.test(String(value || ''))
  ? value : '/publications.html';
const safeMediaUrl = value => {
  try {
    const url = new URL(String(value || ''), location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
};
const dateTime = value => new Date(value).toLocaleString('fr-FR', {dateStyle:'medium', timeStyle:'short'});
const dateOnly = value => new Date(value).toLocaleDateString('fr-FR');
const kindLabel = item => ({
  publication:'Publication',
  gallery:'Galerie',
  video:'EMPD TV',
  resource:'Ressource'
}[item.content_type] || item.category || 'Nouveauté');

let items = [];
let hasLoadedNotifications = false;
let channel = null;

function mediaMarkup(item, className = 'home-latest-media') {
  const url = safeMediaUrl(item.preview_url);
  let mime = String(item.preview_mime_type || '').toLowerCase();
  if (url && item.content_type === 'publication' && /\.(jpe?g|png|webp|gif|avif)$/i.test(new URL(url).pathname)) mime = 'image/*';
  if (url && mime.startsWith('image/')) {
    return '<img class="' + className + '" src="' + escapeHTML(url) + '" alt="" loading="lazy">';
  }
  if (url && mime.startsWith('video/')) {
    return '<video class="' + className + '" src="' + escapeHTML(url) + '" muted playsinline preload="metadata"></video>';
  }
  const label = item.content_type === 'video' || mime.startsWith('video/') ? 'VIDEO'
    : mime === 'application/pdf' ? 'PDF'
    : item.content_type === 'gallery' ? 'PHOTO'
    : item.content_type === 'resource' ? 'DOCUMENT'
    : 'EMPD';
  return '<span class="' + className + ' home-latest-placeholder" aria-hidden="true">' + label + '</span>';
}

function renderNotifications() {
  const bell = document.getElementById('notification-bell');
  const count = document.getElementById('notification-count');
  const panel = document.getElementById('notification-panel');
  const list = document.getElementById('notification-items');
  const read = readIds();
  const unread = items.filter(item => !read.has(item.id));

  if (count) {
    count.textContent = String(unread.length);
    count.hidden = unread.length === 0;
  }
  if (bell) {
    bell.setAttribute('aria-label', unread.length
      ? unread.length + ' nouvelle(s) notification(s)'
      : 'Ouvrir les notifications');
    bell.classList.toggle('has-unread', unread.length > 0);
  }
  if (list) {
    list.innerHTML = items.length ? items.slice(0, 15).map(item => {
      const isRead = read.has(item.id);
      return '<a class="notification-item ' + (isRead ? 'is-read' : 'is-unread') +
        '" href="' + safeTarget(item.target_url) + '">' +
        mediaMarkup(item, 'notification-thumb') +
        '<span class="notification-copy"><b>' + escapeHTML(item.title) +
        '</b><small><span class="notification-new-label">' + (isRead ? '' : 'NOUVEAU · ') +
        escapeHTML(kindLabel(item)) + '</span> · ' + escapeHTML(dateTime(item.created_at)) +
        '</small></span></a>';
    }).join('') : '<p class="notification-empty">Aucune nouvelle publication pour le moment.</p>';
  }
  if (panel) {
    const oldHelp = panel.querySelector('#enable-notifications');
    if (oldHelp) oldHelp.outerHTML = '<p class="notification-help">Les nouveautes se mettent a jour automatiquement pendant que le site est ouvert.</p>';
  }
}

function renderHomeLatest() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  let section = document.getElementById('home-latest-updates');
  if (!section) {
    section = document.createElement('section');
    section.id = 'home-latest-updates';
    section.className = 'home-latest-section';
    hero.insertAdjacentElement('afterend', section);
  }
  const latest = items.slice(0, 8);
  const legacyPublications = document.querySelector('.home-publications-section');
  if (legacyPublications) legacyPublications.hidden = latest.length > 0;
  if (!latest.length) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  section.innerHTML = '<div class="wrap"><div class="home-latest-heading"><div><span class="eyebrow">ACTUALITES DE L’EMPD</span><h2>Les dernieres nouveautes</h2></div><a class="text-link" href="/publications.html">Toutes les publications ↗</a></div>' +
    '<div class="home-latest-grid">' + latest.map(item =>
      '<a class="home-latest-card" href="' + safeTarget(item.target_url) + '">' +
      '<span class="home-latest-badge">NOUVEAU</span>' +
      mediaMarkup(item) +
      '<span class="home-latest-type">' + escapeHTML(kindLabel(item)) + '</span>' +
      '<small>' + escapeHTML(item.category || kindLabel(item)) + ' · ' + escapeHTML(dateOnly(item.created_at)) +
      '</small><h3>' + escapeHTML(item.title) + '</h3><span class="home-latest-link">Decouvrir ↗</span></a>'
    ).join('') + '</div></div>';
}

async function refreshNotifications() {
  if (!supabaseConfigured) return;
  const { data, error } = await supabase.from('site_notifications')
    .select('id,content_id,content_type,title,category,target_url,preview_url,preview_mime_type,created_at')
    .order('created_at', { ascending: false }).limit(30);
  if (error) {
    console.warn('EMPD notifications:', error.message);
    return;
  }
  const previousIds = new Set(items.map(item => item.id));
  const nextItems = data || [];
  const hasNewItem = hasLoadedNotifications && nextItems.some(item => !previousIds.has(item.id));
  items = nextItems;
  hasLoadedNotifications = true;
  renderNotifications();
  renderHomeLatest();
  if (hasNewItem) {
    const bell = document.getElementById('notification-bell');
    bell?.classList.remove('notification-arrival');
    requestAnimationFrame(() => bell?.classList.add('notification-arrival'));
    window.setTimeout(() => bell?.classList.remove('notification-arrival'), 2200);
  }
}

function installNotificationControls() {
  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notification-panel');
  if (!bell || !panel) return;

  document.addEventListener('click', event => {
    if (event.target.closest('#notification-bell')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const open = panel.hidden;
      panel.hidden = !open;
      bell.setAttribute('aria-expanded', String(open));
      if (open) {
        const read = readIds();
        items.forEach(item => read.add(item.id));
        saveReadIds(read);
        renderNotifications();
      }
    } else if (event.target.closest('#mark-notifications-read')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const read = readIds();
      items.forEach(item => read.add(item.id));
      saveReadIds(read);
      renderNotifications();
    } else if (!event.target.closest('#notification-panel')) {
      panel.hidden = true;
      bell.setAttribute('aria-expanded', 'false');
    }
  }, true);
}

installNotificationControls();
refreshNotifications();

window.addEventListener('empd-content-published', refreshNotifications);

if (supabaseConfigured) {
  channel = supabase.channel('empd-site-notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_notifications' }, refreshNotifications)
    .subscribe(status => {
      if (status === 'SUBSCRIBED') refreshNotifications();
    });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshNotifications();
  });
  window.addEventListener('focus', refreshNotifications);
}
