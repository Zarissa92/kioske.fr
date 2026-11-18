// Gestion de l'installation PWA (rss.html n'a pas de popover, on laisse juste le message du navigateur)
window.addEventListener('beforeinstallprompt', (e) => {
  if (document.body.dataset.page !== 'rss') return;   // page RSS seulement : ailleurs, l'invite du navigateur reste normale
  e.preventDefault();
  console.log("L'app est installable");
});
