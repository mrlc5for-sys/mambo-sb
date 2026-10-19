const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

function register(client) {
  client.registerCommand('massunban', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!m.guild) return m.edit(codeblock('massunban', 'server only'));
    if ((args[0] || '').toLowerCase() !== 'yes') return m.edit(codeblock('massunban', 'run massunban yes to confirm'));
    const bans = await m.guild.bans.fetch().catch(() => null);
    if (!bans) return m.edit(codeblock('massunban', 'failed to fetch bans'));
    let count = 0;
    for (const ban of bans.values()) {
      try { await m.guild.members.unban(ban.user.id, 'Mass Unban'); count++; } catch (e) {}
      await new Promise(r => setTimeout(r, 200));
    }
    await m.edit(codeblock('massunban', kv([['unbanned', count]])));
  }, { category: 'mass', description: 'unban all users', gate: 'owner' });

  client.registerCommand('massrole', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    const role = m.mentions.roles.first();
    if (!role) return m.edit(codeblock('massrole', 'usage: massrole @role'));
    if ((args[1] || '').toLowerCase() !== 'yes') return m.edit(codeblock('massrole', 'run massrole @role yes to confirm'));
    const members = await m.guild.members.fetch().catch(() => m.guild.members.cache);
    let count = 0;
    for (const member of members.values()) {
      if (!member.roles.cache.has(role.id)) {
        try { await member.roles.add(role); count++; } catch (e) {}
        await new Promise(r => setTimeout(r, 300));
      }
    }
    await m.edit(codeblock('massrole', kv([['added', role.name], ['count', count]])));
  }, { category: 'mass', description: 'give role to everyone', gate: 'owner' });

  client.registerCommand('massunrole', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    const role = m.mentions.roles.first();
    if (!role) return m.edit(codeblock('massunrole', 'usage: massunrole @role'));
    if ((args[1] || '').toLowerCase() !== 'yes') return m.edit(codeblock('massunrole', 'run massunrole @role yes to confirm'));
    const members = await m.guild.members.fetch().catch(() => m.guild.members.cache);
    let count = 0;
    for (const member of members.values()) {
      if (member.roles.cache.has(role.id)) {
        try { await member.roles.remove(role); count++; } catch (e) {}
        await new Promise(r => setTimeout(r, 300));
      }
    }
    await m.edit(codeblock('massunrole', kv([['removed', role.name], ['count', count]])));
  }, { category: 'mass', description: 'remove role from everyone', gate: 'owner' });

  client.registerCommand('massreact', async (c, m, args) => {
    const emoji = args[0];
    if (!emoji) return m.edit(codeblock('massreact', 'usage: massreact <emoji>'));
    const msgs = await m.channel.messages.fetch({ limit: 50 });
    let count = 0;
    for (const msg of msgs.values()) {
      try { await msg.react(emoji); count++; } catch (e) {}
      await new Promise(r => setTimeout(r, 500));
    }
    await m.edit(codeblock('massreact', kv([['reacted', count]])));
  }, { category: 'mass', description: 'react to last 50 messages' });

  client.registerCommand('forward', async (c, m, args) => {
    const targetId = args[0];
    if (!targetId) return m.edit(codeblock('forward', 'usage: forward <channel_id>'));
    const target = c.channels.cache.get(targetId);
    if (!target) return m.edit(codeblock('forward', 'channel not found'));
    const msgs = await m.channel.messages.fetch({ limit: 10 });
    let count = 0;
    for (const msg of [...msgs.values()].reverse()) {
      try {
        await target.send({ content: msg.content, files: [...msg.attachments.values()].map(a => a.url) });
        count++;
      } catch (e) {}
      await new Promise(r => setTimeout(r, 1000));
    }
    await m.edit(codeblock('forward', kv([['forwarded', count]])));
  }, { category: 'mass', description: 'forward last 10 messages' });

  client.registerCommand('clonechannel', async (c, m) => {
    if (!m.guild) return m.edit(codeblock('clonechannel', 'server only'));
    try {
      const newCh = await m.channel.clone();
      await m.edit(codeblock('clonechannel', kv([['created', newCh.name]])));
    } catch (e) { await m.edit(codeblock('clonechannel', 'error: ' + e.message)); }
  }, { category: 'mass', description: 'clone current channel' });
}

module.exports = { register };
