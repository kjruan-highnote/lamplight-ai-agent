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
  // Core program identification
  program_type: string; // e.g., 'ap_automation', 'consumer_prepaid'
  vendor: string; // e.g., 'Highnote Inc.', 'Marqeta'
  version: string;
  api_type: 'graphql' | 'rest' | 'soap';
  
  // Program classification
  program_class?: 'template' | 'subscriber'; // template = reusable, subscriber = specific implementation
  parent_template_id?: string; // If subscriber, reference to parent template
  customer_id?: string; // If subscriber, reference to customer context
  
  // Metadata
  metadata: {
    name: string;
    description: string;
    base_url: string;
    authentication: {
      type: string; // 'Basic', 'Bearer', 'API Key', etc.
      header: string; // 'Authorization', 'X-API-Key', etc.
      format?: string; // Optional format like 'Basic <BASE64_ENCODED_API_KEY>'
    };
  };
  
  // Core capabilities
  capabilities: string[];
  
  // Workflows define the business processes
  workflows: Record<string, Workflow>;
  
  // Core entities managed by the program
  entities: Entity[];
  
  // Operation categories
  categories: Category[];
  
  // Compliance requirements
  compliance?: ComplianceConfig;
  
  // Integration requirements
  integrations?: IntegrationConfig;
  
  // Performance requirements
  performance?: PerformanceConfig;
  
  // Resource links
  resources?: ResourceConfig;
  
  // System fields
  createdAt?: Date;
  updatedAt?: Date;
  lastSyncedFromPostman?: Date;
  createdBy?: string;
  tags?: string[];
  status?: 'draft' | 'active' | 'archived';
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

export interface OperationMetadata {
  categories?: string[];
  vendors?: string[];
  sources?: Array<{
    _id: string;
    category?: string;
    vendor?: string;
    source?: string;
    createdAt?: Date;
  }>;
}

export interface Operation {
  _id?: string;
  name: string;
  type: 'query' | 'mutation' | 'subscription';
  category: string;
  description?: string;
  required?: boolean;
  
  // GraphQL specific fields
  query: string; // The actual GraphQL query/mutation string
  variables?: Record<string, OperationVariable>; // Variable definitions
  schemaInputs?: Record<string, OperationVariable>; // Schema-derived input types with full structure
  
  // Request/Response schemas
  parameters?: Record<string, any>; // Legacy or additional params
  response?: Record<string, any>; // Expected response structure
  
  // Metadata
  tags?: string[];
  vendor?: string; // Which vendor this operation belongs to
  apiType?: 'graphql' | 'rest' | 'soap';
  documentation?: string; // Markdown documentation
  examples?: OperationExample[];
  metadata?: OperationMetadata; // Stores merged metadata from deduplication
  
  // System fields
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  source?: 'postman' | 'manual' | 'import' | 'schema-introspection';
  postmanId?: string; // Reference to original Postman item
  schemaVersion?: string; // Version of schema this was introspected from
}

export interface OperationVariable {
  name: string;
  type: string; // GraphQL type (String, Int, Boolean, ID, custom types)
  required: boolean;
  description?: string;
  defaultValue?: any;
  enumValues?: string[]; // If it's an enum type
  isList?: boolean; // If the type is a list
  fields?: Record<string, OperationVariable>; // For input object types, nested fields
}

export interface OperationExample {
  name: string;
  description?: string;
  variables: Record<string, any>;
  expectedResponse?: any;
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