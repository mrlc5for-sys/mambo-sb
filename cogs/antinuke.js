const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

const tracker = new Map();
const antiNukeStates = new Map();

function register(client) {
  const threshold = 3;
  const timeWindow = 10000;

  const logAction = (guildId, userId, action) => {
    if (!tracker.has(guildId)) tracker.set(guildId, new Map());
    const guildTrack = tracker.get(guildId);
    if (!guildTrack.has(userId)) guildTrack.set(userId, []);
    
    const actions = guildTrack.get(userId);
    const now = Date.now();
    actions.push({ action, time: now });
    
    const recent = actions.filter(a => now - a.time < timeWindow);
    guildTrack.set(userId, recent);
    
    return recent.length;
  };

  client.on('channelDelete', async (channel) => {
    if (!channel.guild || !channel.guild.ownerId) return;
    const state = antiNukeStates.get(channel.guild.id);
    if (!state || !state.enabled) return;
    
    try {
      const auditLogs = await channel.guild.fetchAuditLogs({ limit: 1, type: 'CHANNEL_DELETE' });
      const entry = auditLogs.entries.first();
      if (!entry || !entry.executor) return;
      
      const executor = entry.executor;
      if (executor.id === client.user.id || executor.id === channel.guild.ownerId) return;
      if (state.whitelist.includes(executor.id)) return;
      
      const count = logAction(channel.guild.id, executor.id, 'channelDelete');
      if (count >= threshold) {
        const member = await channel.guild.members.fetch(executor.id).catch(() => null);
        if (member && member.bannable) {
          await member.ban({ reason: 'Anti-Nuke: Mass channel deletion' }).catch(() => {});
          const owner = await client.users.fetch(channel.guild.ownerId).catch(() => null);
          if (owner) {
            owner.send(codeblock('anti-nuke', kv([
              ['guild', channel.guild.name],
              ['offender', executor.tag],
              ['action', 'banned'],
              ['reason', 'Mass channel deletion']
            ]))).catch(() => {});
          }
        }
      }
    } catch (e) {}
  });

  client.on('roleDelete', async (role) => {
    if (!role.guild || !role.guild.ownerId) return;
    const state = antiNukeStates.get(role.guild.id);
    if (!state || !state.enabled) return;
    
    try {
      const auditLogs = await role.guild.fetchAuditLogs({ limit: 1, type: 'ROLE_DELETE' });
      const entry = auditLogs.entries.first();
      if (!entry || !entry.executor) return;
      
      const executor = entry.executor;
      if (executor.id === client.user.id || executor.id === role.guild.ownerId) return;
      if (state.whitelist.includes(executor.id)) return;
      
      const count = logAction(role.guild.id, executor.id, 'roleDelete');
      if (count >= threshold) {
        const member = await role.guild.members.fetch(executor.id).catch(() => null);
        if (member && member.bannable) {
          await member.ban({ reason: 'Anti-Nuke: Mass role deletion' }).catch(() => {});
        }
      }
    } catch (e) {}
  });

  client.on('webhookUpdate', async (channel) => {
    if (!channel.guild) return;
    const state = antiNukeStates.get(channel.guild.id);
    if (!state || !state.enabled) return;
    try {
      const webhooks = await channel.fetchWebhooks();
      for (const wh of webhooks.values()) {
        if (wh.owner && state.whitelist.includes(wh.owner.id)) continue;
        await wh.delete('Anti-Nuke: Unauthorized webhook');
      }
    } catch (e) {}
  });

  client.on('guildMemberAdd', async (member) => {
    if (!member.user.bot) return;
    const state = antiNukeStates.get(member.guild.id);
    if (!state || !state.enabled) return;
    if (state.whitelist.includes(member.id)) return;
    try {
      await member.kick('Anti-Nuke: Unauthorized bot');
    } catch (e) {}
  });

  client.registerCommand('antinuke', async (c, m, args) => {
    if (!m.guild) return m.edit(codeblock('anti-nuke', 'server only'));
    const sub = (args[0] || '').toLowerCase();
    
    if (!antiNukeStates.has(m.guild.id)) {
      antiNukeStates.set(m.guild.id, { enabled: false, whitelist: [] });
    }
    const state = antiNukeStates.get(m.guild.id);

    if (sub === 'on') {
      state.enabled = true;
      return m.edit(codeblock('anti-nuke', 'enabled'));
    }
    if (sub === 'off') {
      state.enabled = false;
      return m.edit(codeblock('anti-nuke', 'disabled'));
    }
    if (sub === 'whitelist') {
      const target = m.mentions.users.first();
      if (!target) return m.edit(codeblock('anti-nuke', 'mention a user to whitelist'));
      if (!state.whitelist.includes(target.id)) state.whitelist.push(target.id);
      return m.edit(codeblock('anti-nuke', kv([['whitelisted', target.tag]])));
    }
    
    await m.edit(codeblock('anti-nuke', kv([
      ['status', state.enabled ? 'enabled' : 'disabled'],
      ['threshold', '3 actions / 10s'],
      ['whitelist', state.whitelist.length + ' users']
    ])));
  }, { category: 'mod', description: 'toggle anti-nuke protection', usage: '[on|off|whitelist]' });

  client.registerCommand('lockdown', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!m.guild) return m.edit(codeblock('lockdown', 'server only'));
    if ((args[0] || '').toLowerCase() !== 'yes') return m.edit(codeblock('lockdown', 'run lockdown yes to confirm'));
    let count = 0;
    for (const ch of m.guild.channels.cache.values()) {
      if (ch.type === 'GUILD_TEXT') {
        try { await ch.permissionOverwrites.edit(m.guild.roles.everyone, { SendMessages: false }); count++; } catch (e) {}
        await new Promise(r => setTimeout(r, 300));
      }
    }
    await m.edit(codeblock('lockdown', kv([['locked', count]])));
  }, { category: 'mod', description: 'lock all channels', gate: 'owner' });

  client.registerCommand('unlockdown', async (c, m) => {
    if (!(await requireOwner(c, m))) return;
    if (!m.guild) return m.edit(codeblock('unlockdown', 'server only'));
    let count = 0;
    for (const ch of m.guild.channels.cache.values()) {
      if (ch.type === 'GUILD_TEXT') {
        try { await ch.permissionOverwrites.edit(m.guild.roles.everyone, { SendMessages: null }); count++; } catch (e) {}
        await new Promise(r => setTimeout(r, 300));
      }
    }
    await m.edit(codeblock('unlockdown', kv([['unlocked', count]])));
  }, { category: 'mod', description: 'unlock all channels', gate: 'owner' });
}

module.exports = { register };
