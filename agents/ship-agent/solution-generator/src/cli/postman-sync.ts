#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { PostmanSyncAutomation, AutomationConfig } from '../postman/PostmanSyncAutomation';

const program = new Command();

// Default config paths
const CONFIG_FILE = path.join(process.cwd(), 'postman-sync-config.json');
const DEFAULT_CONFIG: AutomationConfig = {
  postman: {
    apiKey: process.env.POSTMAN_API_KEY || '',
    workspaceId: process.env.POSTMAN_WORKSPACE_ID || ''
  },
  paths: {
    collectionsDir: '../data/postman',
    operationsDir: '../data/operations',
    programsDir: '../data/programs',
    backupsDir: '../data/backups'
  },
  schedule: {
    enabled: false,
    cronPattern: '0 0 * * *',  // Daily at midnight
    timezone: 'America/Los_Angeles'
  },
  options: {
    autoBackup: true,
    autoMerge: true,
    generateReports: true,
    notifyOnChanges: false
  },
  programMappings: {
    'Trip.com': 'ap_automation',
    'TripLink': 'ap_automation',
    'Consumer Credit': 'consumer_credit',
    'Consumer Prepaid': 'consumer_prepaid',
    'Commercial Credit': 'commercial_credit',
    'Commercial Prepaid': 'commercial_prepaid'
  }
};

let automation: PostmanSyncAutomation | null = null;

program
  .name('postman-sync')
  .description('Sync Postman collections, extract operations, and update program YAMLs')
  .version('1.0.0');

// Initialize configuration
program
  .command('init')
  .description('Initialize configuration file')
  .action(async () => {
    console.log(chalk.cyan('🔧 Initializing Postman Sync Configuration\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'apiKey',
        message: 'Postman API Key:',
        default: process.env.POSTMAN_API_KEY || '',
        validate: (input) => input.length > 0 || 'API Key is required'
      },
      {
        type: 'input',
        name: 'workspaceId',
        message: 'Postman Workspace ID:',
        default: process.env.POSTMAN_WORKSPACE_ID || '',
        validate: (input) => input.length > 0 || 'Workspace ID is required'
      },
      {
        type: 'confirm',
        name: 'enableSchedule',
        message: 'Enable scheduled sync?',
        default: false
      }
    ]);

    const config: AutomationConfig = {
      ...DEFAULT_CONFIG,
      postman: {
        apiKey: answers.apiKey,
        workspaceId: answers.workspaceId
      }
    };

    if (answers.enableSchedule) {
      const scheduleAnswers = await inquirer.prompt([
        {
          type: 'list',
          name: 'frequency',
          message: 'Sync frequency:',
          choices: [
            { name: 'Every hour', value: '0 * * * *' },
            { name: 'Every 6 hours', value: '0 */6 * * *' },
            { name: 'Daily at midnight', value: '0 0 * * *' },
            { name: 'Weekly on Sunday', value: '0 0 * * 0' },
            { name: 'Custom', value: 'custom' }
          ]
        }
      ]);

      if (scheduleAnswers.frequency === 'custom') {
        const customAnswer = await inquirer.prompt([
          {
            type: 'input',
            name: 'cronPattern',
            message: 'Enter cron pattern:',
            default: '0 0 * * *'
          }
        ]);
        config.schedule!.cronPattern = customAnswer.cronPattern;
      } else {
        config.schedule!.cronPattern = scheduleAnswers.frequency;
      }
      
      config.schedule!.enabled = true;
    }

    // Save configuration
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green(`\n✅ Configuration saved to ${CONFIG_FILE}`));
    console.log(chalk.gray('\nYou can now run: postman-sync run'));
  });

// Run sync manually
program
  .command('run')
  .description('Run sync process manually')
  .option('-c, --config <path>', 'Path to config file', CONFIG_FILE)
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      automation = new PostmanSyncAutomation(config);
      await automation.runSync();
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Start scheduled sync
program
  .command('start')
  .description('Start scheduled sync')
  .option('-c, --config <path>', 'Path to config file', CONFIG_FILE)
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      
      if (!config.schedule?.enabled) {
        console.error(chalk.red('Scheduled sync is not enabled in configuration'));
        console.log(chalk.gray('Run "postman-sync init" to enable scheduling'));
        process.exit(1);
      }

      automation = new PostmanSyncAutomation(config);
      automation.startScheduledSync();
      
      console.log(chalk.cyan('\n📅 Scheduled sync is running'));
      console.log(chalk.gray('Press Ctrl+C to stop\n'));
      
      // Keep process alive
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\n\nStopping scheduled sync...'));
        automation?.stopScheduledSync();
        process.exit(0);
      });
      
      // Prevent process from exiting
      setInterval(() => {}, 1000);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Check status
program
  .command('status')
  .description('Check sync status')
  .option('-c, --config <path>', 'Path to config file', CONFIG_FILE)
  .action((options) => {
    try {
      const config = loadConfig(options.config);
      automation = new PostmanSyncAutomation(config);
      const status = automation.getStatus();
      
      console.log(chalk.cyan('\n📊 Postman Sync Status\n'));
      console.log(`Scheduled Sync: ${status.scheduledSync ? chalk.green('Enabled') : chalk.yellow('Disabled')}`);
      console.log(`Cron Pattern: ${chalk.gray(status.cronPattern)}`);
      console.log(`Last Sync: ${chalk.gray(status.lastSync)}`);
      console.log(`Next Sync: ${chalk.gray(status.nextSync)}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// List collections
program
  .command('list')
  .description('List all collections in workspace')
  .option('-c, --config <path>', 'Path to config file', CONFIG_FILE)
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const { PostmanApiClient } = await import('../postman/PostmanApiClient');
      
      const client = new PostmanApiClient(config.postman.apiKey, config.postman.workspaceId);
      const collections = await client.getCollections();
      
      console.log(chalk.cyan('\n📚 Collections in Workspace\n'));
      collections.forEach((collection, index) => {
        console.log(`${index + 1}. ${chalk.green(collection.name)}`);
        console.log(`   ID: ${chalk.gray(collection.uid)}`);
        console.log(`   Updated: ${chalk.gray(collection.updatedAt)}\n`);
      });
      
      console.log(chalk.gray(`Total: ${collections.length} collections`));
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Test extraction
program
  .command('test')
  .description('Test extraction on a single collection')
  .requiredOption('-f, --file <path>', 'Path to collection JSON file')
  .action(async (options) => {
    try {
      const { OperationsExtractor } = await import('../postman/OperationsExtractor');
      
      if (!fs.existsSync(options.file)) {
        console.error(chalk.red(`File not found: ${options.file}`));
        process.exit(1);
      }
      
      const extractor = new OperationsExtractor('../data/operations');
      const mapping = extractor.extractFromCollection(options.file);
      
      console.log(chalk.cyan('\n📋 Extraction Results\n'));
      console.log(`Collection: ${chalk.green(mapping.collectionName)}`);
      console.log(`Program Type: ${chalk.green(mapping.programType)}`);
      console.log(`Total Operations: ${chalk.green(mapping.operations.length)}`);
      console.log('\nCategories:');
      
      mapping.categories.forEach((ops, category) => {
        console.log(`  ${chalk.yellow(category)}: ${ops.length} operations`);
        ops.slice(0, 3).forEach(op => {
          console.log(`    - ${op.name} (${op.type}${op.required ? ', required' : ''})`);
        });
        if (ops.length > 3) {
          console.log(`    ... and ${ops.length - 3} more`);
        }
      });
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

// Helper function to load config
function loadConfig(configPath: string): AutomationConfig {
  if (!fs.existsSync(configPath)) {
    console.error(chalk.red(`Configuration file not found: ${configPath}`));
    console.log(chalk.gray('Run "postman-sync init" to create configuration'));
    process.exit(1);
  }
  
  const configContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent);
}

program.parse(process.argv);