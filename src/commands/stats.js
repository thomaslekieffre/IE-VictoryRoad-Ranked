import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getEloRole } from '../utils/roles.js';

export default {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Voir tes statistiques avancées')
    .addUserOption(option =>
      option
        .setName('joueur')
        .setDescription('Joueur dont tu veux voir les stats (optionnel)')
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
    const rank = client.db.getPlayerRank(targetUser.id);
    const winStreak = client.db.getPlayerWinStreak(targetUser.id);
    const bestElo = client.db.getPlayerBestElo(targetUser.id);
    const avgScore = client.db.getPlayerAverageScore(targetUser.id);
    const grade = getEloRole(player.elo);

    // Déterminer le rang textuel
    let rankText = '';
    if (rank === 1) rankText = '🥇 #1';
    else if (rank === 2) rankText = '🥈 #2';
    else if (rank === 3) rankText = '🥉 #3';
    else rankText = `#${rank}`;

    // Emoji pour le grade
    const gradeEmojis = {
      'Iron': '⚫',
      'Bronze': '🟤',
      'Silver': '⚪',
      'Gold': '🟡',
      'Platinum': '🔵',
      'Diamond': '💎'
    };

    const embed = new EmbedBuilder()
      .setTitle(`📊 Statistiques de ${player.username}`)
      .setColor(0x5865F2)
      .addFields(
        { name: '🏆 Rang', value: rankText, inline: true },
        { name: '⭐ ELO Actuel', value: player.elo.toString(), inline: true },
        { name: '🎖️ Grade', value: `${gradeEmojis[grade] || '🏅'} ${grade}`, inline: true },
        { name: '🌟 Meilleur ELO', value: bestElo.toString(), inline: true },
        { name: '🔥 Win Streak', value: winStreak > 0 ? `${winStreak} victoires` : 'Aucun', inline: true },
        { name: '📈 Win Rate', value: `${winRate}%`, inline: true },
        { name: '📊 Parties', value: totalGames.toString(), inline: true },
        { name: '✅ Victoires', value: player.wins.toString(), inline: true },
        { name: '❌ Défaites', value: player.losses.toString(), inline: true },
        { name: '🤝 Nuls', value: player.draws.toString(), inline: true },
        { name: '🎯 Score moyen', value: avgScore > 0 ? avgScore.toString() : 'N/A', inline: true }
      )
      .setFooter({ text: `Inscrit le ${new Date(player.created_at).toLocaleDateString('fr-FR')}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

