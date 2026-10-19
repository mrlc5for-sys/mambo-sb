const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const ROOT = path.resolve(__dirname, '..');
const PROXY_FILE = path.join(ROOT, 'proxies.txt');

let proxies = [];
let cursor = 0;

function load() {
  if (fs.existsSync(PROXY_FILE)) {
    proxies = fs.readFileSync(PROXY_FILE, 'utf8').split('\n').map(p => p.trim()).filter(Boolean);
  }
  return proxies;
}

function save() {
  fs.writeFileSync(PROXY_FILE, proxies.join('\n'));
}

async function scrape() {
  try {
    const res = await axios.get('https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt', { timeout: 10000 });
    const newProxies = res.data.split('\n').map(p => p.trim()).filter(Boolean);
    const unique = [...new Set([...proxies, ...newProxies])];
    proxies = unique;
    save();
    return unique.length;
  } catch (e) {
    throw new Error('Failed to scrape proxies: ' + e.message);
  }
}

async function test(proxyUrl) {
  try {
    const agent = new HttpsProxyAgent('http://' + proxyUrl);
    const res = await axios.get('https://discord.com/api/v10/gateway', {
      httpsAgent: agent,
      timeout: 5000,
      validateStatus: () => true
    });
    return res.status === 200;
  } catch (e) {
    return false;
  }
}

async function clean() {
  const valid = [];
  for (const p of proxies) {
    if (await test(p)) valid.push(p);
  }
  proxies = valid;
  save();
  return valid.length;
}

function getNext() {
  if (!proxies.length) return null;
  const p = proxies[cursor % proxies.length];
  cursor++;
  return p;
}

load();

module.exports = { load, save, scrape, clean, getNext, getList: () => proxies };
