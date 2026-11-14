// Outils communs aux tests : charger une page de build/ dans jsdom, cliquer, vérifier.
// Les tests lisent le site construit dans build/ (bin/build_site.py --simple) ; rien n'est demandé au réseau.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const BUILD = path.join(__dirname, '..', 'build');
const SITE = 'https://kioske.test';

const attendre = (ms = 60) => new Promise(r => setTimeout(r, ms));

// Charge build/<fichier> comme s'il était servi à l'adresse <chemin> du site.
//   options.html  : fonction qui retouche le HTML avant le chargement
//   options.index : fonction qui retouche la liste de /articles-index.json (recherche)
//   options.avant : fonction appelée avec la fenêtre avant l'exécution des scripts de la page
function charger(fichier, chemin, options = {}) {
  let html = fs.readFileSync(path.join(BUILD, fichier), 'utf8');
  // /theme.js est un fichier à part : le mettre dans la page, jsdom ne le chargerait pas
  html = html.replace(/<script src="\/(theme)\.js"[^>]*><\/script>/g,
    (m, nom) => '<script>' + fs.readFileSync(path.join(BUILD, nom + '.js'), 'utf8') + '</script>');
  if (options.html) html = options.html(html);
  const erreurs = [];
  const dom = new JSDOM(html, {
    url: SITE + chemin, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      // fetch : lit les fichiers de build/
      w.fetch = (adresse) => {
        const p = new URL(adresse, SITE + chemin).pathname;
        let f = path.join(BUILD, decodeURIComponent(p));
        if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
        if (!fs.existsSync(f)) return Promise.resolve({ ok: false, status: 404, text: async () => '' });
        const texte = fs.readFileSync(f, 'utf8');
        return Promise.resolve({
          ok: true, status: 200, text: async () => texte,
          json: async () => {
            const donnees = JSON.parse(texte);
            return (p === '/articles-index.json' && options.index) ? options.index(donnees) : donnees;
          }
        });
      };
      w.matchMedia = w.matchMedia || (() => ({ matches: false, addEventListener() {}, addListener() {} }));
      w.scrollTo = () => {};
      w.alert = (texte) => { w.alertes = (w.alertes || []).concat(String(texte)); };
      w.Element.prototype.scrollBy = function (o) { this.scrollLeft += o.left; };
      w.addEventListener('error', e => erreurs.push(e.message));
      if (options.avant) options.avant(w);
    },
  });
  return { w: dom.window, d: dom.window.document, erreurs };
}

const clic = (w, el) => el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
const touche = (w, nom) => w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: nom, bubbles: true }));

// Panneau actuellement affiché sur l'accueil (ou null)
const panneauOuvert = (d) => [...d.querySelectorAll('.categorie-container')].find(c => !c.hidden) || null;

// Nombre de favoris enregistrés
const nbFavoris = (w) => Object.keys(JSON.parse(w.localStorage.getItem('kioske_favoris') || '{}')).length;

// Deux entrées d'historique : « avant » (hors du KiosKe) puis « accueil ». Retomber sur « avant »,
// c'est être remonté trop loin.
function poserHistorique(w) {
  w.history.replaceState({ avant: true }, '', '/');
  w.history.pushState({ accueil: true }, '', '/');
}
const surAccueil = (w) => Boolean(w.history.state && w.history.state.accueil);

// Un article et une catégorie pris dans build/
function premierArticle() {
  const dossier = path.join(BUILD, 'articles');
  return fs.readdirSync(dossier).find(n => fs.existsSync(path.join(dossier, n, 'index.html')));
}
function premiereCategorie() {
  return fs.readdirSync(path.join(BUILD, 'categories'))[0];
}

// Petit cadre de test : chaque vérification affiche OK ou ÉCHEC ; le fichier sort en erreur au moindre échec.
function suite(nom) {
  let echecs = 0;
  console.log('\n== ' + nom);
  return {
    verif(libelle, condition, detail = '') {
      console.log((condition ? '  OK    ' : '  ÉCHEC ') + libelle + (detail ? '  ' + detail : ''));
      if (!condition) echecs++;
    },
    fin() {
      if (echecs) console.log('  ' + echecs + ' échec(s)');
      process.exitCode = echecs ? 1 : (process.exitCode || 0);
    }
  };
}

module.exports = { BUILD, attendre, charger, clic, touche, panneauOuvert, nbFavoris, poserHistorique, surAccueil,
  premierArticle, premiereCategorie, suite };
