const { codeblock, kv } = require('../helpers/render');

function register(client) {
  client.registerCommand('userid', async (c, m, args) => {
    const name = args.join(' ').toLowerCase();
    if (!name) return m.edit(codeblock('userid', 'usage: userid <username>'));
    const found = c.users.cache.find(u => u.username.toLowerCase() === name || (u.globalName && u.globalName.toLowerCase() === name));
    if (!found) return m.edit(codeblock('userid', 'not cached'));
    await m.edit(codeblock('userid', kv([['username', found.username], ['id', found.id], ['tag', found.tag]])));
  }, { category: 'info', description: 'resolve user id' });

  client.registerCommand('avatar', async (c, m) => {
    const t = m.mentions.users.first() || c.user;
    await m.edit(codeblock('avatar', t.displayAvatarURL({ size: 2048, dynamic: true })));
  }, { category: 'info', description: 'user avatar' });

  client.registerCommand('banner', async (c, m) => {
    const t = m.mentions.users.first() || c.user;
    try {
      const u = await c.users.fetch(t.id, { force: true });
      if (!u.banner) return m.edit(codeblock('banner', 'no banner'));
      await m.edit(codeblock('banner', u.bannerURL({ size: 2048, dynamic: true })));
    } catch (e) {
      await m.edit(codeblock('banner', 'error: ' + e.message));
    }
  }, { category: 'info', description: 'user banner' });

  client.registerCommand('whoami', async (c, m) => {
    const rows = [
      ['tag', c.user.tag],
      ['id', c.user.id],
      ['uptime', Math.floor((Date.now() - c.startTime) / 1000) + 's']
    ];
    await m.edit(codeblock('identity', kv(rows)));
  }, { category: 'info', description: 'show identity' });
}

module.exports = { register };
