import { Client, GatewayIntentBits, Collection, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';
import Database from './database/database.js';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Charger les commandes
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  if (command.default?.data && command.default?.execute) {
    client.commands.set(command.default.data.name, command.default);
  }
}

// Initialiser la base de données
client.db = new Database();

// Événement ready
client.once('ready', async () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  await client.db.init();
  
  // Vérifier les confirmations en attente toutes les 5 secondes
  setInterval(async () => {
    try {
      const pendingConfirmations = client.db.getPendingConfirmations();
      for (const confirmation of pendingConfirmations) {
        await sendPendingConfirmationMessage(client, confirmation);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification des confirmations:', error);
    }
  }, 5000);
});

  // Gestion des interactions
client.on('interactionCreate', async interaction => {
  // Gestion des boutons
  if (interaction.isButton()) {
    const parts = interaction.customId.split('_');
    const action = parts[0];
    const type = parts[1];
    
    // Bouton annuler matchmaking
    if (action === 'matchmaking' && type === 'cancel') {
      const userId = parts[2];
      
      if (interaction.user.id !== userId) {
        return interaction.reply({
          content: '❌ Ce bouton ne t\'appartient pas.',
          ephemeral: true,
        });
      }

      client.db.removeFromMatchmakingQueue(userId);
      
      const embed = EmbedBuilder.from(interaction.message.embeds[0]);
      embed.data.title = '❌ Recherche annulée';
      embed.data.description = 'Tu as quitté la file d\'attente.';
      embed.data.color = 0xFF0000;
      
      await interaction.update({
        embeds: [embed],
        components: [],
      });
      return;
    }

    // Boutons accept/deny écart ELO
    if (action === 'elo' && (type === 'accept' || type === 'deny')) {
      const player1Id = parts[2];
      const player2Id = parts[3];
      const userId = interaction.user.id;

      if (userId !== player1Id && userId !== player2Id) {
        return interaction.reply({
          content: '❌ Ce bouton ne t\'appartient pas.',
          ephemeral: true,
        });
      }

      if (type === 'deny') {
        await interaction.update({
          content: '❌ Match refusé. Tu restes en recherche.',
          embeds: [],
          components: [],
        });
        return;
      }

      // Accepter - créer le match directement
      const queue1 = client.db.getPlayerInQueue(player1Id);
      const queue2 = client.db.getPlayerInQueue(player2Id);

      if (!queue1 || !queue2) {
        return interaction.update({
          content: '❌ Un des joueurs n\'est plus en recherche.',
          embeds: [],
          components: [],
        });
      }

      // Créer le match
      const { createMatch } = await import('./commands/matchmaking.js');
      await createMatch(client, player1Id, player2Id);

      await interaction.update({
        content: '✅ Match accepté ! Un salon va être créé.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Boutons pour les défis
    if (action === 'challenge' && (type === 'accept' || type === 'deny')) {
      const challengeId = parts[2];
      const challengerId = parts[3];
      const challengedId = parts[4];
      const userId = interaction.user.id;

      if (userId !== challengedId) {
        return interaction.reply({
          content: '❌ Ce défi ne t\'est pas destiné.',
          ephemeral: true,
        });
      }

      if (type === 'deny') {
        await interaction.update({
          content: '❌ Défi refusé.',
          embeds: [],
          components: [],
        });
        return;
      }

      // Accepter le défi - créer un match
      const { createMatch } = await import('./commands/matchmaking.js');
      await createMatch(client, challengerId, challengedId);

      await interaction.update({
        content: '✅ Défi accepté ! Un salon privé va être créé.',
        embeds: [],
        components: [],
      });
      return;
    }

    // Bouton Admin
    if (action === 'match' && type === 'admin') {
      const matchId = parts.slice(2).join('_');
      const activeMatch = client.db.getActiveMatchByPlayer(interaction.user.id);

      if (!activeMatch || activeMatch.match_id !== matchId) {
        return interaction.reply({
          content: '❌ Tu n\'es pas autorisé à utiliser ce bouton.',
          ephemeral: true,
        });
      }

      const player1 = client.db.getPlayer(activeMatch.player1_id);
      const player2 = client.db.getPlayer(activeMatch.player2_id);
      const channel = interaction.channel;
      const guild = interaction.guild;

      const adminEmbed = new EmbedBuilder()
        .setTitle('🛡️ Signalement Admin - Problème de Match')
        .setDescription('Un problème a été signalé dans un match.')
        .addFields(
          { name: '👤 Signalé par', value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true },
          { name: '🎮 Match ID', value: matchId, inline: true },
          { name: '📺 Salon', value: `<#${channel.id}>`, inline: true },
          { name: '👥 Joueur 1', value: `<@${activeMatch.player1_id}> (${player1?.username || 'Inconnu'})`, inline: true },
          { name: '👥 Joueur 2', value: `<@${activeMatch.player2_id}> (${player2?.username || 'Inconnu'})`, inline: true },
          { name: '🔗 Lien du salon', value: `[Cliquer ici](${channel.url})`, inline: true }
        )
        .setColor(0xFF0000)
        .setTimestamp()
        .setFooter({ text: `Serveur: ${guild?.name || 'Inconnu'}` });

      await interaction.reply({
        content: '✅ Signalement envoyé aux admins. Ils vont examiner le problème.',
        ephemeral: true,
      });

      // Envoyer dans le salon du match
      await channel.send({ 
        content: `🛡️ <@${activeMatch.player1_id}> <@${activeMatch.player2_id}>`,
        embeds: [adminEmbed] 
      });

      // Envoyer dans un salon admin si configuré (optionnel)
      const adminChannelId = process.env.ADMIN_CHANNEL_ID;
      if (adminChannelId) {
        try {
          const adminChannel = await client.channels.fetch(adminChannelId);
          if (adminChannel) {
            // Ping les admins avec le rôle admin si configuré
            const adminRoleId = process.env.ADMIN_ROLE_ID;
            const ping = adminRoleId ? `<@&${adminRoleId}>` : '@here';
            
            await adminChannel.send({
              content: `${ping} **Nouveau signalement de match**`,
              embeds: [adminEmbed]
            });
          }
        } catch (error) {
          console.error('Erreur lors de l\'envoi au salon admin:', error);
        }
      }
      return;
    }

    // Boutons confirmation de match (ancien code)
    if (action === 'match' && (type === 'confirm' || type === 'deny')) {
      const confirmationId = parts.slice(2).join('_');
      const confirmation = client.db.getMatchConfirmation(confirmationId);
      
      if (!confirmation) {
        return interaction.reply({
          content: '❌ Cette confirmation n\'existe plus ou a expiré.',
          ephemeral: true,
        });
      }

      const userId = interaction.user.id;
      
      // Vérifier que l'utilisateur est bien l'un des deux joueurs
      if (userId !== confirmation.player1_id && userId !== confirmation.player2_id) {
        return interaction.reply({
          content: '❌ Tu n\'es pas autorisé à confirmer ce match.',
          ephemeral: true,
        });
      }

      // Si refus
      if (type === 'deny') {
        client.db.deleteMatchConfirmation(confirmationId);
        await interaction.update({
          content: `❌ ${interaction.user.username} a refusé ce résultat. Le match n'a pas été enregistré.`,
          embeds: [],
          components: [],
        });
        return;
      }

      // Si confirmation
      const updated = client.db.confirmMatch(confirmationId, userId);
      
      if (!updated) {
        return interaction.reply({
          content: '❌ Erreur lors de la confirmation.',
          ephemeral: true,
        });
      }

      // Vérifier si les deux joueurs ont confirmé
      if (updated.confirmed_by_player1 === 1 && updated.confirmed_by_player2 === 1) {
        // Finaliser le match
        await finalizeMatch(interaction, client, updated);
      } else {
        // Un seul joueur a confirmé, attendre l'autre
        const player1 = client.db.getPlayer(updated.player1_id);
        const player2 = client.db.getPlayer(updated.player2_id);
        
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = EmbedBuilder.from(oldEmbed);
        
        if (updated.confirmed_by_player1 === 1 && updated.confirmed_by_player2 === 0) {
          newEmbed.data.fields[3].value = `✅ ${player1.username} a confirmé\n⏳ En attente de ${player2.username}`;
        } else if (updated.confirmed_by_player2 === 1 && updated.confirmed_by_player1 === 0) {
          newEmbed.data.fields[3].value = `✅ ${player2.username} a confirmé\n⏳ En attente de ${player1.username}`;
        }

        await interaction.update({
          embeds: [newEmbed],
        });
      }
      return;
    }
  }

  // Gestion des slash commands
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Erreur lors de l'exécution de ${interaction.commandName}:`, error);
      await interaction.reply({
        content: '❌ Une erreur est survenue lors de l\'exécution de la commande.',
        ephemeral: true,
      });
    }
  }
});

// Fonction pour finaliser un match
async function finalizeMatch(interaction, client, confirmation) {
  const player1 = client.db.getPlayer(confirmation.player1_id);
  const player2 = client.db.getPlayer(confirmation.player2_id);

  // Calcul ELO
  function calculateElo(player1Elo, player2Elo, winner) {
    const K = 32;
    const expected1 = 1 / (1 + Math.pow(10, (player2Elo - player1Elo) / 400));
    const expected2 = 1 / (1 + Math.pow(10, (player1Elo - player2Elo) / 400));
    
    let newElo1, newElo2;
    
    if (winner === 1) {
      newElo1 = Math.round(player1Elo + K * (1 - expected1));
      newElo2 = Math.round(player2Elo + K * (0 - expected2));
    } else if (winner === 2) {
      newElo1 = Math.round(player1Elo + K * (0 - expected1));
      newElo2 = Math.round(player2Elo + K * (1 - expected2));
    } else {
      newElo1 = Math.round(player1Elo + K * (0.5 - expected1));
      newElo2 = Math.round(player2Elo + K * (0.5 - expected2));
    }
    
    return { newElo1, newElo2 };
  }

  // Déterminer le gagnant
  let winnerId = null;
  let winner = 0;
  
  if (confirmation.player1_score > confirmation.player2_score) {
    winnerId = confirmation.player1_id;
    winner = 1;
  } else if (confirmation.player2_score > confirmation.player1_score) {
    winnerId = confirmation.player2_id;
    winner = 2;
  }

  // Calculer les nouveaux ELO
  const { newElo1, newElo2 } = calculateElo(player1.elo, player2.elo, winner);
  const eloChange1 = newElo1 - player1.elo;
  const eloChange2 = newElo2 - player2.elo;

  // Créer le match
  const match = client.db.createMatch(confirmation.player1_id, confirmation.player2_id);
  client.db.updateMatch(match.lastInsertRowid, winnerId, confirmation.player1_score, confirmation.player2_score);

  // Mettre à jour les ELO
  client.db.updatePlayerElo(confirmation.player1_id, newElo1);
  client.db.updatePlayerElo(confirmation.player2_id, newElo2);

  // Mettre à jour les rôles automatiquement
  const { updatePlayerRole } = await import('./utils/roles.js');
  await updatePlayerRole(client, confirmation.player1_id, newElo1);
  await updatePlayerRole(client, confirmation.player2_id, newElo2);

  // Mettre à jour les stats
  if (winner === 1) {
    client.db.updatePlayerStats(confirmation.player1_id, 1, 0, 0);
    client.db.updatePlayerStats(confirmation.player2_id, 0, 1, 0);
  } else if (winner === 2) {
    client.db.updatePlayerStats(confirmation.player1_id, 0, 1, 0);
    client.db.updatePlayerStats(confirmation.player2_id, 1, 0, 0);
  } else {
    client.db.updatePlayerStats(confirmation.player1_id, 0, 0, 1);
    client.db.updatePlayerStats(confirmation.player2_id, 0, 0, 1);
  }

  // Supprimer la confirmation
  client.db.deleteMatchConfirmation(confirmation.confirmation_id);

  // Vérifier si c'est un match du matchmaking et fermer le salon
  const activeMatch = client.db.getActiveMatchByPlayer(confirmation.player1_id);
  if (activeMatch && (activeMatch.player1_id === confirmation.player1_id || activeMatch.player2_id === confirmation.player1_id)) {
    try {
      const channel = await client.channels.fetch(activeMatch.channel_id);
      if (channel) {
        // Envoyer le résultat final dans le salon
        const finalEmbed = new EmbedBuilder()
          .setTitle('🎮 Match terminé et enregistré !')
          .setColor(winner === 0 ? 0x808080 : 0x00FF00)
          .addFields(
            {
              name: `${player1.username}`,
              value: `Score: **${confirmation.player1_score}**\nELO: ${player1.elo} → ${newElo1} (${eloChange1 >= 0 ? '+' : ''}${eloChange1})`,
              inline: true,
            },
            {
              name: 'VS',
              value: winner === 0 ? '🤝 NUL' : winner === 1 ? '✅ GAGNANT' : '❌ PERDANT',
              inline: true,
            },
            {
              name: `${player2.username}`,
              value: `Score: **${confirmation.player2_score}**\nELO: ${player2.elo} → ${newElo2} (${eloChange2 >= 0 ? '+' : ''}${eloChange2})`,
              inline: true,
            }
          )
          .setDescription('Le salon sera fermé dans 10 secondes...')
          .setTimestamp();

        await channel.send({ embeds: [finalEmbed] });

        // Supprimer le match actif
        client.db.deleteActiveMatch(activeMatch.match_id);

        // Fermer le salon après 10 secondes
        setTimeout(async () => {
          try {
            await channel.delete('Match terminé');
          } catch (error) {
            console.error('Erreur lors de la fermeture du salon:', error);
          }
        }, 10000);
      }
    } catch (error) {
      console.error('Erreur lors de la gestion du salon:', error);
    }
  }

  // Créer l'embed de résultat
  const embed = new EmbedBuilder()
    .setTitle('🎮 Match enregistré !')
    .setColor(winner === 0 ? 0x808080 : 0x00FF00)
    .addFields(
      {
        name: `${player1.username}`,
        value: `Score: **${confirmation.player1_score}**\nELO: ${player1.elo} → ${newElo1} (${eloChange1 >= 0 ? '+' : ''}${eloChange1})`,
        inline: true,
      },
      {
        name: 'VS',
        value: winner === 0 ? '🤝 NUL' : winner === 1 ? '✅ GAGNANT' : '❌ PERDANT',
        inline: true,
      },
      {
        name: `${player2.username}`,
        value: `Score: **${confirmation.player2_score}**\nELO: ${player2.elo} → ${newElo2} (${eloChange2 >= 0 ? '+' : ''}${eloChange2})`,
        inline: true,
      }
    )
    .setTimestamp();

  await interaction.update({
    embeds: [embed],
    components: [],
  });
}

// Fonction pour envoyer un message de confirmation en attente
async function sendPendingConfirmationMessage(client, confirmation) {
  try {
    const player1 = client.db.getPlayer(confirmation.player1_id);
    const player2 = client.db.getPlayer(confirmation.player2_id);

    if (!player1 || !player2) {
      console.log('Joueurs non trouvés pour la confirmation:', confirmation.confirmation_id);
      return;
    }

    // Déterminer le gagnant
    let winnerText = '🤝 NUL';
    if (confirmation.player1_score > confirmation.player2_score) {
      winnerText = `✅ ${player1.username} gagne`;
    } else if (confirmation.player2_score > confirmation.player1_score) {
      winnerText = `✅ ${player2.username} gagne`;
    }

    // Créer l'embed
    const embed = new EmbedBuilder()
      .setTitle('🎮 Confirmation de match')
      .setDescription(`**${player1.username}** propose ce résultat :`)
      .setColor(0xFFA500)
      .addFields(
        {
          name: `${player1.username}`,
          value: `Score: **${confirmation.player1_score}**\nELO: ${player1.elo}`,
          inline: true,
        },
        {
          name: 'VS',
          value: winnerText,
          inline: true,
        },
        {
          name: `${player2.username}`,
          value: `Score: **${confirmation.player2_score}**\nELO: ${player2.elo}`,
          inline: true,
        },
        {
          name: '⏳ En attente',
          value: `Les deux joueurs doivent confirmer ce résultat`,
        }
      )
      .setFooter({ text: 'Créé depuis le dashboard web' })
      .setTimestamp();

    const confirmButton = new ButtonBuilder()
      .setCustomId(`match_confirm_${confirmation.confirmation_id}`)
      .setLabel('✅ Confirmer')
      .setStyle(ButtonStyle.Success);

    const denyButton = new ButtonBuilder()
      .setCustomId(`match_deny_${confirmation.confirmation_id}`)
      .setLabel('❌ Refuser')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(confirmButton, denyButton);

    // Essayer d'envoyer dans un salon configuré, sinon en DM aux deux joueurs
    const matchChannelId = process.env.MATCH_CHANNEL_ID;
    let message = null;

    if (matchChannelId) {
      try {
        const channel = await client.channels.fetch(matchChannelId);
        if (channel) {
          message = await channel.send({
            content: `<@${confirmation.player1_id}> <@${confirmation.player2_id}>`,
            embeds: [embed],
            components: [row],
          });
        }
      } catch (error) {
        console.error('Erreur envoi dans le salon:', error);
      }
    }

    // Si pas de salon configuré ou erreur, envoyer en DM aux deux joueurs
    if (!message) {
      try {
        const user1 = await client.users.fetch(confirmation.player1_id);
        const user2 = await client.users.fetch(confirmation.player2_id);
        
        if (user1) {
          const dm1 = await user1.createDM();
          message = await dm1.send({
            content: `<@${confirmation.player2_id}>`,
            embeds: [embed],
            components: [row],
          });
        }
      } catch (error) {
        console.error('Erreur envoi DM:', error);
        // Essayer avec le second joueur
        try {
          const user2 = await client.users.fetch(confirmation.player2_id);
          if (user2) {
            const dm2 = await user2.createDM();
            message = await dm2.send({
              content: `<@${confirmation.player1_id}>`,
              embeds: [embed],
              components: [row],
            });
          }
        } catch (error2) {
          console.error('Erreur envoi DM au second joueur:', error2);
        }
      }
    }

    // Mettre à jour le message_id dans la DB
    if (message) {
      client.db.updateMatchConfirmationMessageId(confirmation.confirmation_id, message.id);
      console.log(`✅ Message de confirmation envoyé pour ${confirmation.confirmation_id}`);
    }
  } catch (error) {
    console.error('Erreur lors de l\'envoi du message de confirmation:', error);
  }
}

// Connexion
client.login(process.env.DISCORD_TOKEN);

