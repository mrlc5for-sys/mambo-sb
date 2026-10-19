const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

function register(client) {
  client.registerCommand('cloner', async (c, m, args) => {
    await m.edit(codeblock('cloner', [
      'clone <guild_id> yes    clone a server to current',
      'template                export current as template',
      'load <json>             load template'
    ].join('\n')));
  }, { category: 'cloner', description: 'server cloner', sticky: true });

  client.registerCommand('clone', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!m.guild) return m.edit(codeblock('cloner', 'server only'));
    if ((args[1] || '').toLowerCase() !== 'yes') return m.edit(codeblock('cloner', 'run clone <id> yes to confirm'));

    const srcGuild = c.guilds.cache.get(args[0]);
    if (!srcGuild) return m.edit(codeblock('cloner', 'source guild not found'));

    const tgtGuild = m.guild;
    await m.edit(codeblock('cloner', 'cloning...'));

    try {
      const roles = [...srcGuild.roles.cache.values()].sort((a, b) => b.position - a.position).filter(r => r.id !== srcGuild.id);
      const roleMap = new Map();
      
      for (const role of roles) {
        const newRole = await tgtGuild.roles.create({
          name: role.name, color: role.color, hoist: role.hoist, permissions: role.permissions, mentionable: role.mentionable
        }).catch(() => null);
        if (newRole) roleMap.set(role.id, newRole.id);
      }

      const categories = srcGuild.channels.cache.filter(ch => ch.type === 'GUILD_CATEGORY');
      for (const cat of categories.values()) {
        const newCat = await tgtGuild.channels.create(cat.name, { type: 'GUILD_CATEGORY' }).catch(() => null);
        const children = srcGuild.channels.cache.filter(ch => ch.parentId === cat.id);
        for (const ch of children.values()) {
          await tgtGuild.channels.create(ch.name, { 
            type: ch.type, 
            parent: newCat.id, 
            topic: ch.topic || null, 
            nsfw: ch.nsfw 
          }).catch(() => null);
        }
      }

      const noParent = srcGuild.channels.cache.filter(ch => !ch.parentId && ch.type !== 'GUILD_CATEGORY');
      for (const ch of noParent.values()) {
        await tgtGuild.channels.create(ch.name, { type: ch.type }).catch(() => null);
      }

      await m.edit(codeblock('cloner', kv([['status', 'completed'], ['roles', roles.length], ['channels', srcGuild.channels.cache.size]])));
    } catch (e) {
      await m.edit(codeblock('cloner', 'error: ' + e.message));
    }
  }, { category: 'cloner', description: 'clone server' });
}

module.exports = { register };
