const { CLAIM_SKIP_IDS } = require('./config');

async function claimAll(client, accountId) {
  let claimed = 0;
  let data;
  try { data = await client.fetchQuests(); } catch (e) { return 0; }

  for (const q of data.quests || []) {
    if (CLAIM_SKIP_IDS.has(q.id)) continue;
    const st = q.user_status;
    if (!st || !st.completed_at || st.claimed_at) continue;
    try {
      await client.post('/quests/' + q.id + '/claim-reward', {});
      claimed++;
    } catch (e) {}
  }
  return claimed;
}

module.exports = { claimAll };
