const ADMIN_IDS = (process.env.ADMIN_ID || '').split(',').map(s => s.trim()).filter(Boolean);

function isOwner(client, message) {
  if (!client.user || !message.author) return false;
  if (message.author.id === client.user.id) return true;
  if (ADMIN_IDS.includes(message.author.id)) return true;
  return false;
}

async function requireOwner(client, message) {
  if (!isOwner(client, message)) {
    await message.edit('> ```\n> owner only\n> ```').catch(() => {});
    return false;
  }
  return true;
}

module.exports = { isOwner, requireOwner, ADMIN_IDS };
