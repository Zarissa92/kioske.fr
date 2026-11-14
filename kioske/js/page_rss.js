// Gestion de l'installation PWA (rss.html n'a pas de popover, on laisse juste le message du navigateur)
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  console.log("L'app est installable");
});
