const axios = require('axios');
const { codeblock, kv } = require('../helpers/render');

function register(client) {
  client.registerCommand('bio', async (c, m, args) => {
    const text = args.join(' ');
    if (!text) return m.edit(codeblock('bio', 'usage: bio <text>'));
    try {
      await c.user.setAboutMe(text);
      await m.edit(codeblock('bio', kv([['set', text]])));
    } catch (e) { await m.edit(codeblock('bio', 'error: ' + e.message)); }
  }, { category: 'profile', description: 'set about me' });

  client.registerCommand('pronouns', async (c, m, args) => {
    const text = args.join(' ');
    if (!text) return m.edit(codeblock('pronouns', 'usage: pronouns <text>'));
    try {
      await axios.patch('https://discord.com/api/v10/users/@me', { pronouns: text }, { headers: { Authorization: c.token } });
      await m.edit(codeblock('pronouns', kv([['set', text]])));
    } catch (e) { await m.edit(codeblock('pronouns', 'error: ' + e.message)); }
  }, { category: 'profile', description: 'set pronouns' });

  client.registerCommand('hypesquad', async (c, m, args) => {
    const houses = { bravery: 1, brilliance: 2, balance: 3 };
    const house = (args[0] || '').toLowerCase();
    if (!houses[house]) return m.edit(codeblock('hypesquad', 'usage: hypesquad <bravery|brilliance|balance>'));
    try {
      await axios.post('https://discord.com/api/v10/hypesquad/online', { house_id: houses[house] }, { headers: { Authorization: c.token } });
      await m.edit(codeblock('hypesquad', kv([['set', house]])));
    } catch (e) { await m.edit(codeblock('hypesquad', 'error: ' + e.message)); }
  }, { category: 'profile', description: 'change hypesquad' });

  client.registerCommand('clearstatus', async (c, m) => {
    c.cfg.rpc = { enabled: false, type: 'PLAYING', name: '', details: '', state: '' };
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
    c.user.setPresence({ activities: [], status: 'invisible' });
    await m.edit(codeblock('clearstatus', 'cleared'));
  }, { category: 'profile', description: 'clear status & rpc' });

  client.registerCommand('steal', async (c, m, args) => {
    const emoji = args[0];
    if (!emoji) return m.edit(codeblock('steal', 'usage: steal <emoji>'));
    const match = emoji.match(/<a?:(\w+):(\d+)>/);
    if (!match) return m.edit(codeblock('steal', 'invalid emoji'));
    const name = match[1];
    const id = match[2];
    const ext = emoji.startsWith('<a:') ? 'gif' : 'png';
    const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
    if (!m.guild) return m.edit(codeblock('steal', 'server only'));
    try {
      const created = await m.guild.emojis.create(url, name);
      await m.edit(codeblock('steal', kv([['added', created.name], ['id', created.id]])));
    } catch (e) { await m.edit(codeblock('steal', 'error: ' + e.message)); }
  }, { category: 'profile', description: 'steal an emoji' });

  client.registerCommand('stealsticker', async (c, m, args) => {
    const stickerId = args[0];
    if (!stickerId) return m.edit(codeblock('stealsticker', 'usage: stealsticker <id>'));
    if (!m.guild) return m.edit(codeblock('stealsticker', 'server only'));
    try {
      const sticker = await c.fetchSticker(stickerId);
      if (!sticker) return m.edit(codeblock('stealsticker', 'not found'));
      const url = sticker.url;
      const created = await m.guild.stickers.create(url, sticker.name, sticker.tags);
      await m.edit(codeblock('stealsticker', kv([['added', created.name]])));
    } catch (e) { await m.edit(codeblock('stealsticker', 'error: ' + e.message)); }
  }, { category: 'profile', description: 'steal a sticker' });
}

module.exports = { register };
