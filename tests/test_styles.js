// Non-régression des styles : pour chaque thème et deux pages (accueil, un article), le style calculé de
// chaque élément (propriétés hors variables --…) est résumé par une empreinte. Les empreintes de référence
// sont dans tests/reference/styles.json. Un écart = un élément dont le style a changé.
//   node tests/test_styles.js                 : compare à la référence
//   node tests/test_styles.js --mettre-a-jour : écrit la nouvelle référence (après une modification voulue)
// Limite : jsdom ne calcule pas les états (:hover, :focus) ni les requêtes de largeur d'écran.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const RACINE = path.join(__dirname, '..');
const BUILD = path.join(RACINE, 'build');
const REFERENCE = path.join(__dirname, 'reference', 'styles.json');

// Pages testées : l'accueil et la première page d'article construite
const dossierArticles = path.join(BUILD, 'articles');
const article = fs.readdirSync(dossierArticles).sort()[0];
const PAGES = {
  'index.html': path.join(BUILD, 'index.html'),
  'article': path.join(dossierArticles, article, 'index.html'),
};

// Thèmes : le défaut est dans la page ; chaque autre est une surcouche chargée après (comme theme.js)
const themes = ['default', ...fs.readdirSync(BUILD)
  .filter(f => /^style_.+\.css$/.test(f) && f !== 'style_sobre.css')
  .map(f => f.replace(/^style_|\.css$/g, ''))
  .filter(t => t !== 'default' && t !== 'favoris' && t !== 'menu')];

function html(page, theme) {
  let texte = fs.readFileSync(PAGES[page], 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
  if (theme !== 'default') {
    const surcouche = fs.readFileSync(path.join(BUILD, `style_${theme}.css`), 'utf8');
    texte = texte.replace('</head>', `<style>${surcouche}</style></head>`);
  }
  return texte;
}

// Empreinte du style calculé de chaque élément, dans l'ordre du document
function empreintes(page, theme) {
  const dom = new JSDOM(html(page, theme), { pretendToBeVisual: true });
  const w = dom.window;
  const sortie = [];
  for (const el of w.document.querySelectorAll('*')) {
    const cs = w.getComputedStyle(el);
    const props = [];
    for (let i = 0; i < cs.length; i++) {
      const nom = cs[i];
      if (nom.startsWith('--')) continue;
      props.push(nom + ':' + cs.getPropertyValue(nom).replace(/\s+/g, ' ').trim());
    }
    props.sort();
    const descr = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    sortie.push({ descr, empreinte: crypto.createHash('sha1').update(props.join(';')).digest('hex').slice(0, 16) });
  }
  return sortie;
}

const mettreAJour = process.argv.includes('--mettre-a-jour');
const actuel = {};
for (const page of Object.keys(PAGES)) {
  for (const theme of themes) {
    actuel[`${page}|${theme}`] = empreintes(page, theme);
  }
}

if (mettreAJour || !fs.existsSync(REFERENCE)) {
  fs.mkdirSync(path.dirname(REFERENCE), { recursive: true });
  const propre = {};
  for (const [cle, liste] of Object.entries(actuel)) propre[cle] = liste.map(x => x.empreinte);
  fs.writeFileSync(REFERENCE, JSON.stringify(propre, null, 1) + '\n');
  console.log(`  référence écrite : ${REFERENCE} (${Object.keys(propre).length} combinaisons)`);
  process.exit(0);
}

const reference = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));
let ecarts = 0;
for (const [cle, liste] of Object.entries(actuel)) {
  const ref = reference[cle];
  if (!ref) { console.log(`  ÉCART ${cle} : absent de la référence`); ecarts++; continue; }
  if (ref.length !== liste.length) {
    console.log(`  ÉCART ${cle} : ${ref.length} éléments en référence, ${liste.length} maintenant`);
    ecarts++;
    continue;
  }
  const diff = liste.map((x, i) => (x.empreinte !== ref[i] ? x.descr : null)).filter(Boolean);
  if (diff.length) {
    ecarts++;
    console.log(`  ÉCART ${cle} : ${diff.length} élément(s) changé(s), ex. ${diff.slice(0, 4).join(', ')}`);
  }
}
if (ecarts === 0) console.log(`  OK    ${Object.keys(actuel).length} combinaisons (pages × thèmes) identiques à la référence`);
process.exit(ecarts ? 1 : 0);
