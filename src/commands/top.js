import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('top')
    .setDescription('Voir les classements spécialisés')
    .addStringOption(option =>
      option
        .setName('type')
        .setDescription('Type de classement')
        .setRequired(true)
        .addChoices(
          { name: 'Win Rate', value: 'winrate' },
          { name: 'Win Streak', value: 'streak' },
          { name: 'Plus actifs', value: 'active' },
          { name: 'Meilleur ELO', value: 'elo' }
        )
    )
    .addIntegerOption(option =>
      option
        .setName('limite')
        .setDescription('Nombre de joueurs à afficher (défaut: 10)')
        .setMinValue(1)
        .setMaxValue(25)
    ),
  
  async execute(interaction, client) {
    const type = interaction.options.getString('type');
    const limit = interaction.options.getInteger('limite') || 10;

    let players = [];
    let title = '';
    let description = '';

    switch (type) {
      case 'winrate':
        // Top win rate
        const allPlayers = client.db.getLeaderboard(1000); // Récupérer tous les joueurs
        players = allPlayers
          .filter(p => p.wins + p.losses + p.draws > 0)
          .map(p => ({
            ...p,
            winRate: ((p.wins / (p.wins + p.losses + p.draws)) * 100).toFixed(1),
            totalGames: p.wins + p.losses + p.draws
          }))
          .sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate))
          .slice(0, limit);
        
        title = '🏆 Top Win Rate';
        description = players.map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} **${p.username}** - ${p.winRate}% (${p.wins}W/${p.losses}L/${p.draws}D)`;
        }).join('\n');
        break;

      case 'streak':
        // Top win streak
        const allPlayersForStreak = client.db.getLeaderboard(1000);
        players = allPlayersForStreak
          .map(p => ({
            ...p,
            streak: client.db.getPlayerWinStreak(p.user_id)
          }))
          .filter(p => p.streak > 0)
          .sort((a, b) => b.streak - a.streak)
          .slice(0, limit);
        
        title = '🔥 Top Win Streak';
        description = players.map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} **${p.username}** - ${p.streak} victoires consécutives`;
        }).join('\n');
        break;

      case 'active':
        // Plus actifs (nombre de matchs)
        const allPlayersForActive = client.db.getLeaderboard(1000);
        players = allPlayersForActive
          .map(p => ({
            ...p,
            totalGames: p.wins + p.losses + p.draws
          }))
          .filter(p => p.totalGames > 0)
          .sort((a, b) => b.totalGames - a.totalGames)
          .slice(0, limit);
        
        title = '🎮 Plus actifs';
        description = players.map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} **${p.username}** - ${p.totalGames} matchs joués`;
        }).join('\n');
        break;

      case 'elo':
        // Meilleur ELO (leaderboard normal)
        players = client.db.getLeaderboard(limit);
        title = '⭐ Meilleur ELO';
        description = players.map((p, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return `${medal} **${p.username}** - ELO: ${p.elo}`;
        }).join('\n');
        break;
    }

    if (players.length === 0) {
      return interaction.reply({
        content: '❌ Aucun joueur trouvé pour ce classement.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(0xFFD700)
      .setDescription(description)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

