"""
Tool implementations for the MCP server

Each tool class encapsulates the logic for handling specific types of queries.
"""

import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class SchemaTools:
    """Tools for handling GraphQL schema queries"""
    
    def __init__(self, knowledge_base, llm_manager):
        self.kb = knowledge_base
        self.llm = llm_manager
    
    async def query(
        self,
        query: str,
        include_examples: bool = True,
        max_results: int = 5,
        context: Any = None
    ) -> str:
        """Query GraphQL schema information"""
        # Search for relevant schema chunks
        results = await self.kb.search_schema(query, k=max_results)
        
        if not results:
            return "No relevant schema information found for your query."
        
        # Extract context from results
        context_items = [
            {
                "content": r.content,
                "metadata": r.metadata
            }
            for r in results
        ]
        
        # Generate response using LLM
        response = await self.llm.generate_schema_response(
            query, context_items, include_examples
        )
        
        return response
    
    async def get_type_definition(self, type_name: str) -> str:
        """Get specific type definition from schema"""
        query = f"GraphQL type {type_name} definition fields"
        results = await self.kb.search_schema(query, k=1)
        
        if results:
            return results[0].content
        return f"Type {type_name} not found in schema"
    
    async def get_operation(self, operation_name: str) -> str:
        """Get specific query or mutation definition"""
        query = f"GraphQL {operation_name} operation"
        results = await self.kb.search_schema(query, k=1)
        
        if results:
            return results[0].content
        return f"Operation {operation_name} not found"

class DocumentationTools:
    """Tools for handling documentation queries"""
    
    def __init__(self, knowledge_base, llm_manager):
        self.kb = knowledge_base
        self.llm = llm_manager
        self.categories = ["basics", "issuing", "acquiring", "sdks"]
    
    async def query(
        self,
        query: str,
        category: Optional[str] = None,
        include_sources: bool = True,
        context: Any = None
    ) -> str:
        """Query documentation"""
        # Search for relevant documentation
        results = await self.kb.search_docs(query, category, k=5)
        
        if not results:
            return "No relevant documentation found for your query."
        
        # Extract context from results
        context_items = [
            {
                "content": r.content,
                "metadata": r.metadata
            }
            for r in results
        ]
        
        # Generate response
        response = await self.llm.generate_doc_response(
            query, context_items, include_sources
        )
        
        return response
    
    async def get_categories(self) -> List[str]:
        """Get available documentation categories"""
        return self.categories
    
    async def get_category_docs(self, category: str) -> str:
        """Get all documentation for a specific category"""
        if category not in self.categories:
            return f"Unknown category: {category}"
        
        results = await self.kb.search_docs("", category, k=20)
        
        if results:
            docs = "\n\n".join([r.content for r in results])
            return docs
        return f"No documentation found for category: {category}"

class SolutionsTools:
    """Tools for program-specific solutions and collections"""
    
    def __init__(self, knowledge_base, llm_manager):
        self.kb = knowledge_base
        self.llm = llm_manager
        self.programs = self._load_programs()
    
    def _load_programs(self) -> Dict[str, Any]:
        """Load available programs and their configurations"""
        programs = {
            "consumer_credit": {
                "name": "Consumer Credit",
                "description": "Consumer credit card program",
                "operations": ["createPaymentCard", "activatePaymentCard", "setSpendLimits"]
            },
            "ap_automation": {
                "name": "AP Automation",
                "description": "Accounts payable automation",
                "operations": ["createVirtualCard", "processPayment", "reconcileTransactions"]
            },
            "trip_com": {
                "name": "Trip.com Integration",
                "description": "Travel booking platform integration",
                "operations": ["createTravelCard", "setMerchantRestrictions", "trackExpenses"]
            }
        }
        
        # Load additional programs from ship-agent configs
        config_dir = Path(__file__).parent.parent.parent / "agents" / "ship-agent" / "config"
        if config_dir.exists():
            for config_file in config_dir.glob("*_config.yaml"):
                program_name = config_file.stem.replace("_config", "")
                if program_name not in programs:
                    programs[program_name] = {
                        "name": program_name.replace("_", " ").title(),
                        "description": f"{program_name} program",
                        "operations": []
                    }
        
        return programs
    
    async def list_programs(self) -> List[Dict[str, Any]]:
        """List all available programs"""
        return [
            {
                "id": key,
                "name": value["name"],
                "description": value["description"],
                "operations_count": len(value.get("operations", []))
            }
            for key, value in self.programs.items()
        ]
    
    async def get_solution(
        self,
        program_type: str,
        query: Optional[str] = None,
        context: Any = None
    ) -> str:
        """Get solution information for a program"""
        if program_type not in self.programs:
            return f"Unknown program: {program_type}"
        
        program = self.programs[program_type]
        
        if query:
            # Search for specific information about the program
            search_query = f"{program_type} {query}"
            results = await self.kb.search(search_query, k=5)
            
            if results:
                context_items = [{"content": r.content, "metadata": r.metadata} for r in results]
                response = f"For {program['name']}:\n\n"
                response += await self.llm.generate_doc_response(query, context_items, True)
                return response
        
        # Return general program information
        return f"""
Program: {program['name']}
Description: {program['description']}
Available Operations: {', '.join(program.get('operations', []))}

Use the generate_collection tool to create a Postman collection for this program.
"""
    
    async def generate_collection(
        self,
        program_type: str,
        operations: Optional[List[str]] = None,
        include_tests: bool = True
    ) -> Dict[str, Any]:
        """Generate Postman collection for a program"""
        if program_type not in self.programs:
            raise ValueError(f"Unknown program: {program_type}")
        
        program = self.programs[program_type]
        
        # If no operations specified, use all available
        if not operations:
            operations = program.get("operations", [])
        
        # Create Postman collection structure
        collection = {
            "info": {
                "name": f"{program['name']} Collection",
                "description": program["description"],
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": []
        }
        
        # Add operations to collection
        for op in operations:
            item = {
                "name": op,
                "request": {
                    "method": "POST",
                    "header": [
                        {
                            "key": "Content-Type",
                            "value": "application/json"
                        }
                    ],
                    "body": {
                        "mode": "graphql",
                        "graphql": {
                            "query": f"mutation {op} {{\n  {op}(...) {{\n    id\n    status\n  }}\n}}",
                            "variables": "{}"
                        }
                    },
                    "url": {
                        "raw": "{{baseUrl}}/graphql",
                        "host": ["{{baseUrl}}"],
                        "path": ["graphql"]
                    }
                }
            }
            
            if include_tests:
                item["event"] = [
                    {
                        "listen": "test",
                        "script": {
                            "exec": [
                                "pm.test('Status code is 200', function () {",
                                "    pm.response.to.have.status(200);",
                                "});",
                                "",
                                "pm.test('Response has data', function () {",
                                "    var jsonData = pm.response.json();",
                                "    pm.expect(jsonData).to.have.property('data');",
                                "});"
                            ]
                        }
                    }
                ]
            
            collection["item"].append(item)
        
        return collection

class ImplementationTools:
    """Tools for implementation guidance and best practices"""
    
    def __init__(self, knowledge_base, llm_manager, schema_tools, doc_tools):
        self.kb = knowledge_base
        self.llm = llm_manager
        self.schema = schema_tools
        self.docs = doc_tools
    
    async def get_guidance(
        self,
        query: str,
        context: Any = None
    ) -> str:
        """Get implementation guidance for a query"""
        # Search across all namespaces for implementation information
        results = await self.kb.search(query, k=8)
        
        # Separate results by type
        schema_results = [r for r in results if r.namespace.value == "schema"]
        doc_results = [r for r in results if r.namespace.value == "docs"]
        solution_results = [r for r in results if r.namespace.value == "solutions"]
        
        # Build comprehensive context
        schema_context = [{"content": r.content, "metadata": r.metadata} for r in schema_results]
        doc_context = [{"content": r.content, "metadata": r.metadata} for r in doc_results]
        
        # Generate implementation guidance
        response = await self.llm.generate_implementation_guide(
            "general",
            query,
            schema_context,
            doc_context,
            "markdown"
        )
        
        return response
    
    async def get_program_guide(
        self,
        program_type: str,
        specific_query: Optional[str] = None,
        format: str = "markdown",
        context: Any = None
    ) -> str:
        """Get detailed implementation guide for a program"""
        # Get program-specific schema and documentation
        schema_results = await self.kb.get_program_schema(program_type)
        doc_results = await self.kb.get_program_docs(program_type)
        
        schema_context = [{"content": r.content, "metadata": r.metadata} for r in schema_results]
        doc_context = [{"content": r.content, "metadata": r.metadata} for r in doc_results]
        
        # Generate comprehensive guide
        guide = await self.llm.generate_implementation_guide(
            program_type,
            specific_query,
            schema_context,
            doc_context,
            format
        )
        
        return guide
    
    async def get_best_practices(self, topic: str) -> str:
        """Get best practices for a specific topic"""
        query = f"best practices {topic} implementation patterns"
        results = await self.kb.search(query, k=5)
        
        if not results:
            return f"No best practices found for {topic}"
        
        practices = []
        for r in results:
            if "pattern" in r.content.lower() or "practice" in r.content.lower():
                practices.append(r.content)
        
        if practices:
            return "\n\n".join(practices)
        
        return "Best practices information not available"