// Images qui ne chargent pas : le repli se fait par un écouteur, pas par un attribut onerror
// (la politique de sécurité interdira bientôt les scripts en ligne).
// data-repli="image" : la lettre de repli (<span hidden> juste après l'image) prend sa place (rendu_statique.py)
// data-repli="carte" : la carte de galerie affiche le titre de l'article à la place (rendu.py)
// data-repli="retirer" : la carte disparaît (galeries des catégories, rendu.py)

function appliquerRepli(img) {
  const mode = img.getAttribute('data-repli');
  img.removeAttribute('data-repli');
  if (mode === 'image') {
    img.hidden = true;
    if (img.nextElementSibling) img.nextElementSibling.hidden = false;
  } else if (mode === 'carte') {
    const carte = img.closest('.galerie-carte');
    if (!carte) return;
    const texte = document.createElement('span');
    texte.className = 'galerie-carte-texte';
    texte.textContent = carte.getAttribute('title') || '';
    img.replaceWith(texte);
    carte.classList.add('galerie-carte-sans-image');
  } else if (mode === 'retirer') {
    const cible = img.closest('.galerie-carte-wrapper') || img.closest('.galerie-carte');
    if (cible) cible.remove();
  }
}

// La phase de capture reçoit les erreurs de toutes les images (l'événement « error » ne remonte pas).
document.addEventListener('error', (e) => {
  if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-repli')) appliquerRepli(e.target);
}, true);

// Images déjà en échec avant ce script (le script est en fin de page) : rattrapées ici.
// complete + naturalWidth 0 vaut aussi pour un SVG chargé sans dimensions : decode() tranche
// (refusé = image cassée). Sans decode(), on garde l'ancien test.
document.querySelectorAll('img[data-repli]').forEach(img => {
  if (!img.complete || img.naturalWidth !== 0) return;
  if (typeof img.decode === 'function') {
    img.decode().catch(() => { if (img.hasAttribute('data-repli')) appliquerRepli(img); });
  } else {
    appliquerRepli(img);
  }
});
