const axios = require('axios');
const { codeblock, kv } = require('../helpers/render');

function uidFromToken(token) {
  try { return Buffer.from(token.split('.')[0], 'base64').toString(); }
  catch (e) { return null; }
}

function register(client) {
  client.registerCommand('lookup', async (c, m) => {
    await m.edit(codeblock('lookup', [
      'ip <ip>                  geolocation',
      'domain <domain>          whois + dns',
      'userid <username>        resolve user id',
      'invite <code>            invite info',
      'webhook <url>            webhook info',
      'token <token>            offline token info',
      'steam <id|url>           steam profile',
      'mc <username>            minecraft uuid',
      'github <user>            github profile',
      'roblox <user>            roblox profile'
    ].join('\n')));
  }, { category: 'lookup', description: 'lookup menu', sticky: true });

  client.registerCommand('ip', async (c, m, args) => {
    const ip = args[0];
    if (!ip) return m.edit(codeblock('ip', 'usage: ip <address>'));
    try {
      const r = await axios.get('https://ipapi.co/' + encodeURIComponent(ip) + '/json/', { timeout: 10000 });
      const d = r.data;
      if (d.error) return m.edit(codeblock('ip', d.reason || 'invalid'));
      const body = [
        ['ip', d.ip], ['city', d.city], ['region', d.region],
        ['country', d.country_name], ['postal', d.postal || '—'],
        ['lat', d.latitude], ['lon', d.longitude],
        ['timezone', d.timezone], ['org', d.org || '—']
      ];
      await m.edit(codeblock('ip · ' + d.ip, kv(body)));
    } catch (e) { await m.edit(codeblock('ip · error', e.message)); }
  }, { category: 'lookup', description: 'ip geolocation' });

  client.registerCommand('domain', async (c, m, args) => {
    const dom = args[0];
    if (!dom) return m.edit(codeblock('domain', 'usage: domain <domain>'));
    try {
      const r = await axios.get('https://dns.google/resolve?name=' + encodeURIComponent(dom) + '&type=A', { timeout: 10000 });
      const rows = [['domain', dom]];
      if (r.data && r.data.Answer) rows.push(['dns', r.data.Answer.map(a => a.data).join(', ')]);
      await m.edit(codeblock('domain · ' + dom, kv(rows)));
    } catch (e) { await m.edit(codeblock('domain · error', e.message)); }
  }, { category: 'lookup', description: 'domain dns lookup' });

  client.registerCommand('userid', async (c, m, args) => {
    const name = args.join(' ').toLowerCase();
    if (!name) return m.edit(codeblock('userid', 'usage: userid <username>'));
    const found = c.users.cache.find(u => u.username.toLowerCase() === name || (u.globalName && u.globalName.toLowerCase() === name));
    if (!found) return m.edit(codeblock('userid', 'not cached'));
    await m.edit(codeblock('userid', kv([['username', found.username], ['id', found.id], ['tag', found.tag]])));
  }, { category: 'lookup', description: 'resolve user id' });

  client.registerCommand('invite', async (c, m, args) => {
    let code = args[0];
    if (!code) return m.edit(codeblock('invite', 'usage: invite <code>'));
    code = code.replace(/.*\//, '');
    try {
      const r = await axios.get('https://discord.com/api/v10/invites/' + code + '?with_counts=true', {
        headers: { Authorization: c.token }, timeout: 10000, validateStatus: () => true
      });
      if (r.status !== 200) return m.edit(codeblock('invite · error', 'invalid or expired'));
      const d = r.data;
      const body = [
        ['code', d.code],
        ['guild', d.guild ? d.guild.name : '—'],
        ['guild_id', d.guild ? d.guild.id : '—'],
        ['channel', d.channel ? d.channel.name : '—'],
        ['inviter', d.inviter ? d.inviter.username : '—'],
        ['members', d.approximate_member_count || '—'],
        ['online', d.approximate_presence_count || '—']
      ];
      await m.edit(codeblock('invite · ' + code, kv(body)));
    } catch (e) { await m.edit(codeblock('invite · error', e.message)); }
  }, { category: 'lookup', description: 'invite info' });

  client.registerCommand('webhook', async (c, m, args) => {
    const url = args[0];
    if (!url || !url.includes('/webhooks/')) return m.edit(codeblock('webhook', 'usage: webhook <url>'));
    try {
      const r = await axios.get(url, { timeout: 10000, validateStatus: () => true });
      if (r.status !== 200) return m.edit(codeblock('webhook · error', 'invalid'));
      const d = r.data;
      const body = [
        ['id', d.id || '—'], ['name', d.name || '—'],
        ['channel', d.channel_id || '—'], ['guild', d.guild_id || '—'],
        ['token', (d.token || '').slice(0, 20) + '…']
      ];
      await m.edit(codeblock('webhook', kv(body)));
    } catch (e) { await m.edit(codeblock('webhook · error', e.message)); }
  }, { aliases: ['wi'], category: 'lookup', description: 'webhook info' });

  client.registerCommand('token', async (c, m, args) => {
    const tok = args[0];
    if (!tok) return m.edit(codeblock('token', 'usage: token <token>'));
    const parts = tok.split('.');
    if (parts.length !== 3) return m.edit(codeblock('token', 'invalid format'));
    const uid = uidFromToken(tok);
    const created = uid ? new Date(Number((BigInt(uid) >> 22n) + 1420070400000n)) : null;
    const body = [
      ['uid', uid || '—'],
      ['created', created ? created.toISOString() : '—'],
      ['length', tok.length]
    ];
    await m.edit(codeblock('token · info', kv(body)));
  }, { category: 'lookup', description: 'offline token info' });

  client.registerCommand('steam', async (c, m, args) => {
    let id = args[0];
    if (!id) return m.edit(codeblock('steam', 'usage: steam <id|url>'));
    const match = id.match(/steamcommunity\.com\/(id|profiles)\/([^\/\s]+)/);
    if (match) id = match[2];
    try {
      const r = await axios.get('https://steamcommunity.com/' + (match && match[1] === 'profiles' ? 'profiles/' : 'id/') + id + '?xml=1', { timeout: 10000 });
      const xml = r.data;
      const name = (xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/) || [])[1];
      const real = (xml.match(/<realname><!\[CDATA\[(.*?)\]\]><\/realname>/) || [])[1];
      const avatar = (xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || [])[1];
      const status = (xml.match(/<onlineState>(.*?)<\/onlineState>/) || [])[1];
      const steamId = (xml.match(/<steamID64>(.*?)<\/steamID64>/) || [])[1];
      const body = [
        ['name', name || '—'], ['realname', real || '—'],
        ['steamid', steamId || '—'], ['status', status || '—'],
        ['avatar', avatar || '—']
      ];
      await m.edit(codeblock('steam · ' + id, kv(body)));
    } catch (e) { await m.edit(codeblock('steam · error', e.message)); }
  }, { category: 'lookup', description: 'steam profile' });

  client.registerCommand('mc', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('mc', 'usage: mc <username>'));
    try {
      const r = await axios.get('https://api.mojang.com/users/profiles/minecraft/' + name, { timeout: 8000, validateStatus: () => true });
      if (r.status !== 200) return m.edit(codeblock('mc · error', 'not found'));
      const body = [
        ['name', r.data.name], ['uuid', r.data.id],
        ['skin', 'https://crafatar.com/renders/body/' + r.data.id]
      ];
      await m.edit(codeblock('mc · ' + r.data.name, kv(body)));
    } catch (e) { await m.edit(codeblock('mc · error', e.message)); }
  }, { aliases: ['minecraft'], category: 'lookup', description: 'minecraft profile' });

  client.registerCommand('github', async (c, m, args) => {
    const user = args[0];
    if (!user) return m.edit(codeblock('github', 'usage: github <user>'));
    try {
      const r = await axios.get('https://api.github.com/users/' + encodeURIComponent(user), {
        headers: { 'User-Agent': 'Mambo' }, timeout: 10000, validateStatus: () => true
      });
      if (r.status !== 200) return m.edit(codeblock('github · error', 'not found'));
      const d = r.data;
      const body = [
        ['login', d.login], ['name', d.name || '—'],
        ['bio', (d.bio || '—').slice(0, 60)], ['repos', d.public_repos],
        ['followers', d.followers], ['following', d.following],
        ['created', (d.created_at || '').slice(0, 10)], ['url', d.html_url]
      ];
      await m.edit(codeblock('github · ' + d.login, kv(body)));
    } catch (e) { await m.edit(codeblock('github · error', e.message)); }
  }, { category: 'lookup', description: 'github profile' });

  client.registerCommand('roblox', async (c, m, args) => {
    const user = args[0];
    if (!user) return m.edit(codeblock('roblox', 'usage: roblox <username>'));
    try {
      const search = await axios.post('https://users.roblox.com/v1/usernames/users', { usernames: [user], excludeBannedUsers: false }, { timeout: 10000 });
      const found = search.data && search.data.data && search.data.data[0];
      if (!found) return m.edit(codeblock('roblox · error', 'not found'));
      const body = [
        ['id', found.id], ['name', found.name], ['display', found.displayName],
        ['profile', 'https://www.roblox.com/users/' + found.id + '/profile']
      ];
      await m.edit(codeblock('roblox · ' + found.name, kv(body)));
    } catch (e) { await m.edit(codeblock('roblox · error', e.message)); }
  }, { category: 'lookup', description: 'roblox profile' });
}

module.exports = { register };
