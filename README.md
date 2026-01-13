# Prozin i18n Build & Cleanup

This repository contains YAML-based i18n source files (for example `ui.yaml`) and Node.js scripts to:

1. Clean duplicate translation entries
2. Generate `.properties` files
3. Support multiple languages and multiple YAML files
4. Fully regenerate output on every build
5. Produce cleanup reports suitable for PR / MR bodies

The workflow is intentionally split into two clear steps:

- Cleaning → safe auto-removal + conflict detection
- Building → YAML → `.properties`

---

## Project Structure

```text
.
├─ ui.yaml
├─ other-files.yaml
├─ build/
│  ├─ build-i18n.js
│  └─ clean-i18n-duplicates.js
├─ dist/
│  └─ i18n/
├─ package.json
└─ README.md
```

---

## Scripts

Scripts overview  
clean:*  → clean YAML duplicates  
build:*  → generate .properties  
i18n:*   → clean + build combinations

---

## Cleaning YAML duplicates

Cleaning YAML duplicates
- Identical duplicate keys with identical values are removed automatically (FIFO order)
- Duplicate keys with different values are detected as conflicts
- Conflicts will fail the script (intended for PR / CI enforcement)

Commands:

```bash
# Cleans duplicate keys in `ui.yaml` only (default)
npm run clean:i18n  

# Cleans duplicate keys in ALL `.yml` / `.yaml` files
npm run clean:i18n:all-yamls  
```
---

## Cleaning YAML duplicates WITH report

In addition to cleaning, a report is generated for PR / MR usage.

Generated files:
- dist/i18n/clean-report.md
- dist/i18n/clean-report.json

Commands:

```bash
# Cleans `ui.yaml` and generates a report
npm run clean:i18n:report  

# Cleans ALL YAML files and generates a report
npm run clean:i18n:all-yamls:report  
```
---

## Build i18n properties

Build YAML → `.properties` files.

Commands:

```bash
# Build `ui.yaml` → nl + en (default)
npm run build:i18n  

# Build `ui.yaml` → all detected languages
npm run build:i18n:all-langs  

# Build ALL YAML files → nl + en
npm run build:i18n:all-yamls  

# Build ALL YAML files → all languages
npm run build:i18n:full  
```
Each build fully regenerates the `dist/` directory.

---

## Clean + Build combinations

Combined commands for convenience.

Commands:
```bash
# Clean `ui.yaml`, then build nl + en
npm run i18n  

# Clean `ui.yaml`, then build all languages
npm run i18n:all-langs  

# Clean ALL YAML files, then build nl + en
npm run i18n:all-yamls  

# Clean ALL YAML files, then build all languages
npm run i18n:full  
```
---

## CI usage

Recommended CI command:
```bash
npm run i18n:ci
```

Behavior:
- Cleans ALL YAML files
- Generates cleanup report
- Builds properties from `ui.yaml` (nl + en)
- Automatically removes safe duplicates
- Fails CI only when conflicts are found

---

## Utility scripts
```bash
# Removes the entire `dist` folder
npm run clean:dist  
```
---

## CI behavior summary

Identical duplicate keys  
→ Automatically removed  
→ CI does NOT fail

Duplicate keys with different values  
→ Reported as conflicts  
→ CI FAILS

Cleanup reports  
→ Can be attached directly to PR / MR bodies

---

## GitHub Actions overview

This repository is designed to work standalone (also when used as a submodule).

Typical workflow:
1. Run clean script (with report)
2. Fail only on conflicts
3. Generate `.properties`
4. Upload `dist/i18n` and cleanup report as artifacts
5. Use the report to populate PR / MR descriptions