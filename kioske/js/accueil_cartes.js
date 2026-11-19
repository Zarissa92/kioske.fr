// Accueil : création des cartes d'article (creerCarte, carteArticle) et des identifiants de panneau.
// Carte d'un article dans une grille (panneaux, recherche, favoris). Les textes viennent des flux RSS
// et d'autres sites : ils sont posés avec textContent, jamais interprétés comme du HTML.
// « /https://… » : adresse externe abîmée par un ancien index des articles (avant le 2026-11-19), encore présente
// dans des favoris enregistrés. Le « / » en trop la faisait demander au site (404 en série, puis ban) : il est retiré.
function adresseImage(image) {
  return /^\/https?:\/\//.test(image || '') ? image.slice(1) : (image || '');
}

function creerCarte({ adresse, image, source, meta, titre, extrait, favori = false }) {
  image = adresseImage(image);
  const span = (classe, texte) => {
    const s = document.createElement('span');
    s.className = classe;
    if (texte !== undefined) {
      // Texte brut uniquement : jamais innerHTML. Les entités ont déjà été décodées côté Python
      // (texte.strip_html), donc un « &lt;img onerror&gt; » reste du texte affiché, pas une balise.
      s.textContent = texte || '';
    }
    return s;
  };
  const carte = document.createElement('a');
  carte.href = adresse;
  carte.className = favori ? 'carte carte-favori' : 'carte';
  const cadre = span('carte-image');
  cadre.setAttribute('aria-hidden', 'true');
  if (image) {
    const img = document.createElement('img');
    img.src = image;
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    // Image qui ne charge pas : la lettre de repli prend sa place
    img.addEventListener('error', () => cadre.replaceChildren(span('lettre', (source || '').charAt(0).toUpperCase() || '•')), { once: true });
    cadre.appendChild(img);
  } else {
    cadre.appendChild(span('lettre', (source || '').charAt(0).toUpperCase() || '•'));
  }
  const corps = span('carte-corps');
  corps.append(span('meta', meta), span('carte-titre', titre), span('carte-extrait', extrait));
  carte.append(cadre, corps);
  return carte;
}

// Carte d'un article des données de la page ou de l'index (title, summary, date, host, source, image)
function carteArticle(article, adresse) {
  return creerCarte({
    adresse: adresse, image: article.image, source: article.source,
    meta: article.date + ' · ' + article.host, titre: article.title, extrait: article.summary
  });
}

// Identifiant d'un panneau : préfixe (« source- », « cat- ») et nom réduit aux lettres, chiffres et tirets
function idPanneau(prefixe, nom) {
  return prefixe + nom.replace(/[^a-z0-9-]/gi, '_');
}

// Crée un panneau d'articles avec pagination (30 cartes par page). S'il existe déjà, ne fait rien.
//   id       : identifiant du panneau (idPanneau)
//   titre    : titre affiché
//   cle      : clé de la source ou nom de la catégorie
//   articles : les articles, du plus récent au plus ancien
//   ancre    : page => ancre de l'adresse (« source=…&p=2 »)
//   galerie  : true pour afficher, au-dessus des cartes, la galerie des derniers articles en images
