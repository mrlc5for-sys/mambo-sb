const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EMOJI_FILE = path.join(ROOT, 'data', 'emojis.json');

function load() {
  try {
    if (!fs.existsSync(EMOJI_FILE)) {
      fs.writeFileSync(EMOJI_FILE, JSON.stringify({}));
      return {};
    }
    return JSON.parse(fs.readFileSync(EMOJI_FILE, 'utf8'));
  } catch (e) { return {}; }
}

function get(name, fallback = '🔹') {
  const emojis = load();
  const id = emojis[name];
  if (!id) return fallback;
  return `<:${name}:${id}>`;
}

module.exports = { get };
