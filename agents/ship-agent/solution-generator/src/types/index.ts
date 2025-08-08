export interface WorkflowStep {
  operation: string;
  required: boolean;
  description?: string;
  condition?: string;
  parameters?: Record<string, any>;
}

export interface Workflow {
  name: string;
  description?: string;
  steps: WorkflowStep[];
  tags?: string[];
}

export interface APIOperation {
  name: string;
  type: 'query' | 'mutation' | 'rest';
  description?: string;
  required: boolean;
  category?: string;
  parameters?: Record<string, any>;
}

export interface ProgramConfig {
  program_type: string;
  api_type: string;
  vendor: string;
  capabilities?: string[];
  workflows?: Record<string, Workflow>;
  operations?: Record<string, APIOperation[]>;
  performance?: {
    rate_limits?: Record<string, any>;
    complexity_limits?: Record<string, any>;
    sla?: Record<string, any>;
  };
}

export interface Customer {
  name: string;
  industry?: string;
  size?: string;
  region?: string;
}

export interface Vendor {
  name: string;
  type?: string;
  api_type?: string;
}

export interface UseCase {
  title: string;
  description: string;
  scenarios?: string[];
  value_proposition?: string;
}

export interface CustomerContext {
  customer?: Customer;
  vendor?: Vendor;
  overview?: string;
  objectives?: string[];
  requirements?: {
    functional?: string[];
    technical?: string[];
    compliance?: string[];
  };
  use_cases?: {
    primary?: UseCase[];
    secondary?: UseCase[];
  };
}

export interface SolutionData {
  program: ProgramConfig;
  customer: CustomerContext;
  metadata: {
    generatedAt: string;
    version: string;
    programType: string;
    customerName: string;
  };
  diagrams?: Record<string, string>;
  workflowsWithDiagrams?: Array<Workflow & { id: string; diagram: string | null }>;
}

export interface ExportOptions {
  format: 'markdown' | 'html' | 'pdf' | 'confluence';
  outputPath?: string;
  includeAssets?: boolean;
  templateOverride?: string;
}