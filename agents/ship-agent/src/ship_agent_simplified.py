"""
Simplified Ship Agent implementation using YAML configs and MongoDB storage
"""
import logging
import json
import os
import yaml
from typing import Dict, Any, List, Optional
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)


class SimplifiedShipAgent:
    """
    Simplified Ship Agent that uses YAML for structure and MongoDB/JSON for operations
    """
    
    def __init__(self, registry=None, context_manager=None):
        # These can be None in simplified version
        self.registry = registry
        self.context_manager = context_manager
        
        # Load operations from JSON if MongoDB not available
        self.operations_cache = self._load_operations_cache()
        
    def _load_operations_cache(self) -> Dict[str, Any]:
        """Load operations from JSON file if exists"""
        cache = {}
        operations_dir = Path("data/operations")
        
        if operations_dir.exists():
            for json_file in operations_dir.glob("*_operations.json"):
                try:
                    with open(json_file, 'r') as f:
                        operations = json.load(f)
                        program_type = json_file.stem.replace('_operations', '')
                        cache[program_type] = {op['name']: op for op in operations}
                        logger.info(f"Loaded {len(operations)} operations for {program_type}")
                except Exception as e:
                    logger.error(f"Failed to load {json_file}: {e}")
        
        return cache
    
    def _load_program_config(self, program_type: str) -> Optional[Dict[str, Any]]:
        """Load YAML configuration for a program type if exists"""
        import yaml
        yaml_path = Path(f"data/programs/{program_type}.yaml")
        
        if yaml_path.exists():
            try:
                with open(yaml_path, 'r') as f:
                    return yaml.safe_load(f)
            except Exception as e:
                logger.error(f"Failed to load YAML config for {program_type}: {e}")
        
        return None
    
    async def generate_queries(self, program_type: str, dimensions: Dict[str, str],
                              options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate queries by selecting from available operations
        """
        options = options or {}
        
        # Get operations for program type
        operations = self.operations_cache.get(program_type, {})
        
        # Filter by categories if specified
        categories = options.get('categories', [])
        
        result = {
            'program_type': program_type,
            'dimensions': dimensions,
            'generated_at': datetime.now().isoformat(),
            'operations': []
        }
        
        for op_name, operation in operations.items():
            # Filter by category if specified
            if categories:
                op_category = operation.get('metadata', {}).get('category', '')
                if op_category not in categories:
                    continue
            
            # Apply dimension placeholders
            operation_copy = self._apply_dimensions(operation, dimensions)
            result['operations'].append(operation_copy)
        
        return result
    
    async def generate_collection(self, program_type: str, dimensions: Dict[str, str],
                                 output_format: str = "postman",
                                 options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a Postman collection from operations
        """
        # Get queries/operations
        queries_result = await self.generate_queries(program_type, dimensions, options)
        
        if output_format == "postman":
            return self._generate_postman_collection(queries_result, dimensions)
        else:
            # For other formats, just return the operations
            return queries_result
    
    async def generate_test_data(self, program_type: str, dimensions: Dict[str, str],
                                options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate test data based on operation templates
        """
        test_data = {
            'program_type': program_type,
            'dimensions': dimensions,
            'generated_at': datetime.now().isoformat(),
            'test_cases': []
        }
        
        # Get sample operations
        operations = self.operations_cache.get(program_type, {})
        sample_operations = options.get('operations', list(operations.keys())[:5])
        
        for op_name in sample_operations:
            if op_name in operations:
                operation = operations[op_name]
                test_case = {
                    'operation': op_name,
                    'variables': self._generate_test_variables(
                        operation.get('graphql', {}).get('variables', {}),
                        dimensions
                    )
                }
                test_data['test_cases'].append(test_case)
        
        return test_data
    
    def _apply_dimensions(self, operation: Dict[str, Any], dimensions: Dict[str, str]) -> Dict[str, Any]:
        """
        Apply dimension values to operation placeholders
        """
        import copy
        operation_copy = copy.deepcopy(operation)
        
        # Apply to variables
        if 'graphql' in operation_copy and 'variables' in operation_copy['graphql']:
            operation_copy['graphql']['variables'] = self._replace_placeholders(
                operation_copy['graphql']['variables'],
                dimensions
            )
        
        return operation_copy
    
    def _replace_placeholders(self, obj: Any, replacements: Dict[str, str]) -> Any:
        """
        Recursively replace {{placeholder}} with values
        """
        if isinstance(obj, str):
            for key, value in replacements.items():
                obj = obj.replace(f"{{{{{key}}}}}", str(value))
            return obj
        elif isinstance(obj, dict):
            return {k: self._replace_placeholders(v, replacements) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._replace_placeholders(item, replacements) for item in obj]
        return obj
    
    def _generate_postman_collection(self, queries_result: Dict[str, Any], 
                                    dimensions: Dict[str, str]) -> Dict[str, Any]:
        """
        Format as Postman collection
        """
        collection = {
            "info": {
                "name": f"{queries_result['program_type']} - {dimensions.get('customer', 'Generated')}",
                "description": f"Generated collection for {queries_result['program_type']}",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": [],
            "variable": []
        }
        
        # Add variables
        for key, value in dimensions.items():
            collection['variable'].append({
                "key": key,
                "value": str(value),
                "type": "string"
            })
        
        # Group operations by category
        categories = {}
        for operation in queries_result['operations']:
            category = operation.get('metadata', {}).get('category', 'uncategorized')
            if category not in categories:
                categories[category] = []
            categories[category].append(operation)
        
        # Create folders for each category
        for category, operations in categories.items():
            folder = {
                "name": category.replace('_', ' ').title(),
                "item": []
            }
            
            for operation in operations:
                request_item = {
                    "name": operation['name'],
                    "request": {
                        "method": "POST",
                        "header": [],
                        "url": {
                            "raw": "{{apiUrl}}",
                            "host": ["{{apiUrl}}"]
                        }
                    }
                }
                
                # Add headers
                for key, value in operation.get('headers', {}).items():
                    request_item['request']['header'].append({
                        "key": key,
                        "value": value
                    })
                
                # Add GraphQL body
                if 'graphql' in operation:
                    request_item['request']['body'] = {
                        "mode": "graphql",
                        "graphql": {
                            "query": operation['graphql']['query'],
                            "variables": json.dumps(operation['graphql'].get('variables', {}))
                        }
                    }
                
                # Add description
                if 'metadata' in operation and 'description' in operation['metadata']:
                    request_item['description'] = operation['metadata']['description']
                
                folder['item'].append(request_item)
            
            if folder['item']:
                collection['item'].append(folder)
        
        return collection
    
    def _generate_test_variables(self, template: Dict[str, Any], 
                                dimensions: Dict[str, str]) -> Dict[str, Any]:
        """
        Generate test variables from template
        """
        test_values = {
            'email': 'test@example.com',
            'givenName': 'John',
            'familyName': 'Doe',
            'dateOfBirth': '1990-01-01',
            'streetAddress': '123 Main St',
            'city': 'San Francisco',
            'postalCode': '94105',
            'state': 'CA',
            'phoneNumber': '4155551234',
            'ssn': '123456789',
            'annualIncome': '75000',
            'debtObligations': '1000',
            'employmentStatus': 'EMPLOYED_FULL_TIME',
            'housingPayment': '2000',
            'externalId': f"test_{datetime.now().timestamp()}"
        }
        
        # Apply test values to template
        result = self._replace_placeholders(template, test_values)
        
        # Apply dimensions
        result = self._replace_placeholders(result, dimensions)
        
        return result