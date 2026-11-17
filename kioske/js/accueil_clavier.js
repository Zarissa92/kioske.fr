// Accueil : fermeture des panneaux par le ×, le fond sombre et la touche Échap.
// Panneau des favoris, déjà dans la page : son bouton × et son fond sombre. Les autres panneaux,
// créés par le script, branchent les leurs à la création.
document.querySelector('#favoris .categorie-fermer')?.addEventListener('click', () => closePopover());
document.querySelectorAll('.categorie-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePopover();
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const menu = document.getElementById('navbar-menu');
    if (menu && menu.style.display !== 'none') {
      fermerMenuNavbar();
      document.getElementById('btn-menu')?.focus();
      return;
    }
    if (carteOuverte && !carteOuverte.hidden) {
      fermerCarte();
    } else {
      closePopover();
    }
  }
});
