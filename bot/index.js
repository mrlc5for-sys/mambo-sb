require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder } = require('discord.js');
const Database = require('../helpers/database');

const userDb = new Database('users.json', { users: {} });
const BOT_TOKEN = process.env.GATEKEEPER_TOKEN;
const CLIENT_ID = process.env.GATEKEEPER_ID;
const CLIENT_SECRET = process.env.GATEKEEPER_SECRET;
const REDIRECT_URI = process.env.GATEKEEPER_REDIRECT || 'http://localhost:3000/api/auth/callback';

if (!BOT_TOKEN || !CLIENT_ID || !CLIENT_SECRET) {
  console.log('⚠️ Gatekeeper vars missing, bot disabled.');
  process.exit(0);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.GuildMember]
});

const commands = [
  new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Verify your account to access the dashboard'),
  new SlashCommandBuilder()
    .setName('auth')
    .setDescription('Authorize a user to use prefix commands')
    .addUserOption(opt => opt.setName('user').setDescription('The user to authorize').setRequired(true))
].map(cmd => cmd.toJSON());

client.once('ready', async () => {
  const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  } catch (e) {}
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'verify') {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`;
    await interaction.reply({ content: `Click here to verify: ${url}`, ephemeral: true });
  }

  if (interaction.commandName === 'auth') {
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({ content: 'Admin only.', ephemeral: true });
    }
    const target = interaction.options.getUser('user');
    const authManager = require('../helpers/authManager');
    if (authManager.add(target.id)) {
      await interaction.reply({ content: `Authorized ${target.tag}`, ephemeral: true });
    } else {
      await interaction.reply({ content: `Already authorized.`, ephemeral: true });
    }
  }
});

client.login(BOT_TOKEN).catch(() => {});
