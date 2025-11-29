// Système de rôles automatiques selon l'ELO

export function getEloRole(elo) {
  if (elo >= 1800) return 'Diamond';
  if (elo >= 1600) return 'Platinum';
  if (elo >= 1400) return 'Gold';
  if (elo >= 1200) return 'Silver';
  if (elo >= 1000) return 'Bronze';
  return 'Iron';
}

export async function updatePlayerRole(client, userId, newElo) {
  const guildId = process.env.GUILD_ID;
  if (!guildId) return;

  try {
    const guild = await client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    const newRoleName = getEloRole(newElo);
    
    // Rôles à retirer (tous les rôles ELO)
    const eloRoles = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    const rolesToRemove = member.roles.cache.filter(role => 
      eloRoles.includes(role.name)
    );

    // Détecter si c'est un nouveau grade
    const hadRole = rolesToRemove.size > 0;
    const oldRoleName = hadRole ? rolesToRemove.first().name : null;
    const isNewGrade = !hadRole || oldRoleName !== newRoleName;

    // Retirer les anciens rôles
    if (rolesToRemove.size > 0) {
      await member.roles.remove(rolesToRemove, 'Mise à jour ELO automatique');
    }

    // Ajouter le nouveau rôle
    const newRole = guild.roles.cache.find(role => role.name === newRoleName);
    if (newRole && !member.roles.cache.has(newRole.id)) {
      await member.roles.add(newRole, 'Mise à jour ELO automatique');
      
      // Envoyer une notification si nouveau grade
      if (isNewGrade && oldRoleName) {
        try {
          const { EmbedBuilder } = await import('discord.js');
          const gradeEmojis = {
            'Iron': '⚫',
            'Bronze': '🟤',
            'Silver': '⚪',
            'Gold': '🟡',
            'Platinum': '🔵',
            'Diamond': '💎'
          };
          
          const milestoneEmbed = new EmbedBuilder()
            .setTitle('🎉 Nouveau grade atteint !')
            .setDescription(`Félicitations ! Tu as atteint le grade **${newRoleName}** !`)
            .addFields(
              { name: 'Ancien grade', value: oldRoleName, inline: true },
              { name: 'Nouveau grade', value: `${gradeEmojis[newRoleName] || '🏅'} ${newRoleName}`, inline: true },
              { name: 'ELO', value: newElo.toString(), inline: true }
            )
            .setColor(0xFFD700)
            .setTimestamp();
          
          await client.users.send(userId, { embeds: [milestoneEmbed] });
        } catch (error) {
          console.error('Erreur notification milestone:', error);
        }
      }
    }
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du rôle pour ${userId}:`, error);
  }
}

