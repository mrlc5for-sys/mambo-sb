const { MAX_TASK_ATTEMPTS } = require('./config');
const { enroll } = require('./enroll');
const { runVideo } = require('./video');
const { runDesktop } = require('./desktop');
const { runStream } = require('./stream');
const { runActivity } = require('./activity');
const { claimAll } = require('./claim');
const { QuestClient } = require('./client');

const RUNNERS = {
  WATCH_VIDEO: runVideo,
  WATCH_VIDEO_ON_MOBILE: runVideo,
  PLAY_ON_DESKTOP: runDesktop,
  STREAM_ON_DESKTOP: runStream,
  PLAY_ACTIVITY: runActivity
};

const attempts = new Map();
const stopFlags = new Set();

function requestStop(accountId) { stopFlags.add(accountId); }
function clearStop(accountId) { stopFlags.delete(accountId); }
function isStopped(accountId) { return stopFlags.has(accountId); }
function stoppedAccounts() { return [...stopFlags]; }

async function runQuest(client, quest, accountId, onProgress) {
  const name = (quest.config && quest.config.messages && quest.config.messages.quest_name) || quest.id;
  const tc = (quest.config && (quest.config.task_config || quest.config.task_config_v2)) || {};
  const tasks = tc.tasks || {};
  const taskName = Object.keys(tasks).find(k => k in RUNNERS);

  if (!taskName) return { ok: false, reason: 'unsupported' };

  const fails = attempts.get(accountId + ':' + quest.id) || 0;
  if (fails >= MAX_TASK_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (stopFlags.has(accountId)) return { ok: false, reason: 'stopped' };

  if (!quest.user_status || !quest.user_status.enrolled_at) {
    const enrolled = await enroll(client, quest, accountId);
    if (!enrolled) return { ok: false, reason: 'enroll_failed' };
    try {
      const fresh = await client.fetchQuests();
      const up = (fresh.quests || []).find(q => q.id === quest.id);
      if (up) quest = up;
    } catch (e) {}
  }

  const target = Number((tasks[taskName] && tasks[taskName].target) || 0);
  if (onProgress) onProgress({ type: 'start', questId: quest.id, name, taskName, target });

  const shouldStop = () => stopFlags.has(accountId);
  let last = 0;
  const onTick = (cur, tar) => {
    if (shouldStop()) throw new Error('__STOPPED__');
    const now = Date.now();
    if (now - last > 1500) {
      last = now;
      if (onProgress) onProgress({ type: 'progress', questId: quest.id, name, cur, tar });
    }
  };

  const runner = RUNNERS[taskName];
  try {
    const ok = await runner(client, quest, tasks[taskName], taskName, onTick, shouldStop);
    if (ok) {
      attempts.delete(accountId + ':' + quest.id);
      if (onProgress) onProgress({ type: 'done', questId: quest.id, name });
      await claimAll(client, accountId);
      return { ok: true, taskType: taskName };
    }
    attempts.set(accountId + ':' + quest.id, fails + 1);
    if (onProgress) onProgress({ type: 'fail', questId: quest.id, name, reason: 'task_failed' });
    return { ok: false, reason: 'task_failed' };
  } catch (err) {
    if (err.message === '__STOPPED__') {
      if (onProgress) onProgress({ type: 'stopped', questId: quest.id, name });
      return { ok: false, reason: 'stopped' };
    }
    attempts.set(accountId + ':' + quest.id, fails + 1);
    if (onProgress) onProgress({ type: 'fail', questId: quest.id, name, reason: err.message });
    return { ok: false, reason: err.message };
  } finally {
    stopFlags.delete(accountId);
  }
}

async function getQuests(client) {
  const data = await client.fetchQuests();
  return (data && data.quests) || [];
}

function filterValid(quests) {
  const now = Date.now();
  return quests.filter(q => {
    const exp = new Date((q.config && q.config.expires_at) || 0).getTime();
    if (exp <= now) return false;
    if (q.user_status && q.user_status.completed_at) return false;
    const tc = (q.config && (q.config.task_config || q.config.task_config_v2)) || {};
    const tasks = tc.tasks || {};
    return Object.keys(tasks).some(k => k in RUNNERS);
  });
}

async function runAll(client, accountId, onProgress) {
  const raw = await getQuests(client);
  const quests = filterValid(raw);
  let completed = 0;
  let failed = 0;
  for (const quest of quests) {
    if (stopFlags.has(accountId)) break;
    const res = await runQuest(client, quest, accountId, onProgress);
    if (res.ok) completed++;
    else failed++;
  }
  return { completed, failed, total: quests.length };
}

module.exports = {
  QuestClient,
  claimAll,
  runQuest,
  runAll,
  getQuests,
  filterValid,
  requestStop,
  clearStop,
  isStopped,
  stoppedAccounts
};
