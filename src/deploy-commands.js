import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Vérifier les variables d'environnement
if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant dans le fichier .env');
  process.exit(1);
}

const commands = [];
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = await import(`file://${filePath}`);
  if (command.default?.data) {
    commands.push(command.default.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 Enregistrement de ${commands.length} commandes...`);

    let clientId = process.env.DISCORD_CLIENT_ID;
    
    // Si pas de CLIENT_ID, on le récupère depuis le token
    if (!clientId) {
      console.log('📡 Récupération du Client ID depuis le token...');
      const app = await rest.get(Routes.oauth2Application());
      clientId = app.id;
      console.log(`✅ Client ID trouvé: ${clientId}`);
    }

    // Déployer globalement ou sur un serveur spécifique
    let data;
    if (process.env.GUILD_ID) {
      console.log(`📤 Déploiement sur le serveur ${process.env.GUILD_ID}...`);
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, process.env.GUILD_ID),
        { body: commands },
      );
    } else {
      console.log('📤 Déploiement global (peut prendre jusqu\'à 1h pour apparaître)...');
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
    }

    console.log(`✅ ${data.length} commandes enregistrées avec succès !`);
  } catch (error) {
    if (error.code === 10002) {
      console.error('❌ Erreur: Application inconnue');
      console.error('💡 Vérifie que:');
      console.error('   1. Le DISCORD_TOKEN est correct dans ton .env');
      console.error('   2. Le bot est bien invité sur le serveur (si tu utilises GUILD_ID)');
      console.error('   3. Le DISCORD_CLIENT_ID correspond bien à ton application Discord');
      console.error('\n💡 Pour trouver ton Client ID:');
      console.error('   https://discord.com/developers/applications → Ton app → General → Application ID');
    } else if (error.code === 50001) {
      console.error('❌ Erreur: Accès manquant');
      console.error('💡 Le bot n\'a pas les permissions nécessaires sur ce serveur');
    } else {
      console.error('❌ Erreur lors de l\'enregistrement des commandes:', error.message);
      if (error.code) console.error(`   Code: ${error.code}`);
    }
    process.exit(1);
  }
})();

