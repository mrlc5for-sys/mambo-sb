const { RichPresence } = require('discord.js-selfbot-v13');

const APPS = {
  1: { key: 'spotify',      name: 'Spotify',           appId: '383226320970055681',  defaultType: 'LISTENING', largeImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Spotify_icon.svg/512px-Spotify_icon.svg.png', largeText: 'Spotify' },
  2: { key: 'crunchyroll',  name: 'Crunchyroll',       appId: '981509069309354054',  defaultType: 'WATCHING',  largeImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Crunchyroll_Logo.svg/512px-Crunchyroll_Logo.svg.png', largeText: 'Crunchyroll' },
  3: { key: 'youtube',      name: 'YouTube',           appId: '463092042733944832',  defaultType: 'WATCHING',  largeImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/YouTube_full-color_icon_%282017%29.svg/512px-YouTube_full-color_icon_%282017%29.svg.png', largeText: 'YouTube' },
  4: { key: 'netflix',      name: 'Netflix',           appId: '926541425682829352',  defaultType: 'WATCHING',  largeImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Netflix_2015_logo.svg/512px-Netflix_2015_logo.svg.png', largeText: 'Netflix' },
  5: { key: 'twitch',       name: 'Twitch',            appId: '356875570916753438',  defaultType: 'STREAMING', largeImage: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Twitch_Glitch_Logo_Purple.svg/512px-Twitch_Glitch_Logo_Purple.svg.png', largeText: 'Twitch' },
  6: { key: 'custom',       name: 'Custom',            appId: null,                  defaultType: 'PLAYING',   largeImage: null, largeText: null }
};

const TYPES = {
  1: 'PLAYING',
  2: 'STREAMING',
  3: 'LISTENING',
  4: 'WATCHING',
  5: 'COMPETING'
};

function menuBox(title, lines) {
  return `> \`\`\`ini\n> [ ${title} ]\n> \`\`\`\n> \`\`\`\n> ${lines.join('\n> ')}\n> \`\`\``;
}

function buildAppMenu() {
  const lines = [];
  for (const [num, app] of Object.entries(APPS)) {
    lines.push(`${num}.  ${app.name.padEnd(14)}  ·  ${app.defaultType}`);
  }
  lines.push('');
  lines.push('react with the number below to pick');
  lines.push('react ✖ to cancel');
  return menuBox('rpc · select app', lines);
}

function buildTypeMenu(app) {
  const lines = [];
  for (const [num, type] of Object.entries(TYPES)) {
    const marker = type === app.defaultType ? ' (default)' : '';
    lines.push(`${num}.  ${type}${marker}`);
  }
  lines.push('');
  lines.push(`app: ${app.name}`);
  lines.push('react with the number to pick a type');
  lines.push('react ↩ to go back');
  return menuBox('rpc · select type', lines);
}

function buildConfirmMenu(app, type, details, state) {
  const lines = [
    `app      ${app.name}`,
    `type     ${type}`,
    `details  ${details || '—'}`,
    `state    ${state || '—'}`,
    '',
    'react ✅ to apply',
    'react ↩ to go back',
    'react ✖ to cancel'
  ];
  return menuBox('rpc · confirm', lines);
}

async function applyRPC(client, config, app, type, details, state) {
  const rpc = new RichPresence(client);
  if (app.appId) rpc.setApplicationId(app.appId);
  else rpc.setApplicationId(client.user.id);
  rpc.setType(type);
  rpc.setName(app.name === 'Custom' ? (details || 'Custom Activity') : app.name);
  if (details) rpc.setDetails(details.slice(0, 128));
  if (state) rpc.setState(state.slice(0, 128));
  rpc.setStartTimestamp(Date.now());

  if (app.largeImage) {
    try {
      const resolved = await RichPresence.getExternal(client, client.user.id, app.largeImage);
      if (resolved && resolved.length && resolved[0].external_asset_path) {
        rpc.setAssetsLargeImage('mp:' + resolved[0].external_asset_path);
        if (app.largeText) rpc.setAssetsLargeText(app.largeText);
      }
    } catch (e) {}
  }

  config.type = type;
  config.name = app.name === 'Custom' ? (details || 'Custom Activity') : app.name;
  config.details = details || '';
  config.state = state || '';
  config.appId = app.appId || '';
  config.largeImage = app.largeImage || '';
  config.largeText = app.largeText || '';
  config.startTimestamp = Date.now();
  config.enabled = true;
  config.customGuiApplied = true;

  return rpc;
}

function startGui(client, message, config, saveConfig, updateRPC) {
  const state = {
    stage: 'app',
    app: null,
    type: null,
    details: '',
    stateStr: '',
    menuMsg: null
  };

  const reactionFilters = [];

  const cleanup = async () => {
    for (const f of reactionFilters) {
      try { f(); } catch (e) {}
    }
    reactionFilters.length = 0;
  };

  const sendMenu = async (text, emojis) => {
    await cleanup();
    const msg = state.menuMsg
      ? await state.menuMsg.edit(text).catch(() => null)
      : await message.reply(text);
    if (!msg) return null;
    state.menuMsg = msg;
    for (const emoji of emojis) {
      try { await msg.react(emoji); } catch (e) {}
      await new Promise(r => setTimeout(r, 300));
    }
    return msg;
  };

  const listen = (emojis, handler) => {
    const map = {};
    for (const e of emojis) map[e] = handler;

    const filter = (reaction, user) => {
      if (user.id !== client.user.id) return false;
      if (reaction.message.id !== state.menuMsg.id) return false;
      return emojis.includes(reaction.emoji.name);
    };

    const collector = state.menuMsg.createReactionCollector({ filter, time: 60000 });

    collector.on('collect', async (reaction, user) => {
      try { await reaction.users.remove(user.id); } catch (e) {}
      await cleanup();
      handler(reaction.emoji.name);
    });

    collector.on('end', () => {});
    reactionFilters.push(() => collector.stop());
  };

  const showAppMenu = async () => {
    state.stage = 'app';
    state.app = null;
    state.type = null;
    state.details = '';
    state.stateStr = '';
    await sendMenu(buildAppMenu(), ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '✖️']);
    listen(['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '✖️'], async (emoji) => {
      if (emoji === '✖️') {
        await state.menuMsg.edit(menuBox('rpc', 'cancelled')).catch(() => {});
        return cleanup();
      }
      const numMap = { '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5, '6️⃣': 6 };
      const app = APPS[numMap[emoji]];
      if (!app) return;
      state.app = app;
      await showTypeMenu();
    });
  };

  const showTypeMenu = async () => {
    state.stage = 'type';
    await sendMenu(buildTypeMenu(state.app), ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '↩️', '✖️']);
    listen(['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '↩️', '✖️'], async (emoji) => {
      if (emoji === '↩️') return showAppMenu();
      if (emoji === '✖️') {
        await state.menuMsg.edit(menuBox('rpc', 'cancelled')).catch(() => {});
        return cleanup();
      }
      const numMap = { '1️⃣': 1, '2️⃣': 2, '3️⃣': 3, '4️⃣': 4, '5️⃣': 5 };
      const type = TYPES[numMap[emoji]];
      if (!type) return;
      state.type = type;
      await promptDetails();
    });
  };

  const promptDetails = async () => {
    state.stage = 'details';
    await cleanup();
    await state.menuMsg.edit(menuBox('rpc · details', [
      `app       ${state.app.name}`,
      `type      ${state.type}`,
      '',
      'reply to this message with your details line',
      'send "skip" to leave empty',
      'send "cancel" to abort'
    ])).catch(() => {});

    const msgFilter = (m) => m.author.id === client.user.id && m.channel.id === message.channel.id;
    const dm = message.channel.createMessageCollector({ filter: msgFilter, max: 1, time: 60000 });

    dm.on('collect', async (m) => {
      const text = m.content.trim();
      await m.delete().catch(() => {});
      if (text.toLowerCase() === 'cancel') {
        await state.menuMsg.edit(menuBox('rpc', 'cancelled')).catch(() => {});
        return cleanup();
      }
      if (text.toLowerCase() !== 'skip') state.details = text;
      await promptState();
    });

    dm.on('end', (collected) => {
      if (collected.size === 0) {
        state.menuMsg.edit(menuBox('rpc', 'timed out')).catch(() => {});
      }
    });

    reactionFilters.push(() => dm.stop());
  };

  const promptState = async () => {
    state.stage = 'state';
    await cleanup();
    await state.menuMsg.edit(menuBox('rpc · state', [
      `app       ${state.app.name}`,
      `type      ${state.type}`,
      `details   ${state.details || '—'}`,
      '',
      'reply with the state line',
      'send "skip" to leave empty'
    ])).catch(() => {});

    const msgFilter = (m) => m.author.id === client.user.id && m.channel.id === message.channel.id;
    const dm = message.channel.createMessageCollector({ filter: msgFilter, max: 1, time: 60000 });

    dm.on('collect', async (m) => {
      const text = m.content.trim();
      await m.delete().catch(() => {});
      if (text.toLowerCase() === 'cancel') {
        await state.menuMsg.edit(menuBox('rpc', 'cancelled')).catch(() => {});
        return cleanup();
      }
      if (text.toLowerCase() !== 'skip') state.stateStr = text;
      await showConfirm();
    });

    reactionFilters.push(() => dm.stop());
  };

  const showConfirm = async () => {
    state.stage = 'confirm';
    await sendMenu(buildConfirmMenu(state.app, state.type, state.details, state.stateStr), ['✅', '↩️', '✖️']);
    listen(['✅', '↩️', '✖️'], async (emoji) => {
      if (emoji === '↩️') return showTypeMenu();
      if (emoji === '✖️') {
        await state.menuMsg.edit(menuBox('rpc', 'cancelled')).catch(() => {});
        return cleanup();
      }
      if (emoji === '✅') {
        try {
          await applyRPC(client, config, state.app, state.type, state.details, state.stateStr);
          saveConfig();
          updateRPC(client.user.id);
          await state.menuMsg.edit(menuBox('rpc · applied', [
            `app       ${state.app.name}`,
            `type      ${state.type}`,
            `details   ${state.details || '—'}`,
            `state     ${state.stateStr || '—'}`
          ])).catch(() => {});
        } catch (e) {
          await state.menuMsg.edit(menuBox('rpc · error', e.message)).catch(() => {});
        }
        cleanup();
      }
    });
  };

  showAppMenu();
}

async function clearRPC(client, message, config, saveConfig, updateRPC) {
  config.enabled = false;
  config.name = '';
  config.type = 'PLAYING';
  config.details = '';
  config.state = '';
  config.largeImage = '';
  config.largeText = '';
  config.smallImage = '';
  config.smallText = '';
  config.appId = '';
  config.startTimestamp = null;
  config.stackedCards = [];
  config.dynamicEnabled = false;
  config.gameSpoofing = false;
  config.selectedGame = 'none';
  config.customGuiApplied = false;
  saveConfig();

  const shard = client.ws.shards.first();
  if (shard) shard.send({ op: 3, d: { status: config.status || 'online', activities: [], afk: false, since: 0 } });

  await message.reply(menuBox('rpc', [
    'cleared',
    '',
    'all activities wiped',
    'custom status kept'
  ]));
}

module.exports = { APPS, TYPES, startGui, clearRPC, applyRPC, menuBox };
