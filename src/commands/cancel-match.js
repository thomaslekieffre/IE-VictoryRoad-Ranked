import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('cancel-match')
    .setDescription('Annuler ton match en cours ou te retirer de la file d\'attente'),
  
  async execute(interaction, client) {
    const userId = interaction.user.id;

    // Vérifier si en file d'attente
    const inQueue = client.db.getPlayerInQueue(userId);
    if (inQueue) {
      // Retirer de la queue
      client.db.removeFromMatchmakingQueue(userId);
      
      // Nettoyer les timers/intervalles
      const timers = client.matchmakingTimers?.get(userId);
      if (timers) {
        if (timers.checkInterval) clearInterval(timers.checkInterval);
        if (timers.expandTimer) clearTimeout(timers.expandTimer);
        if (timers.maxTimer) clearTimeout(timers.maxTimer);
        client.matchmakingTimers.delete(userId);
      }
      
      return interaction.reply({
        content: '✅ Tu as été retiré de la file d\'attente.',
        ephemeral: true,
      });
    }

    // Vérifier si dans un match actif
    const activeMatch = client.db.getActiveMatchByPlayer(userId);
    if (activeMatch) {
      const player1 = client.db.getPlayer(activeMatch.player1_id);
      const player2 = client.db.getPlayer(activeMatch.player2_id);
      const opponentId = activeMatch.player1_id === userId ? activeMatch.player2_id : activeMatch.player1_id;
      const opponent = client.db.getPlayer(opponentId);

      // Supprimer le match actif
      client.db.deleteActiveMatch(activeMatch.match_id);

      // Notifier l'adversaire
      try {
        const dmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Match annulé')
          .setDescription(`<@${userId}> a annulé le match.`)
          .setColor(0xFF0000);
        await client.users.send(opponentId, { embeds: [dmEmbed] });
      } catch (error) {
        console.error('Erreur MP:', error);
      }

      // Essayer de supprimer le salon
      try {
        const channel = await client.channels.fetch(activeMatch.channel_id);
        if (channel) {
          await channel.delete('Match annulé');
        }
      } catch (error) {
        console.error('Erreur suppression salon:', error);
      }

      return interaction.reply({
        content: '✅ Match annulé. L\'adversaire a été notifié.',
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: '❌ Tu n\'es ni en file d\'attente ni dans un match actif.',
      ephemeral: true,
    });
  },
};

