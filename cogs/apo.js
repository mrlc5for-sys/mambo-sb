const fs = require('fs');
const path = require('path');
const { codeblock, menu, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const PRESETS_DIR = path.join(ROOT, 'data', 'apo-presets');

const BUILT_IN = {
  flat: 'Preamp: 0 dB\nFilter 1: ON PK Fc 60 Hz Gain 0 dB Q 1\nFilter 2: ON PK Fc 250 Hz Gain 0 dB Q 1\nFilter 3: ON PK Fc 1000 Hz Gain 0 dB Q 1\nFilter 4: ON PK Fc 4000 Hz Gain 0 dB Q 1\nFilter 5: ON PK Fc 12000 Hz Gain 0 dB Q 1',
  bass: 'Preamp: -3 dB\nFilter 1: ON PK Fc 60 Hz Gain 8 dB Q 1\nFilter 2: ON PK Fc 120 Hz Gain 6 dB Q 1\nFilter 3: ON PK Fc 250 Hz Gain 4 dB Q 1\nFilter 4: ON PK Fc 1000 Hz Gain 0 dB Q 1\nFilter 5: ON PK Fc 4000 Hz Gain 0 dB Q 1',
  treble: 'Preamp: -3 dB\nFilter 1: ON PK Fc 60 Hz Gain 0 dB Q 1\nFilter 2: ON PK Fc 250 Hz Gain 0 dB Q 1\nFilter 3: ON PK Fc 1000 Hz Gain 2 dB Q 1\nFilter 4: ON PK Fc 4000 Hz Gain 6 dB Q 1\nFilter 5: ON PK Fc 12000 Hz Gain 8 dB Q 1',
  vocal: 'Preamp: -2 dB\nFilter 1: ON PK Fc 60 Hz Gain -4 dB Q 1\nFilter 2: ON PK Fc 250 Hz Gain -2 dB Q 1\nFilter 3: ON PK Fc 1000 Hz Gain 3 dB Q 1\nFilter 4: ON PK Fc 3000 Hz Gain 4 dB Q 1\nFilter 5: ON PK Fc 8000 Hz Gain 2 dB Q 1',
  nightcore: 'Preamp: -4 dB\nFilter 1: ON PK Fc 60 Hz Gain 4 dB Q 1\nFilter 2: ON PK Fc 250 Hz Gain 3 dB Q 1\nFilter 3: ON PK Fc 1000 Hz Gain 2 dB Q 1\nFilter 4: ON PK Fc 4000 Hz Gain 5 dB Q 1\nFilter 5: ON PK Fc 12000 Hz Gain 6 dB Q 1',
  slowed: 'Preamp: 0 dB\nFilter 1: ON PK Fc 60 Hz Gain 6 dB Q 1\nFilter 2: ON PK Fc 250 Hz Gain 4 dB Q 1\nFilter 3: ON PK Fc 1000 Hz Gain -2 dB Q 1\nFilter 4: ON PK Fc 4000 Hz Gain -4 dB Q 1\nFilter 5: ON PK Fc 12000 Hz Gain -6 dB Q 1',
  earrape: 'Preamp: 12 dB\nFilter 1: ON PK Fc 60 Hz Gain 12 dB Q 1\nFilter 2: ON PK Fc 250 Hz Gain 10 dB Q 1\nFilter 3: ON PK Fc 1000 Hz Gain 10 dB Q 1\nFilter 4: ON PK Fc 4000 Hz Gain 12 dB Q 1\nFilter 5: ON PK Fc 12000 Hz Gain 10 dB Q 1',
  gaming: 'Preamp: -3 dB\nFilter 1: ON PK Fc 60 Hz Gain -2 dB Q 1\nFilter 2: ON PK Fc 250 Hz Gain 0 dB Q 1\nFilter 3: ON PK Fc 2000 Hz Gain 4 dB Q 1\nFilter 4: ON PK Fc 4000 Hz Gain 5 dB Q 1\nFilter 5: ON PK Fc 8000 Hz Gain 3 dB Q 1'
};

function ensure() { try { fs.mkdirSync(PRESETS_DIR, { recursive: true }); } catch (e) {} }

function seed() {
  ensure();
  for (const [name, txt] of Object.entries(BUILT_IN)) {
    const p = path.join(PRESETS_DIR, name + '.txt');
    if (!fs.existsSync(p)) fs.writeFileSync(p, txt);
  }
}

function listPresets() {
  ensure();
  return fs.readdirSync(PRESETS_DIR).filter(f => f.endsWith('.txt')).map(f => f.replace(/\.txt$/, ''));
}

function readPreset(name) {
  const p = path.join(PRESETS_DIR, name + '.txt');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}

function writePreset(name, content) {
  ensure();
  fs.writeFileSync(path.join(PRESETS_DIR, name + '.txt'), content);
}

function parseEq(txt) {
  const lines = (txt || '').split('\n');
  let preamp = 0;
  const bands = [];
  for (const line of lines) {
    const p = line.match(/Preamp:\s*(-?[\d.]+)/i);
    if (p) preamp = parseFloat(p[1]);
    const f = line.match(/Filter\s+\d+:\s+\S+\s+\S+\s+Fc\s+([\d.]+)\s+Hz\s+Gain\s+(-?[\d.]+)/i);
    if (f) bands.push({ freq: parseFloat(f[1]), gain: parseFloat(f[2]) });
  }
  return { preamp, bands };
}

function buildEqTxt(preamp, bands) {
  const lines = ['Preamp: ' + (preamp || 0) + ' dB'];
  bands.forEach((b, i) => lines.push('Filter ' + (i + 1) + ': ON PK Fc ' + b.freq + ' Hz Gain ' + b.gain + ' dB Q 1'));
  return lines.join('\n');
}

function register(client) {
  seed();

  client.registerCommand('apo', async (c, m) => {
    const presets = listPresets();
    await m.edit(menu('apo', [
      'list                    list presets',
      'use <name>              apply preset',
      'save <name>             save current',
      'delete <name>           remove preset',
      'rename <a> <b>          rename',
      'edit <name>             show preset',
      'flat                    reset neutral',
      '',
      'eq gain <dB>            preamp',
      'eq bands <b> <m> <t>    three-band',
      'eq bass <dB>            bass only',
      'eq treble <dB>          treble only',
      'eq custom <f:dB> ...    multiband',
      'eq reset                flat',
      '',
      'presets   ' + presets.length
    ]));
  }, { category: 'apo', description: 'apo menu', sticky: true });

  client.registerCommand('apo-list', async (c, m) => {
    const presets = listPresets();
    if (!presets.length) return m.edit(codeblock('apo · list', 'no presets'));
    await m.edit(codeblock('apo · presets', presets.sort().map((p, i) => '#' + (i + 1) + '  ' + p).join('\n')));
  }, { aliases: ['apolist'], category: 'apo', description: 'list presets' });

  client.registerCommand('apo-use', async (c, m, args) => {
    const name = (args[0] || '').toLowerCase();
    if (!name) return m.edit(codeblock('apo', 'usage: apo use <name>'));
    if (!readPreset(name)) return m.edit(codeblock('apo', 'preset not found'));
    c.cfg.apo = { active: name };
    fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2));
    await m.edit(codeblock('apo · use', kv([['preset', name], ['status', 'active']])));
  }, { aliases: ['apouse'], category: 'apo', description: 'apply preset' });

  client.registerCommand('apo-save', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('apo', 'usage: apo save <name>'));
    const active = c.cfg.apo && c.cfg.apo.active;
    if (!active) return m.edit(codeblock('apo', 'nothing active'));
    writePreset(name, readPreset(active));
    await m.edit(codeblock('apo · save', kv([['name', name]])));
  }, { aliases: ['aposave'], category: 'apo', description: 'save preset' });

  client.registerCommand('apo-delete', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('apo', 'usage: apo delete <name>'));
    const p = path.join(PRESETS_DIR, name + '.txt');
    if (!fs.existsSync(p)) return m.edit(codeblock('apo', 'not found'));
    fs.unlinkSync(p);
    await m.edit(codeblock('apo · delete', kv([['removed', name]])));
  }, { aliases: ['apodelete'], category: 'apo', description: 'delete preset' });

  client.registerCommand('apo-edit', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('apo', 'usage: apo edit <name>'));
    const txt = readPreset(name);
    if (!txt) return m.edit(codeblock('apo', 'not found'));
    await m.edit('> ```\n> ' + txt.split('\n').join('\n> ') + '\n> ```');
  }, { aliases: ['apoedit'], category: 'apo', description: 'show preset' });

  client.registerCommand('eq', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (!sub) return m.edit(codeblock('eq', 'gain · bands · bass · treble · custom · reset'));

    if (sub === 'gain') {
      const db = parseFloat(args[1]);
      if (isNaN(db)) return m.edit(codeblock('eq', 'gain <dB>'));
      writePreset('custom', buildEqTxt(db, parseEq(readPreset('flat')).bands));
      return m.edit(codeblock('eq · gain', kv([['preamp', db + ' dB']])));
    }

    if (sub === 'bands') {
      const b = parseFloat(args[1]);
      const mid = parseFloat(args[2]);
      const t = parseFloat(args[3]);
      if ([b, mid, t].some(v => isNaN(v))) return m.edit(codeblock('eq', 'bands <bass> <mid> <treble>'));
      const bands = [{ freq: 60, gain: b }, { freq: 250, gain: b * 0.5 }, { freq: 1000, gain: mid }, { freq: 4000, gain: t * 0.5 }, { freq: 12000, gain: t }];
      writePreset('custom', buildEqTxt(0, bands));
      return m.edit(codeblock('eq · bands', kv([['bass', b], ['mid', mid], ['treble', t]])));
    }

    if (sub === 'bass') {
      const db = parseFloat(args[1]);
      if (isNaN(db)) return m.edit(codeblock('eq', 'bass <dB>'));
      const bands = [{ freq: 60, gain: db }, { freq: 120, gain: db * 0.7 }, { freq: 250, gain: db * 0.5 }, { freq: 1000, gain: 0 }, { freq: 4000, gain: 0 }, { freq: 12000, gain: 0 }];
      writePreset('custom', buildEqTxt(0, bands));
      return m.edit(codeblock('eq · bass', kv([['gain', db + ' dB']])));
    }

    if (sub === 'treble') {
      const db = parseFloat(args[1]);
      if (isNaN(db)) return m.edit(codeblock('eq', 'treble <dB>'));
      const bands = [{ freq: 60, gain: 0 }, { freq: 250, gain: 0 }, { freq: 1000, gain: db * 0.3 }, { freq: 4000, gain: db * 0.7 }, { freq: 8000, gain: db }, { freq: 12000, gain: db }];
      writePreset('custom', buildEqTxt(0, bands));
      return m.edit(codeblock('eq · treble', kv([['gain', db + ' dB']])));
    }

    if (sub === 'custom') {
      const pairs = args.slice(1);
      if (!pairs.length) return m.edit(codeblock('eq', 'custom 60:+8 250:+6 1000:-2'));
      const bands = [];
      for (const p of pairs) {
        const parts = p.split(':');
        const freq = parseFloat(parts[0]);
        const gain = parseFloat(parts[1]);
        if (isNaN(freq) || isNaN(gain)) continue;
        bands.push({ freq, gain });
      }
      if (!bands.length) return m.edit(codeblock('eq', 'invalid bands'));
      writePreset('custom', buildEqTxt(0, bands));
      const bars = bands.map(b => {
        const width = 16;
        const norm = Math.max(-15, Math.min(15, b.gain));
        const filled = Math.round(((norm + 15) / 30) * width);
        return b.freq + ' Hz  ' + (b.gain >= 0 ? '+' : '') + b.gain.toFixed(1) + ' dB  ' + '█'.repeat(filled) + '░'.repeat(width - filled);
      });
      return m.edit(codeblock('eq · custom', bars.join('\n')));
    }

    if (sub === 'reset') {
      writePreset('custom', BUILT_IN.flat);
      return m.edit(codeblock('eq', 'reset to flat'));
    }

    await m.edit(codeblock('eq', 'gain · bands · bass · treble · custom · reset'));
  }, { category: 'apo', description: 'quick EQ control' });

  for (const name of Object.keys(BUILT_IN)) {
    const cmdName = 'apo-' + name;
    if (client.commands.has(cmdName)) continue;
    client.registerCommand(cmdName, async (cc, mm) => {
      writePreset(name, BUILT_IN[name]);
      cc.cfg.apo = { active: name };
      fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(cc.cfg, null, 2));
      await mm.edit(codeblock('apo · ' + name, 'applied'));
    }, { aliases: ['apo' + name.replace('-', '')], category: 'apo', description: name + ' preset' });
  }
}

module.exports = { register };
