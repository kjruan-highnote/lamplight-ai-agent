import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import Handlebars from 'handlebars';
import { DiagramGenerator } from './DiagramGenerator.js';
import { TemplateEngine } from './TemplateEngine.js';
import type { ProgramConfig, CustomerContext, SolutionData } from '../types/index.js';

export class SolutionGenerator {
  private diagramGenerator: DiagramGenerator;
  private templateEngine: TemplateEngine;
  private dataPath: string;

  constructor(dataPath: string = '../data') {
    this.dataPath = path.resolve(dataPath);
    this.diagramGenerator = new DiagramGenerator();
    this.templateEngine = new TemplateEngine();
    this.registerHelpers();
  }

  private registerHelpers() {
    // Register Handlebars helpers
    Handlebars.registerHelper('formatDate', (date: Date) => {
      return new Date(date).toLocaleDateString();
    });

    Handlebars.registerHelper('capitalize', (str: string) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    });

    Handlebars.registerHelper('json', (context: any) => {
      return JSON.stringify(context, null, 2);
    });

    Handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    Handlebars.registerHelper('ne', (a: any, b: any) => {
      return a !== b;
    });

    Handlebars.registerHelper('lt', (a: any, b: any) => {
      return a < b;
    });

    Handlebars.registerHelper('gt', (a: any, b: any) => {
      return a > b;
    });

    Handlebars.registerHelper('lte', (a: any, b: any) => {
      return a <= b;
    });

    Handlebars.registerHelper('gte', (a: any, b: any) => {
      return a >= b;
    });

    Handlebars.registerHelper('and', (a: any, b: any) => {
      return a && b;
    });

    Handlebars.registerHelper('or', (a: any, b: any) => {
      return a || b;
    });

    Handlebars.registerHelper('not', (a: any) => {
      return !a;
    });

    Handlebars.registerHelper('add', (a: number, b: number) => {
      return a + b;
    });

    Handlebars.registerHelper('subtract', (a: number, b: number) => {
      return a - b;
    });
  }

  async generateSolution(programType: string, customerName: string): Promise<string> {
    console.log(`Generating solution for ${customerName} using ${programType} program...`);

    // Load program configuration
    const config = await this.loadProgramConfig(programType);
    
    // Load customer context
    const context = await this.loadCustomerContext(customerName);

    // Prepare solution data
    const solutionData: SolutionData = {
      program: config,
      customer: context,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        programType,
        customerName: context.customer?.name || customerName
      }
    };

    // Generate workflow diagrams and embed them
    if (config.workflows) {
      console.log('Generating workflow diagrams...');
      const diagrams = await this.diagramGenerator.generateWorkflowDiagrams(
        config.workflows,
        context.customer?.name || customerName,
        context.vendor?.name || 'Vendor'
      );
      
      // Create workflows array with embedded diagrams
      const workflowsWithDiagrams = Object.entries(config.workflows).map(([id, workflow]) => ({
        id,
        ...workflow,
        diagram: diagrams[id] || null
      }));
      
      solutionData.workflowsWithDiagrams = workflowsWithDiagrams;
      solutionData.diagrams = diagrams;
    }

    // Generate the solution document
    const document = await this.templateEngine.render('solution', solutionData);

    // Save the document
    const outputPath = await this.saveDocument(programType, customerName, document);
    
    console.log(`Solution generated successfully: ${outputPath}`);
    return outputPath;
  }

  private async loadProgramConfig(programType: string): Promise<ProgramConfig> {
    const configPath = path.join(this.dataPath, 'programs', `${programType}.yaml`);
    
    if (!await fs.pathExists(configPath)) {
      // Try with _generated suffix
      const generatedPath = path.join(this.dataPath, 'programs', `${programType}_generated.yaml`);
      if (await fs.pathExists(generatedPath)) {
        const content = await fs.readFile(generatedPath, 'utf-8');
        return yaml.parse(content);
      }
      throw new Error(`Program configuration not found: ${programType}`);
    }

    const content = await fs.readFile(configPath, 'utf-8');
    return yaml.parse(content);
  }

  private async loadCustomerContext(customerName: string): Promise<CustomerContext> {
    const contextPath = path.join(this.dataPath, 'contexts', `${customerName}.yaml`);
    
    if (!await fs.pathExists(contextPath)) {
      console.warn(`Customer context not found: ${customerName}, using defaults`);
      return {
        customer: {
          name: customerName,
          industry: 'Unknown'
        },
        vendor: {
          name: 'Highnote',
          type: 'Payment Platform'
        }
      };
    }

    const content = await fs.readFile(contextPath, 'utf-8');
    return yaml.parse(content);
  }

  private async saveDocument(programType: string, customerName: string, document: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '').split('T')[0];
    const outputDir = path.join(this.dataPath, 'generated', customerName.toLowerCase().replace(/\s+/g, '_'));
    
    await fs.ensureDir(outputDir);
    
    const filename = `${programType}_solution_${timestamp}.md`;
    const outputPath = path.join(outputDir, filename);
    
    await fs.writeFile(outputPath, document);
    
    return outputPath;
  }

  async listPrograms(): Promise<string[]> {
    const programsDir = path.join(this.dataPath, 'programs');
    const files = await fs.readdir(programsDir);
    
    return files
      .filter(f => f.endsWith('.yaml'))
      .map(f => f.replace(/(_generated)?\.yaml$/, ''))
      .filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
  }

  async listCustomers(): Promise<string[]> {
    const contextsDir = path.join(this.dataPath, 'contexts');
    
    if (!await fs.pathExists(contextsDir)) {
      return [];
    }
    
    const files = await fs.readdir(contextsDir);
    return files
      .filter(f => f.endsWith('.yaml'))
      .map(f => f.replace('.yaml', ''));
  }
}