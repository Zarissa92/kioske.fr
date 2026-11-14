// Favoris : enregistrés dans le navigateur (localStorage), sans serveur. Commun à l'accueil, aux pages
// d'article et aux pages de catégorie.
function getFavorites() {
  try {
    const fav = localStorage.getItem('kioske_favoris');
    return fav ? JSON.parse(fav) : {};
  } catch (e) {
    return {};
  }
}

function saveFavorites(fav) {
  try {
    localStorage.setItem('kioske_favoris', JSON.stringify(fav));
  } catch (e) {
    console.error('Impossible de sauvegarder les favoris');
  }
  updateHearts();
}

// Clic sur le ♡ d'un article : l'ajoute aux favoris ou l'en retire. Les données de la carte (titre,
// image, date, site, source) sont lues dans l'article affiché.
function toggleFavorite(event) {
  const heart = event.target.closest('.fav-heart');
  const articleLink = heart ? heart.getAttribute('data-article-link') : null;
  if (!articleLink) return;

  const favorites = getFavorites();
  if (favorites[articleLink]) {
    delete favorites[articleLink];
  } else {
    const carte = heart.closest('.panel-article');
    const titre = carte?.querySelector('h1')?.textContent || 'Sans titre';
    const meta = (carte?.querySelector('.meta')?.textContent || '').split(' · ');
    // Image : adresse complète lue par le navigateur, ramenée à un chemin du site quand c'en est une
    const img = carte?.querySelector('.article-image img');
    let image = '';
    if (img && img.src) {
      const a = new URL(img.src, location.href);
      image = a.origin === location.origin ? a.pathname + a.search : a.href;
    }
    favorites[articleLink] = {
      titre: titre,
      title: titre,
      lien: articleLink,
      url: location.pathname.startsWith('/articles/') ? location.pathname : articleLink,
      image: image,
      date: meta.length > 2 ? meta[0] : '',
      host: meta.length > 2 ? meta[1] : (meta[0] || ''),
      source: meta[meta.length - 1] || '',
      timestamp: new Date().toISOString()
    };
  }
  saveFavorites(favorites);
}

// Colore les ♡ des articles en favori
function updateHearts() {
  const favorites = getFavorites();
  document.querySelectorAll('.fav-heart').forEach(heart => {
    const articleLink = heart.getAttribute('data-article-link');
    heart.classList.toggle('active', Boolean(articleLink && favorites[articleLink]));
  });
}

// Un seul écouteur sur le document : le ♡ d'une carte ouverte après coup est pris en compte
document.addEventListener('click', (e) => {
  if (e.target.closest('.fav-heart')) toggleFavorite(e);
});
updateHearts();

