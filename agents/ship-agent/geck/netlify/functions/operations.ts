import { Handler } from '@netlify/functions';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from './db';

export const handler: Handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('operations');
    const segments = event.path.split('/').filter(Boolean);
    const id = segments[segments.length - 1];

    switch (event.httpMethod) {
      case 'GET':
        if (id && id !== 'operations') {
          // Get single operation
          const operation = await collection.findOne({ _id: new ObjectId(id) });
          if (!operation) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Operation not found' })
            };
          }
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(operation)
          };
        } else {
          // Get all operations with optional filters and pagination
          const params = event.queryStringParameters || {};
          const filter: any = {};
          
          // Filters
          if (params.vendor) filter.vendor = params.vendor;
          if (params.category) filter.category = params.category;
          if (params.type) filter.type = params.type;
          if (params.tags) filter.tags = { $in: params.tags.split(',') };
          if (params.search) {
            filter.$or = [
              { name: { $regex: params.search, $options: 'i' } },
              { description: { $regex: params.search, $options: 'i' } },
              { tags: { $in: [new RegExp(params.search, 'i')] } }
            ];
          }
          
          // Pagination
          const page = parseInt(params.page || '1');
          const pageSize = parseInt(params.pageSize || '50');
          const skip = (page - 1) * pageSize;
          
          // Get total count for pagination
          const totalCount = await collection.countDocuments(filter);
          const totalPages = Math.ceil(totalCount / pageSize);
          
          // Get paginated results
          const operations = await collection
            .find(filter)
            .sort({ name: 1, vendor: 1 })
            .skip(skip)
            .limit(pageSize)
            .toArray();
          
          // Group by category if requested
          if (params.groupBy === 'category') {
            const grouped = operations.reduce((acc, op) => {
              const cat = op.category || 'uncategorized';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(op);
              return acc;
            }, {} as Record<string, any[]>);
            
            return {
              statusCode: 200,
              headers,
              body: JSON.stringify({
                data: grouped,
                pagination: {
                  page,
                  pageSize,
                  totalCount,
                  totalPages,
                  hasNext: page < totalPages,
                  hasPrev: page > 1
                }
              })
            };
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
              data: operations,
              pagination: {
                page,
                pageSize,
                totalCount,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
              }
            })
          };
        }

      case 'POST':
        const newOperation = JSON.parse(event.body || '{}');
        
        // Validate required fields
        if (!newOperation.name || !newOperation.type || !newOperation.query) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
              error: 'Missing required fields: name, type, and query are required' 
            })
          };
        }
        
        // Add system fields
        newOperation.createdAt = new Date();
        newOperation.updatedAt = new Date();
        newOperation.source = newOperation.source || 'manual';
        
        // Check for duplicates
        const existing = await collection.findOne({ 
          name: newOperation.name, 
          vendor: newOperation.vendor 
        });
        
        if (existing) {
          return {
            statusCode: 409,
            headers,
            body: JSON.stringify({ 
              error: 'Operation with this name already exists for this vendor' 
            })
          };
        }
        
        const result = await collection.insertOne(newOperation);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify({ 
            ...newOperation, 
            _id: result.insertedId 
          })
        };

      case 'PUT':
        if (!id || id === 'operations') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Operation ID is required' })
          };
        }
        
        const updateData = JSON.parse(event.body || '{}');
        delete updateData._id; // Remove _id from update
        updateData.updatedAt = new Date();
        
        const updateResult = await collection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        
        if (updateResult.matchedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Operation not found' })
          };
        }
        
        const updated = await collection.findOne({ _id: new ObjectId(id) });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updated)
        };

      case 'DELETE':
        if (!id || id === 'operations') {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Operation ID is required' })
          };
        }
        
        const deleteResult = await collection.deleteOne({ _id: new ObjectId(id) });
        
        if (deleteResult.deletedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Operation not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Operation deleted successfully' })
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error: any) {
    console.error('Operation failed:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: error.message 
      })
    };
  }
};