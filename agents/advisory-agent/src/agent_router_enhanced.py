import asyncio
import aiohttp
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from enum import Enum

from query_classifier import QueryClassifier, QueryType

logger = logging.getLogger(__name__)

@dataclass
class AgentResponse:
    """Response from an individual agent."""
    agent_name: str
    response: str
    metadata: Dict[str, Any]
    processing_time_ms: float
    success: bool
    error: Optional[str] = None

@dataclass
class RoutingResult:
    """Result of routing a query to agents."""
    query: str
    query_type: str
    confidence: float
    schema_response: Optional[AgentResponse] = None
    doc_response: Optional[AgentResponse] = None
    ship_response: Optional[AgentResponse] = None
    combined_response: Optional[str] = None
    total_processing_time_ms: float = 0.0

class AgentRouter:
    """Routes queries to appropriate agents and combines responses."""
    
    def __init__(self,
                 schema_agent_url: str = "http://localhost:8000",
                 doc_agent_url: str = "http://localhost:8001",
                 ship_agent_url: str = "http://localhost:8003",
                 timeout: int = 30):
        self.schema_agent_url = schema_agent_url
        self.doc_agent_url = doc_agent_url
        self.ship_agent_url = ship_agent_url
        self.timeout = timeout
        self.classifier = QueryClassifier()
        
        # HTTP session for making requests
        self.session = None
    
    async def __aenter__(self):
        """Async context manager entry."""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=self.timeout)
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
    
    async def query_schema_agent(self, question: str, top_k: int = 5) -> AgentResponse:
        """Query the schema agent."""
        try:
            payload = {
                "question": question,
                "top_k": top_k
            }
            
            async with self.session.post(
                f"{self.schema_agent_url}/chat",
                json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return AgentResponse(
                        agent_name="schema-agent",
                        response=data.get("response", ""),
                        metadata=data.get("metadata", {}),
                        processing_time_ms=data.get("processing_time_ms", 0.0),
                        success=True
                    )
                else:
                    error_text = await response.text()
                    return AgentResponse(
                        agent_name="schema-agent",
                        response="",
                        metadata={},
                        processing_time_ms=0.0,
                        success=False,
                        error=f"HTTP {response.status}: {error_text}"
                    )
        
        except Exception as e:
            logger.error(f"Error querying schema agent: {e}")
            return AgentResponse(
                agent_name="schema-agent",
                response="",
                metadata={},
                processing_time_ms=0.0,
                success=False,
                error=str(e)
            )
    
    async def query_doc_agent(self, question: str, top_k: int = 5, category: Optional[str] = None) -> AgentResponse:
        """Query the document agent."""
        try:
            payload = {
                "question": question,
                "top_k": top_k
            }
            if category:
                payload["category"] = category
            
            async with self.session.post(
                f"{self.doc_agent_url}/chat",
                json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return AgentResponse(
                        agent_name="document-agent",
                        response=data.get("response", ""),
                        metadata=data.get("metadata", {}),
                        processing_time_ms=data.get("processing_time_ms", 0.0),
                        success=True
                    )
                else:
                    error_text = await response.text()
                    return AgentResponse(
                        agent_name="document-agent",
                        response="",
                        metadata={},
                        processing_time_ms=0.0,
                        success=False,
                        error=f"HTTP {response.status}: {error_text}"
                    )
        
        except Exception as e:
            logger.error(f"Error querying document agent: {e}")
            return AgentResponse(
                agent_name="document-agent",
                response="",
                metadata={},
                processing_time_ms=0.0,
                success=False,
                error=str(e)
            )
    
    async def query_ship_agent(self, question: str, program_type: Optional[str] = None) -> AgentResponse:
        """Query the ship agent for implementation-specific questions."""
        try:
            # Detect program type from question if not provided
            if not program_type:
                if "trip.com" in question.lower() or "trip com" in question.lower():
                    program_type = "trip.com"
                elif "consumer credit" in question.lower():
                    program_type = "consumer_credit"
                elif "ap automation" in question.lower() or "accounts payable" in question.lower():
                    program_type = "ap_automation"
            
            payload = {
                "question": question,
                "program_type": program_type
            }
            
            async with self.session.post(
                f"{self.ship_agent_url}/chat",
                json=payload
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return AgentResponse(
                        agent_name="ship-agent",
                        response=data.get("answer", ""),
                        metadata={
                            "relevant_operations": data.get("relevant_operations", []),
                            "code_examples": data.get("code_examples", []),
                            "best_practices": data.get("best_practices", []),
                            "llm_powered": data.get("llm_powered", False)
                        },
                        processing_time_ms=data.get("processing_time_ms", 0.0),
                        success=True
                    )
                else:
                    error_text = await response.text()
                    return AgentResponse(
                        agent_name="ship-agent",
                        response="",
                        metadata={},
                        processing_time_ms=0.0,
                        success=False,
                        error=f"HTTP {response.status}: {error_text}"
                    )
        
        except Exception as e:
            logger.error(f"Error querying ship agent: {e}")
            return AgentResponse(
                agent_name="ship-agent",
                response="",
                metadata={},
                processing_time_ms=0.0,
                success=False,
                error=str(e)
            )
    
    def is_implementation_question(self, question: str) -> bool:
        """Determine if a question is about implementation."""
        implementation_keywords = [
            "implement", "integrate", "setup", "configure", "deploy",
            "trip.com", "trip com", "consumer credit", "ap automation",
            "virtual card", "webhook", "authentication", "authorization",
            "booking", "payment card", "transaction", "settlement",
            "how do i", "how to", "what are the steps", "best practice"
        ]
        
        question_lower = question.lower()
        return any(keyword in question_lower for keyword in implementation_keywords)
    
    def combine_responses(self, 
                         query: str,
                         schema_response: Optional[AgentResponse], 
                         doc_response: Optional[AgentResponse],
                         ship_response: Optional[AgentResponse],
                         query_type: str) -> str:
        """Combine responses from multiple agents into a coherent answer."""
        
        responses = []
        
        # Prioritize ship agent for implementation questions
        if ship_response and ship_response.success and ship_response.response.strip():
            # Ship agent provides the main answer for implementation
            main_response = ship_response.response
            
            # Add code examples if available
            if ship_response.metadata.get("code_examples"):
                main_response += "\n\n## Code Examples\n"
                for example in ship_response.metadata["code_examples"]:
                    main_response += f"\n### {example.get('title', 'Example')}\n"
                    main_response += f"```{example.get('language', 'python')}\n"
                    main_response += example.get('code', '')
                    main_response += "\n```\n"
            
            # Add relevant operations if available
            if ship_response.metadata.get("relevant_operations"):
                main_response += "\n\n## Relevant API Operations\n"
                for op in ship_response.metadata["relevant_operations"][:5]:
                    main_response += f"- **{op['name']}**: {op.get('description', 'N/A')}\n"
            
            # Add best practices if available
            if ship_response.metadata.get("best_practices"):
                main_response += "\n\n## Best Practices\n"
                for practice in ship_response.metadata["best_practices"][:5]:
                    main_response += f"- {practice}\n"
            
            responses.append(("Implementation Guide", main_response))
        
        # Add schema response if relevant
        if schema_response and schema_response.success and schema_response.response.strip():
            responses.append(("GraphQL Schema", schema_response.response))
        
        # Add documentation response if relevant
        if doc_response and doc_response.success and doc_response.response.strip():
            responses.append(("Documentation", doc_response.response))
        
        if not responses:
            # No successful responses
            errors = []
            if schema_response and not schema_response.success:
                errors.append(f"Schema agent error: {schema_response.error}")
            if doc_response and not doc_response.success:
                errors.append(f"Document agent error: {doc_response.error}")
            if ship_response and not ship_response.success:
                errors.append(f"Ship agent error: {ship_response.error}")
            
            if errors:
                return f"I encountered some issues while processing your question:\n\n" + "\n".join(errors)
            else:
                return "I couldn't find relevant information to answer your question."
        
        # Single response - return as is
        if len(responses) == 1:
            source, response = responses[0]
            return f"{response}\n\n*Source: {source}*"
        
        # Multiple responses - combine intelligently
        # For implementation questions, ship agent takes priority
        if ship_response and ship_response.success:
            combined = responses[0][1]  # Ship agent response
            
            # Add supplementary information from other agents
            if len(responses) > 1:
                combined += "\n\n---\n\n## Additional Information\n\n"
                for source, response in responses[1:]:
                    combined += f"### From {source}:\n{response[:500]}...\n\n"
            
            combined += "*This answer combines implementation guidance with GraphQL schema and documentation information.*"
        else:
            # No ship agent response, use standard combination
            combined = f"Based on available information:\n\n"
            for i, (source, response) in enumerate(responses, 1):
                combined += f"**{source}:**\n{response}\n\n"
        
        return combined
    
    async def route_query(self, 
                         question: str, 
                         top_k: int = 5,
                         category: Optional[str] = None,
                         program_type: Optional[str] = None,
                         force_all: bool = False) -> RoutingResult:
        """
        Route a query to appropriate agents and return combined result.
        
        Args:
            question: The user's question
            top_k: Number of chunks to retrieve from each agent
            category: Optional category filter for document agent
            program_type: Optional program type for ship agent
            force_all: Force querying all agents regardless of classification
        """
        start_time = asyncio.get_event_loop().time()
        
        # Classify the query
        routing_strategy = self.classifier.get_routing_strategy(question)
        query_type = routing_strategy['query_type']
        confidence = routing_strategy['confidence']
        
        # Check if it's an implementation question
        is_implementation = self.is_implementation_question(question)
        
        # Determine which agents to query
        query_schema = force_all or routing_strategy['query_schema_agent']
        query_doc = force_all or routing_strategy['query_doc_agent']
        query_ship = force_all or is_implementation
        
        logger.info(f"Routing query: '{question[:50]}...' -> Type: {query_type}, Implementation: {is_implementation}, Schema: {query_schema}, Docs: {query_doc}, Ship: {query_ship}")
        
        # Prepare tasks
        tasks = []
        
        if query_schema:
            tasks.append(("schema", self.query_schema_agent(question, top_k)))
        
        if query_doc:
            tasks.append(("doc", self.query_doc_agent(question, top_k, category)))
        
        if query_ship:
            tasks.append(("ship", self.query_ship_agent(question, program_type)))
        
        # Execute queries concurrently
        schema_response = None
        doc_response = None
        ship_response = None
        
        if tasks:
            results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
            
            for i, (agent_type, _) in enumerate(tasks):
                result = results[i]
                if isinstance(result, Exception):
                    logger.error(f"Exception from {agent_type} agent: {result}")
                    error_response = AgentResponse(
                        agent_name=f"{agent_type}-agent",
                        response="",
                        metadata={},
                        processing_time_ms=0.0,
                        success=False,
                        error=str(result)
                    )
                    if agent_type == "schema":
                        schema_response = error_response
                    elif agent_type == "doc":
                        doc_response = error_response
                    elif agent_type == "ship":
                        ship_response = error_response
                else:
                    if agent_type == "schema":
                        schema_response = result
                    elif agent_type == "doc":
                        doc_response = result
                    elif agent_type == "ship":
                        ship_response = result
        
        # Combine responses
        combined_response = self.combine_responses(
            question,
            schema_response,
            doc_response,
            ship_response,
            query_type if not is_implementation else "implementation"
        )
        
        # Calculate total processing time
        end_time = asyncio.get_event_loop().time()
        total_time = (end_time - start_time) * 1000
        
        return RoutingResult(
            query=question,
            query_type=query_type if not is_implementation else "implementation",
            confidence=confidence,
            schema_response=schema_response,
            doc_response=doc_response,
            combined_response=combined_response,
            total_processing_time_ms=total_time
        )
    
    async def health_check(self) -> Dict[str, Dict[str, Any]]:
        """Check health of all agents."""
        results = {}
        
        # Check schema agent
        try:
            async with self.session.get(f"{self.schema_agent_url}/health") as resp:
                results["schema-agent"] = {
                    "status": "healthy" if resp.status == 200 else "unhealthy",
                    "http_status": resp.status
                }
        except Exception as e:
            results["schema-agent"] = {
                "status": "unreachable",
                "error": str(e)
            }
        
        # Check document agent
        try:
            async with self.session.get(f"{self.doc_agent_url}/health") as resp:
                results["document-agent"] = {
                    "status": "healthy" if resp.status == 200 else "unhealthy",
                    "http_status": resp.status
                }
        except Exception as e:
            results["document-agent"] = {
                "status": "unreachable",
                "error": str(e)
            }
        
        # Check ship agent
        try:
            async with self.session.get(f"{self.ship_agent_url}/health") as resp:
                results["ship-agent"] = {
                    "status": "healthy" if resp.status == 200 else "unhealthy",
                    "http_status": resp.status
                }
        except Exception as e:
            results["ship-agent"] = {
                "status": "unreachable",
                "error": str(e)
            }
        
        return results