import os
import logging
import time
from typing import Optional, Dict, Any
from fastapi import FastAPI, Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, field_validator
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import our document agent
import sys
sys.path.append('.')
from src.doc_llm_agent import DocumentLLMAgent

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
CHUNKS_DIR = os.getenv("CHUNKS_DIR", "data/chunks")
MODEL = os.getenv("MODEL", "llama3")

app = FastAPI(
    title="Highnote Documentation QA API",
    description="AI-powered Highnote documentation question-answering service",
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

# Initialize document agent
try:
    logger.info("Initializing document agent...")
    agent = DocumentLLMAgent(
        model=MODEL,
        chunks_dir=CHUNKS_DIR
    )
    logger.info("Document agent initialized successfully")
    logger.info(f"Using model: {MODEL}")
    logger.info(f"Chunks directory: {CHUNKS_DIR}")
    
    # Get stats
    stats = agent.retriever.get_stats()
    logger.info(f"Loaded {stats['total_chunks']} chunks across {len(stats['categories'])} categories")
except Exception as e:
    logger.error(f"Failed to initialize document agent: {e}")
    agent = None

class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=MAX_QUESTION_LENGTH, description="Question about Highnote documentation")
    top_k: Optional[int] = Field(5, ge=1, le=20, description="Number of relevant chunks to retrieve")
    category: Optional[str] = Field(None, description="Filter by documentation category (basics, issuing, acquiring, sdks)")
    
    @field_validator('question')
    def validate_question(cls, v):
        if not v.strip():
            raise ValueError('Question cannot be empty or only whitespace')
        return v.strip()

class ChatResponse(BaseModel):
    response: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    processing_time_ms: float

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    timestamp: str

class HealthResponse(BaseModel):
    status: str
    agent_ready: bool
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
    return HealthResponse(
        status="healthy" if agent is not None else "unhealthy",
        agent_ready=agent is not None,
        timestamp=time.strftime("%Y-%m-%d %H:%M:%S")
    )

@app.post("/chat", response_model=ChatResponse)
@limiter.limit("30/minute")
async def chat_endpoint(
    request: Request,
    chat_request: ChatRequest, 
    _: bool = Depends(verify_api_key)
):
    """Main chat endpoint for Highnote documentation questions."""
    start_time = time.time()
    
    try:
        if agent is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Document agent not available"
            )
        
        logger.info(f"Processing question: {chat_request.question[:100]}...")
        
        # Get answer
        reply = agent.answer(
            question=chat_request.question,
            top_k=chat_request.top_k,
            category_filter=chat_request.category
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        return ChatResponse(
            response=reply,
            metadata={
                "top_k": chat_request.top_k,
                "category": chat_request.category,
                "question_length": len(chat_request.question)
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

@app.get("/stats")
@limiter.limit("10/minute")
async def get_stats(
    request: Request,
    _: bool = Depends(verify_api_key)
):
    """Get document agent statistics."""
    try:
        if agent is None or not hasattr(agent, 'retriever'):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Agent or retriever not available"
            )
        
        stats = agent.retriever.get_stats()
        return stats
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
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
    """Get available documentation categories."""
    try:
        if agent is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Agent not available"
            )
        
        stats = agent.retriever.get_stats()
        categories = list(stats.get('categories', {}).keys())
        
        return {
            "categories": categories,
            "descriptions": {
                "basics": "Basic concepts and getting started guides",
                "issuing": "Card issuing, templates, and credit features",
                "acquiring": "Payment acceptance and processing",
                "sdks": "Client-side SDKs and integration guides",
                "general": "General documentation pages"
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting categories: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.post("/chat/stream")
@limiter.limit("10/minute") 
async def stream_chat(
    request: Request,
    chat_request: ChatRequest,
    _: bool = Depends(verify_api_key)
):
    """Streaming chat endpoint."""
    def event_generator():
        try:
            if agent is None:
                yield f"data: {{\"error\": \"Agent not available\"}}\n\n"
                return
            
            logger.info(f"Processing streaming question: {chat_request.question[:100]}...")
                
            for chunk in agent.stream_answer(
                question=chat_request.question,
                top_k=chat_request.top_k,
                category_filter=chat_request.category
            ):
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"Error in streaming: {e}")
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"
    
    return StreamingResponse(
        event_generator(), 
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"}
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
    port = int(os.getenv("PORT", "8001"))  # Use 8001 to avoid conflict with schema-agent
    
    logger.info(f"Starting Document Agent API server on {host}:{port}")
    logger.info(f"Authentication enabled: {ENABLE_AUTH}")
    logger.info(f"Allowed origins: {ALLOWED_ORIGINS}")
    
    uvicorn.run(
        "api:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )