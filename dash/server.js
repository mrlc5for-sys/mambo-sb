const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const users = require('../helpers/users');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const config = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        let value = (match[2] || '').trim();
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        config[match[1]] = value;
      }
    }
  }
  return config;
}

const env = loadEnv();
const APP_USER = env.APP_USER || 'admin';
const APP_PASS = env.APP_PASS || 'admin';

const sessions = new Map();

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(c => {
    const [k, v] = c.split('=').map(s => s.trim());
    if (k) cookies[k] = decodeURIComponent(v || '');
  });
  return cookies;
}

function newSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { ...user, at: Date.now() });
  return token;
}

function getSession(req) {
  const cookies = parseCookies(req);
  const token = cookies.session;
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.at > 7 * 24 * 60 * 60 * 1000) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function sendJson(res, code, obj, extra) {
  const headers = { 'Content-Type': 'application/json' };
  if (extra) Object.assign(headers, extra);
  res.writeHead(code, headers);
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(resolve => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve(null); }
    });
  });
}

function findClient(clients, dashUser) {
  return clients.find(c => c.user && c.dashUser === dashUser);
}

function findClientById(clients, userId) {
  return clients.find(c => c.user && c.user.id === userId);
}

function start(clients, hooks) {
  hooks = hooks || {};
  const port = 3000;
  const publicDir = path.join(__dirname, 'public');

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/login' && req.method === 'POST') {
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      if (data.user === APP_USER && data.pass === APP_PASS) {
        const token = newSession({ username: 'admin', role: 'owner' });
        return sendJson(res, 200, { success: true, role: 'owner', username: 'admin' },
          { 'Set-Cookie': 'session=' + token + '; Path=/; HttpOnly; Max-Age=' + (7 * 24 * 3600) });
      }
      const u = users.verify(data.user, data.pass);
      if (!u) return sendJson(res, 401, { success: false, error: 'Invalid username or password' });
      const token = newSession({ username: u.username, role: u.role || 'user', userId: u.id });
      return sendJson(res, 200, { success: true, role: u.role || 'user', username: u.username },
        { 'Set-Cookie': 'session=' + token + '; Path=/; HttpOnly; Max-Age=' + (7 * 24 * 3600) });
    }

    if (url === '/api/logout' && req.method === 'POST') {
      const cookies = parseCookies(req);
      if (cookies.session) sessions.delete(cookies.session);
      return sendJson(res, 200, { success: true }, { 'Set-Cookie': 'session=; Path=/; Max-Age=0' });
    }

    if (url === '/api/me' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username) || (s.username === 'admin' ? clients[0] : null);
      if (!c || !c.user) return sendJson(res, 200, { success: false, error: 'Bot not ready' });
      const u = c.user;
      const uptimeSec = Math.floor((Date.now() - (c.startTime || Date.now())) / 1000);
      sendJson(res, 200, {
        success: true,
        role: s.role,
        username: s.username,
        user: {
          id: u.id,
          username: u.username,
          tag: u.tag || u.username,
          global_name: u.globalName || null,
          avatar: u.displayAvatarURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        uptime: uptimeSec,
        rpc: c.cfg.rpc || {},
        cmds: c.commands.size
      });
      return;
    }

    if (url === '/api/commands' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username) || (s.username === 'admin' ? clients[0] : null);
      if (!c) return sendJson(res, 404, { success: false, error: 'No client' });
      const byCategory = {};
      for (const e of c.commands.values()) {
        if (!byCategory[e.category]) byCategory[e.category] = [];
        byCategory[e.category].push({
          name: e.name,
          description: e.description,
          usage: e.usage,
          aliases: e.aliases
        });
      }
      for (const k in byCategory) byCategory[k].sort((a, b) => a.name.localeCompare(b.name));
      sendJson(res, 200, { success: true, commands: byCategory, total: c.commands.size });
      return;
    }

    if (url === '/api/rpc/presets' && req.method === 'GET') {
      const rpcCog = require('../cogs/rpc');
      const list = Object.entries(rpcCog.PRESETS).map(([key, p]) => ({
        key, name: p.name, type: p.type, appId: p.appId
      }));
      sendJson(res, 200, { success: true, presets: list });
      return;
    }

    if (url === '/api/rpc/apply' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      try {
        const rpcCog = require('../cogs/rpc');
        rpcCog.stopStack(c);
        const preset = rpcCog.PRESETS[data.appKey] || rpcCog.PRESETS.spotify;
        const r = {
          key: data.appKey,
          enabled: true,
          type: data.type || preset.type || 'PLAYING',
          name: data.name || preset.name,
          details: data.details || '',
          state: data.state || '',
          largeImage: data.largeImage || (rpcCog.LOGOS && rpcCog.LOGOS[data.appKey]) || '',
          largeText: preset.largeText || preset.name || '',
          smallImage: '',
          smallText: '',
          button1Label: data.button1Label || '',
          button1URL: data.button1URL || '',
          button2Label: data.button2Label || '',
          button2URL: data.button2URL || '',
          appId: data.appId || preset.appId || '',
          url: preset.url || '',
          status: 'online',
          start: Date.now()
        };
        c.cfg.rpc = r;
        fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
        await rpcCog.push(c);
        sendJson(res, 200, { success: true, rpc: r });
      } catch (e) {
        sendJson(res, 500, { success: false, error: e.message });
      }
      return;
    }

    if (url === '/api/rpc/clear' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      try {
        const rpcCog = require('../cogs/rpc');
        rpcCog.stopStack(c);
        c.cfg.rpc = { enabled: false, type: 'PLAYING', name: '', details: '', state: '' };
        fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
        try { c.user.setPresence({ activities: [], status: 'online' }); } catch (e) {}
        sendJson(res, 200, { success: true });
      } catch (e) {
        sendJson(res, 500, { success: false, error: e.message });
      }
      return;
    }

    if (url === '/api/rpc/stack' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const stack = c.cfg.rpc_stack || { enabled: false, primary: null, secondary: null, extras: [] };
      sendJson(res, 200, { success: true, stack });
      return;
    }

    if (url === '/api/rpc/stack/primary' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      const preset = rpcCog.PRESETS[data.preset];
      if (!preset) return sendJson(res, 400, { success: false, error: 'Invalid preset' });
      if (!c.cfg.rpc_stack) c.cfg.rpc_stack = { enabled: false, primary: null, secondary: null, extras: [] };
      c.cfg.rpc_stack.primary = {
        key: data.preset, name: preset.name, type: data.type || preset.type,
        details: data.details || '', state: data.state || '',
        largeImage: (rpcCog.LOGOS && rpcCog.LOGOS[data.preset]) || '',
        largeText: preset.largeText || preset.name,
        appId: preset.appId || '',
        start: Date.now(), status: 'online'
      };
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      if (c.cfg.rpc_stack.enabled) await rpcCog.pushStack(c);
      sendJson(res, 200, { success: true, stack: c.cfg.rpc_stack });
      return;
    }

    if (url === '/api/rpc/stack/add' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      const preset = rpcCog.PRESETS[data.preset];
      if (!preset) return sendJson(res, 400, { success: false, error: 'Invalid preset' });
      if (!c.cfg.rpc_stack) c.cfg.rpc_stack = { enabled: false, primary: null, secondary: null, extras: [] };
      if (!c.cfg.rpc_stack.extras) c.cfg.rpc_stack.extras = [];
      c.cfg.rpc_stack.extras.push({
        key: data.preset,
        name: preset.name,
        type: data.type || preset.type,
        largeImage: (rpcCog.LOGOS && rpcCog.LOGOS[data.preset]) || '',
        largeText: preset.largeText || preset.name
      });
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      if (c.cfg.rpc_stack.enabled) await rpcCog.pushStack(c);
      sendJson(res, 200, { success: true, stack: c.cfg.rpc_stack });
      return;
    }

    if (url === '/api/rpc/stack/status' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      if (!c.cfg.rpc_stack) c.cfg.rpc_stack = { enabled: false, primary: null, secondary: null, extras: [] };
      if (data.clear) c.cfg.rpc_stack.secondary = null;
      else c.cfg.rpc_stack.secondary = { emoji: data.emoji || '', text: data.text || '' };
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      if (c.cfg.rpc_stack.enabled) await rpcCog.pushStack(c);
      sendJson(res, 200, { success: true, stack: c.cfg.rpc_stack });
      return;
    }

    if (url === '/api/rpc/stack/edit' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      if (!c.cfg.rpc_stack || !c.cfg.rpc_stack.extras) return sendJson(res, 400, { success: false, error: 'No extras' });
      const idx = (data.index || 0) - 1;
      if (idx < 0 || idx >= c.cfg.rpc_stack.extras.length) return sendJson(res, 400, { success: false, error: 'Invalid index' });
      const e = c.cfg.rpc_stack.extras[idx];
      const f = data.fields || {};
      if (f.nameOverride !== undefined && f.nameOverride !== '') e.nameOverride = f.nameOverride;
      if (f.nameOverride === '') delete e.nameOverride;
      if (f.details !== undefined) e.details = f.details;
      if (f.state !== undefined) e.state = f.state;
      if (f.largeImage !== undefined) e.largeImage = f.largeImage;
      if (f.button1Label !== undefined) e.button1Label = f.button1Label;
      if (f.button1URL !== undefined) e.button1URL = f.button1URL;
      if (f.button2Label !== undefined) e.button2Label = f.button2Label;
      if (f.button2URL !== undefined) e.button2URL = f.button2URL;
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      if (c.cfg.rpc_stack.enabled) {
        const rpcCog = require('../cogs/rpc');
        if (rpcCog.pushStack) await rpcCog.pushStack(c);
      }
      sendJson(res, 200, { success: true, stack: c.cfg.rpc_stack });
      return;
    }

    if (url === '/api/rpc/stack/remove' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      if (!c.cfg.rpc_stack || !c.cfg.rpc_stack.extras) return sendJson(res, 400, { success: false, error: 'No extras' });
      const idx = data.index - 1;
      if (idx < 0 || idx >= c.cfg.rpc_stack.extras.length) return sendJson(res, 400, { success: false, error: 'Invalid index' });
      c.cfg.rpc_stack.extras.splice(idx, 1);
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      if (c.cfg.rpc_stack.enabled) {
        const rpcCog = require('../cogs/rpc');
        await rpcCog.pushStack(c);
      }
      sendJson(res, 200, { success: true, stack: c.cfg.rpc_stack });
      return;
    }

    if (url === '/api/rpc/stack/start' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      const stack = rpcCog.getStack(c);
      if (!stack.primary) return sendJson(res, 400, { success: false, error: 'Set a primary first' });
      stack.enabled = true;
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      await rpcCog.pushStack(c);
      sendJson(res, 200, { success: true, stack });
      return;
    }

    if (url === '/api/rpc/stack/stop' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      rpcCog.stopStack(c);
      try { c.user.setPresence({ activities: [], status: 'online' }); } catch (e) {}
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/rpc/stack/clear' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      rpcCog.stopStack(c);
      c.cfg.rpc_stack = { enabled: false, primary: null, secondary: null, extras: [] };
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      try { c.user.setPresence({ activities: [], status: 'online' }); } catch (e) {}
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/customstatus' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      sendJson(res, 200, { success: true, status: { emoji: c.cfg.custom_emoji || '', text: c.cfg.custom_status || '' } });
      return;
    }

    if (url === '/api/customstatus' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      c.cfg.custom_emoji = data.emoji || '';
      c.cfg.custom_status = data.text || '';
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      await rpcCog.push(c);
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/customstatus/clear' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      c.cfg.custom_emoji = '';
      c.cfg.custom_status = '';
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      try {
        const axios = require('axios');
        await axios.patch('https://discord.com/api/v10/users/@me/settings', { custom_status: null }, { headers: { authorization: c.token } });
      } catch (e) {}
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/rotator' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rot = c.cfg.rotator || { interval: 15, entries: [], index: 0, enabled: false };
      sendJson(res, 200, { success: true, rotator: rot });
      return;
    }

    if (url === '/api/rotator/add' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      if (!c.cfg.rotator) c.cfg.rotator = { interval: 15, entries: [], index: 0, enabled: false };
      if (!data.emoji) return sendJson(res, 400, { success: false, error: 'emoji required' });
      c.cfg.rotator.entries.push({ emoji: data.emoji, text: data.text || '' });
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      sendJson(res, 200, { success: true, rotator: c.cfg.rotator });
      return;
    }

    if (url === '/api/rotator/remove' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      if (!c.cfg.rotator || !c.cfg.rotator.entries) return sendJson(res, 400, { success: false, error: 'No entries' });
      const idx = data.index - 1;
      if (idx < 0 || idx >= c.cfg.rotator.entries.length) return sendJson(res, 400, { success: false, error: 'Invalid index' });
      c.cfg.rotator.entries.splice(idx, 1);
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      sendJson(res, 200, { success: true, rotator: c.cfg.rotator });
      return;
    }

    if (url === '/api/rotator/interval' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      if (!c.cfg.rotator) c.cfg.rotator = { interval: 15, entries: [], index: 0, enabled: false };
      const n = Math.max(5, parseInt(data.interval, 10) || 15);
      c.cfg.rotator.interval = n;
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      if (c.cfg.rotator.enabled) {
        const rpcCog = require('../cogs/rpc');
        if (rpcCog.startRotator) rpcCog.startRotator(c);
      }
      sendJson(res, 200, { success: true, interval: n });
      return;
    }

    if (url === '/api/rotator/start' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      if (!c.cfg.rotator || !c.cfg.rotator.entries || !c.cfg.rotator.entries.length) return sendJson(res, 400, { success: false, error: 'No entries' });
      c.cfg.rotator.enabled = true;
      c.cfg.rotator.index = 0;
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      if (rpcCog.startRotator) rpcCog.startRotator(c);
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/rotator/stop' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      if (!c.cfg.rotator) c.cfg.rotator = { interval: 15, entries: [], index: 0, enabled: false };
      c.cfg.rotator.enabled = false;
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      const rpcCog = require('../cogs/rpc');
      if (rpcCog.stopRotator) rpcCog.stopRotator(c);
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/rotator/clear' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      c.cfg.rotator = { interval: 15, entries: [], index: 0, enabled: false };
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      const rpcCog = require('../cogs/rpc');
      if (rpcCog.stopRotator) rpcCog.stopRotator(c);
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/voice/guilds' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c || !c.user) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const guilds = c.guilds.cache.map(g => ({ id: g.id, name: g.name, icon: g.iconURL({ dynamic: true }) || null }));
      sendJson(res, 200, { success: true, guilds });
      return;
    }

    if (url.startsWith('/api/voice/channels/') && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c || !c.user) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const guildId = url.split('/').pop();
      const guild = c.guilds.cache.get(guildId);
      if (!guild) return sendJson(res, 404, { success: false, error: 'Guild not found' });
      const channels = guild.channels.cache.filter(ch => ch.type === 'GUILD_VOICE' || ch.type === 'GUILD_STAGE_VOICE').map(ch => ({ id: ch.id, name: ch.name }));
      sendJson(res, 200, { success: true, channels });
      return;
    }

    if (url === '/api/voice/join' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c || !c.user) return sendJson(res, 404, { success: false, error: 'Client not found' });
      try {
        c._vcChannel = data.channelId;
        c._vcGuild = data.guildId;
        const shard = c.ws.shards.first();
        if (shard) shard.send({ op: 4, d: { guild_id: data.guildId, channel_id: data.channelId, self_mute: false, self_deaf: false } });
        sendJson(res, 200, { success: true });
      } catch (e) { sendJson(res, 500, { success: false, error: e.message }); }
      return;
    }

    if (url === '/api/voice/leave' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c || !c.user) return sendJson(res, 404, { success: false, error: 'Client not found' });
      try {
        const shard = c.ws.shards.first();
        if (shard && c._vcGuild) shard.send({ op: 4, d: { guild_id: c._vcGuild, channel_id: null, self_mute: false, self_deaf: false } });
        c._vcChannel = null;
        c._vcGuild = null;
        sendJson(res, 200, { success: true });
      } catch (e) { sendJson(res, 500, { success: false, error: e.message }); }
      return;
    }

    if (url === '/api/voice/status' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c || !c.user) return sendJson(res, 404, { success: false, error: 'Client not found' });
      sendJson(res, 200, { success: true, connected: !!(c._vcGuild && c._vcChannel), guildId: c._vcGuild || null, channelId: c._vcChannel || null });
      return;
    }

    if (url === '/api/users' && req.method === 'GET') {
      const s = getSession(req);
      if (!s || (s.role !== 'owner' && s.role !== 'admin')) return sendJson(res, 403, { success: false, error: 'Insufficient role' });
      const list = users.all().map(u => {
        const c = findClient(clients, u.username);
        return {
          id: u.id,
          username: u.username,
          role: u.role || 'user',
          created: u.created,
          online: !!c,
          tag: c && c.user ? c.user.tag : null,
          hasToken: !!u.token
        };
      });
      sendJson(res, 200, { success: true, users: list });
      return;
    }

    if (url === '/api/users' && req.method === 'POST') {
      const s = getSession(req);
      if (!s || (s.role !== 'owner' && s.role !== 'admin')) return sendJson(res, 403, { success: false, error: 'Insufficient role' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      if (data.role === 'owner' && s.role !== 'owner') {
        return sendJson(res, 403, { success: false, error: 'Only owner can create owners' });
      }
      const result = users.add({
        username: data.username,
        password: data.password,
        token: data.token,
        role: data.role || 'user'
      });
      if (!result.ok) return sendJson(res, 400, { success: false, error: result.reason });
      if (hooks.addUser && result.user.token) {
        try { await hooks.addUser(result.user); } catch (e) {}
      }
      sendJson(res, 200, { success: true, user: { id: result.user.id, username: result.user.username, role: result.user.role } });
      return;
    }

    if (url.startsWith('/api/users/') && req.method === 'PATCH') {
      const s = getSession(req);
      if (!s || s.role !== 'owner') return sendJson(res, 403, { success: false, error: 'Owner only' });
      const id = url.split('/').pop();
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const result = users.update(id, data);
      if (!result.ok) return sendJson(res, 400, { success: false, error: result.reason });
      sendJson(res, 200, { success: true, user: { id: result.user.id, username: result.user.username, role: result.user.role } });
      return;
    }

    if (url.startsWith('/api/users/') && req.method === 'DELETE') {
      const s = getSession(req);
      if (!s || s.role !== 'owner') return sendJson(res, 403, { success: false, error: 'Owner only' });
      const id = url.split('/').pop();
      const result = users.remove(id);
      if (!result.ok) return sendJson(res, 400, { success: false, error: result.reason });
      const c = findClient(clients, result.user.username);
      if (c) {
        try { c.destroy(); } catch (e) {}
        const idx = clients.indexOf(c);
        if (idx !== -1) clients.splice(idx, 1);
      }
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/clients' && req.method === 'GET') {
      const s = getSession(req);
      if (!s || (s.role !== 'owner' && s.role !== 'admin')) return sendJson(res, 403, { success: false, error: 'Insufficient role' });
      const list = clients.map(c => ({
        dashUser: c.dashUser,
        role: c.dashRole,
        online: !!c.user,
        tag: c.user ? c.user.tag : null,
        id: c.user ? c.user.id : null,
        uid: c.uid
      }));
      sendJson(res, 200, { success: true, clients: list });
      return;
    }

    const ext = path.extname(url);
    let contentType = 'text/html';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'application/javascript';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    if (ext && ext !== '.html') {
      fs.readFile(path.join(publicDir, url), (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); }
        else { res.writeHead(200, { 'Content-Type': contentType }); res.end(data); }
      });
    } else {
      fs.readFile(path.join(publicDir, 'index.html'), 'utf8', (err, html) => {
        if (err) { res.writeHead(500); res.end('Error loading index'); }
        else { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); }
      });
    }
  });

  server.listen(port, () => {
    console.log('Dashboard running at http://localhost:' + port);
  });
}

module.exports = { start };
