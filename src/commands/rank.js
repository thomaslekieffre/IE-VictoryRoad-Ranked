import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getEloRole } from '../utils/roles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Voir ton rang exact dans le classement')
    .addUserOption(option =>
      option
        .setName('joueur')
        .setDescription('Joueur dont tu veux voir le rang (optionnel)')
    ),
  
  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('joueur') || interaction.user;
    const player = client.db.getPlayer(targetUser.id);

    if (!player) {
      return interaction.reply({
        content: targetUser.id === interaction.user.id 
          ? '❌ Tu n\'es pas enregistré. Utilise `/register` pour t\'inscrire.'
          : '❌ Ce joueur n\'est pas enregistré.',
        ephemeral: true,
      });
    }

    const rank = client.db.getPlayerRank(targetUser.id);
    const totalPlayers = client.db.getLeaderboard(10000).length;
    const grade = getEloRole(player.elo);

    // Récupérer les joueurs autour
    const allPlayers = client.db.getLeaderboard(10000);
    const playerIndex = allPlayers.findIndex(p => p.user_id === targetUser.id);
    const playersAbove = playerIndex > 0 ? allPlayers[playerIndex - 1] : null;
    const playersBelow = playerIndex < allPlayers.length - 1 ? allPlayers[playerIndex + 1] : null;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Rang de ${player.username}`)
      .setColor(0x5865F2)
      .addFields(
        { name: '🏆 Rang', value: `#${rank} / ${totalPlayers}`, inline: true },
        { name: '🎖️ Grade', value: grade, inline: true },
        { name: '⭐ ELO', value: player.elo.toString(), inline: true }
      );

    if (playersAbove) {
      embed.addFields({
        name: '⬆️ Joueur au-dessus',
        value: `**${playersAbove.username}** - ELO: ${playersAbove.elo} (+${playersAbove.elo - player.elo})`,
        inline: false
      });
    }

    if (playersBelow) {
      embed.addFields({
        name: '⬇️ Joueur en-dessous',
        value: `**${playersBelow.username}** - ELO: ${playersBelow.elo} (${playersBelow.elo - player.elo})`,
        inline: false
      });
    }

    embed.setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

