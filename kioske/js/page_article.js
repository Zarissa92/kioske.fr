// Bouton retour : revient TOUJOURS à la catégorie parente
// Navigation Précédent/Suivant : préserve le param 'from'
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  let fromParam = params.get('from');
  // Retour vers une adresse du site seulement (ni autre site, ni javascript:)
  const debutFrom = fromParam ? fromParam.charCodeAt(1) : 0;  // 47 = « / », 92 = barre oblique inversée
  if (fromParam && (!fromParam.startsWith('/') || debutFrom === 47 || debutFrom === 92)) fromParam = null;

  // Bouton retour
  const btnRetour = document.getElementById('btn-retour');
  if (btnRetour) {
    const returnUrl = fromParam || '/';
    btnRetour.addEventListener('click', () => {
      window.location.href = returnUrl;
    });
    if (fromParam && fromParam.includes('/categories/')) {
      btnRetour.textContent = '← Retour à la catégorie';
    }
  }

  // Boutons Précédent/Suivant : ajouter le param 'from' aux liens
  if (fromParam) {
    document.querySelectorAll('.nav-prev, .nav-next').forEach(btn => {
      const href = btn.getAttribute('href');
      if (href && !href.includes('from=')) {
        btn.setAttribute('href', href.split('?')[0] + '?from=' + encodeURIComponent(fromParam));
      }
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
