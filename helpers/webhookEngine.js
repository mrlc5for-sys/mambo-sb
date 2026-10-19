const axios = require('axios');
const Database = require('./database');

const webhookCache = new Map();
const themeDb = new Database('themes.json', { themes: {} });

async function getWebhook(client, channelId) {
  if (webhookCache.has(channelId)) return webhookCache.get(channelId);
  try {
    const res = await axios.get(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
      headers: { Authorization: client.token }
    });
    let wh = res.data.find(w => w.name === 'Mambo Engine' && w.token);
    if (!wh) {
      const createRes = await axios.post(`https://discord.com/api/v10/channels/${channelId}/webhooks`, {
        name: 'Mambo Engine'
      }, { headers: { Authorization: client.token } });
      wh = createRes.data;
    }
    const url = `https://discord.com/api/webhooks/${wh.id}/${wh.token}`;
    webhookCache.set(channelId, url);
    return url;
  } catch (e) {
    return null;
  }
}

async function sendMenu(client, channelId, title, description, fields, username) {
  const url = await getWebhook(client, channelId);
  if (!url) return false;

  const theme = themeDb.get(`themes.${username}`, { color: '#8a2be2' });
  const colorHex = parseInt(theme.color.replace('#', ''), 16) || 0x8a2be2;

  const embed = {
    title: title,
    description: description,
    color: colorHex,
    fields: fields,
    footer: { text: `Mambo SB v2.0 • ${username}` },
    timestamp: new Date().toISOString()
  };

  try {
    await axios.post(url, {
      username: 'Mambo SB',
      avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
      embeds: [embed]
    }, { timeout: 10000 });
    return true;
  } catch (e) {
    webhookCache.delete(channelId);
    return false;
  }
}

module.exports = { sendMenu };
