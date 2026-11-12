# TODO — kioske.fr

Tâches à implémenter dans les prochaines sessions.

## JavaScript/Interactions

- **Fermeture du menu "+" avec Échap** : actuellement, seuls les panneaux d'articles/catégories se ferment avec Échap. Le menu "+" devrait aussi répondre à cette touche.
- **Recherche en temps réel** : la barre de recherche filtre les cartes uniquement à l'appui d'Entrée. Implémenter un filtrage dynamique au fur et à mesure de la saisie.

## Configuration (kioske.cfg)

- **Espacements réglables** : rendre les marges et padding configurables pour permettre d'ajuster facilement le layout sans modifier le CSS :
  - Marges du panneau principal (`.panel`)
  - Espacement des groupes/sections (`.groupes`, `.groupe`)
  - Padding du menu "+" (`.popover-contenu`)
  - Gap des éléments (cartes, étiquettes, etc.)

- **Layout compacté réglable** : créer un paramètre de configuration (ex: `densité` ou `espacements`) pour passer rapidement entre différents niveaux de compacité sans retoucher le CSS en dur.

## Progressive Web App (PWA)

Le site est déjà 90% compatible. Travail estimé :

**Minimal (1-2h) — point d'entrée rapide :**
- Créer `manifest.json` (métadonnées PWA : nom, icônes, thème, couleur)
- Générer icônes (192×192 et 512×512) à partir de `favicon.svg`
- Ajouter lien `<link rel="manifest">` dans le `<head>`

**Modéré (2-4h) — vrai offline :**
- Service Worker pour cacher assets (CSS, JS, images)
- Stratégie : cache-first pour statiques, network-first pour RSS
- Message d'offline pour l'utilisateur

**Optionnel :**
- Web app shortcuts (accès rapide à la recherche)
- Notifications (nouvelles sources)
- Installation prompt personnalisé

## Documentation

- Mettre à jour README.md avec un schéma du nouveau layout (menu "+", popover d'infos).
- Ajouter un guide d'utilisation du menu "+" pour les contributeurs.
