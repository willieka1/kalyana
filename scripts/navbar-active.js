(() => {
  const nav = document.querySelector('#mainNav');
  if (!nav) return;

  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const items = links.map(link => ({
    link,
    section: document.querySelector(link.hash)
  })).filter(item => item.section).sort((a, b) => a.section.offsetTop - b.section.offsetTop);

  let clickLock = false;
  let unlockTimer;

  const activate = selected => {
    links.forEach(link => {
      const active = link === selected;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  };

  const detectSection = () => {
    if (clickLock) return;
    if (window.scrollY <= 40) {
      activate(links.find(link => link.hash === '#beranda'));
      return;
    }

    const headerHeight = document.querySelector('#siteHeader')?.offsetHeight || 72;
    const probe = headerHeight + 34;
    let current = items[0];

    items.forEach(item => {
      if (item.section.getBoundingClientRect().top <= probe) current = item;
    });
    activate(current.link);
  };

  links.forEach(link => link.addEventListener('click', () => {
    clickLock = true;
    activate(link);
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      clickLock = false;
      detectSection();
    }, 850);
  }));

  let frame;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(detectSection);
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', detectSection);
  window.addEventListener('pageshow', detectSection);
  detectSection();
})();
