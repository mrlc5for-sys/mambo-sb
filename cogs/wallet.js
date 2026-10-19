const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');
const webhookEngine = require('../helpers/webhookEngine');
const axios = require('axios');

const ROOT = path.resolve(__dirname, '..');
const WALLET_FILE = path.join(ROOT, 'data', 'wallets.json');

function ensure() { try { fs.mkdirSync(path.dirname(WALLET_FILE), { recursive: true }); } catch (e) {} }
function loadWallets() { try { return fs.existsSync(WALLET_FILE) ? JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')) : {}; } catch (e) { return {}; } }
function saveWallets(data) { ensure(); fs.writeFileSync(WALLET_FILE, JSON.stringify(data, null, 2)); }

function generateEvm() {
  const pk = crypto.randomBytes(32).toString('hex');
  const address = '0x' + crypto.createHash('sha256').update(pk).digest('hex').slice(24);
  return { address, pk };
}

function register(client) {
  ensure();

  client.registerCommand('wallet', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    const wallets = loadWallets();
    const userWallets = Object.keys(wallets).filter(k => wallets[k].owner === c.user.id);

    if (!sub || sub === 'list') {
      const fields = userWallets.map(w => ({ name: w, value: wallets[w].address, inline: false }));
      if (!fields.length) fields.push({ name: 'No wallets', value: 'Run \`wallet create <name>\`', inline: false });
      return webhookEngine.sendMenu(c, m.channel.id, 'Your Wallets', 'Manage your crypto addresses', fields, c.dashUser);
    }

    if (sub === 'create') {
      const name = args[1];
      if (!name) return m.edit(codeblock('wallet', 'usage: wallet create <name>'));
      if (wallets[name]) return m.edit(codeblock('wallet', 'name already taken'));
      const w = generateEvm();
      wallets[name] = { address: w.address, pk: w.pk, owner: c.user.id };
      saveWallets(wallets);
      return m.edit(codeblock('wallet · created', kv([['name', name], ['address', w.address]])));
    }

    if (sub === 'receive') {
      const name = args[1];
      if (!name || !wallets[name]) return m.edit(codeblock('wallet', 'wallet not found'));
      const w = wallets[name];
      const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + w.address;
      return webhookEngine.sendMenu(c, m.channel.id, 'Receive Crypto', 'Scan to deposit to ' + name, [
        { name: 'Address', value: w.address, inline: false },
        { name: 'QR Code', value: qrUrl, inline: false }
      ], c.dashUser);
    }
  }, { category: 'wallet', description: 'crypto wallet menu', sticky: true });

  client.registerCommand('upi', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if ((args[0] || '').toLowerCase() !== 'setup') return m.edit(codeblock('upi', 'usage: upi setup <upi_id> <name>'));
    const upiId = args[1];
    const name = args.slice(2).join(' ');
    if (!upiId || !name) return m.edit(codeblock('upi', 'missing args'));
    const configFile = path.join(ROOT, 'config.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    config.upi = { id: upiId, name };
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    await m.edit(codeblock('upi', kv([['upi_id', upiId], ['name', name]])));
  }, { category: 'wallet', description: 'setup UPI', gate: 'owner' });

  client.registerCommand('buy', async (c, m, args) => {
    if ((args[0] || '').toLowerCase() !== 'host') return m.edit(codeblock('buy', 'usage: buy host <amount>'));
    const amount = parseInt(args[1], 10) * 5;
    if (!amount) return m.edit(codeblock('buy', 'invalid amount'));
    const configFile = path.join(ROOT, 'config.json');
    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    if (!config.upi) return m.edit(codeblock('buy', 'upi not setup'));

    const upiLink = `upi://pay?pa=${config.upi.id}&pn=${encodeURIComponent(config.upi.name)}&am=${amount}.00&cu=INR`;
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=' + encodeURIComponent(upiLink);

    await webhookEngine.sendMenu(c, m.channel.id, 'Purchase Hosting', 'Scan to pay ₹' + amount + ' for ' + args[1] + ' slots', [
      { name: 'UPI ID', value: config.upi.id, inline: false },
      { name: 'Amount', value: '₹' + amount + '.00', inline: false },
      { name: 'QR Code', value: qrUrl, inline: false }
    ], c.dashUser);
    await m.edit(codeblock('buy', 'waiting for admin approval...'));
  }, { category: 'wallet', description: 'buy hosting slots' });
}

module.exports = { register };
