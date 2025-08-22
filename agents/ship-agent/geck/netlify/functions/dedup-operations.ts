import { Handler } from '@netlify/functions';
import { connectToDatabase } from './db';
import { ObjectId } from 'mongodb';

interface DuplicateGroup {
  key: string;
  operations: any[];
  count: number;
}

export const handler: Handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST' && event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('operations');
    
    const params = event.queryStringParameters || {};
    const action = params.action || 'analyze';

    if (event.httpMethod === 'GET' || action === 'analyze') {
      // Analyze duplicates without removing them - group by name only
      const pipeline = [
        {
          $group: {
            _id: '$name',
            operations: { $push: '$$ROOT' },
            count: { $sum: 1 },
            categories: { $addToSet: '$category' },
            vendors: { $addToSet: '$vendor' },
            types: { $addToSet: '$type' }
          }
        },
        {
          $match: {
            count: { $gt: 1 }
          }
        },
        {
          $project: {
            name: '$_id',
            count: 1,
            categories: 1,
            vendors: 1,
            types: 1,
            operations: {
              $map: {
                input: '$operations',
                as: 'op',
                in: {
                  _id: '$$op._id',
                  name: '$$op.name',
                  vendor: '$$op.vendor',
                  category: '$$op.category',
                  createdAt: '$$op.createdAt',
                  updatedAt: '$$op.updatedAt',
                  source: '$$op.source',
                  required: '$$op.required',
                  type: '$$op.type',
                  description: '$$op.description',
                  tags: '$$op.tags'
                }
              }
            }
          }
        },
        {
          $sort: { count: -1, name: 1 }
        }
      ];

      const duplicates = await collection.aggregate(pipeline).toArray();
      
      // Calculate statistics
      const totalDuplicates = duplicates.reduce((sum, group) => sum + group.count - 1, 0);
      const totalGroups = duplicates.length;
      const totalOperations = await collection.countDocuments();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          stats: {
            totalOperations,
            totalDuplicates,
            totalGroups,
            percentDuplicated: totalOperations > 0 
              ? ((totalDuplicates / totalOperations) * 100).toFixed(2) + '%'
              : '0%'
          },
          duplicateGroups: duplicates.map(group => ({
            name: group.name,
            count: group.count,
            duplicates: group.count - 1,
            categories: group.categories.filter(Boolean),
            vendors: group.vendors.filter(Boolean),
            types: group.types.filter(Boolean),
            operations: group.operations.sort((a: any, b: any) => {
              // Sort by: 1) import source first, 2) most recent update, 3) creation date
              if (a.source === 'import' && b.source !== 'import') return -1;
              if (a.source !== 'import' && b.source === 'import') return 1;
              
              const aDate = new Date(a.updatedAt || a.createdAt).getTime();
              const bDate = new Date(b.updatedAt || b.createdAt).getTime();
              return bDate - aDate;
            })
          }))
        })
      };

    } else if (event.httpMethod === 'POST' && action === 'deduplicate') {
      // Actually perform deduplication
      const body = event.body ? JSON.parse(event.body) : {};
      const strategy = body.strategy || 'keep-newest'; // keep-newest, keep-oldest, keep-import
      const dryRun = body.dryRun === true;
      
      // Find all duplicate groups - group by name only
      const pipeline = [
        {
          $group: {
            _id: '$name',
            operations: { $push: '$$ROOT' },
            count: { $sum: 1 }
          }
        },
        {
          $match: {
            count: { $gt: 1 }
          }
        }
      ];

      const duplicateGroups = await collection.aggregate(pipeline).toArray();
      
      const results = {
        processed: 0,
        kept: 0,
        removed: 0,
        errors: 0,
        details: [] as any[]
      };

      for (const group of duplicateGroups) {
        try {
          const operations = group.operations;
          let operationToKeep: any;
          let operationsToRemove: any[] = [];

          // Determine which operation to keep based on strategy
          switch (strategy) {
            case 'keep-oldest':
              operations.sort((a: any, b: any) => {
                const aDate = new Date(a.createdAt || 0).getTime();
                const bDate = new Date(b.createdAt || 0).getTime();
                return aDate - bDate;
              });
              operationToKeep = operations[0];
              operationsToRemove = operations.slice(1);
              break;

            case 'keep-import':
              // Keep the one from import source, or newest if none from import
              operations.sort((a: any, b: any) => {
                if (a.source === 'import' && b.source !== 'import') return -1;
                if (a.source !== 'import' && b.source === 'import') return 1;
                
                const aDate = new Date(a.updatedAt || a.createdAt).getTime();
                const bDate = new Date(b.updatedAt || b.createdAt).getTime();
                return bDate - aDate;
              });
              operationToKeep = operations[0];
              operationsToRemove = operations.slice(1);
              break;

            case 'keep-newest':
            default:
              operations.sort((a: any, b: any) => {
                const aDate = new Date(a.updatedAt || a.createdAt).getTime();
                const bDate = new Date(b.updatedAt || b.createdAt).getTime();
                return bDate - aDate;
              });
              operationToKeep = operations[0];
              operationsToRemove = operations.slice(1);
              break;
          }

          // Merge ALL metadata from duplicates
          // Collect all unique categories
          const allCategories = new Set<string>();
          operations.forEach((op: any) => {
            if (op.category) allCategories.add(op.category);
          });
          
          // Collect all unique vendors
          const allVendors = new Set<string>();
          operations.forEach((op: any) => {
            if (op.vendor) allVendors.add(op.vendor);
          });
          
          // Keep the most complete description
          const bestDescription = operations
            .map((op: any) => op.description)
            .filter(Boolean)
            .sort((a: string, b: string) => b.length - a.length)[0];
          
          // Combine all unique tags
          const allTags = new Set<string>();
          operations.forEach((op: any) => {
            if (op.tags && Array.isArray(op.tags)) {
              op.tags.forEach((tag: string) => allTags.add(tag));
            }
          });

          // Add categories and vendors to tags for searchability
          allCategories.forEach(cat => allTags.add(cat));
          allVendors.forEach(vendor => allTags.add(vendor.toLowerCase().replace(/\s+/g, '-')));

          // Merge variables (keep the most complete set)
          const mergedVariables = operations.reduce((acc: any, op: any) => {
            if (op.variables && typeof op.variables === 'object') {
              return { ...acc, ...op.variables };
            }
            return acc;
          }, {});

          // Keep the most complete query (longest one)
          const bestQuery = operations
            .map((op: any) => op.query)
            .filter(Boolean)
            .sort((a: string, b: string) => b.length - a.length)[0];
          
          // Determine if operation is required (true if ANY duplicate is required)
          const isRequired = operations.some((op: any) => op.required === true);
          
          // Create metadata object to store all sources
          const metadata = {
            categories: Array.from(allCategories),
            vendors: Array.from(allVendors),
            sources: operations.map((op: any) => ({
              _id: op._id,
              category: op.category,
              vendor: op.vendor,
              source: op.source,
              createdAt: op.createdAt
            }))
          };

          if (!dryRun) {
            // Update the keeper with merged information
            const updateData: any = {
              updatedAt: new Date(),
              required: isRequired,
              metadata: metadata
            };
            
            // Since we're merging from multiple sources, set primary category/vendor to most common or first
            updateData.category = Array.from(allCategories)[0] || operationToKeep.category;
            updateData.vendor = Array.from(allVendors)[0] || operationToKeep.vendor;
            
            if (bestDescription && (!operationToKeep.description || bestDescription.length > operationToKeep.description.length)) {
              updateData.description = bestDescription;
            }
            
            if (allTags.size > 0) {
              updateData.tags = Array.from(allTags);
            }
            
            if (Object.keys(mergedVariables).length > 0) {
              updateData.variables = mergedVariables;
            }
            
            if (bestQuery && (!operationToKeep.query || bestQuery.length > operationToKeep.query.length)) {
              updateData.query = bestQuery;
            }

            // Update the operation we're keeping with merged data
            await collection.updateOne(
              { _id: new ObjectId(operationToKeep._id) },
              { $set: updateData }
            );

            // Remove the duplicates
            const idsToRemove = operationsToRemove.map(op => new ObjectId(op._id));
            await collection.deleteMany({ _id: { $in: idsToRemove } });
            
            results.removed += operationsToRemove.length;
          }

          results.processed++;
          results.kept++;
          
          results.details.push({
            group: group._id,
            kept: {
              _id: operationToKeep._id,
              source: operationToKeep.source,
              createdAt: operationToKeep.createdAt,
              updatedAt: operationToKeep.updatedAt
            },
            removed: operationsToRemove.map(op => ({
              _id: op._id,
              source: op.source,
              category: op.category,
              vendor: op.vendor,
              createdAt: op.createdAt
            })),
            mergedMetadata: {
              categories: Array.from(allCategories),
              vendors: Array.from(allVendors),
              totalSourcesMerged: operations.length
            }
          });

        } catch (error: any) {
          console.error(`Error processing group ${group._id}:`, error);
          results.errors++;
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          dryRun,
          strategy,
          results,
          message: dryRun 
            ? `Dry run complete. Would remove ${results.removed} duplicates.`
            : `Deduplication complete. Removed ${results.removed} duplicates.`
        })
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' })
    };

  } catch (error: any) {
    console.error('Deduplication failed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};