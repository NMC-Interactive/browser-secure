---
name: browser-secure
description: Secure browser automation with Chrome profile support, vault integration, approval gates, and comprehensive audit logging. Use for authenticated sites, sensitive operations, or compliance requirements.
allowed-tools: Bash
---

# Browser Secure

Secure browser automation with vault-backed credentials, approval gates, and audit trails.

## Philosophy

> **"Never trust, always verify, encrypt everything, audit all actions"**

## Quick Start

```bash
# Navigate to a public site (no vault needed)
browser-secure navigate https://example.com

# List available Chrome profiles
browser-secure navigate https://example.com --list-profiles

# Navigate using a specific Chrome profile (with your cookies/logins)
browser-secure navigate https://github.com --profile "Profile 1"

# Or select profile interactively
browser-secure navigate https://github.com --profile select

# Navigate with auto-vault credential discovery (interactive)
browser-secure navigate https://app.neilpatel.com/ --auto-vault

# Navigate to an authenticated site (pre-configured)
browser-secure navigate https://nytimes.com --site=nytimes

# Perform actions
browser-secure act "click the login button"
browser-secure extract "get the article headlines"

# Close and cleanup
browser-secure close
```

## Auto-Vault Credential Discovery

The `--auto-vault` flag enables interactive credential discovery from your password manager:

```bash
browser-secure navigate https://app.neilpatel.com/ --auto-vault
```

This will:
1. Extract the domain from the URL (`app.neilpatel.com` → `neilpatel`)
2. **Search Bitwarden first** (free, default), then 1Password if available
3. Present matching items interactively:

```
🔍 Auto-discovering credentials for app.neilpatel.com...

📋 Found 2 matching credential(s) in Bitwarden:

  1) Neil Patel Account
     Username: user@example.com
  2) Ubersuggest API Key

  n) None of these - try another vault
  m) Manually enter credentials

Select credential to use (1-2, n, or m): 1
🔐 Retrieving credentials for neilpatel...

Save this credential mapping for future use? (y/n): y
✅ Saved credential mapping for "neilpatel" to ~/.browser-secure/config.yaml
   Default vault provider set to: Bitwarden
```

After saving, you can use the simpler command next time:
```bash
browser-secure navigate https://app.neilpatel.com/ --site=neilpatel
```

## Profile Management

Create isolated Chrome profiles for secure automation with automatic welcome page setup:

```bash
# Create a new profile with welcome page
browser-secure profile --create "Funny Name"

# Create and immediately launch Chrome
browser-secure profile --create "The Crustacean Station 🦞" --launch

# List all Chrome profiles
browser-secure profile --list
```

### What the Welcome Page Includes

When you create a new profile, it opens with a custom welcome page that guides you through:

1. **📖 Why This Profile Exists** - Explains the isolated automation concept
2. **🔌 Required Extensions** - Direct links to install:
   - Bitwarden password manager
   - OpenClaw Browser Relay
3. **🗝️ Vault Setup** - Step-by-step for Bitwarden or 1Password
4. **✅ Setup Checklist** - Interactive checklist to track progress
5. **🛡️ Security Info** - "Your vault is secure" messaging with key features

### Why Separate Profiles?

| Aspect | Personal Profile | Automation Profile |
|--------|------------------|-------------------|
| Extensions | Your personal ones | Only automation extensions |
| Cookies | Personal logins | Isolated session state |
| Security | Shared with daily browsing | Locked down, audited |
| Cleanup | Manual | Automatic session timeout |

## Chrome Profile Support

Browser Secure can use your existing Chrome profiles, giving you access to saved cookies, session state, and existing website logins.

### List Available Profiles
```bash
browser-secure navigate https://example.com --list-profiles
```

Output:
```
📋 Available Chrome profiles:

  1. Person 1 ★
     ID: Default
     Path: /Users/river/Library/Application Support/Google/Chrome/Default

  2. Work
     ID: Profile 1
     Path: /Users/river/Library/Application Support/Google/Chrome/Profile 1
```

### Use a Specific Profile
```bash
# By profile ID
browser-secure navigate https://gmail.com --profile "Default"
browser-secure navigate https://gmail.com --profile "Profile 1"

# Interactively select
browser-secure navigate https://gmail.com --profile select
```

### Profile vs Incognito Mode

| Mode | Cookies | Logins | Extensions | Use Case |
|------|---------|--------|------------|----------|
| **Incognito (default)** | ❌ None | ❌ None | ❌ None | Secure, isolated testing |
| **Chrome Profile** | ✅ Yes | ✅ Yes | ✅ Yes | Access existing sessions |

**Security Note**: Profile data is read-only; Browser Secure won't modify your Chrome profile.

## Setup

### Option 1: Install via Clawdbot (Recommended)

The easiest way—just ask Clawdbot:

```
Hey Clawdbot, install browser-secure for me
```

Clawdbot will handle everything: check prerequisites, auto-install dependencies, build, and configure.

### Option 2: Install from GitHub

```bash
# Clone and install
curl -fsSL https://raw.githubusercontent.com/openclaw/openclaw/main/scripts/install-browser-secure.sh | bash
```

### Option 3: Manual Setup (Advanced)

If you prefer full control or are developing on the tool:

```bash
# Clone the repository
git clone https://github.com/openclaw/openclaw.git
cd openclaw/skills/browser-secure

# Run interactive setup
npm run setup
```

This will:
1. ✅ Check prerequisites (Node.js 18+, Chrome)
2. 📦 **Auto-install missing dependencies** (Playwright browsers, optional vault CLIs)
3. 🔨 Build and link the CLI globally
4. 📝 Create default configuration

### What Gets Auto-Installed

The setup automatically handles:
- **Playwright Chromium** - Required browser binary (~50MB)
- **Bitwarden CLI** - If `brew` is available (recommended vault)
- **1Password CLI** - If `brew` is available (optional)

### Configure Vault (Optional)

After setup, configure your preferred vault:

```bash
# Bitwarden (recommended - free)
brew install bitwarden-cli  # if not auto-installed
bw login
export BW_SESSION=$(bw unlock --raw)

# 1Password (if you have a subscription)
brew install 1password-cli  # if not auto-installed
op signin

# Test vault access
browser-secure vault --list
```

### Verify Installation

```bash
browser-secure --version
browser-secure navigate https://example.com
browser-secure screenshot
browser-secure close
```

## Vault Providers

### Bitwarden (Default, Free) ⭐

**Recommended** — free for personal use, open source, cross-platform.

```bash
# Install
brew install bitwarden-cli

# Login
bw login
export BW_SESSION=$(bw unlock --raw)

# Use
browser-secure navigate https://app.neilpatel.com/ --auto-vault
```

### 1Password (Paid)

**Alternative** — if you already have a 1Password subscription.

```bash
# Install
brew install 1password-cli

# Login
op signin
eval $(op signin)

# Use
browser-secure navigate https://app.neilpatel.com/ --auto-vault
```

### macOS Keychain (Local)

**Fallback** — store credentials in macOS Keychain (no cloud sync).

### Environment Variables

**Emergency fallback** — set credentials via env vars:

```bash
export BROWSER_SECURE_NEILPATEL_USERNAME="user@example.com"
export BROWSER_SECURE_NEILPATEL_PASSWORD="secret"
browser-secure navigate https://app.neilpatel.com/
```

## Commands

| Command | Description |
|---------|-------------|
| `navigate <url>` | Open URL, optionally authenticate |
| `navigate <url> --profile <id>` | Use specific Chrome profile |
| `navigate <url> --profile select` | Interactively choose Chrome profile |
| `navigate <url> --list-profiles` | List available Chrome profiles |
| `navigate <url> --auto-vault` | Auto-discover credentials (Bitwarden → 1Password → manual) |
| `navigate <url> --site=<name>` | Use pre-configured site credentials |
| `profile --create <name>` | Create new Chrome profile with welcome page |
| `profile --create <name> --launch` | Create profile and launch Chrome |
| `profile --list` | List all Chrome profiles |
| `act "<instruction>"` | Natural language action |
| `extract "<instruction>"` | Extract data from page |
| `screenshot` | Take screenshot |
| `close` | Close browser and cleanup |
| `status` | Show session status |
| `audit` | View audit logs |

## Security Features

### Vault Integration
- **Bitwarden** ⭐ (default, free)
- **1Password** (paid alternative)
- **macOS Keychain** (local)
- **Environment variables** (fallback)

### Approval Gates

| Tier | Actions | Approval |
|------|---------|----------|
| Read-only | navigate, screenshot, extract | None |
| Form fill | type, select, click | Prompt |
| Authentication | fill_password, submit_login | Always |
| Destructive | delete, purchase | 2FA |

### Session Security
- Time-bounded (30 min default, auto-expiry)
- Isolated work directories (UUID-based)
- **Incognito mode** (no persistent profile) — default
- **Chrome profile support** (your cookies, logins, extensions) — opt-in via `--profile`
- Secure cleanup (overwrite + delete)
- Network restrictions (block localhost/private IPs)

### Audit Trail

```json
{
  "event": "BROWSER_SECURE_SESSION",
  "sessionId": "bs-20260211054500-abc123",
  "site": "nytimes.com",
  "actions": [...],
  "chainHash": "sha256:..."
}
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `BROWSER_SECURE_CONFIG` | Config file path |
| `BW_SESSION` | Bitwarden session token |
| `OP_SERVICE_ACCOUNT_TOKEN` | 1Password service account |
| `BROWSER_SECURE_{SITE}_PASSWORD` | Env-based credentials |

## Comparison with browser-automation

| Feature | browser-automation | browser-secure |
|---------|-------------------|----------------|
| Credentials | CLI (exposed) | Vault-backed |
| Chrome Profiles | ❌ No | ✅ Yes (with cookies/logins) |
| Approval | None | Tiered gates |
| Audit | None | Full trail |
| Session timeout | None | 30 min default |
| Network | Unrestricted | Allow-list |
| Best for | Quick tasks | Sensitive/authenticated |

## Troubleshooting

**Chrome keychain prompt on first run**: This is normal! When Playwright launches Chrome for the first time, macOS asks if Chrome can access your keychain. You can click "Deny" since browser-secure manages credentials through your vault, not Chrome's built-in storage.

**Vault not found**: Install the CLI for your preferred vault:
- Bitwarden: `brew install bitwarden-cli`
- 1Password: `brew install 1password-cli`

**Bitwarden "Vault is locked"**: Run `export BW_SESSION=$(bw unlock --raw)`

**Site not configured**: Use `--auto-vault` for interactive setup, or add manually to `~/.browser-secure/config.yaml`

**Session expired**: Default 30-minute TTL, restart with `--timeout`

**Approval required**: Use `-y` for non-interactive (careful!)

**Profile not found**: Run `browser-secure navigate https://example.com --list-profiles` to see available profiles

**Chrome profile in use**: Close Chrome before using `--profile` option (Chrome locks profile when running)
