const { codeblock, kv } = require('../helpers/render');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function register(client) {
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
  }, { category: 'util', description: 'delete your messages' });

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

  client.registerCommand('nick', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('nick', 'server only'));
    const t = m.mentions.members.first();
    if (!t) return m.edit(codeblock('nick', 'usage: nick @user <name>'));
    const name = args.slice(1).join(' ') || null;
    try {
      await t.setNickname(name);
      await m.edit(codeblock('nick', kv([['set', name || 'cleared']])));
    } catch (e) { await m.edit(codeblock('nick', 'error: ' + e.message)); }
  }, { category: 'util', description: 'set nickname' });

  client.registerCommand('topic', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('topic', 'server only'));
    const text = args.join(' ');
    try {
      await m.channel.setTopic(text);
      await m.edit(codeblock('topic', kv([['set', text || 'cleared']])));
    } catch (e) { await m.edit(codeblock('topic', 'error: ' + e.message)); }
  }, { category: 'util', description: 'set channel topic' });
}


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


module.exports = { register };
