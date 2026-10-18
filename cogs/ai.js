const axios = require('axios');
const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

const histories = new Map();

function getKey(c) {
  return (c.cfg.ai && c.cfg.ai.groq_key) || process.env.GROQ_API_KEY || '';
}

function getModel(c) {
  return (c.cfg.ai && c.cfg.ai.model) || 'llama3-8b-8192';
}

function getCap(c) {
  return (c.cfg.ai && c.cfg.ai.history_cap) || 20;
}

function getSystem(c) {
  if (c.cfg.ai && c.cfg.ai.personality) return c.cfg.ai.personality;
  return 'You are Soul, a helpful Discord assistant. Keep responses under 10 words when possible. Be direct and useful.';
}

async function chat(opts) {
  const key = opts.key || process.env.GROQ_API_KEY;
  if (!key) throw new Error('groq key missing');
  const r = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
    model: opts.model || 'llama3-8b-8192',
    messages: opts.messages,
    temperature: opts.temperature === undefined ? 0.7 : opts.temperature,
    max_tokens: opts.maxTokens || 300
  }, {
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    timeout: opts.timeout || 20000
  });
  return (r.data && r.data.choices && r.data.choices[0] && r.data.choices[0].message && r.data.choices[0].message.content) || '';
}

function getHistory(key, cap) {
  if (!histories.has(key)) histories.set(key, []);
  const h = histories.get(key);
  if (h.length > cap) h.splice(0, h.length - cap);
  return h;
}

function register(client) {
  client.registerCommand('ai', async (c, m) => {
    await m.edit(codeblock('ai', [
      'ask <question>          single query',
      'chat <message>          multi-turn history',
      'clearchat               clear your history',
      'personality <text>      set system prompt',
      'personality show        show current',
      'personality reset       restore default',
      'translate <lang> <text> translate text',
      '',
      'key      ' + (getKey(c) ? 'set' : 'missing'),
      'model    ' + getModel(c),
      'history  ' + getCap(c) + ' messages'
    ].join('\n')));
  }, { aliases: ['llm'], category: 'ai', description: 'ai menu', sticky: true });

  client.registerCommand('ask', async (c, m, args) => {
    const key = getKey(c);
    if (!key) return m.edit(codeblock('ask', 'groq key missing'));
    const question = args.join(' ').trim();
    if (!question) return m.edit(codeblock('ask', 'usage: ask <question>'));
    try {
      const messages = [{ role: 'system', content: getSystem(c) }, { role: 'user', content: question }];
      const out = await chat({ key, model: getModel(c), messages, maxTokens: 300 });
      await m.edit(codeblock('ai', out.slice(0, 1500)));
    } catch (e) { await m.edit(codeblock('ai', 'error: ' + e.message)); }
  }, { category: 'ai', description: 'single ai query', usage: '<question>' });

  client.registerCommand('chat', async (c, m, args) => {
    const key = getKey(c);
    if (!key) return m.edit(codeblock('chat', 'groq key missing'));
    const message = args.join(' ').trim();
    if (!message) return m.edit(codeblock('chat', 'usage: chat <message>'));
    try {
      const keyId = c.uid + ':chat:' + m.channel.id;
      const history = getHistory(keyId, getCap(c));
      const messages = [{ role: 'system', content: getSystem(c) }, ...history, { role: 'user', content: message }];
      const out = await chat({ key, model: getModel(c), messages, maxTokens: 300 });
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: out });
      await m.edit(codeblock('chat', out.slice(0, 1500)));
    } catch (e) { await m.edit(codeblock('chat', 'error: ' + e.message)); }
  }, { category: 'ai', description: 'multi-turn chat', usage: '<message>' });

  client.registerCommand('clearchat', async (c, m) => {
    histories.delete(c.uid + ':chat:' + m.channel.id);
    histories.delete(c.uid + ':ask');
    await m.edit(codeblock('ai', 'history cleared'));
  }, { category: 'ai', description: 'clear chat history' });

  client.registerCommand('personality', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    if (!c.cfg.ai) c.cfg.ai = {};
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'show') return m.edit(codeblock('personality', getSystem(c)));
    if (sub === 'reset') {
      delete c.cfg.ai.personality;
      const fs = require('fs');
      const path = require('path');
      fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
      return m.edit(codeblock('personality', 'reset to default'));
    }
    const text = args.join(' ').trim();
    if (!text) return m.edit(codeblock('personality', 'set <text> | show | reset'));
    c.cfg.ai.personality = text;
    const fs = require('fs');
    const path = require('path');
    fs.writeFileSync(path.join(__dirname, '..', 'config.json'), JSON.stringify(c.cfg, null, 2));
    await m.edit(codeblock('personality', 'updated'));
  }, { category: 'ai', description: 'set system prompt', gate: 'owner' });

  client.registerCommand('translate', async (c, m, args) => {
    const key = getKey(c);
    if (!key) return m.edit(codeblock('translate', 'groq key missing'));
    const to = args[0];
    const text = args.slice(1).join(' ');
    if (!to || !text) return m.edit(codeblock('translate', 'usage: translate <lang> <text>'));
    try {
      const messages = [
        { role: 'system', content: 'You translate text between languages. Keep tone, slang, and intent. Return only the translation.' },
        { role: 'user', content: 'Translate to ' + to + ': ' + text }
      ];
      const out = await chat({ key, model: getModel(c), messages, temperature: 0.3, maxTokens: 150 });
      await m.edit(codeblock('translate · ' + to, out));
    } catch (e) { await m.edit(codeblock('translate', 'error: ' + e.message)); }
  }, { category: 'ai', description: 'translate text', usage: '<lang> <text>' });
}

module.exports = { register };
