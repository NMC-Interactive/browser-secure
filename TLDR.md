# browser-secure: Bitwarden + .env Support

## User Preferences (River)

### Philosophy
**"Secure-first browser automation"** — The system should NEVER require typing exact commands. It guides, automates, and handles setup transparently.

### Onboarding Flow (Fully Automated)
1. **Install** → Auto-detect and install ALL dependencies (Bitwarden CLI, Playwright, Chrome profile)
2. **First Run** → **Auto-launch welcome page** in new Chrome profile with guided setup
3. **Second Run+** → **Zero-config** — Use saved profile automatically
4. **Profile Missing** → **Auto-reonboard** — Silently recreate and re-show welcome page

### .env File Support (NEW)
- Store credentials in `.env` file (gitignored)
- Supports Bitwarden API Key + Master Password for full automation
- No manual `export` commands needed

---

## Summary

Updated browser-secure skill with:
1. **Bitwarden as default vault provider** (was 1Password)
2. **`.env` file support** — Auto-load credentials without manual exports
3. **API Key authentication** — `BW_CLIENTID/BW_CLIENTSECRET` for automated login
4. **Master password unlock** — `BW_PASSWORD` for automated vault decryption

## New: .env File Setup

### Full Automation (Recommended)
```bash
cd ~/.openclaw/workspace/skills/browser-secure
cp .env.example .env
# Edit .env:
#   BW_CLIENTID=user.xxx-xxx
#   BW_CLIENTSECRET=your-secret
#   BW_PASSWORD=your-master-password
```

Now commands work without any manual setup:
```bash
browser-secure navigate https://app.neilpatel.com/ --auto-vault
```

### Authentication Flow
1. **API Key** (`BW_CLIENTID/BW_CLIENTSECRET`) → Authenticates with Bitwarden
2. **Master Password** (`BW_PASSWORD`) → Decrypts vault for credential access
3. Both are required for fully automated operation

## Previous Changes

### Default Provider: Bitwarden
- Bitwarden is now the default (free, open source)
- 1Password still works as fallback

### Auto-Discovery
- Searches Bitwarden first, then 1Password
- Interactive credential selection
- Configurable site mappings

## Files Changed
- `package.json` — Added `dotenv` dependency
- `src/cli.ts` — Added `import 'dotenv/config'`
- `src/vault/index.ts` — Added API key + password authentication flow
- `SKILL.md` — Updated documentation
- `.env.example` — New template file
