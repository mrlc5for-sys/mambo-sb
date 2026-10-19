const fs = require('fs');
const path = require('path');
const os = require('os');
const { codeblock, menu, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

const ROOT = path.resolve(__dirname, '..');

const CATEGORIES = {
  general: 'core commands · help · ping · prefix · config',
  rpc: 'rich presence · activity · custom status',
  presence: 'custom status · rotator',
  info: 'user lookups · profiles · socials',
  util: 'purge · lock · channel tools',
  mod: 'ban · kick · warn · mute',
  fun: 'text toys · jokes · memes',
  pack: 'insult loops · multi-lang',
  voice: 'vc join · move · mute · deafen',
  music: 'play · queue · skip · stop',
  ai: 'groq · chat · personality · translate',
  apo: 'audio presets · equalizer',
  crypto: 'wallets · prices · gas',
  snipers: 'nitro · giveaway · privnote',
  image: 'achievement · discordmsg · resize',
  lookup: 'ip · github · mc · roblox · steam',
  backup: 'account · friends · guilds export',
  trackers: 'snipe · history · keyword alerts',
  beefy: 'nuke · raid · mass actions',
  owner: 'eval · restart · status control'
};

function fmtUptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const mi = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [d && `${d}d`, h && `${h}h`, mi && `${mi}m`, `${s}s`].filter(Boolean).join(' ');
}

function register(client) {
  client.registerCommand('help', async (c, m, args) => {
    const section = args[0]?.toLowerCase();
    const webhookEngine = require('../helpers/webhookEngine');
    const emoji = require('../helpers/emojiManager');
    
    if (section === 'death') {
      const fields = [
        { name: emoji.get('ban', '☠️') + ' NUKES', value: '`nuke yes` `banall yes` `kickall yes`', inline: false },
        { name: emoji.get('tools', '🛠️') + ' RAIDERS', value: '`spam` `massping` `webhookspam`', inline: false },
        { name: emoji.get('gear', '⚙️') + ' FLOODERS', value: '`channelflood` `pack` `ap`', inline: false },
        { name: emoji.get('star', '⭐') + ' PROXIES', value: '`proxyscrape` `proxyclean`', inline: false }
      ];
      const sent = await webhookEngine.sendMenu(c, m.channel.id, 'DEATH MODULE', 'Raid and nuke commands.', fields, c.dashUser);
      if (sent) await m.delete().catch(() => {});
      else await m.edit(codeblock('death', 'webhook failed. missing permissions?'));
      return;
    }

    const fields = [
      { name: emoji.get('house', '🏠') + ' MAIN', value: '`help` `ping` `uptime` `prefix` `settings`', inline: false },
      { name: emoji.get('rpc', '📡') + ' RPC & PRESENCE', value: '`rpc` `rpcpresets` `rpcstack` `rpctext` `cstatus`', inline: false },
      { name: emoji.get('death', '💀') + ' DEATH', value: '`death`', inline: false },
      { name: emoji.get('mod', '🔨') + ' MODERATION', value: '`ban` `kick` `mute` `warn` `antinuke`', inline: false },
      { name: emoji.get('quest', '⚔️') + ' QUESTS', value: '`quest` `quest-run` `quest-claim`', inline: false },
      { name: emoji.get('fun', '⭐') + ' FUN', value: '`r` `sr` `ghostping` `mock`', inline: false },
      { name: emoji.get('tools', '⚙️') + ' UTILITIES', value: '`purge` `lock` `nick` `dumpchat`', inline: false },
      { name: emoji.get('info', '👤') + ' INFO', value: '`userid` `avatar` `banner` `mc` `ip`', inline: false },
      { name: emoji.get('voice', '🔊') + ' VOICE', value: '`join` `leave` `vcmove` `vcspy`', inline: false },
      { name: emoji.get('wallet', '💰') + ' WALLET', value: '`wallet` `upi`', inline: false },
      { name: emoji.get('owner', '👑') + ' OWNER', value: '`eval` `exec` `auth`', inline: false }
    ];
    
    const sent = await webhookEngine.sendMenu(c, m.channel.id, 'MAMBO SELF-BOT', 'Select a category or run `help <category>`', fields, c.dashUser);
    if (sent) await m.delete().catch(() => {});
    else await m.edit(codeblock('help', 'webhook failed. missing permissions?'));
  }, { aliases: ['h', '?', 'commands'], category: 'general', description: 'help menu', sticky: true });

  client.registerCommand('ping', async (c, m) => {
    const ws = Math.round(c.ws.ping);
    const t0 = Date.now();
    const sent = await m.edit(codeblock('ping', kv([['ws', ws + ' ms']])));
    const rtt = Date.now() - t0;
    await sent.edit(codeblock('ping', kv([['ws', ws + ' ms'], ['rtt', rtt + ' ms']])));
  }, { aliases: ['latency'], category: 'general', description: 'check latency', sticky: true });

  client.registerCommand('uptime', async (c, m) => {
    const sec = Math.floor((Date.now() - c.startTime) / 1000);
    const rows = [
      ['session', fmtUptime(sec)],
      ['process', fmtUptime(Math.floor(process.uptime()))],
      ['system', fmtUptime(Math.floor(os.uptime()))]
    ];
    await m.edit(codeblock('uptime', kv(rows)));
  }, { category: 'general', description: 'session uptime' });

  client.registerCommand('tokeninfo', async (c, m) => {
    const rows = [
      ['tag', c.user.tag],
      ['id', c.user.id],
      ['device', c.cfg.device || 'desktop'],
      ['prefix', c.getPrefix()],
      ['role', c.isOwner ? 'owner' : 'user'],
      ['cmds', c.commands.size]
    ];
    await m.edit(codeblock('identity', kv(rows)));
  }, { aliases: ['whoami', 'me'], category: 'general', description: 'show identity' });

  client.registerCommand('prefix', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!args[0]) return m.edit(codeblock('prefix', kv([['current', c.getPrefix()]])));
    if (args[0].length > 3) return m.edit(codeblock('prefix', 'max 3 characters'));
    c.cfg.prefix = args[0];
    fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2));
    await m.edit(codeblock('prefix', kv([['set', args[0]]])));
  }, { category: 'general', description: 'change prefix', gate: 'owner' });

  client.registerCommand('config', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!args[0]) {
      const safe = { ...c.cfg };
      return m.edit('> ```json\n> ' + JSON.stringify(safe, null, 2).split('\n').slice(0, 40).join('\n> ') + '\n> ```');
    }
    const key = args[0];
    const value = args.slice(1).join(' ');
    if (!value) {
      const v = key.split('.').reduce((o, k) => (o == null ? o : o[k]), c.cfg);
      return m.edit(codeblock('config', kv([[key, String(v)]])));
    }
    let parsed = value;
    if (value === 'true') parsed = true;
    else if (value === 'false') parsed = false;
    else if (/^-?\d+$/.test(value)) parsed = parseInt(value, 10);
    const parts = key.split('.');
    let cur = c.cfg;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = parsed;
    fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2));
    await m.edit(codeblock('config', kv([[key, String(parsed)]])));
  }, { aliases: ['cfg'], category: 'general', description: 'view or edit config', gate: 'owner' });

  client.registerCommand('device', async (c, m, args) => {
    const devices = ['desktop', 'mobile', 'vr', 'xbox', 'web'];
    const which = (args[0] || '').toLowerCase();
    if (!which || which === 'status') return m.edit(codeblock('device', kv([['current', c.cfg.device || 'desktop']])));
    if (!devices.includes(which)) return m.edit(codeblock('device', 'valid: ' + devices.join(' · ')));
    c.cfg.device = which;
    fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2));
    await m.edit(codeblock('device', kv([['set', which], ['note', 'reconnect to apply']])));
  }, { aliases: ['spoof'], category: 'general', description: 'spoof client device' });

  client.registerCommand('reload', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    const cogsDir = path.join(ROOT, 'cogs');
    const target = args[0];
    const files = target ? [target.endsWith('.js') ? target : target + '.js'] : fs.readdirSync(cogsDir).filter(f => f.endsWith('.js'));
    let loaded = 0;
    const failed = [];
    for (const file of files) {
      const full = path.join(cogsDir, file);
      if (!fs.existsSync(full)) { failed.push(file); continue; }
      try {
        delete require.cache[require.resolve(full)];
        const cog = require(full);
        if (typeof cog.register === 'function') cog.register(c);
        loaded++;
      } catch (e) { failed.push(file + ': ' + e.message); }
    }
    const body = [`loaded ${loaded} cog(s)`];
    if (failed.length) body.push('failed: ' + failed.join(' · '));
    await m.edit(codeblock('reload', body.join('\n')));
  }, { aliases: ['rl'], category: 'general', description: 'reload cogs', gate: 'owner' });
}

module.exports = { register, CATEGORIES };
