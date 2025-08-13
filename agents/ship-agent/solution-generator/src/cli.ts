#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { fileURLToPath } from 'url';
import { SolutionGenerator } from './generators/SolutionGenerator.js';
import { HTMLExporter } from './exporters/HTMLExporter.js';
import { PDFExporter } from './exporters/PDFExporter.js';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const program = new Command();

// Get package.json version
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')
);

program
  .name('solution-generator')
  .description('Generate API integration solution documents')
  .version(packageJson.version);

program
  .command('generate')
  .description('Generate a solution document')
  .requiredOption('-p, --program <type>', 'Program type (e.g., ap_automation)')
  .requiredOption('-c, --customer <name>', 'Customer name (e.g., trip_com)')
  .option('-f, --format <format>', 'Output format (markdown, html, pdf)', 'markdown')
  .option('-o, --output <path>', 'Output directory')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting solution generation...'));
      
      const generator = new SolutionGenerator();
      const outputPath = await generator.generateSolution(
        options.program,
        options.customer
      );
      
      console.log(chalk.green(`✅ Solution generated: ${outputPath}`));
      
      // Export to additional formats if requested
      if (options.format !== 'markdown') {
        console.log(chalk.blue(`📄 Exporting to ${options.format}...`));
        
        if (options.format === 'html') {
          const htmlExporter = new HTMLExporter();
          const htmlPath = await htmlExporter.export(outputPath);
          console.log(chalk.green(`✅ HTML exported: ${htmlPath}`));
        } else if (options.format === 'pdf') {
          const pdfExporter = new PDFExporter();
          const pdfPath = await pdfExporter.export(outputPath);
          console.log(chalk.green(`✅ PDF exported: ${pdfPath}`));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('list-programs')
  .description('List available program types')
  .action(async () => {
    try {
      const generator = new SolutionGenerator();
      const programs = await generator.listPrograms();
      
      console.log(chalk.blue('\n📋 Available Programs:\n'));
      programs.forEach(p => console.log(`  • ${p}`));
      console.log();
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('list-customers')
  .description('List available customer contexts')
  .action(async () => {
    try {
      const generator = new SolutionGenerator();
      const customers = await generator.listCustomers();
      
      if (customers.length === 0) {
        console.log(chalk.yellow('\n⚠️  No customer contexts found\n'));
      } else {
        console.log(chalk.blue('\n📋 Available Customers:\n'));
        customers.forEach(c => console.log(`  • ${c}`));
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('template')
  .description('Generate a template for workflows')
  .requiredOption('-w, --workflow <name>', 'Workflow name')
  .option('-o, --output <path>', 'Output path')
  .action(async (options) => {
    try {
      console.log(chalk.blue('📝 Generating workflow template...'));
      
      const { DiagramGenerator } = await import('./generators/DiagramGenerator.js');
      const diagramGen = new DiagramGenerator();
      const template = diagramGen.generateMermaidTemplate(options.workflow);
      
      if (options.output) {
        await fs.writeFile(options.output, template);
        console.log(chalk.green(`✅ Template saved to: ${options.output}`));
      } else {
        console.log('\n' + template);
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .description('Run in interactive mode')
  .action(async () => {
    console.log(chalk.blue('\n🎯 Solution Generator - Interactive Mode\n'));
    console.log(chalk.yellow('This feature is coming soon!\n'));
    
    // TODO: Implement interactive prompts using inquirer
    console.log('For now, use: solution-generator generate -p <program> -c <customer>');
  });

// Feedback management
program
  .command('feedback')
  .description('Manage customer feedback and document iterations')
  .action(async () => {
    // Import and create feedback command dynamically
    const { createFeedbackCommand } = await import('./commands/feedback.js');
    const feedbackCmd = createFeedbackCommand();
    
    // Show feedback command help
    feedbackCmd.outputHelp();
  });

// Add feedback subcommands directly
const feedbackCmd = program
  .command('feedback-start')
  .description('Start a feedback session for a generated document')
  .requiredOption('-d, --document <path>', 'Path to the generated document')
  .requiredOption('-p, --program <type>', 'Program type (e.g., ap_automation)')
  .requiredOption('-c, --customer <name>', 'Customer name (e.g., trip_com)')
  .action(async (options) => {
    const { FeedbackWorkflow } = await import('./feedback/FeedbackWorkflow.js');
    const workflow = new FeedbackWorkflow();
    
    try {
      const sessionId = await workflow.startFeedbackSession(
        options.document,
        options.program,
        options.customer
      );
      console.log(chalk.green(`✅ Feedback session started: ${sessionId}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('feedback-process')
  .description('Process feedback from an edited document')
  .requiredOption('-s, --session <id>', 'Feedback session ID')
  .requiredOption('-d, --document <path>', 'Path to the edited document')
  .action(async (options) => {
    const { FeedbackWorkflow } = await import('./feedback/FeedbackWorkflow.js');
    const workflow = new FeedbackWorkflow();
    
    try {
      await workflow.processFeedback(options.session, options.document);
      console.log(chalk.green('✅ Feedback processed successfully'));
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program
  .command('feedback-analyze')
  .description('Analyze changes in an edited document')
  .requiredOption('-d, --document <path>', 'Path to the edited document')
  .action(async (options) => {
    const { FeedbackAnalyzer } = await import('./feedback/FeedbackAnalyzer.js');
    const analyzer = new FeedbackAnalyzer();
    
    try {
      const reportPath = await analyzer.generateDiffReport(options.document);
      console.log(chalk.green(`✅ Analysis complete: ${reportPath}`));
    } catch (error) {
      console.error(chalk.red('❌ Error:', error.message));
      process.exit(1);
    }
  });

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}