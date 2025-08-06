#!/usr/bin/env python3
"""
Basic tests for Enhanced Ship Agent that don't require pytest
"""
import asyncio
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / "src"))

from enhanced_ship_agent import (
    DocumentationLinkProvider,
    CacheManager,
    EnhancedShipAgent
)


def test_documentation_links():
    """Test documentation link generation"""
    print("Testing DocumentationLinkProvider...")
    
    operations = ["createAccountHolder", "createPaymentCard", "generateStatement"]
    links = DocumentationLinkProvider.get_relevant_links(operations)
    
    assert "main" in links
    assert "api_reference" in links
    assert "categories" in links
    assert "person_account_holder" in links["categories"]
    assert "payment_cards" in links["categories"]
    assert "billing" in links["categories"]
    
    print("✓ Documentation links generated correctly")
    
    # Test markdown formatting
    markdown = DocumentationLinkProvider.format_documentation_section(links)
    assert "📚 Highnote Documentation Resources" in markdown
    assert "https://docs.highnote.com" in markdown
    
    print("✓ Markdown formatting works")


def test_cache_manager():
    """Test cache functionality"""
    print("\nTesting CacheManager...")
    
    cache = CacheManager("test_cache_basic", ttl_hours=1)
    
    # Test set and get
    key = {"test": "key"}
    value = {"data": "test_value", "number": 42}
    
    cache.set(key, value)
    retrieved = cache.get(key)
    
    assert retrieved == value
    print("✓ Cache set/get works")
    
    # Test cache miss
    missing = cache.get({"nonexistent": "key"})
    assert missing is None
    print("✓ Cache miss returns None")
    
    # Cleanup
    import shutil
    shutil.rmtree("test_cache_basic", ignore_errors=True)
    print("✓ Cache cleanup successful")


async def test_enhanced_agent():
    """Test enhanced agent basic functionality"""
    print("\nTesting EnhancedShipAgent...")
    
    # Create agent without external dependencies
    agent = EnhancedShipAgent(cache_dir="test_cache_agent")
    
    # Mock some operations
    agent.operations_cache = {
        "test_program": {
            "testOp1": {
                "name": "testOp1",
                "query": "mutation { test(customer: \"{{customer}}\") }",
                "metadata": {"category": "test_cat", "flow": "test_flow"}
            },
            "testOp2": {
                "name": "testOp2",
                "query": "query { data }",
                "metadata": {"category": "other_cat", "flow": "test_flow"}
            }
        }
    }
    
    # Test collection generation
    result = await agent.generate_enhanced_collection(
        program_type="test_program",
        dimensions={"customer": "TestCorp"},
        options={"categories": ["test_cat"]}
    )
    
    assert result["program_type"] == "test_program"
    assert result["dimensions"]["customer"] == "TestCorp"
    assert len(result["operations"]) == 1
    assert "{{customer}}" not in result["operations"][0]["query"]
    assert "TestCorp" in result["operations"][0]["query"]
    print("✓ Collection generation works")
    
    # Test documentation links are included
    assert "documentation_links" in result
    assert "main" in result["documentation_links"]
    print("✓ Documentation links included")
    
    # Test metrics
    metrics = agent.get_metrics()
    assert "cache_hit_rate" in metrics
    assert "average_generation_time_ms" in metrics
    print("✓ Metrics tracking works")
    
    # Cleanup
    import shutil
    shutil.rmtree("test_cache_agent", ignore_errors=True)


def test_trip_com_features():
    """Test Trip.com specific documentation links"""
    print("\nTesting Trip.com specific features...")
    
    # Travel-related operations
    travel_operations = [
        "searchFlights",
        "bookFlight",
        "searchHotels", 
        "bookHotel",
        "createTransaction",
        "processPayment",
        "generateItinerary"
    ]
    
    links = DocumentationLinkProvider.get_relevant_links(travel_operations)
    
    # Should identify transaction-related categories
    assert "transactions" in links["categories"]
    print("✓ Travel operations mapped to documentation categories")
    
    # Test that we get relevant sections
    markdown = DocumentationLinkProvider.format_documentation_section(links)
    assert "Transactions" in markdown
    print("✓ Travel documentation sections generated")


async def main():
    """Run all tests"""
    print("=" * 50)
    print("Running Enhanced Ship Agent Tests")
    print("=" * 50)
    
    try:
        test_documentation_links()
        test_cache_manager()
        await test_enhanced_agent()
        test_trip_com_features()
        
        print("\n" + "=" * 50)
        print("✅ All tests passed successfully!")
        print("=" * 50)
        
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())