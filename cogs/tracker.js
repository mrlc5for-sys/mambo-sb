const fs = require('fs');
const path = require('path');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const TRACK_FILE = path.join(ROOT, 'data', 'tracked_users.json');

function load() { try { return fs.existsSync(TRACK_FILE) ? JSON.parse(fs.readFileSync(TRACK_FILE, 'utf8')) : {}; } catch (e) { return {}; } }
function save(data) { try { fs.writeFileSync(TRACK_FILE, JSON.stringify(data, null, 2)); } catch (e) {} }

function register(client) {
  const typingLoops = new Map();

  client.registerCommand('ghostping', async (c, m) => {
    const target = m.mentions.users.first();
    if (!target) return m.edit(codeblock('ghostping', 'usage: ghostping @user'));
    const sent = await m.channel.send('<' + '@' + target.id + '>');
    await sent.delete().catch(() => {});
    await m.delete().catch(() => {});
  }, { category: 'tracker', description: 'ping and delete' });

  client.registerCommand('typing', async (c, m, args) => {
    const cid = m.channel.id;
    if (args[0] === 'stop') {
      if (typingLoops.has(cid)) { clearInterval(typingLoops.get(cid)); typingLoops.delete(cid); return m.edit(codeblock('typing', 'stopped')); }
      return m.edit(codeblock('typing', 'not running'));
    }
    if (typingLoops.has(cid)) clearInterval(typingLoops.get(cid));
    await m.channel.sendTyping().catch(() => {});
    const id = setInterval(() => m.channel.sendTyping().catch(() => {}), 8000);
    typingLoops.set(cid, id);
    await m.edit(codeblock('typing', 'started'));
  }, { category: 'tracker', description: 'toggle typing indicator' });

  client.registerCommand('track', async (c, m) => {
    const target = m.mentions.users.first();
    if (!target) return m.edit(codeblock('track', 'usage: track @user'));
    const data = load();
    data[target.id] = { tag: target.tag, addedBy: c.user.id };
    save(data);
    await m.edit(codeblock('track', kv([['tracking', target.tag]])));
  }, { category: 'tracker', description: 'track user changes' });

  client.registerCommand('untrack', async (c, m) => {
    const target = m.mentions.users.first();
    if (!target) return m.edit(codeblock('untrack', 'usage: untrack @user'));
    const data = load();
    if (data[target.id]) { delete data[target.id]; save(data); }
    await m.edit(codeblock('untrack', kv([['removed', target.tag]])));
  }, { category: 'tracker', description: 'stop tracking user' });

  client.registerCommand('vocalspy', async (c, m, args) => {
    const guildId = args[0], channelId = args[1];
    if (!guildId || !channelId) return m.edit(codeblock('vocalspy', 'usage: vocalspy <guild_id> <channel_id>'));
    const shard = c.ws.shards.first();
    if (shard) shard.send({ op: 4, d: { guild_id: guildId, channel_id: channelId, self_mute: true, self_deaf: true } });
    await m.edit(codeblock('vocalspy', kv([['joined', channelId]])));
  }, { category: 'tracker', description: 'join vc muted & deafened' });

  client.on('userUpdate', async (oldUser, newUser) => {
    const data = load();
    if (!data[newUser.id]) return;
    let changes = [];
    if (oldUser.username !== newUser.username) changes.push(`username: ${oldUser.username} -> ${newUser.username}`);
    if (oldUser.avatar !== newUser.avatar) changes.push('avatar changed');
    if (oldUser.globalName !== newUser.globalName) changes.push(`display: ${oldUser.globalName} -> ${newUser.globalName}`);
    if (!changes.length) return;
    try {
      const owner = await client.users.fetch(data[newUser.id].addedBy);
      if (owner) owner.send(codeblock('tracker · update', kv([['user', newUser.tag], ['changes', changes.join(', ')]]))).catch(() => {});
    } catch (e) {}
  });
}

module.exports = { register };
