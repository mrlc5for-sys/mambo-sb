const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const rotators = new Map();

function getRpc(c) {
  if (!c.cfg.rpc) c.cfg.rpc = {};
  return c.cfg.rpc;
}

function save(c) {
  fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2));
}

async function setCustomStatus(c, emoji, text, status) {
  try {
    const parsed = emoji ? emoji.match(/^<(a)?:(\w+):(\d+)>$/) : null;
    const cs = { text: text || '' };
    if (parsed) { cs.emoji_name = parsed[2]; cs.emoji_id = parsed[3]; }
    else if (emoji && emoji.length <= 4) cs.emoji_name = emoji;
    await axios.patch('https://discord.com/api/v10/users/@me/settings', { custom_status: cs, status: status || 'online' }, { headers: { authorization: c.token } });
    return true;
  } catch (e) { return false; }
}

function stopRotator(c) {
  if (rotators.has(c.uid)) {
    clearInterval(rotators.get(c.uid));
    rotators.delete(c.uid);
  }
}

function register(client) {
  client.registerCommand('presence', async (c, m) => {
    await m.edit(codeblock('presence', [
      'cstatus <emoji> <text>    set custom status',
      'cstatus off                clear custom status',
      'rotator add <emoji> <text> add rotating status',
      'rotator remove <n>         remove status',
      'rotator list               list statuses',
      'rotator start              start rotation',
      'rotator stop               stop rotation',
      'rotator interval <sec>     set interval'
    ].join('\n')));
  }, { category: 'presence', description: 'presence menu', sticky: true });

  client.registerCommand('cstatus', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'off' || sub === 'clear') {
      c.cfg.custom_status = '';
      c.cfg.custom_emoji = '';
      save(c);
      await setCustomStatus(c, null, '', 'online');
      return m.edit(codeblock('cstatus', 'cleared'));
    }
    const emoji = args[0];
    const text = args.slice(1).join(' ');
    if (!emoji) return m.edit(codeblock('cstatus', 'usage: cstatus <emoji> <text> | off'));
    c.cfg.custom_status = text;
    c.cfg.custom_emoji = emoji;
    save(c);
    const ok = await setCustomStatus(c, emoji, text, 'online');
    await m.edit(codeblock('cstatus', kv([['emoji', emoji], ['text', text || '—'], ['status', ok ? 'applied' : 'failed']])));
  }, { aliases: ['cs', 'customstatus'], category: 'presence', description: 'custom status' });

  client.registerCommand('rotator', async (c, m, args) => {
    if (!c.cfg.rotator) c.cfg.rotator = { interval: 10, entries: [] };
    const rot = c.cfg.rotator;
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'add') {
      const emoji = args[1];
      const text = args.slice(2).join(' ') || '';
      if (!emoji) return m.edit(codeblock('rotator', 'usage: rotator add <emoji> <text>'));
      rot.entries.push({ emoji, text });
      save(c);
      return m.edit(codeblock('rotator', kv([['added', '#' + rot.entries.length]])));
    }
    if (sub === 'remove') {
      const idx = parseInt(args[1], 10);
      if (isNaN(idx) || idx < 1 || idx > rot.entries.length) return m.edit(codeblock('rotator', 'invalid index'));
      rot.entries.splice(idx - 1, 1);
      save(c);
      if (!rot.entries.length) stopRotator(c);
      return m.edit(codeblock('rotator', kv([['removed', '#' + idx]])));
    }
    if (sub === 'list' || !sub) {
      if (!rot.entries.length) return m.edit(codeblock('rotator', 'no entries'));
      return m.edit(codeblock('rotator · list', rot.entries.map((e, i) => '#' + (i + 1) + '  ' + e.emoji + '  ' + e.text).join('\n')));
    }
    if (sub === 'start') {
      if (!rot.entries.length) return m.edit(codeblock('rotator', 'no entries'));
      stopRotator(c);
      let idx = 0;
      const run = async () => {
        const e = rot.entries[idx % rot.entries.length];
        idx++;
        await setCustomStatus(c, e.emoji, e.text, 'online');
        await new Promise(r => setTimeout(r, 500));
      };
      await run();
      const id = setInterval(run, Math.max(3, rot.interval) * 1000);
      rotators.set(c.uid, id);
      return m.edit(codeblock('rotator', kv([['running', 'interval ' + rot.interval + 's']])));
    }
    if (sub === 'stop') {
      stopRotator(c);
      return m.edit(codeblock('rotator', 'stopped'));
    }
    if (sub === 'interval') {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 3) return m.edit(codeblock('rotator', 'min 3 seconds'));
      rot.interval = n;
      save(c);
      return m.edit(codeblock('rotator', kv([['interval', n + 's']])));
    }
    await m.edit(codeblock('rotator', 'add · remove · list · start · stop · interval'));
  }, { aliases: ['statusrotator'], category: 'presence', description: 'rotating statuses', sticky: true });
}

module.exports = { register };
