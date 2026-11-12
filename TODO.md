# TODO — kioske.fr

Tâches à implémenter dans les prochaines sessions.

## JavaScript/Interactions

- **Fermeture du menu "+" avec Échap** : actuellement, seuls les panneaux d'articles/catégories se ferment avec Échap. Le menu "+" devrait aussi répondre à cette touche.
- **Recherche en temps réel** : la barre de recherche crée un panneau de résultats (2026-11-12). Implémenter un filtrage dynamique au fur et à mesure de la saisie en option.
- **Hover galerie satisfaisant** : survol des cartes de galerie sur PC (2026-11-12). À améliorer : gestion des cas limites (souris rapide, multi-toucher).

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

## Découverte des flux RSS

- **Page rss.html** ✅ terminée (2026-11-12) : page de découverte avec lien vers le flux principal et tous les flux par catégorie (icônes RSS aux couleurs du drapeau trans).
- **Lien vers rss.html** ✅ terminé (2026-11-12) : ajouté au bloc immuable, visible dans le popover d'infos et sur toutes les pages.

## Documentation

- Mettre à jour README.md avec un schéma du nouveau layout (menu "+", popover d'infos).
- Ajouter un guide d'utilisation du menu "+" pour les contributeurs.
