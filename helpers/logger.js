const eventBus = require('./eventBus');

const C = { info: '\x1b[36m', ok: '\x1b[32m', warn: '\x1b[33m', err: '\x1b[31m', reset: '\x1b[0m' };

function log(level, msg) {
  const time = new Date().toISOString().slice(11, 19);
  const color = C[level] || C.reset;
  console.log(`${color}[${time}] [${level.toUpperCase()}] ${msg}${C.reset}`);
  eventBus.emit('console.log', { time, level, msg });
}

module.exports = {
  info: (msg) => log('info', msg),
  ok: (msg) => log('ok', msg),
  warn: (msg) => log('warn', msg),
  error: (msg) => log('err', msg),
  cmd: (msg) => log('ok', `CMD: ${msg}`)
};
