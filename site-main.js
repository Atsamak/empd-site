import './app.js';
import './cms.js';
import './notifications.js';
import './i18n.js';
import './site-search.js';
import './meeting-schedule.js';
import './wisdom-publication.js';

const themeButton = document.getElementById('theme-toggle');
const readSavedTheme = () => {
  try { return localStorage.getItem('empd-theme') === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
};
const applyTheme = theme => {
  const dark = theme === 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (themeButton) {
    themeButton.textContent = dark ? '☀️' : '🌙';
    themeButton.setAttribute('aria-label', dark ? 'Activer le mode clair' : 'Activer le mode sombre');
    themeButton.setAttribute('title', dark ? 'Mode clair' : 'Mode sombre');
    themeButton.setAttribute('aria-pressed', String(dark));
  }
  try { localStorage.setItem('empd-theme', dark ? 'dark' : 'light'); } catch {}
};
applyTheme(readSavedTheme());
themeButton?.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

import './motion.js';
import './visual-refinement.css';
import './wisdom-publication.css';
