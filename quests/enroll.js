const { ENROLL_LOCATIONS } = require('./config');

const cache = new Map();

async function enroll(client, quest, accountId) {
  const name = (quest.config && quest.config.messages && quest.config.messages.quest_name) || quest.id;
  const cached = cache.get(accountId);
  const order = cached
    ? [cached].concat(ENROLL_LOCATIONS.filter(l => l !== cached))
    : ENROLL_LOCATIONS.slice();

  for (const loc of order) {
    try {
      await client.post('/quests/' + quest.id + '/enroll', {
        location: loc, is_targeted: false, metadata_raw: null
      });
      cache.set(accountId, loc);
      return true;
    } catch (e) {}
  }
  return false;
}

module.exports = { enroll };
