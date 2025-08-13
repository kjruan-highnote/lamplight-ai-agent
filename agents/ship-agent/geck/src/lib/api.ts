import { CustomerContext, ProgramConfig } from '../types';

// Use local functions port in development, otherwise use Netlify functions path
const API_BASE = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:9000/.netlify/functions'
  : '/.netlify/functions';

class ApiClient {
  private async request<T>(
    url: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

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
}

export const api = new ApiClient();