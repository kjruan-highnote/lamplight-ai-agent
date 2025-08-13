import * as fs from 'fs';
import * as path from 'path';
import { CronJob } from 'cron';
import { PostmanApiClient } from './PostmanApiClient';
import { OperationsExtractor } from './OperationsExtractor';
import { PostmanToYamlConverter } from '../converters/PostmanToYamlConverter';
import chalk from 'chalk';

export interface AutomationConfig {
  postman: {
    apiKey: string;
    workspaceId: string;
  };
  paths: {
    collectionsDir: string;
    operationsDir: string;
    programsDir: string;
    backupsDir: string;
  };
  schedule?: {
    enabled: boolean;
    cronPattern: string;  // e.g., "0 0 * * *" for daily at midnight
    timezone?: string;
  };
  options: {
    autoBackup: boolean;
    autoMerge: boolean;
    generateReports: boolean;
    notifyOnChanges: boolean;
  };
  programMappings?: Record<string, string>;  // collection name -> program type
}

export class PostmanSyncAutomation {
  private config: AutomationConfig;
  private postmanClient: PostmanApiClient;
  private extractor: OperationsExtractor;
  private cronJob?: CronJob;
  private lastSyncTime?: Date;

  constructor(config: AutomationConfig) {
    this.config = config;
    this.postmanClient = new PostmanApiClient(
      config.postman.apiKey,
      config.postman.workspaceId
    );
    this.extractor = new OperationsExtractor(config.paths.operationsDir);
    
    // Create directories if they don't exist
    this.ensureDirectories();
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectories(): void {
    const dirs = [
      this.config.paths.collectionsDir,
      this.config.paths.operationsDir,
      this.config.paths.programsDir,
      this.config.paths.backupsDir,
      path.join(this.config.paths.backupsDir, 'collections'),
      path.join(this.config.paths.backupsDir, 'programs'),
      path.join(this.config.paths.backupsDir, 'operations')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Run the full sync process
   */
  async runSync(): Promise<void> {
    console.log(chalk.cyan('\n========================================'));
    console.log(chalk.cyan('  Postman Collections Sync & Update'));
    console.log(chalk.cyan('========================================\n'));
    
    const startTime = Date.now();
    const report = {
      timestamp: new Date().toISOString(),
      collectionsProcessed: 0,
      operationsExtracted: 0,
      programsUpdated: 0,
      errors: [] as string[],
      changes: [] as string[]
    };

    try {
      // Step 1: Download all collections
      console.log(chalk.blue('Step 1: Downloading collections from Postman...'));
      const collections = await this.downloadCollections();
      report.collectionsProcessed = collections.size;
      
      // Step 2: Extract operations from each collection
      console.log(chalk.blue('\nStep 2: Extracting operations...'));
      const operationMappings = await this.extractOperations(collections);
      report.operationsExtracted = operationMappings.reduce((sum, m) => sum + m.operations.length, 0);
      
      // Step 3: Update program YAML files
      console.log(chalk.blue('\nStep 3: Updating program configurations...'));
      const updatedPrograms = await this.updatePrograms(operationMappings);
      report.programsUpdated = updatedPrograms.length;
      
      // Step 4: Generate reports
      if (this.config.options.generateReports) {
        console.log(chalk.blue('\nStep 4: Generating reports...'));
        await this.generateReports(report);
      }
      
      // Update last sync time
      this.lastSyncTime = new Date();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(chalk.green(`\n✅ Sync completed successfully in ${duration}s`));
      console.log(chalk.gray(`  Collections: ${report.collectionsProcessed}`));
      console.log(chalk.gray(`  Operations: ${report.operationsExtracted}`));
      console.log(chalk.gray(`  Programs Updated: ${report.programsUpdated}`));
      
    } catch (error) {
      console.error(chalk.red('\n❌ Sync failed:'), error);
      report.errors.push(String(error));
      throw error;
    }
  }

  /**
   * Download all collections from Postman
   */
  private async downloadCollections(): Promise<Map<string, string>> {
    // Backup existing collections if enabled
    if (this.config.options.autoBackup) {
      this.backupDirectory(
        this.config.paths.collectionsDir,
        path.join(this.config.paths.backupsDir, 'collections')
      );
    }

    // Download collections
    const collections = await this.postmanClient.downloadAllCollections(
      this.config.paths.collectionsDir,
      this.config.postman.workspaceId
    );

    console.log(chalk.green(`  ✓ Downloaded ${collections.size} collections`));
    return collections;
  }

  /**
   * Extract operations from collections
   */
  private async extractOperations(collections: Map<string, string>): Promise<any[]> {
    const mappings = [];
    
    for (const [name, filepath] of collections) {
      try {
        console.log(chalk.gray(`  Extracting from ${name}...`));
        const mapping = this.extractor.extractFromCollection(filepath);
        
        // Save extracted operations
        const outputPath = path.join(
          this.config.paths.operationsDir,
          `${mapping.programType}_operations.json`
        );
        this.extractor.saveOperations(mapping, outputPath);
        
        mappings.push(mapping);
        console.log(chalk.green(`    ✓ Extracted ${mapping.operations.length} operations`));
      } catch (error) {
        console.error(chalk.red(`    ✗ Failed to extract from ${name}:`), error);
      }
    }
    
    return mappings;
  }

  /**
   * Update program YAML files
   */
  private async updatePrograms(operationMappings: any[]): Promise<string[]> {
    const updatedPrograms: string[] = [];
    
    // Backup programs if enabled
    if (this.config.options.autoBackup) {
      this.backupDirectory(
        this.config.paths.programsDir,
        path.join(this.config.paths.backupsDir, 'programs')
      );
    }

    for (const mapping of operationMappings) {
      try {
        const programType = this.config.programMappings?.[mapping.collectionName] || mapping.programType;
        const programPath = path.join(this.config.paths.programsDir, `${programType}.yaml`);
        
        if (fs.existsSync(programPath)) {
          // Update existing program
          console.log(chalk.gray(`  Updating ${programType}.yaml...`));
          
          if (this.config.options.autoMerge) {
            this.extractor.mergeWithProgram(mapping, programPath);
          } else {
            // Just convert and save new version
            const collectionPath = path.join(
              this.config.paths.collectionsDir,
              `${mapping.collectionName.replace(/[^a-z0-9]/gi, '_')}.postman_collection.json`
            );
            
            const converter = new PostmanToYamlConverter(collectionPath, programType, 'Highnote Inc.');
            converter.saveToYaml(programPath);
          }
          
          updatedPrograms.push(programType);
          console.log(chalk.green(`    ✓ Updated ${programType}.yaml`));
        } else {
          // Create new program
          console.log(chalk.yellow(`    ! Creating new program: ${programType}.yaml`));
          const collectionPath = path.join(
            this.config.paths.collectionsDir,
            `${mapping.collectionName.replace(/[^a-z0-9]/gi, '_')}.postman_collection.json`
          );
          
          const converter = new PostmanToYamlConverter(collectionPath, programType, 'Highnote Inc.');
          converter.saveToYaml(programPath);
          
          updatedPrograms.push(programType);
          console.log(chalk.green(`    ✓ Created ${programType}.yaml`));
        }
      } catch (error) {
        console.error(chalk.red(`    ✗ Failed to update program:`), error);
      }
    }
    
    return updatedPrograms;
  }

  /**
   * Generate sync reports
   */
  private async generateReports(report: any): Promise<void> {
    const reportsDir = path.join(this.config.paths.backupsDir, 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportPath = path.join(
      reportsDir,
      `sync_report_${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.green(`  ✓ Report saved to ${reportPath}`));
    
    // Generate markdown summary
    const summaryPath = path.join(reportsDir, 'latest_sync.md');
    const summary = this.generateMarkdownSummary(report);
    fs.writeFileSync(summaryPath, summary);
    console.log(chalk.green(`  ✓ Summary saved to ${summaryPath}`));
  }

  /**
   * Generate markdown summary of sync
   */
  private generateMarkdownSummary(report: any): string {
    return `# Postman Sync Report

## Summary
- **Date**: ${new Date(report.timestamp).toLocaleString()}
- **Collections Processed**: ${report.collectionsProcessed}
- **Operations Extracted**: ${report.operationsExtracted}
- **Programs Updated**: ${report.programsUpdated}

## Changes
${report.changes.map((c: string) => `- ${c}`).join('\n') || 'No changes detected'}

## Errors
${report.errors.map((e: string) => `- ${e}`).join('\n') || 'No errors'}

## Next Sync
${this.config.schedule?.enabled ? `Scheduled for: ${this.getNextScheduledTime()}` : 'Manual trigger only'}
`;
  }

  /**
   * Backup a directory
   */
  private backupDirectory(sourceDir: string, backupDir: string): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, timestamp);
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }

    // Copy all files
    const files = fs.readdirSync(sourceDir);
    files.forEach(file => {
      const sourcePath = path.join(sourceDir, file);
      const destPath = path.join(backupPath, file);
      
      if (fs.statSync(sourcePath).isFile()) {
        fs.copyFileSync(sourcePath, destPath);
      }
    });
    
    console.log(chalk.gray(`  Backed up to ${backupPath}`));
  }

  /**
   * Start scheduled sync
   */
  startScheduledSync(): void {
    if (!this.config.schedule?.enabled) {
      console.log(chalk.yellow('Scheduled sync is not enabled'));
      return;
    }

    const cronPattern = this.config.schedule.cronPattern;
    const timezone = this.config.schedule.timezone || 'America/Los_Angeles';
    
    this.cronJob = new CronJob(
      cronPattern,
      async () => {
        console.log(chalk.cyan(`\n[${new Date().toISOString()}] Running scheduled sync...`));
        try {
          await this.runSync();
        } catch (error) {
          console.error(chalk.red('Scheduled sync failed:'), error);
        }
      },
      null,
      true,
      timezone
    );
    
    console.log(chalk.green(`✅ Scheduled sync started`));
    console.log(chalk.gray(`  Pattern: ${cronPattern}`));
    console.log(chalk.gray(`  Timezone: ${timezone}`));
    console.log(chalk.gray(`  Next run: ${this.getNextScheduledTime()}`));
  }

  /**
   * Stop scheduled sync
   */
  stopScheduledSync(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log(chalk.yellow('Scheduled sync stopped'));
    }
  }

  /**
   * Get next scheduled sync time
   */
  private getNextScheduledTime(): string {
    if (this.cronJob) {
      const nextDate = this.cronJob.nextDates(1);
      return nextDate.toString();
    }
    return 'Not scheduled';
  }

  /**
   * Get sync status
   */
  getStatus(): any {
    return {
      scheduledSync: this.config.schedule?.enabled || false,
      nextSync: this.getNextScheduledTime(),
      lastSync: this.lastSyncTime?.toISOString() || 'Never',
      cronPattern: this.config.schedule?.cronPattern || 'Not configured'
    };
  }
}