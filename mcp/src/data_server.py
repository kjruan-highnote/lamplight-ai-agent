#!/usr/bin/env python3
"""
Data-Focused MCP Server for Lamplight

This server provides structured data access to:
- GraphQL schemas
- Documentation
- Program configurations

Design principles:
- Fast, deterministic responses
- Structured JSON output
- No LLM calls (Claude handles interpretation)
- Clear, focused tools
"""

import json
import logging
import re
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

from mcp.server import Server, NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Base paths
BASE_DIR = Path(__file__).parent.parent.parent
SCHEMA_DIR = BASE_DIR / "agents" / "schema-agent"
DOC_DIR = BASE_DIR / "agents" / "document-agent"
SHIP_DIR = BASE_DIR / "agents" / "ship-agent"


@dataclass
class GraphQLType:
    """Represents a GraphQL type definition"""
    name: str
    kind: str  # type, interface, enum, input, scalar
    description: Optional[str] = None
    fields: Optional[List[Dict[str, Any]]] = None
    values: Optional[List[str]] = None  # For enums


@dataclass
class GraphQLOperation:
    """Represents a GraphQL operation"""
    name: str
    type: str  # query, mutation, subscription
    description: Optional[str] = None
    arguments: Optional[List[Dict[str, str]]] = None
    return_type: Optional[str] = None


@dataclass
class DocumentChunk:
    """Represents a documentation chunk"""
    id: str
    content: str
    category: Optional[str] = None
    source: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class Program:
    """Represents a program configuration"""
    id: str
    name: str
    description: str
    operations: List[str]
    config: Optional[Dict[str, Any]] = None


class DataMCPServer:
    """
    MCP Server that provides structured data access
    """
    
    def __init__(self):
        """Initialize the server and load data sources"""
        self.server = Server("lamplight-data")
        
        # Load data sources
        logger.info("Loading data sources...")
        self.schema_data = self._load_schema_data()
        self.doc_chunks = self._load_documentation()
        self.programs = self._load_programs()
        
        # Register MCP handlers
        self._register_handlers()
        
        logger.info(f"Server initialized with:")
        logger.info(f"  - {len(self.schema_data.get('types', {}))} GraphQL types")
        logger.info(f"  - {len(self.schema_data.get('operations', {}))} GraphQL operations")
        logger.info(f"  - {len(self.doc_chunks)} documentation chunks")
        logger.info(f"  - {len(self.programs)} programs")
    
    def _load_schema_data(self) -> Dict[str, Any]:
        """Load and parse GraphQL schema"""
        schema_file = SCHEMA_DIR / "schema" / "highnote.graphql"
        
        if not schema_file.exists():
            logger.warning(f"Schema file not found: {schema_file}")
            return {"types": {}, "operations": {}}
        
        with open(schema_file, 'r') as f:
            schema_content = f.read()
        
        types = {}
        operations = {}
        
        # Parse types
        type_pattern = r'(type|interface|enum|input|scalar)\s+(\w+)(?:\s+implements\s+[^{]+)?\s*\{([^}]*)\}'
        for match in re.finditer(type_pattern, schema_content, re.MULTILINE | re.DOTALL):
            kind = match.group(1)
            name = match.group(2)
            body = match.group(3)
            
            if kind == "enum":
                # Parse enum values
                values = re.findall(r'^\s*(\w+)', body, re.MULTILINE)
                types[name] = GraphQLType(name=name, kind=kind, values=values)
            else:
                # Parse fields
                fields = []
                field_pattern = r'^\s*(\w+)(?:\([^)]*\))?\s*:\s*([^\n#]+)'
                for field_match in re.finditer(field_pattern, body, re.MULTILINE):
                    fields.append({
                        "name": field_match.group(1),
                        "type": field_match.group(2).strip()
                    })
                types[name] = GraphQLType(name=name, kind=kind, fields=fields)
        
        # Parse operations (simplified - in real implementation would parse Query and Mutation types)
        mutation_pattern = r'^\s*(\w+)\s*\([^)]*\)\s*:\s*([^\n]+)'
        query_section = re.search(r'type Query\s*\{([^}]*)\}', schema_content, re.DOTALL)
        if query_section:
            for match in re.finditer(mutation_pattern, query_section.group(1), re.MULTILINE):
                operations[match.group(1)] = GraphQLOperation(
                    name=match.group(1),
                    type="query",
                    return_type=match.group(2).strip()
                )
        
        mutation_section = re.search(r'type Mutation\s*\{([^}]*)\}', schema_content, re.DOTALL)
        if mutation_section:
            for match in re.finditer(mutation_pattern, mutation_section.group(1), re.MULTILINE):
                operations[match.group(1)] = GraphQLOperation(
                    name=match.group(1),
                    type="mutation",
                    return_type=match.group(2).strip()
                )
        
        return {"types": types, "operations": operations}
    
    def _load_documentation(self) -> List[DocumentChunk]:
        """Load documentation chunks"""
        chunks = []
        chunks_dir = DOC_DIR / "data" / "chunks"
        
        if not chunks_dir.exists():
            logger.warning(f"Documentation chunks directory not found: {chunks_dir}")
            return chunks
        
        # Load first 100 chunks for efficiency
        for i, chunk_file in enumerate(sorted(chunks_dir.glob("chunk_*.txt"))[:100]):
            with open(chunk_file, 'r') as f:
                content = f.read()
                chunks.append(DocumentChunk(
                    id=chunk_file.stem,
                    content=content[:1000],  # Limit content size
                    source=chunk_file.name
                ))
        
        return chunks
    
    def _load_programs(self) -> Dict[str, Program]:
        """Load program configurations"""
        programs = {}
        
        # Define known programs
        known_programs = [
            Program(
                id="consumer_credit",
                name="Consumer Credit",
                description="Consumer credit card program with rewards and spending controls",
                operations=["createPaymentCard", "activatePaymentCard", "setSpendLimits", "addRewards"]
            ),
            Program(
                id="ap_automation",
                name="AP Automation",
                description="Accounts payable automation with virtual cards",
                operations=["createVirtualCard", "processInvoice", "approvePayment", "reconcileTransaction"]
            ),
            Program(
                id="trip_com",
                name="Trip.com Integration",
                description="Travel booking platform integration with expense management",
                operations=["createTravelCard", "setMerchantRestrictions", "trackExpenses", "generateReport"]
            ),
            Program(
                id="fleet",
                name="Fleet Management",
                description="Fleet card program with driver controls and fuel tracking",
                operations=["createFleetCard", "assignDriver", "setFuelRestrictions", "trackMileage"]
            )
        ]
        
        for program in known_programs:
            programs[program.id] = program
            
            # Try to load config if exists
            config_file = SHIP_DIR / "config" / f"{program.id}_config.yaml"
            if config_file.exists():
                try:
                    import yaml
                    with open(config_file, 'r') as f:
                        program.config = yaml.safe_load(f)
                except:
                    pass  # Config is optional
        
        return programs
    
    def _register_handlers(self):
        """Register MCP protocol handlers"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List available MCP tools"""
            return [
                # Schema tools
                Tool(
                    name="search_schema_types",
                    description="Search for GraphQL types by name or field",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query (e.g., 'PaymentCard', 'status', 'enum')"
                            },
                            "kind": {
                                "type": "string",
                                "enum": ["type", "interface", "enum", "input", "scalar"],
                                "description": "Filter by type kind (optional)"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum results to return",
                                "default": 10
                            }
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="get_type_details",
                    description="Get complete details of a specific GraphQL type",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "type_name": {
                                "type": "string",
                                "description": "Exact name of the type (e.g., 'PaymentCard')"
                            }
                        },
                        "required": ["type_name"]
                    }
                ),
                Tool(
                    name="search_operations",
                    description="Search for GraphQL queries and mutations",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query (e.g., 'create', 'payment', 'card')"
                            },
                            "type": {
                                "type": "string",
                                "enum": ["query", "mutation", "all"],
                                "description": "Filter by operation type",
                                "default": "all"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum results to return",
                                "default": 10
                            }
                        },
                        "required": ["query"]
                    }
                ),
                
                # Documentation tools
                Tool(
                    name="search_documentation",
                    description="Search documentation for relevant information",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum results to return",
                                "default": 5
                            }
                        },
                        "required": ["query"]
                    }
                ),
                
                # Program tools
                Tool(
                    name="list_programs",
                    description="List all available programs",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="get_program_details",
                    description="Get detailed information about a specific program",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_id": {
                                "type": "string",
                                "description": "Program identifier (e.g., 'consumer_credit')"
                            }
                        },
                        "required": ["program_id"]
                    }
                ),
                
                # Utility tools
                Tool(
                    name="get_statistics",
                    description="Get statistics about available data",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[TextContent]:
            """Handle tool execution"""
            
            try:
                if name == "search_schema_types":
                    results = self._search_schema_types(
                        arguments["query"],
                        arguments.get("kind"),
                        arguments.get("limit", 10)
                    )
                    return [TextContent(type="text", text=json.dumps(results, indent=2))]
                
                elif name == "get_type_details":
                    result = self._get_type_details(arguments["type_name"])
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "search_operations":
                    results = self._search_operations(
                        arguments["query"],
                        arguments.get("type", "all"),
                        arguments.get("limit", 10)
                    )
                    return [TextContent(type="text", text=json.dumps(results, indent=2))]
                
                elif name == "search_documentation":
                    results = self._search_documentation(
                        arguments["query"],
                        arguments.get("limit", 5)
                    )
                    return [TextContent(type="text", text=json.dumps(results, indent=2))]
                
                elif name == "list_programs":
                    results = [asdict(p) for p in self.programs.values()]
                    return [TextContent(type="text", text=json.dumps(results, indent=2))]
                
                elif name == "get_program_details":
                    result = self._get_program_details(arguments["program_id"])
                    return [TextContent(type="text", text=json.dumps(result, indent=2))]
                
                elif name == "get_statistics":
                    stats = {
                        "schema": {
                            "types": len(self.schema_data.get("types", {})),
                            "operations": len(self.schema_data.get("operations", {}))
                        },
                        "documentation": {
                            "chunks": len(self.doc_chunks)
                        },
                        "programs": {
                            "count": len(self.programs)
                        }
                    }
                    return [TextContent(type="text", text=json.dumps(stats, indent=2))]
                
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
    
    def _search_schema_types(self, query: str, kind: Optional[str], limit: int) -> List[Dict[str, Any]]:
        """Search GraphQL types"""
        results = []
        query_lower = query.lower()
        
        for type_name, type_obj in self.schema_data.get("types", {}).items():
            # Filter by kind if specified
            if kind and type_obj.kind != kind:
                continue
            
            # Calculate relevance score
            score = 0
            
            # Check type name
            if query_lower in type_name.lower():
                score += 10
            
            # Check fields
            if type_obj.fields:
                for field in type_obj.fields:
                    if query_lower in field["name"].lower():
                        score += 5
                    if query_lower in field.get("type", "").lower():
                        score += 2
            
            # Check enum values
            if type_obj.values:
                for value in type_obj.values:
                    if query_lower in value.lower():
                        score += 3
            
            if score > 0:
                results.append({
                    "name": type_obj.name,
                    "kind": type_obj.kind,
                    "score": score,
                    "field_count": len(type_obj.fields) if type_obj.fields else 0,
                    "sample_fields": type_obj.fields[:3] if type_obj.fields else None,
                    "sample_values": type_obj.values[:5] if type_obj.values else None
                })
        
        # Sort by score and return top results
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    def _get_type_details(self, type_name: str) -> Dict[str, Any]:
        """Get complete type details"""
        type_obj = self.schema_data.get("types", {}).get(type_name)
        
        if not type_obj:
            return {"error": f"Type '{type_name}' not found"}
        
        return asdict(type_obj)
    
    def _search_operations(self, query: str, op_type: str, limit: int) -> List[Dict[str, Any]]:
        """Search GraphQL operations"""
        results = []
        query_lower = query.lower()
        
        for op_name, op_obj in self.schema_data.get("operations", {}).items():
            # Filter by type if specified
            if op_type != "all" and op_obj.type != op_type:
                continue
            
            # Calculate relevance score
            score = 0
            
            if query_lower in op_name.lower():
                score += 10
            
            if op_obj.return_type and query_lower in op_obj.return_type.lower():
                score += 5
            
            if score > 0:
                results.append({
                    "name": op_obj.name,
                    "type": op_obj.type,
                    "return_type": op_obj.return_type,
                    "score": score
                })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    def _search_documentation(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Search documentation chunks"""
        results = []
        query_lower = query.lower()
        query_words = query_lower.split()
        
        for chunk in self.doc_chunks:
            content_lower = chunk.content.lower()
            
            # Calculate relevance score
            score = 0
            for word in query_words:
                score += content_lower.count(word)
            
            if score > 0:
                results.append({
                    "chunk_id": chunk.id,
                    "score": score,
                    "excerpt": chunk.content[:200],
                    "source": chunk.source
                })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]
    
    def _get_program_details(self, program_id: str) -> Dict[str, Any]:
        """Get program details"""
        program = self.programs.get(program_id)
        
        if not program:
            return {"error": f"Program '{program_id}' not found"}
        
        return asdict(program)
    
    async def run(self):
        """Run the MCP server"""
        logger.info("=" * 60)
        logger.info("Lamplight Data MCP Server")
        logger.info("=" * 60)
        logger.info("")
        logger.info("This server provides fast, structured data access:")
        logger.info("  • GraphQL schema information")
        logger.info("  • Documentation search")
        logger.info("  • Program configurations")
        logger.info("")
        logger.info("All tools return JSON data for Claude to interpret.")
        logger.info("No LLM calls = fast, deterministic responses.")
        logger.info("")
        logger.info("Starting server...")
        logger.info("=" * 60)
        
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="lamplight-data",
                    server_version="2.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(tools_changed=True),
                        experimental_capabilities={},
                    ),
                ),
            )


async def main():
    """Main entry point"""
    server = DataMCPServer()
    await server.run()


if __name__ == "__main__":
    import asyncio
    asyncio.run(main())