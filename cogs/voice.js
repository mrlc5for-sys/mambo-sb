const { codeblock, kv } = require('../helpers/render');

function sendVoiceState(client, guildId, channelId, selfMute, selfDeaf) {
  const shard = client.ws.shards.first();
  if (!shard) return false;
  shard.send({
    op: 4,
    d: { guild_id: guildId, channel_id: channelId, self_mute: !!selfMute, self_deaf: !!selfDeaf }
  });
  return true;
}


  function startVoiceHeartbeat(c) {
    if (c._voiceInterval) clearInterval(c._voiceInterval);
    c._voiceInterval = setInterval(() => {
      if (c._vcGuild && c._vcChannel) {
        const guild = c.guilds.cache.get(c._vcGuild);
        const member = guild ? guild.members.cache.get(c.user.id) : null;
        if (!member || !member.voice.channelId) {
          sendVoiceState(c, c._vcGuild, c._vcChannel, false, false);
        }
      } else {
        clearInterval(c._voiceInterval);
      }
    }, 15000);
  }


function register(client) {
  client.registerCommand('vc', async (c, m) => {
    await m.edit(codeblock('voice', [
      'join [channel]         join vc',
      'leave                  leave vc',
      'vcmute on|off          self-mute',
      'vcdeaf on|off          self-deaf',
      'vcmove @user <channel> drag user',
      'vcdc @user             kick from vc',
      'vcmoveall <channel>    drag everyone',
      'vcusers                users in vc',
      'vcspy @user            join user vc'
    ].join('\n')));
  }, { aliases: ['voice'], category: 'voice', description: 'voice menu', sticky: true });

  client.registerCommand('join', async (c, m, args) => {
    const chan = m.mentions.channels.first() ||
      (args[0] ? c.channels.cache.get(args[0]) : null) ||
      (m.member && m.member.voice ? m.member.voice.channel : null);
    if (!chan) return m.edit(codeblock('vc', 'no channel'));
    const guild = chan.guild;
    if (!guild) return m.edit(codeblock('vc', 'not a guild channel'));
    c._vcChannel = chan.id;
    c._vcGuild = guild.id;
    sendVoiceState(c, guild.id, chan.id, false, false);
    startVoiceHeartbeat(c);
    await m.edit(codeblock('vc · joined', kv([['channel', chan.name], ['guild', guild.name]])));
  }, { aliases: ['vcjoin'], category: 'voice', description: 'join voice channel' });

  client.registerCommand('leave', async (c, m) => {
    if (!c._vcGuild) return m.edit(codeblock('vc', 'not in vc'));
    sendVoiceState(c, c._vcGuild, null, false, false);
    c._vcChannel = null;
    c._vcGuild = null;
    await m.edit(codeblock('vc · left', 'disconnected'));
  }, { aliases: ['vcleave'], category: 'voice', description: 'leave voice channel' });

  client.registerCommand('vcmute', async (c, m, args) => {
    const on = (args[0] || 'on').toLowerCase() !== 'off';
    if (!c._vcGuild) return m.edit(codeblock('vc', 'not in vc'));
    sendVoiceState(c, c._vcGuild, c._vcChannel, on, false);
    await m.edit(codeblock('vc · mute', kv([['state', on ? 'muted' : 'unmuted']])));
  }, { category: 'voice', description: 'toggle self mute' });

  client.registerCommand('vcdeaf', async (c, m, args) => {
    const on = (args[0] || 'on').toLowerCase() !== 'off';
    if (!c._vcGuild) return m.edit(codeblock('vc', 'not in vc'));
    sendVoiceState(c, c._vcGuild, c._vcChannel, false, on);
    await m.edit(codeblock('vc · deaf', kv([['state', on ? 'deafened' : 'undeafened']])));
  }, { category: 'voice', description: 'toggle self deafen' });

  client.registerCommand('vcmove', async (c, m, args) => {
    const target = m.mentions.members.first();
    const chan = m.mentions.channels.first() || (args[1] ? c.channels.cache.get(args[1]) : null);
    if (!target || !chan) return m.edit(codeblock('vcmove', 'usage: vcmove @user <channel>'));
    try {
      await target.voice.setChannel(chan);
      await m.edit(codeblock('vc · move', kv([['user', target.user.tag], ['to', chan.name]])));
    } catch (e) { await m.edit(codeblock('vc · error', e.message)); }
  }, { category: 'voice', description: 'drag user to channel' });

  client.registerCommand('vcdc', async (c, m) => {
    const target = m.mentions.members.first();
    if (!target) return m.edit(codeblock('vcdc', 'usage: vcdc @user'));
    try {
      await target.voice.disconnect();
      await m.edit(codeblock('vc · disconnect', kv([['user', target.user.tag]])));
    } catch (e) { await m.edit(codeblock('vc · error', e.message)); }
  }, { aliases: ['vckick'], category: 'voice', description: 'kick user from vc' });

  client.registerCommand('vcmoveall', async (c, m, args) => {
    const chan = m.mentions.channels.first() || (args[0] ? c.channels.cache.get(args[0]) : null);
    if (!chan) return m.edit(codeblock('vcmoveall', 'usage: vcmoveall <channel>'));
    let moved = 0;
    for (const member of chan.guild.members.cache.values()) {
      if (!member.voice || !member.voice.channel) continue;
      if (member.voice.channel.id === chan.id) continue;
      try { await member.voice.setChannel(chan); moved++; } catch (e) {}
    }
    await m.edit(codeblock('vc · moveall', kv([['moved', moved], ['to', chan.name]])));
  }, { category: 'voice', description: 'drag everyone to channel' });

  client.registerCommand('vcusers', async (c, m) => {
    if (!c._vcChannel) return m.edit(codeblock('vcusers', 'not in vc'));
    const chan = c.channels.cache.get(c._vcChannel);
    if (!chan) return m.edit(codeblock('vcusers', 'channel missing'));
    const members = [...chan.members.values()];
    if (!members.length) return m.edit(codeblock('vc · ' + chan.name, 'empty'));
    await m.edit(codeblock('vc · ' + chan.name, members.map(mem => mem.user.tag).join('\n')));
  }, { category: 'voice', description: 'users in current vc' });

  client.registerCommand('vcspy', async (c, m) => {
    const target = m.mentions.members.first();
    if (!target || !target.voice || !target.voice.channel) return m.edit(codeblock('vcspy', 'usage: vcspy @user'));
    const chan = target.voice.channel;
    c._vcChannel = chan.id;
    c._vcGuild = chan.guild.id;
    sendVoiceState(c, chan.guild.id, chan.id, false, false);
    await m.edit(codeblock('vc · spy', kv([['target', target.user.tag], ['channel', chan.name]])));
  }, { category: 'voice', description: 'join user vc' });
}

module.exports = { register };
