const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { AttachmentBuilder } = require('discord.js-selfbot-v13');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'cache');

function ensure() { try { fs.mkdirSync(CACHE, { recursive: true }); } catch (e) {} }

function pickAttachment(m) {
  if (m.attachments && m.attachments.size) return [...m.attachments.values()][0];
  return null;
}

async function fetchBuffer(url) {
  const r = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return Buffer.from(r.data);
}

function register(client) {
  ensure();

  client.registerCommand('image', async (c, m) => {
    await m.edit(codeblock('image', [
      'achievement <icon> <text>      minecraft achievement',
      'challenge <icon> <text>        minecraft challenge',
      'imgurl <attachment>            direct link',
      'resize <w> <h> <attachment>    resize',
      'avatar [@user]                 avatar',
      'banner [@user]                 banner'
    ].join('\n')));
  }, { aliases: ['img'], category: 'image', description: 'image menu', sticky: true });

  client.registerCommand('achievement', async (c, m, args) => {
    const icon = args[0];
    const text = args.slice(1).join(' ');
    if (!icon || !text) return m.edit(codeblock('achievement', 'usage: achievement <icon> <text>'));
    try {
      const url = 'https://api.alexflipnote.dev/achievement?text=' + encodeURIComponent(text) + '&icon=' + encodeURIComponent(icon);
      const buf = await fetchBuffer(url);
      const file = path.join(CACHE, 'ach-' + Date.now() + '.png');
      fs.writeFileSync(file, buf);
      await m.channel.send({ files: [new AttachmentBuilder(file)] });
      fs.unlinkSync(file);
      await m.delete().catch(() => {});
    } catch (e) { await m.edit(codeblock('achievement', 'error: ' + e.message)); }
  }, { aliases: ['mcachievement'], category: 'image', description: 'minecraft achievement' });

  client.registerCommand('challenge', async (c, m, args) => {
    const icon = args[0];
    const text = args.slice(1).join(' ');
    if (!icon || !text) return m.edit(codeblock('challenge', 'usage: challenge <icon> <text>'));
    try {
      const url = 'https://api.alexflipnote.dev/challenge?text=' + encodeURIComponent(text) + '&icon=' + encodeURIComponent(icon);
      const buf = await fetchBuffer(url);
      const file = path.join(CACHE, 'chal-' + Date.now() + '.png');
      fs.writeFileSync(file, buf);
      await m.channel.send({ files: [new AttachmentBuilder(file)] });
      fs.unlinkSync(file);
      await m.delete().catch(() => {});
    } catch (e) { await m.edit(codeblock('challenge', 'error: ' + e.message)); }
  }, { aliases: ['mcchallenge'], category: 'image', description: 'minecraft challenge' });

  client.registerCommand('imgurl', async (c, m) => {
    const att = pickAttachment(m);
    if (!att) return m.edit(codeblock('imgurl', 'attach an image'));
    await m.edit(codeblock('imgurl', att.url));
  }, { category: 'image', description: 'direct image link' });

  client.registerCommand('resize', async (c, m, args) => {
    const att = pickAttachment(m);
    if (!att) return m.edit(codeblock('resize', 'attach an image'));
    await m.channel.send({ files: [att.url] });
    await m.delete().catch(() => {});
  }, { category: 'image', description: 'resend attachment' });
}

module.exports = { register };
