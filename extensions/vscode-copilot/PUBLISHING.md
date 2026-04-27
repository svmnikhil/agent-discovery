# Publishing to the VS Code Marketplace

## One-time setup

### 1. Create a publisher account

- Go to https://marketplace.visualstudio.com/manage
- Sign in with the Microsoft account that owns the `svmnikhil` publisher (create it if it doesn't exist)
- Publisher ID used in `package.json`: `svmnikhil`

### 2. Create a Personal Access Token (PAT)

- Go to https://dev.azure.com → your organization → User Settings → Personal Access Tokens
- Create a new token:
  - **Name:** `vsce-publish`
  - **Organization:** All accessible organizations
  - **Scope:** Marketplace → **Manage**
  - **Expiration:** 1 year
- Copy the token immediately (shown only once)

### 3. Login with vsce

```bash
cd extensions/vscode-copilot
npx @vscode/vsce login svmnikhil
# Paste your PAT when prompted
```

---

## Pre-publish checklist

Before every publish:

- [ ] Replace `icon.png` with a real 128×128 PNG design (current file is a placeholder)
- [ ] Add demo screenshots to `images/` and update README.md `![demo]` link
- [ ] Bump `version` in `package.json` (`major.minor.patch`)
- [ ] Add a corresponding entry to `CHANGELOG.md`
- [ ] Run `npm run prepare` — exports fresh catalog and rebuilds
- [ ] Run `npm test` — all 16 tests pass
- [ ] Verify `.vscodeignore` excludes `src/`, `scripts/`, `node_modules/`, `out/`, `*.map`

---

## Package and publish

```bash
cd extensions/vscode-copilot

# Build
npm run prepare

# Package (creates agent-discovery-vscode-X.Y.Z.vsix)
npm run package
# Equivalent: npx @vscode/vsce package --no-dependencies

# Inspect the VSIX before publishing
npx @vscode/vsce ls  # lists files that will be included

# Publish to Marketplace
npx @vscode/vsce publish
# Or publish a specific version:
npx @vscode/vsce publish 0.2.0
```

---

## Post-publish

- The extension appears on the Marketplace within a few minutes
- URL: https://marketplace.visualstudio.com/items?itemName=svmnikhil.agent-discovery-vscode
- Check "Acquisition" stats at https://marketplace.visualstudio.com/manage/publishers/svmnikhil

---

## Notes

- `--no-dependencies` in `npm run package` is intentional — all dependencies are bundled into `dist/extension.js` by esbuild; the VSIX doesn't need `node_modules/`
- `catalog-data.json` (164KB) is included in the VSIX via the `dist/` bundle — do not add `src/catalog-data.json` to `.vscodeignore` or search will break
- The `engines.vscode` field (`^1.100.0`) gates Marketplace visibility — users on older VS Code won't see the extension listed
