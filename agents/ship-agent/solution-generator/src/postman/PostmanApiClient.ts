import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface PostmanWorkspace {
  id: string;
  name: string;
  type: string;
}

export interface PostmanCollection {
  id: string;
  name: string;
  uid: string;
  owner: string;
  createdAt: string;
  updatedAt: string;
}

export interface PostmanCollectionDetails {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: any[];
  variable?: any[];
  auth?: any;
}

export interface PostmanEnvironment {
  id: string;
  name: string;
  owner: string;
  uid: string;
}

export class PostmanApiClient {
  private client: AxiosInstance;
  private apiKey: string;
  private workspaceId?: string;

  constructor(apiKey: string, workspaceId?: string) {
    this.apiKey = apiKey;
    this.workspaceId = workspaceId;
    
    this.client = axios.create({
      baseURL: 'https://api.getpostman.com',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Get all workspaces
   */
  async getWorkspaces(): Promise<PostmanWorkspace[]> {
    try {
      const response = await this.client.get('/workspaces');
      return response.data.workspaces || [];
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      throw error;
    }
  }

  /**
   * Get all collections in a workspace
   */
  async getCollections(workspaceId?: string): Promise<PostmanCollection[]> {
    const workspace = workspaceId || this.workspaceId;
    if (!workspace) {
      throw new Error('Workspace ID is required');
    }

    try {
      const response = await this.client.get(`/workspaces/${workspace}`);
      return response.data.workspace.collections || [];
    } catch (error) {
      console.error('Error fetching collections:', error);
      throw error;
    }
  }

  /**
   * Get collection details
   */
  async getCollection(collectionId: string): Promise<PostmanCollectionDetails> {
    try {
      const response = await this.client.get(`/collections/${collectionId}`);
      return response.data.collection;
    } catch (error) {
      console.error(`Error fetching collection ${collectionId}:`, error);
      throw error;
    }
  }

  /**
   * Download all collections from workspace
   */
  async downloadAllCollections(outputDir: string, workspaceId?: string): Promise<Map<string, string>> {
    const workspace = workspaceId || this.workspaceId;
    if (!workspace) {
      throw new Error('Workspace ID is required');
    }

    const collectionPaths = new Map<string, string>();
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    console.log(`Fetching collections from workspace ${workspace}...`);
    const collections = await this.getCollections(workspace);
    
    console.log(`Found ${collections.length} collections`);
    
    for (const collection of collections) {
      try {
        console.log(`  Downloading: ${collection.name}...`);
        const details = await this.getCollection(collection.uid);
        
        // Save collection to file
        const filename = `${collection.name.replace(/[^a-z0-9]/gi, '_')}.postman_collection.json`;
        const filepath = path.join(outputDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(details, null, 2));
        collectionPaths.set(collection.name, filepath);
        
        console.log(`    ✓ Saved to ${filename}`);
        
        // Rate limiting - wait 200ms between requests
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`    ✗ Failed to download ${collection.name}:`, error);
      }
    }
    
    return collectionPaths;
  }

  /**
   * Get environments from workspace
   */
  async getEnvironments(workspaceId?: string): Promise<PostmanEnvironment[]> {
    const workspace = workspaceId || this.workspaceId;
    if (!workspace) {
      throw new Error('Workspace ID is required');
    }

    try {
      const response = await this.client.get(`/workspaces/${workspace}`);
      return response.data.workspace.environments || [];
    } catch (error) {
      console.error('Error fetching environments:', error);
      throw error;
    }
  }

  /**
   * Get environment details
   */
  async getEnvironment(environmentId: string): Promise<any> {
    try {
      const response = await this.client.get(`/environments/${environmentId}`);
      return response.data.environment;
    } catch (error) {
      console.error(`Error fetching environment ${environmentId}:`, error);
      throw error;
    }
  }
}