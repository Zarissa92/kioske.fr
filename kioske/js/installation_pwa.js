// Gestion de l'installation PWA
let installPromptEvent = null;
const btnInstallPWA = document.getElementById('btn-install-pwa');
const btnInstallPWAMenu = document.getElementById('btn-install-pwa-menu');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPromptEvent = e;
});

function creerHandlerInstall() {
  return async () => {
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
  };
}

if (btnInstallPWA) {
  btnInstallPWA.addEventListener('click', creerHandlerInstall());
}

if (btnInstallPWAMenu) {
  btnInstallPWAMenu.addEventListener('click', creerHandlerInstall());
}

window.addEventListener('appinstalled', () => {
  console.log('PWA installée avec succès');
});
