import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: any;
}

interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  event?: any[];
}

interface PostmanRequest {
  method: string;
  header?: any[];
  body?: {
    mode: string;
    graphql?: {
      query: string;
      variables?: string;
    };
    raw?: string;
  };
  url: {
    raw: string;
    host?: string[];
  };
  auth?: any;
}

interface PostmanVariable {
  key: string;
  value: string;
  type: string;
}

interface ProgramConfig {
  program_type: string;
  vendor: string;
  version: string;
  api_type: string;
  metadata: {
    name: string;
    description: string;
    base_url: string;
    authentication: {
      type: string;
      header: string;
    };
  };
  capabilities: string[];
  workflows?: Record<string, Workflow>;
  entities?: Entity[];
  categories: Category[];
  compliance?: any;
  integrations?: any;
  performance?: any;
  resources?: any;
}

interface Category {
  name: string;
  display_name: string;
  description: string;
  order?: number;
  sandbox_only?: boolean;
  operations: Operation[];
}

interface Operation {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

interface Workflow {
  name: string;
  description: string;
  required: boolean;
  steps: WorkflowStep[];
}

interface WorkflowStep {
  operation: string;
  required: boolean;
  description?: string;
  condition?: string;
}

interface Entity {
  name: string;
  description: string;
  primary?: boolean;
}

export class PostmanToYamlConverter {
  private collection: PostmanCollection;
  private programType: string;
  private vendor: string;

  constructor(collectionPath: string, programType: string, vendor: string = 'Highnote Inc.') {
    const collectionContent = fs.readFileSync(collectionPath, 'utf-8');
    this.collection = JSON.parse(collectionContent);
    this.programType = programType;
    this.vendor = vendor;
  }

  /**
   * Convert Postman collection to ap_automation.yaml style program config
   */
  convert(): ProgramConfig {
    const config: ProgramConfig = {
      program_type: this.programType,
      vendor: this.vendor,
      version: "2.0.0",
      api_type: this.detectApiType(),
      metadata: this.extractMetadata(),
      capabilities: this.extractCapabilities(),
      workflows: this.extractWorkflows(),
      entities: this.extractEntities(),
      categories: this.extractCategories(),
      compliance: this.getCompliance(),
      integrations: this.getIntegrations(),
      performance: this.getPerformance(),
      resources: this.getResources()
    };

    return config;
  }

  /**
   * Save the converted config to a YAML file
   */
  saveToYaml(outputPath: string): void {
    const config = this.convert();
    
    // Build YAML content manually for better control
    let yamlContent = '';
    
    // Add basic fields
    yamlContent += `program_type: ${config.program_type}\n`;
    yamlContent += `vendor: ${config.vendor}\n`;
    yamlContent += `version: "${config.version}"\n`;
    yamlContent += `api_type: ${config.api_type}\n`;
    
    // Add metadata
    yamlContent += '\nmetadata:\n';
    yamlContent += `  name: "${config.metadata.name}"\n`;
    yamlContent += `  description: "${config.metadata.description}"\n`;
    yamlContent += `  base_url: "${config.metadata.base_url}"\n`;
    yamlContent += '  authentication:\n';
    yamlContent += `    type: ${config.metadata.authentication.type}\n`;
    yamlContent += `    header: ${config.metadata.authentication.header}\n`;
    
    // Add capabilities
    yamlContent += '\n# Core capabilities this program provides\n';
    yamlContent += 'capabilities:\n';
    config.capabilities.forEach(cap => {
      yamlContent += `  - ${cap}\n`;
    });
    
    // Add workflows
    yamlContent += '\n# Standard workflows for this program\n';
    yamlContent += 'workflows:\n';
    Object.entries(config.workflows || {}).forEach(([key, workflow]) => {
      yamlContent += `  ${key}:\n`;
      yamlContent += `    name: "${workflow.name}"\n`;
      yamlContent += `    description: "${workflow.description}"\n`;
      yamlContent += `    required: ${workflow.required}\n`;
      yamlContent += '    steps:\n';
      workflow.steps.forEach(step => {
        yamlContent += `      - operation: ${step.operation}\n`;
        yamlContent += `        required: ${step.required}\n`;
        if (step.description) {
          yamlContent += `        description: "${step.description}"\n`;
        }
        if (step.condition) {
          yamlContent += `        condition: "${step.condition}"\n`;
        }
      });
      yamlContent += '        \n';
    });
    
    // Add entities
    yamlContent += '# Core entities managed by this program\n';
    yamlContent += 'entities:\n';
    config.entities?.forEach(entity => {
      yamlContent += `  - name: ${entity.name}\n`;
      yamlContent += `    description: "${entity.description}"\n`;
      if (entity.primary) {
        yamlContent += `    primary: true\n`;
      }
    });
    
    // Add categories with operations
    yamlContent += '\n# Operation categories with enhanced metadata\n';
    yamlContent += 'categories:\n';
    config.categories.forEach(category => {
      yamlContent += `  - name: ${category.name}\n`;
      yamlContent += `    display_name: "${category.display_name}"\n`;
      yamlContent += `    description: "${category.description}"\n`;
      yamlContent += `    order: ${category.order}\n`;
      if (category.sandbox_only) {
        yamlContent += `    sandbox_only: true\n`;
      }
      yamlContent += '    operations:\n';
      category.operations.forEach(op => {
        yamlContent += `      - name: ${op.name}\n`;
        yamlContent += `        type: ${op.type}\n`;
        yamlContent += `        required: ${op.required}\n`;
        if (op.description) {
          yamlContent += `        description: "${op.description}"\n`;
        }
      });
      yamlContent += '        \n';
    });
    
    // Add remaining sections using yaml.dump for complex structures
    const remainingSections = {
      compliance: config.compliance,
      integrations: config.integrations,
      performance: config.performance,
      resources: config.resources
    };
    
    yamlContent += '# Compliance and security requirements\n';
    yamlContent += yaml.dump({ compliance: remainingSections.compliance }, { lineWidth: -1, noRefs: true, sortKeys: false }).replace('compliance:\n', 'compliance:\n');
    
    yamlContent += '\n# Integration requirements\n';
    yamlContent += yaml.dump({ integrations: remainingSections.integrations }, { lineWidth: -1, noRefs: true, sortKeys: false }).replace('integrations:\n', 'integrations:\n');
    
    yamlContent += '\n# Performance requirements\n';
    yamlContent += yaml.dump({ performance: remainingSections.performance }, { lineWidth: -1, noRefs: true, sortKeys: false }).replace('performance:\n', 'performance:\n');
    
    yamlContent += '\n# Resource links\n';
    yamlContent += yaml.dump({ resources: remainingSections.resources }, { lineWidth: -1, noRefs: true, sortKeys: false }).replace('resources:\n', 'resources:\n');

    // Add header comment
    const programDisplayName = this.formatProgramName(this.programType);
    const header = `# ${programDisplayName} Configuration - Enhanced Version
# This config defines the technical structure and requirements
`;

    fs.writeFileSync(outputPath, header + yamlContent);
  }

  private detectApiType(): string {
    const firstRequest = this.findFirstRequest(this.collection.item);
    if (firstRequest?.body?.mode === 'graphql') {
      return 'graphql';
    }
    return 'rest';
  }

  private findFirstRequest(items: PostmanItem[]): PostmanRequest | null {
    for (const item of items) {
      if (item.request) {
        return item.request;
      }
      if (item.item) {
        const found = this.findFirstRequest(item.item);
        if (found) return found;
      }
    }
    return null;
  }

  private extractMetadata(): any {
    const baseUrl = this.collection.variable?.find(v => v.key === 'apiUrl')?.value || '{{apiUrl}}';
    const programDisplayName = this.formatProgramName(this.programType);
    
    return {
      name: programDisplayName,
      description: this.getProgramDescription(),
      base_url: baseUrl,
      authentication: {
        type: 'Basic <BASE64_ENCODED_API_KEY>',
        header: 'Authorization'
      }
    };
  }

  private formatProgramName(type: string): string {
    // Special cases
    if (type === 'ap_automation') return 'AP Automation Program';
    
    return type
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Program';
  }

  private getProgramDescription(): string {
    const descriptions: Record<string, string> = {
      'ap_automation': 'Accounts payable automation with virtual card payments',
      'consumer_credit': 'Consumer credit card program with underwriting',
      'consumer_prepaid': 'Consumer prepaid card program',
      'commercial_credit': 'Commercial credit card program for businesses',
      'commercial_prepaid': 'Commercial prepaid card program for businesses',
      'consumer_charge': 'Consumer charge card program',
      'commercial_charge': 'Commercial charge card program'
    };
    
    return descriptions[this.programType] || `${this.formatProgramName(this.programType)} management`;
  }

  private extractCapabilities(): string[] {
    const capabilities = new Set<string>();
    const operationNames = this.getAllOperationNames(this.collection.item);

    // Map operations to capabilities
    if (operationNames.some(op => op.toLowerCase().includes('virtualcard'))) {
      capabilities.add('virtual_card_issuance');
    }
    if (operationNames.some(op => op.toLowerCase().includes('ondemandfunding'))) {
      capabilities.add('on_demand_funding');
    }
    if (operationNames.some(op => op.toLowerCase().includes('collaborative'))) {
      capabilities.add('collaborative_authorization');
    }
    if (operationNames.some(op => op.toLowerCase().includes('spendrule'))) {
      capabilities.add('spend_controls');
    }
    if (operationNames.some(op => op.toLowerCase().includes('velocity'))) {
      capabilities.add('velocity_rules');
    }
    if (operationNames.some(op => op.toLowerCase().includes('webhook'))) {
      capabilities.add('real_time_webhooks');
    }
    if (operationNames.some(op => op.toLowerCase().includes('transaction'))) {
      capabilities.add('transaction_monitoring');
    }
    if (operationNames.some(op => op.toLowerCase().includes('currency'))) {
      capabilities.add('multi_currency');
    }

    // Add program-specific capabilities
    if (this.programType.includes('credit')) {
      capabilities.add('credit_line_management');
      capabilities.add('interest_calculation');
    }
    if (this.programType.includes('prepaid')) {
      capabilities.add('prepaid_funding');
      capabilities.add('balance_management');
    }

    return Array.from(capabilities);
  }

  private getAllOperationNames(items: PostmanItem[]): string[] {
    const names: string[] = [];
    for (const item of items) {
      if (item.request) {
        names.push(item.name);
        if (item.request.body?.graphql?.query) {
          const queryMatch = item.request.body.graphql.query.match(/(?:query|mutation)\s+(\w+)/);
          if (queryMatch) {
            names.push(queryMatch[1]);
          }
        }
      }
      if (item.item) {
        names.push(...this.getAllOperationNames(item.item));
      }
    }
    return names;
  }

  private extractCategories(): Category[] {
    const categories: Category[] = [];
    let orderIndex = 1;
    
    // Create category map based on top-level items
    for (const topLevelItem of this.collection.item) {
      if (topLevelItem.item && topLevelItem.item.length > 0) {
        const categoryName = this.formatCategoryName(topLevelItem.name);
        const category: Category = {
          name: categoryName,
          display_name: topLevelItem.name,
          description: topLevelItem.description || `${topLevelItem.name} operations`,
          order: orderIndex++,
          operations: []
        };

        // Check if it's sandbox only
        if (topLevelItem.name.toLowerCase().includes('simulation') || 
            topLevelItem.name.toLowerCase().includes('sandbox')) {
          category.sandbox_only = true;
        }

        // Extract operations from nested items
        this.extractOperationsFromItems(topLevelItem.item, category.operations);

        if (category.operations.length > 0) {
          categories.push(category);
        }
      }
    }

    return categories;
  }

  private formatCategoryName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  private extractOperationsFromItems(items: PostmanItem[], operations: Operation[]): void {
    for (const item of items) {
      if (item.request) {
        const operation = this.extractOperation(item);
        if (operation) {
          operations.push(operation);
        }
      } else if (item.item) {
        // Recursively extract from nested items
        this.extractOperationsFromItems(item.item, operations);
      }
    }
  }

  private extractOperation(item: PostmanItem): Operation {
    const operationName = this.extractOperationName(item);
    const operationType = this.detectOperationType(item.request!);
    
    // Determine if required based on operation name patterns
    const isRequired = this.isOperationRequired(operationName);
    
    return {
      name: operationName,
      type: operationType,
      required: isRequired,
      description: item.description
    };
  }

  private isOperationRequired(operationName: string): boolean {
    const requiredPatterns = [
      'create',
      'issue',
      'activate',
      'setup',
      'initialize',
      'get',
      'enable'
    ];
    
    const optionalPatterns = [
      'simulate',
      'update',
      'delete',
      'remove',
      'detach',
      'suspend',
      'close',
      'revoke',
      'deactivate'
    ];
    
    const nameLower = operationName.toLowerCase();
    
    // Check if it matches optional patterns first
    if (optionalPatterns.some(pattern => nameLower.includes(pattern))) {
      return false;
    }
    
    // Then check required patterns
    if (requiredPatterns.some(pattern => nameLower.includes(pattern))) {
      return true;
    }
    
    // Default to false for unknown operations
    return false;
  }

  private extractOperationName(item: PostmanItem): string {
    // Try to extract from GraphQL query/mutation name
    if (item.request?.body?.graphql?.query) {
      const match = item.request.body.graphql.query.match(/(?:query|mutation)\s+(\w+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Clean up the item name to create operation name
    return item.name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map((word, index) => 
        index === 0 
          ? word.charAt(0).toUpperCase() + word.slice(1)
          : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join('');
  }

  private detectOperationType(request: PostmanRequest): string {
    if (request.body?.graphql?.query) {
      if (request.body.graphql.query.includes('mutation')) {
        return 'mutation';
      }
      return 'query';
    }
    return request.method.toLowerCase();
  }

  private extractWorkflows(): Record<string, Workflow> {
    const workflows: Record<string, Workflow> = {};

    // Create standard workflows based on available operations
    const operations = this.getAllOperationNames(this.collection.item);
    
    // Initial setup workflow
    workflows.initial_setup = {
      name: "Initial Setup",
      description: "One-time setup for new organizations",
      required: true,
      steps: [
        {
          operation: "CreateSecretApiKey",
          required: true,
          description: "Create API credentials"
        },
        {
          operation: "CreateCardProduct",
          required: true,
          description: "Setup card product"
        }
      ]
    };

    // Card issuance workflow if relevant operations exist
    if (operations.some(op => op.toLowerCase().includes('issue') || op.toLowerCase().includes('card'))) {
      workflows.card_issuance = {
        name: "Card Issuance Flow",
        description: "Issue and activate virtual cards",
        required: true,
        steps: [
          {
            operation: "IssuePaymentCardForApplicationWithOnDemandFundingSource",
            required: true,
            description: "Issue virtual card"
          },
          {
            operation: "ActivatePaymentCard",
            required: true,
            description: "Activate the card"
          }
        ]
      };
    }

    // Transaction workflow if relevant operations exist
    if (operations.some(op => op.toLowerCase().includes('transaction'))) {
      workflows.transaction_processing = {
        name: "Transaction Processing",
        description: "Process card transactions",
        required: true,
        steps: [
          {
            operation: "GetTransactionEvent",
            required: true,
            description: "Retrieve transaction details"
          }
        ]
      };
    }

    return workflows;
  }

  private extractEntities(): Entity[] {
    const entities: Entity[] = [];
    
    // Core entities based on program type
    if (this.programType === 'ap_automation') {
      entities.push(
        { name: 'Account', description: 'Core account management', primary: true },
        { name: 'Application', description: 'Application management', primary: true },
        { name: 'PaymentCard', description: 'Virtual payment cards', primary: true },
        { name: 'Authorization', description: 'Transaction authorizations', primary: true },
        { name: 'SpendRule', description: 'Spending controls and limits' },
        { name: 'VelocityRule', description: 'Velocity controls' },
        { name: 'CardProduct', description: 'Card product configuration' },
        { name: 'FinancialAccount', description: 'Financial account management' }
      );
    } else {
      // Generic entities for other program types
      entities.push(
        { name: 'Organization', description: 'The top-level entity representing the card program', primary: true },
        { name: 'CardProduct', description: 'Configuration for card products and their features' },
        { name: 'AccountHolder', description: 'Individual or business entity that holds an account' },
        { name: 'PaymentCard', description: 'Physical or virtual payment cards', primary: true },
        { name: 'Transaction', description: 'Card transactions and authorizations' }
      );
    }

    return entities;
  }

  private getCompliance(): any {
    return {
      standards: [
        { name: 'PCI_DSS', level: 1, required: true },
        { name: 'SOC2_TYPE2', required: true }
      ],
      regulations: [
        { name: 'USA_PATRIOT_ACT', description: 'KYC/AML procedures' },
        { name: 'OFAC', description: 'Sanctions screening' },
        { name: 'REG_E', description: 'Electronic funds transfer protections' }
      ],
      security: {
        encryption: {
          in_transit: 'TLS 1.2+',
          at_rest: 'AES-256'
        },
        authentication: [
          { type: 'api_key', rotation_days: 90 },
          { type: 'bearer_token' }
        ],
        data_retention: {
          transaction_data: '7 years',
          card_data: 'tokenized'
        }
      }
    };
  }

  private getIntegrations(): any {
    return {
      webhooks: {
        required: true,
        events: [
          'card.issued',
          'card.activated',
          'transaction.authorized',
          'transaction.cleared',
          'transaction.declined'
        ]
      },
      reporting: {
        formats: ['CSV'],
        frequency: ['real_time', 'daily', 'monthly']
      }
    };
  }

  private getPerformance(): any {
    return {
      request_rate: {
        api_key: '200 / 10 seconds',
        client_token: '200 / 10 seconds'
      },
      complexity: {
        api_key: '5000 / 10 seconds',
        client_token: '5000 / 10 seconds'
      },
      api: {
        response_time_ms: 500,
        availability: 99.9
      },
      transactions: {
        collaborative_authorization_time_ms: 2000
      }
    };
  }

  private getResources(): any {
    return {
      documentation: [
        { name: 'API Documentation', url: 'https://highnote.com/docs/basics/graphql-api/using-the-highnote-graphql-api' },
        { name: 'GraphQL Schema Reference', url: 'https://highnote.com/docs/reference/query' },
        { name: 'Integration Guides', url: 'https://highnote.com/docs/issuing/templates' },
        { name: 'Webhook Events Reference', url: 'https://highnote.com/docs/basics/events-and-notifications/events-reference' }
      ],
      developer_tools: [
        { name: 'Developer Portal', url: 'https://dashboard.highnote.com' },
        { name: 'Prod-Test Environment', url: 'https://api.us.test.highnote.com/graphql' },
        { name: 'API Explorer', url: 'https://highnote.com/docs/explorer/default' },
        { name: 'Postman Collection - Please contact Highnote Implementation Team' }
      ],
      support: [
        { name: 'Support Portal', url: 'https://support.highnote.com/hc/en-us' },
        { name: 'Technical Documentation', url: 'https://highnote.com/docs' },
        { name: 'Email: support@highnote.com' }
      ],
      monitoring: [
        { name: 'System Status Page', url: 'https://status.highnote.com' },
        { name: 'API Changelog', url: 'https://highnote.com/docs/changelog-api' }
      ]
    };
  }
}

// Export for use in other modules
export default PostmanToYamlConverter;