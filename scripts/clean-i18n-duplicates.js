#!/usr/bin/env node
import fs from "fs";
import path from "path";

const argv = process.argv.slice(2);

const getArg = (name, def) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : def;
};
const hasFlag = (name) => argv.includes(name);

const DATA_DIR = path.resolve(getArg("--dir", "./"));
const ALL_YAMLS = hasFlag("--all-yamls");
const DRY_RUN = hasFlag("--dry-run");

// New: optional report output (markdown)
const REPORT_PATH = getArg("--report", null);

// Default to ui.yaml unless --all-yamls
const ONLY = ALL_YAMLS ? null : getArg("--only", "ui.yaml");

function listYamlFiles(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => /\.(ya?ml)$/i.test(n))
        .filter((n) => (ONLY ? n === ONLY : true))
        .map((n) => path.join(dir, n));
}

// Parse top-level "key:" blocks and simple "  lang: value" lines inside
function parseTopLevelBlocks(fileText) {
    const lines = fileText.split(/\r?\n/);
    const keyLineRe = /^([A-Za-z0-9_.-]+)\s*:\s*(#.*)?$/; // key: at col 0
    const langLineRe = /^\s{2,}([A-Za-z0-9_-]+)\s*:\s*(.*)\s*$/;

    const blocks = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        const isTopLevel = !line.startsWith(" ") && !line.startsWith("\t");
        const mKey = isTopLevel ? line.match(keyLineRe) : null;

        if (mKey) {
            if (current) {
                current.endLine = i - 1;
                blocks.push(current);
            }
            current = {
                key: mKey[1],
                startLine: i,
                endLine: i,
                lines: [line],
                langMap: {},
            };
            continue;
        }

        if (current) current.lines.push(line);
    }

    if (current) {
        current.endLine = lines.length - 1;
        blocks.push(current);
    }

    // fill langMap
    for (const b of blocks) {
        for (let j = 1; j < b.lines.length; j++) {
            const line = b.lines[j];
            const m = line.match(langLineRe);
            if (!m) continue;

            const lang = m[1];
            let val = (m[2] ?? "").trim();

            const isQuoted =
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"));

            if (!isQuoted) {
                const hash = val.indexOf(" #");
                if (hash >= 0) val = val.slice(0, hash).trim();
            }

            if (
                (val.startsWith('"') && val.endsWith('"')) ||
                (val.startsWith("'") && val.endsWith("'"))
            ) {
                val = val.slice(1, -1);
            }

            b.langMap[lang] = val;
        }
    }

    return blocks;
}

function signature(langMap) {
    const keys = Object.keys(langMap).sort();
    return keys.map((k) => `${k}=${langMap[k]}`).join("|");
}

function unionLangs(variants) {
    const s = new Set();
    for (const v of variants) Object.keys(v.langMap).forEach((l) => s.add(l));
    return Array.from(s).sort();
}

function formatLangMap(langMap) {
    const langs = Object.keys(langMap).sort();
    if (langs.length === 0) return "(no lang values found)";
    return langs.map((l) => `${l}: ${langMap[l]}`).join(" | ");
}

function mdEscape(s) {
    return String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const files = listYamlFiles(DATA_DIR);
if (files.length === 0) {
    console.log(`No .yml/.yaml files found in ${DATA_DIR}`);
    process.exit(0);
}

let removedTotal = 0;
let conflictTotal = 0;

const report = [];
if (REPORT_PATH) {
    report.push(`# i18n clean report`);
    report.push(``);
    report.push(`- Dir: \`${DATA_DIR}\``);
    report.push(`- Only: \`${ONLY ?? "(all yamls)"}\``);
    report.push(`- Mode: \`${DRY_RUN ? "dry-run" : "write"}\``);
    report.push(``);
}

for (const filePath of files) {
    const fileName = path.basename(filePath);
    const original = fs.readFileSync(filePath, "utf8");
    const blocks = parseTopLevelBlocks(original);

    const byKey = new Map();
    for (const b of blocks) {
        if (!byKey.has(b.key)) byKey.set(b.key, []);
        byKey.get(b.key).push(b);
    }

    const startsToRemove = new Set();
    const conflicts = [];
    const removedSameValue = []; // records removed identical dupes

    for (const [key, arr] of byKey.entries()) {
        if (arr.length <= 1) continue;

        const sigToBlocks = new Map();
        for (const b of arr) {
            const sig = signature(b.langMap);
            if (!sigToBlocks.has(sig)) sigToBlocks.set(sig, []);
            sigToBlocks.get(sig).push(b);
        }

        // identical dupes => remove first occurrence(s), keep last (FIFO removal)
        for (const bs of sigToBlocks.values()) {
            if (bs.length > 1) {
                const kept = bs[bs.length - 1];
                for (let i = 0; i < bs.length - 1; i++) {
                    const removed = bs[i];
                    startsToRemove.add(removed.startLine);

                    removedSameValue.push({
                        key,
                        removedLine: removed.startLine + 1,
                        keptLine: kept.startLine + 1,
                        langMap: removed.langMap,
                    });
                }
            }
        }

        // different signatures => conflict
        if (sigToBlocks.size > 1) {
            conflicts.push({
                key,
                variants: arr.map((b) => ({
                    startLine: b.startLine + 1, // 1-based
                    langMap: b.langMap,
                })),
            });
        }
    }

    // Print + report: removed identical duplicates
    if (removedSameValue.length > 0) {
        console.log(`\n🧹 Removed identical duplicates in ${fileName}:\n`);

        if (REPORT_PATH) {
            report.push(`## ${fileName}`);
            report.push(``);
            report.push(`### Removed identical duplicates (FIFO)`);
            report.push(``);
        }

        for (const r of removedSameValue) {
            console.log(`Key: ${r.key}`);
            console.log(`  Removed line: ${r.removedLine}`);
            console.log(`  Kept line:    ${r.keptLine}`);
            console.log(`  Values:       ${formatLangMap(r.langMap)}`);
            console.log("");

            if (REPORT_PATH) {
                report.push(`Key: \`${mdEscape(r.key)}\`  `);
                report.push(`Removed line: ${r.removedLine}  `);
                report.push(`Kept line: ${r.keptLine}  `);
                report.push(``);
                report.push(`Values:`);

                const langs = Object.keys(r.langMap).sort();
                for (const lang of langs) {
                    report.push(`${lang}: ${r.langMap[lang]}`);
                }
                report.push(``);
            }
        }

        if (REPORT_PATH) report.push(``);
    } else {
        console.log(`✔ ${fileName}: no identical duplicates to remove`);
        if (REPORT_PATH) {
            report.push(`## ${fileName}`);
            report.push(``);
            report.push(`- No identical duplicates removed.`);
            report.push(``);
        }
    }

    // Print + report: conflicts
    if (conflicts.length > 0) {
        conflictTotal += conflicts.length;
        console.log(`\n⚠ Conflicts in ${fileName} (same key, different value):\n`);

        if (REPORT_PATH) {
            report.push(`### Conflicts (same key, different value)`);
            report.push(``);
        }

        for (const c of conflicts) {
            console.log(`Key: ${c.key}`);
            const langs = unionLangs(c.variants);

            if (REPORT_PATH) {
                report.push(`- **${mdEscape(c.key)}**`);
            }

            for (const lang of langs) {
                const values = new Set();
                for (const v of c.variants) {
                    if (v.langMap[lang] !== undefined) values.add(v.langMap[lang]);
                }
                if (values.size > 1) {
                    console.log(`  ${lang}:`);
                    for (const val of values) console.log(`    - ${val}`);

                    if (REPORT_PATH) {
                        report.push(`  - ${mdEscape(lang)}:`);
                        for (const val of values) report.push(`    - ${mdEscape(val)}`);
                    }
                }
            }

            console.log("  Occurs at lines:");
            for (const v of c.variants) console.log(`    - ${v.startLine}`);
            console.log("");

            if (REPORT_PATH) {
                report.push(`  - Occurs at lines: ${c.variants.map((v) => v.startLine).join(", ")}`);
            }
        }

        if (REPORT_PATH) report.push(``);
    }

    // Remove identical dupes
    if (startsToRemove.size > 0) {
        const lines = original.split(/\r?\n/);
        const byStart = new Map(blocks.map((b) => [b.startLine, b]));
        const out = [];
        let i = 0;

        while (i < lines.length) {
            if (byStart.has(i) && startsToRemove.has(i)) {
                const b = byStart.get(i);
                i = b.endLine + 1; // skip entire duplicate block
                continue;
            }
            out.push(lines[i]);
            i++;
        }

        const removed = startsToRemove.size;
        removedTotal += removed;

        if (DRY_RUN) {
            console.log(`🧪 ${fileName}: would remove ${removed} identical duplicate(s)`);
        } else {
            fs.writeFileSync(filePath, out.join("\n"), "utf8");
            console.log(`🧹 ${fileName}: removed ${removed} identical duplicate(s)`);
        }
    }
}

console.log(
    `\nDone. Identical duplicates removed: ${removedTotal}. Conflicting keys found: ${conflictTotal}.`
);

if (REPORT_PATH) {
    report.push(`---`);
    report.push(``);
    report.push(`## Summary`);
    report.push(``);
    report.push(`- Identical duplicates removed: [ ${removedTotal} ]`);
    report.push(`- Conflicting keys found: [ ${conflictTotal} ]`);
    report.push(``);
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, report.join("\n"), "utf8");
    console.log(`📝 Report written to ${REPORT_PATH}`);
}

// ✅ Fail only on conflicts
if (conflictTotal > 0) {
    console.error("❌ Conflicts found (same key, different value). Fix these manually.");
    process.exit(1);
}

process.exit(0);