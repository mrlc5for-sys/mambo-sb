const axios = require('axios');
const { codeblock, kv } = require('../helpers/render');

function mockCase(t) {
  return t.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function register(client) {
  client.registerCommand('fun', async (c, m) => {
    await m.edit(codeblock('fun', [
      'ghostping @user       ping then delete',
      'mock <text>           alternate case',
      'reverse <text>        reverse text',
      'nitro                 fake nitro link',
      'ascii <text>          morse code',
      'meme                  random meme',
      'joke                  dad joke',
      '8ball <question>      magic 8 ball',
      'coin                  flip a coin',
      'roll [sides]          roll dice'
    ].join('\n')));
  }, { category: 'fun', description: 'fun menu', sticky: true });

  client.registerCommand('ghostping', async (c, m) => {
    const target = m.mentions.users.first();
    if (!target) return m.edit(codeblock('ghostping', 'usage: ghostping @user'));
    const sent = await m.channel.send('<' + '@' + target.id + '>');
    await sent.delete().catch(() => {});
    await m.delete().catch(() => {});
  }, { category: 'fun', description: 'ping then delete' });

  client.registerCommand('mock', async (c, m, args) => {
    const text = args.join(' ');
    if (!text) return m.edit(codeblock('mock', 'usage: mock <text>'));
    await m.edit(mockCase(text));
  }, { category: 'fun', description: 'alternate case' });

  client.registerCommand('reverse', async (c, m, args) => {
    const text = args.join(' ');
    if (!text) return m.edit(codeblock('reverse', 'usage: reverse <text>'));
    await m.edit(text.split('').reverse().join(''));
  }, { category: 'fun', description: 'reverse text' });

  client.registerCommand('nitro', async (c, m) => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 16; i++) code += chars[Math.floor(Math.random() * chars.length)];
    await m.edit('https://discord.gift/' + code);
  }, { aliases: ['fakenitro'], category: 'fun', description: 'fake nitro link' });

  client.registerCommand('ascii', async (c, m, args) => {
    const text = args.join(' ');
    if (!text) return m.edit(codeblock('ascii', 'usage: ascii <text>'));
    const map = { a: '.-.', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..' };
    const out = text.toLowerCase().split('').map(ch => map[ch] || ch).join(' ');
    await m.edit(codeblock('ascii', out));
  }, { category: 'fun', description: 'morse code' });

  client.registerCommand('meme', async (c, m) => {
    try {
      const r = await axios.get('https://www.reddit.com/r/memes.json?sort=top&t=week&limit=50', { headers: { 'User-Agent': 'Mambo/1.0' }, timeout: 10000 });
      const post = pick(r.data.data.children).data;
      await m.edit(post.url);
    } catch (e) { await m.edit(codeblock('meme', 'error: ' + e.message)); }
  }, { category: 'fun', description: 'random meme' });

  client.registerCommand('joke', async (c, m) => {
    try {
      const r = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' }, timeout: 8000 });
      await m.edit(r.data.joke);
    } catch (e) { await m.edit(codeblock('joke', 'error: ' + e.message)); }
  }, { aliases: ['dadjoke'], category: 'fun', description: 'dad joke' });

  client.registerCommand('8ball', async (c, m, args) => {
    const q = args.join(' ');
    if (!q) return m.edit(codeblock('8ball', 'usage: 8ball <question>'));
    const answers = ['yes', 'no', 'maybe', 'definitely', 'absolutely not', 'ask again', 'signs point to yes', 'outlook unclear', 'doubtful', 'for sure', 'never', 'obviously'];
    await m.edit(codeblock('8ball', kv([['q', q], ['a', pick(answers)]])));
  }, { aliases: ['8b'], category: 'fun', description: 'magic 8 ball' });

  client.registerCommand('coin', async (c, m) => {
    await m.edit(codeblock('coin', pick(['heads', 'tails'])));
  }, { aliases: ['flip'], category: 'fun', description: 'flip a coin' });

  client.registerCommand('roll', async (c, m, args) => {
    const sides = parseInt(args[0], 10) || 6;
    const result = Math.floor(Math.random() * sides) + 1;
    await m.edit(codeblock('roll', kv([['dice', 'd' + sides], ['result', result]])));
  }, { category: 'fun', description: 'roll a dice' });
}

module.exports = { register };
