import { Handler } from '@netlify/functions';
import { connectToDatabase, headers } from './db';
import { withErrorLogging } from './_middleware';

interface DashboardStats {
  contexts: number;
  programs: number;
  recentActivity: ActivityItem[];
  lastSync?: Date;
  systemHealth: {
    database: 'connected' | 'disconnected';
    lastCheck: Date;
  };
}

interface ActivityItem {
  _id?: string;
  type: 'context' | 'program' | 'sync' | 'system';
  name: string;
  action: 'created' | 'modified' | 'deleted' | 'synced';
  timestamp: Date;
  user?: string;
}

const dashboardHandler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { db } = await connectToDatabase();
    
    // Get counts
    const contextsCount = await db.collection('contexts').countDocuments();
    const programsCount = await db.collection('programs').countDocuments();
    
    // Get recent activity from both collections
    const recentContexts = await db.collection('contexts')
      .find({})
      .sort({ updatedAt: -1 })
      .limit(5)
      .project({ 
        name: 1, 
        'customer.name': 1, 
        updatedAt: 1, 
        createdAt: 1,
        _id: 1 
      })
      .toArray();
    
    const recentPrograms = await db.collection('programs')
      .find({})
      .sort({ updatedAt: -1 })
      .limit(5)
      .project({ 
        name: 1, 
        program_type: 1, 
        updatedAt: 1, 
        createdAt: 1,
        _id: 1 
      })
      .toArray();
    
    // Check for activity collection (for future sync logs)
    const activityCollection = db.collection('activity');
    const syncActivity = await activityCollection
      .find({ type: 'sync' })
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();
    
    // Combine and sort recent activity
    const recentActivity: ActivityItem[] = [];
    
    // Add contexts to activity
    recentContexts.forEach(ctx => {
      const isNew = ctx.createdAt && ctx.updatedAt && 
        new Date(ctx.createdAt).getTime() === new Date(ctx.updatedAt).getTime();
      
      recentActivity.push({
        _id: ctx._id.toString(),
        type: 'context',
        name: ctx.customer?.name || ctx.name || 'Unnamed Context',
        action: isNew ? 'created' : 'modified',
        timestamp: ctx.updatedAt || ctx.createdAt || new Date()
      });
    });
    
    // Add programs to activity
    recentPrograms.forEach(prg => {
      const isNew = prg.createdAt && prg.updatedAt && 
        new Date(prg.createdAt).getTime() === new Date(prg.updatedAt).getTime();
      
      recentActivity.push({
        _id: prg._id.toString(),
        type: 'program',
        name: prg.name || prg.program_type || 'Unnamed Program',
        action: isNew ? 'created' : 'modified',
        timestamp: prg.updatedAt || prg.createdAt || new Date()
      });
    });
    
    // Add sync activity if exists
    if (syncActivity.length > 0) {
      const sync = syncActivity[0];
      recentActivity.push({
        _id: sync._id?.toString(),
        type: 'sync',
        name: sync.name || 'Postman Collections',
        action: 'synced',
        timestamp: sync.timestamp || new Date()
      });
    }
    
    // Sort all activity by timestamp
    recentActivity.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA; // Most recent first
    });
    
    // Limit to 10 most recent items
    const limitedActivity = recentActivity.slice(0, 10);
    
    // Get last sync time (if available)
    const lastSync = syncActivity.length > 0 
      ? syncActivity[0].timestamp 
      : null;
    
    const stats: DashboardStats = {
      contexts: contextsCount,
      programs: programsCount,
      recentActivity: limitedActivity,
      lastSync: lastSync,
      systemHealth: {
        database: 'connected',
        lastCheck: new Date()
      }
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(stats)
    };
    
  } catch (error: any) {
    console.error('Dashboard API Error:', error);
    
    // Return partial data even if there's an error
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        contexts: 0,
        programs: 0,
        recentActivity: [],
        systemHealth: {
          database: 'disconnected',
          lastCheck: new Date()
        },
        error: error.message
      })
    };
  }
};

export const handler = withErrorLogging(dashboardHandler);