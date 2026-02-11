# browser-secure: Bitwarden Default Update

## Summary

Updated browser-secure skill to use **Bitwarden as the default vault provider** instead of 1Password.

## Changes Made

### 1. Default Provider Changed
- **File**: `src/config/loader.ts`
- **Change**: Default `vault.provider` changed from `'1password'` to `'bitwarden'`

### 2. Bitwarden Discovery Added
- **File**: `src/vault/discovery.ts`
- **Added**:
  - `isBitwardenAvailable()` - Check if bw CLI is installed and vault is unlocked
  - `searchBitwardenItems(domain)` - Search Bitwarden vault for matching credentials
  - `interactiveBitwardenDiscovery(domain)` - Interactive credential selection from Bitwarden
  - Updated `interactiveCredentialDiscovery()` to try Bitwarden first, then 1Password as fallback

### 3. Documentation Updated
- **File**: `SKILL.md`
- **Changes**:
  - Bitwarden now featured as the recommended/default option
  - 1Password documented as an alternative
  - Added clear setup instructions for Bitwarden
  - Updated all examples to show Bitwarden first

## Why Bitwarden?

| Feature | Bitwarden | 1Password |
|---------|-----------|-----------|
| **Cost** | **Free** (personal use) | ~$3/mo |
| **CLI** | ✅ Available | ✅ Available |
| **Open Source** | ✅ Yes | ❌ No |
| **Cross-platform** | ✅ Yes | ✅ Yes |

## Usage

### First Time Setup

```bash
# Install Bitwarden CLI
brew install bitwarden-cli

# Login
bw login
export BW_SESSION=$(bw unlock --raw)
```

### Using browser-secure

```bash
# Auto-vault will now search Bitwarden first
browser-secure navigate https://app.neilpatel.com/ --auto-vault
```

## Fallback Behavior

If Bitwarden credentials aren't found:
1. Try 1Password (if available)
2. Offer manual credential entry
3. Skip authentication if user declines

## Backward Compatibility

- Existing 1Password users can still use `--auto-vault` 
- 1Password will be tried automatically if Bitwarden has no matches
- Config files with `provider: 1password` will continue to work
