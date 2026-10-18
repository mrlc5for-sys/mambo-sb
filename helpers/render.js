function codeblock(title, content) {
  const body = String(content).split('\n').map(l => `> ${l}`).join('\n');
  return `> \`\`\`ini\n> [ ${title} ]\n> \`\`\`\n> \`\`\`\n${body}\n> \`\`\``;
}

function menu(title, lines) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const body = arr.map(l => `> ${l}`).join('\n');
  return `> \`\`\`ini\n> [ ${title} ]\n> \`\`\`\n> \`\`\`\n${body}\n> \`\`\``;
}

function kv(rows) {
  if (!rows.length) return '';
  const max = Math.max(...rows.map(r => String(r[0]).length));
  return rows.map(r => `${String(r[0]).padEnd(max)}  ${r[1]}`).join('\n');
}

module.exports = { codeblock, menu, kv };
