const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const users = require('../helpers/users');
const Database = require('../helpers/database');
const axios = require('axios');

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

function start(clients, hooks) {
  hooks = hooks || {};
  const port = process.env.PORT || 3000;
  const publicDir = path.join(__dirname, 'public');

  const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/api/auth/callback' && req.method === 'GET') {
      const code = new URL(req.url, 'http://localhost').searchParams.get('code');
      if (!code) return sendJson(res, 400, { error: 'No code provided' });
      
      try {
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
          client_id: env.GATEKEEPER_ID,
          client_secret: env.GATEKEEPER_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: env.GATEKEEPER_REDIRECT || 'http://localhost:3000/api/auth/callback'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const userRes = await axios.get('https://discord.com/api/users/@me', {
          headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
        });

        const userId = userRes.data.id;
        const userDb = new Database('users.json', { users: {} });
        const usersList = userDb.get('users', {});
        usersList[userId] = { id: userId, username: userRes.data.username, verified: true };
        userDb.set('users', usersList);

        res.writeHead(302, { Location: '/?verified=true' });
        res.end();
      } catch (e) {
        sendJson(res, 500, { error: e.message });
      }
      return;
    }

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
          id: u.id, username: u.username, tag: u.tag || u.username,
          global_name: u.globalName || null,
          avatar: u.displayAvatarURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        uptime: uptimeSec,
        rpc: c.cfg.rpc || {},
        cmds: c.commands.size
      });
      return;
    }

    if (url === '/api/hosting/clients' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false });
      const { getActiveTokens } = require('../helpers/clientManager');
      const tokens = getActiveTokens(s.username);
      sendJson(res, 200, { success: true, tokens });
      return;
    }

    if (url === '/api/hosting/add' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false });
      const data = await readBody(req);
      const { startClient, getActiveTokens } = require('../helpers/clientManager');
      
      if (s.role !== 'owner' && s.role !== 'admin') {
        const userDb = require('../helpers/users');
        const dbUser = userDb.find(s.username);
        if (!dbUser) return sendJson(res, 403, { error: 'User not found' });
        
        const limit = dbUser.hostLimit || 0;
        const current = getActiveTokens(s.username).length;
        
        if (current >= limit) {
          return sendJson(res, 403, { error: 'Host limit reached. Please contact Admin.' });
        }
      }
      
      const COGS = [
        require('../cogs/general'), require('../cogs/presence'), require('../cogs/rpc'),
        require('../cogs/death'), require('../cogs/util'), require('../cogs/fun')
      ];
      
      const result = await startClient(data.token, s.username, COGS);
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }

    if (url === '/api/hosting/remove' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false });
      const data = await readBody(req);
      const { stopClient } = require('../helpers/clientManager');
      const success = stopClient(data.token);
      sendJson(res, success ? 200 : 400, { success });
      return;
    }

    if (url === '/api/antinuke' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false });
      const db = new Database('antinuke.json', { states: {} });
      const state = db.get(`states.${s.username}`, { enabled: false, whitelist: [] });
      sendJson(res, 200, { success: true, state });
      return;
    }

    if (url === '/api/antinuke' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false });
      const data = await readBody(req);
      const db = new Database('antinuke.json', { states: {} });
      db.set(`states.${s.username}`, data);
      sendJson(res, 200, { success: true });
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
        byCategory[e.category].push({ name: e.name, description: e.description, usage: e.usage, aliases: e.aliases });
      }
      for (const k in byCategory) byCategory[k].sort((a, b) => a.name.localeCompare(b.name));
      sendJson(res, 200, { success: true, commands: byCategory, total: c.commands.size });
      return;
    }

    
    if (url === '/api/theme' && req.method === 'GET') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false });
      const db = new Database('themes.json', { themes: {} });
      const theme = db.get('themes.' + s.username, { color: '#8a2be2' });
      sendJson(res, 200, { success: true, theme });
      return;
    }

    if (url === '/api/theme' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false });
      const data = await readBody(req);
      const db = new Database('themes.json', { themes: {} });
      db.set('themes.' + s.username, data);
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/logs/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const eventBus = require('../helpers/eventBus');
      const onLog = (data) => {
        res.write(`data: ${JSON.stringify(data)}

`);
      };
      
      eventBus.on('console.log', onLog);
      
      req.on('close', () => {
        eventBus.removeListener('console.log', onLog);
      });
      return;
    }

    
    if (url === '/api/rpc' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      c.cfg.rpc = { ...c.cfg.rpc, ...data, enabled: true };
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      const rpcCog = require('../cogs/rpc');
      await rpcCog.push(c);
      sendJson(res, 200, { success: true });
      return;
    }

    if (url === '/api/rpc/preset' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const data = await readBody(req);
      if (!data) return sendJson(res, 400, { success: false, error: 'Bad body' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      const rpcCog = require('../cogs/rpc');
      const preset = rpcCog.PRESETS[data.preset];
      if (!preset) return sendJson(res, 400, { success: false, error: 'Invalid preset' });
      c.cfg.rpc = { ...c.cfg.rpc, ...preset, enabled: true, start: Date.now() };
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      await rpcCog.push(c);
      sendJson(res, 200, { success: true, preset });
      return;
    }

    if (url === '/api/rpc/clear' && req.method === 'POST') {
      const s = getSession(req);
      if (!s) return sendJson(res, 401, { success: false, error: 'Not logged in' });
      const c = findClient(clients, s.username);
      if (!c) return sendJson(res, 404, { success: false, error: 'Client not found' });
      c.cfg.rpc = { enabled: false, type: 'PLAYING', name: '', details: '', state: '', largeImage: '', appId: '' };
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      try { c.user.setPresence({ activities: [], status: 'online' }); } catch (e) {}
      sendJson(res, 200, { success: true });
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

const ext = path.extname(url);
    let contentType = 'text/html';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.css') contentType = 'text/css';
    else if (ext === '.js') contentType = 'application/javascript';

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
