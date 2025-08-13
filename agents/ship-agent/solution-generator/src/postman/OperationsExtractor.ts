import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface Operation {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  category?: string;
  graphql?: string;
  variables?: any;
}

export interface OperationMapping {
  collectionName: string;
  programType: string;
  operations: Operation[];
  categories: Map<string, Operation[]>;
}

export class OperationsExtractor {
  private operationsDir: string;
  private existingOperations: Map<string, Operation>;

  constructor(operationsDir: string) {
    this.operationsDir = operationsDir;
    this.existingOperations = new Map();
    this.loadExistingOperations();
  }

  /**
   * Load existing operations from the operations folder for reference
   */
  private loadExistingOperations(): void {
    if (!fs.existsSync(this.operationsDir)) {
      console.warn(`Operations directory not found: ${this.operationsDir}`);
      return;
    }

    const files = fs.readdirSync(this.operationsDir)
      .filter(file => file.endsWith('.json'));

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.operationsDir, file), 'utf-8');
        const data = JSON.parse(content);
        
        if (data.operations && Array.isArray(data.operations)) {
          data.operations.forEach((op: any) => {
            this.existingOperations.set(op.name, {
              name: op.name,
              type: op.type || this.detectOperationType(op),
              required: op.required || false,
              description: op.description,
              category: op.category
            });
          });
        }
      } catch (error) {
        console.warn(`Failed to load operations from ${file}:`, error);
      }
    }

    console.log(`Loaded ${this.existingOperations.size} existing operations for reference`);
  }

  /**
   * Extract operations from a Postman collection
   */
  extractFromCollection(collectionPath: string): OperationMapping {
    const content = fs.readFileSync(collectionPath, 'utf-8');
    const collection = JSON.parse(content);
    
    const mapping: OperationMapping = {
      collectionName: collection.info.name,
      programType: this.deriveProgramType(collection.info.name),
      operations: [],
      categories: new Map()
    };

    // Extract operations recursively
    this.extractOperationsFromItems(collection.item, mapping);

    return mapping;
  }

  /**
   * Extract operations from Postman items recursively
   */
  private extractOperationsFromItems(items: any[], mapping: OperationMapping, categoryName?: string): void {
    for (const item of items) {
      if (item.item) {
        // This is a folder/category
        const category = categoryName || this.formatCategoryName(item.name);
        this.extractOperationsFromItems(item.item, mapping, category);
      } else if (item.request) {
        // This is an operation
        const operation = this.extractOperation(item, categoryName);
        if (operation) {
          mapping.operations.push(operation);
          
          // Add to category map
          const cat = operation.category || 'uncategorized';
          if (!mapping.categories.has(cat)) {
            mapping.categories.set(cat, []);
          }
          mapping.categories.get(cat)!.push(operation);
        }
      }
    }
  }

  /**
   * Extract a single operation from a Postman item
   */
  private extractOperation(item: any, category?: string): Operation {
    const operationName = this.extractOperationName(item);
    
    // Check if we have existing reference for this operation
    const existing = this.existingOperations.get(operationName);
    
    const operation: Operation = {
      name: operationName,
      type: existing?.type || this.detectOperationType(item),
      required: existing?.required || this.determineIfRequired(operationName),
      description: item.description || existing?.description,
      category: category || existing?.category
    };

    // Extract GraphQL if present
    if (item.request?.body?.graphql) {
      operation.graphql = item.request.body.graphql.query;
      if (item.request.body.graphql.variables) {
        try {
          operation.variables = JSON.parse(item.request.body.graphql.variables);
        } catch (e) {
          operation.variables = item.request.body.graphql.variables;
        }
      }
    }

    return operation;
  }

  /**
   * Extract operation name from Postman item
   */
  private extractOperationName(item: any): string {
    // Try to extract from GraphQL query/mutation name
    if (item.request?.body?.graphql?.query) {
      const match = item.request.body.graphql.query.match(/(?:query|mutation)\s+(\w+)/);
      if (match) {
        return match[1];
      }
    }
    
    // Clean up the item name
    return item.name
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(' ')
      .map((word: string, index: number) => 
        index === 0 
          ? word.charAt(0).toUpperCase() + word.slice(1)
          : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join('');
  }

  /**
   * Detect operation type from item
   */
  private detectOperationType(item: any): string {
    if (item.request?.body?.graphql?.query) {
      if (item.request.body.graphql.query.includes('mutation')) {
        return 'mutation';
      }
      return 'query';
    }
    
    if (item.request?.method) {
      const method = item.request.method.toUpperCase();
      if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
        return 'mutation';
      }
      return 'query';
    }
    
    return 'query';
  }

  /**
   * Determine if an operation is required based on patterns
   */
  private determineIfRequired(operationName: string): boolean {
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
    
    if (optionalPatterns.some(pattern => nameLower.includes(pattern))) {
      return false;
    }
    
    if (requiredPatterns.some(pattern => nameLower.includes(pattern))) {
      return true;
    }
    
    return false;
  }

  /**
   * Format category name
   */
  private formatCategoryName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Derive program type from collection name
   */
  private deriveProgramType(collectionName: string): string {
    const name = collectionName
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim()
      .replace(/\s+/g, '_');

    // Common mappings
    const mappings: Record<string, string> = {
      'triplink': 'ap_automation',
      'trip_com': 'ap_automation',
      'consumer_credit': 'consumer_credit',
      'consumer_prepaid': 'consumer_prepaid',
      'commercial_credit': 'commercial_credit',
      'commercial_prepaid': 'commercial_prepaid',
      'consumer_charge': 'consumer_charge',
      'commercial_charge': 'commercial_charge'
    };

    return mappings[name] || name;
  }

  /**
   * Save extracted operations to file
   */
  saveOperations(mapping: OperationMapping, outputPath: string): void {
    const output = {
      collection: mapping.collectionName,
      program_type: mapping.programType,
      extraction_date: new Date().toISOString(),
      total_operations: mapping.operations.length,
      categories: Array.from(mapping.categories.entries()).map(([name, ops]) => ({
        name,
        operations: ops.map(op => ({
          name: op.name,
          type: op.type,
          required: op.required,
          description: op.description
        }))
      })),
      operations: mapping.operations
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  }

  /**
   * Merge operations with existing program YAML
   */
  mergeWithProgram(mapping: OperationMapping, programYamlPath: string): void {
    if (!fs.existsSync(programYamlPath)) {
      console.warn(`Program YAML not found: ${programYamlPath}`);
      return;
    }

    const yamlContent = fs.readFileSync(programYamlPath, 'utf-8');
    const program = yaml.load(yamlContent) as any;

    // Update categories with new operations
    if (!program.categories) {
      program.categories = [];
    }

    mapping.categories.forEach((operations, categoryName) => {
      let category = program.categories.find((c: any) => c.name === categoryName);
      
      if (!category) {
        category = {
          name: categoryName,
          display_name: this.formatDisplayName(categoryName),
          description: `${this.formatDisplayName(categoryName)} operations`,
          order: program.categories.length + 1,
          operations: []
        };
        program.categories.push(category);
      }

      // Merge operations
      operations.forEach(op => {
        const existingOp = category.operations.find((o: any) => 
          o.name === op.name || (typeof o === 'string' && o === op.name)
        );
        
        if (!existingOp) {
          category.operations.push({
            name: op.name,
            type: op.type,
            required: op.required,
            description: op.description
          });
        }
      });
    });

    // Save updated YAML
    const updatedYaml = yaml.dump(program, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false
    });

    // Create backup
    const backupPath = programYamlPath.replace('.yaml', `_backup_${Date.now()}.yaml`);
    fs.copyFileSync(programYamlPath, backupPath);
    
    // Save updated file
    fs.writeFileSync(programYamlPath, updatedYaml);
    console.log(`Updated ${programYamlPath} (backup: ${backupPath})`);
  }

  /**
   * Format display name from category name
   */
  private formatDisplayName(name: string): string {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}