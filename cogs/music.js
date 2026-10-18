const { codeblock, kv } = require('../helpers/render');

function register(client) {
  client.registerCommand('music', async (c, m) => {
    await m.edit(codeblock('music', [
      'play <query>       search + queue',
      'skip               next track',
      'stop               clear queue',
      'queue              view queue',
      'nowplaying         current track',
      '',
      'Note: Lavalink integration required for full playback.'
    ].join('\n')));
  }, { category: 'music', description: 'music menu', sticky: true });

  client.registerCommand('play', async (c, m, args) => {
    const query = args.join(' ');
    if (!query) return m.edit(codeblock('play', 'usage: play <query>'));
    await m.edit(codeblock('music', kv([['queued', query.slice(0, 60)], ['status', 'lavalink required']])));
  }, { category: 'music', description: 'play track' });

  client.registerCommand('skip', async (c, m) => {
    await m.edit(codeblock('music', 'skipped'));
  }, { category: 'music', description: 'skip track' });

  client.registerCommand('stop', async (c, m) => {
    await m.edit(codeblock('music', 'stopped'));
  }, { category: 'music', description: 'stop playback' });

  client.registerCommand('queue', async (c, m) => {
    await m.edit(codeblock('music · queue', 'queue is empty'));
  }, { aliases: ['q'], category: 'music', description: 'view queue' });

  client.registerCommand('nowplaying', async (c, m) => {
    await m.edit(codeblock('music · now', 'nothing playing'));
  }, { aliases: ['np'], category: 'music', description: 'now playing' });
}

module.exports = { register };
