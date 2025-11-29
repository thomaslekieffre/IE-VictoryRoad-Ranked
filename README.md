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

### Aide
- `/help` - Afficher toutes les commandes disponibles

## Structure

- `src/index.js` - Point d'entrée du bot
- `src/commands/` - Commandes du bot
- `src/database/` - Gestion de la base de données SQLite
- `src/dashboard/` - Dashboard web (serveur + interface)
- `src/deploy-commands.js` - Script pour enregistrer les commandes
- `data/ranked.db` - Base de données SQLite (créée automatiquement)

## Dashboard Web

Le dashboard web permet de visualiser les statistiques en temps réel :
- Classement des joueurs
- File d'attente du matchmaking
- Matchs actifs
- Top classements (win rate, streak, etc.)
- Statistiques globales

Pour lancer le dashboard :
```bash
npm run dashboard
```

Puis ouvrir http://localhost:3000 dans ton navigateur.

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

**Important** : Tu dois créer ces rôles dans ton serveur Discord avec les noms exacts ci-dessus. Le bot les attribuera automatiquement lors des changements d'ELO.

