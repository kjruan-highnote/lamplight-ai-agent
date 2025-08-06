"""
Main MCP Server Implementation

This is the core server that exposes all agent capabilities through the MCP protocol.
MCP allows AI assistants to call tools and access resources in a standardized way.
"""

import json
import asyncio
import logging
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
from dataclasses import dataclass, field
from enum import Enum

from mcp import Server
from mcp.server import NotificationOptions
from mcp.server.models import InitializationOptions
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool, 
    Resource, 
    TextContent, 
    ImageContent,
    EmbeddedResource,
    LoggingLevel
)

from .knowledge_base import UnifiedKnowledgeBase
from .llm_manager import LLMManager
from .query_classifier import QueryClassifier
from .tools import (
    SchemaTools,
    DocumentationTools,
    SolutionsTools,
    ImplementationTools
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class QueryType(Enum):
    """Types of queries the system can handle"""
    SCHEMA = "schema"
    DOCUMENTATION = "documentation"
    SOLUTIONS = "solutions"
    IMPLEMENTATION = "implementation"
    MIXED = "mixed"
    UNKNOWN = "unknown"

@dataclass
class ConversationContext:
    """Maintains context across tool calls in a conversation"""
    query_history: List[str] = field(default_factory=list)
    agent_responses: Dict[str, Any] = field(default_factory=dict)
    active_program: Optional[str] = None
    current_category: Optional[str] = None
    session_id: str = ""

class LamplightMCPServer:
    """
    Unified MCP Server that consolidates all agent capabilities.
    
    This server provides:
    - Tools for querying schema, documentation, and solutions
    - Resources for accessing raw data
    - Context management across conversations
    - Intelligent routing based on query classification
    """
    
    def __init__(self, config_path: Optional[Path] = None):
        """Initialize the MCP server with all components"""
        self.server = Server("lamplight-mcp")
        self.config = self._load_config(config_path)
        
        # Initialize core components
        self.knowledge_base = UnifiedKnowledgeBase(self.config)
        self.llm_manager = LLMManager(self.config)
        self.classifier = QueryClassifier()
        
        # Initialize tool handlers
        self.schema_tools = SchemaTools(self.knowledge_base, self.llm_manager)
        self.doc_tools = DocumentationTools(self.knowledge_base, self.llm_manager)
        self.solutions_tools = SolutionsTools(self.knowledge_base, self.llm_manager)
        self.implementation_tools = ImplementationTools(
            self.knowledge_base, 
            self.llm_manager,
            self.schema_tools,
            self.doc_tools
        )
        
        # Conversation context
        self.contexts: Dict[str, ConversationContext] = {}
        
        # Register handlers
        self._setup_handlers()
        self._register_tools()
        self._register_resources()
    
    def _load_config(self, config_path: Optional[Path]) -> Dict[str, Any]:
        """Load configuration from file or use defaults"""
        if config_path and config_path.exists():
            with open(config_path) as f:
                return json.load(f)
        
        # Default configuration
        return {
            "llm": {
                "model": "llama3",
                "temperature": 0.7,
                "max_tokens": 2000
            },
            "knowledge_base": {
                "faiss_index_path": "embeddings/unified_index.faiss",
                "chunk_size": 1000,
                "overlap": 100
            },
            "agents": {
                "schema_port": 8000,
                "document_port": 8001,
                "ship_port": 8003,
                "advisory_port": 8002
            }
        }
    
    def _setup_handlers(self):
        """Setup MCP protocol handlers"""
        
        @self.server.list_tools()
        async def list_tools() -> List[Tool]:
            """List all available tools"""
            return [
                Tool(
                    name="query",
                    description="Unified query handler that intelligently routes to appropriate agents",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "The user's question"},
                            "auto_route": {"type": "boolean", "default": True, "description": "Automatically route to appropriate agents"},
                            "include_sources": {"type": "boolean", "default": True, "description": "Include source references"}
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="query_schema",
                    description="Query GraphQL schema information directly",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Schema-related question"},
                            "include_examples": {"type": "boolean", "default": True},
                            "max_results": {"type": "integer", "default": 5}
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="query_documentation",
                    description="Query Highnote documentation",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string", "description": "Documentation question"},
                            "category": {"type": "string", "enum": ["basics", "issuing", "acquiring", "sdks"]},
                            "include_sources": {"type": "boolean", "default": True}
                        },
                        "required": ["query"]
                    }
                ),
                Tool(
                    name="generate_collection",
                    description="Generate Postman collection for a specific program",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {"type": "string", "description": "Program type (e.g., consumer_credit, trip_com)"},
                            "operations": {"type": "array", "items": {"type": "string"}},
                            "include_tests": {"type": "boolean", "default": True}
                        },
                        "required": ["program_type"]
                    }
                ),
                Tool(
                    name="get_implementation_guide",
                    description="Get detailed implementation guidance for a program",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "program_type": {"type": "string"},
                            "specific_query": {"type": "string"},
                            "format": {"type": "string", "enum": ["markdown", "json", "yaml"], "default": "markdown"}
                        },
                        "required": ["program_type"]
                    }
                ),
                Tool(
                    name="list_programs",
                    description="List all available programs and their capabilities",
                    inputSchema={
                        "type": "object",
                        "properties": {}
                    }
                ),
                Tool(
                    name="analyze_intent",
                    description="Analyze query intent for debugging/testing",
                    inputSchema={
                        "type": "object",
                        "properties": {
                            "query": {"type": "string"}
                        },
                        "required": ["query"]
                    }
                )
            ]
        
        @self.server.call_tool()
        async def call_tool(name: str, arguments: Dict[str, Any]) -> List[Union[TextContent, ImageContent]]:
            """Handle tool calls from the AI assistant"""
            
            # Get or create context for this session
            session_id = arguments.get("session_id", "default")
            if session_id not in self.contexts:
                self.contexts[session_id] = ConversationContext(session_id=session_id)
            context = self.contexts[session_id]
            
            # Route to appropriate tool handler
            if name == "query":
                return await self._handle_unified_query(arguments, context)
            elif name == "query_schema":
                return await self._handle_schema_query(arguments, context)
            elif name == "query_documentation":
                return await self._handle_doc_query(arguments, context)
            elif name == "generate_collection":
                return await self._handle_generate_collection(arguments, context)
            elif name == "get_implementation_guide":
                return await self._handle_implementation_guide(arguments, context)
            elif name == "list_programs":
                return await self._handle_list_programs()
            elif name == "analyze_intent":
                return await self._handle_analyze_intent(arguments)
            else:
                return [TextContent(text=f"Unknown tool: {name}")]
    
    async def _handle_unified_query(self, args: Dict[str, Any], context: ConversationContext) -> List[TextContent]:
        """
        Handle unified queries with intelligent routing.
        This is the main entry point for most queries.
        """
        query = args["query"]
        auto_route = args.get("auto_route", True)
        include_sources = args.get("include_sources", True)
        
        # Add to query history
        context.query_history.append(query)
        
        if auto_route:
            # Classify the query to determine which agents to use
            query_type = await self.classifier.classify(query)
            logger.info(f"Query classified as: {query_type}")
            
            responses = {}
            
            # Route to appropriate agents based on classification
            if query_type in [QueryType.SCHEMA, QueryType.MIXED]:
                schema_response = await self.schema_tools.query(
                    query, 
                    include_examples=True,
                    context=context
                )
                responses["schema"] = schema_response
            
            if query_type in [QueryType.DOCUMENTATION, QueryType.MIXED]:
                doc_response = await self.doc_tools.query(
                    query,
                    category=context.current_category,
                    include_sources=include_sources,
                    context=context
                )
                responses["documentation"] = doc_response
            
            if query_type == QueryType.SOLUTIONS:
                # Try to extract program from query or use active program
                program = self._extract_program_from_query(query) or context.active_program
                if program:
                    solution_response = await self.solutions_tools.get_solution(
                        program,
                        query,
                        context=context
                    )
                    responses["solutions"] = solution_response
            
            if query_type == QueryType.IMPLEMENTATION:
                impl_response = await self.implementation_tools.get_guidance(
                    query,
                    context=context
                )
                responses["implementation"] = impl_response
            
            # Combine responses if multiple agents responded
            if len(responses) > 1:
                combined = await self.llm_manager.synthesize_responses(
                    query, 
                    responses,
                    context
                )
                return [TextContent(text=combined)]
            elif len(responses) == 1:
                return [TextContent(text=list(responses.values())[0])]
            else:
                return [TextContent(text="I couldn't find relevant information for your query. Could you please rephrase or provide more context?")]
        else:
            # Direct query without routing - user knows what they want
            response = await self.knowledge_base.direct_search(query)
            return [TextContent(text=response)]
    
    async def _handle_schema_query(self, args: Dict[str, Any], context: ConversationContext) -> List[TextContent]:
        """Handle direct schema queries"""
        response = await self.schema_tools.query(
            args["query"],
            include_examples=args.get("include_examples", True),
            max_results=args.get("max_results", 5),
            context=context
        )
        context.agent_responses["schema"] = response
        return [TextContent(text=response)]
    
    async def _handle_doc_query(self, args: Dict[str, Any], context: ConversationContext) -> List[TextContent]:
        """Handle documentation queries"""
        response = await self.doc_tools.query(
            args["query"],
            category=args.get("category"),
            include_sources=args.get("include_sources", True),
            context=context
        )
        context.agent_responses["documentation"] = response
        return [TextContent(text=response)]
    
    async def _handle_generate_collection(self, args: Dict[str, Any], context: ConversationContext) -> List[TextContent]:
        """Generate Postman collection for a program"""
        program_type = args["program_type"]
        context.active_program = program_type  # Set active program in context
        
        collection = await self.solutions_tools.generate_collection(
            program_type,
            operations=args.get("operations"),
            include_tests=args.get("include_tests", True)
        )
        
        # Return both text description and the collection as metadata
        return [TextContent(
            text=f"Generated Postman collection for {program_type} with {len(collection.get('item', []))} endpoints",
            metadata={"collection": collection}
        )]
    
    async def _handle_implementation_guide(self, args: Dict[str, Any], context: ConversationContext) -> List[TextContent]:
        """Get implementation guidance"""
        program_type = args["program_type"]
        context.active_program = program_type
        
        guide = await self.implementation_tools.get_program_guide(
            program_type,
            specific_query=args.get("specific_query"),
            format=args.get("format", "markdown"),
            context=context
        )
        
        return [TextContent(text=guide)]
    
    async def _handle_list_programs(self) -> List[TextContent]:
        """List all available programs"""
        programs = await self.solutions_tools.list_programs()
        return [TextContent(
            text=f"Available programs:\n" + "\n".join([f"- {p['name']}: {p['description']}" for p in programs]),
            metadata={"programs": programs}
        )]
    
    async def _handle_analyze_intent(self, args: Dict[str, Any]) -> List[TextContent]:
        """Analyze query intent for debugging"""
        query = args["query"]
        analysis = await self.classifier.detailed_analysis(query)
        
        return [TextContent(
            text=f"Query Analysis:\n"
                 f"- Type: {analysis['type']}\n"
                 f"- Confidence: {analysis['confidence']:.2f}\n"
                 f"- Key Terms: {', '.join(analysis['key_terms'])}\n"
                 f"- Suggested Agents: {', '.join(analysis['suggested_agents'])}",
            metadata=analysis
        )]
    
    def _extract_program_from_query(self, query: str) -> Optional[str]:
        """Extract program name from query if mentioned"""
        # This would use NLP or pattern matching to extract program names
        programs = ["consumer_credit", "ap_automation", "trip_com", "tripcom"]
        query_lower = query.lower()
        
        for program in programs:
            if program.replace("_", " ") in query_lower or program in query_lower:
                return program
        
        return None
    
    def _register_tools(self):
        """Register all tools with the server"""
        # Tools are registered through the handlers above
        pass
    
    def _register_resources(self):
        """Register MCP resources for direct data access"""
        
        @self.server.list_resources()
        async def list_resources() -> List[Resource]:
            """List available resources"""
            return [
                Resource(
                    uri="schema://graphql/full",
                    name="Full GraphQL Schema",
                    description="Complete Highnote GraphQL schema",
                    mimeType="text/plain"
                ),
                Resource(
                    uri="docs://categories",
                    name="Documentation Categories",
                    description="All documentation categories",
                    mimeType="application/json"
                ),
                Resource(
                    uri="programs://list",
                    name="Program List",
                    description="All available programs with metadata",
                    mimeType="application/json"
                )
            ]
        
        @self.server.read_resource()
        async def read_resource(uri: str) -> str:
            """Read a resource by URI"""
            if uri == "schema://graphql/full":
                return await self.knowledge_base.get_full_schema()
            elif uri == "docs://categories":
                categories = await self.doc_tools.get_categories()
                return json.dumps(categories)
            elif uri == "programs://list":
                programs = await self.solutions_tools.list_programs()
                return json.dumps(programs)
            else:
                return f"Unknown resource: {uri}"
    
    async def run(self):
        """Run the MCP server"""
        # Use stdio transport for MCP communication
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                InitializationOptions(
                    server_name="lamplight-mcp",
                    server_version="1.0.0",
                    capabilities=self.server.get_capabilities(
                        notification_options=NotificationOptions(tools_changed=True),
                        experimental_capabilities={},
                    ),
                ),
            )

async def main():
    """Main entry point"""
    server = LamplightMCPServer()
    await server.run()

if __name__ == "__main__":
    asyncio.run(main())