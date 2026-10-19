const Database = require('./database');

const db = new Database('authorized.json', { users: [] });

function add(id) {
  const list = db.get('users', []);
  if (list.includes(id)) return false;
  list.push(id);
  db.set('users', list);
  return true;
}

function remove(id) {
  let list = db.get('users', []);
  const initial = list.length;
  list = list.filter(x => x !== id);
  db.set('users', list);
  return list.length !== initial;
}

function isAuthorized(id) {
  return db.get('users', []).includes(id);
}

function list() {
  return db.get('users', []);
}

module.exports = { add, remove, isAuthorized, list };
