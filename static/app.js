// Gestion des favoris (localStorage) - utilisé sur toutes les pages
function getFavorites() {
  try {
    const fav = localStorage.getItem('kioske_favoris');
    return fav ? JSON.parse(fav) : {};
  } catch {
    return {};
  }
}

function saveFavorites(fav) {
  try {
    localStorage.setItem('kioske_favoris', JSON.stringify(fav));
    updateHearts();
  } catch {
    console.error('Impossible de sauvegarder les favoris');
  }
}

function toggleFavorite(event) {
  event.stopPropagation();
  const heart = event.target;
  const articleLink = heart.getAttribute('data-article-link');
  if (!articleLink) return;

  const favorites = getFavorites();
  if (favorites[articleLink]) {
    delete favorites[articleLink];
    heart.classList.remove('active');
  } else {
    const carte = document.querySelector(`[data-article-link="${articleLink}"]`)?.closest('[data-article-id], article, .carte-lien') || document.body;
    const titre = carte.querySelector('h1')?.textContent || carte.querySelector('h2')?.textContent || carte.querySelector('.carte-titre')?.textContent || 'Sans titre';
    const meta = (carte.querySelector('.meta')?.textContent || '').split(' · ');
    favorites[articleLink] = {
      titre: titre,
      title: titre,
      lien: articleLink,
      url: location.pathname.startsWith('/articles/') ? location.pathname : articleLink,
      image: carte.querySelector('.article-image img')?.src || '',
      date: meta.length > 2 ? meta[0] : '',
      host: meta.length > 2 ? meta[1] : (meta[0] || ''),
      source: meta[meta.length - 1] || '',
      timestamp: new Date().toISOString()
    };
    heart.classList.add('active');
  }
  saveFavorites(favorites);
}

function updateHearts() {
  const favorites = getFavorites();
  document.querySelectorAll('.fav-heart').forEach(heart => {
    const articleLink = heart.getAttribute('data-article-link');
    if (articleLink && favorites[articleLink]) {
      heart.classList.add('active');
    } else {
      heart.classList.remove('active');
    }
  });
}

// Initialiser les cœurs au chargement
document.addEventListener('DOMContentLoaded', updateHearts);

// Gestion du zoom global (localStorage)
function initializeZoom() {
  const tailleSlider = document.getElementById('taille-site');
  const tailleValeur = document.querySelector('.taille-valeur');
  if (tailleSlider) {
    const tailleSauvegardee = localStorage.getItem('kioske-taille') || tailleSlider.value;
    tailleSlider.value = tailleSauvegardee;
    document.documentElement.style.zoom = (tailleSauvegardee / 100);
    if (tailleValeur) tailleValeur.textContent = tailleSauvegardee + '%';

    tailleSlider.addEventListener('input', (e) => {
      const valeur = e.target.value;
      document.documentElement.style.zoom = (valeur / 100);
      if (tailleValeur) tailleValeur.textContent = valeur + '%';
      localStorage.setItem('kioske-taille', valeur);
    });
  }
}

document.addEventListener('DOMContentLoaded', initializeZoom);

// Gestion du menu "+"
function initializeMenuInfo() {
  const btnInfos = document.querySelector('.btn-infos');
  const closeButtons = document.querySelectorAll('[data-close-infos]');

  if (btnInfos) {
    btnInfos.addEventListener('click', (e) => {
      const container = document.getElementById('bloc-infos-container');
      if (container) {
        container.hidden = !container.hidden;
      }
    });
  }

  closeButtons.forEach(elem => {
    elem.addEventListener('click', (e) => {
      const container = document.getElementById('bloc-infos-container');
      if (container) {
        container.hidden = true;
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initializeMenuInfo);

// Gestion de l'installation PWA
function initializePWA() {
  let installPromptEvent = null;
  const btnInstallPWA = document.getElementById('btn-install-pwa');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPromptEvent = e;
  });

  if (btnInstallPWA) {
    btnInstallPWA.addEventListener('click', async () => {
      if (!installPromptEvent) {
        alert('L\'installation PWA n\'est pas disponible sur ce navigateur ou ce contexte.');
        return;
      }
      installPromptEvent.prompt();
      const choix = await installPromptEvent.userChoice;
      if (choix.outcome === 'accepted') {
        console.log('PWA installée');
      }
      installPromptEvent = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    console.log('PWA installée avec succès');
  });
}

document.addEventListener('DOMContentLoaded', initializePWA);

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
