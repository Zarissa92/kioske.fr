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
  // Les étiquettes des cartes d'article suivent (etiquettes.js)
  document.dispatchEvent(new Event('kioske-favoris'));
}

// Animation du ♡ à l'ajout : il pulse et des étoiles jaillissent autour de lui. Désactivée par « réduire les
// animations » du système et par le mode sobre. Rien n'est écrit dans la page : des éléments temporaires,
// retirés à la fin de l'animation.
const ETOILES = 6;
function animerAjout(heart) {
  if (document.documentElement.dataset.sobre === 'oui') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  heart.classList.remove('coeur-anime');
  void heart.offsetWidth;   // relance l'animation si elle était déjà jouée
  heart.classList.add('coeur-anime');
  const r = heart.getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const groupe = document.createElement('span');
  groupe.className = 'etoiles';
  groupe.style.left = x + 'px';
  groupe.style.top = y + 'px';
  for (let i = 0; i < ETOILES; i++) {
    const angle = (i / ETOILES) * Math.PI * 2 + Math.random() * 0.4;
    const distance = r.width * (1.1 + Math.random() * 0.6);
    const etoile = document.createElement('span');
    etoile.className = 'etoile';
    etoile.style.setProperty('--dx', (Math.cos(angle) * distance).toFixed(1) + 'px');
    etoile.style.setProperty('--dy', (Math.sin(angle) * distance).toFixed(1) + 'px');
    etoile.style.animationDelay = (i * 25) + 'ms';
    groupe.appendChild(etoile);
  }
  document.body.appendChild(groupe);
  setTimeout(() => { groupe.remove(); heart.classList.remove('coeur-anime'); }, 900);
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
    animerAjout(heart);
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
    // Récupère l'extrait (summary) : depuis la carte d'accueil OU depuis l'attribut data-summary de la page d'article
    let summary = carte?.querySelector('.carte-extrait')?.textContent || '';
    if (!summary && location.pathname.startsWith('/articles/')) {
      // Sur la page d'article, utilise l'attribut data-summary du flux RSS
      summary = document.querySelector('main.panel-article')?.getAttribute('data-summary') || '';
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
      summary: summary,
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

