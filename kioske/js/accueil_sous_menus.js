// Accueil : sous-menus du menu ≡ (un seul ouvert à la fois).
// Gestionnaire pour les sous-menus déroulants : fermer les autres quand on en ouvre un
document.querySelectorAll('.submenu-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const submenuId = btn.getAttribute('data-submenu');
    const submenu = document.getElementById(`submenu-${submenuId}`);
    const isOpen = submenu.style.display !== 'none';

    // Fermer tous les autres sous-menus
    document.querySelectorAll('.submenu-toggle').forEach(otherBtn => {
      if (otherBtn !== btn) {
        const otherSubmenuId = otherBtn.getAttribute('data-submenu');
        const otherSubmenu = document.getElementById(`submenu-${otherSubmenuId}`);
        otherSubmenu.style.display = 'none';
        otherBtn.setAttribute('aria-expanded', 'false');
      }
    });

    // Basculer le sous-menu courant
    submenu.style.display = isOpen ? 'none' : 'flex';
    btn.setAttribute('aria-expanded', String(!isOpen));
  });
});
