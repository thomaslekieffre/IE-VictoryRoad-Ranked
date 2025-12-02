# IE-Ranked Bot

Bot Discord pour le système de ranked Inazuma Eleven Victory Road

## Installation

1. Installer les dépendances:
```bash
npm install
```

2. Créer un fichier `.env` à la racine avec:
```
DISCORD_TOKEN=ton_token_ici
DISCORD_CLIENT_ID=ton_client_id_ici
GUILD_ID=ton_serveur_id_ici
DASHBOARD_PORT=3000 (optionnel, défaut: 3000)
ADMIN_CHANNEL_ID=id_salon_admin (optionnel)
ADMIN_ROLE_ID=id_role_admin (optionnel)
```

3. Enregistrer les commandes slash:
```bash
npm run deploy
```

4. Lancer le bot:
```bash
npm start
```

5. (Optionnel) Lancer le dashboard web:
```bash
npm run dashboard
```
Le dashboard sera disponible sur http://localhost:3000

## Commandes disponibles

### Commandes de base
- `/register` - S'enregistrer dans le système de ranked
- `/profile [joueur]` - Voir le profil et les statistiques d'un joueur
- `/leaderboard [limite]` - Voir le classement (défaut: top 10)
- `/rank [joueur]` - Voir le rang exact dans le classement
- `/stats [joueur]` - Voir les statistiques avancées (rang, win streak, etc.)
- `/history [joueur] [limite]` - Voir l'historique des matchs récents

### Matchmaking
- `/matchmaking` - Rejoindre la file d'attente pour trouver un match
- `/queue` - Voir les joueurs en file d'attente
- `/cancel-match` - Annuler ton match en cours ou te retirer de la file
- `/challenge [joueur]` - Défier un joueur spécifique

### Matchs
- `/match` - Enregistrer un résultat de match (nécessite confirmation)

### Classements
- `/top [type] [limite]` - Voir les classements spécialisés :
  - `winrate` - Top win rate
  - `streak` - Top win streak
  - `active` - Plus actifs (nombre de matchs)
  - `elo` - Meilleur ELO

### Comparaisons
- `/compare [joueur1] [joueur2]` - Comparer deux joueurs (stats et head-to-head)
- `/records [joueur]` - Voir les records personnels (meilleur ELO, plus longue série)

### Aide
- `/help` - Afficher toutes les commandes disponibles

## Structure

```
IE-Ranked/
├── src/
│   ├── index.js              # Point d'entrée du bot
│   ├── commands/             # Toutes les commandes Discord
│   ├── database/             # Gestion de la base de données SQLite
│   ├── utils/                # Utilitaires (rôles, etc.)
│   └── deploy-commands.js    # Script pour enregistrer les commandes
├── dashboard/                # Application Next.js
│   ├── app/                  # Pages et API routes
│   ├── components/           # Composants React (shadcn/ui)
│   └── lib/                  # Utilitaires (DB wrapper, etc.)
├── data/
│   └── ranked.db            # Base de données SQLite (créée automatiquement)
└── package.json             # Dépendances du bot
```

## Fonctionnalités avancées

### Matchmaking intelligent
- Recherche automatique d'adversaires avec ELO similaire
- Expansion progressive de la plage ELO si aucun adversaire trouvé
- Confirmation requise pour les écarts d'ELO importants
- Création automatique de salons privés pour les matchs
- Rappels automatiques après 12 minutes

### Système de confirmation
- Tous les matchs nécessitent la confirmation des deux joueurs
- Boutons interactifs pour accepter/refuser les résultats
- Protection contre les erreurs et tricheries

### Historique et records
- Historique complet des changements d'ELO
- Records personnels (meilleur ELO, plus longue série)
- Notifications DM pour les nouveaux records (ELO >= 1500, série >= 5)

### Dashboard en temps réel
- Synchronisation automatique avec la base de données
- Rafraîchissement toutes les 5 secondes
- Interface moderne et responsive

## Dashboard Web

Le dashboard web (Next.js + shadcn/ui) permet de visualiser et gérer les statistiques en temps réel :

### Fonctionnalités
- **Page principale** : Classement des joueurs avec recherche et tri
- **Profils joueurs** : Statistiques détaillées, historique des matchs, graphique de progression ELO
- **Comparaison** : Comparer deux joueurs côte à côte avec leurs stats et head-to-head
- **Matchs** : File d'attente du matchmaking et matchs actifs en temps réel
- **Création de matchs** : Lancer des matchs directement depuis le site

### Lancer le dashboard
```bash
cd dashboard
npm install
npm run dev
```

Le dashboard sera disponible sur http://localhost:3000

**Note** : Le dashboard partage la même base de données que le bot et se met à jour automatiquement.

## Système ELO

- ELO initial: 1000
- Facteur K: 32 (volatilité des changements)
- Calcul basé sur le système Elo standard

## Système de rôles automatiques

Le bot attribue automatiquement des rôles selon l'ELO :
- **Iron** : 0-999 ELO
- **Bronze** : 1000-1199 ELO
- **Silver** : 1200-1399 ELO
- **Gold** : 1400-1599 ELO
- **Platinum** : 1600-1799 ELO
- **Diamond** : 1800+ ELO
