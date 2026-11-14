// Gestion de l'installation PWA
let installPromptEvent = null;
const btnInstallPWA = document.getElementById('btn-install-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPromptEvent = e;
});

if (btnInstallPWA) {
  btnInstallPWA.addEventListener('click', async () => {
    if (!installPromptEvent) {
      alert('L\'installation PWA n\'est pas disponible sur ce navigateur ou ce contexte.');
      return;
    }
    installPromptEvent.prompt();
    const choix = await installPromptEvent.userChoice;
    if (choix.outcome === 'accepted') {
      console.log('PWA installée');
    }
    installPromptEvent = null;
  });
}

window.addEventListener('appinstalled', () => {
  console.log('PWA installée avec succès');
});
