// Installation de l'app (PWA) par le bouton « Installer l'app » du menu ≡ (id btn-install-pwa-menu).
// Le navigateur envoie beforeinstallprompt quand l'app est installable ; on garde l'événement pour le lancer au clic.
let installPromptEvent = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPromptEvent = e;
});

// Message quand le navigateur ne propose pas d'installer le site : il dépend du navigateur.
// Firefox ne sait pas installer un site comme application ; Safari sur iPhone passe par « Partager ».
function messageSansInstallation() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) {
    return 'Sur iPhone : touche le bouton Partager (carré avec une flèche), puis « Sur l\'écran d\'accueil ».';
  }
  if (/Firefox/.test(ua)) {
    return 'Firefox ne peut pas installer ce site comme application. Installe Chromium (ou Chrome, Edge), puis ouvre le site avec.';
  }
  if (/Chrome|Chromium|Edg\//.test(ua)) {
    return 'Ton navigateur n\'a pas proposé l\'installation. Ouvre son menu et choisis « Installer » ou « Ajouter à l\'écran d\'accueil ».';
  }
  return 'Pour installer l\'app, utilise un navigateur basé sur Chromium : Chromium, Chrome ou Edge.';
}

function creerHandlerInstall() {
  return async () => {
    if (!installPromptEvent) {
      alert(messageSansInstallation());
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

// Boutons « Installer l'app » (menu ⚙️ et page Paramètres), repérés par data-reglage
document.querySelectorAll('[data-reglage="installer"]').forEach(b => b.addEventListener('click', creerHandlerInstall()));

window.addEventListener('appinstalled', () => {
  console.log('PWA installée avec succès');
});
