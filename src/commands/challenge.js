import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { randomUUID } from 'crypto';

export default {
  data: new SlashCommandBuilder()
    .setName('challenge')
    .setDescription('Défier un joueur spécifique')
    .addUserOption(option =>
      option
        .setName('joueur')
        .setDescription('Le joueur que tu veux défier')
        .setRequired(true)
    ),
  
  async execute(interaction, client) {
    const challengerId = interaction.user.id;
    const challengedId = interaction.options.getUser('joueur').id;

    if (challengerId === challengedId) {
      return interaction.reply({
        content: '❌ Tu ne peux pas te défier toi-même !',
        ephemeral: true,
      });
    }

    const challenger = client.db.getPlayer(challengerId);
    const challenged = client.db.getPlayer(challengedId);

    if (!challenger || !challenged) {
      return interaction.reply({
        content: '❌ Un des deux joueurs n\'est pas enregistré. Utilisez `/register` d\'abord.',
        ephemeral: true,
      });
    }

    // Vérifier si l'un des deux est déjà en matchmaking ou dans un match
    const challengerInQueue = client.db.getPlayerInQueue(challengerId);
    const challengedInQueue = client.db.getPlayerInQueue(challengedId);
    const challengerActive = client.db.getActiveMatchByPlayer(challengerId);
    const challengedActive = client.db.getActiveMatchByPlayer(challengedId);

    if (challengerInQueue || challengerActive) {
      return interaction.reply({
        content: '❌ Tu es déjà en matchmaking ou dans un match actif.',
        ephemeral: true,
      });
    }

    if (challengedInQueue || challengedActive) {
      return interaction.reply({
        content: `❌ ${challenged.username} est déjà en matchmaking ou dans un match actif.`,
        ephemeral: true,
      });
    }

    // Créer le défi
    const challengeId = randomUUID();
    const embed = new EmbedBuilder()
      .setTitle('⚔️ Défi lancé !')
      .setDescription(`**${challenger.username}** défie **${challenged.username}** !`)
      .addFields(
        { name: `${challenger.username}`, value: `ELO: ${challenger.elo}`, inline: true },
        { name: 'VS', value: '⚔️', inline: true },
        { name: `${challenged.username}`, value: `ELO: ${challenged.elo}`, inline: true }
      )
      .setColor(0xFF6B6B)
      .setTimestamp();

    const acceptButton = new ButtonBuilder()
      .setCustomId(`challenge_accept_${challengeId}_${challengerId}_${challengedId}`)
      .setLabel('✅ Accepter')
      .setStyle(ButtonStyle.Success);

    const denyButton = new ButtonBuilder()
      .setCustomId(`challenge_deny_${challengeId}_${challengerId}_${challengedId}`)
      .setLabel('❌ Refuser')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(acceptButton, denyButton);

    await interaction.reply({
      content: `✅ Défi envoyé à ${challenged.username} ! Il a reçu un message privé.`,
      ephemeral: true,
    });

    // Envoyer un MP au joueur défié avec les boutons
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('⚔️ Tu as reçu un défi !')
        .setDescription(`**${challenger.username}** te défie en match ranked !`)
        .addFields(
          { name: `${challenger.username}`, value: `ELO: ${challenger.elo}`, inline: true },
          { name: 'VS', value: '⚔️', inline: true },
          { name: 'Toi', value: `ELO: ${challenged.elo}`, inline: true }
        )
        .setColor(0xFF6B6B)
        .setTimestamp();
      
      await client.users.send(challengedId, { 
        embeds: [dmEmbed],
        components: [row]
      });
    } catch (error) {
      console.error('Erreur MP:', error);
      await interaction.followUp({
        content: '❌ Impossible d\'envoyer un message privé. Vérifie que les MP sont activés.',
        ephemeral: true,
      });
    }
  },
};

