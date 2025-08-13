// Capability definitions with human-readable descriptions and workflow mappings
export interface Capability {
  id: string;
  name: string;
  description: string;
  category: 'funding' | 'authorization' | 'controls' | 'monitoring' | 'management';
  requiredWorkflows?: string[];
  suggestedWorkflows?: string[];
  requiredEntities?: string[];
  dependencies?: string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: 'setup' | 'issuance' | 'processing' | 'management' | 'compliance';
  requiredCapabilities?: string[];
  steps?: WorkflowStep[];
}

export interface WorkflowStep {
  operation: string;
  required: boolean;
  description: string;
  entity?: string;
}

// Capability Definitions
export const CAPABILITIES: Record<string, Capability> = {
  on_demand_funding: {
    id: 'on_demand_funding',
    name: 'On-Demand Funding',
    description: 'Enable real-time funding of cards and accounts as transactions occur',
    category: 'funding',
    requiredWorkflows: ['initial_setup', 'card_issuance'],
    suggestedWorkflows: ['funding_management'],
    requiredEntities: ['FundingSource', 'FinancialAccount'],
    dependencies: []
  },
  
  prepaid_funding: {
    id: 'prepaid_funding',
    name: 'Prepaid Funding',
    description: 'Support prepaid card programs with upfront balance loading',
    category: 'funding',
    requiredWorkflows: ['initial_setup', 'balance_loading'],
    suggestedWorkflows: ['balance_management_flow'],
    requiredEntities: ['PrepaidAccount', 'FinancialAccount'],
    dependencies: ['balance_management']
  },
  
  balance_management: {
    id: 'balance_management',
    name: 'Balance Management',
    description: 'Track and manage account balances, including holds and available funds',
    category: 'management',
    requiredWorkflows: ['balance_operations'],
    suggestedWorkflows: ['balance_reconciliation'],
    requiredEntities: ['FinancialAccount', 'Balance'],
    dependencies: []
  },
  
  collaborative_authorization: {
    id: 'collaborative_authorization',
    name: 'Collaborative Authorization',
    description: 'Enable multi-party authorization decisioning with custom rules',
    category: 'authorization',
    requiredWorkflows: ['authorization_setup'],
    suggestedWorkflows: ['authorization_rules_config'],
    requiredEntities: ['Authorization', 'AuthorizationRule'],
    dependencies: ['real_time_webhooks']
  },
  
  spend_controls: {
    id: 'spend_controls',
    name: 'Spend Controls',
    description: 'Set spending limits and restrictions at card or account level',
    category: 'controls',
    requiredWorkflows: ['spend_rule_setup'],
    suggestedWorkflows: ['spend_monitoring'],
    requiredEntities: ['SpendRule', 'SpendLimit'],
    dependencies: []
  },
  
  velocity_rules: {
    id: 'velocity_rules',
    name: 'Velocity Rules',
    description: 'Control transaction frequency and volume over time periods',
    category: 'controls',
    requiredWorkflows: ['velocity_rule_setup'],
    suggestedWorkflows: ['velocity_monitoring'],
    requiredEntities: ['VelocityRule', 'VelocityLimit'],
    dependencies: []
  },
  
  real_time_webhooks: {
    id: 'real_time_webhooks',
    name: 'Real-Time Webhooks',
    description: 'Receive instant notifications for card and transaction events',
    category: 'monitoring',
    requiredWorkflows: ['webhook_configuration'],
    suggestedWorkflows: ['event_handling'],
    requiredEntities: ['WebhookEndpoint', 'Event'],
    dependencies: []
  },
  
  transaction_monitoring: {
    id: 'transaction_monitoring',
    name: 'Transaction Monitoring',
    description: 'Track and analyze transaction patterns for fraud and compliance',
    category: 'monitoring',
    requiredWorkflows: ['monitoring_setup'],
    suggestedWorkflows: ['alert_configuration', 'reporting_setup'],
    requiredEntities: ['Transaction', 'TransactionEvent'],
    dependencies: ['real_time_webhooks']
  },
  
  credit_line_management: {
    id: 'credit_line_management',
    name: 'Credit Line Management',
    description: 'Manage credit limits, utilization, and credit-specific features',
    category: 'management',
    requiredWorkflows: ['credit_setup', 'credit_limit_management'],
    suggestedWorkflows: ['credit_review_workflow'],
    requiredEntities: ['CreditLine', 'CreditLimit', 'CreditAccount'],
    dependencies: ['balance_management']
  },
  
  interest_calculation: {
    id: 'interest_calculation',
    name: 'Interest Calculation',
    description: 'Calculate and apply interest charges on outstanding balances',
    category: 'management',
    requiredWorkflows: ['interest_configuration'],
    suggestedWorkflows: ['billing_cycle_setup'],
    requiredEntities: ['InterestRate', 'BillingCycle', 'Statement'],
    dependencies: ['credit_line_management', 'balance_management']
  }
};

// Standard Workflows that can be derived from capabilities
export const STANDARD_WORKFLOWS: Record<string, Workflow> = {
  initial_setup: {
    id: 'initial_setup',
    name: 'Initial Setup',
    description: 'One-time setup for new organizations',
    category: 'setup',
    steps: [
      {
        operation: 'CreateSecretApiKey',
        required: true,
        description: 'Create API credentials',
        entity: 'ApiKey'
      },
      {
        operation: 'CreateCardProduct',
        required: true,
        description: 'Setup card product',
        entity: 'CardProduct'
      }
    ]
  },
  
  card_issuance: {
    id: 'card_issuance',
    name: 'Card Issuance Flow',
    description: 'Issue and activate payment cards',
    category: 'issuance',
    requiredCapabilities: [],
    steps: [
      {
        operation: 'IssuePaymentCard',
        required: true,
        description: 'Issue virtual or physical card',
        entity: 'PaymentCard'
      },
      {
        operation: 'ActivatePaymentCard',
        required: true,
        description: 'Activate the card',
        entity: 'PaymentCard'
      }
    ]
  },
  
  transaction_processing: {
    id: 'transaction_processing',
    name: 'Transaction Processing',
    description: 'Process card transactions',
    category: 'processing',
    requiredCapabilities: ['transaction_monitoring'],
    steps: [
      {
        operation: 'GetTransactionEvent',
        required: true,
        description: 'Retrieve transaction details',
        entity: 'Transaction'
      }
    ]
  },
  
  balance_loading: {
    id: 'balance_loading',
    name: 'Balance Loading',
    description: 'Load funds onto prepaid cards',
    category: 'processing',
    requiredCapabilities: ['prepaid_funding', 'balance_management'],
    steps: [
      {
        operation: 'LoadFunds',
        required: true,
        description: 'Add funds to account',
        entity: 'FinancialAccount'
      },
      {
        operation: 'UpdateBalance',
        required: true,
        description: 'Update available balance',
        entity: 'Balance'
      }
    ]
  },
  
  spend_rule_setup: {
    id: 'spend_rule_setup',
    name: 'Spend Rule Configuration',
    description: 'Configure spending controls and limits',
    category: 'setup',
    requiredCapabilities: ['spend_controls'],
    steps: [
      {
        operation: 'CreateSpendRule',
        required: true,
        description: 'Create spending rule',
        entity: 'SpendRule'
      },
      {
        operation: 'AttachSpendRule',
        required: true,
        description: 'Attach rule to card or account',
        entity: 'SpendRule'
      }
    ]
  },
  
  webhook_configuration: {
    id: 'webhook_configuration',
    name: 'Webhook Configuration',
    description: 'Set up webhook endpoints for real-time events',
    category: 'setup',
    requiredCapabilities: ['real_time_webhooks'],
    steps: [
      {
        operation: 'CreateWebhookEndpoint',
        required: true,
        description: 'Register webhook endpoint',
        entity: 'WebhookEndpoint'
      },
      {
        operation: 'ConfigureEventTypes',
        required: true,
        description: 'Select event types to receive',
        entity: 'WebhookEndpoint'
      }
    ]
  },
  
  authorization_setup: {
    id: 'authorization_setup',
    name: 'Authorization Setup',
    description: 'Configure collaborative authorization rules',
    category: 'setup',
    requiredCapabilities: ['collaborative_authorization'],
    steps: [
      {
        operation: 'CreateAuthorizationRule',
        required: true,
        description: 'Define authorization rules',
        entity: 'AuthorizationRule'
      },
      {
        operation: 'ConfigureDecisioningEndpoint',
        required: true,
        description: 'Set up decisioning endpoint',
        entity: 'AuthorizationEndpoint'
      }
    ]
  },
  
  credit_setup: {
    id: 'credit_setup',
    name: 'Credit Account Setup',
    description: 'Initialize credit accounts and lines',
    category: 'setup',
    requiredCapabilities: ['credit_line_management'],
    steps: [
      {
        operation: 'CreateCreditLine',
        required: true,
        description: 'Establish credit line',
        entity: 'CreditLine'
      },
      {
        operation: 'SetCreditLimit',
        required: true,
        description: 'Set initial credit limit',
        entity: 'CreditLimit'
      }
    ]
  }
};

// Helper function to get workflows for selected capabilities
export function getWorkflowsForCapabilities(capabilityIds: string[]): Workflow[] {
  const workflows = new Set<string>();
  const selectedWorkflows: Workflow[] = [];
  
  // Collect all required and suggested workflows
  capabilityIds.forEach(capId => {
    const capability = CAPABILITIES[capId];
    if (capability) {
      capability.requiredWorkflows?.forEach(wf => workflows.add(wf));
      capability.suggestedWorkflows?.forEach(wf => workflows.add(wf));
    }
  });
  
  // Add workflows that require these capabilities
  Object.values(STANDARD_WORKFLOWS).forEach(workflow => {
    if (workflow.requiredCapabilities?.some(cap => capabilityIds.includes(cap))) {
      workflows.add(workflow.id);
    }
  });
  
  // Return workflow objects
  workflows.forEach(wfId => {
    const workflow = STANDARD_WORKFLOWS[wfId];
    if (workflow) {
      selectedWorkflows.push(workflow);
    }
  });
  
  return selectedWorkflows;
}

// Helper function to get required entities for capabilities
export function getEntitiesForCapabilities(capabilityIds: string[]): string[] {
  const entities = new Set<string>();
  
  capabilityIds.forEach(capId => {
    const capability = CAPABILITIES[capId];
    if (capability?.requiredEntities) {
      capability.requiredEntities.forEach(entity => entities.add(entity));
    }
  });
  
  return Array.from(entities);
}

// Helper function to check capability dependencies
export function getCapabilityDependencies(capabilityIds: string[]): string[] {
  const dependencies = new Set<string>();
  
  capabilityIds.forEach(capId => {
    const capability = CAPABILITIES[capId];
    if (capability?.dependencies) {
      capability.dependencies.forEach(dep => {
        if (!capabilityIds.includes(dep)) {
          dependencies.add(dep);
        }
      });
    }
  });
  
  return Array.from(dependencies);
}

// Category metadata for UI grouping
export const CAPABILITY_CATEGORIES = {
  funding: {
    name: 'Funding',
    description: 'Card and account funding mechanisms',
    icon: 'DollarSign'
  },
  authorization: {
    name: 'Authorization',
    description: 'Transaction authorization and decisioning',
    icon: 'Shield'
  },
  controls: {
    name: 'Controls',
    description: 'Spending and velocity controls',
    icon: 'Lock'
  },
  monitoring: {
    name: 'Monitoring',
    description: 'Real-time monitoring and notifications',
    icon: 'Eye'
  },
  management: {
    name: 'Management',
    description: 'Account and balance management',
    icon: 'Settings'
  }
};

export const WORKFLOW_CATEGORIES = {
  setup: {
    name: 'Setup',
    description: 'Initial configuration workflows',
    icon: 'Tool'
  },
  issuance: {
    name: 'Issuance',
    description: 'Card and account creation',
    icon: 'CreditCard'
  },
  processing: {
    name: 'Processing',
    description: 'Transaction and payment processing',
    icon: 'Zap'
  },
  management: {
    name: 'Management',
    description: 'Ongoing management workflows',
    icon: 'Settings'
  },
  compliance: {
    name: 'Compliance',
    description: 'Compliance and regulatory workflows',
    icon: 'FileCheck'
  }
};