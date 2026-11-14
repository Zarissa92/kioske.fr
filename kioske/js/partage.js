// Bouton 📤 d'un article (page d'article, ou carte ouverte par-dessus l'accueil ou une catégorie) :
// partage l'adresse de la page de l'article, sans le paramètre « from ». Sans partage système,
// l'adresse est copiée dans le presse-papiers.
function shareArticle(e) {
  const btn = e.target.closest('.share-btn');
  if (!btn) return;
  const titre = btn.closest('.panel-article')?.querySelector('h1')?.textContent || document.title;
  const adresse = location.origin + location.pathname;
  if (navigator.share) {
    navigator.share({ title: titre, url: adresse }).catch(() => {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(adresse).then(() => {
      const texte = btn.textContent;
      btn.textContent = '✓';
      btn.classList.add('est-copie');
      setTimeout(() => {
        btn.textContent = texte;
        btn.classList.remove('est-copie');
      }, 2000);
    }).catch(() => alert('Partage indisponible sur ce navigateur'));
  } else {
    alert('Partage indisponible sur ce navigateur');
  }
}

document.addEventListener('click', (e) => {
  if (e.target.closest('.share-btn')) shareArticle(e);
});

