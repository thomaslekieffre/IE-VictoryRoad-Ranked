import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Voir les joueurs en file d\'attente'),
  
  async execute(interaction, client) {
    const queue = client.db.getMatchmakingQueue();

    if (queue.length === 0) {
      return interaction.reply({
        content: '❌ Aucun joueur en file d\'attente pour le moment.',
        ephemeral: true,
      });
    }

    // Calculer les stats
    const totalElo = queue.reduce((sum, player) => sum + player.elo, 0);
    const avgElo = Math.round(totalElo / queue.length);
    const minElo = Math.min(...queue.map(p => p.elo));
    const maxElo = Math.max(...queue.map(p => p.elo));

    // Calculer le temps d'attente moyen (approximatif)
    const now = Date.now();
    const avgWaitTime = queue.reduce((sum, player) => {
      const waitTime = now - new Date(player.search_started_at).getTime();
      return sum + waitTime;
    }, 0) / queue.length;
    const avgWaitMinutes = Math.round(avgWaitTime / 60000);

    const embed = new EmbedBuilder()
      .setTitle('🔍 File d\'attente du matchmaking')
      .setColor(0x5865F2)
      .setDescription(
        queue.map((player, index) => {
          const waitTime = Math.round((now - new Date(player.search_started_at).getTime()) / 60000);
          const expanded = player.elo_range_expanded === 1 ? ' (recherche élargie)' : '';
          return `${index + 1}. **${player.username}** - ELO: ${player.elo}${expanded} (${waitTime} min)`;
        }).join('\n')
      )
      .addFields(
        { name: '👥 Joueurs en attente', value: queue.length.toString(), inline: true },
        { name: '📊 ELO moyen', value: avgElo.toString(), inline: true },
        { name: '⏱️ Temps d\'attente moyen', value: `${avgWaitMinutes} min`, inline: true },
        { name: '📈 ELO min/max', value: `${minElo} - ${maxElo}`, inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

