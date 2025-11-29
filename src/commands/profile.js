import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Voir ton profil et tes statistiques')
    .addUserOption(option =>
      option
        .setName('joueur')
        .setDescription('Joueur dont tu veux voir le profil (optionnel)')
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

    const totalGames = player.wins + player.losses + player.draws;
    const winRate = totalGames > 0 ? ((player.wins / totalGames) * 100).toFixed(1) : 0;

    const embed = new EmbedBuilder()
      .setTitle(`📊 Profil de ${player.username}`)
      .setColor(0x00AE86)
      .addFields(
        { name: '🏆 ELO', value: player.elo.toString(), inline: true },
        { name: '✅ Victoires', value: player.wins.toString(), inline: true },
        { name: '❌ Défaites', value: player.losses.toString(), inline: true },
        { name: '🤝 Nuls', value: player.draws.toString(), inline: true },
        { name: '📈 Win Rate', value: `${winRate}%`, inline: true },
        { name: '🎮 Parties totales', value: totalGames.toString(), inline: true }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

