// Menu ≡ unique : ouverture, fermeture au clic dehors, à Échap (focus rendu au bouton), après un choix.
const { attendre, charger, clic, touche, suite } = require('./outils');

(async () => {
  const t = suite('Menu ≡ unique');
  const { w, d, erreurs } = charger('index.html', '/');
  await attendre(200);

  const bouton = d.getElementById('btn-menu');
  const menu = d.getElementById('navbar-menu');
  const ouvert = () => menu.style.display !== 'none';

  t.verif('ancien bouton ⚙️ supprimé', d.getElementById('btn-settings') === null && d.getElementById('navbar-settings') === null);
  t.verif('bouton « Menu » avec libellé visible', bouton.textContent.includes('Menu'));
  t.verif('menu fermé au départ', !ouvert() && bouton.getAttribute('aria-expanded') === 'false');

  clic(w, bouton);
  t.verif('clic : menu ouvert', ouvert() && bouton.getAttribute('aria-expanded') === 'true');
  t.verif('contient thèmes, mode sobre, flux, réseaux et code de conduite',
    Boolean(d.getElementById('submenu-themes') && d.getElementById('btn-sobre') &&
      d.getElementById('btn-custom-flux-navbar') && d.getElementById('btn-open-conduite')));

  touche(w, 'Escape');
  t.verif('Échap : menu fermé', !ouvert() && bouton.getAttribute('aria-expanded') === 'false');
  t.verif('Échap : focus rendu au bouton', d.activeElement === bouton);

  clic(w, bouton);
  clic(w, d.body);
  t.verif('clic dehors : menu fermé', !ouvert());

  clic(w, bouton);
  clic(w, d.getElementById('btn-sobre'));
  t.verif('choix dans le menu (mode sobre) : menu refermé', !ouvert());
  t.verif('mode sobre activé par le choix', d.documentElement.dataset.sobre === 'oui');

  t.verif('aucune erreur JavaScript', erreurs.length === 0, erreurs.join(' | '));
  w.close();
  t.fin();
})();
