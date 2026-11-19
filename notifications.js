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

let items = [];
let channel = null;

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
    list.innerHTML = items.length ? items.slice(0, 12).map(item => {
      const isRead = read.has(item.id);
      return '<a class="notification-item ' + (isRead ? 'is-read' : 'is-unread') +
        '" href="' + safeTarget(item.target_url) + '">' +
        '<span class="notification-dot"></span><span><b>' + escapeHTML(item.title) +
        '</b><small><span class="notification-new-label">' + (isRead ? '' : 'NOUVEAU · ') +
        escapeHTML(item.category || item.content_type) + '</span> · ' +
        escapeHTML(new Date(item.created_at).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})) +
        '</small></span></a>';
    }).join('') : '<p class="notification-empty">Aucune nouvelle publication pour le moment.</p>';
  }
  if (panel) {
    const oldHelp = panel.querySelector('#enable-notifications');
    if (oldHelp) oldHelp.outerHTML = '<p class="notification-help">Les nouveaux contenus publies par l’EMPD apparaitront automatiquement ici.</p>';
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
  const latest = items.slice(0, 3);
  section.innerHTML = '<div class="wrap"><div class="home-latest-heading"><div><span class="eyebrow">ACTUALITES DE L’EMPD</span><h2>Les dernieres nouveautes</h2></div><a class="text-link" href="/publications.html">Toutes les publications ↗</a></div>' +
    (latest.length ? '<div class="home-latest-grid">' + latest.map(item =>
      '<a class="home-latest-card" href="' + safeTarget(item.target_url) + '">' +
      '<span class="home-latest-badge">NOUVEAU</span><small>' + escapeHTML(item.category || item.content_type) +
      ' · ' + escapeHTML(new Date(item.created_at).toLocaleDateString('fr-FR')) +
      '</small><h3>' + escapeHTML(item.title) + '</h3><span class="home-latest-link">Decouvrir ↗</span></a>'
    ).join('') + '</div>' : '<p class="empty-state">Les nouveaux contenus publies par l’EMPD apparaitront ici.</p>') +
    '</div>';
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
  items = data || [];
  renderNotifications();
  renderHomeLatest();
}

function installNotificationControls() {
  const bell = document.getElementById('notification-bell');
  const panel = document.getElementById('notification-panel');
  if (!bell || !panel) return;

  // Capture the click before the legacy local-only notification handler.
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

if (supabaseConfigured) {
  channel = supabase.channel('empd-site-notifications')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_notifications' }, refreshNotifications)
    .subscribe();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshNotifications();
  });
  window.addEventListener('focus', refreshNotifications);
}
