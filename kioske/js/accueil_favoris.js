// Accueil : panneau « Mes favoris » (affichage, anciens favoris complétés, import, export, effacement).
// Le stockage et le cœur ♡ sont dans favoris.js.
// Favoris : getFavorites(), saveFavorites(), toggleFavorite() et updateHearts() sont dans favoris.js.

// Adresse venue des favoris enregistrés ou d'un fichier importé : gardée seulement si c'est un chemin
// du site ou une adresse http(s), pour qu'un fichier trafiqué ne puisse pas glisser « javascript: ».
function adresseSure(adresse, defaut = '#') {
  const a = String(adresse || '');
  if (/^\/(?![\/\\])/.test(a) || /^https?:\/\//i.test(a)) return a;
  return defaut;
}

function openFavoritesPanel() {
  afficherFavoris(getFavorites());
  showPopover('favoris');
  completerFavoris();
}

function afficherFavoris(favorites) {
  const favGrille = document.getElementById('fav-grille');
  favGrille.replaceChildren();

  if (Object.keys(favorites).length === 0) {
    favGrille.innerHTML = '<p class="grille-vide">Aucun favori pour le moment</p>';
    return;
  }
  Object.entries(favorites).forEach(([favKey, data]) => {
    // Carte faite des données enregistrées, qui peuvent être incomplètes (anciens favoris) ou venir
    // d'un fichier importé : l'adresse n'est suivie que si c'est une page du site ou une adresse web.
    favGrille.appendChild(creerCarte({
      adresse: adresseSure(data.url || data.lien),
      image: adresseSure(data.image, ''),
      source: data.source || 'Article',
      meta: [data.date, data.host].filter(x => x).join(' · ') || 'Sans date',
      titre: data.title || data.titre || 'Sans titre',
      extrait: data.summary || '',
      favori: true
    }));
  });
}

// Anciens favoris : seul le lien du site d'origine était enregistré. L'index des articles
// donne la page du KiosKe correspondante (et l'image, la date, le résumé).
function completerFavoris() {
  const favorites = getFavorites();
  const incomplets = Object.entries(favorites)
    .filter(([cle, data]) => !String(data.url || '').startsWith('/articles/'));
  if (incomplets.length === 0) return;
  fetch('/articles-index.json')
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(articles => {
      const parLien = new Map(articles.map(a => [a.link, a]));
      let change = false;
      incomplets.forEach(([cle, data]) => {
        const a = parLien.get(data.lien) || parLien.get(cle);
        if (!a) return;
        favorites[cle] = Object.assign({}, data, {
          title: a.title, titre: a.title, lien: a.link, url: a.url, image: a.image,
          summary: a.summary, date: a.date, host: a.host, source: a.source
        });
        change = true;
      });
      if (!change) return;
      saveFavorites(favorites);
      const conteneur = document.getElementById('container-favoris');
      if (conteneur && !conteneur.hidden) afficherFavoris(favorites);
    })
    .catch(err => console.error('Favoris non complétés :', err));
}

function exportFavorites() {
  const favorites = getFavorites();
  if (Object.keys(favorites).length === 0) {
    alert('Aucun favori à exporter');
    return;
  }
  const data = JSON.stringify(favorites, null, 2);
  const blob = new Blob([data], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kioske-favoris.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importFavorites() {
  const file = document.getElementById('fav-file-input').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const favorites = getFavorites();
      Object.assign(favorites, data);
      saveFavorites(favorites);
      openFavoritesPanel();
      alert('Favoris importés avec succès !');
    } catch (err) {
      alert('Erreur lors de l\'import : format JSON invalide');
    }
  };
  reader.readAsText(file);
}

function clearFavorites() {
  if (confirm('Êtes-vous sûr de vouloir effacer tous vos favoris ?')) {
    localStorage.removeItem('kioske_favoris');
    updateHearts();
    openFavoritesPanel();
  }
}

// Boutons
document.getElementById('fav-export-btn')?.addEventListener('click', exportFavorites);
document.getElementById('fav-file-input')?.addEventListener('change', importFavorites);
// ♡ de la barre ouvre le panneau des favoris ; « Charger des favoris » ouvre le choix de fichier.
// button.btn-favs : les liens qui ont la même classe (📚 Ressources) ne sont pas des boutons de favoris
document.querySelectorAll('button.btn-favs').forEach(b => b.addEventListener('click', () => openFavoritesPanel()));
document.getElementById('fav-import-btn')?.addEventListener('click', () => document.getElementById('fav-file-input').click());
document.getElementById('fav-clear-btn')?.addEventListener('click', clearFavorites);
