#!/usr/bin/env node
/**
 * Scrape Progress.* (docs-be ABL Reference) and OpenEdge.* (oehttpclient OE128)
 * into summarized builtin type catalog JSON files.
 *
 * Usage: node scripts/scrape-builtin-types.mjs [--progress] [--openedge] [--verify]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "src/lib/abl/builtin");

const PROGRESS_BE =
  "https://docs-be.progress.com/bundle/abl-reference/page";
const PROGRESS_PUBLIC =
  "https://docs.progress.com/bundle/abl-reference/page";
const OE_BASE =
  "https://documentation.progress.com/output/oehttpclient/oe128";

const UA = "jabl-builtin-scraper/1.0 (+https://github.com/local/jabl)";

const args = new Set(process.argv.slice(2));
const doProgress = args.has("--progress") || (!args.has("--openedge") && !args.has("--verify"));
const doOpenedge = args.has("--openedge") || (!args.has("--progress") && !args.has("--verify"));
const doVerify = args.has("--verify");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url, { retries = 3 } = {}) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      });
      if (res.status === 404) return { ok: false, status: 404, text: "" };
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return { ok: true, status: res.status, text: await res.text() };
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(400 * (i + 1));
    }
  }
  return { ok: false, status: 0, text: "" };
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(text, max = 280) {
  let cleaned = text.replace(/\s+/g, " ").trim();
  // Strip ABL block-comment wrappers often used as purpose text
  cleaned = cleaned.replace(/^\/\*+\s*/, "").replace(/\s*\*+\/$/, "").trim();
  if (!cleaned) return "";
  const m = cleaned.match(/^(.{1,280}?[.!?])(\s|$)/);
  let s = (m ? m[1] : cleaned.slice(0, max)).trim();
  if (s.length > max) s = s.slice(0, max - 1).trim() + "…";
  return s;
}

function shortName(fqn) {
  const parts = fqn.split(".");
  return parts[parts.length - 1] || fqn;
}

function parseKindFromTitle(title) {
  const t = title.toLowerCase();
  if (t.includes("interface")) return "interface";
  if (t.includes("enumeration")) return "enum";
  return "class";
}

function memberKindFromLabel(label) {
  const l = label.toLowerCase();
  if (l.includes("property")) return "property";
  if (l.includes("constructor") || /\(\s*\)\s*$/.test(label) === false && l.includes("constructor"))
    return "constructor";
  if (l.includes("event") && !l.includes("method")) return "event";
  if (l.includes("enumeration") || l.includes(" enum")) return "enum";
  // "Foo( ) method" or "PUBLIC Object ( )"
  if (/constructor/i.test(label)) return "constructor";
  return "method";
}

function memberNameFromLabel(label) {
  // "GetClass( ) method (Progress.Lang.Object)" → GetClass
  // "NEXT-SIBLING property" → NEXT-SIBLING
  // "PUBLIC Object ( )" → Object (constructor)
  let s = label.trim();
  s = s.replace(/\s*property\s*$/i, "");
  s = s.replace(/\s*event\s*$/i, "");
  s = s.replace(/\s*method\s*(\([^)]*\))?\s*$/i, "");
  s = s.replace(/^PUBLIC\s+/i, "");
  s = s.replace(/\s*\(\s*\)\s*$/, "");
  // Drop trailing "(Progress.Lang.Object)" style
  s = s.replace(/\s*\([^)]*\)\s*$/, "");
  s = s.replace(/\s*\(\s*\u00a0?\s*\)\s*$/, "");
  // "Clone( )" mid
  const m = s.match(/^([A-Za-z_][\w\-]*|[A-Z][\w\-]*)/);
  return (m ? m[1] : s).trim();
}

function summarizeMember(label, kind) {
  const name = memberNameFromLabel(label);
  if (kind === "property") {
    return {
      name,
      kind,
      access: "PUBLIC",
      detail: `Property`,
      signature: `DEFINE PUBLIC PROPERTY ${name} ...`,
      summary: `Public property ${name}.`,
    };
  }
  if (kind === "constructor") {
    return {
      name: shortName(name) === name ? name : shortName(name),
      kind: "constructor",
      access: "PUBLIC",
      detail: "Constructor",
      signature: `CONSTRUCTOR PUBLIC ${name} ( )`,
      summary: `Constructs a new instance.`,
    };
  }
  if (kind === "event") {
    return {
      name,
      kind: "event",
      access: "PUBLIC",
      detail: "Event",
      signature: `DEFINE PUBLIC EVENT ${name} ...`,
      summary: `Public event ${name}.`,
    };
  }
  // method — try extract return-ish from label
  return {
    name,
    kind: "method",
    access: "PUBLIC",
    detail: "Method",
    signature: `METHOD PUBLIC VOID ${name} ( )`,
    summary: `Public method ${name}.`,
  };
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

/* ---------------- Progress.* ---------------- */

function progressSlugToName(slugFile) {
  // Progress.Collections.ListltTgt-class.html
  // Progress.Collections.ListIterator-ltTgt-class.html
  // Progress.Data.DataType-enumeration-class.html
  let base = slugFile.replace(/\.html$/i, "");
  let kind = "class";
  if (base.endsWith("-enumeration-class")) {
    kind = "enum";
    base = base.slice(0, -"-enumeration-class".length);
  } else if (base.endsWith("-enumeration")) {
    kind = "enum";
    base = base.slice(0, -"-enumeration".length);
  } else if (base.endsWith("-interface")) {
    kind = "interface";
    base = base.slice(0, -"-interface".length);
  } else if (base.endsWith("-class")) {
    kind = "class";
    base = base.slice(0, -"-class".length);
  }
  // Drop Zoomin generic markers for stable FQN keys (ListltTgt → List)
  let name = base
    .replace(/-lt[A-Za-z0-9,]+gt/g, "")
    .replace(/lt[A-Za-z0-9,]+gt/g, "");
  const genericSig = base.match(/lt([A-Za-z0-9,]+)gt/);
  return {
    name,
    kind,
    generic: genericSig ? genericSig[1] : undefined,
  };
}

async function listProgressTypes() {
  const url = `${PROGRESS_BE}/Class-Interface-and-Enumeration-Reference.html`;
  const { ok, text } = await fetchText(url);
  if (!ok) throw new Error(`Failed to fetch Progress TOC: ${url}`);

  const types = [];
  const seen = new Set();
  const re =
    /href="(Progress\.[A-Za-z0-9.]+-(?:lt[A-Za-z0-9,]+gt-)?(?:class|interface|enumeration(?:-class)?)\.html)"/gi;
  let m;
  while ((m = re.exec(text))) {
    const file = m[1];
    if (seen.has(file)) continue;
    seen.add(file);
    const { name, kind, generic } = progressSlugToName(file);
    types.push({ name, kind, slug: file, generic });
  }

  return types;
}

function extractProgressSummary(html) {
  const meta = html.match(
    /name="description"\s+content="([^"]+)"/i
  );
  if (meta) return firstSentence(meta[1]);
  const article = html.match(/<article[\s\S]*?<\/article>/i);
  if (!article) return "";
  const p = article[0].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return p ? firstSentence(stripTags(p[1])) : "";
}

function extractSectionLinks(html, headingRe) {
  const idx = html.search(headingRe);
  if (idx < 0) return [];
  const slice = html.slice(idx, idx + 8000);
  const next = slice.search(/<h2[^>]*>/i);
  const section = next > 0 ? slice.slice(0, next) : slice;
  const links = [];
  const re = /<a[^>]+href="([^"#]+\.html)(?:#[^"]*)?"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(section))) {
    const label = stripTags(m[2]);
    if (!label || label === "–" || label === "-") continue;
    links.push({ href: m[1], label });
  }
  // Also bare table cells with PUBLIC constructors
  const codeRe = /<code[^>]*>([\s\S]*?)<\/code>/gi;
  while ((m = codeRe.exec(section))) {
    const label = stripTags(m[1]);
    if (/PUBLIC\s+/i.test(label) || /\(\s*\)/.test(label)) {
      links.push({ href: "", label });
    }
  }
  return links;
}

async function enrichMemberFromPage(member, href) {
  if (!href) return member;
  try {
    const { ok, text } = await fetchText(`${PROGRESS_BE}/${href}`);
    if (!ok) return member;
    const summary = extractProgressSummary(text);
    // Try syntax from first code/pre
    const code =
      text.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i) ||
      text.match(/<code[^>]*class="[^"]*phcode[^"]*"[^>]*>([\s\S]*?)<\/code>/i);
    let signature = member.signature;
    if (code) {
      const syn = stripTags(code[1]).replace(/\s+/g, " ").trim();
      if (syn.length > 8 && syn.length < 400) signature = syn;
    }
    // Return type hints from title / first paragraph
    let detail = member.detail;
    if (member.kind === "method") {
      const ret = text.match(
        /returns?\s+(?:a\s+)?([A-Z][A-Z0-9\-]+|CHARACTER|INTEGER|INT64|LOGICAL|DECIMAL|HANDLE|VOID|CLASS\s+[\w.]+)/i
      );
      if (ret) detail = `Method → ${ret[1].replace(/^CLASS\s+/i, "")}`;
    } else if (member.kind === "property") {
      const dt = text.match(
        /data\s+type[:\s]+([A-Z][A-Z0-9\-]+|CHARACTER|INTEGER|INT64|LOGICAL|DECIMAL|HANDLE|CLASS\s+[\w.]+)/i
      );
      if (dt) detail = `Property → ${dt[1].replace(/^CLASS\s+/i, "")}`;
    }
    return {
      ...member,
      summary: summary || member.summary,
      signature,
      detail,
      docsUrl: `${PROGRESS_PUBLIC}/${href}`,
    };
  } catch {
    return member;
  }
}

async function scrapeProgressType(entry) {
  const url = `${PROGRESS_BE}/${entry.slug}`;
  const { ok, text, status } = await fetchText(url);
  if (!ok) {
    console.warn(`  skip ${entry.name} (${status})`);
    return null;
  }

  const summary =
    extractProgressSummary(text) ||
    `${entry.kind} ${entry.name} in the OpenEdge ABL built-in class library.`;

  const ctorLinks = extractSectionLinks(text, />\s*Constructors\s*</i);
  const propLinks = extractSectionLinks(text, />\s*Public Properties\s*</i);
  const methodLinks = extractSectionLinks(text, />\s*Public Methods\s*</i);
  const eventLinks = extractSectionLinks(text, />\s*Public Events\s*</i);

  const members = [];
  const pushUnique = (m) => {
    const key = `${m.kind}:${m.name}:${m.signature}`;
    if (members.some((x) => `${x.kind}:${x.name}:${x.signature}` === key))
      return;
    // Dedupe by name+kind for simpler catalog (overloads keep first enriched)
    if (
      members.some(
        (x) =>
          x.kind === m.kind &&
          x.name.toLowerCase() === m.name.toLowerCase() &&
          x.signature === m.signature
      )
    )
      return;
    members.push(m);
  };

  for (const l of ctorLinks) {
    const base = summarizeMember(l.label, "constructor");
    base.name = shortName(entry.name.replace(/<[^>]+>/g, ""));
    pushUnique(base);
  }
  for (const l of propLinks) {
    pushUnique(summarizeMember(l.label, "property"));
  }
  for (const l of methodLinks) {
    pushUnique(summarizeMember(l.label, "method"));
  }
  for (const l of eventLinks) {
    pushUnique(summarizeMember(l.label, "event"));
  }

  // Optional deep enrichment of member pages (slow)
  if (args.has("--enrich")) {
    const withHref = [
      ...propLinks.map((l) => ({
        i: members.findIndex(
          (m) =>
            m.kind === "property" && m.name === memberNameFromLabel(l.label)
        ),
        href: l.href,
      })),
      ...methodLinks.map((l) => ({
        i: members.findIndex(
          (m) => m.kind === "method" && m.name === memberNameFromLabel(l.label)
        ),
        href: l.href,
      })),
    ].filter((x) => x.i >= 0 && x.href);

    for (const { i, href } of withHref) {
      members[i] = await enrichMemberFromPage(members[i], href);
      await sleep(40);
    }
  } else {
    // Attach member docsUrl from class-page links without fetching
    for (const l of [...propLinks, ...methodLinks, ...eventLinks]) {
      if (!l.href) continue;
      const name = memberNameFromLabel(l.label);
      const kind = memberKindFromLabel(l.label);
      const hit = members.find(
        (m) => m.kind === kind && m.name.toLowerCase() === name.toLowerCase()
      );
      if (hit) hit.docsUrl = `${PROGRESS_PUBLIC}/${l.href}`;
    }
  }

  let name = entry.name.replace(/\s+</g, "<").replace(/\s+/g, "");

  const kindLabel =
    entry.kind === "interface"
      ? "INTERFACE"
      : entry.kind === "enum"
        ? "ENUM"
        : "CLASS";
  const sigName = entry.generic ? `${name}<${entry.generic}>` : name;

  return {
    name,
    kind: entry.kind,
    summary,
    signature: `${kindLabel} ${sigName}`,
    docsUrl: `${PROGRESS_PUBLIC}/${entry.slug}`,
    members,
  };
}

async function scrapeAllProgress() {
  console.log("Listing Progress.* types…");
  const list = await listProgressTypes();
  console.log(`Found ${list.length} Progress types`);

  const types = [];
  // Process with limited concurrency; member enrichment is sequential per type
  const CONCURRENCY = 3;
  await mapPool(list, CONCURRENCY, async (entry, idx) => {
    console.log(`[${idx + 1}/${list.length}] ${entry.name}`);
    const t = await scrapeProgressType(entry);
    if (t) types.push(t);
    await sleep(80);
  });

  types.sort((a, b) => a.name.localeCompare(b.name));
  const out = {
    source: `${PROGRESS_PUBLIC}/Class-Interface-and-Enumeration-Reference.html`,
    types,
  };
  await fs.writeFile(
    path.join(OUT, "progress-types.json"),
    JSON.stringify(out, null, 2) + "\n"
  );
  console.log(`Wrote progress-types.json (${types.length} types)`);
}

/* ---------------- OpenEdge.* ---------------- */

const OE_ROOT_PACKAGES = [
  "OpenEdge.Core",
  "OpenEdge.Logging",
  "OpenEdge.Net",
];

async function listOePackageTypes(pkg) {
  const url = `${OE_BASE}/${pkg}.package.html`;
  const { ok, text } = await fetchText(url);
  if (!ok) {
    console.warn(`Missing package page ${url}`);
    return { subpackages: [], types: [] };
  }

  const subpackages = [];
  const types = [];

  // Subpackages table links
  const subRe =
    /href="(OpenEdge\.[^"]+)\.package\.html"[^>]*>\s*(OpenEdge\.[^<]+)/gi;
  let m;
  while ((m = subRe.exec(text))) {
    subpackages.push(m[1]);
  }

  const rowRe =
    /<a href="(((?:OpenEdge|Ccs)\.[A-Za-z0-9.]+))\.html">([^<]+)<\/a>/gi;
  while ((m = rowRe.exec(text))) {
    const name = m[1];
    if (!name.includes(".")) continue;
    if (name.endsWith(".package") || name.endsWith("package")) continue;
    types.push(name);
  }

  return {
    subpackages: [...new Set(subpackages)],
    types: [...new Set(types)],
  };
}

async function collectOeTypes(rootPkgs) {
  const queue = [...rootPkgs];
  const seenPkg = new Set();
  const typeNames = new Set();

  while (queue.length) {
    const pkg = queue.shift();
    if (seenPkg.has(pkg)) continue;
    seenPkg.add(pkg);
    console.log(`  package ${pkg}`);
    const { subpackages, types } = await listOePackageTypes(pkg);
    for (const t of types) typeNames.add(t);
    for (const s of subpackages) {
      // Only descend under requested roots
      if (rootPkgs.some((r) => s === r || s.startsWith(r + "."))) {
        queue.push(s);
      }
    }
    await sleep(60);
  }
  return [...typeNames].sort();
}

function parseOeNameCell(nameHtml) {
  // e.g. ` INTEGER <a> CompareTo (ILongcharHolder)</a>` or `<a> Append (longchar)</a>`
  const text = stripTags(nameHtml).replace(/\s+/g, " ").trim();
  const m = text.match(
    /^(?:([A-Za-z][\w.\[\]<>]*)\s+)?([A-Za-z_][\w]*)\s*(\([^)]*\))?\s*$/
  );
  if (!m) {
    const fb = text.match(/^([A-Za-z_][\w]*)/);
    return { ret: "VOID", name: fb ? fb[1] : text, params: "( )" };
  }
  let ret = "VOID";
  let name = m[2];
  const params = m[3] || "( )";
  if (m[1]) {
    const maybe = m[1];
    const primitives = new Set([
      "CHARACTER",
      "INTEGER",
      "INT64",
      "LOGICAL",
      "DECIMAL",
      "LONGCHAR",
      "VOID",
      "DATETIME",
      "DATETIME-TZ",
      "DATE",
      "HANDLE",
      "MEMPTR",
      "RAW",
      "RECID",
      "ROWID",
      "COM-HANDLE",
      "CLASS",
    ]);
    if (maybe.includes(".") || primitives.has(maybe.toUpperCase())) {
      ret = maybe;
    } else {
      // "Append" with no return — first token was actually the name
      name = maybe;
    }
  }
  return { ret, name, params };
}

function parseOeMembers(html) {
  const members = [];

  function parseClassTable(tableClass, kind) {
    const re = new RegExp(
      `<table[^>]*class="[^"]*${tableClass}[^"]*"[^>]*>([\\s\\S]*?)<\\/table>`,
      "i"
    );
    const m = html.match(re);
    if (!m) return;
    const rows = m[1].split(/<tr[\s>]/i).slice(1);
    for (const row of rows) {
      if (/table_subheading_color/i.test(row)) continue;
      const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
      if (tds.length < 3) continue;
      // cols: spacer | options | name | purpose
      const nameHtml = tds.length >= 4 ? tds[2][1] : tds[1][1];
      const purposeHtml = tds.length >= 4 ? tds[3][1] : tds[2][1];
      const purpose = firstSentence(stripTags(purposeHtml || ""), 220);
      const nameCell = stripTags(nameHtml).replace(/\s+/g, " ").trim();
      if (!nameCell) continue;

      if (kind === "constructor") {
        const ctorName = nameCell.replace(/\s*\(.*$/, "").trim();
        const params = nameCell.includes("(")
          ? nameCell.slice(nameCell.indexOf("("))
          : "( )";
        members.push({
          name: ctorName || "constructor",
          kind: "constructor",
          access: "PUBLIC",
          detail: "Constructor",
          signature: `CONSTRUCTOR PUBLIC ${ctorName || "Type"} ${params}`,
          summary: purpose || "Constructor.",
        });
        continue;
      }

      if (kind === "property") {
        const { ret, name } = parseOeNameCell(nameHtml);
        if (!name) continue;
        const type = ret !== "VOID" ? ret : "";
        members.push({
          name,
          kind: "property",
          access: "PUBLIC",
          detail: type ? `Property → ${type}` : "Property",
          signature: type
            ? `DEFINE PUBLIC PROPERTY ${name} AS ${type}`
            : `DEFINE PUBLIC PROPERTY ${name} ...`,
          summary: purpose || `Property ${name}.`,
        });
        continue;
      }

      if (kind === "event") {
        const { name } = parseOeNameCell(nameHtml);
        if (!name) continue;
        members.push({
          name,
          kind: "event",
          access: "PUBLIC",
          detail: "Event",
          signature: `DEFINE PUBLIC EVENT ${name} ...`,
          summary: purpose || `Event ${name}.`,
        });
        continue;
      }

      const { ret, name, params } = parseOeNameCell(nameHtml);
      if (!name) continue;
      members.push({
        name,
        kind: "method",
        access: "PUBLIC",
        detail: `Method → ${ret}`,
        signature: `METHOD PUBLIC ${ret} ${name} ${params}`,
        summary: purpose || `Method ${name}.`,
      });
    }
  }

  parseClassTable("method_summary", "method");
  parseClassTable("constructor_summary", "constructor");
  parseClassTable("property_summary", "property");
  parseClassTable("event_summary", "event");

  // Enum members often listed differently
  if (members.length === 0 && /enum/i.test(html)) {
    const enumRe =
      /<a href="#[^"]+"[^>]*>\s*([A-Za-z_][\w\-]*)\s*<\/a>/gi;
    let em;
    const seen = new Set();
    while ((em = enumRe.exec(html))) {
      const name = em[1];
      if (seen.has(name)) continue;
      if (["Top", "Parent", "Classes", "Methods", "Properties"].includes(name))
        continue;
      seen.add(name);
      members.push({
        name,
        kind: "enum",
        access: "PUBLIC",
        detail: "Enum member",
        signature: name,
        summary: `Enumeration member ${name}.`,
      });
    }
  }

  return members;
}

async function scrapeOeType(name) {
  if (name.endsWith(".package") || name.endsWith("package")) return null;
  const url = `${OE_BASE}/${name}.html`;
  const { ok, text, status } = await fetchText(url);
  if (!ok) {
    console.warn(`  skip ${name} (${status})`);
    return null;
  }

  let kind = "class";
  if (
    /span_classtype[^>]*>\s*Interface/i.test(text) ||
    /unit_header[\s\S]{0,800}Interface/i.test(text)
  ) {
    kind = "interface";
  }
  if (
    /Enum(?:eration)?$/i.test(name) ||
    /span_classtype[^>]*>\s*Enumeration/i.test(text) ||
    /Enumeration of/i.test(text.slice(0, 4000))
  ) {
    kind = "enum";
  }

  const purpose = text.match(
    /unitcommentparam'>Purpose:<\/td>\s*<td class='unitcommentdesc'>([\s\S]*?)<\/td>/i
  );
  let summary = purpose ? firstSentence(stripTags(purpose[1])) : "";
  if (!summary) summary = `${kind} ${name}.`;

  const inherits = text.match(
    /Inherits:\s*[\s\S]{0,200}?<a[^>]*>\s*([^<]+)/i
  );
  const members = parseOeMembers(text);

  const kindLabel =
    kind === "interface" ? "INTERFACE" : kind === "enum" ? "ENUM" : "CLASS";

  return {
    name,
    kind,
    summary,
    signature: `${kindLabel} ${name}`,
    docsUrl: url,
    inherits: inherits ? stripTags(inherits[1]) : undefined,
    members,
  };
}

function pickRootFile(name) {
  if (name.startsWith("OpenEdge.Logging") || name.startsWith("Ccs.")) {
    // Ccs types referenced from Core — put Ccs under core file if from Core crawl
  }
  if (name.startsWith("OpenEdge.Logging")) return "openedge-logging-types.json";
  if (name.startsWith("OpenEdge.Net")) return "openedge-net-types.json";
  return "openedge-core-types.json";
}

async function scrapeAllOpenedge() {
  console.log("Collecting OpenEdge types…");
  const coreTypes = await collectOeTypes(["OpenEdge.Core"]);
  const loggingTypes = await collectOeTypes(["OpenEdge.Logging"]);
  const netTypes = await collectOeTypes(["OpenEdge.Net"]);

  // Include Ccs packages referenced from Core package pages if discovered
  const all = [...new Set([...coreTypes, ...loggingTypes, ...netTypes])];
  console.log(`Scraping ${all.length} OpenEdge/Ccs types…`);

  const buckets = {
    "openedge-core-types.json": {
      source: `${OE_BASE}/OpenEdge.Core.package.html`,
      types: [],
    },
    "openedge-logging-types.json": {
      source: `${OE_BASE}/OpenEdge.Logging.package.html`,
      types: [],
    },
    "openedge-net-types.json": {
      source: `${OE_BASE}/OpenEdge.Net.package.html`,
      types: [],
    },
  };

  await mapPool(all, 4, async (name, idx) => {
    console.log(`[${idx + 1}/${all.length}] ${name}`);
    const t = await scrapeOeType(name);
    if (!t) return;
    let file = pickRootFile(name);
    if (name.startsWith("Ccs.")) file = "openedge-core-types.json";
    buckets[file].types.push(t);
    await sleep(50);
  });

  for (const [file, data] of Object.entries(buckets)) {
    data.types.sort((a, b) => a.name.localeCompare(b.name));
    await fs.writeFile(
      path.join(OUT, file),
      JSON.stringify(data, null, 2) + "\n"
    );
    console.log(`Wrote ${file} (${data.types.length} types)`);
  }
}

async function verifyDocsUrls() {
  const files = [
    "progress-types.json",
    "openedge-core-types.json",
    "openedge-logging-types.json",
    "openedge-net-types.json",
  ];
  let ok = 0;
  let bad = 0;
  for (const file of files) {
    const data = JSON.parse(
      await fs.readFile(path.join(OUT, file), "utf8")
    );
    for (const t of data.types) {
      const url = t.docsUrl;
      // Prefer docs-be for Progress public URLs
      const checkUrl = url.includes("docs.progress.com/bundle/")
        ? url.replace(
            "https://docs.progress.com/bundle/",
            "https://docs-be.progress.com/bundle/"
          )
        : url;
      const res = await fetchText(checkUrl, { retries: 2 });
      if (res.ok) {
        ok++;
        process.stdout.write(".");
      } else {
        bad++;
        console.log(`\nFAIL ${res.status} ${t.name} ${url}`);
      }
      await sleep(30);
    }
  }
  console.log(`\nVerified: ${ok} ok, ${bad} failed`);
  if (bad > 0) process.exitCode = 1;
}

async function main() {
  if (doProgress) await scrapeAllProgress();
  if (doOpenedge) await scrapeAllOpenedge();
  if (doVerify) await verifyDocsUrls();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
