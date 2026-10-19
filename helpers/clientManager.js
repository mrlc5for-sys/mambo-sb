const { Client } = require('discord.js-selfbot-v13');
const Database = require('./database');
const eventBus = require('./eventBus');

const db = new Database('hosted_tokens.json', { tokens: [] });
const activeClients = new Map();

async function startClient(token, ownerId, cogs) {
  if (activeClients.has(token)) return { ok: false, reason: 'Already running' };

  const client = new Client({ checkUpdate: false, patchVoice: true });
  client.cfg = { prefix: '$', device: 'desktop', rpc: {} };
  client.commands = new Map();
  client.isOwner = false;
  client.startTime = Date.now();
  client.dashUser = ownerId;
  client.dashRole = 'user';
  client.tokenStr = token;

  client.registerCommand = function(name, handler, opts) {
    opts = opts || {};
    this.commands.set(name.toLowerCase(), { name, handler, category: opts.category || 'general', description: opts.description || '', aliases: opts.aliases || [], sticky: opts.sticky || false });
  };

  client.getPrefix = function() { return this.cfg.prefix || '$'; };

  for (const cog of cogs) {
    try {
      if (cog.name === 'owner') cog.module.register(client, [client]);
      else cog.module.register(client);
    } catch (e) {}
  }

  client.on('messageCreate', async (message) => {
    if (!client.user || message.author.id !== client.user.id) return;
    const prefix = client.getPrefix();
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();
    const entry = client.commands.get(cmd);
    
    if (entry) {
      try {
        await entry.handler(client, message, args);
        if (!entry.sticky) setTimeout(() => message.delete().catch(() => {}), 15000);
      } catch (e) {
        message.edit(`> \`\`\`\n> error: ${e.message}\n> \`\`\``).catch(() => {});
      }
    }
  });

  try {
    await client.login(token);
    activeClients.set(token, { client, ownerId });
    eventBus.emit('client.started', { ownerId, token });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function stopClient(token) {
  if (!activeClients.has(token)) return false;
  const { client, ownerId } = activeClients.get(token);
  try { client.destroy(); } catch (e) {}
  activeClients.delete(token);
  eventBus.emit('client.stopped', { ownerId, token });
  return true;
}

function getActiveTokens(ownerId) {
  const list = [];
  for (const [token, data] of activeClients.entries()) {
    if (data.ownerId === ownerId) {
      list.push({ token: token.slice(0, 10) + '...', fullToken: token, uptime: Date.now() - data.client.startTime });
    }
  }
  return list;
}

module.exports = { startClient, stopClient, getActiveTokens, activeClients };
