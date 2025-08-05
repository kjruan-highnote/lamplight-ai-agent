"""
Migration tool to extract operations from Postman collections and store in MongoDB
"""
import json
import os
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from pathlib import Path
import argparse

# MongoDB connection (optional)
try:
    from pymongo import MongoClient
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False
    print("Warning: pymongo not installed. Will output to JSON file instead.")


class PostmanToMongoDBMigrator:
    """
    Migrates Postman collection operations to MongoDB or JSON
    """
    
    def __init__(self, mongodb_uri: Optional[str] = None, database_name: str = "ship_agent"):
        self.mongodb = None
        self.database_name = database_name
        
        if MONGODB_AVAILABLE and mongodb_uri:
            try:
                client = MongoClient(mongodb_uri)
                self.mongodb = client[database_name]
                print(f"Connected to MongoDB database: {database_name}")
            except Exception as e:
                print(f"MongoDB connection failed: {e}")
                print("Will output to JSON file instead.")
    
    def migrate_collection(self, postman_file_path: str, program_type: str = "consumer_credit") -> Dict[str, Any]:
        """
        Migrate a Postman collection to MongoDB operations
        """
        # Load Postman collection
        with open(postman_file_path, 'r') as f:
            collection = json.load(f)
        
        print(f"Loading collection: {collection['info']['name']}")
        
        # Extract operations
        operations = self._extract_operations(collection, program_type)
        
        print(f"Extracted {len(operations)} operations")
        
        # Store operations
        if self.mongodb:
            self._store_in_mongodb(operations)
        else:
            self._store_in_json(operations, program_type)
        
        # Generate summary
        summary = self._generate_summary(operations)
        
        return {
            'collection_name': collection['info']['name'],
            'program_type': program_type,
            'total_operations': len(operations),
            'summary': summary
        }
    
    def _extract_operations(self, collection: Dict[str, Any], program_type: str) -> List[Dict[str, Any]]:
        """
        Extract all operations from Postman collection
        """
        operations = []
        
        # Extract from items recursively
        self._extract_from_items(
            collection.get('item', []),
            operations,
            program_type,
            category=""
        )
        
        return operations
    
    def _extract_from_items(self, items: List[Dict[str, Any]], operations: List[Dict[str, Any]], 
                           program_type: str, category: str = "", path: str = ""):
        """
        Recursively extract operations from Postman items
        """
        for item in items:
            current_path = f"{path}/{item.get('name', '')}" if path else item.get('name', '')
            
            if 'item' in item:
                # It's a folder - recurse
                folder_name = item.get('name', 'Unknown')
                self._extract_from_items(
                    item['item'],
                    operations,
                    program_type,
                    category=self._normalize_category(folder_name),
                    path=current_path
                )
            else:
                # It's a request - extract operation
                operation = self._extract_operation(item, program_type, category, current_path)
                if operation:
                    operations.append(operation)
    
    def _extract_operation(self, item: Dict[str, Any], program_type: str, 
                          category: str, path: str) -> Optional[Dict[str, Any]]:
        """
        Extract operation from a Postman request item
        """
        request = item.get('request', {})
        if not request:
            return None
        
        # Extract operation name
        name = self._normalize_operation_name(item.get('name', 'Unknown'))
        
        # Extract GraphQL query/mutation
        body = request.get('body', {})
        graphql_data = self._extract_graphql(body)
        
        if not graphql_data:
            return None
        
        # Determine operation type
        operation_type = self._determine_operation_type(graphql_data['query'])
        
        # Extract headers
        headers = {}
        for header in request.get('header', []):
            if isinstance(header, dict):
                headers[header.get('key', '')] = header.get('value', '')
        
        # Build operation document
        operation = {
            'name': name,
            'program_type': program_type,
            'operation_type': operation_type,
            'graphql': graphql_data,
            'headers': headers,
            'metadata': {
                'category': category,
                'path': path,
                'description': item.get('description', ''),
                'tags': self._extract_tags(name, category),
                'requires': self._extract_requirements(graphql_data),
                'produces': self._extract_outputs(graphql_data)
            },
            'version': '1.0.0',
            'created_at': datetime.now(),
            'updated_at': datetime.now()
        }
        
        return operation
    
    def _extract_graphql(self, body: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Extract GraphQL query and variables from request body
        """
        if body.get('mode') == 'graphql':
            graphql = body.get('graphql', {})
            return {
                'query': graphql.get('query', ''),
                'variables': self._parse_variables(graphql.get('variables', ''))
            }
        elif body.get('mode') == 'raw':
            # Try to parse raw JSON body
            try:
                raw_data = json.loads(body.get('raw', '{}'))
                if 'query' in raw_data:
                    return {
                        'query': raw_data['query'],
                        'variables': raw_data.get('variables', {})
                    }
            except:
                pass
        
        return None
    
    def _parse_variables(self, variables: Any) -> Dict[str, Any]:
        """
        Parse variables from string or dict
        """
        if isinstance(variables, str):
            try:
                return json.loads(variables)
            except:
                return {}
        elif isinstance(variables, dict):
            return variables
        return {}
    
    def _determine_operation_type(self, query: str) -> str:
        """
        Determine if operation is query or mutation
        """
        if query.strip().startswith('mutation'):
            return 'mutation'
        return 'query'
    
    def _normalize_operation_name(self, name: str) -> str:
        """
        Normalize operation name to PascalCase
        """
        # Remove special characters and convert to PascalCase
        words = re.findall(r'\w+', name)
        return ''.join(word.capitalize() for word in words)
    
    def _normalize_category(self, folder_name: str) -> str:
        """
        Normalize folder name to category
        """
        # Convert to snake_case
        name = re.sub(r'[^\w\s]', '', folder_name)
        name = re.sub(r'\s+', '_', name)
        return name.lower()
    
    def _extract_tags(self, name: str, category: str) -> List[str]:
        """
        Extract tags from operation name and category
        """
        tags = [category]
        
        # Add tags based on keywords in name
        keywords = {
            'create': 'creation',
            'update': 'modification',
            'delete': 'deletion',
            'get': 'retrieval',
            'search': 'search',
            'simulate': 'simulation',
            'issue': 'issuance',
            'activate': 'activation',
            'suspend': 'suspension'
        }
        
        name_lower = name.lower()
        for keyword, tag in keywords.items():
            if keyword in name_lower:
                tags.append(tag)
        
        return tags
    
    def _extract_requirements(self, graphql_data: Dict[str, Any]) -> List[str]:
        """
        Extract required fields from GraphQL variables
        """
        requirements = []
        variables = graphql_data.get('variables', {})
        
        # Extract fields marked with {{}} placeholders
        def extract_placeholders(obj: Any):
            if isinstance(obj, str):
                matches = re.findall(r'\{\{(\w+)\}\}', obj)
                requirements.extend(matches)
            elif isinstance(obj, dict):
                for value in obj.values():
                    extract_placeholders(value)
            elif isinstance(obj, list):
                for item in obj:
                    extract_placeholders(item)
        
        extract_placeholders(variables)
        return list(set(requirements))
    
    def _extract_outputs(self, graphql_data: Dict[str, Any]) -> List[str]:
        """
        Extract output fields from GraphQL query
        """
        outputs = []
        query = graphql_data.get('query', '')
        
        # Simple extraction of top-level fields after operation name
        # This is a simplified approach - could be enhanced with proper GraphQL parsing
        matches = re.findall(r'{\s*(\w+)\s*[:{]', query)
        outputs.extend(matches[:5])  # Limit to first 5 to avoid noise
        
        return outputs
    
    def _store_in_mongodb(self, operations: List[Dict[str, Any]]):
        """
        Store operations in MongoDB
        """
        collection = self.mongodb.operations
        
        for operation in operations:
            try:
                # Use replace_one with upsert to avoid duplicates
                collection.replace_one(
                    {
                        'name': operation['name'],
                        'program_type': operation['program_type']
                    },
                    operation,
                    upsert=True
                )
                print(f"  Stored: {operation['name']}")
            except Exception as e:
                print(f"  Error storing {operation['name']}: {e}")
    
    def _store_in_json(self, operations: List[Dict[str, Any]], program_type: str):
        """
        Store operations in JSON file
        """
        output_dir = Path("data/operations")
        output_dir.mkdir(parents=True, exist_ok=True)
        
        output_file = output_dir / f"{program_type}_operations.json"
        
        # Convert datetime objects to strings
        for op in operations:
            if isinstance(op.get('created_at'), datetime):
                op['created_at'] = op['created_at'].isoformat()
            if isinstance(op.get('updated_at'), datetime):
                op['updated_at'] = op['updated_at'].isoformat()
        
        with open(output_file, 'w') as f:
            json.dump(operations, f, indent=2)
        
        print(f"Saved {len(operations)} operations to {output_file}")
    
    def _generate_summary(self, operations: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate summary of extracted operations
        """
        summary = {
            'total': len(operations),
            'by_type': {},
            'by_category': {}
        }
        
        for op in operations:
            # Count by type
            op_type = op['operation_type']
            summary['by_type'][op_type] = summary['by_type'].get(op_type, 0) + 1
            
            # Count by category
            category = op['metadata']['category']
            summary['by_category'][category] = summary['by_category'].get(category, 0) + 1
        
        return summary


def main():
    """
    CLI entry point for migration tool
    """
    parser = argparse.ArgumentParser(description='Migrate Postman collection to MongoDB')
    parser.add_argument('postman_file', help='Path to Postman collection JSON file')
    parser.add_argument('--program-type', default='consumer_credit', help='Program type name')
    parser.add_argument('--mongodb-uri', help='MongoDB connection URI')
    parser.add_argument('--database', default='ship_agent', help='MongoDB database name')
    
    args = parser.parse_args()
    
    # Run migration
    migrator = PostmanToMongoDBMigrator(
        mongodb_uri=args.mongodb_uri or os.getenv('MONGODB_URI'),
        database_name=args.database
    )
    
    result = migrator.migrate_collection(
        args.postman_file,
        args.program_type
    )
    
    # Print results
    print("\n" + "="*50)
    print("Migration Complete!")
    print("="*50)
    print(f"Collection: {result['collection_name']}")
    print(f"Program Type: {result['program_type']}")
    print(f"Total Operations: {result['total_operations']}")
    print("\nSummary by Type:")
    for op_type, count in result['summary']['by_type'].items():
        print(f"  {op_type}: {count}")
    print("\nSummary by Category:")
    for category, count in result['summary']['by_category'].items():
        print(f"  {category}: {count}")


if __name__ == "__main__":
    # If run directly, migrate the Consumer Credit collection
    migrator = PostmanToMongoDBMigrator()
    
    postman_file = "data/postman/Consumer Credit.postman_collection.json"
    if Path(postman_file).exists():
        result = migrator.migrate_collection(postman_file, "consumer_credit")
        print(f"\nMigration complete: {result['total_operations']} operations processed")