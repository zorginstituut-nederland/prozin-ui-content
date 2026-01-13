#!/usr/bin/env node
import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const argv = process.argv.slice(2);
const getArg = (name, def) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : def;
};
const hasFlag = (name) => argv.includes(name);

const DATA_DIR = path.resolve(getArg("--dir", "./"));
const OUT_DIR = path.resolve(getArg("--out", "dist/i18n"));

const ALL_YAMLS = hasFlag("--all-yamls");
const ALL_LANGS = hasFlag("--all-langs");

// Defaults:
// - only ui.yaml
// - only nl/en
const ONLY = ALL_YAMLS ? null : getArg("--only", "ui.yaml");
const DEFAULT_LANGS = ["nl", "en"];

fs.mkdirSync(OUT_DIR, { recursive: true });

function listYamlFiles(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => e.name)
        .filter((n) => /\.(ya?ml)$/i.test(n))
        .filter((n) => (ONLY ? n === ONLY : true))
        .map((n) => path.join(dir, n));
}

function detectLanguages(data) {
    const languages = new Set();
    Object.values(data || {}).forEach((v) => {
        if (v && typeof v === "object") {
            Object.keys(v).forEach((lang) => languages.add(lang));
        }
    });
    return Array.from(languages).sort();
}

const files = listYamlFiles(DATA_DIR);
if (files.length === 0) {
    console.log(`No .yml/.yaml files found in ${DATA_DIR}`);
    process.exit(0);
}

for (const filePath of files) {
    const fileName = path.basename(filePath);
    const stem = fileName.replace(/\.(ya?ml)$/i, "");

    // NOTE: This will throw if YAML has duplicate keys.
    // That's why the clean step exists and should run first.
    const data = yaml.load(fs.readFileSync(filePath, "utf8"));

    const languages = ALL_LANGS ? detectLanguages(data) : DEFAULT_LANGS;

    for (const lang of languages) {
        const lines = [];
        for (const [key, value] of Object.entries(data || {})) {
            if (value && typeof value === "object" && value[lang]) {
                lines.push(`${key}=${String(value[lang])}`);
            }
        }

        fs.writeFileSync(
            path.join(OUT_DIR, `${stem}_${lang}.properties`),
            lines.join("\n") + "\n",
            "utf8"
        );

        console.log(`✔ ${stem}_${lang}.properties generated`);
    }
}