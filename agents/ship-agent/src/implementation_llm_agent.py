#!/usr/bin/env python3
"""
Implementation LLM Agent - Intelligent agent for answering implementation questions
Combines knowledge from ship-agent operations, document agent, and schema agent
"""
import json
import logging
import ollama
import asyncio
import aiohttp
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


class ImplementationLLMAgent:
    """
    LLM-powered agent for answering implementation questions with multi-agent collaboration
    """
    
    def __init__(self, 
                 model: str = "llama3",
                 doc_agent_url: str = "http://localhost:8001",
                 schema_agent_url: str = "http://localhost:8000",
                 temperature: float = 0.1):
        self.model = model
        self.doc_agent_url = doc_agent_url
        self.schema_agent_url = schema_agent_url
        self.temperature = temperature
        self.operations_cache = self._load_operations_cache()
        self.implementation_knowledge = self._load_implementation_knowledge()
        
    def _load_operations_cache(self) -> Dict[str, Any]:
        """Load operations from JSON files"""
        cache = {}
        operations_dir = Path("data/operations")
        
        if operations_dir.exists():
            for json_file in operations_dir.glob("*_operations.json"):
                try:
                    with open(json_file, 'r') as f:
                        operations = json.load(f)
                        program_type = json_file.stem.replace('_operations', '')
                        cache[program_type] = operations
                        logger.info(f"Loaded {len(operations)} operations for {program_type}")
                except Exception as e:
                    logger.error(f"Failed to load {json_file}: {e}")
        
        return cache
    
    def _load_implementation_knowledge(self) -> Dict[str, Any]:
        """Load implementation-specific knowledge base"""
        return {
            "trip.com": {
                "description": "Travel services platform integration",
                "key_challenges": [
                    "Multi-currency transaction handling",
                    "Pre-authorization for bookings",
                    "Cancellation and refund flows",
                    "Real-time expense tracking"
                ],
                "integration_tips": [
                    "Use virtual cards for each booking",
                    "Implement webhook handlers for booking status",
                    "Cache FX rates for multi-currency support",
                    "Use idempotency keys for all transactions"
                ],
                "common_errors": {
                    "INSUFFICIENT_FUNDS": "Pre-authorization amount exceeds available balance",
                    "CURRENCY_MISMATCH": "Transaction currency doesn't match card currency",
                    "BOOKING_EXPIRED": "Booking window has expired before authorization"
                }
            },
            "consumer_credit": {
                "description": "Consumer credit card program",
                "key_challenges": [
                    "Credit limit management",
                    "Statement generation",
                    "Interest calculation",
                    "Rewards program integration"
                ],
                "integration_tips": [
                    "Implement credit utilization monitoring",
                    "Set up automated statement generation",
                    "Use spend controls for risk management",
                    "Track rewards points in real-time"
                ]
            }
        }
    
    async def answer_implementation_question(self, 
                                            question: str,
                                            program_type: Optional[str] = None,
                                            include_code_examples: bool = True) -> Dict[str, Any]:
        """
        Answer implementation questions using LLM with multi-agent collaboration
        
        Args:
            question: The implementation question
            program_type: Optional program context (e.g., 'trip.com')
            include_code_examples: Whether to include code examples
            
        Returns:
            Comprehensive answer combining insights from all agents
        """
        
        # Step 1: Gather context from multiple sources
        context = await self._gather_multi_agent_context(question, program_type)
        
        # Step 2: Get relevant operations for the program
        relevant_operations = self._get_relevant_operations(question, program_type)
        
        # Step 3: Build comprehensive prompt with all context
        prompt = self._build_implementation_prompt(
            question, 
            program_type, 
            context, 
            relevant_operations,
            include_code_examples
        )
        
        # Step 4: Get LLM response
        llm_response = self._query_llm(prompt)
        
        # Step 5: Enhance response with specific examples if needed
        enhanced_response = self._enhance_response(
            llm_response, 
            program_type, 
            relevant_operations,
            include_code_examples
        )
        
        return {
            "question": question,
            "program_type": program_type,
            "answer": enhanced_response["answer"],
            "relevant_operations": enhanced_response.get("operations", []),
            "code_examples": enhanced_response.get("code_examples", []),
            "best_practices": enhanced_response.get("best_practices", []),
            "sources": context.get("sources", []),
            "confidence": self._calculate_confidence(context, relevant_operations),
            "timestamp": datetime.now().isoformat()
        }
    
    async def _gather_multi_agent_context(self, 
                                         question: str, 
                                         program_type: Optional[str]) -> Dict[str, Any]:
        """Gather context from document and schema agents"""
        context = {
            "doc_agent": None,
            "schema_agent": None,
            "sources": []
        }
        
        async with aiohttp.ClientSession() as session:
            # Query document agent
            try:
                doc_payload = {
                    "query": question,
                    "context": f"{program_type} implementation" if program_type else "API implementation"
                }
                async with session.post(
                    f"{self.doc_agent_url}/query",
                    json=doc_payload,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    if resp.status == 200:
                        doc_response = await resp.json()
                        context["doc_agent"] = doc_response.get("answer", "")
                        context["sources"].append("document_agent")
                        logger.info("Got response from document agent")
            except Exception as e:
                logger.warning(f"Document agent query failed: {e}")
            
            # Query schema agent for GraphQL-related questions
            if any(keyword in question.lower() for keyword in ["graphql", "mutation", "query", "schema"]):
                try:
                    schema_payload = {"question": question}
                    async with session.post(
                        f"{self.schema_agent_url}/query",
                        json=schema_payload,
                        timeout=aiohttp.ClientTimeout(total=10)
                    ) as resp:
                        if resp.status == 200:
                            schema_response = await resp.json()
                            context["schema_agent"] = schema_response.get("answer", "")
                            context["sources"].append("schema_agent")
                            logger.info("Got response from schema agent")
                except Exception as e:
                    logger.warning(f"Schema agent query failed: {e}")
        
        return context
    
    def _get_relevant_operations(self, 
                                question: str, 
                                program_type: Optional[str]) -> List[Dict[str, Any]]:
        """Get operations relevant to the question"""
        if not program_type or program_type not in self.operations_cache:
            return []
        
        operations = self.operations_cache[program_type]
        relevant = []
        
        # Keywords to look for in the question
        keywords = question.lower().split()
        
        for operation in operations:
            op_name = operation.get("name", "").lower()
            op_desc = operation.get("description", "").lower()
            op_category = operation.get("metadata", {}).get("category", "").lower()
            
            # Check if any keyword matches
            for keyword in keywords:
                if len(keyword) > 3:  # Skip short words
                    if keyword in op_name or keyword in op_desc or keyword in op_category:
                        relevant.append(operation)
                        break
            
            if len(relevant) >= 10:  # Limit to top 10 operations
                break
        
        return relevant
    
    def _build_implementation_prompt(self,
                                    question: str,
                                    program_type: Optional[str],
                                    context: Dict[str, Any],
                                    operations: List[Dict[str, Any]],
                                    include_code: bool) -> str:
        """Build comprehensive prompt for LLM"""
        
        prompt = f"""You are an expert implementation consultant for Highnote's payment platform. 
You are helping implement {program_type if program_type else 'a payment program'}.

Question: {question}

"""
        
        # Add context from other agents
        if context.get("doc_agent"):
            prompt += f"""
Documentation Context:
{context['doc_agent'][:500]}

"""
        
        if context.get("schema_agent"):
            prompt += f"""
GraphQL Schema Context:
{context['schema_agent'][:500]}

"""
        
        # Add program-specific knowledge
        if program_type and program_type in self.implementation_knowledge:
            knowledge = self.implementation_knowledge[program_type]
            prompt += f"""
Program-Specific Knowledge for {program_type}:
- Description: {knowledge['description']}
- Key Challenges: {', '.join(knowledge.get('key_challenges', [])[:3])}
- Integration Tips: {', '.join(knowledge.get('integration_tips', [])[:3])}

"""
        
        # Add relevant operations
        if operations:
            prompt += "Relevant API Operations:\n"
            for op in operations[:5]:
                prompt += f"- {op['name']}: {op.get('description', 'N/A')}\n"
            prompt += "\n"
        
        # Add instructions
        prompt += """
Please provide a comprehensive answer that includes:
1. Direct answer to the question
2. Step-by-step implementation guidance
3. Required API operations
"""
        
        if include_code:
            prompt += "4. Code examples in Python or JavaScript\n"
        
        prompt += """5. Best practices and common pitfalls
6. Error handling recommendations

Be specific, practical, and focus on the actual implementation details."""
        
        return prompt
    
    def _query_llm(self, prompt: str) -> str:
        """Query the LLM with the prompt"""
        try:
            response = ollama.chat(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": self.temperature}
            )
            return response['message']['content']
        except Exception as e:
            logger.error(f"LLM query failed: {e}")
            return "Unable to generate response at this time."
    
    def _enhance_response(self,
                         llm_response: str,
                         program_type: Optional[str],
                         operations: List[Dict[str, Any]],
                         include_code: bool) -> Dict[str, Any]:
        """Enhance LLM response with structured data"""
        
        enhanced = {
            "answer": llm_response,
            "operations": [],
            "code_examples": [],
            "best_practices": []
        }
        
        # Add operation details
        if operations:
            enhanced["operations"] = [
                {
                    "name": op["name"],
                    "description": op.get("description", ""),
                    "category": op.get("metadata", {}).get("category", ""),
                    "required": op.get("metadata", {}).get("required", False)
                }
                for op in operations[:5]
            ]
        
        # Add code examples if requested
        if include_code and program_type:
            enhanced["code_examples"] = self._generate_code_examples(program_type, operations)
        
        # Add best practices
        if program_type in self.implementation_knowledge:
            knowledge = self.implementation_knowledge[program_type]
            enhanced["best_practices"] = knowledge.get("integration_tips", [])
        
        return enhanced
    
    def _generate_code_examples(self, 
                               program_type: str, 
                               operations: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Generate code examples for common operations"""
        examples = []
        
        # Example for authentication
        examples.append({
            "title": "Authentication Setup",
            "language": "python",
            "code": """
import requests
from typing import Dict, Any

class HighnoteClient:
    def __init__(self, api_key: str, environment: str = "sandbox"):
        self.api_key = api_key
        self.base_url = f"https://api.{environment}.highnote.com/graphql"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    def execute_query(self, query: str, variables: Dict[str, Any] = None):
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        response = requests.post(
            self.base_url,
            json=payload,
            headers=self.headers
        )
        return response.json()
"""
        })
        
        # Example for virtual card creation (if relevant)
        if program_type == "trip.com":
            examples.append({
                "title": "Create Virtual Card for Booking",
                "language": "python",
                "code": """
def create_virtual_card_for_booking(client, account_holder_id: str, booking_amount: float):
    query = '''
    mutation CreateVirtualCard($input: CreateCardInput!) {
        createCard(input: $input) {
            card {
                id
                cardNumber
                expirationDate
                cvv
                status
            }
        }
    }
    '''
    
    variables = {
        "input": {
            "accountHolderId": account_holder_id,
            "cardProductId": "virtual_card_product_id",
            "spendLimit": {
                "amount": booking_amount,
                "currency": "USD"
            },
            "validUntil": "2024-12-31"
        }
    }
    
    return client.execute_query(query, variables)
"""
            })
        
        return examples
    
    def _calculate_confidence(self, 
                            context: Dict[str, Any], 
                            operations: List[Dict[str, Any]]) -> float:
        """Calculate confidence score based on available context"""
        confidence = 0.5  # Base confidence
        
        # Increase confidence based on context sources
        if context.get("doc_agent"):
            confidence += 0.2
        if context.get("schema_agent"):
            confidence += 0.2
        if operations:
            confidence += min(0.1 * len(operations) / 10, 0.1)
        
        return min(confidence, 1.0)
    
    async def generate_implementation_guide(self,
                                           program_type: str,
                                           phase: Optional[str] = None) -> Dict[str, Any]:
        """Generate a comprehensive implementation guide using LLM"""
        
        # Build prompt for guide generation
        prompt = f"""Generate a detailed implementation guide for {program_type} on the Highnote platform.
"""
        
        if phase:
            prompt += f"Focus specifically on the {phase} phase.\n"
        
        # Add program knowledge
        if program_type in self.implementation_knowledge:
            knowledge = self.implementation_knowledge[program_type]
            prompt += f"""
Program Details:
- {knowledge['description']}
- Challenges: {', '.join(knowledge.get('key_challenges', []))}
"""
        
        # Add available operations
        if program_type in self.operations_cache:
            ops = self.operations_cache[program_type]
            categories = {}
            for op in ops:
                cat = op.get("metadata", {}).get("category", "uncategorized")
                if cat not in categories:
                    categories[cat] = []
                categories[cat].append(op["name"])
            
            prompt += "\nAvailable Operation Categories:\n"
            for cat, op_names in list(categories.items())[:5]:
                prompt += f"- {cat}: {len(op_names)} operations\n"
        
        prompt += """
Please provide:
1. Overview and prerequisites
2. Step-by-step implementation process
3. Required API operations for each step
4. Integration checkpoints
5. Testing recommendations
6. Go-live checklist

Format the response in a clear, structured manner suitable for technical documentation."""
        
        # Get LLM response
        guide_response = self._query_llm(prompt)
        
        return {
            "program_type": program_type,
            "phase": phase,
            "guide": guide_response,
            "generated_at": datetime.now().isoformat()
        }