export interface Contact {
  name: string;
  email: string;
  role: string;
}

export interface UseCase {
  title: string;
  description: string;
  scenarios: string[];
  value_proposition?: string;
}

export interface KPI {
  metric: string;
  target: string;
  timeline: string;
}

export interface Milestone {
  phase: string;
  description: string;
  timeline: string;
  success_criteria: string;
}

export interface CustomerContext {
  _id?: string;
  name?: string;
  version?: string;
  customer: {
    name: string;
    industry: string;
    entity: string;
    type: string;
    contacts: Contact[];
  };
  business_context: {
    current_state: {
      description: string;
      pain_points: string[];
    };
    objectives: {
      primary: string[];
      secondary: string[];
    };
    business_model: {
      description: string;
      key_points: string[];
    };
  };
  use_cases: {
    primary: UseCase[];
    secondary: UseCase[];
  };
  requirements: {
    business: string[];
    operational: string[];
    financial: string[];
  };
  success_metrics: {
    kpis: KPI[];
    milestones: Milestone[];
  };
  stakeholders: {
    executive_sponsor: string;
    business_owner: string;
    technical_lead: string;
    end_users: string[];
  };
  integration_landscape: {
    internal_systems: string[];
    external_partners: string[];
  };
  risk_considerations: {
    business_risks: string[];
    mitigation_strategies: string[];
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