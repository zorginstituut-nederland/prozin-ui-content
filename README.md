# Prozin i18n Build & Cleanup

This repository contains YAML-based i18n source files (for example `ui.yaml`) and Node.js scripts to:

1. Clean duplicate translation entries
2. Generate `.properties` files
3. Support multiple languages and multiple YAML files
4. Fully regenerate output on every build
5. Produce cleanup reports suitable for PR

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
- Duplicates and conflicts will fail the script when using CI

Commands:

```bash
# Cleans duplicate keys in `ui.yaml` only (default)
npm run clean:i18n  

# Cleans duplicate keys in ALL `.yml` / `.yaml` files
npm run clean:i18n:all-yamls  
```
---

## Cleaning YAML duplicates WITH report

In addition to cleaning, a report is generated for PR.

Generated files:
- dist/i18n/clean-report.md

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

## Utility scripts
```bash
# Removes the entire `dist` folder
npm run clean:dist  
```

---

## CI usage

Github actions workflow uses below command. 
This does a dry run to clean all yaml files and report it.
When it has duplicates or conflicts the pipeline will fail.

When no conflicts or duplicates are found, create a PR to bloomreach-zin
Recommended CI command:
```bash
npm run i18n:ci
```

Behavior:
- Cleans ALL YAML files
- Generates cleanup report
- Builds properties from `ui.yaml` (nl + en)
- Fails CI only when conflicts or duplicates are found

---

## How to use

This repository is designed to work standalone (also when used as a submodule).

Typical workflow:
1. Update ui content.
2. Run clean:i18n:all-yamls to validate if duplicate keys are found(with same or different values).
    3. Duplicates with same value will be overwritten(FIFO style)
    4. Duplicates with different value will be marked as conflict. Manual choose one of the values.
3. When not executing step 2, pipeline could return error that duplicates/conflicts are found(NO PR).
4. Push changes
5. Workflow will automatically add PR to bloomreach-zin project for the new ui content.

Updating site specific ui content:
1. Update ui.yaml in frontend project. e.g. [Zorginzicht](https://github.com/zorginstituut-nederland/zorginzicht/blob/master/_data/ui.yaml) 
2. Go to [Prozin-ui-content Actions](https://github.com/zorginstituut-nederland/prozin-ui-content/actions/workflows/i18n.yaml)
3. Click Run workflow
4. Use master branch
5. Click Run workflow
6. Prozin-ui-content will be updated and also the pull from the site specific content.