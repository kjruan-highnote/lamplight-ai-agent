import os
import logging
import time
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import our agent router
import sys
sys.path.append('.')
from src.agent_router import AgentRouter

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)

# Security
security = HTTPBearer(auto_error=False)

# Configuration
API_KEY = os.getenv("API_KEY")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
MAX_QUESTION_LENGTH = int(os.getenv("MAX_QUESTION_LENGTH", "1000"))
ENABLE_AUTH = os.getenv("ENABLE_AUTH", "false").lower() == "true"

# Agent URLs
SCHEMA_AGENT_URL = os.getenv("SCHEMA_AGENT_URL", "http://localhost:8000")
DOC_AGENT_URL = os.getenv("DOC_AGENT_URL", "http://localhost:8001")
AGENT_TIMEOUT = int(os.getenv("AGENT_TIMEOUT", "30"))

app = FastAPI(
    title="Highnote Advisory Agent API",
    description="Intelligent routing agent for Highnote GraphQL schema and documentation questions",
    version="1.0.0"
)

# Rate limiting error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS with configurable origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"]
)

# Global router instance
router = None

@app.on_event("startup")
async def startup_event():
    """Initialize the agent router on startup."""
    global router
    try:
        logger.info("Initializing advisory agent router...")
        router = AgentRouter(
            schema_agent_url=SCHEMA_AGENT_URL,
            doc_agent_url=DOC_AGENT_URL,
            timeout=AGENT_TIMEOUT
        )
        # Initialize the session
        await router.__aenter__()
        
        logger.info("Advisory agent router initialized successfully")
        logger.info(f"Schema agent URL: {SCHEMA_AGENT_URL}")
        logger.info(f"Document agent URL: {DOC_AGENT_URL}")
        
        # Test connectivity
        health = await router.health_check()
        for agent, status in health.items():
            logger.info(f"{agent}: {status['status']}")
            
    except Exception as e:
        logger.error(f"Failed to initialize advisory agent router: {e}")
        router = None

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up on shutdown."""
    global router
    if router:
        try:
            await router.__aexit__(None, None, None)
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_LENGTH, description="Question about Highnote")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Number of relevant chunks to retrieve")
    category: Optional[str] = Field(None, description="Filter by documentation category")
    force_both_agents: Optional[bool] = Field(False, description="Force querying both agents regardless of classification")
    
    @field_validator('question')
    def validate_question(cls, v):
        if not v.strip():
            raise ValueError('Question cannot be empty or only whitespace')
        return v.strip()

class ChatResponse(BaseModel):
    response: str
    query_type: str
    confidence: float
    agents_used: List[str]
    metadata: Dict[str, Any] = Field(default_factory=dict)
    processing_time_ms: float

class HealthResponse(BaseModel):
    status: str
    advisory_agent_ready: bool
    agents_status: Dict[str, Any]
    timestamp: str

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    timestamp: str

async def verify_api_key(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify API key if authentication is enabled."""
    if not ENABLE_AUTH:
        return True
        
    if not credentials or not API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required"
        )
        
    if credentials.credentials != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )
    return True

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    if not router:
        return HealthResponse(
            status="unhealthy",
            advisory_agent_ready=False,
            agents_status={},
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
        )
    
    try:
        agents_health = await router.health_check()
        overall_status = "healthy" if all(
            agent_status["status"] == "healthy" 
            for agent_status in agents_health.values()
        ) else "degraded"
        
        return HealthResponse(
            status=overall_status,
            advisory_agent_ready=True,
            agents_status=agents_health,
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return HealthResponse(
            status="unhealthy",
            advisory_agent_ready=False,
            agents_status={"error": str(e)},
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
        )

@app.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest, 
    _: bool = Depends(verify_api_key)
):
    """Main chat endpoint that routes to appropriate agents."""
    start_time = time.time()
    
    try:
        if not router:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Advisory agent router not available"
            )
        
        logger.info(f"Processing question: {chat_request.question[:100]}...")
        
        # Route the query
        result = await router.route_query(
            question=chat_request.question,
            top_k=chat_request.top_k,
            category=chat_request.category,
            force_both=chat_request.force_both_agents
        )
        
        # Determine which agents were used
        agents_used = []
        if result.schema_response and result.schema_response.success:
            agents_used.append("schema-agent")
        if result.doc_response and result.doc_response.success:
            agents_used.append("document-agent")
        
        processing_time = (time.time() - start_time) * 1000
        
        return ChatResponse(
            response=result.combined_response,
            query_type=result.query_type,
            confidence=result.confidence,
            agents_used=agents_used,
            metadata={
                "top_k": chat_request.top_k,
                "category": chat_request.category,
                "force_both_agents": chat_request.force_both_agents,
                "question_length": len(chat_request.question),
                "schema_agent_time": result.schema_response.processing_time_ms if result.schema_response else 0,
                "doc_agent_time": result.doc_response.processing_time_ms if result.doc_response else 0,
                "routing_time": result.total_processing_time_ms
            },
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        logger.error(f"Error processing chat request: {e}")
        processing_time = (time.time() - start_time) * 1000
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )

@app.get("/agents/status")
@limiter.limit("10/minute")
async def get_agents_status(
    request: Request,
    _: bool = Depends(verify_api_key)
):
    """Get detailed status of underlying agents."""
    try:
        if not router:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Router not available"
            )
        
        return await router.health_check()
        
    except Exception as e:
        logger.error(f"Error getting agents status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/routing/test")
@limiter.limit("10/minute")
async def test_routing(
    request: Request,
    question: str,
    _: bool = Depends(verify_api_key)
):
    """Test query classification without executing."""
    try:
        if not router:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Router not available"
            )
        
        routing_strategy = router.classifier.get_routing_strategy(question)
        
        return {
            "question": question,
            "routing_strategy": routing_strategy,
            "explanation": {
                "schema_agent": "Will be queried" if routing_strategy['query_schema_agent'] else "Will be skipped",
                "doc_agent": "Will be queried" if routing_strategy['query_doc_agent'] else "Will be skipped"
            }
        }
        
    except Exception as e:
        logger.error(f"Error testing routing: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/categories")
@limiter.limit("10/minute")
async def get_categories(
    request: Request,
    _: bool = Depends(verify_api_key)
):
    """Get available documentation categories from document agent."""
    try:
        if not router or not router.session:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Router not available"
            )
        
        # Proxy request to document agent
        async with router.session.get(f"{DOC_AGENT_URL}/categories") as response:
            if response.status == 200:
                return await response.json()
            else:
                raise HTTPException(
                    status_code=response.status,
                    detail=f"Document agent error: {await response.text()}"
                )
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}")
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal server error",
            detail="An unexpected error occurred",
            timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
        ).dict()
    )

if __name__ == "__main__":
    import uvicorn
    
    # Get configuration from environment
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8002"))  # Use 8002 for advisory agent
    
    logger.info(f"Starting Advisory Agent API server on {host}:{port}")
    logger.info(f"Authentication enabled: {ENABLE_AUTH}")
    logger.info(f"Schema agent: {SCHEMA_AGENT_URL}")
    logger.info(f"Document agent: {DOC_AGENT_URL}")
    
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )