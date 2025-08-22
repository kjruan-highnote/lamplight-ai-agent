import { CustomerContext, ProgramConfig, Operation, User } from '../types';

// Use local functions port in development, otherwise use Netlify functions path
const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:9000/.netlify/functions'
  : '/.netlify/functions';

class ApiClient {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('geck-auth-token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  private async request<T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Clear token and redirect to login
        localStorage.removeItem('geck-auth-token');
        window.location.href = '/login';
      }
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Authentication APIs
  auth = {
    login: (email: string, password: string) =>
      this.request<{ user: User; token: string }>(`${API_BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    logout: () =>
      this.request<void>(`${API_BASE}/auth/logout`, {
        method: 'POST',
      }),

    verifyToken: (token: string) =>
      this.request<User>(`${API_BASE}/auth/verify`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),

    register: (userData: Omit<User, '_id' | 'createdAt' | 'updatedAt' | 'lastLogin'> & { password: string }) =>
      this.request<{ user: User; token: string }>(`${API_BASE}/auth/register`, {
        method: 'POST',
        body: JSON.stringify(userData),
      }),

    updateProfile: (userId: string, updates: Partial<User>) =>
      this.request<User>(`${API_BASE}/auth/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    changePassword: (oldPassword: string, newPassword: string) =>
      this.request<{ message: string }>(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ oldPassword, newPassword }),
      }),
  };

  // User management APIs (admin only)
  users = {
    list: () =>
      this.request<User[]>(`${API_BASE}/users`),

    get: (id: string) =>
      this.request<User>(`${API_BASE}/users/${id}`),

    create: (userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'> & { password: string }) =>
      this.request<User>(`${API_BASE}/users`, {
        method: 'POST',
        body: JSON.stringify(userData),
      }),

    update: (id: string, updates: Partial<User>) =>
      this.request<User>(`${API_BASE}/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }),

    delete: (id: string) =>
      this.request<void>(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
      }),

    toggleActive: (id: string) =>
      this.request<User>(`${API_BASE}/users/${id}/toggle-active`, {
        method: 'POST',
      }),
  };

  // Context APIs
  contexts = {
    list: (params?: { search?: string; tags?: string[] }) => 
      this.request<CustomerContext[]>(
        `${API_BASE}/contexts?${new URLSearchParams(params as any).toString()}`
      ),
    
    get: (id: string) => 
      this.request<CustomerContext>(`${API_BASE}/contexts?id=${id}`),
    
    create: (data: Omit<CustomerContext, '_id'>) => 
      this.request<CustomerContext>(`${API_BASE}/contexts`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: Partial<CustomerContext>) => 
      this.request<CustomerContext>(`${API_BASE}/contexts?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) => 
      this.request<void>(`${API_BASE}/contexts?id=${id}`, {
        method: 'DELETE',
      }),
    
    duplicate: (id: string, newName: string) =>
      this.request<CustomerContext>(`${API_BASE}/contexts?id=${id}&action=duplicate`, {
        method: 'POST',
        body: JSON.stringify({ newName }),
      }),
  };

  // Program APIs
  programs = {
    list: (params?: { search?: string; program_type?: string; tags?: string[] }) => 
      this.request<ProgramConfig[]>(
        `${API_BASE}/programs?${new URLSearchParams(params as any).toString()}`
      ),
    
    get: (id: string) => 
      this.request<ProgramConfig>(`${API_BASE}/programs?id=${id}`),
    
    create: (data: Omit<ProgramConfig, '_id'>) => 
      this.request<ProgramConfig>(`${API_BASE}/programs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: Partial<ProgramConfig>) => 
      this.request<ProgramConfig>(`${API_BASE}/programs?id=${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) => 
      this.request<void>(`${API_BASE}/programs?id=${id}`, {
        method: 'DELETE',
      }),
    
    duplicate: (id: string, newName: string) =>
      this.request<ProgramConfig>(`${API_BASE}/programs?id=${id}&action=duplicate`, {
        method: 'POST',
        body: JSON.stringify({ newName }),
      }),
    
    import: () =>
      this.request<{
        success: boolean;
        summary: {
          total: number;
          imported: number;
          updated: number;
          failed: number;
          skipped: number;
        };
        details: {
          imported: string[];
          updated: string[];
          failed: { file: string; error: string }[];
          skipped: { file: string; reason: string }[];
        };
      }>(`${API_BASE}/import`, {
        method: 'POST',
      }),
    
    importYaml: (yamlContent: string, fileName?: string) =>
      this.request<{
        success: boolean;
        action: 'created' | 'updated';
        program: ProgramConfig;
      }>(`${API_BASE}/import`, {
        method: 'POST',
        body: JSON.stringify({ yamlContent, fileName }),
      }),
  };

  // Solution generation
  solution = {
    generate: (contextId: string, programId: string, format: 'html' | 'markdown' = 'html') =>
      this.request<{ url: string; content: string }>(`${API_BASE}/solution`, {
        method: 'POST',
        body: JSON.stringify({ contextId, programId, format }),
      }),
    
    preview: (contextId: string, programId: string) =>
      this.request<{ preview: string }>(`${API_BASE}/solution?action=preview`, {
        method: 'POST',
        body: JSON.stringify({ contextId, programId }),
      }),
  };

  // Postman sync
  postman = {
    sync: () =>
      this.request<{ 
        collections: number; 
        operations: number; 
        updated: string[] 
      }>(`${API_BASE}/postman-sync`, {
        method: 'POST',
      }),
    
    getStatus: () =>
      this.request<{ 
        lastSync: Date; 
        status: 'idle' | 'syncing' | 'error';
        message?: string;
      }>(`${API_BASE}/postman-sync`),
  };

  // Generators API
  generators = {
    // Generate a document
    generate: (request: import('./generators/types').GeneratorRequest) =>
      this.request<import('./generators/types').GeneratedDocument>(`${API_BASE}/generators`, {
        method: 'POST',
        body: JSON.stringify(request),
      }),
    
    // Get generation status
    getStatus: (id: string) =>
      this.request<import('./generators/types').GeneratorResponse>(`${API_BASE}/generators/${id}`),
    
    // Get generation history
    getHistory: (params?: { type?: string; limit?: number }) =>
      this.request<import('./generators/types').GeneratorHistoryItem[]>(
        `${API_BASE}/generators/history?${new URLSearchParams(params as any).toString()}`
      ),
    
    // Export document in specific format
    export: (documentId: string, format: import('./generators/types').ExportFormat) =>
      this.request<{ url: string; format: string }>(`${API_BASE}/generators/${documentId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      }),
    
    // List available generator types
    getTypes: () =>
      this.request<import('./generators/types').GeneratorMetadata[]>(`${API_BASE}/generators/types`),
  };

  // Dashboard
  dashboard = {
    getStats: () =>
      this.request<{
        contexts: number;
        programs: number;
        recentActivity: Array<{
          _id?: string;
          type: 'context' | 'program' | 'sync' | 'system';
          name: string;
          action: 'created' | 'modified' | 'deleted' | 'synced';
          timestamp: Date;
          user?: string;
        }>;
        lastSync?: Date;
        systemHealth: {
          database: 'connected' | 'disconnected';
          lastCheck: Date;
        };
      }>(`${API_BASE}/dashboard`),
  };

  // Schema introspection
  schema = {
    introspect: (apiKey: string, operationName?: string, operationType?: 'query' | 'mutation' | 'subscription') =>
      this.request<{
        success: boolean;
        operation?: string;
        type?: string;
        inputs?: Record<string, any>;
        summary?: {
          queries: Array<{ name: string; description?: string; deprecated?: boolean }>;
          mutations: Array<{ name: string; description?: string; deprecated?: boolean }>;
          subscriptions: Array<{ name: string; description?: string; deprecated?: boolean }>;
        };
        inputTypes?: Array<{
          name: string;
          description?: string;
          fields?: Array<any>;
        }>;
        totalTypes?: number;
      }>(`${API_BASE}/introspect-schema`, {
        method: 'POST',
        body: JSON.stringify({ 
          apiKey, 
          operationName, 
          operationType,
          endpoint: 'https://api.us.test.highnote.com/graphql'
        }),
      }),
    
    enrichOperation: (operationId: string, apiKey: string) =>
      this.request<{
        success: boolean;
        operation: Operation;
      }>(`${API_BASE}/operations/${operationId}/enrich`, {
        method: 'POST',
        body: JSON.stringify({ apiKey }),
      }),
  };

  // Operations APIs
  operations = {
    list: (params?: { 
      vendor?: string; 
      category?: string; 
      type?: string; 
      tags?: string[];
      groupBy?: 'category';
      search?: string;
      page?: number;
      pageSize?: number;
    }) => 
      this.request<{
        data: Operation[] | Record<string, Operation[]>;
        pagination: {
          page: number;
          pageSize: number;
          totalCount: number;
          totalPages: number;
          hasNext: boolean;
          hasPrev: boolean;
        };
      } | Operation[]>(
        `${API_BASE}/operations?${new URLSearchParams(params as any).toString()}`
      ),
    
    get: (id: string) => 
      this.request<Operation>(`${API_BASE}/operations/${id}`),
    
    create: (data: Omit<Operation, '_id'>) => 
      this.request<Operation>(`${API_BASE}/operations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    
    update: (id: string, data: Partial<Operation>) => 
      this.request<Operation>(`${API_BASE}/operations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    
    delete: (id: string) => 
      this.request<void>(`${API_BASE}/operations/${id}`, {
        method: 'DELETE',
      }),
    
    migrate: (postmanCollection?: any) =>
      this.request<{
        success: boolean;
        message: string;
        stats: {
          total?: number;
          inserted?: number;
          updated?: number;
          skipped?: number;
          collections?: number;
          totalOperations?: number;
        };
      }>(`${API_BASE}/migrate-operations`, {
        method: 'POST',
        body: JSON.stringify(postmanCollection ? { postmanCollection } : { scanDirectory: true }),
      }),
    
    migrateJson: () =>
      this.request<{
        success: boolean;
        message: string;
        stats: {
          filesProcessed: number;
          totalOperations: number;
          inserted: number;
          updated: number;
          failed: number;
        };
        details: {
          processed: string[];
          failed: { file: string; error: string }[];
        };
      }>(`${API_BASE}/migrate-operations-json`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    
    migrateEnhanced: () =>
      this.request<{
        success: boolean;
        message: string;
        stats: {
          filesProcessed: number;
          totalOperations: number;
          inserted: number;
          updated: number;
          failed: number;
          missingQueries: number;
        };
        details: {
          processed: string[];
          failed: { file: string; error: string }[];
          missingQueries: string[];
        };
      }>(`${API_BASE}/migrate-operations-enhanced`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    
    analyzeDuplicates: () =>
      this.request<{
        success: boolean;
        stats: {
          totalOperations: number;
          totalDuplicates: number;
          totalGroups: number;
          percentDuplicated: string;
        };
        duplicateGroups: Array<{
          key: string;
          name: string;
          vendor: string;
          category: string;
          count: number;
          duplicates: number;
          operations: any[];
        }>;
      }>(`${API_BASE}/dedup-operations?action=analyze`),
    
    deduplicate: (options?: { 
      strategy?: 'keep-newest' | 'keep-oldest' | 'keep-import';
      dryRun?: boolean;
    }) =>
      this.request<{
        success: boolean;
        dryRun: boolean;
        strategy: string;
        results: {
          processed: number;
          kept: number;
          removed: number;
          errors: number;
          details: any[];
        };
        message: string;
      }>(`${API_BASE}/dedup-operations?action=deduplicate`, {
        method: 'POST',
        body: JSON.stringify(options || { strategy: 'keep-newest', dryRun: false }),
      }),
  };
}

export const api = new ApiClient();