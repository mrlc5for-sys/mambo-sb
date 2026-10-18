const fs = require('fs');
const path = require('path');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const WARN_FILE = path.join(DATA, 'warnings.json');

function readJson(f, def) {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def; }
  catch (e) { return def; }
}

function writeJson(f, data) {
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2)); } catch (e) {}
}

function parseDuration(str) {
  if (!str) return null;
  const m = str.match(/^(\d+)(s|m|h|d)$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return n * mult[m[2].toLowerCase()];
}

function register(client) {
  client.registerCommand('mod', async (c, m) => {
    await m.edit(codeblock('mod', [
      'ban @user [reason]         ban',
      'unban <id> [reason]        unban',
      'kick @user [reason]        kick',
      'mute @user <dur> [reason]  timeout',
      'unmute @user               remove timeout',
      'warn @user [reason]        add warning',
      'warnings @user             list warnings',
      'clearwarn @user            clear warnings',
      'banlist                    list bans'
    ].join('\n')));
  }, { aliases: ['moderation'], category: 'mod', description: 'moderation menu', sticky: true });

  client.registerCommand('ban', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('ban', 'server only'));
    const target = m.mentions.members.first();
    if (!target) return m.edit(codeblock('ban', 'usage: ban @user [reason]'));
    const reason = args.slice(1).join(' ') || 'no reason';
    try {
      await m.guild.members.ban(target.id, { reason });
      await m.edit(codeblock('ban', kv([['user', target.user.tag], ['reason', reason]])));
    } catch (e) { await m.edit(codeblock('ban', 'error: ' + e.message)); }
  }, { category: 'mod', description: 'ban member' });

  client.registerCommand('unban', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('unban', 'server only'));
    const id = (args[0] || '').replace(/[<@!>]/g, '');
    if (!id) return m.edit(codeblock('unban', 'usage: unban <user_id>'));
    try {
      await m.guild.members.unban(id, args.slice(1).join(' ') || 'no reason');
      await m.edit(codeblock('unban', kv([['id', id]])));
    } catch (e) { await m.edit(codeblock('unban', 'error: ' + e.message)); }
  }, { category: 'mod', description: 'unban user' });

  client.registerCommand('kick', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('kick', 'server only'));
    const target = m.mentions.members.first();
    if (!target) return m.edit(codeblock('kick', 'usage: kick @user [reason]'));
    const reason = args.slice(1).join(' ') || 'no reason';
    try {
      await target.kick(reason);
      await m.edit(codeblock('kick', kv([['user', target.user.tag], ['reason', reason]])));
    } catch (e) { await m.edit(codeblock('kick', 'error: ' + e.message)); }
  }, { category: 'mod', description: 'kick member' });

  client.registerCommand('mute', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('mute', 'server only'));
    const target = m.mentions.members.first();
    const dur = args[1];
    if (!target || !dur) return m.edit(codeblock('mute', 'usage: mute @user <30s|5m|1h|1d>'));
    const ms = parseDuration(dur);
    if (!ms) return m.edit(codeblock('mute', 'invalid duration'));
    try {
      await target.timeout(ms, args.slice(2).join(' ') || 'no reason');
      await m.edit(codeblock('mute', kv([['user', target.user.tag], ['duration', dur]])));
    } catch (e) { await m.edit(codeblock('mute', 'error: ' + e.message)); }
  }, { aliases: ['timeout'], category: 'mod', description: 'timeout user' });

  client.registerCommand('unmute', async (c, m) => {
    if (!m.guild) return m.edit(codeblock('unmute', 'server only'));
    const target = m.mentions.members.first();
    if (!target) return m.edit(codeblock('unmute', 'usage: unmute @user'));
    try {
      await target.timeout(null);
      await m.edit(codeblock('unmute', kv([['user', target.user.tag]])));
    } catch (e) { await m.edit(codeblock('unmute', 'error: ' + e.message)); }
  }, { aliases: ['untimeout'], category: 'mod', description: 'remove timeout' });

  client.registerCommand('warn', async (c, m, args) => {
    const target = m.mentions.users.first();
    if (!target) return m.edit(codeblock('warn', 'usage: warn @user [reason]'));
    const reason = args.slice(1).join(' ') || 'no reason';
    const data = readJson(WARN_FILE, {});
    if (!data[target.id]) data[target.id] = [];
    data[target.id].push({ reason, at: Date.now(), by: c.user.id });
    writeJson(WARN_FILE, data);
    await m.edit(codeblock('warn', kv([['user', target.tag], ['reason', reason], ['total', data[target.id].length]])));
  }, { category: 'mod', description: 'add warning' });

  client.registerCommand('warnings', async (c, m) => {
    const target = m.mentions.users.first();
    if (!target) return m.edit(codeblock('warnings', 'usage: warnings @user'));
    const data = readJson(WARN_FILE, {});
    const list = data[target.id] || [];
    if (!list.length) return m.edit(codeblock('warnings', 'no warnings'));
    const body = list.map((w, i) => (i + 1) + '. ' + new Date(w.at).toISOString().slice(0, 10) + ' · ' + w.reason);
    await m.edit(codeblock('warnings · ' + target.tag, body.join('\n')));
  }, { category: 'mod', description: 'list warnings' });

  client.registerCommand('clearwarn', async (c, m) => {
    const target = m.mentions.users.first();
    if (!target) return m.edit(codeblock('clearwarn', 'usage: clearwarn @user'));
    const data = readJson(WARN_FILE, {});
    delete data[target.id];
    writeJson(WARN_FILE, data);
    await m.edit(codeblock('clearwarn', kv([['user', target.tag]])));
  }, { category: 'mod', description: 'clear warnings' });

  client.registerCommand('banlist', async (c, m) => {
    if (!m.guild) return m.edit(codeblock('banlist', 'server only'));
    try {
      const bans = await m.guild.bans.fetch();
      if (!bans.size) return m.edit(codeblock('banlist', 'no bans'));
      const body = [...bans.values()].slice(0, 30).map(b => b.user.tag + '  ·  ' + b.user.id);
      await m.edit(codeblock('banlist · ' + bans.size, body.join('\n')));
    } catch (e) { await m.edit(codeblock('banlist', 'error: ' + e.message)); }
  }, { category: 'mod', description: 'list bans' });
}

module.exports = { register };
