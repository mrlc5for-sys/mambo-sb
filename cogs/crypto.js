const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const { codeblock, menu, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const WALLET_FILE = path.join(DATA, 'wallets.json');

function ensure() { try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {} }

function readWallets() {
  try { return fs.existsSync(WALLET_FILE) ? JSON.parse(fs.readFileSync(WALLET_FILE, 'utf8')) : {}; }
  catch (e) { return {}; }
}

function saveWallets(data) {
  ensure();
  fs.writeFileSync(WALLET_FILE, JSON.stringify(data, null, 2));
}

function generateEvm() {
  const privateKey = crypto.randomBytes(32).toString('hex');
  const address = '0x' + crypto.createHash('sha256').update(privateKey).digest('hex').slice(24);
  return { privateKey, address };
}

function register(client) {
  ensure();

  client.registerCommand('crypto', async (c, m) => {
    const wallets = readWallets();
    await m.edit(menu('crypto · wallet', [
      'create <name>            new wallet',
      'list                     list wallets',
      'use <name>               set active',
      'show [name]              address',
      'delete <name>            remove',
      'rename <a> <b>           rename',
      '',
      'price <coin>             price lookup',
      'convert <a> <f> <t>      unit conversion',
      'gas [chain]              gas fees',
      '',
      'wallets   ' + Object.keys(wallets).length,
      'active    ' + ((c.cfg.crypto && c.cfg.crypto.active) || 'none')
    ]));
  }, { aliases: ['wallet'], category: 'crypto', description: 'crypto menu', sticky: true });

  client.registerCommand('wallet-create', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('create', 'usage: wallet create <name>'));
    const wallets = readWallets();
    if (wallets[name]) return m.edit(codeblock('create', 'name taken'));
    const w = generateEvm();
    wallets[name] = { address: w.address, privateKey: w.privateKey, createdAt: Date.now() };
    saveWallets(wallets);
    await m.edit(codeblock('wallet · created', kv([['name', name], ['evm', w.address]])));
  }, { category: 'crypto', description: 'create new wallet' });

  client.registerCommand('wallet-list', async (c, m) => {
    const wallets = readWallets();
    const list = Object.entries(wallets);
    if (!list.length) return m.edit(codeblock('wallets', 'none'));
    const active = (c.cfg.crypto && c.cfg.crypto.active) || '';
    await m.edit(codeblock('wallets', list.map(([n, w], i) => (i + 1) + '. ' + n.padEnd(15) + '  ' + w.address + (active === n ? ' ◀' : '')).join('\n')));
  }, { aliases: ['wallets'], category: 'crypto', description: 'list wallets' });

  client.registerCommand('wallet-use', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('use', 'usage: wallet use <name>'));
    const wallets = readWallets();
    if (!wallets[name]) return m.edit(codeblock('use', 'not found'));
    if (!c.cfg.crypto) c.cfg.crypto = {};
    c.cfg.crypto.active = name;
    fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2));
    await m.edit(codeblock('wallet · active', kv([['name', name]])));
  }, { category: 'crypto', description: 'set active wallet' });

  client.registerCommand('wallet-show', async (c, m, args) => {
    const name = args[0] || (c.cfg.crypto && c.cfg.crypto.active);
    if (!name) return m.edit(codeblock('show', 'no active wallet'));
    const wallets = readWallets();
    const w = wallets[name];
    if (!w) return m.edit(codeblock('show', 'not found'));
    await m.edit(codeblock('wallet · show', kv([['name', name], ['evm', w.address]])));
  }, { category: 'crypto', description: 'show wallet' });

  client.registerCommand('wallet-delete', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('delete', 'usage: wallet delete <name>'));
    const wallets = readWallets();
    if (!wallets[name]) return m.edit(codeblock('delete', 'not found'));
    delete wallets[name];
    saveWallets(wallets);
    await m.edit(codeblock('wallet · deleted', kv([['name', name]])));
  }, { category: 'crypto', description: 'delete wallet' });

  client.registerCommand('wallet-rename', async (c, m, args) => {
    const from = args[0];
    const to = args[1];
    if (!from || !to) return m.edit(codeblock('rename', 'usage: wallet rename <old> <new>'));
    const wallets = readWallets();
    if (!wallets[from]) return m.edit(codeblock('rename', 'not found'));
    if (wallets[to]) return m.edit(codeblock('rename', 'name taken'));
    wallets[to] = wallets[from];
    delete wallets[from];
    saveWallets(wallets);
    await m.edit(codeblock('wallet · rename', kv([['from', from], ['to', to]])));
  }, { category: 'crypto', description: 'rename wallet' });

  client.registerCommand('price', async (c, m, args) => {
    const ids = args.map(a => a.toLowerCase()).filter(Boolean);
    if (!ids.length) return m.edit(codeblock('price', 'usage: price <coin>'));
    const map = { btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin', sol: 'solana', pol: 'matic-network', matic: 'matic-network', xrp: 'ripple', ada: 'cardano', doge: 'dogecoin', avax: 'avalanche-2', dot: 'polkadot', ltc: 'litecoin', trx: 'tron', link: 'chainlink', uni: 'uniswap', xmr: 'monero', atom: 'cosmos' };
    const cg = ids.map(id => map[id] || id);
    try {
      const r = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=' + cg.join(',') + '&vs_currencies=usd&include_24hr_change=true', { timeout: 10000 });
      const rows = cg.map(id => {
        const d = r.data[id];
        if (!d) return id.padEnd(15) + '  —';
        const change = d.usd_24h_change ? (d.usd_24h_change >= 0 ? '+' : '') + d.usd_24h_change.toFixed(2) + '%' : '';
        return id.padEnd(15) + '  $' + d.usd.toFixed(2) + '  ' + change;
      });
      await m.edit(codeblock('prices', rows.join('\n')));
    } catch (e) { await m.edit(codeblock('price · error', e.message)); }
  }, { aliases: ['prices'], category: 'crypto', description: 'price lookup' });

  client.registerCommand('convert', async (c, m, args) => {
    const amount = parseFloat(args[0]);
    const from = (args[1] || '').toLowerCase();
    const to = (args[2] || '').toLowerCase();
    if (isNaN(amount) || !from || !to) return m.edit(codeblock('convert', 'usage: convert <amt> <from> <to>'));
    const map = { btc: 'bitcoin', eth: 'ethereum', bnb: 'binancecoin', sol: 'solana', pol: 'matic-network', matic: 'matic-network', usd: 'usd', usdt: 'tether', usdc: 'usd-coin', ltc: 'litecoin' };
    const cgFrom = map[from] || from;
    const cgTo = map[to] || to;
    try {
      const ids = [cgFrom, cgTo].filter(x => x !== 'usd');
      const r = ids.length ? await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=' + ids.join(',') + '&vs_currencies=usd', { timeout: 10000 }) : { data: {} };
      const priceFrom = cgFrom === 'usd' ? 1 : (r.data[cgFrom] && r.data[cgFrom].usd) || 0;
      const priceTo = cgTo === 'usd' ? 1 : (r.data[cgTo] && r.data[cgTo].usd) || 0;
      if (!priceFrom || !priceTo) return m.edit(codeblock('convert', 'price unavailable'));
      const out = amount * priceFrom / priceTo;
      await m.edit(codeblock('convert', kv([['in', amount + ' ' + from.toUpperCase()], ['out', out.toFixed(6) + ' ' + to.toUpperCase()]])));
    } catch (e) { await m.edit(codeblock('convert · error', e.message)); }
  }, { category: 'crypto', description: 'unit conversion' });

  client.registerCommand('gas', async (c, m, args) => {
    try {
      const r = await axios.get('https://ethgasstation.info/api/ethgasAPI.json', { timeout: 8000 });
      await m.edit(codeblock('gas · ethereum', kv([['fast', r.data.fast / 10 + ' gwei'], ['standard', r.data.average / 10 + ' gwei'], ['slow', r.data.safeLow / 10 + ' gwei']])));
    } catch (e) { await m.edit(codeblock('gas · error', e.message)); }
  }, { category: 'crypto', description: 'gas fees' });
}

module.exports = { register };
