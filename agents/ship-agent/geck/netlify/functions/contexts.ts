import { Handler } from '@netlify/functions';
import { ObjectId } from 'mongodb';
import { connectToDatabase, headers } from './db';

export const handler: Handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { db } = await connectToDatabase();
    const collection = db.collection('contexts');
    const { id, search, tags, action } = event.queryStringParameters || {};

    switch (event.httpMethod) {
      case 'GET':
        if (id) {
          // Get single context
          const context = await collection.findOne({ 
            _id: new ObjectId(id) 
          });
          
          if (!context) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Context not found' })
            };
          }
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(context)
          };
        } else {
          // List contexts with optional filters
          const query: any = {};
          
          if (search) {
            query.$or = [
              { name: { $regex: search, $options: 'i' } },
              { customer: { $regex: search, $options: 'i' } },
              { 'data.customer_name': { $regex: search, $options: 'i' } }
            ];
          }
          
          if (tags) {
            const tagArray = Array.isArray(tags) ? tags : tags.split(',');
            query.tags = { $in: tagArray };
          }
          
          const contexts = await collection
            .find(query)
            .sort({ updatedAt: -1 })
            .toArray();
          
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify(contexts)
          };
        }

      case 'POST':
        if (action === 'duplicate' && id) {
          // Duplicate existing context
          const original = await collection.findOne({ 
            _id: new ObjectId(id) 
          });
          
          if (!original) {
            return {
              statusCode: 404,
              headers,
              body: JSON.stringify({ error: 'Context not found' })
            };
          }
          
          const { newName } = JSON.parse(event.body || '{}');
          const duplicate = {
            ...original,
            _id: new ObjectId(),
            name: newName || `${original.name}_copy`,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const result = await collection.insertOne(duplicate);
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ ...duplicate, _id: result.insertedId })
          };
        } else {
          // Create new context
          const data = JSON.parse(event.body || '{}');
          const newContext = {
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          const result = await collection.insertOne(newContext);
          
          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({ ...newContext, _id: result.insertedId })
          };
        }

      case 'PUT':
        if (!id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'ID required for update' })
          };
        }
        
        const updateData = JSON.parse(event.body || '{}');
        const { _id, ...dataToUpdate } = updateData;
        
        const updateResult = await collection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { 
            $set: {
              ...dataToUpdate,
              updatedAt: new Date()
            }
          },
          { returnDocument: 'after' }
        );
        
        if (!updateResult) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Context not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(updateResult)
        };

      case 'DELETE':
        if (!id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'ID required for delete' })
          };
        }
        
        const deleteResult = await collection.deleteOne({ 
          _id: new ObjectId(id) 
        });
        
        if (deleteResult.deletedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Context not found' })
          };
        }
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ message: 'Context deleted successfully' })
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error: any) {
    console.error('Context API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' })
    };
  }
};