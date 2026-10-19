const fs = require('fs');
const path = require('path');
const os = require('os');
const { codeblock, menu, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'cache');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function register(client) {
  client.registerCommand('util', async (c, m) => {
    await m.edit(codeblock('util', [
      'purge <n>          delete your messages',
      'purgeall <n>       delete any messages',
      'clear <n>          alias purgeall',
      'slowmode <sec>     set slowmode',
      'lock / unlock      channel lock',
      'hide / unhide      channel visibility',
      'nick @u <name>     set nickname',
      'topic <text>       channel topic',
      'role add|remove    role management',
      'dumpchat <n>       export chat',
      'specs              system info',
      'settings           current settings',
      'clearcache         wipe cache'
    ].join('\n')));
  }, { aliases: ['utilities'], category: 'util', description: 'utility menu', sticky: true });

  client.registerCommand('firstmsg', async (c, m) => {
    try {
      const msgs = await m.channel.messages.fetch({ limit: 1, after: '0' });
      const first = msgs.first();
      if (!first) return m.edit(codeblock('firstmsg', 'none found'));
      await m.edit(codeblock('firstmsg', kv([['author', first.author.tag], ['link', first.url]])));
    } catch (e) { await m.edit(codeblock('firstmsg', 'error: ' + e.message)); }
  }, { category: 'util', description: 'oldest message' });

  client.registerCommand('quote', async (c, m, args) => {
    const text = args.join(' ');
    if (!text) return m.edit(codeblock('quote', 'usage: quote <text>'));
    const url = 'https://api.popcat.xyz/quote?text=' + encodeURIComponent(text) + '&username=' + encodeURIComponent(c.user.username);
    await m.channel.send(url);
    await m.delete().catch(() => {});
  }, { category: 'util', description: 'quote image' });

  client.registerCommand('jumbo', async (c, m, args) => {
    const emoji = args[0];
    if (!emoji) return m.edit(codeblock('jumbo', 'usage: jumbo <emoji>'));
    const match = emoji.match(/<a?:\w+:(\d+)>/);
    if (!match) return m.edit(codeblock('jumbo', 'invalid custom emoji'));
    const ext = emoji.startsWith('<a:') ? 'gif' : 'png';
    await m.channel.send({ files: ['https://cdn.discordapp.com/emojis/' + match[1] + '.' + ext]}).catch(() => {});
    await m.delete().catch(() => {});
  }, { category: 'util', description: 'send emoji as image' });

  client.registerCommand('specs', async (c, m) => {
    const cpus = os.cpus();
    const total = os.totalmem() / 1073741824;
    const free = os.freemem() / 1073741824;
    const rows = [
      ['os', os.type() + ' ' + os.release()],
      ['arch', os.arch()],
      ['cpu', cpus[0] ? cpus[0].model.slice(0, 40) : 'unknown'],
      ['cores', cpus.length],
      ['memory', (total - free).toFixed(1) + ' / ' + total.toFixed(1) + ' GB'],
      ['node', process.version],
      ['uptime', Math.floor(os.uptime() / 60) + 'm'],
      ['proc', Math.floor(process.uptime() / 60) + 'm']
    ];
    await m.edit(codeblock('specs', kv(rows)));
  }, { category: 'util', description: 'system information' });

  client.registerCommand('settings', async (c, m) => {
    const rows = [
      ['prefix', c.getPrefix()],
      ['device', c.cfg.device || 'desktop'],
      ['theme', c.cfg.theme || 'purple'],
      ['cmds', c.commands.size],
      ['role', c.isOwner ? 'owner' : 'user']
    ];
    await m.edit(codeblock('settings', kv(rows)));
  }, { category: 'util', description: 'current settings' });

  client.registerCommand('clearcache', async (c, m) => {
    try {
      if (!fs.existsSync(CACHE)) { fs.mkdirSync(CACHE, { recursive: true }); return m.edit(codeblock('clearcache', 'dir created')); }
      let count = 0;
      for (const f of fs.readdirSync(CACHE)) { try { fs.unlinkSync(path.join(CACHE, f)); count++; } catch (e) {} }
      await m.edit(codeblock('clearcache', kv([['removed', count + ' files']])));
    } catch (e) { await m.edit(codeblock('clearcache', 'error: ' + e.message)); }
  }, { category: 'util', description: 'wipe cache dir' });

  client.registerCommand('purge', async (c, m, args) => {
    const n = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 100);
    let deleted = 0;
    try {
      const msgs = await m.channel.messages.fetch({ limit: n + 1 });
      for (const msg of msgs.values()) {
        if (msg.author.id !== c.user.id) continue;
        try { await msg.delete(); deleted++; await sleep(600); } catch (e) {}
      }
    } catch (e) {}
    const sent = await m.channel.send(codeblock('purge', kv([['deleted', deleted]])));
    setTimeout(() => sent.delete().catch(() => {}), 5000);
    m.delete().catch(() => {});
  }, { category: 'util', description: 'delete your messages', usage: '<n>' });

  client.registerCommand('purgeall', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('purgeall', 'server only'));
    const n = Math.min(Math.max(parseInt(args[0], 10) || 50, 1), 200);
    let deleted = 0;
    try {
      const msgs = await m.channel.messages.fetch({ limit: n });
      for (const msg of msgs.values()) {
        try { await msg.delete(); deleted++; await sleep(400); } catch (e) {}
      }
    } catch (e) {}
    const sent = await m.channel.send(codeblock('purgeall', kv([['deleted', deleted]])));
    setTimeout(() => sent.delete().catch(() => {}), 5000);
    m.delete().catch(() => {});
  }, { aliases: ['clear'], category: 'util', description: 'delete any messages', usage: '<n>' });

  client.registerCommand('lock', async (c, m) => {
    if (!m.guild) return m.edit(codeblock('lock', 'server only'));
    try {
      await m.channel.permissionOverwrites.edit(m.guild.roles.everyone, { SEND_MESSAGES: false });
      await m.edit(codeblock('lock', 'channel locked'));
    } catch (e) { await m.edit(codeblock('lock', 'error: ' + e.message)); }
  }, { category: 'util', description: 'lock channel' });

  client.registerCommand('unlock', async (c, m) => {
    if (!m.guild) return m.edit(codeblock('unlock', 'server only'));
    try {
      await m.channel.permissionOverwrites.edit(m.guild.roles.everyone, { SEND_MESSAGES: null });
      await m.edit(codeblock('unlock', 'channel unlocked'));
    } catch (e) { await m.edit(codeblock('unlock', 'error: ' + e.message)); }
  }, { category: 'util', description: 'unlock channel' });

  client.registerCommand('hide', async (c, m) => {
    if (!m.guild) return m.edit(codeblock('hide', 'server only'));
    try {
      await m.channel.permissionOverwrites.edit(m.guild.roles.everyone, { VIEW_CHANNEL: false });
      await m.edit(codeblock('hide', 'channel hidden'));
    } catch (e) { await m.edit(codeblock('hide', 'error: ' + e.message)); }
  }, { category: 'util', description: 'hide channel' });

  client.registerCommand('unhide', async (c, m) => {
    if (!m.guild) return m.edit(codeblock('unhide', 'server only'));
    try {
      await m.channel.permissionOverwrites.edit(m.guild.roles.everyone, { VIEW_CHANNEL: null });
      await m.edit(codeblock('unhide', 'channel visible'));
    } catch (e) { await m.edit(codeblock('unhide', 'error: ' + e.message)); }
  }, { category: 'util', description: 'unhide channel' });

  client.registerCommand('nick', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('nick', 'server only'));
    const t = m.mentions.members.first();
    if (!t) return m.edit(codeblock('nick', 'usage: nick @user <name>'));
    const name = args.slice(1).join(' ') || null;
    try {
      await t.setNickname(name);
      await m.edit(codeblock('nick', kv([['set', name || 'cleared']])));
    } catch (e) { await m.edit(codeblock('nick', 'error: ' + e.message)); }
  }, { category: 'util', description: 'set nickname', usage: '@user <name>' });

  client.registerCommand('topic', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('topic', 'server only'));
    const text = args.join(' ');
    try {
      await m.channel.setTopic(text);
      await m.edit(codeblock('topic', kv([['set', text || 'cleared']])));
    } catch (e) { await m.edit(codeblock('topic', 'error: ' + e.message)); }
  }, { category: 'util', description: 'set channel topic', usage: '<text>' });

  client.registerCommand('dumpchat', async (c, m, args) => {
    const n = Math.min(Math.max(parseInt(args[0], 10) || 100, 1), 500);
    try {
      const msgs = await m.channel.messages.fetch({ limit: n });
      const lines = [...msgs.values()].reverse().map(msg =>
        new Date(msg.createdTimestamp).toISOString().slice(0, 19) + ' | ' + msg.author.tag + ' | ' + (msg.content || '')
      );
      if (!fs.existsSync(CACHE)) fs.mkdirSync(CACHE, { recursive: true });
      const file = path.join(CACHE, m.channel.id + '-dump.txt');
      fs.writeFileSync(file, lines.join('\n'));
      await m.edit(codeblock('dumpchat', kv([['saved', file], ['messages', msgs.size]])));
    } catch (e) { await m.edit(codeblock('dumpchat', 'error: ' + e.message)); }
  }, { category: 'util', description: 'export chat history', usage: '<n>' });
}

module.exports = { register };
