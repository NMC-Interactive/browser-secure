#!/usr/bin/env node

import { Command } from 'commander';
import { spawn } from 'child_process';
import {
  startBrowser,
  performAction,
  extractData,
  closeBrowser,
  getBrowserStatus,
  suspendSession,
  resumeSession
} from './browser/secure-session.js';
import { readAuditLog, rotateAuditLog } from './security/audit.js';
import { loadConfig, saveConfig, getConfigPath, checkCredentialSource } from './config/loader.js';
import { listAvailableVaults, getSiteCredentials } from './vault/index.js';
import { clearCredentialCache } from './security/approval.js';
import { listChromeProfiles, promptProfileSelection, getProfileById, createChromeProfile } from './browser/chrome-profiles.js';

const program = new Command();

program
  .name('browser-secure')
  .description('Secure browser automation with vault integration')
  .version('1.0.0');

// Navigate command
program
  .command('navigate <url>')
  .description('Navigate to a URL')
  .option('-s, --site <site>', 'Site configuration for authentication')
  .option('--auto-vault', 'Auto-discover credentials from vault (interactive)')
  .option('--headless', 'Run in headless mode')
  .option('-t, --timeout <seconds>', 'Session timeout in seconds', '1800')
  .option('--unattended', 'Run in unattended mode (skips all prompts)')
  .option('--credential-source <source>', 'Credential source for unattended mode (env|vault|cache)', 'vault')
  .option('-p, --profile <profile>', 'Chrome profile to use (id or "select" to choose interactively)')
  .option('--list-profiles', 'List available Chrome profiles and exit')
  .action(async (url, options) => {
    try {
      // Handle --list-profiles
      if (options.listProfiles) {
        const profiles = listChromeProfiles();
        console.log('\n📋 Available Chrome profiles:\n');
        profiles.forEach((profile, index) => {
          const marker = profile.id === 'Default' ? ' ★' : '';
          console.log(`  ${index + 1}. ${profile.name}${marker}`);
          console.log(`     ID: ${profile.id}`);
          console.log(`     Path: ${profile.path}`);
          console.log('');
        });
        process.exit(0);
      }

      // Validate credential source
      const credentialSource = options.credentialSource;
      if (!['env', 'vault', 'cache'].includes(credentialSource)) {
        console.error(`Error: Invalid credential source "${credentialSource}". Must be one of: env, vault, cache`);
        process.exit(1);
      }

      // In unattended mode, credential source is required
      if (options.unattended) {
        const sourceCheck = checkCredentialSource(credentialSource);
        if (!sourceCheck.valid) {
          console.error(`Error: ${sourceCheck.error}`);
          process.exit(1);
        }
      }

      // Handle profile selection
      let selectedProfile = null;
      if (options.profile) {
        if (options.profile === 'select') {
          selectedProfile = await promptProfileSelection();
        } else {
          selectedProfile = getProfileById(options.profile);
          if (selectedProfile) {
            console.log(`✅ Using profile: ${selectedProfile.name} [${selectedProfile.id}]`);
          } else {
            console.log(`⚠️  Profile "${options.profile}" not found, using incognito mode`);
            console.log('   Run with --list-profiles to see available profiles');
          }
        }
      }

      await startBrowser(url, {
        site: options.site,
        autoVault: options.autoVault,
        headless: options.headless,
        timeout: parseInt(options.timeout) * 1000,
        profile: selectedProfile || undefined,
        unattended: options.unattended ? {
          enabled: true,
          credentialSource: credentialSource
        } : undefined
      });
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Act command
program
  .command('act <instruction>')
  .description('Perform a natural language action')
  .option('-y, --yes', 'Auto-approve without prompting')
  .option('--unattended', 'Run in unattended mode')
  .action(async (instruction, options) => {
    try {
      await performAction(instruction, {
        autoApprove: options.yes,
        unattended: options.unattended ? {
          enabled: true,
          credentialSource: 'vault'
        } : undefined
      });
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Extract command
program
  .command('extract <instruction>')
  .description('Extract data from the page')
  .option('-s, --schema <json>', 'JSON schema for extraction')
  .action(async (instruction, options) => {
    try {
      const schema = options.schema ? JSON.parse(options.schema) : undefined;
      const result = await extractData(instruction, schema);
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Screenshot command
program
  .command('screenshot')
  .description('Take a screenshot of the current page')
  .action(async () => {
    try {
      const { takeScreenshot } = await import('./browser/secure-session.js');
      const path = await takeScreenshot('manual');
      if (path) {
        console.log(`Screenshot saved: ${path}`);
      }
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Close command
program
  .command('close')
  .description('Close the browser and clean up')
  .action(async () => {
    try {
      await closeBrowser();
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Suspend command
program
  .command('suspend')
  .description('Suspend the current session (pause timeout)')
  .action(() => {
    try {
      suspendSession();
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Resume command
program
  .command('resume')
  .description('Resume the current session (continue timeout)')
  .action(() => {
    try {
      resumeSession();
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show current session status')
  .action(() => {
    const status = getBrowserStatus();
    if (status.active) {
      console.log('Session: ACTIVE');
      console.log(`  ID: ${status.sessionId}`);
      console.log(`  Site: ${status.site || 'N/A'}`);
      console.log(`  Time remaining: ${status.timeRemaining}s`);
      console.log(`  Actions: ${status.actionCount}`);
      console.log(`  Suspended: ${status.suspended ? 'Yes' : 'No'}`);
    } else {
      console.log('Session: INACTIVE');
    }
  });

// Audit command
program
  .command('audit')
  .description('View audit logs')
  .option('-s, --session <id>', 'Show specific session')
  .option('--tail <n>', 'Show last N sessions', '10')
  .action((options) => {
    try {
      const sessions = readAuditLog(options.session);
      const tail = parseInt(options.tail);

      const display = sessions.slice(-tail);

      for (const session of display) {
        console.log('\n' + '='.repeat(60));
        console.log(`Session: ${session.sessionId}`);
        console.log(`Time: ${session.timestamp}`);
        console.log(`Site: ${session.site || 'N/A'}`);
        console.log(`Duration: ${session.session.duration}s`);
        console.log(`Actions: ${session.actions.length}`);
        console.log(`Chain Hash: ${session.chainHash.slice(0, 16)}...`);

        if (session.actions.length > 0) {
          console.log('\n  Actions:');
          for (const action of session.actions) {
            console.log(`    - ${action.action} (${action.timestamp})`);
          }
        }
      }
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Config command
program
  .command('config')
  .description('Show or edit configuration')
  .option('--path', 'Show config file path')
  .option('--edit', 'Open config in editor')
  .action((options) => {
    if (options.path) {
      console.log(getConfigPath());
      return;
    }

    if (options.edit) {
      const editor = process.env.EDITOR || 'nano';
      const child = spawn(editor, [getConfigPath()], { stdio: 'inherit' });
      child.on('close', (code) => {
        process.exit(code || 0);
      });
      return;
    }

    const config = loadConfig();
    console.log('Current Configuration:');
    console.log(JSON.stringify(config, null, 2));
  });

// Vault command
program
  .command('vault')
  .description('Vault management')
  .option('-l, --list', 'List available vaults')
  .option('-t, --test <site>', 'Test vault credentials for a site')
  .action(async (options) => {
    if (options.list) {
      const vaults = listAvailableVaults();
      console.log('Available vaults:');
      for (const vault of vaults) {
        console.log(`  - ${vault}`);
      }
      return;
    }

    if (options.test) {
      try {
        const creds = await getSiteCredentials(options.test);
        console.log(`Credentials for ${options.test}:`);
        console.log(`  Username: ${creds.username ? '***' : 'N/A'}`);
        console.log(`  Password: ${creds.password ? '***' : 'N/A'}`);
        console.log(`  Token: ${creds.token ? '***' : 'N/A'}`);
      } catch (e) {
        console.error(`Failed to get credentials: ${e}`);
        process.exit(1);
      }
      return;
    }

    console.log('Use --list or --test <site>');
  });

// Cache command
program
  .command('cache')
  .description('Credential cache management')
  .option('-c, --clear', 'Clear the credential cache')
  .option('-s, --status', 'Show cache status')
  .action((options) => {
    if (options.clear) {
      clearCredentialCache();
      console.log('Credential cache cleared.');
      return;
    }

    if (options.status) {
      const config = loadConfig();
      console.log('Credential Cache Status:');
      console.log(`  Cache duration: ${config.security.session.credentialCacheMinutes} minutes`);
      console.log(`  Encryption: AES-256-GCM`);
      console.log(`  Cache directory: ~/.browser-secure/cache/`);
      return;
    }

    console.log('Use --clear to clear cache or --status to show cache info');
  });

// Profile command
program
  .command('profile')
  .description('Chrome profile management')
  .option('-l, --list', 'List available Chrome profiles')
  .option('-c, --create <name>', 'Create a new Chrome profile with welcome page')
  .option('--launch', 'Launch Chrome with the profile after creation')
  .action(async (options) => {
    if (options.list) {
      const profiles = listChromeProfiles();
      console.log('\n📋 Available Chrome profiles:\n');
      profiles.forEach((profile, index) => {
        const marker = profile.id === 'Default' ? ' ★' : '';
        console.log(`  ${index + 1}. ${profile.name}${marker}`);
        console.log(`     ID: ${profile.id}`);
        console.log(`     Path: ${profile.path}`);
        console.log('');
      });
      return;
    }

    if (options.create) {
      try {
        const profileName = options.create;
        console.log(`\n🔧 Creating Chrome profile: "${profileName}"...\n`);
        
        const profile = createChromeProfile(profileName);
        
        console.log('✅ Profile created successfully!\n');
        console.log(`   Name: ${profile.name}`);
        console.log(`   ID: ${profile.id}`);
        console.log(`   Path: ${profile.path}`);
        console.log(`   Welcome page: ${profile.welcomePage}`);
        console.log('\n📋 Next steps:');
        console.log('   1. Chrome will open with a welcome page');
        console.log('   2. Install the Bitwarden extension');
        console.log('   3. Install the OpenClaw Browser Relay extension');
        console.log('   4. Log in to your password vault');
        console.log('\n   Use this profile: browser-secure navigate <url> --profile "' + profile.id + '"');
        
        if (options.launch) {
          console.log('\n🚀 Launching Chrome...\n');
          const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
          const child = spawn(chromePath, [`--profile-directory=${profile.id}`], {
            detached: true,
            stdio: 'ignore'
          });
          child.unref();
        }
      } catch (e) {
        console.error(`Error creating profile: ${e}`);
        process.exit(1);
      }
      return;
    }

    console.log('Use --list to list profiles or --create <name> to create a new profile');
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up old audit logs and temporary files')
  .option('-d, --days <n>', 'Retention days', '30')
  .action((options) => {
    try {
      rotateAuditLog(parseInt(options.days));
      console.log(`Audit logs rotated (retention: ${options.days} days)`);
    } catch (e) {
      console.error(`Error: ${e}`);
      process.exit(1);
    }
  });

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, cleaning up...');
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});

program.parse();
