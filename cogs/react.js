const { codeblock, kv } = require('../helpers/render');

const reactStates = new Map();

function getState(clientId) {
  if (!reactStates.has(clientId)) {
    reactStates.set(clientId, { enabled: false, emojis: ['💀'], target: null, isSuper: false });
  }
  return reactStates.get(clientId);
}

function register(client) {
  client.on('messageCreate', async (message) => {
    if (!client.user || message.author.id === client.user.id) return;
    
    const state = getState(client.user.id);
    if (!state.enabled) return;
    
    if (state.target && message.author.id !== state.target) return;

    for (const emoji of state.emojis) {
      try {
        if (state.isSuper) {
          await message.react(emoji, true).catch(() => message.react(emoji).catch(() => {}));
        } else {
          await message.react(emoji).catch(() => {});
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {}
    }
  });

  client.registerCommand('r', async (c, m, args) => {
    const state = getState(c.user.id);
    
    if (!args.length || args[0].toLowerCase() === 'off') {
      state.enabled = false;
      return m.edit(codeblock('auto-react', 'disabled'));
    }

    const target = m.mentions.users.first() || (/^\d{10,}$/.test(args[0]) ? c.users.cache.get(args[0]) : null);
    const emojis = target ? args.slice(1) : args;

    if (!emojis.length) {
      return m.edit(codeblock('auto-react', 'usage: r [@user] <emoji1> <emoji2> ...'));
    }

    state.enabled = true;
    state.isSuper = false;
    state.target = target ? target.id : null;
    state.emojis = emojis;

    await m.edit(codeblock('auto-react', kv([
      ['status', 'enabled'],
      ['type', 'normal'],
      ['target', target ? target.tag : 'everyone'],
      ['emojis', emojis.join(' ')]
    ])));
  }, { category: 'fun', description: 'auto react to messages', usage: '[@user] <emojis>' });

  client.registerCommand('sr', async (c, m, args) => {
    const state = getState(c.user.id);
    
    if (!args.length || args[0].toLowerCase() === 'off') {
      state.enabled = false;
      return m.edit(codeblock('super-react', 'disabled'));
    }

    const target = m.mentions.users.first() || (/^\d{10,}$/.test(args[0]) ? c.users.cache.get(args[0]) : null);
    const emojis = target ? args.slice(1) : args;

    if (!emojis.length) {
      return m.edit(codeblock('super-react', 'usage: sr [@user] <emoji1> <emoji2> ...'));
    }

    state.enabled = true;
    state.isSuper = true;
    state.target = target ? target.id : null;
    state.emojis = emojis;

    await m.edit(codeblock('super-react', kv([
      ['status', 'enabled'],
      ['type', 'super (nitro)'],
      ['target', target ? target.tag : 'everyone'],
      ['emojis', emojis.join(' ')]
    ])));
  }, { category: 'fun', description: 'super react to messages', usage: '[@user] <emojis>' });

  client.registerCommand('rstatus', async (c, m) => {
    const state = getState(c.user.id);
    if (!state.enabled) return m.edit(codeblock('auto-react', 'currently disabled'));
    
    await m.edit(codeblock('auto-react', kv([
      ['status', 'enabled'],
      ['type', state.isSuper ? 'super' : 'normal'],
      ['target', state.target || 'everyone'],
      ['emojis', state.emojis.join(' ')]
    ])));
  }, { category: 'fun', description: 'check auto react status' });
}

module.exports = { register };
