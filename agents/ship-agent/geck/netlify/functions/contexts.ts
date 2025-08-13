import { Handler } from '@netlify/functions';
import { ObjectId } from 'mongodb';
import { connectToDatabase, headers } from './db';
import { withErrorLogging } from './_middleware';
import { logActivity } from './activity';

const contextHandler: Handler = async (event) => {
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
          let query: any = {};
          
          // Check if ID is a valid ObjectId format (24 hex chars)
          if (/^[0-9a-fA-F]{24}$/.test(id)) {
            query._id = new ObjectId(id);
          } else {
            // For non-ObjectId formats, search by string ID
            query._id = id;
          }
          
          const context = await collection.findOne(query);
          
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
          let query: any = {};
          if (/^[0-9a-fA-F]{24}$/.test(id)) {
            query._id = new ObjectId(id);
          } else {
            query._id = id;
          }
          
          const original = await collection.findOne(query);
          
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
          
          // Log activity
          await logActivity(db, {
            type: 'context',
            action: 'created',
            name: duplicate.customer?.name || duplicate.name || 'Unnamed Context',
            entityId: result.insertedId.toString(),
            details: { duplicatedFrom: id }
          });
          
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
          
          // Log activity
          await logActivity(db, {
            type: 'context',
            action: 'created',
            name: newContext.customer?.name || newContext.name || 'Unnamed Context',
            entityId: result.insertedId.toString()
          });
          
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
        
        let updateQuery: any = {};
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
          updateQuery._id = new ObjectId(id);
        } else {
          updateQuery._id = id;
        }
        
        const updateResult = await collection.findOneAndUpdate(
          updateQuery,
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
        
        // Log activity
        await logActivity(db, {
          type: 'context',
          action: 'modified',
          name: updateResult.customer?.name || updateResult.name || 'Unnamed Context',
          entityId: id
        });
        
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
        
        let deleteQuery: any = {};
        if (/^[0-9a-fA-F]{24}$/.test(id)) {
          deleteQuery._id = new ObjectId(id);
        } else {
          deleteQuery._id = id;
        }
        
        // Get context name before deletion for activity log
        const contextToDelete = await collection.findOne(deleteQuery);
        
        const deleteResult = await collection.deleteOne(deleteQuery);
        
        if (deleteResult.deletedCount === 0) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Context not found' })
          };
        }
        
        // Log activity
        await logActivity(db, {
          type: 'context',
          action: 'deleted',
          name: contextToDelete?.customer?.name || contextToDelete?.name || 'Unnamed Context',
          entityId: id
        });
        
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

export const handler = withErrorLogging(contextHandler);