const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const USERS_FILE = path.join(ROOT, 'data', 'users.json');

const ROLES = ['owner', 'admin', 'user'];

function hash(pass) {
  return crypto.createHash('sha256').update(String(pass)).digest('hex');
}

function load() {
  try {
    if (!fs.existsSync(USERS_FILE)) {
      fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
      fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const list = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    return list.map(u => ({ ...u, role: ROLES.includes(u.role) ? u.role : 'user' }));
  } catch (e) { return []; }
}

function save(list) {
  try {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(list, null, 2));
  } catch (e) {}
}

function all() { return load(); }

function find(username) {
  return load().find(u => u.username.toLowerCase() === String(username).toLowerCase());
}

function findById(id) { return load().find(u => u.id === id); }

function verify(username, password) {
  const u = find(username);
  if (!u) return null;
  if (u.password !== hash(password)) return null;
  return u;
}

function add({ username, password, token, role }) {
  if (!username || !password) return { ok: false, reason: 'missing fields' };
  if (find(username)) return { ok: false, reason: 'username taken' };
  const list = load();
  const entry = {
    id: crypto.randomBytes(6).toString('hex'),
    username,
    password: hash(password),
    token: token || '',
    role: ROLES.includes(role) ? role : 'user',
    created: Date.now()
  };
  list.push(entry);
  save(list);
  return { ok: true, user: entry };
}

function remove(id) {
  const list = load();
  const target = list.find(u => u.id === id);
  if (!target) return { ok: false, reason: 'not found' };
  if (target.role === 'owner') return { ok: false, reason: 'cannot remove owner' };
  save(list.filter(u => u.id !== id));
  return { ok: true, user: target };
}

function update(id, patch) {
  const list = load();
  const idx = list.findIndex(u => u.id === id);
  if (idx === -1) return { ok: false, reason: 'not found' };
  if (patch.username) list[idx].username = patch.username;
  if (patch.password) list[idx].password = hash(patch.password);
  if (patch.token !== undefined) list[idx].token = patch.token;
  if (patch.role && ROLES.includes(patch.role)) {
    if (list[idx].role === 'owner' && patch.role !== 'owner') {
      return { ok: false, reason: 'cannot demote owner' };
    }
    list[idx].role = patch.role;
  }
  save(list);
  return { ok: true, user: list[idx] };
}

function hasPermission(userRole, requiredRole) {
  const order = { owner: 3, admin: 2, user: 1 };
  return (order[userRole] || 0) >= (order[requiredRole] || 0);
}

module.exports = { load, save, all, find, findById, verify, add, remove, update, hash, ROLES, hasPermission };
