import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export default {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Voir ton historique de matchs récents')
    .addUserOption(option =>
      option
        .setName('joueur')
        .setDescription('Joueur dont tu veux voir l\'historique (optionnel)')
    )
    .addIntegerOption(option =>
      option
        .setName('limite')
        .setDescription('Nombre de matchs à afficher (défaut: 10)')
        .setMinValue(1)
        .setMaxValue(20)
    ),
  
  async execute(interaction, client) {
    const targetUser = interaction.options.getUser('joueur') || interaction.user;
    const limit = interaction.options.getInteger('limite') || 10;
    const player = client.db.getPlayer(targetUser.id);

    if (!player) {
      return interaction.reply({
        content: targetUser.id === interaction.user.id 
          ? '❌ Tu n\'es pas enregistré. Utilise `/register` pour t\'inscrire.'
          : '❌ Ce joueur n\'est pas enregistré.',
        ephemeral: true,
      });
    }

    const allMatches = client.db.getPlayerMatches(targetUser.id, limit * 2);
    
    // Filtrer uniquement les matchs complétés avec des scores valides
    const matches = allMatches.filter(match => 
      match.status === 'completed' && 
      match.player1_score !== null && 
      match.player2_score !== null
    ).slice(0, limit);

    if (matches.length === 0) {
      return interaction.reply({
        content: '❌ Aucun match complété enregistré pour le moment.',
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`📜 Historique de ${player.username}`)
      .setColor(0x5865F2)
      .setDescription(
        matches.map((match, index) => {
          const isPlayer1 = match.player1_id === targetUser.id;
          const opponentId = isPlayer1 ? match.player2_id : match.player1_id;
          const opponent = client.db.getPlayer(opponentId);
          const myScore = isPlayer1 ? match.player1_score : match.player2_score;
          const opponentScore = isPlayer1 ? match.player2_score : match.player1_score;
          
          // Déterminer le résultat
          let result = '';
          if (match.winner_id === targetUser.id) {
            result = '✅ Victoire';
          } else if (match.winner_id === opponentId) {
            result = '❌ Défaite';
          } else if (match.winner_id === null || match.winner_id === '') {
            result = '🤝 Nul';
          } else {
            result = '🤝 Nul';
          }

          const date = new Date(match.created_at);
          const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

          return `${index + 1}. ${result} | **${myScore}** - ${opponentScore} vs ${opponent?.username || 'Inconnu'} | ${dateStr}`;
        }).join('\n')
      )
      .setFooter({ text: `Affichage des ${matches.length} derniers matchs` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

