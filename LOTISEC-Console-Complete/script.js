const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const menu = document.querySelector('[data-menu]');
const dialog = document.querySelector('[data-demo-dialog]');
const demoForm = document.querySelector('[data-demo-form]');
const demoSuccess = document.querySelector('[data-demo-success]');

const updateHeader = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 24);
};

const closeMenu = () => {
  menu?.classList.remove('is-open');
  menuButton?.setAttribute('aria-expanded', 'false');
};

menuButton?.addEventListener('click', () => {
  const isOpen = menu?.classList.toggle('is-open');
  menuButton.setAttribute('aria-expanded', String(Boolean(isOpen)));
});

menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));

const openDemo = () => {
  closeMenu();
  demoForm.hidden = false;
  demoSuccess.hidden = true;
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
};

const closeDemo = () => {
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
};

document.querySelectorAll('[data-open-demo]').forEach((button) => button.addEventListener('click', openDemo));
document.querySelectorAll('[data-close-demo]').forEach((button) => button.addEventListener('click', closeDemo));

dialog?.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) closeDemo();
});

demoForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!demoForm.reportValidity()) return;
  demoForm.hidden = true;
  demoSuccess.hidden = false;
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.13 }
);

document.querySelectorAll('.reveal:not(.is-visible)').forEach((element) => observer.observe(element));
document.querySelector('[data-year]').textContent = new Date().getFullYear();
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();
