const root = document.documentElement;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!document.querySelector('.admin-page') && !reduceMotion) {
  const revealSelectors = [
    '.intro-grid > *',
    '.section-heading',
    '.image-card',
    '.publication-card',
    '.teacher-grid > *',
    '.global-inner > *',
    '.location-panel > *',
    '.page-hero .wrap > *',
    '.inner-main > .info-row',
    '.inner-main > .channel-section',
    '.channel-card',
    '.resource-links > a',
    '.inner-aside',
    '.home-publications-link'
  ];

  const revealItems = [...new Set(revealSelectors.flatMap(selector =>
    [...document.querySelectorAll(selector)]
  ))];

  revealItems.forEach((element, index) => {
    element.classList.add('motion-reveal');
    element.style.setProperty('--motion-delay', `${Math.min(index % 6, 5) * 85}ms`);
  });

  const heroItems = document.querySelectorAll(
    '.hero-content > .eyebrow, .hero-content > h1, .hero-content > p, .hero-content > .actions, .hero-content > .hero-proof, .hero-seal, .page-hero .eyebrow, .page-hero h1, .page-hero p'
  );
  heroItems.forEach((element, index) => {
    element.classList.add('motion-hero-enter');
    element.style.setProperty('--hero-delay', `${index * 115}ms`);
  });

  root.classList.add('empd-motion-ready');

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -45px 0px' });

    revealItems.forEach(element => observer.observe(element));
  } else {
    revealItems.forEach(element => element.classList.add('is-visible'));
  }

  const progress = document.createElement('div');
  progress.className = 'page-scroll-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.append(progress);

  let framePending = false;
  const updateProgress = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const amount = scrollable > 0 ? window.scrollY / scrollable : 0;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, amount))})`;
    framePending = false;
  };

  window.addEventListener('scroll', () => {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(updateProgress);
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
}
