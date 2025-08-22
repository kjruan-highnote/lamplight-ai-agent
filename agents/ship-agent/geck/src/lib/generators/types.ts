// Generator System Type Definitions

export type GeneratorType = 
  | 'solution'
  | 'workflow'
  | 'erd'
  | 'postman'
  | 'api-docs'
  | 'implementation-guide';

export type ExportFormat = 'markdown' | 'pdf' | 'html' | 'confluence' | 'docx' | 'json';

export type GeneratorStatus = 'idle' | 'generating' | 'completed' | 'error';

export interface GeneratorMetadata {
  id: GeneratorType;
  name: string;
  description: string;
  icon: string;
  category: 'documents' | 'diagrams' | 'exports';
  requiredFields: string[];
  optionalFields: string[];
  exportFormats: ExportFormat[];
}

export interface GeneratorOptions {
  // Common options for all generators
  includeMetadata?: boolean;
  customBranding?: {
    logo?: string;
    primaryColor?: string;
    companyName?: string;
  };
  
  // Solution document specific options
  solutionSections?: {
    executiveSummary?: boolean;
    technicalOverview?: boolean;
    useCases?: boolean;
    workflows?: boolean;
    apiReference?: boolean;
    integrationGuide?: boolean;
    securityCompliance?: boolean;
    appendices?: boolean;
  };
  
  // Workflow diagram specific options
  workflowOptions?: {
    includeAliases?: boolean;
    showTimestamps?: boolean;
    colorScheme?: 'default' | 'monochrome' | 'high-contrast';
  };
  
  // ERD diagram specific options
  erdOptions?: {
    showRelationships?: boolean;
    includeIndexes?: boolean;
    layout?: 'horizontal' | 'vertical';
  };
}

export interface GeneratorRequest {
  type: GeneratorType;
  config: {
    programId?: string;
    contextId?: string;
    operationIds?: string[];
    options: GeneratorOptions;
    exportFormats: ExportFormat[];
  };
}

export interface GeneratorResponse {
  id: string;
  type: GeneratorType;
  status: GeneratorStatus;
  progress?: number;
  message?: string;
  result?: GeneratedDocument;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface GeneratedDocument {
  id: string;
  title: string;
  type: GeneratorType;
  content: string;
  metadata: {
    program?: string;
    context?: string;
    generatedAt: string;
    version: string;
    sections?: string[];
  };
  exports: {
    format: ExportFormat;
    url: string;
    size: number;
  }[];
}

export interface GeneratorHistoryItem {
  id: string;
  type: GeneratorType;
  title: string;
  programName?: string;
  contextName?: string;
  status: GeneratorStatus;
  createdAt: string;
  completedAt?: string;
  exports: ExportFormat[];
}

export interface GeneratorFormData {
  programId: string;
  contextId?: string;
  options: GeneratorOptions;
  exportFormats: ExportFormat[];
}

export interface GeneratorPreviewData {
  content: string;
  format: 'markdown' | 'html';
  sections: {
    id: string;
    title: string;
    preview: string;
  }[];
}

// Generator catalog with metadata for all available generators
export const GENERATOR_CATALOG: Record<GeneratorType, GeneratorMetadata> = {
  solution: {
    id: 'solution',
    name: 'Solution Document',
    description: 'Generate comprehensive solution documents for API programs',
    icon: '📄',
    category: 'documents',
    requiredFields: ['programId'],
    optionalFields: ['contextId'],
    exportFormats: ['markdown', 'pdf', 'html', 'confluence', 'docx'],
  },
  workflow: {
    id: 'workflow',
    name: 'Workflow Diagram',
    description: 'Create sequence diagrams for business workflows',
    icon: '📊',
    category: 'diagrams',
    requiredFields: ['programId'],
    optionalFields: ['contextId'],
    exportFormats: ['markdown', 'html', 'pdf'],
  },
  erd: {
    id: 'erd',
    name: 'ERD Diagram',
    description: 'Generate entity relationship diagrams for data models',
    icon: '🗂️',
    category: 'diagrams',
    requiredFields: ['programId'],
    optionalFields: [],
    exportFormats: ['markdown', 'html', 'pdf'],
  },
  postman: {
    id: 'postman',
    name: 'Postman Collection',
    description: 'Export API operations as Postman collections',
    icon: '🔌',
    category: 'exports',
    requiredFields: ['programId'],
    optionalFields: ['operationIds'],
    exportFormats: ['json'],
  },
  'api-docs': {
    id: 'api-docs',
    name: 'API Documentation',
    description: 'Generate API reference documentation',
    icon: '📖',
    category: 'documents',
    requiredFields: ['programId'],
    optionalFields: ['operationIds'],
    exportFormats: ['markdown', 'html', 'pdf'],
  },
  'implementation-guide': {
    id: 'implementation-guide',
    name: 'Implementation Guide',
    description: 'Create step-by-step implementation guides',
    icon: '🚀',
    category: 'documents',
    requiredFields: ['programId', 'contextId'],
    optionalFields: [],
    exportFormats: ['markdown', 'pdf', 'html', 'docx'],
  },
};

// Helper function to get generator metadata
export function getGeneratorMetadata(type: GeneratorType): GeneratorMetadata {
  return GENERATOR_CATALOG[type];
}

// Helper function to group generators by category
export function getGeneratorsByCategory() {
  const grouped: Record<string, GeneratorMetadata[]> = {
    documents: [],
    diagrams: [],
    exports: [],
  };
  
  Object.values(GENERATOR_CATALOG).forEach(generator => {
    grouped[generator.category].push(generator);
  });
  
  return grouped;
}