// Installation de l'app (PWA) par le bouton « Installer l'app » du menu ≡ (id btn-install-pwa-menu).
// Le navigateur envoie beforeinstallprompt quand l'app est installable ; on garde l'événement pour le lancer au clic.
let installPromptEvent = null;
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

if (btnInstallPWAMenu) {
  btnInstallPWAMenu.addEventListener('click', creerHandlerInstall());
}

window.addEventListener('appinstalled', () => {
  console.log('PWA installée avec succès');
});
