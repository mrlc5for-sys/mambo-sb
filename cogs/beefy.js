const fs = require('fs');
const path = require('path');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const PACK_FILE = path.join(DATA, 'pack.txt');
const AP_FILE = path.join(DATA, 'ap.txt');
const BURST_FILE = path.join(DATA, 'burst.txt');
const SETTINGS_FILE = path.join(DATA, 'beefy.json');

const PACK_DEFAULTS = ['ez', 'trash', 'l', 'ratio', 'cope', 'seethe', 'mad', 'cry', 'skill issue', 'stay mad'];
const AP_DEFAULTS = ['back off', 'stay mad', 'cope harder', 'ez target', 'stop talking', 'skill issue', 'L + bozo', 'crying?'];
const BURST_DEFAULTS = ['HAHAHA', 'EZ', 'RATIO', 'L + BOZO', 'CRY ABOUT IT', 'SKILL ISSUE', 'GET REKT', 'WASHED'];

const packLoops = new Map();
const apState = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function ensure() {
  try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {}
  if (!fs.existsSync(PACK_FILE)) fs.writeFileSync(PACK_FILE, PACK_DEFAULTS.join('\n'));
  if (!fs.existsSync(AP_FILE)) fs.writeFileSync(AP_FILE, AP_DEFAULTS.join('\n'));
  if (!fs.existsSync(BURST_FILE)) fs.writeFileSync(BURST_FILE, BURST_DEFAULTS.join('\n'));
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      ap: { interval: 3000, maxLines: 3, delay: 1500, proxy: null },
      burst: { count: 20, delay: 300, proxy: null }
    }, null, 2));
  }
}

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); }
  catch (e) { return { ap: { interval: 3000, maxLines: 3, delay: 1500, proxy: null }, burst: { count: 20, delay: 300, proxy: null } }; }
}

function saveSettings(s) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

function idFromArg(raw) {
  if (!raw) return null;
  return String(raw).replace(/[<@!>]/g, '');
}

function registerEvents(client) {
  client.on('messageCreate', async (msg) => {
    if (!client.user || !msg.author || !msg.content) return;
    if (msg.author.id === client.user.id) return;
    const state = apState.get(client.uid);
    if (!state || !state.enabled) return;
    if (state.target && msg.author.id !== state.target) return;
    const now = Date.now();
    if (now - state.lastReply < state.interval) return;
    state.lastReply = now;
    const lines = readLines(AP_FILE);
    if (!lines.length) return;
    const count = Math.min(state.maxLines, 3 + Math.floor(Math.random() * 3));
    for (let i = 0; i < count; i++) {
      const line = lines[Math.floor(Math.random() * lines.length)];
      try { await msg.channel.send('<' + '@' + msg.author.id + '> ' + line); } catch (e) {}
      await sleep(state.delay);
    }
  });
}

function register(client) {
  ensure();
  registerEvents(client);

  client.registerCommand('beefy', async (c, m) => {
    const s = readSettings();
    const ap = apState.get(c.uid) || { enabled: false, target: null, interval: s.ap.interval, maxLines: s.ap.maxLines, delay: s.ap.delay };
    const body = [
      'PACK LOOP',
      '  pack @user [delay]        insult loop in channel',
      '  packstop                  stop loop',
      '  packstopall               stop all loops',
      '  packwords list|add|reset  manage pack.txt',
      '',
      'AUTO PACK (ap)',
      '  ap @user                  start auto-reply pack',
      '  ap                        toggle on/off',
      '  ap stop                   stop',
      '  ap status                 show current',
      '  ap config                 show settings',
      '  ap config interval <ms>',
      '  ap config maxlines <n>',
      '  ap config delay <ms>',
      '  ap config proxy <url|off>',
      '  apwords list|add|reset    manage ap.txt',
      '',
      'BURST',
      '  burst @user [count] [delay]   rapid-fire burst',
      '  burstconfig count <n>',
      '  burstconfig delay <ms>',
      '  burstconfig proxy <url|off>',
      '  burstfile list|add|reset      manage burst.txt',
      '',
      'CURRENT',
      '  ap target     ' + (ap.target || '—'),
      '  ap enabled    ' + (ap.enabled ? 'yes' : 'no'),
      '  ap interval   ' + s.ap.interval + 'ms',
      '  ap maxLines   ' + s.ap.maxLines,
      '  ap delay      ' + s.ap.delay + 'ms',
      '  ap proxy      ' + (s.ap.proxy || 'off'),
      '  burst count   ' + s.burst.count,
      '  burst delay   ' + s.burst.delay + 'ms',
      '  burst proxy   ' + (s.burst.proxy || 'off')
    ];
    await m.edit(codeblock('beefy', body.join('\n')));
  }, { aliases: ['bf'], category: 'beefy', description: 'beefy menu', sticky: true });

  client.registerCommand('pack', async (c, m, args) => {
    const target = idFromArg(args[0]);
    if (!target) return m.edit(codeblock('pack', 'usage: pack @user [delay_ms]'));
    const cid = m.channel.id;
    if (packLoops.has(cid)) clearInterval(packLoops.get(cid));
    const words = readLines(PACK_FILE);
    if (!words.length) return m.edit(codeblock('pack', 'pack.txt empty'));
    const delay = parseInt(args[1], 10) || 1500;
    const id = setInterval(async () => {
      const line = words[Math.floor(Math.random() * words.length)];
      try { await m.channel.send('<' + '@' + target + '> ' + line); } catch (e) {}
    }, delay);
    packLoops.set(cid, id);
    await m.edit(codeblock('pack · start', kv([
      ['target', target],
      ['delay', delay + 'ms'],
      ['lines', words.length]
    ])));
  }, { aliases: ['spack'], category: 'beefy', description: 'insult loop' });

  client.registerCommand('packstop', async (c, m) => {
    const cid = m.channel.id;
    if (packLoops.has(cid)) {
      clearInterval(packLoops.get(cid));
      packLoops.delete(cid);
      return m.edit(codeblock('pack', 'stopped'));
    }
    await m.edit(codeblock('pack', 'nothing running'));
  }, { category: 'beefy', description: 'stop pack loop' });

  client.registerCommand('packstopall', async (c, m) => {
    for (const id of packLoops.values()) clearInterval(id);
    packLoops.clear();
    await m.edit(codeblock('pack', 'all loops stopped'));
  }, { category: 'beefy', description: 'stop all loops' });

  client.registerCommand('packwords', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'list' || !sub) {
      const words = readLines(PACK_FILE);
      return m.edit(codeblock('pack · words (' + words.length + ')', words.slice(0, 40).join('\n')));
    }
    if (sub === 'add') {
      const word = args.slice(1).join(' ');
      if (!word) return m.edit(codeblock('packwords', 'usage: packwords add <text>'));
      const words = readLines(PACK_FILE);
      words.push(word);
      fs.writeFileSync(PACK_FILE, words.join('\n'));
      return m.edit(codeblock('packwords', kv([['added', word], ['total', words.length]])));
    }
    if (sub === 'reset') {
      fs.writeFileSync(PACK_FILE, PACK_DEFAULTS.join('\n'));
      return m.edit(codeblock('packwords', 'reset'));
    }
    await m.edit(codeblock('packwords', 'list · add <text> · reset'));
  }, { aliases: ['packw'], category: 'beefy', description: 'manage pack.txt' });

  client.registerCommand('ap', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    const s = readSettings();
    let state = apState.get(c.uid);
    if (!state) {
      state = { enabled: false, target: null, interval: s.ap.interval, maxLines: s.ap.maxLines, delay: s.ap.delay, lastReply: 0 };
      apState.set(c.uid, state);
    }

    if (sub === 'stop') {
      state.enabled = false;
      return m.edit(codeblock('ap', 'stopped'));
    }

    if (sub === 'status') {
      return m.edit(codeblock('ap · status', kv([
        ['target', state.target || '—'],
        ['enabled', state.enabled ? 'yes' : 'no'],
        ['interval', state.interval + 'ms'],
        ['maxLines', state.maxLines],
        ['delay', state.delay + 'ms'],
        ['lines', readLines(AP_FILE).length]
      ])));
    }

    if (sub === 'config') {
      const key = (args[1] || '').toLowerCase();
      const value = args[2];
      if (!key) {
        return m.edit(codeblock('ap · config', [
          'interval <ms>       min time between reply bursts',
          'maxlines <n>        max lines per burst',
          'delay <ms>          delay between lines',
          'proxy <url|off>     proxy for this client',
          '',
          'CURRENT',
          '  interval   ' + state.interval + 'ms',
          '  maxLines   ' + state.maxLines,
          '  delay      ' + state.delay + 'ms',
          '  proxy      ' + (s.ap.proxy || 'off')
        ].join('\n')));
      }
      if (key === 'interval') {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 500) return m.edit(codeblock('ap · config', 'min 500ms'));
        state.interval = n;
        s.ap.interval = n;
        saveSettings(s);
        return m.edit(codeblock('ap · config', kv([['interval', n + 'ms']])));
      }
      if (key === 'maxlines') {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 1 || n > 20) return m.edit(codeblock('ap · config', '1-20'));
        state.maxLines = n;
        s.ap.maxLines = n;
        saveSettings(s);
        return m.edit(codeblock('ap · config', kv([['maxLines', n]])));
      }
      if (key === 'delay') {
        const n = parseInt(value, 10);
        if (isNaN(n) || n < 100) return m.edit(codeblock('ap · config', 'min 100ms'));
        state.delay = n;
        s.ap.delay = n;
        saveSettings(s);
        return m.edit(codeblock('ap · config', kv([['delay', n + 'ms']])));
      }
      if (key === 'proxy') {
        s.ap.proxy = value === 'off' ? null : value;
        saveSettings(s);
        return m.edit(codeblock('ap · config', kv([['proxy', s.ap.proxy || 'off']])));
      }
      return m.edit(codeblock('ap · config', 'unknown key'));
    }

    const target = idFromArg(args[0]);
    if (target) {
      state.target = target;
      state.enabled = true;
      state.lastReply = 0;
      return m.edit(codeblock('ap · start', kv([
        ['target', target],
        ['interval', state.interval + 'ms'],
        ['maxLines', state.maxLines],
        ['lines', readLines(AP_FILE).length]
      ])));
    }

    if (state.target) {
      state.enabled = !state.enabled;
      return m.edit(codeblock('ap', kv([['target', state.target], ['enabled', state.enabled ? 'yes' : 'no']])));
    }

    await m.edit(codeblock('ap', 'usage: ap @user | ap stop | ap status | ap config'));
  }, { category: 'beefy', description: 'auto-reply pack when target messages' });

  client.registerCommand('apwords', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'list' || !sub) {
      const words = readLines(AP_FILE);
      return m.edit(codeblock('ap · lines (' + words.length + ')', words.slice(0, 40).join('\n')));
    }
    if (sub === 'add') {
      const word = args.slice(1).join(' ');
      if (!word) return m.edit(codeblock('apwords', 'usage: apwords add <text>'));
      const words = readLines(AP_FILE);
      words.push(word);
      fs.writeFileSync(AP_FILE, words.join('\n'));
      return m.edit(codeblock('apwords', kv([['added', word], ['total', words.length]])));
    }
    if (sub === 'reset') {
      fs.writeFileSync(AP_FILE, AP_DEFAULTS.join('\n'));
      return m.edit(codeblock('apwords', 'reset'));
    }
    await m.edit(codeblock('apwords', 'list · add <text> · reset'));
  }, { aliases: ['apw'], category: 'beefy', description: 'manage ap.txt' });

  client.registerCommand('burst', async (c, m, args) => {
    const target = idFromArg(args[0]);
    if (!target) return m.edit(codeblock('burst', 'usage: burst @user [count] [delay_ms]'));
    const s = readSettings();
    const count = parseInt(args[1], 10) || s.burst.count;
    const delay = parseInt(args[2], 10) || s.burst.delay;
    const lines = readLines(BURST_FILE);
    if (!lines.length) return m.edit(codeblock('burst', 'burst.txt empty'));
    await m.edit(codeblock('burst · firing', kv([
      ['target', target],
      ['count', count],
      ['delay', delay + 'ms'],
      ['lines', lines.length]
    ])));
    for (let i = 0; i < Math.min(count, 500); i++) {
      const line = lines[Math.floor(Math.random() * lines.length)];
      try { await m.channel.send('<' + '@' + target + '> ' + line); } catch (e) {}
      await sleep(delay);
    }
  }, { category: 'beefy', description: 'rapid-fire burst of messages' });

  client.registerCommand('burstconfig', async (c, m, args) => {
    const s = readSettings();
    const key = (args[0] || '').toLowerCase();
    const value = args[1];
    if (!key) {
      return m.edit(codeblock('burst · config', [
        'count <n>       messages per burst',
        'delay <ms>      delay between messages',
        'proxy <url|off> proxy for burst',
        '',
        'CURRENT',
        '  count   ' + s.burst.count,
        '  delay   ' + s.burst.delay + 'ms',
        '  proxy   ' + (s.burst.proxy || 'off')
      ].join('\n')));
    }
    if (key === 'count') {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 1 || n > 500) return m.edit(codeblock('burstconfig', '1-500'));
      s.burst.count = n;
      saveSettings(s);
      return m.edit(codeblock('burst · config', kv([['count', n]])));
    }
    if (key === 'delay') {
      const n = parseInt(value, 10);
      if (isNaN(n) || n < 50) return m.edit(codeblock('burstconfig', 'min 50ms'));
      s.burst.delay = n;
      saveSettings(s);
      return m.edit(codeblock('burst · config', kv([['delay', n + 'ms']])));
    }
    if (key === 'proxy') {
      s.burst.proxy = value === 'off' ? null : value;
      saveSettings(s);
      return m.edit(codeblock('burst · config', kv([['proxy', s.burst.proxy || 'off']])));
    }
    await m.edit(codeblock('burstconfig', 'count · delay · proxy'));
  }, { aliases: ['bconfig'], category: 'beefy', description: 'burst config' });

  client.registerCommand('burstfile', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'list' || !sub) {
      const lines = readLines(BURST_FILE);
      return m.edit(codeblock('burst · lines (' + lines.length + ')', lines.slice(0, 40).join('\n')));
    }
    if (sub === 'add') {
      const text = args.slice(1).join(' ');
      if (!text) return m.edit(codeblock('burstfile', 'usage: burstfile add <text>'));
      const lines = readLines(BURST_FILE);
      lines.push(text);
      fs.writeFileSync(BURST_FILE, lines.join('\n'));
      return m.edit(codeblock('burstfile', kv([['added', text], ['total', lines.length]])));
    }
    if (sub === 'reset') {
      fs.writeFileSync(BURST_FILE, BURST_DEFAULTS.join('\n'));
      return m.edit(codeblock('burstfile', 'reset'));
    }
    await m.edit(codeblock('burstfile', 'list · add <text> · reset'));
  }, { aliases: ['bfile'], category: 'beefy', description: 'manage burst.txt' });
}

module.exports = { register };
