document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && carteOuverte && !carteOuverte.hidden) fermerCarte();
});

// Bouton retour de catégorie : revient à l'accueil
document.addEventListener('DOMContentLoaded', () => {
  const btnRetour = document.getElementById('btn-retour');

  if (btnRetour) {
    btnRetour.addEventListener('click', () => {
      // Aller à l'accueil
      window.location.href = '/';
    });
  }
});

