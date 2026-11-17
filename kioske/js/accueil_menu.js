// Accueil : menu ≡ (ouverture, fermeture au clic dehors ou après un choix) et son bouton « Personnaliser flux ».
// Menu ≡ (le seul de la barre : thèmes, mode sobre, flux, installation, réseaux, code de conduite).
// Ouverture au bouton, fermeture au clic dehors, à Échap, ou après un choix. aria-expanded suit l'état.
function fermerMenuNavbar() {
  const menu = document.getElementById('navbar-menu');
  const bouton = document.getElementById('btn-menu');
  if (menu) { menu.classList.remove('open'); menu.style.display = 'none'; }
  if (bouton) bouton.setAttribute('aria-expanded', 'false');
}
const menuNavbar = document.getElementById('navbar-menu');
const btnMenuNavbar = document.getElementById('btn-menu');
if (menuNavbar && btnMenuNavbar) {
  btnMenuNavbar.addEventListener('click', () => {
    const ouvrir = menuNavbar.style.display === 'none';
    menuNavbar.style.display = ouvrir ? 'block' : 'none';
    menuNavbar.classList.toggle('open', ouvrir);
    btnMenuNavbar.setAttribute('aria-expanded', String(ouvrir));
  });
  document.addEventListener('click', (e) => {
    const navbar = document.querySelector('.kioske-navbar');
    if (navbar && !navbar.contains(e.target)) fermerMenuNavbar();
  });
  // Un bouton du menu (mode sobre, flux, installation, réseaux…) le referme ; les thèmes non
  menuNavbar.querySelectorAll('.menu-button').forEach(b => b.addEventListener('click', () => fermerMenuNavbar()));
}

// Bouton « Personnaliser flux » du menu ≡
const btnCustomFluxNavbar = document.getElementById('btn-custom-flux-navbar');
if (btnCustomFluxNavbar) {
  btnCustomFluxNavbar.addEventListener('click', () => {
    createCustomFluxPanel();
    showPopover('custom-flux');
  });
}
