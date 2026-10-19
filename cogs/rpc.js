const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { RichPresence } = require('discord.js-selfbot-v13');
const { codeblock, kv } = require('../helpers/render');

const ROOT = path.resolve(__dirname, '..');
const TWITCH_URL = 'https://www.twitch.tv/twitch';
const IMG_CACHE = new Map();
const ROTATORS = new Map();

const LOGOS = {
  spotify:      'https://cdn.discordapp.com/app-icons/383226320970055681/2fdb11bf297d1e4e17288599e1fd8bf6.png',
  youtube:      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/512px-YouTube_full-color_icon_%282017%29.svg.png',
  twitch:       'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Twitch_Glitch_Logo_Purple.svg/512px-Twitch_Glitch_Logo_Purple.svg.png',
  netflix:      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/512px-Netflix_2015_logo.svg.png',
  crunchyroll:  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Crunchyroll_Logo.svg/512px-Crunchyroll_Logo.svg.png',
  disney:       'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Disney%2B_logo.svg/512px-Disney%2B_logo.svg.png',
  prime:        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Amazon_Prime_Video_logo_%282022%29.svg/512px-Amazon_Prime_Video_logo_%282022%29.svg.png',
  hulu:         'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Hulu_Logo.svg/512px-Hulu_Logo.svg.png',
  valorant:     'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Valorant_logo_-_pink_color_version.svg/512px-Valorant_logo_-_pink_color_version.svg.png',
  minecraft:    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Minecraft_logo.svg/512px-Minecraft_logo.svg.png',
  genshin:      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Genshin_Impact_logo.svg/512px-Genshin_Impact_logo.svg.png',
  league:       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/League_of_Legends_2019_vector.svg/512px-League_of_Legends_2019_vector.svg.png',
  roblox:       'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c7/Roblox_logo.svg/512px-Roblox_logo.svg.png',
  xbox:         'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Xbox_one_logo.svg/512px-Xbox_one_logo.svg.png',
  playstation:  'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/PlayStation_logo.svg/512px-PlayStation_logo.svg.png',
  steam:        'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png',
  coding:       'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Visual_Studio_Code_1.35_icon.svg/512px-Visual_Studio_Code_1.35_icon.svg.png',
  fortnite:     'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Fortnite_F_lettermark_logo.png/512px-Fortnite_F_lettermark_logo.png',
  apex:         'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Apex_legends_logo.png/512px-Apex_legends_logo.png',
  cyberpunk:    'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Cyberpunk_2077_logo.svg/512px-Cyberpunk_2077_logo.svg.png',
  gta:          'https://upload.wikimedia.org/wikipedia/commons/thumb/5/51/GTA_V_logo.svg/512px-GTA_V_logo.svg.png',
  reddit:       'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Reddit_logo_and_wordmark.svg/512px-Reddit_logo_and_wordmark.svg.png',
  soundcloud:   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/SoundCloud_logo.svg/512px-SoundCloud_logo.svg.png',
  apple:        'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Apple_Music_icon.svg/512px-Apple_Music_icon.svg.png',
  deezer:       'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Deezer_logo_2019.svg/512px-Deezer_logo_2019.svg.png',
  metaquest:    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Meta_Platforms_Inc._logo_%28cropped%29.svg/512px-Meta_Platforms_Inc._logo_%28cropped%29.svg.png'
};

const PRESETS = {
  spotify:      { type: 'LISTENING', name: 'Spotify',           appId: '383226320970055681',  largeText: 'Spotify' },
  youtube:      { type: 'WATCHING',  name: 'YouTube',           appId: '463092042733944832',  largeText: 'YouTube' },
  twitch:       { type: 'STREAMING', name: 'Twitch',            appId: '356875570916753438',  largeText: 'Twitch', url: TWITCH_URL },
  netflix:      { type: 'WATCHING',  name: 'Netflix',           appId: '926541425682829352',  largeText: 'Netflix' },
  crunchyroll:  { type: 'WATCHING',  name: 'Crunchyroll',       appId: '981509069309354054',  largeText: 'Crunchyroll' },
  disney:       { type: 'WATCHING',  name: 'Disney+',           appId: '1246129112369008690', largeText: 'Disney+' },
  prime:        { type: 'WATCHING',  name: 'Prime Video',       appId: '1245074076512120883', largeText: 'Prime Video' },
  hulu:         { type: 'WATCHING',  name: 'Hulu',              appId: '1246135683477504010', largeText: 'Hulu' },
  valorant:     { type: 'PLAYING',   name: 'Valorant',          appId: '700136709471469578',  largeText: 'Valorant' },
  minecraft:    { type: 'PLAYING',   name: 'Minecraft',         appId: '356875221078245376',  largeText: 'Minecraft' },
  genshin:      { type: 'PLAYING',   name: 'Genshin Impact',    appId: '762434991303950386',  largeText: 'Genshin Impact' },
  league:       { type: 'PLAYING',   name: 'League of Legends', appId: '401518684763586560',  largeText: 'League of Legends' },
  roblox:       { type: 'PLAYING',   name: 'Roblox',            appId: '403181870514077706',  largeText: 'Roblox' },
  xbox:         { type: 'PLAYING',   name: 'Xbox',              appId: '622174530214821906',  largeText: 'Xbox' },
  playstation:  { type: 'PLAYING',   name: 'PlayStation',       appId: '1394497681325658274', largeText: 'PlayStation' },
  steam:        { type: 'PLAYING',   name: 'Steam',             appId: '369255558004031489',  largeText: 'Steam' },
  coding:       { type: 'PLAYING',   name: 'Visual Studio Code',appId: '1203635689319850085', largeText: 'VS Code' },
  fortnite:     { type: 'PLAYING',   name: 'Fortnite',          appId: '432980957394370572',  largeText: 'Fortnite' },
  apex:         { type: 'PLAYING',   name: 'Apex Legends',      appId: '586893028118642700',  largeText: 'Apex Legends' },
  cyberpunk:    { type: 'PLAYING',   name: 'Cyberpunk 2077',    appId: '687241272229527566',  largeText: 'Cyberpunk 2077' },
  gta:          { type: 'PLAYING',   name: 'Grand Theft Auto V', appId: '356876294426050562', largeText: 'GTA V' },
  reddit:       { type: 'WATCHING',  name: 'Reddit',            appId: '719739728450256968',  largeText: 'Reddit' },
  soundcloud:   { type: 'LISTENING', name: 'SoundCloud',        appId: '353845403240153088',  largeText: 'SoundCloud' },
  apple:        { type: 'LISTENING', name: 'Apple Music',       appId: '582574945267924992',  largeText: 'Apple Music' },
  metaquest:    { type: 'PLAYING',   name: 'Meta Quest',       appId: '1327017154792947712', largeText: 'Meta Quest' },
  deezer:       { type: 'LISTENING', name: 'Deezer',            appId: '474225173052391425',  largeText: 'Deezer' }
};

function getRpc(c) { if (!c.cfg.rpc) c.cfg.rpc = {}; return c.cfg.rpc; }

function getStack(c) {
  if (!c.cfg.rpc_stack) c.cfg.rpc_stack = { enabled: false, primary: null, secondary: null, extras: [] };
  if (!c.cfg.rpc_stack.extras) c.cfg.rpc_stack.extras = [];
  return c.cfg.rpc_stack;
}

function save(c) { fs.writeFileSync(path.join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2)); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function resolveImage(c, appId, url) {
  if (!url) return null;
  if (url.startsWith('mp:')) return url;
  if (url.startsWith('https://cdn.discordapp.com') || url.startsWith('https://media.discordapp.net')) return url;
  const cacheKey = (c.uid || 'x') + ':' + url;
  if (IMG_CACHE.has(cacheKey)) return IMG_CACHE.get(cacheKey);
  try {
    const res = await RichPresence.getExternal(c, appId, url);
    if (res && res.length && res[0].external_asset_path) {
      const mp = 'mp:' + res[0].external_asset_path;
      IMG_CACHE.set(cacheKey, mp);
      return mp;
    }
  } catch (e) {}
  return null;
}

async function buildActivity(c, entry) {
  if (!entry || !entry.name) return null;
  const presence = new RichPresence(c);
  const isStreaming = (entry.type || 'PLAYING') === 'STREAMING';
  const appId = entry.appId || c.user.id;
  presence.setApplicationId(appId);
  presence.setType(entry.type || 'PLAYING');
  presence.setName(entry.name);
  if (entry.details) presence.setDetails(String(entry.details).slice(0, 128));
  if (entry.state) presence.setState(String(entry.state).slice(0, 128));
  if (entry.start) presence.setStartTimestamp(entry.start);
  if (isStreaming) presence.setURL(entry.url || TWITCH_URL);
  const img = entry.largeImage || LOGOS[entry.key] || '';
  if (img) {
    const large = await resolveImage(c, appId, img);
    if (large) {
      presence.setAssetsLargeImage(large);
      if (entry.largeText) presence.setAssetsLargeText(String(entry.largeText).slice(0, 128));
    }
  }
  if (entry.smallImage) {
    const small = await resolveImage(c, appId, entry.smallImage);
    if (small) {
      presence.setAssetsSmallImage(small);
      if (entry.smallText) presence.setAssetsSmallText(String(entry.smallText).slice(0, 128));
    }
  }
  if (entry.button1Label && entry.button1URL) presence.addButton(String(entry.button1Label).slice(0, 32), entry.button1URL);
  if (entry.button2Label && entry.button2URL) presence.addButton(String(entry.button2Label).slice(0, 32), entry.button2URL);
  return presence;
}

function blankRpc(key, preset, details, state) {
  return {
    key: key,
    enabled: true,
    type: preset.type || 'PLAYING',
    name: preset.name,
    details: details || '',
    state: state || '',
    largeImage: LOGOS[key] || '',
    largeText: preset.largeText || '',
    smallImage: '',
    smallText: '',
    button1Label: '',
    button1URL: '',
    button2Label: '',
    button2URL: '',
    appId: preset.appId || '',
    url: preset.url || '',
    status: 'online',
    start: Date.now()
  };
}

async function wipePresence(c) {
  try { c.user.setPresence({ activities: [], status: 'online' }); } catch (e) {}
  await sleep(200);
}

async function push(c) {
  const r = getRpc(c);
  if (!r.enabled || !r.name) return;
  try {
    const presence = new RichPresence(c);
    const appId = r.appId || c.user.id;
    if (appId) presence.setApplicationId(appId);
    presence.setType(r.type || 'PLAYING');
    presence.setName(r.name);
    if (r.details) presence.setDetails(r.details);
    if (r.state) presence.setState(r.state);
    if (r.start) presence.setStartTimestamp(r.start);
    if ((r.type || 'PLAYING') === 'STREAMING') presence.setURL(r.url || TWITCH_URL);

    // Exact import from index.js for Spotify UI
    if (r.appId === '383226320970055681' || r.name === 'Spotify') {
      presence.flags = 48;
      presence.id = 'spotify:1';
      presence.party = { id: 'spotify:' + c.user.id };
    }

    const large = await resolveImage(c, appId, r.largeImage);
    const small = await resolveImage(c, appId, r.smallImage);
    if (large) presence.setAssetsLargeImage(large);
    if (r.largeText) presence.setAssetsLargeText(r.largeText);
    if (small) presence.setAssetsSmallImage(small);
    if (r.smallText) presence.setAssetsSmallText(r.smallText);

    if (r.button1Label && r.button1URL) presence.addButton(r.button1Label, r.button1URL);
    if (r.button2Label && r.button2URL) presence.addButton(r.button2Label, r.button2URL);

    c.user.setPresence({ activities: [presence], status: r.status || 'online' });
  } catch (e) {
    console.error('RPC Error:', e.message);
  }
}

async function setCustomStatus(c, emoji, text, status) {
  try {
    const parsed = emoji ? emoji.match(/^<(a)?:(\w+):(\d+)>$/) : null;
    const cs = { text: text || '' };
    if (parsed) { cs.emoji_name = parsed[2]; cs.emoji_id = parsed[3]; }
    else if (emoji && emoji.length <= 4) cs.emoji_name = emoji;
    await axios.patch('https://discord.com/api/v10/users/@me/settings',
      { custom_status: cs, status: status || 'online' },
      { headers: { authorization: c.token, 'content-type': 'application/json' } });
    return true;
  } catch (e) { return false; }
}

async function pushStack(c) {
  const s = getStack(c);
  if (!s.enabled || !s.primary) return;

  await wipePresence(c);

  const activities = [];

  // Primary card — includes any custom fields stored on it
  const primaryActivity = await buildActivity(c, {
    appId: s.primary.appId,
    type: s.primary.type,
    name: s.primary.name,
    details: s.primary.details,
    state: s.primary.state,
    largeImage: s.primary.largeImage,
    largeText: s.primary.largeText,
    smallImage: s.primary.smallImage,
    smallText: s.primary.smallText,
    button1Label: s.primary.button1Label,
    button1URL: s.primary.button1URL,
    button2Label: s.primary.button2Label,
    button2URL: s.primary.button2URL,
    url: s.primary.url,
    start: s.primary.start || Date.now()
  });
  if (primaryActivity) activities.push(primaryActivity);

  // Each extra becomes its own activity card with custom fields applied
  for (const extra of s.extras) {
    const preset = PRESETS[extra.key] || {};
    const entry = {
      key: extra.key,
      appId: extra.appId || preset.appId,
      type: extra.type || preset.type || 'PLAYING',
      name: extra.nameOverride || extra.name || preset.name,
      details: extra.details || '',
      state: extra.state || '',
      largeImage: extra.largeImage || (LOGOS && LOGOS[extra.key]) || '',
      largeText: extra.largeText || preset.largeText || '',
      smallImage: extra.smallImage || '',
      smallText: extra.smallText || '',
      button1Label: extra.button1Label || '',
      button1URL: extra.button1URL || '',
      button2Label: extra.button2Label || '',
      button2URL: extra.button2URL || '',
      start: Date.now()
    };
    const act = await buildActivity(c, entry);
    if (act) {
      // Apply Spotify hack for stacked cards
      if (entry.appId === '383226320970055681' || entry.name === 'Spotify') {
        act.flags = 48;
        act.id = 'spotify:1';
        act.party = { id: 'spotify:' + c.user.id };
      }
      activities.push(act);
    }
    await sleep(150);
  }

  if (!activities.length) return;

  try { c.user.setPresence({ activities: activities, status: s.primary.status || 'online' }); }
  catch (e) { console.error('Stack push error:', e.message); }

  if (s.secondary && s.secondary.text) {
    await setCustomStatus(c, s.secondary.emoji, s.secondary.text, s.primary.status || 'online');
  }
}

function stopStack(c) { const s = getStack(c); s.enabled = false; save(c); }

async function clearAllPresence(c) {
  await wipePresence(c);
  try { await axios.patch('https://discord.com/api/v10/users/@me/settings', { custom_status: null }, { headers: { authorization: c.token } }); }
  catch (e) {}
}


function parseContent(raw) {
  let main = (raw || '').trim();
  let btnLabel = null;
  let btnURL = null;
  if (main.includes(' >> ')) {
    const parts = main.split(' >> ');
    main = parts[0].trim();
    btnLabel = parts[1] ? parts[1].trim() : null;
    btnURL = parts[2] ? parts[2].trim() : 'https://discord.com';
  }
  return { main, btnLabel, btnURL };
}

function startRotator(c) {
  if (ROTATORS.has(c.uid)) clearInterval(ROTATORS.get(c.uid));
  const rot = c.cfg.rotator;
  if (!rot || !rot.entries || !rot.entries.length) return;

  const tick = async () => {
    const cur = c.cfg.rotator;
    if (!cur || !cur.enabled || !cur.entries.length) return;
    const entry = cur.entries[cur.index % cur.entries.length];
    cur.index = (cur.index + 1) % cur.entries.length;
    try {
      fs.writeFileSync(require('path').join(ROOT, 'config.json'), JSON.stringify(c.cfg, null, 2));
    } catch (e) {}
    try {
      const axios = require('axios');
      const parsed = entry.emoji ? entry.emoji.match(/^<(a)?:(\w+):(\d+)>$/) : null;
      const cs = { text: entry.text || '' };
      if (parsed) { cs.emoji_name = parsed[2]; cs.emoji_id = parsed[3]; }
      else if (entry.emoji && entry.emoji.length <= 4) cs.emoji_name = entry.emoji;
      await axios.patch('https://discord.com/api/v10/users/@me/settings',
        { custom_status: cs, status: 'online' },
        { headers: { authorization: c.token, 'content-type': 'application/json' } });
    } catch (e) {}
  };

  tick();
  const timer = setInterval(tick, Math.max(5, rot.interval) * 1000);
  ROTATORS.set(c.uid, timer);
}

function stopRotator(c) {
  if (ROTATORS.has(c.uid)) {
    clearInterval(ROTATORS.get(c.uid));
    ROTATORS.delete(c.uid);
  }
}

function resolveTemplate(text) {
  if (!text || typeof text !== 'string') return text;
  let out = text;

  // <time:TZ>  — e.g. <time:IST>, <time:UTC>, <time:America/New_York>
  out = out.replace(/<time:([^>]+)>/gi, (_, tz) => {
    try {
      const zone = tz.trim();
      return new Date().toLocaleTimeString('en-US', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
      try {
        // Fallback: treat as offset like +5:30 or IST shortcut
        const shortcuts = { 'IST': 5.5, 'EST': -5, 'PST': -8, 'CET': 1, 'JST': 9, 'AEST': 10 };
        if (shortcuts[zone.toUpperCase()]) {
          const offset = shortcuts[zone.toUpperCase()];
          const d = new Date(Date.now() + offset * 3600 * 1000);
          return d.toUTCString().split(' ')[4].slice(0, 5);
        }
      } catch (e2) {}
      return tz;
    }
  });

  // <date>  — current date (YYYY-MM-DD)
  out = out.replace(/<date>/gi, () => new Date().toISOString().slice(0, 10));

  // <date:FMT>  — supports YYYY MM DD
  out = out.replace(/<date:([^>]+)>/gi, (_, fmt) => {
    const d = new Date();
    return fmt
      .replace(/YYYY/g, d.getFullYear())
      .replace(/MM/g, String(d.getMonth() + 1).padStart(2, '0'))
      .replace(/DD/g, String(d.getDate()).padStart(2, '0'));
  });

  // <uptime>  — bot session uptime (HH:MM)
  out = out.replace(/<uptime>/gi, () => {
    const ms = Date.now() - (global.__BOT_START__ || Date.now());
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h + 'h ' + m + 'm';
  });

  return out;
}

function hasTemplate(text) {
  if (!text || typeof text !== 'string') return false;
  return /<time:[^>]+>|<date>|<date:[^>]+>|<uptime>/i.test(text);
}

const RPC_TICKERS = new Map();

function startTicker(c) {
  stopTicker(c);
  const r = c.cfg.rpc;
  if (!r) return;
  const needsTick = hasTemplate(r.details) || hasTemplate(r.state) || hasTemplate(r.name);
  if (!needsTick) return;

  const timer = setInterval(async () => {
    const cur = c.cfg.rpc;
    if (!cur || !cur.enabled) return stopTicker(c);
    const stillNeeds = hasTemplate(cur.details) || hasTemplate(cur.state) || hasTemplate(cur.name);
    if (!stillNeeds) return stopTicker(c);
    try {
      const activity = await buildActivity(c, {
        appId: cur.appId,
        type: cur.type,
        name: resolveTemplate(cur.name),
        details: resolveTemplate(cur.details),
        state: resolveTemplate(cur.state),
        largeImage: cur.largeImage,
        largeText: cur.largeText,
        smallImage: cur.smallImage,
        smallText: cur.smallText,
        url: cur.url,
        start: cur.start
      });
      if (activity && c.ws) {
        const shard = c.ws.shards.first();
        if (shard) shard.send({ op: 3, d: { status: cur.status || 'online', activities: [activity.toJSON ? activity.toJSON() : activity], afk: false, since: 0 } });
      }
    } catch (e) {}
  }, 15000);

  RPC_TICKERS.set(c.uid, timer);
}

function stopTicker(c) {
  if (RPC_TICKERS.has(c.uid)) {
    clearInterval(RPC_TICKERS.get(c.uid));
    RPC_TICKERS.delete(c.uid);
  }
}

function register(client) {
  client.registerCommand('rpc', async (c, m) => {
    const r = getRpc(c);
    await m.edit(codeblock('rpc', kv([
      ['enabled', r.enabled ? 'yes' : 'no'],
      ['type', r.type || 'PLAYING'],
      ['name', r.name || '—'],
      ['details', r.details || '—'],
      ['state', r.state || '—'],
      ['image', r.largeImage ? 'set' : '—']
    ])));
  }, { aliases: ['rpcshow'], category: 'rpc', description: 'show current rpc' });

  client.registerCommand('rpcpresets', async (c, m) => {
    const keys = Object.keys(PRESETS);
    const lines = [];
    for (let i = 0; i < keys.length; i += 3) lines.push(keys.slice(i, i + 3).map(k => k.padEnd(14)).join(''));
    await m.edit(codeblock('rpc · presets · ' + keys.length, lines.join('\n')));
  }, { aliases: ['presets'], category: 'rpc', description: 'list rpc presets' });

  for (const [key, preset] of Object.entries(PRESETS)) {
    client.registerCommand('rpc' + key, async (c, m, args) => {
      stopStack(c);
      let details = '';
      let state = '';
      if (args.length) {
        const split = args.join(' ').split('|').map(s => s.trim());
        if (split[0]) details = split[0];
        if (split[1]) state = split[1];
      }
      c.cfg.rpc = blankRpc(key, preset, details, state);
      save(c);
      await push(c);
      await m.edit(codeblock('rpc · ' + key, kv([
        ['type', preset.type],
        ['name', preset.name],
        ['details', details || '—'],
        ['state', state || '—']
      ])));
    }, { category: 'rpc', description: key + ' preset' });
  }

  
  



  
  client.registerCommand('rpcquest', async (c, m, args) => {
    stopStack(c);
    const rawArgs = args.join(' ');
    const split = rawArgs.split('++').map(s => s.trim());
    const content = split[0] || '';
    const timer = split[1] || null;
    const parsed = parseContent(content);
    const parts = parsed.main.split('-').map(p => p.trim());

    const game = parts[0] || 'Meta Quest';
    const details = parts[1] || '';
    const state = parts[2] || '';

    const r = {
      key: 'metaquest',
      enabled: true,
      type: 'PLAYING',
      name: game,
      details: details,
      state: state,
      largeImage: LOGOS.metaquest,
      largeText: 'Meta Quest',
      smallImage: '',
      smallText: '',
      button1Label: parsed.btnLabel || '',
      button1URL: parsed.btnURL || '',
      button2Label: '',
      button2URL: '',
      appId: '1327017154792947712',
      url: '',
      status: 'online',
      start: Date.now()
    };

    if (timer === 'off') r.start = null;
    else if (timer === 'reset') r.start = Date.now();
    else if (timer) {
      const h = parseInt((timer.match(/(\d+)h/) || [0, 0])[1], 10) || 0;
      const mi = parseInt((timer.match(/(\d+)m/) || [0, 0])[1], 10) || 0;
      const s = parseInt((timer.match(/(\d+)s/) || [0, 0])[1], 10) || 0;
      r.start = Date.now() - (h * 3600 + mi * 60 + s) * 1000;
    }

    c.cfg.rpc = r;
    save(c);
    await push(c);

    await m.edit(codeblock('rpc · meta quest', kv([
      ['platform', 'Meta Quest'],
      ['game', game],
      ['details', details || '—'],
      ['state', state || '—'],
      ['badge', 'VR headset'],
      ['timer', r.start ? 'active' : 'off']
    ])));
  }, { aliases: ['rpcmeta', 'rpcvr'], category: 'rpc', description: 'meta quest vr activity', usage: '<game> - <details> - <state> [++ timer]' });

  client.registerCommand('rpcquestpop', async (c, m, args) => {
    stopStack(c);
    const games = [
      'Beat Saber', 'Population: ONE', 'VRChat', 'Gorilla Tag', 'Bonelab',
      'Blade & Sorcery', 'Superhot VR', 'Job Simulator', 'Pistol Whip',
      'Walkabout Mini Golf', 'Eleven Table Tennis', 'Contractors', 'Onward',
      'Resident Evil 4 VR', 'Half-Life: Alyx'
    ];
    const pick = games[Math.floor(Math.random() * games.length)];
    const r = {
      key: 'metaquest',
      enabled: true,
      type: 'PLAYING',
      name: pick,
      details: 'Playing in VR',
      state: '',
      largeImage: LOGOS.metaquest,
      largeText: 'Meta Quest',
      smallImage: '',
      smallText: '',
      button1Label: '',
      button1URL: '',
      button2Label: '',
      button2URL: '',
      appId: '1327017154792947712',
      url: '',
      status: 'online',
      start: Date.now()
    };
    c.cfg.rpc = r;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · meta quest random', kv([
      ['platform', 'Meta Quest'],
      ['game', pick],
      ['details', 'Playing in VR'],
      ['badge', 'VR headset']
    ])));
  }, { aliases: ['rpcmetapop'], category: 'rpc', description: 'random meta quest VR game' });


  client.registerCommand('rpccrunchyroll', async (c, m, args) => {
    stopStack(c);
    const rawArgs = args.join(' ');
    const split = rawArgs.split('++').map(s => s.trim());
    const content = split[0] || '';
    const timer = split[1] || null;
    const parsed = parseContent(content);
    const parts = parsed.main.split('-').map(p => p.trim());

    const preset = PRESETS.crunchyroll;
    const r = blankRpc('crunchyroll', preset, parts[0] || '', parts[1] || '');
    r.largeImage = LOGOS.crunchyroll;
    r.button1Label = parsed.btnLabel || '';
    r.button1URL = parsed.btnURL || '';
    if (timer === 'off') r.start = null;
    else if (timer === 'reset') r.start = Date.now();
    else if (timer) {
      const h = parseInt((timer.match(/(\d+)h/) || [0, 0])[1], 10) || 0;
      const mi = parseInt((timer.match(/(\d+)m/) || [0, 0])[1], 10) || 0;
      const s = parseInt((timer.match(/(\d+)s/) || [0, 0])[1], 10) || 0;
      r.start = Date.now() - (h * 3600 + mi * 60 + s) * 1000;
    }

    c.cfg.rpc = r;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · crunchyroll', kv([
      ['type', 'WATCHING'],
      ['name', 'Crunchyroll'],
      ['details', r.details || '—'],
      ['state', r.state || '—'],
      ['timer', r.start ? 'active' : 'off']
    ])));
  }, { category: 'rpc', description: 'crunchyroll watching activity', usage: '[details - state] [++ timer]' });

    client.registerCommand('rpcspotify', async (c, m, args) => {
    stopStack(c);
    const raw = args.join(' ');
    const [content, timer] = raw.split('++').map(s => s.trim());
    const parsed = parseContent(content);
    const parts = parsed.main.split('-').map(p => p.trim());

    const r = {
      key: 'spotify',
      enabled: true,
      type: 'LISTENING',
      name: 'Spotify',
      details: parts[0] || 'Spotify',
      state: parts[1] || '',
      largeImage: parsed.imageURL || 'https://raw.githubusercontent.com/WalkxCode/dashboard-icons/main/png/spotify.png',
      largeText: 'Spotify',
      smallImage: 'https://raw.githubusercontent.com/WalkxCode/dashboard-icons/main/png/spotify.png',
      smallText: 'Listening',
      button1Label: parsed.btnLabel || '',
      button1URL: parsed.btnURL || '',
      button2Label: '',
      button2URL: '',
      appId: '383226320970055681',
      url: '',
      status: 'online',
      start: Date.now(),
      end: Date.now()
    };

    if (timer === 'off') { r.start = null; r.end = null; }
    else if (timer === 'reset') { r.start = Date.now(); r.end = null; }
    else if (timer) {
      const h = parseInt((timer.match(/(\d+)h/) || [0, 0])[1], 10) || 0;
      const mi = parseInt((timer.match(/(\d+)m/) || [0, 0])[1], 10) || 0;
      const s = parseInt((timer.match(/(\d+)s/) || [0, 0])[1], 10) || 0;
      r.start = Date.now() - (h * 3600 + mi * 60 + s) * 1000;
      r.end = null;
    }

    c.cfg.rpc = r;
    save(c);
    await push(c);

    await m.edit(codeblock('rpc · spotify', kv([
      ['type', 'LISTENING'],
      ['track', r.details],
      ['artist', r.state || '—'],
      ['timer', r.start ? 'active' : 'off']
    ])));
  }, { category: 'rpc', description: 'spotify listening activity', usage: '<track> - <artist> [++ timer]' });

  client.registerCommand('rpcstack', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    const rest = args.slice(1);
    const s = getStack(c);

    if (!sub) {
      const body = [
        'STACK · each extra shows as its own RPC card',
        '',
        '  rpcstack set <preset> [d]      set primary',
        '  rpcstack add <preset>          add extra as separate card',
        '  rpcstack status <emoji> <text> set custom status',
        '  rpcstack remove <n>            remove extra',
        '  rpcstack list                  show stack',
        '  rpcstack start                 apply',
        '  rpcstack stop                  clear',
        '  rpcstack clear                 reset config',
        '',
        'CURRENT',
        '  primary     ' + (s.primary ? s.primary.name : '—'),
        '  extras      ' + s.extras.length,
        '  status      ' + (s.secondary && s.secondary.text ? s.secondary.emoji + ' ' + s.secondary.text : '—'),
        '  enabled     ' + (s.enabled ? 'yes' : 'no')
      ];
      return m.edit(codeblock('rpc · stacking', body.join('\n')));
    }

    if (sub === 'set' || sub === 'primary') {
      const key = (rest[0] || '').toLowerCase();
      if (!key) return m.edit(codeblock('rpcstack · set', 'usage: rpcstack set <preset>'));
      const preset = PRESETS[key];
      if (!preset) return m.edit(codeblock('rpcstack · set', 'unknown · $rpcpresets'));
      const details = rest.slice(1).join(' ');
      s.primary = blankRpc(key, preset, details, '');
      save(c);
      if (s.enabled) await pushStack(c);
      return m.edit(codeblock('rpcstack · set', kv([['slot', 'primary'], ['preset', preset.name], ['type', preset.type], ['details', details || '—']])));
    }

    if (sub === 'add' || sub === 'extra') {
      const key = (rest[0] || '').toLowerCase();
      if (!key) return m.edit(codeblock('rpcstack · add', 'usage: rpcstack add <preset>'));
      const preset = PRESETS[key];
      if (!preset) return m.edit(codeblock('rpcstack · add', 'unknown · $rpcpresets'));
      s.extras.push({ key: key, name: preset.name, type: preset.type });
      save(c);
      if (s.enabled) await pushStack(c);
      return m.edit(codeblock('rpcstack · add', kv([['slot', 'extras'], ['index', '#' + s.extras.length], ['preset', preset.name]])));
    }

    if (sub === 'status' || sub === 'custom') {
      const mode = (rest[0] || '').toLowerCase();
      if (mode === 'off' || mode === 'clear') {
        s.secondary = null;
        save(c);
        if (s.enabled) await pushStack(c); else await setCustomStatus(c, null, '', 'online');
        return m.edit(codeblock('rpcstack · status', 'cleared'));
      }
      const emoji = rest[0];
      const text = rest.slice(1).join(' ');
      if (!emoji) return m.edit(codeblock('rpcstack · status', 'usage: rpcstack status <emoji> <text>'));
      s.secondary = { emoji: emoji, text: text };
      save(c);
      if (s.enabled) await pushStack(c); else await setCustomStatus(c, emoji, text, 'online');
      return m.edit(codeblock('rpcstack · status', kv([['emoji', emoji], ['text', text || '—']])));
    }

    if (sub === 'remove' || sub === 'rm') {
      const n = parseInt(rest[0], 10);
      if (isNaN(n) || n < 1 || n > s.extras.length) return m.edit(codeblock('rpcstack · remove', 'invalid index'));
      const removed = s.extras.splice(n - 1, 1)[0];
      save(c);
      if (s.enabled) await pushStack(c);
      return m.edit(codeblock('rpcstack · remove', kv([['removed', '#' + n], ['name', removed.name], ['remaining', s.extras.length]])));
    }

    if (sub === 'list' || sub === 'show') {
      const lines = [];
      lines.push('[ PRIMARY ]');
      lines.push(s.primary ? '  ' + s.primary.type.padEnd(10) + '  ' + s.primary.name : '  (none)');
      lines.push('');
      lines.push('[ EXTRAS · ' + s.extras.length + ' ]');
      if (!s.extras.length) lines.push('  (none)');
      else s.extras.forEach((e, i) => lines.push('  #' + (i + 1) + '  ' + e.type.padEnd(10) + '  ' + e.name));
      lines.push('');
      lines.push('[ CUSTOM STATUS ]');
      lines.push(s.secondary ? '  ' + s.secondary.emoji + '  ' + s.secondary.text : '  (none)');
      lines.push('');
      lines.push('enabled   ' + (s.enabled ? 'yes' : 'no'));
      return m.edit(codeblock('rpcstack · list', lines.join('\n')));
    }

    if (sub === 'start' || sub === 'apply') {
      if (!s.primary) return m.edit(codeblock('rpcstack · start', 'set a primary first'));
      s.enabled = true;
      save(c);
      await pushStack(c);
      return m.edit(codeblock('rpcstack · start', kv([
        ['status', 'applied'],
        ['primary', s.primary.name],
        ['extras', s.extras.length + ' separate cards'],
        ['custom', s.secondary ? s.secondary.emoji + ' ' + s.secondary.text : '—']
      ])));
    }

    if (sub === 'stop') { stopStack(c); await clearAllPresence(c); return m.edit(codeblock('rpcstack · stop', 'cleared')); }

    if (sub === 'clear' || sub === 'reset') {
      stopStack(c);
      c.cfg.rpc_stack = { enabled: false, primary: null, secondary: null, extras: [] };
      save(c);
      await clearAllPresence(c);
      return m.edit(codeblock('rpcstack · clear', 'reset'));
    }

    return m.edit(codeblock('rpcstack', 'unknown sub · run rpcstack'));
  }, { aliases: ['stack'], category: 'rpc', description: 'rpc stacking', sticky: true });

  client.registerCommand('rpctype', async (c, m, args) => {
    const valid = ['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING'];
    const t = (args[0] || '').toUpperCase();
    if (!valid.includes(t)) return m.edit(codeblock('rpc · type', 'valid: ' + valid.join(' · ')));
    stopStack(c);
    if (!c.cfg.rpc) c.cfg.rpc = {};
    c.cfg.rpc.type = t;
    c.cfg.rpc.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · type', kv([['set', t]])));
  }, { category: 'rpc', description: 'set activity type' });

  client.registerCommand('rpctext', async (c, m, args) => {
    stopStack(c);
    if (!c.cfg.rpc) c.cfg.rpc = {};
    c.cfg.rpc.name = args.join(' ') || ' ';
    c.cfg.rpc.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · name', kv([['set', c.cfg.rpc.name]])));
  }, { aliases: ['rpcname'], category: 'rpc', description: 'set name' });

  client.registerCommand('rpcdetails', async (c, m, args) => {
    if (!c.cfg.rpc) c.cfg.rpc = {};
    c.cfg.rpc.details = args.join(' ');
    c.cfg.rpc.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · details', kv([['set', c.cfg.rpc.details || '—']])));
  }, { category: 'rpc', description: 'set details' });

  client.registerCommand('rpcstate', async (c, m, args) => {
    if (!c.cfg.rpc) c.cfg.rpc = {};
    c.cfg.rpc.state = args.join(' ');
    c.cfg.rpc.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · state', kv([['set', c.cfg.rpc.state || '—']])));
  }, { category: 'rpc', description: 'set state' });

  client.registerCommand('rpcimg', async (c, m, args) => {
    if (!c.cfg.rpc) c.cfg.rpc = {};
    c.cfg.rpc.largeImage = args[0] || '';
    c.cfg.rpc.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · image', kv([['set', c.cfg.rpc.largeImage || 'cleared']])));
  }, { category: 'rpc', description: 'set custom image url' });

  client.registerCommand('rpcbtn', async (c, m, args) => {
    if (args.length < 2) return m.edit(codeblock('rpc', 'usage: rpcbtn <label> <url>'));
    if (!c.cfg.rpc) c.cfg.rpc = {};
    c.cfg.rpc.button1Label = args[0];
    c.cfg.rpc.button1URL = args[1];
    c.cfg.rpc.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · btn1', kv([['label', args[0]], ['url', args[1]]])));
  }, { category: 'rpc', description: 'set button 1' });

  client.registerCommand('rpcbtn2', async (c, m, args) => {
    if (args.length < 2) return m.edit(codeblock('rpc', 'usage: rpcbtn2 <label> <url>'));
    if (!c.cfg.rpc) c.cfg.rpc = {};
    c.cfg.rpc.button2Label = args[0];
    c.cfg.rpc.button2URL = args[1];
    c.cfg.rpc.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · btn2', kv([['label', args[0]], ['url', args[1]]])));
  }, { category: 'rpc', description: 'set button 2' });

  client.registerCommand('rpctime', async (c, m, args) => {
    if (!c.cfg.rpc) c.cfg.rpc = {};
    const r = c.cfg.rpc;
    const mode = (args[0] || '').toLowerCase();
    if (mode === 'off') r.start = null;
    else if (mode === 'reset') r.start = Date.now();
    else {
      const h = parseInt((mode.match(/(\d+)h/) || [0, 0])[1], 10) || 0;
      const mm = parseInt((mode.match(/(\d+)m/) || [0, 0])[1], 10) || 0;
      const s = parseInt((mode.match(/(\d+)s/) || [0, 0])[1], 10) || 0;
      r.start = Date.now() - (h * 3600 + mm * 60 + s) * 1000;
    }
    r.enabled = true;
    save(c);
    await push(c);
    await m.edit(codeblock('rpc · timer', kv([['set', r.start ? 'active' : 'off']])));
  }, { category: 'rpc', description: 'set elapsed timer' });

  client.registerCommand('rpcclear', async (c, m) => {
    stopStack(c);
    c.cfg.rpc = { enabled: false, type: 'PLAYING', name: '', details: '', state: '', largeImage: '', appId: '' };
    save(c);
    await clearAllPresence(c);
    await m.edit(codeblock('rpc', 'cleared'));
  }, { aliases: ['stopall'], category: 'rpc', description: 'clear rpc' });

  

  client.registerCommand('rotator', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (!c.cfg.rotator) c.cfg.rotator = { interval: 15, entries: [], index: 0, enabled: false };
    const rot = c.cfg.rotator;

    if (!sub || sub === 'list') {
      const lines = [];
      lines.push('entries   ' + rot.entries.length);
      lines.push('interval  ' + rot.interval + 's');
      lines.push('enabled   ' + (rot.enabled ? 'yes' : 'no'));
      lines.push('');
      if (!rot.entries.length) lines.push('(no entries)');
      else rot.entries.forEach((e, i) => lines.push('#' + (i + 1) + '  ' + e.emoji + '  ' + e.text));
      return m.edit(codeblock('rotator', lines.join('\n')));
    }

    if (sub === 'add') {
      const emoji = args[1];
      const text = args.slice(2).join(' ') || '';
      if (!emoji) return m.edit(codeblock('rotator', 'usage: rotator add <emoji> <text>'));
      rot.entries.push({ emoji, text });
      save(c);
      return m.edit(codeblock('rotator · add', kv([['index', '#' + rot.entries.length], ['emoji', emoji], ['text', text || '—']])));
    }

    if (sub === 'remove' || sub === 'rm') {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 1 || n > rot.entries.length) return m.edit(codeblock('rotator', 'invalid index'));
      const removed = rot.entries.splice(n - 1, 1)[0];
      save(c);
      return m.edit(codeblock('rotator · remove', kv([['removed', '#' + n], ['emoji', removed.emoji], ['text', removed.text || '—']])));
    }

    if (sub === 'interval') {
      const n = parseInt(args[1], 10);
      if (isNaN(n) || n < 5) return m.edit(codeblock('rotator', 'min 5 seconds'));
      rot.interval = n;
      save(c);
      if (rot.enabled && ROTATORS.has(c.uid)) {
        clearInterval(ROTATORS.get(c.uid));
        startRotator(c);
      }
      return m.edit(codeblock('rotator · interval', kv([['set', n + 's']])));
    }

    if (sub === 'start') {
      if (!rot.entries.length) return m.edit(codeblock('rotator', 'no entries'));
      rot.enabled = true;
      rot.index = 0;
      save(c);
      startRotator(c);
      return m.edit(codeblock('rotator', kv([['status', 'running'], ['interval', rot.interval + 's']])));
    }

    if (sub === 'stop') {
      rot.enabled = false;
      save(c);
      if (ROTATORS.has(c.uid)) {
        clearInterval(ROTATORS.get(c.uid));
        ROTATORS.delete(c.uid);
      }
      return m.edit(codeblock('rotator', 'stopped'));
    }

    if (sub === 'clear') {
      rot.entries = [];
      rot.enabled = false;
      save(c);
      if (ROTATORS.has(c.uid)) {
        clearInterval(ROTATORS.get(c.uid));
        ROTATORS.delete(c.uid);
      }
      return m.edit(codeblock('rotator', 'cleared'));
    }

    await m.edit(codeblock('rotator', 'add · remove · list · interval · start · stop · clear'));
  }, { aliases: ['statusrotator'], category: 'rpc', description: 'rotating custom status', sticky: true });

  


  client.registerCommand('rotatorstart', async (c, m) => {
    const rot = c.cfg.rotator;
    if (!rot || !rot.entries.length) return m.edit(codeblock('rotator', 'no entries'));
    rot.enabled = true;
    rot.index = 0;
    save(c);
    startRotator(c);
    await m.edit(codeblock('rotator', 'started'));
  }, { category: 'rpc', description: 'start rotator' });

  client.registerCommand('rotatorstop', async (c, m) => {
    if (!c.cfg.rotator) c.cfg.rotator = { interval: 15, entries: [], index: 0, enabled: false };
    c.cfg.rotator.enabled = false;
    save(c);
    if (ROTATORS.has(c.uid)) {
      clearInterval(ROTATORS.get(c.uid));
      ROTATORS.delete(c.uid);
    }
    await m.edit(codeblock('rotator', 'stopped'));
  }, { category: 'rpc', description: 'stop rotator' });

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
    await m.edit(codeblock('cstatus', kv([['emoji', emoji], ['text', text || '—'], ['applied', ok ? 'yes' : 'no']])));
  }, { aliases: ['cs', 'customstatus'], category: 'rpc', description: 'custom status' });
}

module.exports = { register, push, pushStack, PRESETS, getStack, stopStack, startRotator, stopRotator, resolveTemplate, hasTemplate };
