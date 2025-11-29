import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Voir toutes les commandes disponibles'),
  
  async execute(interaction, client) {
    const embed = new EmbedBuilder()
      .setTitle('📚 Guide des commandes')
      .setColor(0x5865F2)
      .setDescription('Voici toutes les commandes disponibles pour le système de ranked :')
      .addFields(
        {
          name: '🔰 Commandes de base',
          value: 
            '`/register` - S\'enregistrer dans le système\n' +
            '`/profile [joueur]` - Voir le profil et les stats\n' +
            '`/leaderboard [limite]` - Voir le classement\n' +
            '`/rank [joueur]` - Voir le rang exact\n' +
            '`/stats [joueur]` - Statistiques avancées\n' +
            '`/history [joueur] [limite]` - Historique des matchs',
          inline: false
        },
        {
          name: '🎮 Matchmaking',
          value:
            '`/matchmaking` - Rejoindre la file d\'attente\n' +
            '`/queue` - Voir les joueurs en attente\n' +
            '`/cancel-match` - Annuler ton match ou quitter la file\n' +
            '`/challenge [joueur]` - Défier un joueur spécifique',
          inline: false
        },
        {
          name: '⚔️ Matchs',
          value:
            '`/match` - Enregistrer un résultat de match\n' +
            '   (nécessite confirmation des deux joueurs)',
          inline: false
        },
        {
          name: '🏆 Classements',
          value:
            '`/top winrate [limite]` - Top win rate\n' +
            '`/top streak [limite]` - Top win streak\n' +
            '`/top active [limite]` - Plus actifs\n' +
            '`/top elo [limite]` - Meilleur ELO',
          inline: false
        },
        {
          name: 'ℹ️ Aide',
          value:
            '`/help` - Afficher ce message',
          inline: false
        }
      )
      .addFields(
        {
          name: '📖 Comment jouer ?',
          value:
            '1. Utilise `/register` pour t\'inscrire\n' +
            '2. Utilise `/matchmaking` pour trouver un match\n' +
            '3. Une fois le match terminé, utilise `/match` pour enregistrer le score\n' +
            '4. Les deux joueurs doivent confirmer le résultat',
          inline: false
        },
        {
          name: '🎖️ Système de grades',
          value:
            '⚫ **Iron** : 0-999 ELO\n' +
            '🟤 **Bronze** : 1000-1199 ELO\n' +
            '⚪ **Silver** : 1200-1399 ELO\n' +
            '🟡 **Gold** : 1400-1599 ELO\n' +
            '🔵 **Platinum** : 1600-1799 ELO\n' +
            '💎 **Diamond** : 1800+ ELO',
          inline: false
        }
      )
      .setFooter({ text: 'Besoin d\'aide ? Contacte un admin !' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

