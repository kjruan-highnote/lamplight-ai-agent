from fastapi import FastAPI, Request
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from agent.llm_agent import LLMQA as SchemaAgent

app = FastAPI()

# Optional: allow frontend apps to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Initialize your schema-aware agent
agent = SchemaAgent()

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    response: str

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    reply = agent.answer(request.question)
    return {"response": reply}

@app.post("/chat/stream")
async def stream_chat(request: ChatRequest):
    def event_generator():
        for chunk in agent.streamAnswer(request.question):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
