import { supabase, supabaseConfigured } from './supabaseClient.js';

const pageIndex = [
  { title: 'Accueil EMPD', url: '/index.html', text: 'École Mondiale de la Parole de Dieu. Une parole, des vies transformées, un monde à toucher. Formation biblique, ressources en ligne, ouverture internationale. Notre appel : faire rayonner la connaissance de la Parole, ici et partout dans le monde. Dernières publications. Enseignements, louange et adoration, EMPD TV, galerie, ressources, actualités et annonces. Un enseignement guidé par la Parole de Dieu. MENDO PAULIN, fondateur et responsable de l’EMPD. De Happi, Odza, vers le monde entier. Retrouvez-nous à Happi, Odza, Yaoundé, Cameroun. La Parole de Dieu pour éclairer les vies, former et relier les générations.' },
  { title: 'Notre école', url: '/notre-ecole.html', text: 'Notre identité. Une école de la Parole, ouverte au monde. L’École Mondiale de la Parole de Dieu est un espace de formation, de partage et d’approfondissement des Saintes Écritures. Notre mission : transmettre et approfondir la Parole de Dieu par un enseignement biblique accessible, structuré et vivant. Notre vision internationale : relier les apprenants au-delà des frontières grâce aux enseignements, aux ressources numériques et aux rencontres. Fondateur et responsable : MENDO PAULIN.' },
  { title: 'Enseignements', url: '/enseignements.html', text: 'Se former dans la Parole. Des enseignements pour affermir la foi. Des parcours bibliques, des études thématiques et des temps de formation pour comprendre les Écritures et les mettre en pratique. Études bibliques : étudier les livres, les personnages et les grands thèmes de la Bible. Fondements de la foi : approfondir les doctrines et les bases de la vie chrétienne. Formations et conférences : retrouver les enseignements et rencontres proposés par l’EMPD.' },
  { title: 'Louange et adoration', url: '/louange.html', text: 'Célébrer ensemble. Louange et adoration. Un espace consacré à la louange, à la prière et à l’adoration, au cœur de la vie chrétienne. Moments de louange : retrouver les temps forts et les rencontres de la communauté. Chants et méditations : des contenus pour accompagner la prière et la méditation personnelle. Rencontres et annonces des prochains rendez-vous. Bethel Music, Hillsong Worship, Elevation Worship, Maverick City Music.' },
  { title: 'EMPD TV', url: '/empd-tv.html', text: 'L’EMPD au-delà des murs. EMPD TV : apprendre, écouter, partager. Retrouvez les prédications, les enseignements filmés, les émissions et les contenus audiovisuels. Vidéos et prédications. MTTV. Depuis l’international, suivre l’EMPD depuis le Cameroun et l’étranger. GOD TV Africa, Emmanuel TV, Daystar Television, TBN, CBN TV, EMCI TV.' },
  { title: 'Galerie', url: '/galerie.html#cms-gallery', text: 'La vie de l’école en images. Des visages, des rencontres, une même foi. Découvrez les activités, les rencontres et les moments de partage de la communauté EMPD. Activités et rencontres : photographies officielles de l’école. Événements : temps forts de nos rencontres et formations. Communauté : une école ouverte à toutes les générations et à tous les horizons.' },
  { title: 'Ressources', url: '/ressources.html', text: 'Bibliothèque numérique. Les ressources pour approfondir. Des outils et des références pour poursuivre l’étude de la Bible partout dans le monde. Bible en ligne : consultez les Écritures et comparez les traductions. Dictionnaire biblique : explorez les mots, notions et personnages bibliques. Documents et supports : cours et documents PDF de l’EMPD. Ressources internationales : plateformes bibliques et outils d’étude complémentaires.' },
  { title: 'Publications', url: '/publications.html', text: 'Actualités et méditations. Les publications de l’EMPD. Retrouvez les annonces, articles, textes, photos et vidéos partagés par l’administration.' },
  { title: 'Contact', url: '/contact.html', text: 'Nous contacter. L’EMPD, à Happi, Odza, Yaoundé, Cameroun. Notre communauté est basée à Happi, dans le quartier d’Odza à Yaoundé, au Cameroun. Notre localisation. Fondateur et responsable : MENDO PAULIN. Une école ouverte à l’international, ressources accessibles depuis le Cameroun et l’étranger.' }
];

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const normalize = value => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr');

function addBiblicalReference(selector, reference) {
  const target = document.querySelector(selector);
  if (!target || target.dataset.bibleReference) return;
  const note = document.createElement('small');
  note.className = 'biblical-reference';
  note.textContent = reference;
  target.append(note);
  target.dataset.bibleReference = 'true';
}

function addSloganReferences() {
  // Sur l'accueil, les références suivent les phrases complètes au lieu d'être placées sous les slogans du titre.
  if (location.pathname === '/' || location.pathname === '/index.html') {
    addBiblicalReference('.hero-content > p', 'Psaume 119:105');
    addBiblicalReference('.intro-grid > div:last-child > p', '2 Corinthiens 4:6');
    addBiblicalReference('.teacher-grid > div:last-child > p', '2 Timothée 3:16-17');
    addBiblicalReference('.global-inner > div:first-child > p', 'Matthieu 28:19-20');
    addBiblicalReference('.footer-grid > div:first-child > p', 'Psaume 119:105');
  }
  addBiblicalReference('.photo-caption', '2 Timothée 2:2');
  addBiblicalReference('.inner-aside h3', 'Matthieu 28:19-20');

  const pageHeroReferences = {
    '/notre-ecole.html': '2 Timothée 3:16-17',
    '/enseignements.html': '2 Timothée 2:15',
    '/louange.html': 'Psaume 100:2',
    '/empd-tv.html': 'Romains 10:17',
    '/galerie.html': 'Hébreux 10:24-25',
    '/ressources.html': 'Actes 17:11',
    '/publications.html': '1 Timothée 4:13',
    '/contact.html': 'Matthieu 5:14-16'
  };
  const pageReference = pageHeroReferences[location.pathname];
  if (pageReference) addBiblicalReference('.page-hero h1', pageReference);
}

async function loadSearchIndex() {
  const items = [...pageIndex];
  const main = document.querySelector('main');
  if (main) {
    const visibleText = [...main.querySelectorAll('h1,h2,h3,p,li')]
      .map(node => node.textContent.trim()).filter(Boolean).join(' ');
    if (visibleText) {
      const currentPath = location.pathname === '/' ? '/index.html' : location.pathname;
      const currentItem = items.find(item => item.url.split('#')[0] === currentPath);
      if (currentItem) currentItem.text += ' ' + visibleText;
      else items.push({
        title: document.querySelector('main h1')?.textContent.trim() || 'Cette page',
        url: currentPath,
        text: visibleText
      });
    }
  }

  if (!supabaseConfigured) return items;

  const requests = await Promise.all([
    supabase.from('publications').select('id,title,body,category,image_url,published_at').eq('status', 'published').order('published_at', { ascending: false }).limit(200),
    supabase.from('gallery_items').select('id,title,description,category,alt_text').eq('status', 'published').order('created_at', { ascending: false }).limit(200),
    supabase.from('resources').select('id,title,description,category').eq('status', 'published').order('created_at', { ascending: false }).limit(200),
    supabase.from('media_videos').select('id,title,description,category').eq('status', 'published').order('created_at', { ascending: false }).limit(200)
  ]);

  const [publications, gallery, resources, videos] = requests;
  for (const result of requests) {
    if (result.error) console.warn('Recherche EMPD :', result.error.message);
  }
  for (const row of publications.data || []) items.push({
    title: row.title, text: [row.category, row.body].join(' '),
    url: '/publications.html#publication-list', kind: 'Publication'
  });
  for (const row of gallery.data || []) items.push({
    title: row.title, text: [row.category, row.description, row.alt_text].join(' '),
    url: '/galerie.html#cms-gallery', kind: 'Galerie'
  });
  for (const row of resources.data || []) items.push({
    title: row.title, text: [row.category, row.description].join(' '),
    url: '/ressources.html#managed-resource-list', kind: 'Ressource'
  });
  for (const row of videos.data || []) items.push({
    title: row.title, text: [row.category, row.description].join(' '),
    url: '/empd-tv.html#cms-videos', kind: 'Vidéo'
  });
  return items;
}

function installSearch() {
  const header = document.querySelector('.header-inner');
  if (!header || document.querySelector('#site-search')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'site-search';
  wrapper.id = 'site-search';
  wrapper.innerHTML = `
    <form class="site-search-form" role="search">
      <input id="site-search-input" type="search" placeholder="Rechercher sur le site…" aria-label="Rechercher dans tout le site" autocomplete="off">
      <button type="button" class="site-search-toggle" aria-label="Ouvrir la recherche" title="Rechercher">⌕</button>
      <button type="submit" class="site-search-submit" aria-label="Lancer la recherche" title="Lancer la recherche">⌕</button>
    </form>
    <div class="site-search-results" id="site-search-results" role="region" aria-label="Résultats de recherche" hidden></div>`;
  const notification = header.querySelector('.notification-area');
  header.insertBefore(wrapper, notification || header.querySelector('.site-preferences') || null);

  const form = wrapper.querySelector('form');
  const input = wrapper.querySelector('input');
  const results = wrapper.querySelector('.site-search-results');
  const toggle = wrapper.querySelector('.site-search-toggle');
  let indexPromise;
  let searchSequence = 0;

  const close = () => {
    searchSequence++;
    wrapper.classList.remove('is-open');
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  const showResults = async () => {
    const sequence = ++searchSequence;
    const query = normalize(input.value.trim());
    if (query.length < 2) {
      results.hidden = true;
      return;
    }
    results.hidden = false;
    results.innerHTML = '<p class="site-search-status">Recherche dans le site…</p>';
    try {
      indexPromise ||= loadSearchIndex();
      const index = await indexPromise;
      if (sequence !== searchSequence) return;
      const terms = query.split(/\s+/).filter(Boolean);
      const matches = index.map(item => {
        const haystack = normalize([item.title, item.text, item.kind].join(' '));
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { ...item, score };
      }).filter(item => item.score === terms.length)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12);

      results.innerHTML = matches.length
        ? matches.map(item => `<a class="site-search-result" href="${escapeHtml(item.url)}"><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.kind || 'Rubrique')} · ${escapeHtml(item.text.slice(0, 150))}</small></span><span aria-hidden="true">↗</span></a>`).join('')
        : '<p class="site-search-status">Aucun résultat trouvé. Essaie un autre mot-clé.</p>';
    } catch (error) {
      console.error('Recherche EMPD :', error);
      results.innerHTML = '<p class="site-search-status">La recherche est momentanément indisponible.</p>';
    }
  };

  input.addEventListener('input', showResults);
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= 2) showResults();
  });
  toggle.addEventListener('click', () => {
    wrapper.classList.toggle('is-open');
    if (wrapper.classList.contains('is-open')) input.focus();
    else close();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const first = results.querySelector('a');
    if (first) location.href = first.href;
    else showResults();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') close();
  });
  document.addEventListener('click', event => {
    if (!wrapper.contains(event.target)) close();
  });
}

addSloganReferences();
installSearch();