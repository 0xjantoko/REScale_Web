/* ==========================================================================
   REScale Web — Main Page Interactivity
   Smooth scroll, nav active states, animations
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Intersection Observer for animation triggers
  const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-in').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });

  // Nav active state on scroll
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav__link');
  
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => link.classList.remove('nav__link--active'));
        const activeLink = document.querySelector(`.nav__link[href="#${entry.target.id}"]`);
        if (activeLink) activeLink.classList.add('nav__link--active');
      }
    });
  }, { threshold: 0.3, rootMargin: '-64px 0px 0px 0px' });

  sections.forEach(section => navObserver.observe(section));

  // Terminal typing effect for hero
  const terminalBody = document.querySelector('.terminal__body');
  if (terminalBody) {
    const lines = terminalBody.querySelectorAll('div');
    lines.forEach((line, i) => {
      line.style.opacity = '0';
      line.style.transform = 'translateX(-8px)';
      line.style.transition = `opacity 0.3s ease ${i * 0.1}s, transform 0.3s ease ${i * 0.1}s`;
      setTimeout(() => {
        line.style.opacity = '1';
        line.style.transform = 'translateX(0)';
      }, 300 + i * 150);
    });
  }

  console.log('%cREScale Web', 'font-weight:bold; color:#4a9eff; font-size:14px;');
  console.log('%cZero-dependency audio DSP engine in pure Rust', 'color:#6b7a8c; font-size:12px;');
});

// Scroll to top button
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const currentScroll = window.pageYOffset;
  const header = document.querySelector('.site-header');
  if (currentScroll > 200 && currentScroll > lastScroll) {
    header.style.transform = 'translateY(-100%)';
  } else {
    header.style.transform = 'translateY(0)';
  }
  lastScroll = currentScroll;
}, { passive: true });
