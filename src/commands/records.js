import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('records')
    .setDescription('Voir tes records personnels')
    .addUserOption(option =>
      option
        .setName('joueur')
        .setDescription('Joueur dont tu veux voir les records (optionnel)')
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

    const records = client.db.getPlayerRecords(targetUser.id);
    const winStreak = client.db.getPlayerWinStreak(targetUser.id);
    const bestElo = Math.max(...client.db.getEloHistory(targetUser.id, 1000).map(h => h.elo), player.elo);

    const embed = new EmbedBuilder()
      .setTitle(`🏆 Records de ${player.username}`)
      .setColor(0xFFD700)
      .addFields(
        {
          name: '📈 ELO',
          value: `Meilleur ELO: **${bestElo}**\nELO actuel: ${player.elo}`,
          inline: true,
        },
        {
          name: '🔥 Série de victoires',
          value: `Record: **${Math.max(...records.filter(r => r.record_type === 'win_streak').map(r => r.record_value), winStreak)}**\nActuel: ${winStreak}`,
          inline: true,
        },
        {
          name: '📊 Statistiques',
          value: `Victoires: ${player.wins}\nDéfaites: ${player.losses}\nNuls: ${player.draws}`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

