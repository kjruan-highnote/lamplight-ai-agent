"""
MongoDB data source plugin
"""
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import sys
import os

# Add parent directories to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.plugin_base import DataSourcePlugin

logger = logging.getLogger(__name__)

# Optional MongoDB import
try:
    from pymongo import MongoClient
    MONGODB_AVAILABLE = True
except ImportError:
    MONGODB_AVAILABLE = False
    logger.warning("pymongo not installed. MongoDB plugin will work in mock mode.")


class MongoDBPlugin(DataSourcePlugin):
    """
    Plugin for extracting patterns from MongoDB collections
    """
    
    def __init__(self, name: str = "mongodb"):
        super().__init__(name, "1.0.0")
        self.client = None
        self.db = None
        self.collections = {}
        self.mock_mode = not MONGODB_AVAILABLE
        
    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the plugin"""
        self.config = config
        return True
    
    def validate_config(self, config: Dict[str, Any]) -> bool:
        """Validate plugin configuration"""
        if self.mock_mode:
            return True
            
        required = ['connection_string', 'database']
        return all(key in config for key in required)
    
    def connect(self, connection_params: Dict[str, Any]) -> bool:
        """Connect to MongoDB"""
        try:
            if self.mock_mode:
                logger.info("Running in mock mode - no actual MongoDB connection")
                self.db = MockDatabase(connection_params.get('database', 'mock_db'))
                return True
            
            connection_string = connection_params.get('connection_string')
            database_name = connection_params.get('database')
            
            if not connection_string or not database_name:
                return False
            
            self.client = MongoClient(connection_string)
            self.db = self.client[database_name]
            
            # Test connection
            self.db.list_collection_names()
            
            logger.info(f"Connected to MongoDB database: {database_name}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from MongoDB"""
        try:
            if self.client and not self.mock_mode:
                self.client.close()
            self.client = None
            self.db = None
            return True
        except Exception as e:
            logger.error(f"Failed to disconnect from MongoDB: {e}")
            return False
    
    def validate_connection(self) -> bool:
        """Check if connection is active"""
        if self.mock_mode:
            return self.db is not None
            
        try:
            if self.client:
                self.client.server_info()
                return True
        except:
            pass
        return False
    
    def extract_patterns(self, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Extract patterns from MongoDB collections"""
        if not self.db:
            return {'patterns': {}}
        
        patterns = {
            'collections': self._extract_collection_patterns(),
            'schemas': self._extract_schemas(),
            'relationships': self._extract_relationships(),
            'indexes': self._extract_indexes(),
            'data_patterns': self._extract_data_patterns()
        }
        
        return {'patterns': patterns}
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the schema of MongoDB collections"""
        if not self.db:
            return {}
        
        schema = {
            'database': self.db.name if hasattr(self.db, 'name') else 'unknown',
            'collections': {}
        }
        
        for collection_name in self._get_collection_names():
            schema['collections'][collection_name] = self._get_collection_schema(collection_name)
        
        return schema
    
    def _get_collection_names(self) -> List[str]:
        """Get list of collection names"""
        if self.mock_mode:
            return self.db.list_collection_names()
        return self.db.list_collection_names()
    
    def _extract_collection_patterns(self) -> Dict[str, Any]:
        """Extract patterns from all collections"""
        patterns = {}
        
        for collection_name in self._get_collection_names():
            patterns[collection_name] = {
                'name': collection_name,
                'type': self._classify_collection(collection_name),
                'sample_count': self._get_collection_count(collection_name),
                'sample_document': self._get_sample_document(collection_name)
            }
        
        return patterns
    
    def _classify_collection(self, collection_name: str) -> str:
        """Classify collection type based on name"""
        name_lower = collection_name.lower()
        
        if 'user' in name_lower or 'account' in name_lower:
            return 'user_data'
        elif 'transaction' in name_lower or 'payment' in name_lower:
            return 'transaction_data'
        elif 'product' in name_lower or 'card' in name_lower:
            return 'product_data'
        elif 'config' in name_lower or 'setting' in name_lower:
            return 'configuration'
        elif 'log' in name_lower or 'audit' in name_lower:
            return 'logging'
        else:
            return 'general'
    
    def _get_collection_count(self, collection_name: str) -> int:
        """Get document count for collection"""
        try:
            if self.mock_mode:
                return self.db[collection_name].count_documents({})
            return self.db[collection_name].count_documents({})
        except:
            return 0
    
    def _get_sample_document(self, collection_name: str) -> Optional[Dict[str, Any]]:
        """Get a sample document from collection"""
        try:
            if self.mock_mode:
                return self.db[collection_name].find_one()
            
            # Remove _id field for cleaner pattern
            doc = self.db[collection_name].find_one()
            if doc and '_id' in doc:
                del doc['_id']
            return doc
        except:
            return None
    
    def _extract_schemas(self) -> Dict[str, Any]:
        """Extract schema for each collection"""
        schemas = {}
        
        for collection_name in self._get_collection_names():
            schema = self._infer_schema(collection_name)
            if schema:
                schemas[collection_name] = schema
        
        return schemas
    
    def _infer_schema(self, collection_name: str, sample_size: int = 100) -> Dict[str, Any]:
        """Infer schema from collection samples"""
        try:
            # Get sample documents
            if self.mock_mode:
                samples = list(self.db[collection_name].find().limit(sample_size))
            else:
                samples = list(self.db[collection_name].find().limit(sample_size))
            
            if not samples:
                return {}
            
            # Analyze field types and patterns
            schema = {
                'fields': {},
                'required_fields': [],
                'optional_fields': []
            }
            
            field_counts = {}
            field_types = {}
            
            for doc in samples:
                for field, value in doc.items():
                    if field == '_id':
                        continue
                        
                    field_counts[field] = field_counts.get(field, 0) + 1
                    
                    if field not in field_types:
                        field_types[field] = set()
                    field_types[field].add(self._get_type_name(value))
            
            # Build schema
            total_docs = len(samples)
            for field, count in field_counts.items():
                types = list(field_types[field])
                
                schema['fields'][field] = {
                    'types': types,
                    'occurrence': count / total_docs,
                    'example': self._get_field_example(collection_name, field)
                }
                
                if count == total_docs:
                    schema['required_fields'].append(field)
                else:
                    schema['optional_fields'].append(field)
            
            return schema
            
        except Exception as e:
            logger.error(f"Failed to infer schema for {collection_name}: {e}")
            return {}
    
    def _get_type_name(self, value: Any) -> str:
        """Get type name for a value"""
        if value is None:
            return 'null'
        elif isinstance(value, bool):
            return 'boolean'
        elif isinstance(value, int):
            return 'integer'
        elif isinstance(value, float):
            return 'float'
        elif isinstance(value, str):
            return 'string'
        elif isinstance(value, list):
            return 'array'
        elif isinstance(value, dict):
            return 'object'
        elif isinstance(value, datetime):
            return 'datetime'
        else:
            return 'unknown'
    
    def _get_field_example(self, collection_name: str, field: str) -> Any:
        """Get an example value for a field"""
        try:
            doc = self.db[collection_name].find_one({field: {"$exists": True}})
            return doc.get(field) if doc else None
        except:
            return None
    
    def _extract_relationships(self) -> List[Dict[str, Any]]:
        """Extract relationships between collections"""
        relationships = []
        
        # Look for common field names that might indicate relationships
        schemas = self._extract_schemas()
        
        for coll1, schema1 in schemas.items():
            for coll2, schema2 in schemas.items():
                if coll1 >= coll2:  # Avoid duplicates
                    continue
                    
                # Check for potential foreign key relationships
                for field1 in schema1.get('fields', {}):
                    if field1.endswith('_id') or field1.endswith('Id'):
                        # Check if this might reference another collection
                        potential_ref = field1.replace('_id', '').replace('Id', '')
                        if potential_ref in schemas or potential_ref + 's' in schemas:
                            relationships.append({
                                'from': coll1,
                                'to': coll2,
                                'field': field1,
                                'type': 'reference'
                            })
        
        return relationships
    
    def _extract_indexes(self) -> Dict[str, List[Dict[str, Any]]]:
        """Extract index information"""
        indexes = {}
        
        if self.mock_mode:
            return indexes
        
        try:
            for collection_name in self._get_collection_names():
                collection = self.db[collection_name]
                index_info = collection.index_information()
                
                indexes[collection_name] = [
                    {
                        'name': name,
                        'keys': info.get('key'),
                        'unique': info.get('unique', False)
                    }
                    for name, info in index_info.items()
                ]
        except Exception as e:
            logger.error(f"Failed to extract indexes: {e}")
        
        return indexes
    
    def _extract_data_patterns(self) -> Dict[str, Any]:
        """Extract data patterns from collections"""
        patterns = {
            'value_patterns': {},
            'format_patterns': {},
            'range_patterns': {}
        }
        
        for collection_name in self._get_collection_names():
            collection_patterns = self._analyze_collection_data(collection_name)
            if collection_patterns:
                patterns['value_patterns'][collection_name] = collection_patterns
        
        return patterns
    
    def _analyze_collection_data(self, collection_name: str, sample_size: int = 100) -> Dict[str, Any]:
        """Analyze data patterns in a collection"""
        try:
            samples = list(self.db[collection_name].find().limit(sample_size))
            
            if not samples:
                return {}
            
            patterns = {}
            
            for field in samples[0].keys():
                if field == '_id':
                    continue
                    
                values = [doc.get(field) for doc in samples if field in doc]
                
                if values:
                    patterns[field] = self._analyze_field_values(values)
            
            return patterns
            
        except Exception as e:
            logger.error(f"Failed to analyze collection data for {collection_name}: {e}")
            return {}
    
    def _analyze_field_values(self, values: List[Any]) -> Dict[str, Any]:
        """Analyze values for a field"""
        pattern = {
            'type': self._get_type_name(values[0]) if values else 'unknown',
            'unique_count': len(set(str(v) for v in values)),
            'sample_values': list(set(str(v) for v in values[:5]))
        }
        
        # Analyze numeric patterns
        numeric_values = [v for v in values if isinstance(v, (int, float))]
        if numeric_values:
            pattern['numeric'] = {
                'min': min(numeric_values),
                'max': max(numeric_values),
                'avg': sum(numeric_values) / len(numeric_values)
            }
        
        # Analyze string patterns
        string_values = [v for v in values if isinstance(v, str)]
        if string_values:
            pattern['string'] = {
                'min_length': min(len(s) for s in string_values),
                'max_length': max(len(s) for s in string_values),
                'avg_length': sum(len(s) for s in string_values) / len(string_values)
            }
        
        return pattern
    
    def _get_collection_schema(self, collection_name: str) -> Dict[str, Any]:
        """Get schema for a specific collection"""
        return self._infer_schema(collection_name)


class MockDatabase:
    """Mock database for testing without MongoDB"""
    
    def __init__(self, name: str):
        self.name = name
        self.collections = {
            'users': MockCollection('users', [
                {'id': '1', 'name': 'John Doe', 'email': 'john@example.com'},
                {'id': '2', 'name': 'Jane Smith', 'email': 'jane@example.com'}
            ]),
            'transactions': MockCollection('transactions', [
                {'id': 't1', 'user_id': '1', 'amount': 100.00, 'type': 'credit'},
                {'id': 't2', 'user_id': '2', 'amount': 50.00, 'type': 'debit'}
            ]),
            'products': MockCollection('products', [
                {'id': 'p1', 'name': 'Credit Card', 'type': 'credit'},
                {'id': 'p2', 'name': 'Prepaid Card', 'type': 'prepaid'}
            ])
        }
    
    def list_collection_names(self) -> List[str]:
        return list(self.collections.keys())
    
    def __getitem__(self, name: str):
        if name not in self.collections:
            self.collections[name] = MockCollection(name, [])
        return self.collections[name]


class MockCollection:
    """Mock MongoDB collection"""
    
    def __init__(self, name: str, documents: List[Dict[str, Any]]):
        self.name = name
        self.documents = documents
    
    def find(self, filter: Dict[str, Any] = None):
        return MockCursor(self.documents)
    
    def find_one(self, filter: Dict[str, Any] = None):
        return self.documents[0] if self.documents else None
    
    def count_documents(self, filter: Dict[str, Any]):
        return len(self.documents)
    
    def index_information(self):
        return {'_id_': {'key': [('_id', 1)]}}


class MockCursor:
    """Mock MongoDB cursor"""
    
    def __init__(self, documents: List[Dict[str, Any]]):
        self.documents = documents
        self.position = 0
    
    def limit(self, n: int):
        self.documents = self.documents[:n]
        return self
    
    def __iter__(self):
        return iter(self.documents)