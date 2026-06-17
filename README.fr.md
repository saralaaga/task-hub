# Task Hub

[English](README.md) | [简体中文](README.zh-CN.md) | [日本語](README.ja.md) | [한국어](README.ko.md) | [Français](README.fr.md) | [Español](README.es.md)

Task Hub est un plugin Obsidian réservé au bureau. Il réunit les tâches Markdown de votre vault, Apple Reminders, Apple Calendar, les calendriers ICS publics et les tâches Dida/TickTick dans un espace de travail unique.

Il s'adresse aux personnes qui écrivent leurs engagements dans des notes quotidiennes, comptes rendus de réunion, notes de projet ou documents de référence, tout en voulant un endroit calme pour les relire, filtrer, replanifier et mettre à jour en sécurité.

![Task Hub calendar overview](assets/task-hub-calendar-overview.png)

## Pourquoi Task Hub ?

Task Hub garde vos tâches Markdown dans leurs notes d'origine et leur ajoute un centre de commande dédié. Vous n'avez pas besoin de migrer toutes vos tâches vers un autre gestionnaire pour voir ce qui est prévu, d'où cela vient ou à quel tag de projet cela appartient.

Utilisez-le pour :

- Collecter les tâches `- [ ]` et `- [x]` dans tout votre vault.
- Ouvrir la note source depuis une tâche et revenir près de la ligne d'origine.
- Relire les tâches par liste, calendrier ou tag.
- Voir les tâches datées avec les sources de calendrier et de rappels prises en charge.
- Garder toute écriture vers des sources externes explicite et optionnelle.

## Points forts

- Indexe les tâches Markdown écrites avec `- [ ]` et `- [x]`.
- Détecte les dates `📅 YYYY-MM-DD`, `due:: YYYY-MM-DD` ou `YYYY-MM-DD` seul.
- Filtre par état, source, tag, période, texte et conditions AND/OR personnalisées.
- Termine les tâches du vault seulement après vérification que la ligne source correspond encore.
- Crée et modifie des tâches récurrentes courantes : quotidiennes, hebdomadaires, mensuelles et annuelles.
- Affiche tâches datées et événements en vues mois, semaine et jour.
- Replanifie par glisser-déposer les tâches Markdown qui contiennent déjà un marqueur de date pris en charge.
- Ajoute des calendriers ICS publics en lecture seule.
- Lit Apple Reminders et Apple Calendar sur macOS via le helper local.
- Synchronise les tâches Dida/TickTick via l'Open API lorsque l'intégration est configurée.
- Crée des notes Markdown locales liées aux tâches et événements.
- Permet de basculer l'interface du plugin entre anglais, chinois, japonais, coréen et français.

## Sources prises en charge

| Source | Lecture | Écriture optionnelle | Notes |
| --- | --- | --- | --- |
| Tâches Markdown du vault | Oui | Terminer, modifier, supprimer, récurrence et replanification par glisser-déposer pour les lignes prises en charge | La ligne source est vérifiée avant toute écriture Markdown. |
| Calendriers ICS publics | Oui | Non | Les événements ICS sont en lecture seule. |
| Apple Reminders | macOS seulement | Terminer, rouvrir, modifier, créer depuis Markdown et replanifier si activé | Utilise le helper Apple local et les permissions macOS. |
| Apple Calendar | macOS seulement | Créer, modifier et replanifier des événements si activé | Les calendriers inscriptibles sont respectés ; les calendriers en lecture seule restent en lecture seule. |
| Dida / TickTick | Oui, via Open API | Créer, modifier, terminer, supprimer, synchroniser les tags et replanifier si activé | Nécessite votre jeton API et vos réglages. |

Les fonctions d'écriture sont séparées dans les réglages. Le fait qu'une source soit lisible ne signifie pas que Task Hub la modifiera automatiquement.

## Compatibilité

- **Obsidian :** `manifest.json` déclare actuellement `minAppVersion` `1.7.2`. Utilisez Obsidian desktop 1.7.2 ou plus récent.
- **Mobile :** Obsidian mobile n'est pas pris en charge.
- **Intégration Apple sur macOS :** Apple Reminders et Apple Calendar sont disponibles uniquement sur macOS. La matrice actuellement testée est macOS 14 Sonoma ou plus récent.
- **Autres systèmes de bureau :** Les fonctions de base pour les tâches du vault, les tags, le calendrier, ICS public et Dida/TickTick sont conçues pour Obsidian desktop. Apple Reminders et Apple Calendar ne sont pas disponibles hors macOS.

## Installation

Lorsque Task Hub est disponible dans le répertoire des plugins communautaires Obsidian, installez-le depuis **Settings -> Community plugins -> Browse**.

Pour une installation manuelle depuis une GitHub Release :

1. Téléchargez `manifest.json`, `main.js` et `styles.css` depuis la release.
2. Créez ce dossier dans votre vault : `.obsidian/plugins/task-hub/`.
3. Copiez les fichiers téléchargés dans ce dossier.
4. Redémarrez Obsidian ou rechargez les plugins communautaires, puis activez **Task Hub**.

La prise en charge locale d'Apple Reminders et Apple Calendar dépend du binaire `taskhub-apple-helper` dans le paquet du plugin ou dans le chemin de build source. Les assets standards d'une release de plugin communautaire restent les fichiers pris en charge par Obsidian : `manifest.json`, `main.js` et `styles.css`.

## Utilisation quotidienne

Ouvrez Task Hub depuis l'icône du ruban ou la commande **Open Task Hub**.

La vue des tâches rassemble les tâches du vault et les sources externes prises en charge dans une seule liste. Utilisez la barre latérale pour filtrer par source ou tag, et la barre d'outils pour afficher les tâches terminées, appliquer des filtres conditionnels, rechercher du texte ou rescanner le vault.

La vue calendrier combine les tâches Markdown datées, les événements ICS publics, les événements Apple Calendar, Apple Reminders et les tâches Dida/TickTick disponibles. Les vues mois, semaine et jour permettent de changer d'horizon de planification. La replanification par glisser-déposer n'est disponible que pour les sources et réglages qui prennent en charge l'écriture.

La vue tags regroupe les tâches par tags de style Obsidian afin de relire facilement projets, contextes ou listes d'attente.

Les notes de tâche sont des fichiers Markdown locaux facultatifs liés aux tâches ou événements de Task Hub. Elles utilisent le frontmatter YAML pour garder la relation visible et portable.

## Confidentialité et permissions

Task Hub indexe les fichiers Markdown de votre vault local et stocke ses réglages dans les données de plugin Obsidian de ce vault.

Les sources ICS publiques sont récupérées uniquement depuis les URL que vous configurez. L'intégration Dida/TickTick envoie des requêtes HTTPS authentifiées uniquement vers la base API configurée lorsque vous l'activez.

L'intégration Apple locale fonctionne seulement sur Obsidian desktop pour macOS et demande à macOS l'accès à Reminders ou Calendar avant de lire les données locales. Task Hub ne demande pas votre mot de passe Apple ID et ne se connecte pas directement aux serveurs iCloud ; la synchronisation iCloud reste gérée par macOS.

Obsidian peut afficher des avertissements de capacités. Task Hub les utilise pour des raisons limitées :

- **Énumération du vault :** scanner les fichiers Markdown pour trouver les lignes de tâche et les dates.
- **Lecture/écriture du vault :** lire les notes pour l'indexation et écrire uniquement lors d'une action de fin, modification, suppression ou replanification prise en charge.
- **Accès au système de fichiers :** vérifier et utiliser le helper Apple local optionnel dans le chemin du plugin.
- **Exécution shell :** lancer uniquement `taskhub-apple-helper` fourni ou construit localement pour l'intégration Apple.
- **Requêtes réseau :** récupérer les URL ICS configurées et accéder à l'API Dida/TickTick configurée si activée.

Task Hub n'envoie pas les tâches du vault à un service distant sauf si vous créez ou synchronisez explicitement une tâche externe via une intégration configurée.

## Limites actuelles

Task Hub garde un périmètre volontairement conservateur :

- Obsidian mobile n'est pas pris en charge.
- La grammaire complète du plugin Obsidian Tasks n'est pas implémentée.
- La syntaxe de tâche Markdown avec heures de début/fin n'est pas implémentée.
- Google Calendar OAuth et Microsoft Calendar OAuth ne sont pas inclus.
- Les événements ICS publics sont en lecture seule.
- Les fonctions d'écriture Apple Reminders, Apple Calendar et Dida/TickTick doivent être activées explicitement.
- Le helper Apple est fourni par le paquet du plugin ou le chemin de build source ; ne supposez pas qu'un asset helper supplémentaire est installé par une release communautaire standard.

## Développement

Consultez le README anglais pour les détails de développement et de release : [Development](README.md#development).

## Assets de release

Pour une release de plugin communautaire Obsidian, le tag GitHub doit correspondre exactement à la `version` de `manifest.json` et inclure ces pièces jointes :

- `main.js`
- `manifest.json`
- `styles.css`

La racine du dépôt conserve aussi les fichiers attendus par le flux de soumission Obsidian :

- `README.md`
- `LICENSE`
- `manifest.json`
- `versions.json`

N'ajoutez pas de fichiers supplémentaires comme `taskhub-apple-helper` aux GitHub Releases du plugin communautaire. Obsidian télécharge uniquement `main.js`, `manifest.json` et `styles.css` depuis les release assets.
