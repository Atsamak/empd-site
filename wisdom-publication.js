const TITLE = 'L’origine de la Sagesse divine';
const MARKER = '\n\nJOB 12:13\n';

function decorateWisdomPublication(card) {
  if (!card || card.dataset.wisdomEnhanced === 'true') return;
  const heading = card.querySelector('h3');
  if (!heading || heading.textContent.trim() !== TITLE) return;

  card.dataset.wisdomEnhanced = 'true';

  if (card.classList.contains('home-latest-card')) {
    card.classList.add('wisdom-latest-card');
    return;
  }

  card.classList.add('wisdom-publication-card');
  const body = card.querySelector('.publication-content > p');
  if (!body) return;

  const raw = body.textContent.trim();
  const splitAt = raw.indexOf(MARKER);
  const introduction = splitAt >= 0 ? raw.slice(0, splitAt).trim() : raw;
  const remaining = splitAt >= 0 ? raw.slice(splitAt + MARKER.length).trim() : '';
  const verseEnd = remaining.indexOf('\n\n');
  const verse = (verseEnd >= 0 ? remaining.slice(0, verseEnd) : remaining).trim();
  const conclusion = verseEnd >= 0 ? remaining.slice(verseEnd + 2).trim() : '';

  const message = document.createElement('div');
  message.className = 'wisdom-publication-message';

  const intro = document.createElement('p');
  intro.className = 'wisdom-publication-intro';
  intro.textContent = introduction;
  message.append(intro);

  if (verse) {
    const scripture = document.createElement('blockquote');
    scripture.className = 'wisdom-publication-verse';
    const reference = document.createElement('span');
    reference.className = 'wisdom-publication-reference';
    reference.textContent = 'JOB 12:13';
    const quote = document.createElement('p');
    quote.textContent = verse;
    scripture.append(reference, quote);
    message.append(scripture);
  }

  if (conclusion) {
    const closing = document.createElement('p');
    closing.className = 'wisdom-publication-conclusion';
    closing.textContent = conclusion;
    message.append(closing);
  }

  const signature = document.createElement('span');
  signature.className = 'wisdom-publication-signature';
  signature.textContent = '✦  La sagesse véritable vient de Dieu  ✦';
  message.append(signature);

  body.replaceWith(message);
}

function scanWisdomPublications(root = document) {
  root.querySelectorAll?.('.publication-card, .home-latest-card').forEach(decorateWisdomPublication);
}

scanWisdomPublications();
const observer = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        decorateWisdomPublication(node);
        scanWisdomPublications(node);
      }
    }
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });
