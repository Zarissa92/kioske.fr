// Images des cartes (recherche, favoris) : une adresse « /https://… » (ancien index, favoris enregistrés) est
// réparée avant affichage, pour ne pas être demandée au site (404 en série, puis ban par fail2ban).
const { attendre, charger, suite } = require('./outils');

(async () => {
  const t = suite('Images des cartes : pas de « /https:// »');
  const favori = { url: '/articles/x/', title: 'Un favori', titre: 'Un favori', image: '/https://exemple.org/photo.jpg', source: 'Source' };
  const r = charger('menu/favoris/index.html', '/menu/favoris/', { avant: (w) => w.localStorage.setItem('kioske_favoris', JSON.stringify([favori])) });
  await attendre(300);
  const srcs = [...r.d.querySelectorAll('img')].map(i => i.getAttribute('src') || '');
  t.verif('aucune image « /http… » dans la page', !srcs.some(s => /^\/https?:/.test(s)), srcs.filter(s => /^\/https?:/.test(s)).join(' '));
  t.verif('l\'image du favori est réparée', srcs.includes('https://exemple.org/photo.jpg'), srcs.join(' ').slice(0, 300));
  t.verif('aucune erreur JavaScript', r.erreurs.length === 0, r.erreurs.join(' | '));
  t.fin();
})();
