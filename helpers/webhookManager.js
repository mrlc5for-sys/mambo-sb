const axios = require('axios');

const webhookCache = new Map();

async function getWebhook(client, channelId) {
  if (webhookCache.has(channelId)) return webhookCache.get(channelId);
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel || channel.type !== 'GUILD_TEXT') return null;

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

async function sendEmbed(client, channelId, embed, content = null) {
  const url = await getWebhook(client, channelId);
  if (!url) return false;
  try {
    const payload = { embeds: [embed] };
    if (content) payload.content = content;
    await axios.post(url, payload, { timeout: 10000 });
    return true;
  } catch (e) {
    webhookCache.delete(channelId);
    return false;
  }
}

module.exports = { sendEmbed, getWebhook };
