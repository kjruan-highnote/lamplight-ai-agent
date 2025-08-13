import asyncio
import aiohttp
import logging
import os
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
    combined_response: Optional[str] = None
    total_processing_time_ms: float = 0.0

class AgentRouter:
    """
    Enhanced router that supports both internal and external agent connections.
    When exposed via ngrok, it uses localhost for internal agent communication.
    """
    
    def __init__(self,
                 schema_agent_url: str = "http://localhost:8000",
                 doc_agent_url: str = "http://localhost:8001",
                 ship_agent_url: str = "http://localhost:8003",
                 timeout: int = 30,
                 use_internal_urls: bool = True):
        """
        Initialize the agent router.
        
        Args:
            schema_agent_url: URL for the schema agent
            doc_agent_url: URL for the document agent
            ship_agent_url: URL for the ship agent
            timeout: Request timeout in seconds
            use_internal_urls: Force use of localhost URLs for internal communication
        """
        # When exposed via ngrok, always use internal URLs
        if use_internal_urls or self._is_ngrok_environment():
            self.schema_agent_url = self._ensure_localhost(schema_agent_url)
            self.doc_agent_url = self._ensure_localhost(doc_agent_url)
            self.ship_agent_url = self._ensure_localhost(ship_agent_url)
            logger.info("Using internal localhost URLs for agent communication")
        else:
            self.schema_agent_url = schema_agent_url
            self.doc_agent_url = doc_agent_url
            self.ship_agent_url = ship_agent_url
        
        self.timeout = timeout
        self.classifier = QueryClassifier()
        
        # HTTP session for making requests
        self.session = None
        
        logger.info(f"Agent Router initialized with:")
        logger.info(f"  Schema Agent: {self.schema_agent_url}")
        logger.info(f"  Document Agent: {self.doc_agent_url}")
        logger.info(f"  Ship Agent: {self.ship_agent_url}")
    
    def _is_ngrok_environment(self) -> bool:
        """Check if running in ngrok environment."""
        return any([
            os.getenv("NGROK_DOMAIN"),
            os.getenv("NGROK_AUTHTOKEN"),
            os.path.exists("/tmp/ngrok.sock")
        ])
    
    def _ensure_localhost(self, url: str) -> str:
        """Convert any URL to localhost equivalent."""
        if "localhost" in url or "127.0.0.1" in url:
            return url
        
        # Extract port from URL
        if ":8000" in url:
            return "http://localhost:8000"
        elif ":8001" in url:
            return "http://localhost:8001"
        elif ":8003" in url:
            return "http://localhost:8003"
        
        # Default fallback
        return url.replace("http://", "http://localhost:")
    
    async def __aenter__(self):
        """Async context manager entry."""
        # Create session with custom connector for better connection pooling
        connector = aiohttp.TCPConnector(
            limit=100,
            limit_per_host=30,
            ttl_dns_cache=300,
            enable_cleanup_closed=True
        )
        
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(
                total=self.timeout,
                connect=5,
                sock_connect=5,
                sock_read=self.timeout
            ),
            connector=connector,
            headers={
                "User-Agent": "Advisory-Agent/1.0",
                "Accept": "application/json"
            }
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        if self.session:
            await self.session.close()
            # Small delay to allow connections to close properly
            await asyncio.sleep(0.25)
    
    async def query_schema_agent(self, question: str, top_k: int = 5) -> AgentResponse:
        """Query the schema agent with retry logic."""
        max_retries = 2
        retry_delay = 1
        
        for attempt in range(max_retries + 1):
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
                        if attempt < max_retries:
                            await asyncio.sleep(retry_delay)
                            continue
                        return AgentResponse(
                            agent_name="schema-agent",
                            response="",
                            metadata={},
                            processing_time_ms=0.0,
                            success=False,
                            error=f"HTTP {response.status}: {error_text}"
                        )
            
            except asyncio.TimeoutError:
                if attempt < max_retries:
                    logger.warning(f"Schema agent timeout, retrying... (attempt {attempt + 1})")
                    await asyncio.sleep(retry_delay)
                    continue
                logger.error(f"Schema agent timeout after {max_retries + 1} attempts")
                return AgentResponse(
                    agent_name="schema-agent",
                    response="",
                    metadata={},
                    processing_time_ms=0.0,
                    success=False,
                    error="Request timeout"
                )
            
            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"Schema agent error, retrying: {e}")
                    await asyncio.sleep(retry_delay)
                    continue
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
        """Query the document agent with retry logic."""
        max_retries = 2
        retry_delay = 1
        
        for attempt in range(max_retries + 1):
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
                        if attempt < max_retries:
                            await asyncio.sleep(retry_delay)
                            continue
                        return AgentResponse(
                            agent_name="document-agent",
                            response="",
                            metadata={},
                            processing_time_ms=0.0,
                            success=False,
                            error=f"HTTP {response.status}: {error_text}"
                        )
            
            except asyncio.TimeoutError:
                if attempt < max_retries:
                    logger.warning(f"Document agent timeout, retrying... (attempt {attempt + 1})")
                    await asyncio.sleep(retry_delay)
                    continue
                logger.error(f"Document agent timeout after {max_retries + 1} attempts")
                return AgentResponse(
                    agent_name="document-agent",
                    response="",
                    metadata={},
                    processing_time_ms=0.0,
                    success=False,
                    error="Request timeout"
                )
            
            except Exception as e:
                if attempt < max_retries:
                    logger.warning(f"Document agent error, retrying: {e}")
                    await asyncio.sleep(retry_delay)
                    continue
                logger.error(f"Error querying document agent: {e}")
                return AgentResponse(
                    agent_name="document-agent",
                    response="",
                    metadata={},
                    processing_time_ms=0.0,
                    success=False,
                    error=str(e)
                )
    
    def combine_responses(self, 
                         query: str,
                         schema_response: Optional[AgentResponse], 
                         doc_response: Optional[AgentResponse],
                         query_type: str) -> str:
        """Combine responses from multiple agents into a coherent answer."""
        
        responses = []
        
        # Collect successful responses
        if schema_response and schema_response.success and schema_response.response.strip():
            responses.append(("Schema", schema_response.response))
        
        if doc_response and doc_response.success and doc_response.response.strip():
            responses.append(("Documentation", doc_response.response))
        
        if not responses:
            # No successful responses
            errors = []
            if schema_response and not schema_response.success:
                errors.append(f"Schema agent error: {schema_response.error}")
            if doc_response and not doc_response.success:
                errors.append(f"Document agent error: {doc_response.error}")
            
            if errors:
                return f"I encountered some issues while processing your question:\n\n" + "\n".join(errors)
            else:
                return "I couldn't find relevant information to answer your question."
        
        # Single response - return as is
        if len(responses) == 1:
            source, response = responses[0]
            return f"{response}\n\n*Source: {source} Agent*"
        
        # Multiple responses - combine intelligently
        combined = f"Based on both the GraphQL schema and documentation:\n\n"
        
        for i, (source, response) in enumerate(responses, 1):
            combined += f"**{source} Information:**\n{response}\n\n"
        
        # Add synthesis note for mixed queries
        if query_type == "mixed":
            combined += "*This answer combines information from both the GraphQL schema and documentation to provide a complete response.*"
        
        return combined
    
    async def route_query(self, 
                         question: str, 
                         top_k: int = 5,
                         category: Optional[str] = None,
                         force_both: bool = False) -> RoutingResult:
        """
        Route a query to appropriate agents and return combined result.
        
        Args:
            question: The user's question
            top_k: Number of chunks to retrieve from each agent
            category: Optional category filter for document agent
            force_both: Force querying both agents regardless of classification
        """
        start_time = asyncio.get_event_loop().time()
        
        # Classify the query
        routing_strategy = self.classifier.get_routing_strategy(question)
        query_type = routing_strategy['query_type']
        confidence = routing_strategy['confidence']
        
        # Determine which agents to query
        query_schema = force_both or routing_strategy['query_schema_agent']
        query_doc = force_both or routing_strategy['query_doc_agent']
        
        logger.info(f"Routing query: '{question[:50]}...' -> Type: {query_type}, Schema: {query_schema}, Docs: {query_doc}")
        
        # Prepare tasks
        tasks = []
        
        if query_schema:
            tasks.append(("schema", self.query_schema_agent(question, top_k)))
        
        if query_doc:
            tasks.append(("doc", self.query_doc_agent(question, top_k, category)))
        
        # Execute queries concurrently
        schema_response = None
        doc_response = None
        
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
                    else:
                        doc_response = error_response
                else:
                    if agent_type == "schema":
                        schema_response = result
                    else:
                        doc_response = result
        
        # Combine responses
        combined_response = self.combine_responses(question, schema_response, doc_response, query_type)
        
        end_time = asyncio.get_event_loop().time()
        total_time = (end_time - start_time) * 1000
        
        return RoutingResult(
            query=question,
            query_type=query_type,
            confidence=confidence,
            schema_response=schema_response,
            doc_response=doc_response,
            combined_response=combined_response,
            total_processing_time_ms=total_time
        )
    
    async def health_check(self) -> Dict[str, Any]:
        """Check health of all agents with improved error handling."""
        health_status = {
            "schema_agent": {"status": "unknown", "details": None},
            "doc_agent": {"status": "unknown", "details": None}
        }
        
        # Check schema agent
        try:
            async with self.session.get(
                f"{self.schema_agent_url}/health",
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    health_status["schema_agent"] = {"status": "healthy", "details": data}
                else:
                    health_status["schema_agent"] = {"status": "unhealthy", "details": f"HTTP {response.status}"}
        except asyncio.TimeoutError:
            health_status["schema_agent"] = {"status": "timeout", "details": "Health check timed out"}
        except Exception as e:
            health_status["schema_agent"] = {"status": "unreachable", "details": str(e)}
        
        # Check document agent
        try:
            async with self.session.get(
                f"{self.doc_agent_url}/health",
                timeout=aiohttp.ClientTimeout(total=5)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    health_status["doc_agent"] = {"status": "healthy", "details": data}
                else:
                    health_status["doc_agent"] = {"status": "unhealthy", "details": f"HTTP {response.status}"}
        except asyncio.TimeoutError:
            health_status["doc_agent"] = {"status": "timeout", "details": "Health check timed out"}
        except Exception as e:
            health_status["doc_agent"] = {"status": "unreachable", "details": str(e)}
        
        return health_status

if __name__ == "__main__":
    import asyncio
    
    async def test_router():
        async with AgentRouter() as router:
            # Test health check
            health = await router.health_check()
            print("Health Status:")
            for agent, status in health.items():
                print(f"  {agent}: {status['status']}")
            
            # Test routing
            test_queries = [
                "What is the type of the ping field?",
                "How do I create a card product?",
                "How do I use the createCardProduct mutation in my application?"
            ]
            
            for query in test_queries:
                print(f"\n--- Testing Query: {query} ---")
                result = await router.route_query(query)
                print(f"Query Type: {result.query_type} (confidence: {result.confidence:.2f})")
                print(f"Response: {result.combined_response[:200]}...")
                print(f"Total Time: {result.total_processing_time_ms:.1f}ms")
    
    asyncio.run(test_router())