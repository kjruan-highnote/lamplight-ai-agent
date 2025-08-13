export interface CustomerContext {
  _id?: string;
  name: string;
  customer: string;
  version: string;
  data: {
    customer_name: string;
    industry: string;
    company_size: string;
    business_model: string;
    current_challenges: string[];
    technical_requirements: {
      integration_complexity: string;
      security_requirements: string;
      compliance_needs: string[];
      scalability_needs: string;
    };
    business_objectives: string[];
    success_metrics: string[];
    implementation_timeline: string;
    budget_range: string;
    stakeholders: Array<{
      role: string;
      concerns: string[];
    }>;
  };
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  tags?: string[];
}

export interface ProgramConfig {
  _id?: string;
  program_type: string;
  name: string;
  version: string;
  vendor: string;
  api_type: string;
  config: {
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
    workflows: Record<string, Workflow>;
    entities: Entity[];
    categories: Category[];
    compliance?: ComplianceConfig;
    integrations?: IntegrationConfig;
    performance?: PerformanceConfig;
    resources?: ResourceConfig;
  };
  createdAt?: Date;
  updatedAt?: Date;
  lastSyncedFromPostman?: Date;
  tags?: string[];
}

export interface Workflow {
  name: string;
  description: string;
  required: boolean;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  operation: string;
  required: boolean;
  description: string;
}

export interface Entity {
  name: string;
  description: string;
  primary?: boolean;
}

export interface Category {
  name: string;
  display_name: string;
  description: string;
  order: number;
  operations: Operation[];
}

export interface Operation {
  name: string;
  type: 'query' | 'mutation';
  required: boolean;
}

export interface ComplianceConfig {
  standards: Array<{
    name: string;
    level?: number;
    required: boolean;
  }>;
  regulations: Array<{
    name: string;
    description: string;
  }>;
  security: {
    encryption: {
      in_transit: string;
      at_rest: string;
    };
    authentication: Array<{
      type: string;
      rotation_days?: number;
    }>;
    data_retention: Record<string, string>;
  };
}

export interface IntegrationConfig {
  webhooks: {
    required: boolean;
    events: string[];
  };
  reporting: {
    formats: string[];
    frequency: string[];
  };
}

export interface PerformanceConfig {
  request_rate: Record<string, string>;
  complexity: Record<string, string>;
  api: {
    response_time_ms: number;
    availability: number;
  };
  transactions?: {
    collaborative_authorization_time_ms: number;
  };
}

export interface ResourceConfig {
  documentation: ResourceLink[];
  developer_tools: ResourceLink[];
  support: ResourceLink[];
  monitoring: ResourceLink[];
}

export interface ResourceLink {
  name: string;
  url?: string;
}