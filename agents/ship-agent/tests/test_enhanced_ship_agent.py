#!/usr/bin/env python3
"""
Comprehensive tests for Enhanced Ship Agent
"""
import asyncio
import json
import pytest
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, AsyncMock
import sys
sys.path.append(str(Path(__file__).parent.parent / "src"))

from enhanced_ship_agent import (
    DocumentationLinkProvider,
    CacheManager,
    RobustAgentClient,
    EnhancedShipAgent
)


class TestDocumentationLinkProvider:
    """Tests for DocumentationLinkProvider"""
    
    def test_get_relevant_links_basic(self):
        """Test getting relevant documentation links"""
        operations = ["createAccountHolder", "createPaymentCard", "generateStatement"]
        links = DocumentationLinkProvider.get_relevant_links(operations)
        
        assert "main" in links
        assert "api_reference" in links
        assert "categories" in links
        assert "specific_operations" in links
        
        # Check categories are identified correctly
        assert "person_account_holder" in links["categories"]
        assert "payment_cards" in links["categories"]
        assert "billing" in links["categories"]
    
    def test_get_relevant_links_inference(self):
        """Test category inference from operation names"""
        operations = ["someAccountOperation", "customCardFunction", "webhookHandler"]
        links = DocumentationLinkProvider.get_relevant_links(operations)
        
        assert "person_account_holder" in links["categories"]
        assert "payment_cards" in links["categories"]
        assert "webhooks" in links["categories"]
    
    def test_format_documentation_section(self):
        """Test formatting documentation as markdown"""
        links = {
            "categories": {
                "payment_cards": {
                    "url": "https://docs.highnote.com/issuing/payment-cards",
                    "title": "Payment Cards",
                    "sections": [
                        {"path": "/create-cards", "title": "Create Payment Cards"}
                    ]
                }
            }
        }
        
        markdown = DocumentationLinkProvider.format_documentation_section(links)
        
        assert "📚 Highnote Documentation Resources" in markdown
        assert "Payment Cards" in markdown
        assert "Create Payment Cards" in markdown
        assert "https://docs.highnote.com" in markdown


class TestCacheManager:
    """Tests for CacheManager"""
    
    def setup_method(self):
        """Setup test cache directory"""
        self.cache_dir = Path("test_cache")
        self.cache = CacheManager(str(self.cache_dir), ttl_hours=1)
    
    def teardown_method(self):
        """Cleanup test cache directory"""
        import shutil
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir)
    
    def test_cache_set_get(self):
        """Test basic cache set and get"""
        key = {"test": "key"}
        value = {"test": "value", "number": 42}
        
        # Set value
        self.cache.set(key, value)
        
        # Get value
        retrieved = self.cache.get(key)
        assert retrieved == value
    
    def test_cache_miss(self):
        """Test cache miss returns None"""
        result = self.cache.get({"nonexistent": "key"})
        assert result is None
    
    def test_cache_expiration(self):
        """Test cache expiration"""
        # Create cache with very short TTL
        cache = CacheManager(str(self.cache_dir), ttl_hours=0)
        
        key = {"test": "expiry"}
        value = {"data": "expires"}
        
        cache.set(key, value)
        
        # Manually expire the entry
        cache_key = cache._get_cache_key(key)
        cache._memory_cache[cache_key]["timestamp"] = datetime.now() - timedelta(hours=1)
        
        # Should return None for expired entry
        result = cache.get(key)
        assert result is None
    
    def test_clear_expired(self):
        """Test clearing expired entries"""
        # Create entries
        self.cache.set({"key1": "value1"}, {"data": 1})
        self.cache.set({"key2": "value2"}, {"data": 2})
        
        # Expire one entry
        keys = list(self.cache._memory_cache.keys())
        self.cache._memory_cache[keys[0]]["timestamp"] = datetime.now() - timedelta(hours=25)
        
        # Clear expired
        cleared = self.cache.clear_expired()
        assert cleared == 1
        
        # Check remaining
        assert self.cache.get({"key2": "value2"}) is not None


@pytest.mark.asyncio
class TestRobustAgentClient:
    """Tests for RobustAgentClient"""
    
    async def test_health_check_success(self):
        """Test successful health check"""
        async with RobustAgentClient("http://localhost:8000") as client:
            with patch.object(client, 'client') as mock_client:
                mock_response = Mock()
                mock_response.status_code = 200
                mock_client.get = AsyncMock(return_value=mock_response)
                
                result = await client.health_check()
                assert result is True
    
    async def test_health_check_failure(self):
        """Test failed health check"""
        async with RobustAgentClient("http://localhost:8000") as client:
            with patch.object(client, 'client') as mock_client:
                mock_client.get = AsyncMock(side_effect=Exception("Connection failed"))
                
                result = await client.health_check()
                assert result is False
    
    async def test_post_with_retry(self):
        """Test POST request with retry logic"""
        async with RobustAgentClient("http://localhost:8000") as client:
            with patch.object(client, 'client') as mock_client:
                mock_response = Mock()
                mock_response.json = Mock(return_value={"result": "success"})
                mock_response.raise_for_status = Mock()
                mock_client.post = AsyncMock(return_value=mock_response)
                
                result = await client.post("/test", {"data": "test"})
                assert result == {"result": "success"}


@pytest.mark.asyncio
class TestEnhancedShipAgent:
    """Tests for EnhancedShipAgent"""
    
    def setup_method(self):
        """Setup test agent"""
        self.agent = EnhancedShipAgent(
            cache_dir="test_cache",
            doc_agent_url="http://localhost:8001",
            schema_agent_url="http://localhost:8002"
        )
        
        # Mock operations cache
        self.agent.operations_cache = {
            "test_program": {
                "operation1": {
                    "name": "operation1",
                    "query": "mutation { test }",
                    "metadata": {
                        "category": "test_category",
                        "flow": "test_flow"
                    }
                },
                "operation2": {
                    "name": "operation2",
                    "query": "query { data }",
                    "metadata": {
                        "category": "other_category",
                        "flow": "test_flow"
                    }
                }
            }
        }
    
    def teardown_method(self):
        """Cleanup"""
        import shutil
        cache_dir = Path("test_cache")
        if cache_dir.exists():
            shutil.rmtree(cache_dir)
    
    async def test_generate_enhanced_collection_basic(self):
        """Test basic collection generation"""
        # Mock agent queries
        with patch.object(self.agent, 'query_agents_parallel') as mock_query:
            mock_query.return_value = {
                "document": {"chunks": ["doc1", "doc2"]},
                "schema": {"schema_info": {"field": "type"}}
            }
            
            result = await self.agent.generate_enhanced_collection(
                program_type="test_program",
                dimensions={"customer": "TestCorp"},
                options={"categories": ["test_category"]}
            )
            
            assert result["program_type"] == "test_program"
            assert result["dimensions"]["customer"] == "TestCorp"
            assert len(result["operations"]) == 1  # Only test_category
            assert result["operations"][0]["name"] == "operation1"
            assert "documentation_links" in result
            assert "agent_enrichment" in result
            assert "metadata" in result
    
    async def test_generate_with_flow_filter(self):
        """Test generation with flow filtering"""
        with patch.object(self.agent, 'query_agents_parallel') as mock_query:
            mock_query.return_value = {}
            
            result = await self.agent.generate_enhanced_collection(
                program_type="test_program",
                dimensions={"customer": "TestCorp"},
                options={"flows": ["test_flow"]}
            )
            
            assert len(result["operations"]) == 2  # Both have test_flow
    
    async def test_apply_dimensions(self):
        """Test dimension application to operations"""
        operation = {
            "name": "test",
            "query": "mutation { create(customer: \"{{customer}}\") }",
            "variables": {"environment": "{{env}}"}
        }
        
        result = self.agent._apply_dimensions(
            operation,
            {"customer": "ABC Corp", "env": "production"}
        )
        
        assert "ABC Corp" in result["query"]
        assert "{{customer}}" not in result["query"]
        assert result["variables"]["environment"] == "production"
    
    async def test_validate_operations(self):
        """Test operation validation"""
        operations = [
            {"name": "op1", "query": "mutation { test }"},
            {"name": "op2", "query": "query { data }"}
        ]
        
        with patch.object(self.agent, '_query_agent_with_fallback') as mock_query:
            mock_query.return_value = {"valid": True}
            
            result = await self.agent.validate_operations(operations)
            
            assert result["valid"] is True
            assert len(result["errors"]) == 0
    
    async def test_validate_operations_with_errors(self):
        """Test operation validation with errors"""
        operations = [{"name": "bad_op", "query": "invalid"}]
        
        with patch.object(self.agent, '_query_agent_with_fallback') as mock_query:
            mock_query.return_value = {"valid": False, "error": "Invalid syntax"}
            
            result = await self.agent.validate_operations(operations)
            
            assert result["valid"] is False
            assert len(result["errors"]) > 0
            assert "bad_op" in result["errors"][0]
    
    async def test_parallel_agent_queries(self):
        """Test parallel agent querying"""
        queries = {
            "document": {"question": "test1"},
            "schema": {"question": "test2"}
        }
        
        # Mock agent responses
        async def mock_query(agent_name, query_data):
            if agent_name == "document":
                return {"response": "doc_response"}
            elif agent_name == "schema":
                return {"response": "schema_response"}
            return {}
        
        with patch.object(self.agent, '_query_agent_with_fallback', side_effect=mock_query):
            results = await self.agent.query_agents_parallel(queries)
            
            assert "document" in results
            assert "schema" in results
            assert results["document"]["response"] == "doc_response"
            assert results["schema"]["response"] == "schema_response"
    
    async def test_fallback_responses(self):
        """Test fallback responses when agents are unavailable"""
        # Test document fallback
        doc_fallback = self.agent._get_fallback_response("document", {})
        assert doc_fallback["fallback"] is True
        assert "chunks" in doc_fallback
        
        # Test schema fallback
        schema_fallback = self.agent._get_fallback_response("schema", {})
        assert schema_fallback["fallback"] is True
        assert "schema_info" in schema_fallback
        
        # Test advisory fallback
        advisory_fallback = self.agent._get_fallback_response("advisory", {})
        assert advisory_fallback["fallback"] is True
        assert "advice" in advisory_fallback
    
    def test_metrics_tracking(self):
        """Test metrics tracking"""
        # Simulate some operations
        self.agent.metrics["cache_hits"] = 10
        self.agent.metrics["cache_misses"] = 5
        self.agent.metrics["agent_queries"] = 8
        self.agent.metrics["agent_failures"] = 2
        self.agent.metrics["generation_time"] = [100, 150, 200]
        
        metrics = self.agent.get_metrics()
        
        assert metrics["cache_hit_rate"] == 10 / 15
        assert metrics["agent_success_rate"] == 8 / 10
        assert metrics["average_generation_time_ms"] == 150
        assert metrics["total_cache_hits"] == 10
    
    async def test_cache_integration(self):
        """Test cache integration in generation"""
        # First generation
        with patch.object(self.agent, 'query_agents_parallel') as mock_query:
            mock_query.return_value = {"document": {"data": "test"}}
            
            result1 = await self.agent.generate_enhanced_collection(
                program_type="test_program",
                dimensions={"customer": "TestCorp"},
                options={"categories": ["test_category"]}
            )
        
        # Second generation (should use cache)
        initial_hits = self.agent.metrics["cache_hits"]
        
        result2 = await self.agent.generate_enhanced_collection(
            program_type="test_program",
            dimensions={"customer": "TestCorp"},
            options={"categories": ["test_category"]}
        )
        
        # Cache should be hit for the second call
        assert self.agent.metrics["cache_hits"] > initial_hits


def test_integration_documentation_links():
    """Integration test for documentation link generation"""
    operations = [
        "createAccountHolder",
        "updateAccountHolder", 
        "createPaymentCard",
        "activatePaymentCard",
        "generateStatement",
        "calculateInterest",
        "earnRewards",
        "verifyIdentity",
        "registerWebhook"
    ]
    
    links = DocumentationLinkProvider.get_relevant_links(operations)
    markdown = DocumentationLinkProvider.format_documentation_section(links)
    
    # Verify comprehensive documentation is generated
    assert len(links["categories"]) >= 5
    assert len(links["specific_operations"]) > 0
    assert "📚 Highnote Documentation Resources" in markdown
    assert "https://docs.highnote.com" in markdown
    
    # Check all major categories are present
    expected_categories = [
        "person_account_holder",
        "payment_cards",
        "billing",
        "rewards",
        "compliance",
        "webhooks"
    ]
    
    for category in expected_categories:
        assert category in links["categories"]


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--asyncio-mode=auto"])