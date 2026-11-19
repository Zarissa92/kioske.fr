# TODO — kioske.fr

Tâches à implémenter dans les prochaines sessions.

## JavaScript/Interactions

- **Hover galerie satisfaisant** : survol des cartes de galerie sur PC (2026-11-12). À améliorer : gestion des cas limites (souris rapide, multi-toucher).

## Aperçus et images

- **Aperçus sans image : à revérifier après la mise en ligne de la v3** (2026-11-18, causes trouvées le 2026-11-19).
  - Corrigé : nginx ne servait pas `/img/previews/…` (404) ; police absente du serveur (texte minuscule) ; lettre de repli toujours « H » ; et surtout, la carte ne prenait que l'image du flux RSS, pas celle de l'aperçu de la page (`construction.py`, `images_map`) : The Pink Times, dont le flux n'a pas d'image, avait des cartes sans photo alors que ses pages en ont une. Cartes en version 3, refaites par lots.
  - À vérifier : une carte récente de The Pink Times en ligne doit avoir sa photo (plusieurs centaines de Ko). Les rares cartes encore sans photo laissent une ligne `[preview] image non utilisée … : raison` (`journalctl -u kioske-veille.service | grep "image non utilisée"`) ; si la raison est le format AVIF (non lu par Pillow), décider entre `pillow-avif-plugin` dans `requirements.txt` ou le refus des AVIF. Discord peut garder une ancienne carte en cache quelque temps.
- **Retirer le patch de transition des cartes (v1/v2 → v3)**, une fois toutes les cartes refaites. Vérifier d'abord sur le serveur qu'il ne reste plus de carte sans `-v3` : `ls ~/kioske.fr/build/img/previews | grep -vc -- '-v3.png'` doit donner 0 (le journal de build n'affiche alors plus `[previews] … carte(s) refaite(s)`).
  - `kioske/previews.py` : retirer `_anciennes_cartes()`, `REFAITES_PAR_BUILD`, `REFAITES_DUREE_MAX`, le compteur et la minuterie de `generer_previews()` (paramètres `refaites_max`, `duree_max`), et le repli sur l'ancienne carte dans `preview_local()` ; garder `VERSION_PREVIEW` et `nom_preview()` (utiles pour une prochaine refonte).
  - `kioske/construction.py` : retirer le paramètre `simple` de `ecrire_pages_articles()` et l'import de `REFAITES_PAR_BUILD`.
  - `tests/test_python.py`, classe `CartesDePartage` : retirer les tests des lots (`test_anciennes_cartes_refaites_par_lots`, `test_build_simple_ne_refait_rien`, `test_duree_bornee`, `test_build_simple_passe_la_consigne`).
  - `README.md` (« Cartes de partage », point « Version ») et `CHANGELOG.md`.
  - Sur le serveur : supprimer les anciennes cartes restées dans la racine web (`/srv/kioske.fr/img/previews/`, fichiers sans `-v3`), ou ajouter `img/previews` à `DOSSIERS_PURGES` (`kioske/publication.py`) ; la publication ne les retire pas aujourd'hui.

## Configuration (kioske.cfg)

- **Espacements réglables** : rendre les marges et padding configurables pour permettre d'ajuster facilement le layout sans modifier le CSS :
  - Marges du panneau principal (`.panel`)
  - Espacement des groupes/sections (`.groupes`, `.groupe`)
  - Gap des éléments (cartes, étiquettes, etc.)

- **Layout compacté réglable** : créer un paramètre de configuration (ex: `densité` ou `espacements`) pour passer rapidement entre différents niveaux de compacité sans retoucher le CSS en dur.

## Mise en ligne du 2026-11-19 (Menu, dispositions légales, nginx réaligné)

Dans cet ordre :

- [ ] `kioske_update --dry-run` puis `kioske_update` (la fonction envoie déjà `menu/` au lieu de `ressources/`).
- [ ] Sur le serveur : `deploy/kioske.sh --certificat-ok nginx` **avant** de publier, sinon `/menu/…` et `/hors-ligne.html` comptent comme des sondes pour fail2ban.
- [ ] Publier : `bin/kioske publier --simple` (ou attendre le timer).
- [ ] Vérifier : `/dispositions-legales.html` et `/ressources/` répondent 301 vers `/menu/…` ; une adresse inexistante montre la 404 perso ; un aperçu de partage (`/img/previews/…`) répond 200.
- [ ] Nettoyer le serveur (la publication et rsync ne les retirent pas) :
  - `rm -r ~/kioske.fr/ressources` (ancienne source, exclue de rsync) ;
  - `sudo rm -r /srv/kioske.fr/ressources` (ancienne version publiée) ;
  - `sudo rm /srv/kioske.fr/dispositions-legales.html` (ancienne page statique, plus servie : nginx redirige).

## Redirections à retirer plus tard

À garder tant que des liens partagés, des favoris ou des notifications enregistrées pointent vers les anciennes adresses. À retirer dans `deploy/kioske-nginx.conf` et `deploy/deployer_nginx.sh` (les deux ensemble ; le test `NginxAligne` le vérifie) :

- `/ressources/…` → `/menu/…` (2026-11-19).
- `/dispositions-legales.html` → `/menu/dispositions-legales/` (2026-11-19).

## fail2ban : visiteurs bannis à tort (à décider, 2026-11-19)

- [ ] **Jail générale `nginx-404` (Script_VPS) sur kioske.fr** : elle compte toutes les 404 du site (30 en 10 min). Un bug d'affichage (images `/https://…`, corrigé le 2026-11-19) a suffi à bannir l'administratrice. kioske.fr a déjà ses jails précises (`kioske-hors-site`, `kioske-scan`…) : retirer `kioske.fr.access.log` du `logpath` de `nginx-404`, ou n'y compter que les pages HTML.
- [ ] **Adresses de Cloudflare dans `kioske-scan`** (`104.22.*`, `104.23.*`, `162.158.*`, `172.64.*`–`172.71.*`, `141.101.*`) : sorties partagées (app 1.1.1.1/WARP, relais privé iCloud). Un scanner derrière l'une d'elles fait bannir 30 jours tous ses utilisateurs. Pistes : ban plus court pour ces plages, ou les compter seulement dans `kioske-hors-site`.
- [ ] **Googlebot banni** (`66.249.68.199`, `kioske-hors-site`) : nuit au référencement. Vérifier ce qu'il demandait ; `fail2ban/verifier_robots.sh` (Script_VPS) sait débannir les vrais robots de Google et Bing.

## Sécurité du compte du timer (à décider)

Depuis la galerie « Les + vus » (2026-11-19), le compte du timer est dans le groupe `adm` : le build lit le journal de nginx.
`adm` donne aussi la lecture de tout `/var/log` (auth.log, syslog…), sans mot de passe. Le build traite du contenu
venu d'ailleurs (flux RSS, pages, images décodées par Pillow) : une faille là-dedans donnerait ces journaux à
l'attaquant, en plus de ce que le compte lit déjà. Pistes, du plus simple au plus solide :

- [ ] **Remplacer `adm` par un droit limité à nginx** : `sudo gpasswd -d <compte> adm`, puis une ACL sur
      `/var/log/nginx` (lecture des fichiers existants, et ACL par défaut pour ceux que logrotate créera). Le compte
      ne lit plus auth.log ni syslog.
- [ ] **Durcir l'unité `kioske-veille`** (`deploy/systemd/kioske-veille.service`) : `NoNewPrivileges=yes`,
      `PrivateTmp=yes`, `ProtectSystem=strict` avec `ReadWritePaths=` (dossier du projet, racine web),
      `ProtectHome=read-only` sauf le dossier du projet, `ProtectKernelTunables=yes`, `RestrictSUIDSGID=yes`.
      Un build compromis ne pourrait plus écrire ailleurs. Tester avec `systemd-analyze security kioske-veille`.
- [ ] **Compte dédié au timer** (`kioske`, sans shell ni sudo) au lieu du compte d'administration :
      le plus solide, mais demande de revoir les droits du projet, de `data/` et de la racine web.

## Flux RSS par catégorie : adresse instable

- **Problème constaté** : les flux par catégorie étaient écrits à `rss/<slug>.xml`, où le slug vient du nom de la catégorie. Renommer ou réorganiser une catégorie changeait l'adresse, et un flux créé par un abonné pour suivre le site disparaissait. Les flux par catégorie ont été retirés (2026-11-17) : seul le flux général `rss.xml` est proposé, et son adresse ne change pas.
- **À décider si on les remet** : une adresse qui ne dépend pas du nom affiché. Pistes : un identifiant stable par catégorie, stocké dans `sources/` ou `kioske.cfg` et jamais recalculé à partir du nom ; ou garder l'ancienne adresse en redirection quand une catégorie est renommée.
- **Au passage** : la règle nginx `^/rss/[a-z0-9-]+\.xml$` (`deploy/`) et la purge de `rss/` (`kioske/publication.py`, `DOSSIERS_PURGES`) ne servent plus qu'à retirer les anciens fichiers. À retirer quand plus aucun abonné n'a d'ancienne adresse.
