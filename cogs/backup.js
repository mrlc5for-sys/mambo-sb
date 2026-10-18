const fs = require('fs');
const path = require('path');
const { AttachmentBuilder } = require('discord.js-selfbot-v13');
const { codeblock, kv } = require('../helpers/render');
const { requireOwner } = require('../helpers/permissions');

const ROOT = path.resolve(__dirname, '..');
const BACKUP_DIR = path.join(ROOT, 'data', 'backups');

function ensure() { try { fs.mkdirSync(BACKUP_DIR, { recursive: true }); } catch (e) {} }

function writeBackup(name, data) {
  ensure();
  const f = path.join(BACKUP_DIR, name + '.json');
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
  return f;
}

function readBackup(name) {
  const f = path.join(BACKUP_DIR, name + '.json');
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { return null; }
}

function listBackups() {
  ensure();
  return fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
}

function register(client) {
  ensure();

  client.registerCommand('backup', async (c, m) => {
    await m.edit(codeblock('backup', [
      'account                save account info',
      'friends                save friend list',
      'guilds                 save guild list',
      'dms                    save dm partners',
      'view <name>            show backup',
      'list                   list backups',
      'delete <name>          remove backup',
      'export <n>             export channel messages',
      '',
      'backups   ' + listBackups().length
    ].join('\n')));
  }, { category: 'backup', description: 'backup menu', sticky: true });

  client.registerCommand('backup-account', async (c, m) => {
    const u = c.user;
    const data = {
      type: 'account', created: Date.now(),
      info: {
        id: u.id, username: u.username, tag: u.tag,
        displayName: u.globalName || null, avatar: u.avatar || null,
        banner: u.banner || null, bio: u.bio || null
      }
    };
    const f = writeBackup('account', data);
    await m.edit(codeblock('backup · account', kv([['saved', u.tag], ['path', f]])));
  }, { aliases: ['backupaccount'], category: 'backup', description: 'save account' });

  client.registerCommand('backup-friends', async (c, m) => {
    const list = [];
    if (c.relationships) {
      for (const rel of c.relationships.cache.values()) {
        if (rel.type === 1) {
          list.push({
            id: rel.user.id, username: rel.user.username,
            tag: rel.user.tag || rel.user.username,
            added: rel.since ? rel.since.getTime() : null
          });
        }
      }
    }
    const data = { type: 'friends', created: Date.now(), list };
    const f = writeBackup('friends', data);
    await m.edit(codeblock('backup · friends', kv([['saved', list.length + ' friends'], ['path', f]])));
  }, { aliases: ['backupfriends'], category: 'backup', description: 'save friends' });

  client.registerCommand('backup-guilds', async (c, m) => {
    const list = [];
    for (const guild of c.guilds.cache.values()) {
      let invite = null;
      if (guild.vanityURLCode) {
        invite = 'discord.gg/' + guild.vanityURLCode;
      } else {
        const ch = guild.channels.cache.find(x => x.type === 'GUILD_TEXT' && x.permissionsFor(c.user) && x.permissionsFor(c.user).has('CREATE_INSTANT_INVITE'));
        if (ch) {
          try {
            const inv = await ch.createInvite({ maxAge: 0, maxUses: 0, unique: false });
            invite = inv.url;
          } catch (e) {}
        }
      }
      list.push({ id: guild.id, name: guild.name, members: guild.memberCount, invite, owner: guild.ownerId });
    }
    const data = { type: 'guilds', created: Date.now(), list };
    const f = writeBackup('guilds', data);
    await m.edit(codeblock('backup · guilds', kv([['saved', list.length + ' guilds'], ['path', f]])));
  }, { aliases: ['backupguilds'], category: 'backup', description: 'save guilds' });

  client.registerCommand('backup-dms', async (c, m) => {
    const list = [];
    for (const ch of c.channels.cache.values()) {
      if (ch.type !== 'DM') continue;
      const partner = ch.recipient;
      if (!partner) continue;
      list.push({ id: partner.id, tag: partner.tag || partner.username, username: partner.username });
    }
    const data = { type: 'dms', created: Date.now(), list };
    const f = writeBackup('dms', data);
    await m.edit(codeblock('backup · dms', kv([['saved', list.length + ' partners'], ['path', f]])));
  }, { aliases: ['backupdms'], category: 'backup', description: 'save dm partners' });

  client.registerCommand('backup-view', async (c, m, args) => {
    const name = args[0];
    if (!name) return m.edit(codeblock('backup-view', 'usage: backup view <name>'));
    const data = readBackup(name);
    if (!data) return m.edit(codeblock('backup-view', 'not found'));
    const text = JSON.stringify(data, null, 2);
    if (text.length > 1800) {
      const file = path.join(BACKUP_DIR, name + '.json');
      await m.channel.send({ files: [new AttachmentBuilder(file)] });
      await m.delete().catch(() => {});
      return;
    }
    await m.edit('> ```json\n> ' + text.split('\n').join('\n> ') + '\n> ```');
  }, { aliases: ['backupview'], category: 'backup', description: 'view backup' });

  client.registerCommand('backup-list', async (c, m) => {
    const list = listBackups();
    if (!list.length) return m.edit(codeblock('backup · list', 'no backups'));
    const body = list.map((n, i) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, n + '.json'));
      return (i + 1) + '. ' + n.padEnd(15) + '  ' + new Date(stat.mtime).toISOString().slice(0, 19);
    });
    await m.edit(codeblock('backup · list', body.join('\n')));
  }, { aliases: ['backuplist'], category: 'backup', description: 'list backups' });

  client.registerCommand('backup-delete', async (c, m, args) => {
    if (!(await requireOwner(c, m))) return;
    const name = args[0];
    if (!name) return m.edit(codeblock('backup-delete', 'usage: backup delete <name>'));
    const f = path.join(BACKUP_DIR, name + '.json');
    if (!fs.existsSync(f)) return m.edit(codeblock('backup-delete', 'not found'));
    fs.unlinkSync(f);
    await m.edit(codeblock('backup · delete', kv([['removed', name]])));
  }, { aliases: ['backupdelete'], category: 'backup', description: 'delete backup' });

  client.registerCommand('export', async (c, m, args) => {
    const n = Math.min(Math.max(parseInt(args[0], 10) || 100, 1), 1000);
    const cid = args[1];
    const channel = cid ? c.channels.cache.get(cid) : m.channel;
    if (!channel) return m.edit(codeblock('export', 'channel not found'));
    try {
      const msgs = await channel.messages.fetch({ limit: n });
      const lines = [...msgs.values()].reverse().map(msg => {
        const ts = new Date(msg.createdTimestamp).toISOString().slice(0, 19);
        const author = msg.author ? msg.author.tag : 'unknown';
        const body = (msg.content || '').replace(/\n/g, ' ');
        const attach = msg.attachments && msg.attachments.size ? ' [' + [...msg.attachments.values()].map(a => a.url).join(', ') + ']' : '';
        return ts + ' | ' + author + ' | ' + body + attach;
      });
      ensure();
      const out = path.join(BACKUP_DIR, 'channel-' + channel.id + '-' + Date.now() + '.txt');
      fs.writeFileSync(out, lines.join('\n'));
      await m.channel.send({ files: [new AttachmentBuilder(out)] });
      await m.delete().catch(() => {});
    } catch (e) { await m.edit(codeblock('export · error', e.message)); }
  }, { category: 'backup', description: 'export channel messages' });
}

module.exports = { register };
