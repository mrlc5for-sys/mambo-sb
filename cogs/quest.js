const fs = require('fs');
const path = require('path');
const { codeblock, menu, kv } = require('../helpers/render');
const { QuestClient, getQuests, filterValid, runQuest, runAll, claimAll, requestStop, clearStop, isStopped, stoppedAccounts } = require('../quests');

const ROOT = path.resolve(__dirname, '..');
const DATA = path.join(ROOT, 'data');
const QUEST_LOG = path.join(DATA, 'quest-log.json');

const activeRuns = new Map();
const questLog = [];

function ensure() { try { fs.mkdirSync(DATA, { recursive: true }); } catch (e) {} }

function pushLog(entry) {
  questLog.unshift({ ...entry, at: Date.now() });
  if (questLog.length > 500) questLog.length = 500;
  try { fs.writeFileSync(QUEST_LOG, JSON.stringify(questLog.slice(0, 200), null, 2)); } catch (e) {}
}

function loadLog() {
  try { return fs.existsSync(QUEST_LOG) ? JSON.parse(fs.readFileSync(QUEST_LOG, 'utf8')) : []; }
  catch (e) { return []; }
}

function fmtStatus(status) {
  const map = { idle: '○', scanning: '◐', running: '●', done: '✓', fail: '✗', error: '!' };
  return map[status] || '·';
}

function register(client) {
  ensure();

  client.registerCommand('quest', async (c, m) => {
    await m.edit(codeblock('quest · auto-completer', [
      'list                   list available quests',
      'run                    run all eligible quests',
      'run <id>               run a single quest',
      'stop                   stop current run',
      'claim                  claim all completed rewards',
      'log [n]                recent activity',
      'clearlog               clear log',
      'status                 current state'
    ].join('\n')));
  }, { aliases: ['quests', 'q'], category: 'quest', description: 'quest auto-completer', sticky: true });

  client.registerCommand('quest-list', async (c, m) => {
    const token = c.token || c.tokenStr;
    const qc = new QuestClient(token, c._proxy ? c._proxy.url : null);
    await m.edit(codeblock('quest', 'scanning...'));
    try {
      const raw = await getQuests(qc);
      const valid = filterValid(raw);
      if (!valid.length) return m.edit(codeblock('quest · list', 'no available quests'));
      const lines = valid.map((q, i) => {
        const name = (q.config && q.config.messages && q.config.messages.quest_name) || q.id;
        const tc = (q.config && (q.config.task_config || q.config.task_config_v2)) || {};
        const taskName = Object.keys(tc.tasks || {})[0] || 'unknown';
        const target = (tc.tasks && tc.tasks[taskName] && tc.tasks[taskName].target) || 0;
        const prog = q.user_status && q.user_status.progress && q.user_status.progress[taskName] ? q.user_status.progress[taskName].value : 0;
        return '#' + (i + 1) + ' ' + name.slice(0, 40) + '\n   ' + taskName + ' · ' + (prog || 0) + '/' + target + ' · ' + q.id;
      });
      await m.edit(codeblock('quest · ' + valid.length + ' available', lines.join('\n\n')));
    } catch (e) {
      await m.edit(codeblock('quest · error', e.message));
    }
  }, { aliases: ['ql'], category: 'quest', description: 'list available quests', sticky: true });

  client.registerCommand('quest-run', async (c, m, args) => {
    const token = c.token || c.tokenStr;
    const accountId = c.dashUser || c.uid;
    if (activeRuns.has(accountId)) return m.edit(codeblock('quest', 'already running'));

    const questId = args[0];
    const qc = new QuestClient(token, c._proxy ? c._proxy.url : null);
    activeRuns.set(accountId, { startedAt: Date.now(), mode: questId ? 'single' : 'all' });

    await m.edit(codeblock('quest', questId ? 'running single quest...' : 'running all quests...'));

    const onProgress = (ev) => {
      if (ev.type === 'start') pushLog({ accountId, questId: ev.questId, name: ev.name, status: 'start' });
      if (ev.type === 'done') pushLog({ accountId, questId: ev.questId, name: ev.name, status: 'done' });
      if (ev.type === 'fail') pushLog({ accountId, questId: ev.questId, name: ev.name, status: 'fail', reason: ev.reason });
      if (ev.type === 'stopped') pushLog({ accountId, questId: ev.questId, name: ev.name, status: 'stopped' });
    };

    try {
      let result;
      if (questId) {
        const raw = await getQuests(qc);
        const quest = raw.find(q => q.id === questId);
        if (!quest) {
          activeRuns.delete(accountId);
          return m.edit(codeblock('quest', 'quest not found'));
        }
        result = await runQuest(qc, quest, accountId, onProgress);
      } else {
        result = await runAll(qc, accountId, onProgress);
      }
      activeRuns.delete(accountId);
      const body = [
        ['mode', questId ? 'single' : 'all'],
        ['completed', result.completed || (result.ok ? 1 : 0)],
        ['failed', result.failed || (result.ok ? 0 : 1)],
        ['reason', result.reason || 'ok']
      ];
      await m.edit(codeblock('quest · done', kv(body)));
    } catch (e) {
      activeRuns.delete(accountId);
      await m.edit(codeblock('quest · error', e.message));
    }
  }, { aliases: ['qr'], category: 'quest', description: 'run quests', usage: '[quest_id]', sticky: true });

  client.registerCommand('quest-stop', async (c, m) => {
    const accountId = c.dashUser || c.uid;
    requestStop(accountId);
    activeRuns.delete(accountId);
    await m.edit(codeblock('quest', 'stop signal sent'));
  }, { aliases: ['qs'], category: 'quest', description: 'stop current run' });

  client.registerCommand('quest-claim', async (c, m) => {
    const token = c.token || c.tokenStr;
    const accountId = c.dashUser || c.uid;
    const qc = new QuestClient(token, c._proxy ? c._proxy.url : null);
    await m.edit(codeblock('quest', 'claiming...'));
    try {
      const n = await claimAll(qc, accountId);
      await m.edit(codeblock('quest · claim', kv([['claimed', n]])));
    } catch (e) {
      await m.edit(codeblock('quest · error', e.message));
    }
  }, { aliases: ['qc'], category: 'quest', description: 'claim all rewards' });

  client.registerCommand('quest-log', async (c, m, args) => {
    const n = Math.min(parseInt(args[0], 10) || 20, 100);
    const list = loadLog();
    if (!list.length) return m.edit(codeblock('quest · log', 'no history'));
    const body = list.slice(0, n).map(e => {
      const time = new Date(e.at).toISOString().slice(11, 19);
      const icon = e.status === 'done' ? '✓' : e.status === 'fail' ? '✗' : e.status === 'stopped' ? '⏹' : '●';
      return icon + ' ' + time + ' ' + (e.name || e.questId || '').slice(0, 40);
    });
    await m.edit(codeblock('quest · log', body.join('\n')));
  }, { category: 'quest', description: 'recent activity', sticky: true });

  client.registerCommand('quest-clearlog', async (c, m) => {
    questLog.length = 0;
    try { fs.writeFileSync(QUEST_LOG, '[]'); } catch (e) {}
    await m.edit(codeblock('quest', 'log cleared'));
  }, { category: 'quest', description: 'clear quest log' });

  client.registerCommand('quest-status', async (c, m) => {
    const accountId = c.dashUser || c.uid;
    const run = activeRuns.get(accountId);
    const body = [
      ['status', run ? 'running (' + run.mode + ')' : 'idle'],
      ['started', run ? new Date(run.startedAt).toISOString().slice(11, 19) : '—'],
      ['stopped', isStopped(accountId) ? 'yes' : 'no']
    ];
    await m.edit(codeblock('quest · status', kv(body)));
  }, { category: 'quest', description: 'current state' });
}

module.exports = { register };
