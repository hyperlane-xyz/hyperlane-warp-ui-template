#!/usr/bin/env node
// stack-check.mjs: the Gully stack check (gully-ops stack/stack-check, 2026-11-25). Vendored BYTE-IDENTICAL into every repo at
// .stack/stack-check.mjs next to .stack/snapshot.json (the pinned registry snapshot, generated in gully-ops) and .stack/checks.json
// (what this repo promises). Zero dependencies, Node 18+. Fails (exit 1) when the repo's chains, kit copies, versions or hosts
// differ from the registry, or when this file is not the one the snapshot was built with.
//   node .stack/stack-check.mjs [--root <repo root>] [--json]
// checks.json: { "repo": "<registry repo id>", "product": "<registry product id>", "checks": [ ... ] }, each check one of:
//   { "type": "kit", "kit": "<id>", "dir": "<path>" }                       every file in dir named like a kit file == the kit's blob
//   { "type": "kit-file", "kit": "<id>", "file": "<path>" }                 file sha384 == the kit's integrity (SDK copies)
//   { "type": "chains", "file": "<json>", "select": "a.b[]", "id": "<key>", "where": {"<key>": ["v1",..]}, "expect": "<rule>" }
//        expect: "product" (this product's chains with status in `statuses`, default live|beta|testnet), "rule:<name>" (snapshot.rules)
//   { "type": "value", "file": "<path>", "regex": "<re with one group>" | "json": "a.b", "equals": "<snapshot path>" | "kit:<id>.version" }
//   { "type": "addresses", "file": "<json>", "chain": "<id>", "select": "contracts", "complete": true }  every name -> address
//        in the file equals the registry address book for that chain (records in gully-ops); complete = no contract missing either
//   { "type": "hosts", "file": "<path>", "domains": ["gullycore.xyz", ...] }  every https host of those domains is a registry host
// Exceptions live in the registry (kits.json `accept`, with an expiry date), never in this file or in checks.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };

export function blobSha(buf) {
  const isText = !buf.subarray(0, 8000).includes(0);
  const b = isText ? Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8') : buf;
  return crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
}
const dig = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function select(o, p) {
  let cur = [o];
  for (const part of p.split('.')) {
    const arr = part.endsWith('[]');
    const k = arr ? part.slice(0, -2) : part;
    cur = cur.flatMap((x) => { const v = k ? x?.[k] : x; return arr ? (Array.isArray(v) ? v : []) : (v === undefined ? [] : [v]); });
  }
  return cur;
}
const lf = (b) => Buffer.from(b.toString('utf8').split('\r\n').join('\n'), 'utf8');
const today = (now) => now.toISOString().slice(0, 10);

export function run({ root, snapshot, checks, selfBytes, now = new Date() }) {
  const out = [];
  const pass = (m) => out.push({ level: 'pass', m });
  const fail = (m) => out.push({ level: 'fail', m });
  const warn = (m) => out.push({ level: 'warn', m });
  const want = snapshot.stackCheck?.sha256;
  const got = crypto.createHash('sha256').update(lf(selfBytes)).digest('hex');
  if (want && want !== got) fail(`stack-check.mjs differs from the snapshot's (${got.slice(0, 12)} vs ${want.slice(0, 12)}): re-vendor both from gully-ops`);
  const product = snapshot.products.find((p) => p.id === checks.product);
  if (checks.product && !product) fail(`product ${checks.product} is not in the registry`);
  const kitOf = (id) => snapshot.kits.find((k) => k.id === id);
  const consumerOf = (kit, where) => kit.consumers.find((c) => c.repo === checks.repo && (c.dir === where || c.file === where));
  const accepted = (c, blob, label) => {
    const a = c?.accept;
    if (!a) return false;
    if (a.until < today(now)) { fail(`${label}: the registry's exception expired on ${a.until} (${a.reason})`); return true; }
    if (a.blob && a.blob !== blob) return false;
    warn(`${label}: known drift accepted until ${a.until} (${a.reason})`);
    return true;
  };
  const file = (p) => path.join(root, p);
  for (const c of checks.checks || []) {
    const label = `${c.type} ${c.kit || c.file || c.dir || ''}`.trim();
    try {
      if (c.type === 'kit') {
        const kit = kitOf(c.kit);
        if (!kit) { fail(`${label}: unknown kit`); continue; }
        const cons = consumerOf(kit, c.dir);
        if (!cons) { fail(`${label}: ${checks.repo}:${c.dir} is not listed as a consumer of ${kit.id} in the registry (kits.json)`); continue; }
        const names = fs.readdirSync(file(c.dir)).filter((n) => kit.blobs?.[n]);
        if (!names.length) { fail(`${label}: no ${kit.id} file found in ${c.dir}`); continue; }
        let ok = true;
        for (const n of names) {
          const b = blobSha(fs.readFileSync(file(path.join(c.dir, n))));
          if (b !== kit.blobs[n] && !accepted(cons, b, `${label}/${n}`)) { ok = false; fail(`${label}/${n}: not the ${kit.id} ${kit.version} file (blob ${b.slice(0, 12)}, registry ${kit.blobs[n].slice(0, 12)})`); }
        }
        if (ok) pass(`${label}: ${names.length} file(s) checked against ${kit.id} ${kit.version}`);
      } else if (c.type === 'kit-file') {
        const kit = kitOf(c.kit);
        if (!kit?.integrity) { fail(`${label}: kit has no integrity`); continue; }
        if (!consumerOf(kit, c.file)) { fail(`${label}: not listed as a consumer of ${kit.id} in the registry`); continue; }
        const h = `sha384-${crypto.createHash('sha384').update(fs.readFileSync(file(c.file))).digest('base64')}`;
        if (h === kit.integrity) pass(`${label}: ${kit.id} ${kit.version}`);
        else fail(`${label}: not ${kit.id} ${kit.version} (integrity ${h.slice(0, 20)}...)`);
      } else if (c.type === 'chains') {
        const doc = JSON.parse(fs.readFileSync(file(c.file), 'utf8'));
        let rows = select(doc, c.select);
        for (const [k, vals] of Object.entries(c.where || {})) rows = rows.filter((r) => vals.includes(r?.[k]));
        const have = new Set(rows.map((r) => String(c.id ? r?.[c.id] : r)));
        let exp;
        if (c.expect === 'product') {
          const st = c.statuses || ['live', 'beta', 'testnet'];
          exp = new Set(Object.entries(product?.chains || {}).filter(([, s]) => st.includes(s)).map(([id]) => id));
        } else if (String(c.expect).startsWith('rule:')) exp = new Set((snapshot.rules?.[c.expect.slice(5)] || []).map(String));
        else { fail(`${label}: unknown expect ${c.expect}`); continue; }
        const missing = [...exp].filter((x) => !have.has(x));
        const extra = [...have].filter((x) => !exp.has(x));
        if (!missing.length && !extra.length) pass(`${label} ${c.select}: ${have.size} chain(s) = registry`);
        else fail(`${label} ${c.select}: ${missing.length ? `missing ${missing.join(',')} ` : ''}${extra.length ? `not in registry ${extra.join(',')}` : ''}`.trim());
      } else if (c.type === 'value') {
        const txt = fs.readFileSync(file(c.file), 'utf8');
        const v = c.regex ? (txt.match(new RegExp(c.regex)) || [])[1] : dig(JSON.parse(txt), c.json);
        const [head, ...rest] = String(c.equals).split('.');
        const e = head.startsWith('kit:') ? dig(kitOf(head.slice(4)) || {}, rest.join('.')) : dig(snapshot, c.equals);
        if (v !== undefined && String(v) === String(e)) pass(`${label}: ${v}`);
        else fail(`${label}: ${v === undefined ? 'value not found' : JSON.stringify(v)} != registry ${c.equals} = ${JSON.stringify(e)}`);
      } else if (c.type === 'addresses') {
        const book = snapshot.addressBook?.[c.chain];
        if (!book) { fail(`${label}: no address book for chain ${c.chain}`); continue; }
        const map = dig(JSON.parse(fs.readFileSync(file(c.file), 'utf8')), c.select || 'contracts') || {};
        const addr = (v) => String(typeof v === 'string' ? v : v?.address ?? '');
        const norm = (a) => (/^0x/i.test(a) ? a.toLowerCase() : a);
        const wrong = Object.entries(map).filter(([k, v]) => addr(v) && norm(addr(v)) !== norm(book[k] || '')).map(([k]) => k);
        const missing = c.complete ? Object.keys(book).filter((k) => !(k in map)) : [];
        if (!wrong.length && !missing.length) pass(`${label}: ${Object.keys(map).length} address(es) = registry ${c.chain}`);
        else fail(`${label}: ${wrong.length ? `differs or unknown: ${wrong.slice(0, 8).join(',')} ` : ''}${missing.length ? `missing: ${missing.slice(0, 8).join(',')}` : ''}`.trim());
      } else if (c.type === 'hosts') {
        const txt = fs.readFileSync(file(c.file), 'utf8');
        const known = new Set(snapshot.products.flatMap((p) => p.hosts.map((h) => new URL(h.url).host)));
        const doms = c.domains || [];
        const seen = new Set([...txt.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((m) => m[1]).filter((h) => doms.some((d) => h === d || h.endsWith(`.${d}`))));
        const unknown = [...seen].filter((h) => !known.has(h));
        if (!unknown.length) pass(`${label}: ${seen.size} host(s) known`);
        else fail(`${label}: host(s) not in the registry: ${unknown.join(', ')}`);
      } else fail(`${label}: unknown check type`);
    } catch (e) { fail(`${label}: ${e.message}`); }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  const root = path.resolve(opt('--root', path.resolve(path.dirname(SELF), '..')));
  const dir = path.dirname(SELF);
  const snapshot = JSON.parse(fs.readFileSync(path.join(dir, 'snapshot.json'), 'utf8'));
  const checks = JSON.parse(fs.readFileSync(path.join(dir, 'checks.json'), 'utf8'));
  const res = run({ root, snapshot, checks, selfBytes: fs.readFileSync(SELF) });
  if (args.includes('--json')) console.log(JSON.stringify(res));
  else for (const r of res) console.log(`${r.level.toUpperCase().padEnd(4)} ${r.m}`);
  const fails = res.filter((r) => r.level === 'fail').length;
  console.log(`stack-check ${checks.repo}: ${fails ? `${fails} FAIL` : 'PASS'} (${res.length} check line(s))`);
  process.exit(fails ? 1 : 0);
}
