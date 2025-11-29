import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('compare')
    .setDescription('Comparer deux joueurs')
    .addUserOption(option =>
      option
        .setName('joueur1')
        .setDescription('Premier joueur')
        .setRequired(true)
    )
    .addUserOption(option =>
      option
        .setName('joueur2')
        .setDescription('Second joueur')
        .setRequired(true)
    ),
  
  async execute(interaction, client) {
    const player1Id = interaction.options.getUser('joueur1').id;
    const player2Id = interaction.options.getUser('joueur2').id;

    if (player1Id === player2Id) {
      return interaction.reply({
        content: '❌ Tu ne peux pas comparer un joueur avec lui-même !',
        ephemeral: true,
      });
    }

    const comparison = client.db.comparePlayers(player1Id, player2Id);

    if (!comparison) {
      return interaction.reply({
        content: '❌ Un des deux joueurs n\'est pas enregistré.',
        ephemeral: true,
      });
    }

    const player1 = comparison.player1;
    const player2 = comparison.player2;
    const h2h = comparison.headToHead;

    const totalGames1 = player1.wins + player1.losses + player1.draws;
    const totalGames2 = player2.wins + player2.losses + player2.draws;
    const winRate1 = totalGames1 > 0 ? ((player1.wins / totalGames1) * 100).toFixed(1) : '0.0';
    const winRate2 = totalGames2 > 0 ? ((player2.wins / totalGames2) * 100).toFixed(1) : '0.0';

    const embed = new EmbedBuilder()
      .setTitle('⚖️ Comparaison de joueurs')
      .setColor(0x5865F2)
      .addFields(
        {
          name: `${player1.username}`,
          value: `ELO: **${player1.elo}**\nVictoires: ${player1.wins}\nDéfaites: ${player1.losses}\nNuls: ${player1.draws}\nWin Rate: ${winRate1}%`,
          inline: true,
        },
        {
          name: 'VS',
          value: `\n\n**Head-to-Head**\n${h2h.wins1}W - ${h2h.wins2}W\n${h2h.draws}Nuls\n\n${comparison.totalMatches} matchs`,
          inline: true,
        },
        {
          name: `${player2.username}`,
          value: `ELO: **${player2.elo}**\nVictoires: ${player2.wins}\nDéfaites: ${player2.losses}\nNuls: ${player2.draws}\nWin Rate: ${winRate2}%`,
          inline: true,
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

