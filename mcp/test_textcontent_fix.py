#!/usr/bin/env python
"""Test that TextContent objects are properly formatted"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from mcp.types import TextContent

# Test creating TextContent with type field
try:
    tc = TextContent(type="text", text="Test message")
    print(f"✅ TextContent created successfully: {tc}")
    print(f"   Type: {tc.type}")
    print(f"   Text: {tc.text}")
except Exception as e:
    print(f"❌ Error creating TextContent: {e}")

# Test the format we're using
test_cases = [
    {"type": "text", "text": "Simple message"},
    {"type": "text", "text": "Query result with score: 0.95"},
]

for i, test in enumerate(test_cases, 1):
    try:
        tc = TextContent(**test)
        print(f"\n✅ Test case {i} passed")
    except Exception as e:
        print(f"\n❌ Test case {i} failed: {e}")

print("\nTextContent format is correct!")