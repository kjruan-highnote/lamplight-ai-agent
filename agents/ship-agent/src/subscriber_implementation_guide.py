#!/usr/bin/env python3
"""
Subscriber Implementation Guide Module
Provides detailed guidance for implementing specific subscriber programs
"""
import json
import logging
from typing import Dict, Any, List, Optional
from pathlib import Path
import requests
from datetime import datetime

logger = logging.getLogger(__name__)


class SubscriberImplementationGuide:
    """
    Provides implementation guidance for specific subscribers/programs
    """
    
    def __init__(self, doc_agent_url: str = "http://localhost:8001", 
                 schema_agent_url: str = "http://localhost:8000"):
        self.doc_agent_url = doc_agent_url
        self.schema_agent_url = schema_agent_url
        self.implementation_patterns = self._load_implementation_patterns()
        
    def _load_implementation_patterns(self) -> Dict[str, Any]:
        """Load common implementation patterns for different program types"""
        return {
            "trip.com": {
                "name": "Trip.com Travel Services",
                "key_features": [
                    "Travel booking and management",
                    "Virtual card issuance for bookings",
                    "Multi-currency support",
                    "Real-time expense tracking"
                ],
                "implementation_phases": [
                    "Authentication Setup",
                    "Account Creation",
                    "Card Issuance",
                    "Transaction Processing",
                    "Reporting Integration"
                ],
                "common_challenges": {
                    "multi_currency": "Handle currency conversion and FX rates",
                    "booking_lifecycle": "Manage pre-authorization to settlement flow",
                    "cancellations": "Handle booking cancellations and refunds"
                }
            },
            "consumer_credit": {
                "name": "Consumer Credit Card Program",
                "key_features": [
                    "Consumer card issuance",
                    "Credit limit management",
                    "Rewards programs",
                    "Statement generation"
                ],
                "implementation_phases": [
                    "KYC/Onboarding",
                    "Credit Decisioning",
                    "Card Issuance",
                    "Authorization Rules",
                    "Billing and Statements"
                ]
            },
            "ap_automation": {
                "name": "Accounts Payable Automation",
                "key_features": [
                    "Virtual card generation",
                    "Vendor payment automation",
                    "Invoice matching",
                    "Spend controls"
                ],
                "implementation_phases": [
                    "Vendor Onboarding",
                    "Virtual Card Setup",
                    "Payment Workflows",
                    "Reconciliation"
                ]
            }
        }
    
    async def get_implementation_guide(self, program_type: str, 
                                      specific_area: Optional[str] = None) -> Dict[str, Any]:
        """
        Get implementation guide for a specific program
        
        Args:
            program_type: Type of program (e.g., 'trip.com', 'consumer_credit')
            specific_area: Optional specific area to focus on (e.g., 'authentication', 'card_issuance')
        """
        guide = {
            "program_type": program_type,
            "timestamp": datetime.now().isoformat(),
            "sections": []
        }
        
        # Get base implementation pattern
        if program_type in self.implementation_patterns:
            pattern = self.implementation_patterns[program_type]
            guide["program_name"] = pattern["name"]
            guide["key_features"] = pattern["key_features"]
            guide["implementation_phases"] = pattern["implementation_phases"]
            
            # Add overview section
            guide["sections"].append({
                "title": "Overview",
                "content": self._generate_overview(program_type, pattern)
            })
            
            # Add phase-specific guidance
            for phase in pattern["implementation_phases"]:
                if not specific_area or specific_area.lower() in phase.lower():
                    guide["sections"].append({
                        "title": phase,
                        "content": self._generate_phase_guidance(program_type, phase)
                    })
            
            # Add API operations section
            guide["sections"].append({
                "title": "Required API Operations",
                "content": self._get_required_operations(program_type, specific_area)
            })
            
            # Add best practices
            guide["sections"].append({
                "title": "Best Practices",
                "content": self._get_best_practices(program_type)
            })
            
            # Add common challenges if available
            if "common_challenges" in pattern:
                guide["sections"].append({
                    "title": "Common Challenges & Solutions",
                    "content": pattern["common_challenges"]
                })
        
        return guide
    
    def _generate_overview(self, program_type: str, pattern: Dict[str, Any]) -> str:
        """Generate overview section for the implementation guide"""
        overview = f"""
## {pattern['name']} Implementation Overview

This implementation guide provides step-by-step instructions for integrating {pattern['name']} 
using the Highnote platform.

### Key Features
{chr(10).join(f'- {feature}' for feature in pattern['key_features'])}

### Implementation Timeline
Typical implementation takes 4-8 weeks depending on complexity:
{chr(10).join(f'{i+1}. {phase} (Week {i+1}-{i+2})' for i, phase in enumerate(pattern['implementation_phases']))}

### Prerequisites
- API credentials and environment setup
- Understanding of GraphQL operations
- Webhook endpoint configuration
- Testing environment access
"""
        return overview
    
    def _generate_phase_guidance(self, program_type: str, phase: str) -> Dict[str, Any]:
        """Generate detailed guidance for a specific implementation phase"""
        
        phase_guides = {
            "Authentication Setup": {
                "description": "Configure API authentication and security",
                "steps": [
                    "Obtain API credentials from Highnote",
                    "Configure OAuth 2.0 or API key authentication",
                    "Set up environment variables",
                    "Test authentication with health check endpoint"
                ],
                "code_example": """
# Example authentication setup
headers = {
    'Authorization': f'Bearer {access_token}',
    'Content-Type': 'application/json',
    'X-API-Key': api_key
}
""",
                "operations": ["authenticate", "validateToken", "refreshToken"]
            },
            "Account Creation": {
                "description": "Create and configure account holders",
                "steps": [
                    "Define account holder data model",
                    "Implement KYC/KYB verification flow",
                    "Create account holder via API",
                    "Handle verification webhooks"
                ],
                "operations": ["createAccountHolder", "updateAccountHolder", "getAccountHolder"]
            },
            "Card Issuance": {
                "description": "Issue physical or virtual payment cards",
                "steps": [
                    "Select card product configuration",
                    "Create card via API",
                    "Set spending controls and limits",
                    "Activate card for use"
                ],
                "operations": ["createCard", "activateCard", "setCardLimits", "suspendCard"]
            },
            "Transaction Processing": {
                "description": "Handle authorization and settlement",
                "steps": [
                    "Configure authorization rules",
                    "Implement webhook handlers",
                    "Process authorization requests",
                    "Handle settlements and clearing"
                ],
                "operations": ["simulateAuthorization", "getTransaction", "disputeTransaction"]
            }
        }
        
        return phase_guides.get(phase, {
            "description": f"Implementation guidance for {phase}",
            "steps": [f"Implement {phase} according to business requirements"],
            "operations": []
        })
    
    def _get_required_operations(self, program_type: str, specific_area: Optional[str]) -> List[Dict[str, str]]:
        """Get list of required API operations for the program"""
        
        # Load operations from cache if available
        operations_file = Path(f"data/operations/{program_type}_operations.json")
        if operations_file.exists():
            with open(operations_file, 'r') as f:
                operations = json.load(f)
                
            # Filter by specific area if provided
            if specific_area:
                operations = [op for op in operations 
                            if specific_area.lower() in op.get('name', '').lower() 
                            or specific_area.lower() in op.get('metadata', {}).get('category', '').lower()]
            
            # Return formatted operation list
            return [
                {
                    "name": op.get('name'),
                    "category": op.get('metadata', {}).get('category'),
                    "description": op.get('description', ''),
                    "required": op.get('metadata', {}).get('required', False)
                }
                for op in operations[:20]  # Limit to top 20 operations
            ]
        
        return []
    
    def _get_best_practices(self, program_type: str) -> Dict[str, List[str]]:
        """Get best practices for the program implementation"""
        
        general_practices = {
            "security": [
                "Use OAuth 2.0 for API authentication",
                "Implement webhook signature verification",
                "Store sensitive data securely",
                "Use TLS for all API communications"
            ],
            "error_handling": [
                "Implement exponential backoff for retries",
                "Log all API requests and responses",
                "Handle rate limiting gracefully",
                "Implement comprehensive error recovery"
            ],
            "testing": [
                "Use sandbox environment for development",
                "Test all edge cases and error scenarios",
                "Implement automated integration tests",
                "Perform load testing before production"
            ],
            "monitoring": [
                "Set up real-time alerting",
                "Monitor API response times",
                "Track transaction success rates",
                "Implement comprehensive logging"
            ]
        }
        
        # Add program-specific practices
        program_specific = {
            "trip.com": {
                "booking_flow": [
                    "Pre-authorize before confirming booking",
                    "Handle partial refunds for cancellations",
                    "Support multi-currency transactions",
                    "Implement booking status webhooks"
                ]
            },
            "consumer_credit": {
                "credit_management": [
                    "Implement credit limit checks",
                    "Handle credit line increases",
                    "Track utilization rates",
                    "Generate monthly statements"
                ]
            }
        }
        
        practices = general_practices.copy()
        if program_type in program_specific:
            practices.update(program_specific[program_type])
        
        return practices
    
    async def answer_implementation_question(self, question: str, 
                                           program_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Answer specific implementation questions using multi-agent system
        
        Args:
            question: The implementation question
            program_type: Optional program context
        """
        response = {
            "question": question,
            "program_type": program_type,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            # Try to get answer from document agent first
            if self.doc_agent_url:
                doc_response = await self._query_doc_agent(question, program_type)
                if doc_response:
                    response["answer"] = doc_response.get("answer")
                    response["source"] = "document_agent"
                    response["confidence"] = doc_response.get("confidence", 0.5)
            
            # If no good answer, try schema agent for GraphQL-specific questions
            if "graphql" in question.lower() or "mutation" in question.lower() or "query" in question.lower():
                schema_response = await self._query_schema_agent(question)
                if schema_response:
                    response["graphql_example"] = schema_response.get("example")
                    response["schema_info"] = schema_response.get("schema")
                    
            # Add implementation-specific guidance
            if program_type:
                guide = await self.get_implementation_guide(program_type)
                response["implementation_guide"] = guide
                
        except Exception as e:
            logger.error(f"Error answering question: {e}")
            response["error"] = str(e)
        
        return response
    
    async def _query_doc_agent(self, question: str, context: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Query the document agent"""
        try:
            payload = {
                "query": question,
                "context": context or "Highnote API implementation"
            }
            
            response = requests.post(
                f"{self.doc_agent_url}/query",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"Document agent query failed: {e}")
        
        return None
    
    async def _query_schema_agent(self, question: str) -> Optional[Dict[str, Any]]:
        """Query the schema agent for GraphQL-specific information"""
        try:
            response = requests.post(
                f"{self.schema_agent_url}/query",
                json={"question": question},
                timeout=10
            )
            
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            logger.error(f"Schema agent query failed: {e}")
        
        return None