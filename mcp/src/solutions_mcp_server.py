#!/usr/bin/env python3
"""
Solutions MCP Server

A comprehensive MCP server for generating customer-facing solution briefs
with sequence diagrams, ERDs, workflows, and GraphQL operations.

Combines capabilities from:
- Schema Agent: GraphQL type and operation knowledge
- Document Agent: Documentation and explanations
- Ship Agent: Program configs, operations, and solution patterns
"""

import json
import logging
import yaml
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
SHIP_DIR = BASE_DIR / "agents" / "ship-agent"
SCHEMA_DIR = BASE_DIR / "agents" / "schema-agent"
DOC_DIR = BASE_DIR / "agents" / "document-agent"


@dataclass
class ProgramConfig:
    """Represents a program configuration"""
    program_type: str
    vendor: str
    version: str
    api_type: str
    metadata: Dict[str, Any]
    categories: List[Dict[str, Any]]
    operations: List[str]


@dataclass
class GraphQLOperation:
    """Represents a GraphQL operation with full details"""
    name: str
    program_type: str
    operation_type: str  # query or mutation
    graphql: Dict[str, Any]  # query and variables
    metadata: Dict[str, Any]
    category: Optional[str] = None
    description: Optional[str] = None


@dataclass
class SolutionComponent:
    """Represents a solution component (diagram, workflow, etc.)"""
    type: str  # sequence_diagram, erd, workflow, graphql_example
    content: str
    metadata: Dict[str, Any]


class SolutionsMCPServer:
    """
    MCP Server for generating comprehensive solution briefs
    """
    
    def __init__(self):
        """Initialize the Solutions MCP Server"""
        self.server = Server("lamplight-solutions")
        
        # Load all data sources
        logger.info("Loading Solutions MCP Server data...")
        self.programs = self._load_program_configs()
        self.operations = self._load_operations()
        self.collections = self._load_collections()
        self.schema_types = self._load_schema_types()
        
        # Register MCP handlers
        self._register_handlers()
        
        logger.info(f"Solutions MCP Server initialized:")
        logger.info(f"  - {len(self.programs)} programs loaded")
        logger.info(f"  - {sum(len(ops) for ops in self.operations.values())} total operations")
        logger.info(f"  - {len(self.collections)} Postman collections")
        logger.info(f"  - {len(self.schema_types)} GraphQL types")
    
    def _load_program_configs(self) -> Dict[str, ProgramConfig]:
        """Load all program YAML configurations"""
        programs = {}
        programs_dir = SHIP_DIR / "data" / "programs"
        
        if not programs_dir.exists():
            logger.warning(f"Programs directory not found: {programs_dir}")
            return programs
        
        for yaml_file in programs_dir.glob("*.yaml"):
            try:
                with open(yaml_file, 'r') as f:
                    config_data = yaml.safe_load(f)
                
                # Extract operation names from categories
                operation_names = []
                for category in config_data.get('categories', []):
                    operation_names.extend(category.get('operations', []))
                
                program = ProgramConfig(
                    program_type=config_data.get('program_type', yaml_file.stem),
                    vendor=config_data.get('vendor', 'highnote'),
                    version=config_data.get('version', '1.0.0'),
                    api_type=config_data.get('api_type', 'graphql'),
                    metadata=config_data.get('metadata', {}),
                    categories=config_data.get('categories', []),
                    operations=operation_names
                )
                
                programs[program.program_type] = program
                
            except Exception as e:
                logger.error(f"Failed to load program config {yaml_file}: {e}")
        
        return programs
    
    def _load_operations(self) -> Dict[str, List[GraphQLOperation]]:
        """Load all GraphQL operations from JSON files"""
        operations = {}
        operations_dir = SHIP_DIR / "data" / "operations"
        
        if not operations_dir.exists():
            logger.warning(f"Operations directory not found: {operations_dir}")
            return operations
        
        for json_file in operations_dir.glob("*_operations.json"):
            try:
                with open(json_file, 'r') as f:
                    ops_data = json.load(f)
                
                program_type = json_file.stem.replace('_operations', '')
                program_ops = []
                
                for op_data in ops_data:
                    operation = GraphQLOperation(
                        name=op_data.get('name'),
                        program_type=op_data.get('program_type', program_type),
                        operation_type=op_data.get('operation_type', 'query'),
                        graphql=op_data.get('graphql', {}),
                        metadata=op_data.get('metadata', {}),
                        category=op_data.get('metadata', {}).get('category'),
                        description=op_data.get('metadata', {}).get('description')
                    )
                    program_ops.append(operation)
                
                operations[program_type] = program_ops
                
            except Exception as e:
                logger.error(f"Failed to load operations {json_file}: {e}")
        
        return operations
    
    def _load_collections(self) -> Dict[str, Dict[str, Any]]:
        """Load Postman collections"""
        collections = {}
        postman_dir = SHIP_DIR / "data" / "postman"
        
        if not postman_dir.exists():
            logger.warning(f"Postman directory not found: {postman_dir}")
            return collections
        
        for json_file in postman_dir.glob("*.json"):
            try:
                with open(json_file, 'r') as f:
                    collection = json.load(f)
                
                collection_name = json_file.stem.lower().replace(' ', '_')
                collections[collection_name] = collection
                
            except Exception as e:
                logger.error(f"Failed to load collection {json_file}: {e}")
        
        return collections
    
    def _load_schema_types(self) -> Dict[str, Any]:
        """Load GraphQL schema types (simplified for now)"""
        # This would load from the schema agent's processed data
        # For now, return a placeholder
        return {}
    
    def _register_handlers(self):
        """Register MCP protocol handlers"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List available MCP tools"""
            return [
                # Program discovery
                Tool(
                    name="list_programs",
                    description="List all available programs with their capabilities",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="get_program_info",
                    description="Get complete program configuration and capabilities",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {
                                "type": "string",
                                "description": "Program type (e.g., consumer_credit, ap_automation)"
                            },
                            "include_operations": {
                                "type": "boolean",
                                "description": "Include full operation details",
                                "default": False
                            },
                            "include_categories": {
                                "type": "boolean",
                                "description": "Include category breakdown",
                                "default": True
                            }
                        },
                        "required": ["program_type"]
                    }
                ),
                
                # Operation search
                Tool(
                    name="find_operations",
                    description="Find GraphQL operations for specific use cases",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query (e.g., 'create payment card')"
                            },
                            "program_type": {
                                "type": "string",
                                "description": "Filter by program type (optional)"
                            },
                            "category": {
                                "type": "string",
                                "description": "Filter by category (optional)"
                            },
                            "operation_type": {
                                "type": "string",
                                "enum": ["query", "mutation", "all"],
                                "description": "Filter by operation type",
                                "default": "all"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum results",
                                "default": 10
                            }
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="get_operation_details",
                    description="Get complete details for a specific operation",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "operation_name": {
                                "type": "string",
                                "description": "Name of the operation"
                            },
                            "program_type": {
                                "type": "string",
                                "description": "Program type containing the operation"
                            }
                        },
                        "required": ["operation_name", "program_type"]
                    }
                ),
                
                # Solution generation
                Tool(
                    name="generate_sequence_diagram",
                    description="Generate a sequence diagram for a workflow",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "workflow": {
                                "type": "string",
                                "description": "Workflow name (e.g., 'card_issuance', 'account_creation')"
                            },
                            "program_type": {
                                "type": "string",
                                "description": "Program context"
                            },
                            "operations": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of operations in the workflow"
                            }
                        },
                        "required": ["workflow", "program_type"]
                    }
                ),
                Tool(
                    name="generate_erd",
                    description="Generate an entity relationship diagram",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {
                                "type": "string",
                                "description": "Program type"
                            },
                            "entities": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of entities to include",
                                "default": ["AccountHolder", "PaymentCard", "Transaction", "FinancialAccount"]
                            }
                        },
                        "required": ["program_type"]
                    }
                ),
                Tool(
                    name="generate_solution_brief",
                    description="Generate a complete customer-facing solution brief",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {
                                "type": "string",
                                "description": "Program type"
                            },
                            "customer_name": {
                                "type": "string",
                                "description": "Customer/company name"
                            },
                            "requirements": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "List of requirements/features needed"
                            },
                            "include_sections": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Sections to include",
                                "default": ["executive_summary", "architecture", "workflows", "operations"]
                            }
                        },
                        "required": ["program_type"]
                    }
                ),
                
                # Collection management
                Tool(
                    name="get_postman_collection",
                    description="Get a Postman collection for a program",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {
                                "type": "string",
                                "description": "Program type"
                            },
                            "operations": {
                                "type": "array",
                                "items": {"type": "string"},
                                "description": "Filter to specific operations (optional)"
                            }
                        },
                        "required": ["program_type"]
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool execution"""
            
            try:
                if name == "list_programs":
                    result = self._list_programs()
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "get_program_info":
                    result = self._get_program_info(
                        arguments["program_type"],
                        arguments.get("include_operations", False),
                        arguments.get("include_categories", True)
                    )
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "find_operations":
                    result = self._find_operations(
                        arguments["query"],
                        arguments.get("program_type"),
                        arguments.get("category"),
                        arguments.get("operation_type", "all"),
                        arguments.get("limit", 10)
                    )
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "get_operation_details":
                    result = self._get_operation_details(
                        arguments["operation_name"],
                        arguments["program_type"]
                    )
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "generate_sequence_diagram":
                    result = self._generate_sequence_diagram(
                        arguments["workflow"],
                        arguments["program_type"],
                        arguments.get("operations", [])
                    )
                    return [TextContent(type="text", text=result)]
                
                elif name == "generate_erd":
                    result = self._generate_erd(
                        arguments["program_type"],
                        arguments.get("entities", ["AccountHolder", "PaymentCard", "Transaction"])
                    )
                    return [TextContent(type="text", text=result)]
                
                elif name == "generate_solution_brief":
                    result = self._generate_solution_brief(
                        arguments["program_type"],
                        arguments.get("customer_name"),
                        arguments.get("requirements", []),
                        arguments.get("include_sections", ["executive_summary", "architecture", "workflows"])
                    )
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "get_postman_collection":
                    result = self._get_postman_collection(
                        arguments["program_type"],
                        arguments.get("operations")
                    )
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                else:
                    return [TextContent(
                        type="text",
                        text=json.dumps({"error": f"Unknown tool: {name}"})
                    )]
                    
            except Exception as e:
                logger.error(f"Error in tool {name}: {e}", exc_info=True)
                return [TextContent(
                    type="text",
                    text=json.dumps({"error": str(e)})
                )]
    
    def _list_programs(self) -> Dict[str, Any]:
        """List all available programs"""
        programs_list = []
        
        for prog_type, program in self.programs.items():
            programs_list.append({
                "program_type": prog_type,
                "vendor": program.vendor,
                "version": program.version,
                "description": program.metadata.get("description", ""),
                "categories": len(program.categories),
                "operations": len(program.operations)
            })
        
        return {
            "programs": programs_list,
            "total": len(programs_list)
        }
    
    def _get_program_info(self, program_type: str, include_operations: bool, include_categories: bool) -> Dict[str, Any]:
        """Get detailed program information"""
        
        if program_type not in self.programs:
            return {"error": f"Program '{program_type}' not found"}
        
        program = self.programs[program_type]
        result = {
            "program_type": program.program_type,
            "vendor": program.vendor,
            "version": program.version,
            "api_type": program.api_type,
            "metadata": program.metadata
        }
        
        if include_categories:
            result["categories"] = [
                {
                    "name": cat["name"],
                    "description": cat.get("description", ""),
                    "operation_count": len(cat.get("operations", []))
                }
                for cat in program.categories
            ]
        
        if include_operations and program_type in self.operations:
            ops = self.operations[program_type]
            result["operations"] = [
                {
                    "name": op.name,
                    "type": op.operation_type,
                    "category": op.category,
                    "description": op.description
                }
                for op in ops[:20]  # Limit to first 20 for brevity
            ]
            result["total_operations"] = len(ops)
        
        return result
    
    def _find_operations(self, query: str, program_type: Optional[str], category: Optional[str], 
                        operation_type: str, limit: int) -> List[Dict[str, Any]]:
        """Find operations matching search criteria"""
        results = []
        query_lower = query.lower()
        
        # Search across programs
        search_programs = [program_type] if program_type else self.operations.keys()
        
        for prog_type in search_programs:
            if prog_type not in self.operations:
                continue
                
            for op in self.operations[prog_type]:
                # Filter by operation type
                if operation_type != "all" and op.operation_type != operation_type:
                    continue
                
                # Filter by category
                if category and op.category != category:
                    continue
                
                # Search in name and description
                score = 0
                if query_lower in op.name.lower():
                    score += 10
                if op.description and query_lower in op.description.lower():
                    score += 5
                if op.category and query_lower in op.category.lower():
                    score += 3
                
                if score > 0:
                    results.append({
                        "name": op.name,
                        "program_type": op.program_type,
                        "operation_type": op.operation_type,
                        "category": op.category,
                        "description": op.description,
                        "score": score
                    })
        
        # Sort by score and limit
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    def _get_operation_details(self, operation_name: str, program_type: str) -> Dict[str, Any]:
        """Get complete operation details"""
        
        if program_type not in self.operations:
            return {"error": f"Program '{program_type}' not found"}
        
        for op in self.operations[program_type]:
            if op.name == operation_name:
                return {
                    "name": op.name,
                    "program_type": op.program_type,
                    "operation_type": op.operation_type,
                    "category": op.category,
                    "description": op.description,
                    "graphql": op.graphql,
                    "metadata": op.metadata
                }
        
        return {"error": f"Operation '{operation_name}' not found in {program_type}"}
    
    def _generate_sequence_diagram(self, workflow: str, program_type: str, operations: List[str]) -> str:
        """Generate a Mermaid sequence diagram"""
        
        # Define common workflows
        workflows = {
            "card_issuance": {
                "participants": ["Client", "API", "CardProcessor", "RiskEngine"],
                "operations": operations or ["CreateAccountHolder", "IssuePaymentCard", "ActivateCard"]
            },
            "account_creation": {
                "participants": ["Client", "API", "KYC", "AccountService"],
                "operations": operations or ["CreateAccountHolder", "VerifyIdentity", "CreateFinancialAccount"]
            },
            "transaction_flow": {
                "participants": ["Merchant", "Network", "API", "Authorization", "Ledger"],
                "operations": operations or ["AuthorizeTransaction", "CaptureTransaction", "SettleTransaction"]
            }
        }
        
        wf = workflows.get(workflow, {
            "participants": ["Client", "API", "Service"],
            "operations": operations or []
        })
        
        diagram = "```mermaid\nsequenceDiagram\n"
        
        # Add participants
        for participant in wf["participants"]:
            diagram += f"    participant {participant}\n"
        
        diagram += "\n"
        
        # Add operations as interactions
        for i, op in enumerate(wf["operations"]):
            if i == 0:
                diagram += f"    Client->>API: {op}\n"
            elif i == len(wf["operations"]) - 1:
                diagram += f"    API-->>Client: {op} Response\n"
            else:
                service = wf["participants"][min(i + 1, len(wf["participants"]) - 1)]
                diagram += f"    API->>{service}: Process {op}\n"
                diagram += f"    {service}-->>API: {op} Result\n"
        
        diagram += "```"
        
        return diagram
    
    def _generate_erd(self, program_type: str, entities: List[str]) -> str:
        """Generate a Mermaid ERD diagram"""
        
        # Simplified ERD based on common entities
        erd = """```mermaid
erDiagram
    AccountHolder ||--o{ PaymentCard : has
    AccountHolder ||--|| FinancialAccount : owns
    PaymentCard ||--o{ Transaction : processes
    FinancialAccount ||--o{ Transaction : records
    PaymentCard ||--|| CardProduct : "instance of"
    
    AccountHolder {
        string id PK
        string status
        string type
        datetime createdAt
    }
    
    PaymentCard {
        string id PK
        string accountHolderId FK
        string status
        string last4
        datetime expirationDate
    }
    
    Transaction {
        string id PK
        string cardId FK
        decimal amount
        string status
        datetime createdAt
    }
    
    FinancialAccount {
        string id PK
        string accountHolderId FK
        decimal balance
        string currency
    }
    
    CardProduct {
        string id PK
        string name
        string type
        json configuration
    }
```"""
        
        return erd
    
    def _generate_solution_brief(self, program_type: str, customer_name: Optional[str], 
                                 requirements: List[str], include_sections: List[str]) -> Dict[str, Any]:
        """Generate a complete solution brief"""
        
        brief = {
            "program_type": program_type,
            "customer_name": customer_name,
            "generated_at": datetime.now().isoformat(),
            "sections": {}
        }
        
        program = self.programs.get(program_type)
        if not program:
            return {"error": f"Program '{program_type}' not found"}
        
        # Executive Summary
        if "executive_summary" in include_sections:
            brief["sections"]["executive_summary"] = {
                "title": f"{program_type.replace('_', ' ').title()} Solution",
                "description": program.metadata.get("description", ""),
                "key_features": requirements or ["Card Issuance", "Transaction Processing", "Risk Management"],
                "benefits": [
                    "Rapid time to market",
                    "Comprehensive API coverage",
                    "Enterprise-grade security",
                    "Real-time processing"
                ]
            }
        
        # Architecture
        if "architecture" in include_sections:
            brief["sections"]["architecture"] = {
                "components": [
                    "API Gateway",
                    "Card Processing Engine",
                    "Risk Management System",
                    "Reporting Dashboard"
                ],
                "integration_points": [
                    "REST/GraphQL API",
                    "Webhooks",
                    "Batch Processing",
                    "Real-time Events"
                ]
            }
        
        # Workflows
        if "workflows" in include_sections:
            brief["sections"]["workflows"] = {
                "card_issuance": {
                    "steps": [
                        "Create Account Holder",
                        "KYC Verification",
                        "Issue Payment Card",
                        "Card Activation"
                    ]
                },
                "transaction_processing": {
                    "steps": [
                        "Authorization Request",
                        "Risk Assessment",
                        "Authorization Response",
                        "Settlement"
                    ]
                }
            }
        
        # Operations
        if "operations" in include_sections and program_type in self.operations:
            ops = self.operations[program_type][:10]  # First 10 operations
            brief["sections"]["operations"] = {
                "sample_operations": [
                    {
                        "name": op.name,
                        "type": op.operation_type,
                        "category": op.category,
                        "description": op.description
                    }
                    for op in ops
                ],
                "total_available": len(self.operations.get(program_type, []))
            }
        
        return brief
    
    def _get_postman_collection(self, program_type: str, operations: Optional[List[str]]) -> Dict[str, Any]:
        """Get or generate a Postman collection"""
        
        # Check for existing collection
        collection_key = program_type.replace('_', '_')
        if collection_key in self.collections:
            collection = self.collections[collection_key]
            
            # Filter operations if specified
            if operations:
                # This would filter the collection items
                # For now, return the full collection
                pass
            
            return collection
        
        # Generate a basic collection structure if not found
        return {
            "info": {
                "name": f"{program_type.replace('_', ' ').title()} Collection",
                "description": f"Generated collection for {program_type}",
                "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
            },
            "item": [],
            "variable": [
                {
                    "key": "apiUrl",
                    "value": "https://api.highnote.com/graphql"
                }
            ]
        }
    
    async def run(self):
        """Run the Solutions MCP server"""
        logger.info("=" * 60)
        logger.info("Lamplight Solutions MCP Server")
        logger.info("=" * 60)
        logger.info("")
        logger.info("Capabilities:")
        logger.info("  • Program configurations and operations")
        logger.info("  • Solution brief generation")
        logger.info("  • Sequence diagrams and ERDs")
        logger.info("  • GraphQL operation templates")
        logger.info("  • Postman collections")
        logger.info("")
        logger.info("Starting server...")
        logger.info("=" * 60)
        
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="lamplight-solutions",
                    server_version="1.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(tools_changed=True),
                        experimental_capabilities={},
                    ),
                ),
            )


async def main():
    """Main entry point"""
    server = SolutionsMCPServer()
    await server.run()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())