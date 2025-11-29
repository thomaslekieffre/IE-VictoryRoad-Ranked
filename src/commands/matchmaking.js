import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('matchmaking')
    .setDescription('Rejoindre la file d\'attente pour trouver un match'),
  
  async execute(interaction, client) {
    const userId = interaction.user.id;
    const player = client.db.getPlayer(userId);

    if (!player) {
      return interaction.reply({
        content: '❌ Tu n\'es pas enregistré. Utilise `/register` pour t\'inscrire.',
        ephemeral: true,
      });
    }

    // Vérifier si déjà en queue
    const inQueue = client.db.getPlayerInQueue(userId);
    if (inQueue) {
      return interaction.reply({
        content: '❌ Tu es déjà en recherche de match !',
        ephemeral: true,
      });
    }

    // Vérifier si déjà dans un match actif
    const activeMatch = client.db.getActiveMatchByPlayer(userId);
    if (activeMatch) {
      return interaction.reply({
        content: '❌ Tu as déjà un match en cours !',
        ephemeral: true,
      });
    }

    // Envoyer un MP
    try {
      const dmEmbed = new EmbedBuilder()
        .setTitle('🔍 Recherche de match')
        .setDescription('Tu es maintenant en recherche de match !\n\nLe système va te trouver un adversaire avec un ELO similaire.')
        .addFields(
          { name: '📊 Ton ELO', value: player.elo.toString(), inline: true },
          { name: '⏱️ Recherche', value: 'En cours...', inline: true }
        )
        .setColor(0x00AE86)
        .setTimestamp();

      const cancelButton = new ButtonBuilder()
        .setCustomId(`matchmaking_cancel_${userId}`)
        .setLabel('❌ Annuler')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(cancelButton);

      const dmMessage = await interaction.user.send({
        embeds: [dmEmbed],
        components: [row],
      });

      // Ajouter à la queue
      client.db.addToMatchmakingQueue(userId, player.username, player.elo, dmMessage.id);

      // Démarrer la recherche
      startMatchmakingSearch(client, userId);

      await interaction.reply({
        content: '✅ Tu as été ajouté à la file d\'attente ! Vérifie tes messages privés.',
        ephemeral: true,
      });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du MP:', error);
      return interaction.reply({
        content: '❌ Je n\'ai pas pu t\'envoyer un message privé. Vérifie que tes MP sont activés.',
        ephemeral: true,
      });
    }
  },
};

// Fonction pour rechercher un match
async function startMatchmakingSearch(client, userId) {
  const player = client.db.getPlayerInQueue(userId);
  if (!player) return;

  // Initialiser le stockage des timers pour ce joueur
  const timers = {
    checkInterval: null,
    expandTimer: null,
    maxTimer: null
  };

  // Timer pour élargir la recherche après 5 minutes
  timers.expandTimer = setTimeout(async () => {
    const stillInQueue = client.db.getPlayerInQueue(userId);
    if (!stillInQueue) {
      client.matchmakingTimers.delete(userId);
      return;
    }

    client.db.expandEloRange(userId);
    
    // Chercher avec écart élargi
    const opponent = client.db.findMatchForPlayer(userId, 200);
    if (opponent) {
      const opponentQueue = client.db.getPlayerInQueue(opponent.user_id);
      if (opponentQueue && opponentQueue.elo_range_expanded === 1) {
        // Les deux ont élargi, créer directement
        await createMatch(client, userId, opponent.user_id);
        client.matchmakingTimers.delete(userId);
      } else {
        // Demander confirmation
        await requestEloRangeConfirmation(client, userId, opponent.user_id);
      }
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Vérifier périodiquement pour trouver un match
  timers.checkInterval = setInterval(async () => {
    const stillInQueue = client.db.getPlayerInQueue(userId);
    if (!stillInQueue) {
      clearInterval(timers.checkInterval);
      if (timers.expandTimer) clearTimeout(timers.expandTimer);
      if (timers.maxTimer) clearTimeout(timers.maxTimer);
      client.matchmakingTimers.delete(userId);
      return;
    }

    const eloRange = stillInQueue.elo_range_expanded === 1 ? 200 : 100;
    const foundOpponent = client.db.findMatchForPlayer(userId, eloRange);

    if (foundOpponent) {
      clearInterval(timers.checkInterval);
      if (timers.expandTimer) clearTimeout(timers.expandTimer);
      if (timers.maxTimer) clearTimeout(timers.maxTimer);
      client.matchmakingTimers.delete(userId);
      
      // Si écart élargi, demander confirmation
      if (eloRange === 200) {
        const opponentQueue = client.db.getPlayerInQueue(foundOpponent.user_id);
        if (opponentQueue && opponentQueue.elo_range_expanded === 1) {
          // Les deux ont déjà élargi, créer directement
          await createMatch(client, userId, foundOpponent.user_id);
        } else {
          // Demander confirmation
          await requestEloRangeConfirmation(client, userId, foundOpponent.user_id);
        }
      } else {
        // Écart normal, créer directement
        await createMatch(client, userId, foundOpponent.user_id);
      }
    }
  }, 10000); // Vérifier toutes les 10 secondes

  // Nettoyer après 30 minutes max
  timers.maxTimer = setTimeout(() => {
    if (timers.checkInterval) clearInterval(timers.checkInterval);
    if (timers.expandTimer) clearTimeout(timers.expandTimer);
    client.matchmakingTimers.delete(userId);
    
    const stillInQueue = client.db.getPlayerInQueue(userId);
    if (stillInQueue) {
      client.db.removeFromMatchmakingQueue(userId);
      try {
        client.users.send(userId, '⏰ Tu as été retiré de la file d\'attente après 30 minutes.');
      } catch (error) {
        console.error('Erreur MP:', error);
      }
    }
  }, 30 * 60 * 1000);

  // Stocker les timers
  client.matchmakingTimers.set(userId, timers);
}

// Demander confirmation pour écart d'ELO
async function requestEloRangeConfirmation(client, player1Id, player2Id) {
  const player1 = client.db.getPlayer(player1Id);
  const player2 = client.db.getPlayer(player2Id);
  const queue1 = client.db.getPlayerInQueue(player1Id);
  const queue2 = client.db.getPlayerInQueue(player2Id);

  if (!queue1 || !queue2) return;

  const eloDiff = Math.abs(player1.elo - player2.elo);

  const embed = new EmbedBuilder()
    .setTitle('⚠️ Match trouvé avec écart d\'ELO')
    .setDescription(`Un adversaire a été trouvé, mais il y a un écart d'ELO de **${eloDiff} points**.`)
    .addFields(
      { name: `${player1.username}`, value: `ELO: ${player1.elo}`, inline: true },
      { name: 'VS', value: `Écart: ${eloDiff}`, inline: true },
      { name: `${player2.username}`, value: `ELO: ${player2.elo}`, inline: true }
    )
    .setColor(0xFFA500)
    .setTimestamp();

  const acceptButton = new ButtonBuilder()
    .setCustomId(`elo_accept_${player1Id}_${player2Id}`)
    .setLabel('✅ Accepter')
    .setStyle(ButtonStyle.Success);

  const denyButton = new ButtonBuilder()
    .setCustomId(`elo_deny_${player1Id}_${player2Id}`)
    .setLabel('❌ Refuser')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(acceptButton, denyButton);

  try {
    await client.users.send(player1Id, { embeds: [embed], components: [row] });
    await client.users.send(player2Id, { embeds: [embed], components: [row] });
  } catch (error) {
    console.error('Erreur lors de l\'envoi de la confirmation:', error);
  }
}

// Créer le match et le salon (exporté pour utilisation dans index.js)
export async function createMatch(client, player1Id, player2Id) {
  const player1 = client.db.getPlayer(player1Id);
  const player2 = client.db.getPlayer(player2Id);

  // Retirer les deux joueurs de la queue
  client.db.removeFromMatchmakingQueue(player1Id);
  client.db.removeFromMatchmakingQueue(player2Id);

  // Trouver le serveur (guild)
  const guildId = process.env.GUILD_ID;
  if (!guildId) {
    console.error('GUILD_ID non défini');
    return;
  }

  const guild = client.guilds.cache.get(guildId);
  if (!guild) {
    console.error('Serveur non trouvé');
    return;
  }

  // Créer le salon privé
  try {
    const channel = await guild.channels.create({
      name: `match-${player1.username}-vs-${player2.username}`,
      type: 0, // Text channel
      permissionOverwrites: [
        {
          id: guild.id,
          deny: ['ViewChannel'],
        },
        {
          id: player1Id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
        {
          id: player2Id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
        },
      ],
    });

    const matchId = `${player1Id}_${player2Id}_${Date.now()}`;
    client.db.createActiveMatch(matchId, player1Id, player2Id, channel.id);

    // Message dans le salon
    const matchEmbed = new EmbedBuilder()
      .setTitle('🎮 Match trouvé !')
      .setDescription(`**${player1.username}** vs **${player2.username}**`)
      .addFields(
        { name: `${player1.username}`, value: `ELO: ${player1.elo}`, inline: true },
        { name: 'VS', value: '🎯', inline: true },
        { name: `${player2.username}`, value: `ELO: ${player2.elo}`, inline: true }
      )
      .addFields(
        { name: '📝 Instructions', value: 'C\'est à **' + player1.username + '** de créer le salon sur le jeu.\n\nUne fois le match terminé, utilisez `/match` pour enregistrer le résultat.' }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    const adminButton = new ButtonBuilder()
      .setCustomId(`match_admin_${matchId}`)
      .setLabel('🛡️ Admin')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(adminButton);

    await channel.send({ embeds: [matchEmbed], components: [row] });

    // Envoyer un MP aux deux joueurs avec le lien du salon
    const channelLink = `https://discord.com/channels/${guildId}/${channel.id}`;
    
    const dmEmbed1 = new EmbedBuilder()
      .setTitle('✅ Match trouvé !')
      .setDescription(`Un salon privé a été créé pour ton match contre **${player2.username}** !`)
      .addFields(
        { name: '🔗 Lien du salon', value: `[Clique ici pour accéder au salon](${channelLink})` }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    const dmEmbed2 = new EmbedBuilder()
      .setTitle('✅ Match trouvé !')
      .setDescription(`Un salon privé a été créé pour ton match contre **${player1.username}** !`)
      .addFields(
        { name: '🔗 Lien du salon', value: `[Clique ici pour accéder au salon](${channelLink})` }
      )
      .setColor(0x00FF00)
      .setTimestamp();

    try {
      await client.users.send(player1Id, { embeds: [dmEmbed1] });
      await client.users.send(player2Id, { embeds: [dmEmbed2] });
    } catch (error) {
      console.error('Erreur lors de l\'envoi du MP:', error);
    }

    // Timer pour le rappel après 12 minutes
    setTimeout(async () => {
      const activeMatch = client.db.getActiveMatch(channel.id);
      if (activeMatch && activeMatch.reminder_sent === 0) {
        client.db.markReminderSent(channel.id);
        const reminderEmbed = new EmbedBuilder()
          .setTitle('⏰ Rappel')
          .setDescription('N\'oublie pas de valider le score avec `/match` une fois le match terminé !')
          .setColor(0xFFA500);
        await channel.send({
          content: `<@${player1Id}> <@${player2Id}>`,
          embeds: [reminderEmbed]
        });
      }
    }, 12 * 60 * 1000); // 12 minutes

  } catch (error) {
    console.error('Erreur lors de la création du salon:', error);
  }
}

