"""
Main Ship Agent implementation - Simplified version
"""
import logging
from typing import Dict, Any, List, Optional
import json
from datetime import datetime

from ship_agent_simplified import SimplifiedShipAgent

logger = logging.getLogger(__name__)


class ShipAgent(SimplifiedShipAgent):
    """
    Main Ship Agent - now using simplified YAML + MongoDB/JSON approach
    
    This class extends SimplifiedShipAgent with any additional functionality
    specific to the main Ship Agent. The core functionality is in the parent class.
    """
    
    def __init__(self, registry=None, context_manager=None):
        # Call parent init
        super().__init__(registry, context_manager)
        logger.info("Ship Agent initialized with simplified architecture")
    
    # Additional methods can be added here if needed
    # The parent class handles:
    # - generate_queries()
    # - generate_collection()
    # - generate_test_data()
    # - All helper methods