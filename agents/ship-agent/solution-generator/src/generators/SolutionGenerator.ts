import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import Handlebars from 'handlebars';
import { DiagramGenerator } from './DiagramGenerator.js';
import { TemplateEngine } from './TemplateEngine.js';
import type { ProgramConfig, CustomerContext, SolutionData } from '../types/index.js';
import { 
  formatProgramName, 
  formatCapability, 
  formatVendorName, 
  formatApiType,
  formatCustomerName,
  formatOperationCategory,
  formatRateLimit,
  formatPerformanceMetric
} from '../utils/formatters.js';

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

    // Formatting helpers
    Handlebars.registerHelper('formatProgramName', (name: string) => {
      return formatProgramName(name);
    });

    Handlebars.registerHelper('formatCapability', (capability: string) => {
      return formatCapability(capability);
    });

    Handlebars.registerHelper('formatVendorName', (vendor: string) => {
      return formatVendorName(vendor);
    });

    Handlebars.registerHelper('formatApiType', (apiType: string) => {
      return formatApiType(apiType);
    });

    Handlebars.registerHelper('formatCustomerName', (customer: string) => {
      return formatCustomerName(customer);
    });

    Handlebars.registerHelper('formatOperationCategory', (category: string) => {
      return formatOperationCategory(category);
    });

    Handlebars.registerHelper('formatRateLimit', (value: any) => {
      return formatRateLimit(value);
    });

    // Comparison helpers
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

    // Logical helpers
    Handlebars.registerHelper('and', (a: any, b: any) => {
      return a && b;
    });

    Handlebars.registerHelper('or', (a: any, b: any) => {
      return a || b;
    });

    Handlebars.registerHelper('not', (a: any) => {
      return !a;
    });

    // Math helpers
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

    // Format the config data
    const formattedConfig = this.formatProgramConfig(config);
    
    // Prepare solution data
    const solutionData: SolutionData = {
      program: formattedConfig,
      customer: context,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        programType,
        customerName: formatCustomerName(context.customer?.name || customerName),
        formattedProgramName: formatProgramName(programType)
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
    // Try JSON first, then YAML
    const jsonPath = path.join(this.dataPath, 'contexts', `${customerName}.json`);
    const yamlPath = path.join(this.dataPath, 'contexts', `${customerName}.yaml`);
    
    // Check for JSON file
    if (await fs.pathExists(jsonPath)) {
      console.log(`Loading customer context from JSON: ${customerName}`);
      const content = await fs.readFile(jsonPath, 'utf-8');
      return JSON.parse(content);
    }
    
    // Check for YAML file
    if (await fs.pathExists(yamlPath)) {
      console.log(`Loading customer context from YAML: ${customerName}`);
      const content = await fs.readFile(yamlPath, 'utf-8');
      return yaml.parse(content);
    }
    
    // Also check for variations with underscores and _context suffix
    const alternativeNames = [
      `${customerName}_context`,
      `${customerName.replace(/_/g, '')}_context`,
      `${customerName}_context_v2`,
      `${customerName.replace(/_/g, '')}_context_v2`
    ];
    
    // Special handling for trip_com / triplink
    if (customerName === 'trip_com' || customerName === 'tripcom') {
      alternativeNames.push('triplink_context_v2', 'triplink_context', 'triplink');
    }
    
    for (const altName of alternativeNames) {
      const altJsonPath = path.join(this.dataPath, 'contexts', `${altName}.json`);
      const altYamlPath = path.join(this.dataPath, 'contexts', `${altName}.yaml`);
      
      if (await fs.pathExists(altJsonPath)) {
        console.log(`Loading customer context from JSON: ${altName}`);
        const content = await fs.readFile(altJsonPath, 'utf-8');
        return JSON.parse(content);
      }
      
      if (await fs.pathExists(altYamlPath)) {
        console.log(`Loading customer context from YAML: ${altName}`);
        const content = await fs.readFile(altYamlPath, 'utf-8');
        return yaml.parse(content);
      }
    }
    
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
    const customers = new Set<string>();
    
    files.forEach(f => {
      if (f.endsWith('.yaml') || f.endsWith('.json')) {
        // Extract customer name from various patterns
        let customerName = f.replace(/\.(yaml|json)$/, '');
        
        // Remove common suffixes
        customerName = customerName.replace(/_context(_v\d+)?$/, '');
        
        // Map specific customer names
        if (customerName === 'triplink' || customerName === 'trip_com') {
          customers.add('trip_com');
        } else {
          customers.add(customerName);
        }
      }
    });
    
    return Array.from(customers);
  }

  private formatProgramConfig(config: ProgramConfig): ProgramConfig {
    // Create a deep copy to avoid modifying original
    const formatted = JSON.parse(JSON.stringify(config));
    
    // Format vendor name
    if (formatted.vendor) {
      formatted.formattedVendor = formatVendorName(formatted.vendor);
    }
    
    // Format API type
    if (formatted.api_type) {
      formatted.formattedApiType = formatApiType(formatted.api_type);
    }
    
    // Format capabilities
    if (formatted.capabilities) {
      formatted.formattedCapabilities = formatted.capabilities.map((cap: string) => formatCapability(cap));
    }
    
    // Format operation categories
    if (formatted.operations) {
      formatted.formattedOperations = {};
      for (const [category, ops] of Object.entries(formatted.operations)) {
        const formattedCategory = formatOperationCategory(category);
        formatted.formattedOperations[formattedCategory] = ops;
      }
    }
    
    return formatted;
  }
}