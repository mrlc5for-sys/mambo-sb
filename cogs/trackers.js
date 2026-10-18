const fs = require('fs');
const path = require('path');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const HISTORY_FILE = path.join(DATA, 'history.json');
const KW_FILE = path.join(DATA, 'keywords.json');

const snipes = new Map();
const esnipes = new Map();
const rsnipes = new Map();
const msgCache = new Map();
const kwAlerts = new Map();

function readJson(f, def) {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def; }
  catch (e) { return def; }
}

function writeJson(f, data) {
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2)); } catch (e) {}
}

function trackUser(user) {
  if (!user || !user.id) return;
  const h = readJson(HISTORY_FILE, {});
  const now = Date.now();
  const name = user.username + (user.discriminator && user.discriminator !== '0' ? '#' + user.discriminator : '');
  if (!h[user.id]) h[user.id] = { usernames: [], displayNames: [], firstSeen: now, lastSeen: now };
  h[user.id].lastSeen = now;
  if (!h[user.id].usernames.length || h[user.id].usernames[0].value !== name) {
    h[user.id].usernames.unshift({ value: name, date: now });
  }
  if (user.globalName && (!h[user.id].displayNames.length || h[user.id].displayNames[0].value !== user.globalName)) {
    h[user.id].displayNames.unshift({ value: user.globalName, date: now });
  }
  writeJson(HISTORY_FILE, h);
}

function registerEvents(client) {
  client.on('messageCreate', message => {
    if (!message || !message.channel) return;
    if (message.author && !message.author.bot) trackUser(message.author);
    if (message.guild && message.channel) {
      const cache = msgCache.get(message.channel.id) || new Map();
      cache.set(message.id, { content: message.content || '', author: message.author ? { id: message.author.id, tag: message.author.tag || message.author.username } : null, date: Date.now() });
      if (cache.size > 200) cache.delete(cache.keys().next().value);
      msgCache.set(message.channel.id, cache);
    }
    const kws = readJson(KW_FILE, {});
    if (message.content) {
      const lower = message.content.toLowerCase();
      for (const kw of Object.keys(kws)) {
        if (lower.includes(kw.toLowerCase())) {
          const arr = kwAlerts.get(kw) || [];
          arr.unshift({ author: message.author ? message.author.tag : 'unknown', content: message.content.slice(0, 200), date: Date.now() });
          if (arr.length > 50) arr.length = 50;
          kwAlerts.set(kw, arr);
        }
      }
    }
  });

  client.on('messageDelete', message => {
    if (!message || (message.author && message.author.id === client.user.id)) return;
    const cache = msgCache.get(message.channel ? message.channel.id : '');
    const cached = cache ? cache.get(message.id) : null;
    const arr = snipes.get(message.channel ? message.channel.id : 'unknown') || [];
    arr.unshift({
      id: message.id,
      content: cached ? cached.content : (message.content || ''),
      author: cached && cached.author ? cached.author : (message.author ? { tag: message.author.tag || message.author.username } : { tag: 'unknown' }),
      date: Date.now()
    });
    if (arr.length > 15) arr.length = 15;
    snipes.set(message.channel ? message.channel.id : 'unknown', arr);
  });

  client.on('messageUpdate', (oldMsg, newMsg) => {
    if (!oldMsg || !oldMsg.author || oldMsg.author.bot || oldMsg.content === newMsg.content) return;
    const arr = esnipes.get(oldMsg.channel.id) || [];
    arr.unshift({ before: oldMsg.content, after: newMsg.content, author: oldMsg.author.tag, date: Date.now() });
    if (arr.length > 15) arr.length = 15;
    esnipes.set(oldMsg.channel.id, arr);
  });

  client.on('messageReactionRemove', (reaction, user) => {
    if (!reaction || !reaction.message || (user && user.bot)) return;
    const arr = rsnipes.get(reaction.message.channel.id) || [];
    arr.unshift({ emoji: reaction.emoji.toString(), content: (reaction.message.content || '').slice(0, 100), author: user.tag, date: Date.now() });
    if (arr.length > 15) arr.length = 15;
    rsnipes.set(reaction.message.channel.id, arr);
  });
}

function register(client) {
  registerEvents(client);

  client.registerCommand('trackers', async (c, m) => {
    await m.edit(codeblock('trackers', [
      'snipe [n]        deleted messages',
      'esnipe [n]       edited messages',
      'rsnipe [n]       removed reactions',
      'history [@user]  name/avatar timeline',
      'keyword add <w>  alert on word',
      'keyword list     list keywords',
      'keyword view <w> show alerts',
      'keyword remove   remove keyword'
    ].join('\n')));
  }, { category: 'trackers', description: 'trackers menu', sticky: true });

  client.registerCommand('snipe', async (c, m, args) => {
    const n = parseInt(args[0], 10) || 1;
    const arr = snipes.get(m.channel.id) || [];
    if (!arr.length) return m.edit(codeblock('snipe', 'no deleted messages'));
    await m.edit(codeblock('snipe', arr.slice(0, n).map((s, i) => '#' + (i + 1) + '  ' + s.author.tag + '\n     ' + (s.content || '(no text)').slice(0, 150)).join('\n')));
  }, { category: 'trackers', description: 'deleted messages' });

  client.registerCommand('esnipe', async (c, m, args) => {
    const n = parseInt(args[0], 10) || 1;
    const arr = esnipes.get(m.channel.id) || [];
    if (!arr.length) return m.edit(codeblock('esnipe', 'no edited messages'));
    await m.edit(codeblock('esnipe', arr.slice(0, n).map((s, i) => '#' + (i + 1) + '  ' + s.author + '\n     ' + s.before.slice(0, 80) + ' → ' + s.after.slice(0, 80)).join('\n')));
  }, { category: 'trackers', description: 'edited messages' });

  client.registerCommand('rsnipe', async (c, m, args) => {
    const n = parseInt(args[0], 10) || 1;
    const arr = rsnipes.get(m.channel.id) || [];
    if (!arr.length) return m.edit(codeblock('rsnipe', 'no removed reactions'));
    await m.edit(codeblock('rsnipe', arr.slice(0, n).map((s, i) => '#' + (i + 1) + '  ' + s.author + ' removed ' + s.emoji).join('\n')));
  }, { category: 'trackers', description: 'removed reactions' });

  client.registerCommand('history', async (c, m) => {
    const target = m.mentions.users.first() || c.user;
    const h = readJson(HISTORY_FILE, {})[target.id];
    if (!h) return m.edit(codeblock('history', 'no data'));
    const lines = ['id: ' + target.id, 'first: ' + new Date(h.firstSeen).toISOString().slice(0, 10), 'last: ' + new Date(h.lastSeen).toISOString().slice(0, 10), '', '[ usernames ]'];
    (h.usernames || []).slice(0, 5).forEach(e => lines.push('  ' + e.value + ' (' + new Date(e.date).toISOString().slice(0, 10) + ')'));
    if (h.displayNames && h.displayNames.length) {
      lines.push('', '[ display names ]');
      h.displayNames.slice(0, 5).forEach(e => lines.push('  ' + e.value));
    }
    await m.edit(codeblock('history · ' + target.username, lines.join('\n')));
  }, { category: 'trackers', description: 'name timeline' });

  client.registerCommand('keyword', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    const kws = readJson(KW_FILE, {});
    if (sub === 'add') {
      const word = args.slice(1).join(' ');
      if (!word) return m.edit(codeblock('keyword', 'usage: keyword add <word>'));
      kws[word] = Date.now();
      writeJson(KW_FILE, kws);
      return m.edit(codeblock('keyword', kv([['added', word]])));
    }
    if (sub === 'remove') {
      const word = args.slice(1).join(' ');
      if (!kws[word]) return m.edit(codeblock('keyword', 'not found'));
      delete kws[word];
      writeJson(KW_FILE, kws);
      kwAlerts.delete(word);
      return m.edit(codeblock('keyword', kv([['removed', word]])));
    }
    if (sub === 'list' || !sub) {
      const keys = Object.keys(kws);
      if (!keys.length) return m.edit(codeblock('keyword', 'no keywords'));
      return m.edit(codeblock('keyword', keys.map((k, i) => '#' + (i + 1) + '  ' + k).join('\n')));
    }
    if (sub === 'view') {
      const word = args.slice(1).join(' ');
      const arr = kwAlerts.get(word) || [];
      if (!arr.length) return m.edit(codeblock('keyword', 'no alerts'));
      return m.edit(codeblock('keyword · ' + word, arr.slice(0, 15).map(a => a.author + ': ' + a.content.slice(0, 80)).join('\n')));
    }
    await m.edit(codeblock('keyword', 'add · remove · list · view'));
  }, { category: 'trackers', description: 'keyword alerts' });
}

module.exports = { register };
