(() => {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebarToggle');
  const STORAGE_KEY = 'sb-sidebar-toggled';

  /* ===== Recolher / expandir a barra lateral ===== */
  const closeSubmenus = () => {
    document.querySelectorAll('[data-submenu]').forEach(link => {
      link.setAttribute('aria-expanded', 'false');
      document.getElementById(link.dataset.submenu).classList.remove('open');
    });
  };

  const setCollapsed = collapsed => {
    sidebar.classList.toggle('toggled', collapsed);
    toggleBtn.setAttribute('aria-expanded', String(!collapsed));
    if (collapsed) closeSubmenus();
    try { localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0'); } catch (e) {}
  };

  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
  } catch (e) {}

  toggleBtn.addEventListener('click', () => {
    setCollapsed(!sidebar.classList.contains('toggled'));
  });

  /* ===== Submenus (Components, Utilities, Pages) ===== */
  document.querySelectorAll('[data-submenu]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const menu = document.getElementById(link.dataset.submenu);
      const willOpen = !menu.classList.contains('open');
      closeSubmenus(); // abre um por vez
      if (willOpen) {
        menu.classList.add('open');
        link.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ===== Dropdowns do cabeçalho (alertas, mensagens, usuário) ===== */
  const triggers = document.querySelectorAll('[data-dropdown]');

  const closeDropdowns = except => {
    triggers.forEach(trigger => {
      if (trigger === except) return;
      trigger.setAttribute('aria-expanded', 'false');
      document.getElementById(trigger.dataset.dropdown).hidden = true;
    });
  };

  triggers.forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      const menu = document.getElementById(trigger.dataset.dropdown);
      closeDropdowns(trigger);
      menu.hidden = !menu.hidden;
      trigger.setAttribute('aria-expanded', String(!menu.hidden));
    });
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.dropdown')) closeDropdowns();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = [...triggers].find(t => t.getAttribute('aria-expanded') === 'true');
    closeDropdowns();
    if (open) open.focus();
  });

  /* ===== Busca ===== */
  document.querySelector('.search').addEventListener('submit', event => {
    event.preventDefault();
    const term = event.target.querySelector('input').value.trim();
    if (term) console.log('Buscar por:', term); // troque pela sua lógica de busca
  });
})();
