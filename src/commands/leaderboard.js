import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Voir le classement des joueurs')
    .addIntegerOption(option =>
      option
        .setName('limite')
        .setDescription('Nombre de joueurs à afficher (défaut: 10)')
        .setMinValue(1)
        .setMaxValue(25)
    ),
  
  async execute(interaction, client) {
    const limit = interaction.options.getInteger('limite') || 10;
    const leaderboard = client.db.getLeaderboard(limit);
    const allPlayers = client.db.getLeaderboard(10000);

    if (leaderboard.length === 0) {
      return interaction.reply({
        content: '❌ Aucun joueur enregistré pour le moment.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Classement')
      .setColor(0xFFD700)
      .setDescription(
        leaderboard
          .map((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            return `${medal} **${player.username}** - ELO: ${player.elo} (${player.wins}W/${player.losses}L)`;
          })
          .join('\n')
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

