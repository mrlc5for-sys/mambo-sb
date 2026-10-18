const util = require('util');
const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

function register(client, allClients) {
  allClients = allClients || [client];

  client.registerCommand('owner', async (c, m) => {
    await m.edit(codeblock('owner', [
      'eval <code>              eval js',
      'exec <code>              eval with console capture',
      'restart yes              restart process',
      'stop yes                 shutdown process',
      'allstatus <state>        set all statuses'
    ].join('\n')));
  }, { category: 'owner', description: 'owner menu', gate: 'owner', sticky: true });

  client.registerCommand('eval', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    const code = args.join(' ');
    if (!code) return m.edit(codeblock('eval', 'usage: eval <code>'));
    try {
      let result = eval(code);
      if (result && typeof result.then === 'function') result = await result;
      const out = util.inspect(result, { depth: 1 }).slice(0, 1800);
      await m.edit('> ```\n> ' + out.split('\n').join('\n> ') + '\n> ```');
    } catch (e) {
      await m.edit('> ```\n> ' + String(e.stack || e.message).slice(0, 1800).split('\n').join('\n> ') + '\n> ```');
    }
  }, { category: 'owner', description: 'eval js', gate: 'owner' });

  client.registerCommand('exec', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    const code = args.join(' ');
    if (!code) return m.edit(codeblock('exec', 'usage: exec <code>'));
    const logs = [];
    const orig = console.log;
    console.log = (...a) => logs.push(a.map(x => typeof x === 'string' ? x : util.inspect(x)).join(' '));
    try {
      let result = eval(code);
      if (result && typeof result.then === 'function') result = await result;
      if (result !== undefined) logs.push(util.inspect(result, { depth: 1 }));
    } catch (e) { logs.push(String(e.stack || e.message)); }
    console.log = orig;
    let out = logs.join('\n') || '(no output)';
    if (out.length > 1800) out = out.slice(-1800);
    await m.edit('> ```\n> ' + out.split('\n').join('\n> ') + '\n> ```');
  }, { category: 'owner', description: 'exec js', gate: 'owner' });

  client.registerCommand('restart', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if ((args[0] || '').toLowerCase() !== 'yes') return m.edit(codeblock('restart', 'run restart yes to confirm'));
    await m.edit(codeblock('restart', 'rebooting'));
    setTimeout(() => process.exit(0), 800);
  }, { aliases: ['reboot'], category: 'owner', description: 'restart process', gate: 'owner' });

  client.registerCommand('stop', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if ((args[0] || '').toLowerCase() !== 'yes') return m.edit(codeblock('stop', 'run stop yes to confirm'));
    await m.edit(codeblock('stop', 'shutting down'));
    setTimeout(() => process.exit(0), 800);
  }, { aliases: ['shutdown'], category: 'owner', description: 'shutdown process', gate: 'owner' });

  client.registerCommand('allstatus', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    const status = (args[0] || '').toLowerCase();
    const valid = ['online', 'idle', 'dnd', 'invisible'];
    if (!valid.includes(status)) return m.edit(codeblock('allstatus', valid.join(' · ')));
    let count = 0;
    for (const cl of allClients) {
      try {
        const shard = cl.ws && cl.ws.shards ? cl.ws.shards.first() : null;
        if (shard) { shard.send({ op: 3, d: { status, since: 0, activities: [], afk: false } }); count++; }
      } catch (e) {}
    }
    await m.edit(codeblock('allstatus', kv([['set', status], ['clients', count]])));
  }, { category: 'owner', description: 'set all status', gate: 'owner' });
}

module.exports = { register };
