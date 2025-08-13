import { Db } from 'mongodb';

export interface ActivityLog {
  type: 'context' | 'program' | 'sync' | 'system';
  action: 'created' | 'modified' | 'deleted' | 'synced' | 'error';
  name: string;
  entityId?: string;
  details?: any;
  timestamp: Date;
  user?: string;
}

export async function logActivity(db: Db, activity: Omit<ActivityLog, 'timestamp'>) {
  try {
    const activityCollection = db.collection('activity');
    
    await activityCollection.insertOne({
      ...activity,
      timestamp: new Date()
    });
    
    // Keep only the last 100 activity logs
    const count = await activityCollection.countDocuments();
    if (count > 100) {
      const oldestLogs = await activityCollection
        .find({})
        .sort({ timestamp: 1 })
        .limit(count - 100)
        .toArray();
      
      const idsToDelete = oldestLogs.map(log => log._id);
      await activityCollection.deleteMany({ _id: { $in: idsToDelete } });
    }
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break the main operation
  }
}