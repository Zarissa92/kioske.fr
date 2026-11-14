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

// Barre de recherche globale : redirige vers l'accueil
document.getElementById('form-recherche').addEventListener('submit', (e) => {
  e.preventDefault();
  const query = document.getElementById('recherche-input').value.trim();
  if (query) {
    window.location.href = '/?q=' + encodeURIComponent(query);
  }
});
