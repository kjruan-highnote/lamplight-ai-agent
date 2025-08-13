#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as yaml from 'js-yaml';
import { PostmanToYamlConverter } from '../converters/PostmanToYamlConverter';

const program = new Command();

program
  .name('postman-convert')
  .description('Convert Postman collections to consistent YAML program configurations')
  .version('1.0.0');

program
  .command('convert')
  .description('Convert a single Postman collection to YAML')
  .requiredOption('-i, --input <path>', 'Path to Postman collection JSON')
  .requiredOption('-p, --program <type>', 'Program type (e.g., ap_automation, consumer_credit)')
  .option('-o, --output <path>', 'Output YAML file path')
  .option('-v, --vendor <name>', 'Vendor name', 'highnote')
  .action(async (options) => {
    try {
      // Validate input file exists
      if (!fs.existsSync(options.input)) {
        console.error(chalk.red(`❌ Input file not found: ${options.input}`));
        process.exit(1);
      }

      // Determine output path
      const outputPath = options.output || 
        path.join(
          path.dirname(options.input),
          `${options.program}.yaml`
        );

      console.log(chalk.cyan('🔄 Converting Postman collection to YAML...'));
      console.log(chalk.gray(`  Input: ${options.input}`));
      console.log(chalk.gray(`  Program: ${options.program}`));
      console.log(chalk.gray(`  Vendor: ${options.vendor}`));
      console.log(chalk.gray(`  Output: ${outputPath}`));

      const converter = new PostmanToYamlConverter(
        options.input,
        options.program,
        options.vendor
      );

      converter.saveToYaml(outputPath);
      
      console.log(chalk.green(`✅ Successfully converted to ${outputPath}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Convert multiple Postman collections in a directory')
  .requiredOption('-d, --directory <path>', 'Directory containing Postman collections')
  .option('-o, --output-dir <path>', 'Output directory for YAML files')
  .option('-v, --vendor <name>', 'Vendor name', 'highnote')
  .action(async (options) => {
    try {
      const inputDir = options.directory;
      const outputDir = options.outputDir || path.join(inputDir, '../programs');

      // Create output directory if it doesn't exist
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Find all Postman collection files
      const files = fs.readdirSync(inputDir)
        .filter(file => file.endsWith('.postman_collection.json'));

      if (files.length === 0) {
        console.log(chalk.yellow('⚠️  No Postman collections found in directory'));
        return;
      }

      console.log(chalk.cyan(`🔄 Converting ${files.length} collections...`));

      for (const file of files) {
        const inputPath = path.join(inputDir, file);
        
        // Derive program type from filename
        const programType = deriveProgramType(file);
        const outputPath = path.join(outputDir, `${programType}.yaml`);

        console.log(chalk.gray(`  Converting ${file} -> ${programType}.yaml`));

        try {
          const converter = new PostmanToYamlConverter(
            inputPath,
            programType,
            options.vendor
          );
          converter.saveToYaml(outputPath);
          console.log(chalk.green(`    ✅ ${programType}.yaml`));
        } catch (error) {
          console.log(chalk.red(`    ❌ Failed: ${error}`));
        }
      }

      console.log(chalk.green('✅ Batch conversion complete'));
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error);
      process.exit(1);
    }
  });

program
  .command('refresh')
  .description('Refresh existing YAML configs from updated Postman collections')
  .requiredOption('-d, --directory <path>', 'Directory containing Postman collections')
  .option('-p, --programs-dir <path>', 'Directory containing existing YAML programs', '../data/programs')
  .option('--backup', 'Create backups of existing YAML files', true)
  .action(async (options) => {
    try {
      const inputDir = options.directory;
      const programsDir = options.programsDir;

      // Create backup directory if needed
      const backupDir = path.join(programsDir, 'backups', new Date().toISOString().split('T')[0]);
      if (options.backup && !fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      // Find all Postman collection files
      const files = fs.readdirSync(inputDir)
        .filter(file => file.endsWith('.postman_collection.json'));

      console.log(chalk.cyan(`🔄 Refreshing ${files.length} program configurations...`));

      for (const file of files) {
        const inputPath = path.join(inputDir, file);
        const programType = deriveProgramType(file);
        const yamlPath = path.join(programsDir, `${programType}.yaml`);

        // Backup existing file if it exists
        if (options.backup && fs.existsSync(yamlPath)) {
          const backupPath = path.join(backupDir, `${programType}.yaml`);
          fs.copyFileSync(yamlPath, backupPath);
          console.log(chalk.gray(`  📦 Backed up ${programType}.yaml`));
        }

        // Convert and save
        console.log(chalk.gray(`  🔄 Refreshing ${programType}.yaml`));
        
        try {
          const converter = new PostmanToYamlConverter(inputPath, programType, 'highnote');
          converter.saveToYaml(yamlPath);
          console.log(chalk.green(`    ✅ Updated ${programType}.yaml`));
        } catch (error) {
          console.log(chalk.red(`    ❌ Failed: ${error}`));
        }
      }

      console.log(chalk.green('✅ Refresh complete'));
      if (options.backup) {
        console.log(chalk.gray(`📦 Backups saved to: ${backupDir}`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate YAML program configuration')
  .requiredOption('-f, --file <path>', 'Path to YAML file to validate')
  .action(async (options) => {
    try {
      const content = fs.readFileSync(options.file, 'utf-8');
      const config = yaml.load(content);

      console.log(chalk.cyan('🔍 Validating YAML configuration...'));
      
      // Check required fields
      const required = ['program_type', 'vendor', 'version', 'api_type', 'metadata', 'categories'];
      const missing = required.filter(field => !config[field]);
      
      if (missing.length > 0) {
        console.error(chalk.red(`❌ Missing required fields: ${missing.join(', ')}`));
        process.exit(1);
      }

      // Check metadata
      const metadataRequired = ['name', 'description', 'base_url', 'authentication'];
      const metadataMissing = metadataRequired.filter(field => !config.metadata[field]);
      
      if (metadataMissing.length > 0) {
        console.error(chalk.red(`❌ Missing metadata fields: ${metadataMissing.join(', ')}`));
        process.exit(1);
      }

      // Count operations
      const totalOps = config.categories.reduce((sum: number, cat: any) => 
        sum + (cat.operations?.length || 0), 0);

      console.log(chalk.green('✅ Valid YAML configuration'));
      console.log(chalk.gray(`  Program: ${config.program_type}`));
      console.log(chalk.gray(`  Categories: ${config.categories.length}`));
      console.log(chalk.gray(`  Total Operations: ${totalOps}`));
      console.log(chalk.gray(`  Capabilities: ${config.capabilities?.length || 0}`));
      console.log(chalk.gray(`  Workflows: ${config.workflows?.length || 0}`));
    } catch (error) {
      console.error(chalk.red('❌ Invalid YAML:'), error);
      process.exit(1);
    }
  });

// Helper function to derive program type from filename
function deriveProgramType(filename: string): string {
  const name = filename
    .replace('.postman_collection.json', '')
    .replace('.json', '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '_');

  // Map common names
  const mappings: Record<string, string> = {
    'triplink': 'ap_automation',
    'trip_com': 'ap_automation',
    'consumer_credit': 'consumer_credit',
    'consumer_prepaid': 'consumer_prepaid',
    'commercial_credit': 'commercial_credit',
    'commercial_prepaid': 'commercial_prepaid',
    'consumer_charge': 'consumer_charge',
    'commercial_charge': 'commercial_charge'
  };

  return mappings[name] || name;
}

program.parse(process.argv);