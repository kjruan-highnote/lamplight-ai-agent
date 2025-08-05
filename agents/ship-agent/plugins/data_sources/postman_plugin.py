"""
Postman collection data source plugin
"""
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
import sys
import os

# Add parent directories to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.plugin_base import DataSourcePlugin

logger = logging.getLogger(__name__)


class PostmanPlugin(DataSourcePlugin):
    """
    Plugin for parsing and extracting patterns from Postman collections
    """
    
    def __init__(self, name: str = "postman"):
        super().__init__(name, "1.0.0")
        self.collection = None
        self.folder_structure = {}
        self.patterns = {}
        
    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the plugin"""
        self.config = config
        return True
    
    def validate_config(self, config: Dict[str, Any]) -> bool:
        """Validate plugin configuration"""
        # No specific config required for Postman
        return True
    
    def connect(self, connection_params: Dict[str, Any]) -> bool:
        """Connect to data source (load collection)"""
        try:
            if 'collection' in connection_params:
                self.collection = connection_params['collection']
            elif 'file_path' in connection_params:
                with open(connection_params['file_path'], 'r') as f:
                    self.collection = json.load(f)
            else:
                return False
            
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Postman collection: {e}")
            return False
    
    def disconnect(self) -> bool:
        """Disconnect from data source"""
        self.collection = None
        return True
    
    def validate_connection(self) -> bool:
        """Check if collection is loaded"""
        return self.collection is not None
    
    def extract_patterns(self, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Extract patterns from Postman collection"""
        if query and 'collection' in query:
            self.collection = query['collection']
        
        if not self.collection:
            return {'patterns': {}}
        
        patterns = {
            'folder_structure': self._extract_folder_structure(),
            'endpoints': self._extract_endpoints(),
            'auth_patterns': self._extract_auth_patterns(),
            'data_patterns': self._extract_data_patterns(),
            'program_patterns': self._extract_program_patterns()
        }
        
        self.patterns = patterns
        return {'patterns': patterns}
    
    def get_schema(self) -> Dict[str, Any]:
        """Get the schema of the Postman collection"""
        if not self.collection:
            return {}
        
        return {
            'info': self.collection.get('info', {}),
            'structure': self._get_collection_structure(),
            'variables': self.collection.get('variable', []),
            'auth': self.collection.get('auth', {})
        }
    
    def _extract_folder_structure(self) -> Dict[str, Any]:
        """Extract folder hierarchy (customers, program types, etc.)"""
        structure = {}
        
        if 'item' in self.collection:
            for item in self.collection['item']:
                if 'item' in item:  # It's a folder
                    folder_name = item.get('name', 'unnamed')
                    structure[folder_name] = {
                        'type': self._classify_folder(folder_name),
                        'items': self._extract_folder_items(item['item'])
                    }
        
        return structure
    
    def _classify_folder(self, folder_name: str) -> str:
        """Classify folder type based on name"""
        name_lower = folder_name.lower()
        
        # Check for program types
        if any(prog in name_lower for prog in ['prepaid', 'credit', 'debit']):
            return 'program_type'
        elif any(seg in name_lower for seg in ['commercial', 'consumer', 'corporate']):
            return 'segment'
        elif any(feat in name_lower for feat in ['acquiring', 'ap_automation', 'expense']):
            return 'feature'
        else:
            # Assume customer name if no other classification
            return 'customer'
    
    def _extract_folder_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract items from a folder"""
        extracted = []
        
        for item in items:
            if 'item' in item:  # Subfolder
                extracted.append({
                    'type': 'folder',
                    'name': item.get('name', 'unnamed'),
                    'items': self._extract_folder_items(item['item'])
                })
            else:  # Request
                extracted.append({
                    'type': 'request',
                    'name': item.get('name', 'unnamed'),
                    'method': item.get('request', {}).get('method', 'GET'),
                    'url': item.get('request', {}).get('url', '')
                })
        
        return extracted
    
    def _extract_endpoints(self) -> List[Dict[str, Any]]:
        """Extract all endpoints from the collection"""
        endpoints = []
        self._extract_endpoints_recursive(self.collection.get('item', []), endpoints)
        return endpoints
    
    def _extract_endpoints_recursive(self, items: List[Dict[str, Any]], 
                                    endpoints: List[Dict[str, Any]], 
                                    path: str = ""):
        """Recursively extract endpoints"""
        for item in items:
            current_path = f"{path}/{item.get('name', 'unnamed')}" if path else item.get('name', 'unnamed')
            
            if 'item' in item:  # Folder
                self._extract_endpoints_recursive(item['item'], endpoints, current_path)
            else:  # Request
                request = item.get('request', {})
                endpoint = {
                    'name': item.get('name', 'unnamed'),
                    'path': current_path,
                    'method': request.get('method', 'GET'),
                    'url': self._parse_url(request.get('url', '')),
                    'headers': request.get('header', []),
                    'body': self._parse_body(request.get('body', {})),
                    'auth': request.get('auth', {})
                }
                endpoints.append(endpoint)
    
    def _parse_url(self, url: Any) -> str:
        """Parse URL from various formats"""
        if isinstance(url, str):
            return url
        elif isinstance(url, dict):
            return url.get('raw', '')
        elif isinstance(url, list):
            return '/'.join(url)
        return str(url)
    
    def _parse_body(self, body: Dict[str, Any]) -> Dict[str, Any]:
        """Parse request body"""
        if not body:
            return {}
        
        parsed = {
            'mode': body.get('mode', 'raw'),
            'content': {}
        }
        
        if body.get('mode') == 'raw':
            try:
                parsed['content'] = json.loads(body.get('raw', '{}'))
            except:
                parsed['content'] = body.get('raw', '')
        elif body.get('mode') == 'formdata':
            parsed['content'] = {item['key']: item.get('value', '') 
                               for item in body.get('formdata', [])}
        
        return parsed
    
    def _extract_auth_patterns(self) -> Dict[str, Any]:
        """Extract authentication patterns"""
        auth_patterns = {
            'collection_auth': self.collection.get('auth', {}),
            'endpoint_auth': []
        }
        
        # Extract auth from endpoints
        self._extract_auth_recursive(self.collection.get('item', []), auth_patterns['endpoint_auth'])
        
        return auth_patterns
    
    def _extract_auth_recursive(self, items: List[Dict[str, Any]], auth_list: List[Dict[str, Any]]):
        """Recursively extract auth patterns"""
        for item in items:
            if 'item' in item:
                self._extract_auth_recursive(item['item'], auth_list)
            else:
                auth = item.get('request', {}).get('auth', {})
                if auth:
                    auth_list.append({
                        'endpoint': item.get('name', 'unnamed'),
                        'auth': auth
                    })
    
    def _extract_data_patterns(self) -> Dict[str, Any]:
        """Extract data patterns from request/response examples"""
        patterns = {
            'request_patterns': {},
            'response_patterns': {},
            'variable_patterns': []
        }
        
        # Extract from collection variables
        for var in self.collection.get('variable', []):
            patterns['variable_patterns'].append({
                'key': var.get('key'),
                'value': var.get('value'),
                'type': var.get('type', 'string')
            })
        
        # Extract from requests
        self._extract_data_patterns_recursive(
            self.collection.get('item', []),
            patterns['request_patterns'],
            patterns['response_patterns']
        )
        
        return patterns
    
    def _extract_data_patterns_recursive(self, items: List[Dict[str, Any]],
                                        request_patterns: Dict[str, Any],
                                        response_patterns: Dict[str, Any]):
        """Recursively extract data patterns"""
        for item in items:
            if 'item' in item:
                self._extract_data_patterns_recursive(
                    item['item'],
                    request_patterns,
                    response_patterns
                )
            else:
                # Extract request pattern
                request = item.get('request', {})
                body = self._parse_body(request.get('body', {}))
                if body.get('content'):
                    pattern_key = item.get('name', 'unnamed')
                    request_patterns[pattern_key] = self._analyze_data_structure(body['content'])
                
                # Extract response pattern if examples exist
                for response in item.get('response', []):
                    response_body = response.get('body', '')
                    if response_body:
                        try:
                            response_data = json.loads(response_body)
                            pattern_key = f"{item.get('name', 'unnamed')}_response"
                            response_patterns[pattern_key] = self._analyze_data_structure(response_data)
                        except:
                            pass
    
    def _analyze_data_structure(self, data: Any) -> Dict[str, Any]:
        """Analyze data structure to extract patterns"""
        if isinstance(data, dict):
            return {
                'type': 'object',
                'properties': {
                    key: self._analyze_data_structure(value)
                    for key, value in data.items()
                }
            }
        elif isinstance(data, list):
            if data:
                return {
                    'type': 'array',
                    'items': self._analyze_data_structure(data[0])
                }
            return {'type': 'array', 'items': {}}
        elif isinstance(data, str):
            return {'type': 'string', 'example': data}
        elif isinstance(data, (int, float)):
            return {'type': 'number', 'example': data}
        elif isinstance(data, bool):
            return {'type': 'boolean', 'example': data}
        else:
            return {'type': 'unknown', 'value': str(data)}
    
    def _extract_program_patterns(self) -> Dict[str, Any]:
        """Extract program-specific patterns"""
        program_patterns = {}
        
        # Analyze folder structure for program types
        for folder_name, folder_data in self.folder_structure.items():
            if folder_data.get('type') in ['program_type', 'segment']:
                program_patterns[folder_name] = {
                    'type': folder_data['type'],
                    'endpoints': self._get_folder_endpoints(folder_data),
                    'common_fields': self._extract_common_fields(folder_data)
                }
        
        return program_patterns
    
    def _get_folder_endpoints(self, folder_data: Dict[str, Any]) -> List[str]:
        """Get all endpoints in a folder"""
        endpoints = []
        
        def extract_endpoints(items):
            for item in items:
                if item.get('type') == 'request':
                    endpoints.append(item.get('name', 'unnamed'))
                elif item.get('type') == 'folder' and 'items' in item:
                    extract_endpoints(item['items'])
        
        extract_endpoints(folder_data.get('items', []))
        return endpoints
    
    def _extract_common_fields(self, folder_data: Dict[str, Any]) -> List[str]:
        """Extract common fields across requests in a folder"""
        field_counts = {}
        
        def count_fields(items):
            for item in items:
                if item.get('type') == 'request':
                    # Count fields in request body
                    pass
                elif item.get('type') == 'folder' and 'items' in item:
                    count_fields(item['items'])
        
        count_fields(folder_data.get('items', []))
        
        # Return fields that appear in multiple requests
        return [field for field, count in field_counts.items() if count > 1]
    
    def _get_collection_structure(self) -> Dict[str, Any]:
        """Get high-level collection structure"""
        structure = {
            'total_folders': 0,
            'total_requests': 0,
            'depth': 0
        }
        
        def analyze_structure(items, depth=0):
            structure['depth'] = max(structure['depth'], depth)
            
            for item in items:
                if 'item' in item:
                    structure['total_folders'] += 1
                    analyze_structure(item['item'], depth + 1)
                else:
                    structure['total_requests'] += 1
        
        analyze_structure(self.collection.get('item', []))
        return structure