// Actualisation automatique : nouvelle version détectée (Last-Modified) -> rechargement si rien n'est ouvert,
// sinon bannière. La requête HEAD et le rechargement sont simulés.
const { attendre, charger, clic, suite } = require('./outils');

(async () => {
  const t = suite('Actualisation automatique de l\'accueil');
  let versionServeur = 'Mon, 16 Nov 2026 05:00:00 GMT';
  let rechargements = 0;
  const heads = [];

  const { w, d, erreurs } = charger('index.html', '/', {
    avant: (f) => {
      const ancien = f.fetch;
      f.fetch = (adresse, options) => {
        if (options && options.method === 'HEAD') {
          heads.push(adresse);
          return Promise.resolve({ ok: true, headers: { get: (nom) => (nom === 'Last-Modified' ? versionServeur : null) } });
        }
        return ancien(adresse, options);
      };
    },
  });
  // Le rechargement réel ne peut pas être simulé dans jsdom : on le remplace par un compteur.
  w.rechargerPage = () => { rechargements++; };
  await attendre(200);

  t.verif('première vérification : version de référence, sans recharger', rechargements === 0 && heads.length >= 1 && heads[0] === '/index.html');

  // Nouvelle version, rien d'ouvert : rechargement
  versionServeur = 'Mon, 16 Nov 2026 05:30:00 GMT';
  await w.verifierNouvelleVersion();
  t.verif('nouvelle version, rien d\'ouvert : rechargement', rechargements === 1);

  // Nouvelle version, un panneau ouvert : bannière, pas de rechargement
  const titre = d.querySelector('.titre-panneau[data-category-name]');
  clic(w, titre); await attendre(50);
  versionServeur = 'Mon, 16 Nov 2026 06:00:00 GMT';
  await w.verifierNouvelleVersion();
  t.verif('panneau ouvert : pas de rechargement', rechargements === 1);
  t.verif('panneau ouvert : bannière affichée', !!d.getElementById('bandeau-nouveautes'));

  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();
  t.fin();
})();
