"""
LLM Manager for MCP Server

Manages all LLM interactions including prompt templates, response generation,
and response synthesis across multiple agents.
"""

import json
import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from dataclasses import dataclass
from enum import Enum

import httpx

logger = logging.getLogger(__name__)

class ResponseFormat(Enum):
    """Response format types"""
    MARKDOWN = "markdown"
    JSON = "json"
    YAML = "yaml"
    TEXT = "text"

@dataclass
class LLMConfig:
    """LLM configuration"""
    model: str = "llama3"
    temperature: float = 0.7
    max_tokens: int = 2000
    api_base: str = "http://localhost:11434"  # Ollama default
    timeout: int = 30

class PromptTemplates:
    """Collection of prompt templates for different query types"""
    
    @staticmethod
    def schema_prompt(query: str, context: List[Dict], include_examples: bool = True) -> str:
        """Generate prompt for schema queries"""
        prompt = f"""You are a GraphQL schema expert. Answer the following question about the Highnote GraphQL API.

Question: {query}

Relevant Schema Information:
"""
        for item in context:
            prompt += f"\n{item.get('content', '')}\n"
        
        if include_examples:
            prompt += """
Please provide:
1. A clear explanation
2. Relevant schema definitions
3. Example GraphQL queries/mutations when applicable
4. Any important considerations or best practices
"""
        else:
            prompt += "\nProvide a clear and concise explanation."
        
        return prompt
    
    @staticmethod
    def documentation_prompt(query: str, context: List[Dict], include_sources: bool = True) -> str:
        """Generate prompt for documentation queries"""
        prompt = f"""You are a Highnote documentation expert. Answer the following question using the provided documentation.

Question: {query}

Relevant Documentation:
"""
        for item in context:
            prompt += f"\n{item.get('content', '')}\n"
            if include_sources and 'source' in item.get('metadata', {}):
                prompt += f"Source: {item['metadata']['source']}\n"
        
        prompt += """
Provide a comprehensive answer that:
1. Directly addresses the question
2. Includes relevant details from the documentation
3. References specific sections when applicable
4. Maintains accuracy to the source material
"""
        return prompt
    
    @staticmethod
    def implementation_prompt(
        program_type: str, 
        query: Optional[str], 
        schema_context: List[Dict],
        doc_context: List[Dict],
        format: str = "markdown"
    ) -> str:
        """Generate prompt for implementation guidance"""
        prompt = f"""You are an expert in implementing Highnote programs. 
Program Type: {program_type}
"""
        if query:
            prompt += f"Specific Question: {query}\n"
        
        prompt += "\nRelevant Schema Information:\n"
        for item in schema_context[:3]:  # Limit context
            prompt += f"{item.get('content', '')[:500]}...\n"
        
        prompt += "\nRelevant Documentation:\n"
        for item in doc_context[:3]:
            prompt += f"{item.get('content', '')[:500]}...\n"
        
        prompt += f"""
Please provide implementation guidance in {format} format that includes:
1. Step-by-step implementation approach
2. Required GraphQL operations
3. Common implementation patterns
4. Error handling considerations
5. Testing recommendations
"""
        return prompt
    
    @staticmethod
    def synthesis_prompt(query: str, responses: Dict[str, str], context: Any) -> str:
        """Generate prompt for synthesizing multiple agent responses"""
        prompt = f"""Synthesize the following responses to answer the user's question comprehensively.

User Question: {query}

Available Responses:
"""
        for agent, response in responses.items():
            prompt += f"\n[{agent.upper()} Agent Response]:\n{response}\n"
        
        prompt += """
Create a unified response that:
1. Combines the most relevant information from all sources
2. Eliminates redundancy
3. Maintains accuracy and completeness
4. Provides a coherent answer to the original question
"""
        return prompt

class LLMManager:
    """
    Manages LLM interactions for the MCP server.
    
    Features:
    - Multiple model support (Ollama, OpenAI, Anthropic)
    - Streaming responses
    - Token budget management
    - Response caching
    - Error handling and retries
    """
    
    def __init__(self, config: Dict[str, Any]):
        self.config = LLMConfig(**config.get("llm", {}))
        self.templates = PromptTemplates()
        self.client = httpx.AsyncClient(timeout=self.config.timeout)
        
        # Response cache to avoid redundant LLM calls
        self.cache = {}
    
    async def generate_schema_response(
        self, 
        query: str, 
        context: List[Dict],
        include_examples: bool = True
    ) -> str:
        """Generate response for schema-related queries"""
        prompt = self.templates.schema_prompt(query, context, include_examples)
        return await self._generate(prompt)
    
    async def generate_doc_response(
        self,
        query: str,
        context: List[Dict],
        include_sources: bool = True
    ) -> str:
        """Generate response for documentation queries"""
        prompt = self.templates.documentation_prompt(query, context, include_sources)
        return await self._generate(prompt)
    
    async def generate_implementation_guide(
        self,
        program_type: str,
        query: Optional[str],
        schema_context: List[Dict],
        doc_context: List[Dict],
        format: str = "markdown"
    ) -> str:
        """Generate implementation guidance"""
        prompt = self.templates.implementation_prompt(
            program_type, query, schema_context, doc_context, format
        )
        return await self._generate(prompt)
    
    async def synthesize_responses(
        self,
        query: str,
        responses: Dict[str, str],
        context: Any = None
    ) -> str:
        """Synthesize multiple agent responses into a unified answer"""
        prompt = self.templates.synthesis_prompt(query, responses, context)
        return await self._generate(prompt)
    
    async def _generate(self, prompt: str) -> str:
        """Generate response using configured LLM"""
        # Check cache
        cache_key = hash(prompt)
        if cache_key in self.cache:
            logger.info("Returning cached response")
            return self.cache[cache_key]
        
        try:
            # Call Ollama API
            response = await self.client.post(
                f"{self.config.api_base}/api/generate",
                json={
                    "model": self.config.model,
                    "prompt": prompt,
                    "temperature": self.config.temperature,
                    "max_tokens": self.config.max_tokens,
                    "stream": False
                }
            )
            response.raise_for_status()
            
            result = response.json()
            generated_text = result.get("response", "")
            
            # Cache the response
            self.cache[cache_key] = generated_text
            
            return generated_text
            
        except httpx.HTTPError as e:
            logger.error(f"LLM generation failed: {e}")
            return self._fallback_response(prompt)
        except Exception as e:
            logger.error(f"Unexpected error in LLM generation: {e}")
            return self._fallback_response(prompt)
    
    async def stream_response(self, prompt: str) -> AsyncGenerator[str, None]:
        """Stream response from LLM"""
        try:
            async with self.client.stream(
                "POST",
                f"{self.config.api_base}/api/generate",
                json={
                    "model": self.config.model,
                    "prompt": prompt,
                    "temperature": self.config.temperature,
                    "stream": True
                }
            ) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.error(f"Streaming failed: {e}")
            yield self._fallback_response(prompt)
    
    def _fallback_response(self, prompt: str) -> str:
        """Generate fallback response when LLM is unavailable"""
        if "schema" in prompt.lower():
            return "I'm unable to generate a detailed schema response at the moment. Please refer to the GraphQL schema documentation."
        elif "documentation" in prompt.lower():
            return "I'm unable to access the full documentation at the moment. Please check the Highnote documentation portal."
        elif "implementation" in prompt.lower():
            return "I'm unable to generate implementation guidance at the moment. Please consult the implementation guides."
        else:
            return "I'm unable to process your request at the moment. Please try again later."
    
    def estimate_tokens(self, text: str) -> int:
        """Estimate token count for text"""
        # Rough estimation: 1 token ≈ 4 characters
        return len(text) // 4
    
    def truncate_to_budget(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within token budget"""
        estimated_tokens = self.estimate_tokens(text)
        if estimated_tokens <= max_tokens:
            return text
        
        # Truncate to approximately max_tokens
        max_chars = max_tokens * 4
        return text[:max_chars] + "..."
    
    async def close(self):
        """Clean up resources"""
        await self.client.aclose()