#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const targets = [path.join(root, 'README.md'), path.join(root, 'docs')];

const mdFiles = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      mdFiles.push(full);
    }
  }
}

for (const target of targets) {
  if (!fs.existsSync(target)) continue;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) walk(target);
  else if (stat.isFile()) mdFiles.push(target);
}

const linkRegex = /!?\[[^\]]*\]\(([^)]+)\)/g;
const missing = [];
let checked = 0;

for (const file of mdFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(linkRegex)) {
    let raw = (match[1] || '').trim();
    if (!raw) continue;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('mailto:') || raw.startsWith('#')) continue;

    if (raw.startsWith('<') && raw.endsWith('>')) raw = raw.slice(1, -1);
    raw = raw.split('#')[0].trim();
    if (!raw) continue;

    const candidate = path.isAbsolute(raw)
      ? path.join(root, raw.replace(/^\/+/, ''))
      : path.resolve(path.dirname(file), raw);

    checked += 1;
    if (!fs.existsSync(candidate)) {
      missing.push({
        file: path.relative(root, file).replaceAll('\\\\', '/'),
        link: match[1],
        resolved: path.relative(root, candidate).replaceAll('\\\\', '/'),
      });
    }
  }
}

if (missing.length > 0) {
  console.error(`❌ Doc link check failed: ${missing.length} broken links`);
  for (const item of missing) {
    console.error(`- ${item.file}: (${item.link}) -> ${item.resolved}`);
  }
  process.exit(1);
}

console.log(`✅ Doc link check passed: ${checked} local links across ${mdFiles.length} markdown files`);
