require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('discord.js-selfbot-v13');
const logger = require('./helpers/logger');
const dashboard = require('./dash/server');
const users = require('./helpers/users');

const generalCog = require('./cogs/general');
const presenceCog = require('./cogs/presence');
const rpcCog = require('./cogs/rpc');
const infoCog = require('./cogs/info');
const utilCog = require('./cogs/util');
const funCog = require('./cogs/fun');
const ownerCog = require('./cogs/owner');
const voiceCog = require('./cogs/voice');
const aiCog = require('./cogs/ai');
const modCog = require('./cogs/mod');
const musicCog = require('./cogs/music');
const imageCog = require('./cogs/image');
const beefyCog = require('./cogs/beefy');
const trackersCog = require('./cogs/trackers');
const apoCog = require('./cogs/apo');
const cryptoCog = require('./cogs/crypto');
const snipersCog = require('./cogs/snipers');
const lookupCog = require('./cogs/lookup');
const backupCog = require('./cogs/backup');
const questCog = require('./cogs/quest');

global.__BOT_START__ = Date.now();

const COGS = [
  ['general', generalCog], ['presence', presenceCog], ['rpc', rpcCog],
  ['info', infoCog], ['util', utilCog],
  ['fun', funCog], ['owner', ownerCog], ['voice', voiceCog],
  ['ai', aiCog], ['mod', modCog], ['music', musicCog],
  ['image', imageCog], ['beefy', beefyCog], ['trackers', trackersCog],
  ['apo', apoCog], ['crypto', cryptoCog], ['snipers', snipersCog],
  ['lookup', lookupCog], ['backup', backupCog], ['quest', questCog]
];

const configPath = path.join(__dirname, 'config.json');
if (!fs.existsSync(configPath)) { console.error('config.json missing'); process.exit(1); }
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const adminToken = process.env.DISCORD_TOKEN;
if (!adminToken) { logger.error('No DISCORD_TOKEN in .env'); process.exit(1); }

const allClients = [];

function uidFromToken(token) {
  try { return Buffer.from(token.split('.')[0], 'base64').toString(); }
  catch (e) { return 'unknown'; }
}

function buildClient(token, opts) {
  opts = opts || {};
  const client = new Client({ checkUpdate: false });
  client.cfg = opts.cfg || JSON.parse(JSON.stringify(config));
  client.commands = new Map();
  client.isOwner = opts.isOwner || false;
  client.startTime = Date.now();
  client.dashUser = opts.dashUser || null;
  client.dashRole = opts.dashRole || 'user';
  client.uid = uidFromToken(token);

  client.registerCommand = function(name, handler, cmdOpts) {
    cmdOpts = cmdOpts || {};
    this.commands.set(name.toLowerCase(), {
      name: name,
      handler: handler,
      aliases: cmdOpts.aliases || [],
      category: cmdOpts.category || 'general',
      description: cmdOpts.description || '',
      usage: cmdOpts.usage || '',
      gate: cmdOpts.gate || null,
      sticky: cmdOpts.sticky || false
    });
  };

  client.getPrefix = function() { return this.cfg.prefix || '$'; };

  for (const [name, cog] of COGS) {
    try {
      if (name === 'owner') cog.register(client, allClients);
      else cog.register(client);
    } catch (e) { logger.error('cog ' + name + ': ' + e.message); }
  }

  client.on('messageCreate', async (message) => {
    if (!client.user || !message.author) return;
    const adminId = process.env.ADMIN_ID;
    const isAdmin = adminId && message.author.id === adminId;
    const isSelf = message.author.id === client.user.id;
    if (!isSelf && !isAdmin) return;
    const prefix = client.getPrefix();
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = (args.shift() || '').toLowerCase();
    if (!cmd) return;

    let entry = client.commands.get(cmd);
    if (!entry) {
      for (const e of client.commands.values()) {
        if (e.aliases.includes(cmd)) { entry = e; break; }
      }
    }
    if (!entry) return;

    logger.cmd('[' + (client.dashUser || client.user.username) + '] ' + message.content);
    const sticky = entry.sticky || entry.category === 'beefy';

    try {
      await entry.handler(client, message, args);
      if (!sticky && isSelf) {
        const delay = (client.cfg.auto_delete_delay || 15) * 1000;
        setTimeout(() => message.delete().catch(() => {}), delay);
      }
    } catch (e) {
      logger.error(entry.name + ': ' + e.message);
      message.edit('> ```\n> error: ' + e.message + '\n> ```').catch(() => {});
      if (isSelf) setTimeout(() => message.delete().catch(() => {}), 15000);
    }
  });

  return client;
}

async function bootClient(token, opts) {
  const client = buildClient(token, opts);
  try {
    await client.login(token);
    return client;
  } catch (e) {
    logger.error('login failed (' + (opts.dashUser || token.slice(0, 8)) + '): ' + e.message);
    return null;
  }
}

function readTokensFile() {
  const p = path.join(__dirname, 'tokens.txt');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
}

async function bootNewUser(user) {
  const cfg = JSON.parse(JSON.stringify(config));
  cfg.prefix = user.prefix || config.prefix;
  const c = await bootClient(user.token, {
    isOwner: false,
    dashUser: user.username,
    dashRole: user.role || 'user',
    cfg: cfg
  });
  if (c) { allClients.push(c); logger.ok('new client: ' + c.user.tag + ' (' + user.username + ')'); }
  return c;
}

async function main() {
  logger.info('booting admin client');
  const adminCfg = JSON.parse(JSON.stringify(config));
  const adminClient = await bootClient(adminToken, {
    isOwner: true,
    dashUser: 'admin',
    dashRole: 'admin',
    cfg: adminCfg
  });
  if (!adminClient) { logger.error('admin login failed'); process.exit(1); }
  allClients.push(adminClient);
  logger.ok('admin ready: ' + adminClient.user.tag);

  const userList = users.all();
  logger.info('booting ' + userList.length + ' user client(s) from users.json');
  for (const u of userList) {
    if (!u.token) continue;
    const cfg = JSON.parse(JSON.stringify(config));
    cfg.prefix = u.prefix || config.prefix;
    const c = await bootClient(u.token, {
      isOwner: false,
      dashUser: u.username,
      dashRole: u.role || 'user',
      cfg: cfg
    });
    if (c) { allClients.push(c); logger.ok('user ready: ' + c.user.tag + ' (' + u.username + ')'); }
  }

  const tokenFile = readTokensFile();
  logger.info('booting ' + tokenFile.length + ' client(s) from tokens.txt');
  for (let i = 0; i < tokenFile.length; i++) {
    const token = tokenFile[i];
    const uid = uidFromToken(token);
    const existing = users.all().find(u => u.token === token);
    if (existing) continue;
    const dashUser = 'token_' + (i + 1) + '_' + uid.slice(-4);
    const cfg = JSON.parse(JSON.stringify(config));
    const c = await bootClient(token, {
      isOwner: false,
      dashUser: dashUser,
      dashRole: 'user',
      cfg: cfg
    });
    if (c) { allClients.push(c); logger.ok('token client ready: ' + c.user.tag + ' (' + dashUser + ')'); }
  }

  logger.ok('total clients online: ' + allClients.length);
  dashboard.start(allClients, { addUser: bootNewUser });
}

process.on('unhandledRejection', r => logger.error('[unhandled] ' + (r && r.message ? r.message : r)));
process.on('uncaughtException', e => logger.error('[uncaught] ' + (e && e.message ? e.message : e)));

main().catch(e => { logger.error('fatal: ' + e.message); process.exit(1); });
