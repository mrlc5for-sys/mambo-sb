const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const NITRO_FILE = path.join(DATA, 'sniper-nitro.json');
const LOG_FILE = path.join(DATA, 'sniper-log.json');
const GW_FILE = path.join(DATA, 'sniper-gw.json');
let gwEnabled = false;

const GIFT_RE = /discord\.gift\/([a-zA-Z0-9]+)|discord\.com\/gifts\/([a-zA-Z0-9]+)/gi;

function ensure() { try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {} }

function readJson(f, def) {
  try { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : def; }
  catch (e) { return def; }
}

function writeJson(f, data) {
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2)); } catch (e) {}
}

function pushLog(entry) {
  const log = readJson(LOG_FILE, []);
  log.unshift({ ...entry, at: Date.now() });
  if (log.length > 200) log.length = 200;
  writeJson(LOG_FILE, log);
}

async function checkNitro(code) {
  try {
    const r = await axios.get('https://discord.com/api/v9/entitlements/gift-codes/' + code, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 8000, validateStatus: () => true
    });
    if (r.status === 200) return { valid: true, data: r.data };
    if (r.status === 404) return { valid: false, reason: 'invalid' };
    if (r.status === 429) return { valid: null, reason: 'rate limited' };
    return { valid: false, reason: 'status ' + r.status };
  } catch (e) { return { valid: null, reason: e.message }; }
}

function getNitroCfg() {
  return readJson(NITRO_FILE, { enabled: false, ignoreInvalid: true });
}

function registerEvents(client) {
  client.on('messageCreate', async msg => {
    if (!msg || !msg.content) return;
    if (msg.author && msg.author.id === client.user.id) return;
    const cfg = getNitroCfg();
    if (!cfg.enabled) return;
    GIFT_RE.lastIndex = 0;
    let match;
    while ((match = GIFT_RE.exec(msg.content)) !== null) {
      const code = match[1] || match[2];
      if (!code) continue;
      const res = await checkNitro(code);
      if (res.valid === true) {
        pushLog({ type: 'nitro', code, valid: true, author: msg.author ? msg.author.tag : null, channel: msg.channel.id });
        console.log('[SNIPER] valid nitro:', code);
      } else if (cfg.ignoreInvalid === false) {
        pushLog({ type: 'nitro', code, valid: false, reason: res.reason });
      }
      await new Promise(r => setTimeout(r, 800));
    }
  });
}

function register(client) {
  client.registerCommand('autogw', async (c, m, args) => {
    gwEnabled = (args[0] || '').toLowerCase() === 'on';
    await m.edit(codeblock('sniper · gw', kv([['status', gwEnabled ? 'enabled' : 'disabled']])));
  }, { category: 'snipers', description: 'auto join giveaways' });

  client.on('messageCreate', async (msg) => {
    if (!gwEnabled || !client.user || msg.author.id === client.user.id) return;
    const lower = msg.content.toLowerCase();
    const keywords = ['giveaway', 'drop', 'nitro', 'loot', 'gift'];
    const isGw = keywords.some(k => lower.includes(k));
    if (!isGw) return;
    const buttons = msg.components;
    if (buttons && buttons.length) {
      for (const row of buttons) {
        for (const comp of row.components) {
          if (comp.type === 'BUTTON' && comp.label && comp.label.toLowerCase().includes('enter')) {
            try { await msg.clickButton(comp.customId); } catch (e) {}
          }
        }
      }
    }
    const reactions = ['🎉', '🎁', '⚡'];
    for (const r of reactions) {
      if (msg.react) msg.react(r).catch(() => {});
    }
  });
  ensure();
  registerEvents(client);


  client.registerCommand('sniper', async (c, m) => {
    const n = getNitroCfg();
    await m.edit(codeblock('snipers', [
      'nitro on|off           nitro sniper',
      'ignoreinvalid on|off   skip invalid codes',
      'snipelog [n]           recent catches',
      'sniperclear            clear log',
      '',
      'nitro    ' + (n.enabled ? 'on' : 'off')
    ].join('\n')));
  }, { aliases: ['snipers'], category: 'snipers', description: 'sniper menu', sticky: true });

  client.registerCommand('nitro', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    const cfg = getNitroCfg();
    if (sub === 'on') { cfg.enabled = true; writeJson(NITRO_FILE, cfg); return m.edit(codeblock('nitro', 'enabled')); }
    if (sub === 'off') { cfg.enabled = false; writeJson(NITRO_FILE, cfg); return m.edit(codeblock('nitro', 'disabled')); }
    await m.edit(codeblock('nitro', kv([['state', cfg.enabled ? 'on' : 'off']])));
  }, { category: 'snipers', description: 'nitro sniper toggle' });

  client.registerCommand('ignoreinvalid', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    const cfg = getNitroCfg();
    cfg.ignoreInvalid = sub !== 'off';
    writeJson(NITRO_FILE, cfg);
    await m.edit(codeblock('ignoreinvalid', kv([['state', cfg.ignoreInvalid ? 'on' : 'off']])));
  }, { category: 'snipers', description: 'skip invalid codes' });

  client.registerCommand('snipelog', async (c, m, args) => {
    const n = Math.min(parseInt(args[0], 10) || 20, 100);
    const log = readJson(LOG_FILE, []);
    if (!log.length) return m.edit(codeblock('snipelog', 'no catches'));
    await m.edit(codeblock('snipelog · ' + n, log.slice(0, n).map(e => new Date(e.at).toISOString().slice(11, 19) + '  ' + e.type + '  ' + (e.code || '').slice(0, 30)).join('\n')));
  }, { category: 'snipers', description: 'recent catches' });

  client.registerCommand('sniperclear', async (c, m) => {
    writeJson(LOG_FILE, []);
    await m.edit(codeblock('snipers', 'log cleared'));
  }, { category: 'snipers', description: 'clear sniper log' });
}

module.exports = { register };
