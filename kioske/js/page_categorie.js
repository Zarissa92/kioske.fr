// Page de catégorie seulement (les scripts de page sont dans un bundle commun, voir javascript.py)
document.addEventListener('keydown', (e) => {
  if (document.body.dataset.page !== 'categorie') return;
  if (e.key === 'Escape' && carteOuverte && !carteOuverte.hidden) fermerCarte();
});

// Bouton retour de catégorie : revient à l'accueil
document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'categorie') return;
  const btnRetour = document.getElementById('btn-retour');

  if (btnRetour) {
    btnRetour.addEventListener('click', () => {
      // Aller à l'accueil
      window.location.href = '/';
    });
  }
});

