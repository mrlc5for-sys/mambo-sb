const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const SECRET = process.env.VAULT_SECRET || 'mambo-default-secret-key-32-chars';
const KEY = crypto.createHash('sha256').update(String(SECRET)).digest();

class Database {
  constructor(filePath, defaults = {}) {
    this.filePath = path.join(__dirname, '..', 'data', filePath);
    this.defaults = defaults;
    this.data = {};
    this._timer = null;
    this._load();
  }

  _load() {
    try {
      if (!fs.existsSync(path.dirname(this.filePath))) {
        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      }
      if (fs.existsSync(this.filePath)) {
        const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.data = { ...this.defaults, ...parsed };
      } else {
        this.data = JSON.parse(JSON.stringify(this.defaults));
        this._writeSync();
      }
    } catch (e) {
      this.data = JSON.parse(JSON.stringify(this.defaults));
    }
  }

  _writeSync() {
    try {
      const tempPath = this.filePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(this.data, null, 2));
      fs.renameSync(tempPath, this.filePath);
    } catch (e) {
      console.error('DB Write Error:', e.message);
    }
  }

  save() {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      this._writeSync();
    }, 500);
  }

  get(key, def = null) {
    const parts = String(key).split('.');
    let cur = this.data;
    for (const p of parts) {
      if (cur == null || typeof cur !== 'object') return def;
      cur = cur[p];
    }
    return cur === undefined ? def : cur;
  }

  set(key, value) {
    const parts = String(key).split('.');
    let cur = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    this.save();
  }

  encrypt(text) {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
      const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`;
    } catch (e) { return text; }
  }

  decrypt(text) {
    if (!text || typeof text !== 'string') return text;
    const parts = text.split(':');
    if (parts.length !== 3) return text;
    try {
      const iv = Buffer.from(parts[0], 'base64');
      const encrypted = Buffer.from(parts[1], 'base64');
      const tag = Buffer.from(parts[2], 'base64');
      const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
      decipher.setAuthTag(tag);
      return decipher.update(encrypted, 'binary', 'utf8') + decipher.final('utf8');
    } catch (e) { return text; }
  }
}

module.exports = Database;
