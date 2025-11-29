import { SlashCommandBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('S\'enregistrer dans le système de ranked'),
  
  async execute(interaction, client) {
    const userId = interaction.user.id;
    const username = interaction.user.username;

    const existingPlayer = client.db.getPlayer(userId);
    if (existingPlayer) {
      return interaction.reply({
        content: '❌ Tu es déjà enregistré dans le système !',
        ephemeral: true,
      });
    }

    client.db.registerPlayer(userId, username);
    
    await interaction.reply({
      content: `✅ Bienvenue dans le système de ranked, ${username} !\n🎮 Ton ELO initial : **1000**`,
    });
  },
};

