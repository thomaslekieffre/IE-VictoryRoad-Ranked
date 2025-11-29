import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { randomUUID } from 'crypto';

export default {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('Proposer un résultat de match (nécessite confirmation des deux joueurs)')
    .addUserOption(option =>
      option
        .setName('adversaire')
        .setDescription('Ton adversaire')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('score_joueur')
        .setDescription('Ton score')
        .setRequired(true)
        .setMinValue(0)
    )
    .addIntegerOption(option =>
      option
        .setName('score_adversaire')
        .setDescription('Score de l\'adversaire')
        .setRequired(true)
        .setMinValue(0)
    ),
  
  async execute(interaction, client) {
    const player1Id = interaction.user.id;
    const player2Id = interaction.options.getUser('adversaire').id;
    const player1Score = interaction.options.getInteger('score_joueur');
    const player2Score = interaction.options.getInteger('score_adversaire');

    if (player1Id === player2Id) {
      return interaction.reply({
        content: '❌ Tu ne peux pas jouer contre toi-même !',
        ephemeral: true,
      });
    }

    const player1 = client.db.getPlayer(player1Id);
    const player2 = client.db.getPlayer(player2Id);

    if (!player1 || !player2) {
      return interaction.reply({
        content: '❌ Un des deux joueurs n\'est pas enregistré. Utilisez `/register` d\'abord.',
        ephemeral: true,
      });
    }

    // Déterminer le gagnant
    let winnerText = '🤝 NUL';
    if (player1Score > player2Score) {
      winnerText = `✅ ${player1.username} gagne`;
    } else if (player2Score > player1Score) {
      winnerText = `✅ ${player2.username} gagne`;
    }

    // Créer une confirmation
    const confirmationId = randomUUID();
    
    // Répondre avec les boutons de confirmation
    const embed = new EmbedBuilder()
      .setTitle('🎮 Confirmation de match')
      .setDescription(`**${player1.username}** propose ce résultat :`)
      .setColor(0xFFA500)
      .addFields(
        {
          name: `${player1.username}`,
          value: `Score: **${player1Score}**\nELO: ${player1.elo}`,
          inline: true,
        },
        {
          name: 'VS',
          value: winnerText,
          inline: true,
        },
        {
          name: `${player2.username}`,
          value: `Score: **${player2Score}**\nELO: ${player2.elo}`,
          inline: true,
        },
        {
          name: '⏳ En attente',
          value: `${player2.username} doit confirmer ce résultat`,
        }
      )
      .setTimestamp();

    const confirmButton = new ButtonBuilder()
      .setCustomId(`match_confirm_${confirmationId}`)
      .setLabel('✅ Confirmer')
      .setStyle(ButtonStyle.Success);

    const denyButton = new ButtonBuilder()
      .setCustomId(`match_deny_${confirmationId}`)
      .setLabel('❌ Refuser')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, denyButton);

    const reply = await interaction.reply({
      content: `<@${player2Id}>`,
      embeds: [embed],
      components: [row],
      fetchReply: true,
    });

    // Sauvegarder la confirmation dans la base de données
    client.db.createMatchConfirmation(
      confirmationId,
      player1Id,
      player2Id,
      player1Score,
      player2Score,
      reply.id
    );
  },
};
