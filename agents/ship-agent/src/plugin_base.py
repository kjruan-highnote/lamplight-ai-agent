"""
Base classes for the Ship agent plugin system
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)


class BasePlugin(ABC):
    """Base class for all plugins"""
    
    def __init__(self, name: str, version: str = "1.0.0"):
        self.name = name
        self.version = version
        self.metadata = {
            'created_at': datetime.now().isoformat(),
            'type': self.__class__.__name__,
            'active': True
        }
        self.config = {}
        
    @abstractmethod
    def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the plugin with configuration"""
        pass
    
    @abstractmethod
    def validate_config(self, config: Dict[str, Any]) -> bool:
        """Validate plugin configuration"""
        pass
    
    def get_info(self) -> Dict[str, Any]:
        """Get plugin information"""
        return {
            'name': self.name,
            'version': self.version,
            'type': self.__class__.__name__,
            'metadata': self.metadata,
            'config': self.config
        }


class DataSourcePlugin(BasePlugin):
    """Base class for data source plugins"""
    
    @abstractmethod
    def connect(self, connection_params: Dict[str, Any]) -> bool:
        """Connect to the data source"""
        pass
    
    @abstractmethod
    def disconnect(self) -> bool:
        """Disconnect from the data source"""
        pass
    
    @abstractmethod
    def extract_patterns(self, query: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Extract patterns from the data source"""
        pass
    
    @abstractmethod
    def get_schema(self) -> Dict[str, Any]:
        """Get the schema/structure of the data source"""
        pass
    
    @abstractmethod
    def validate_connection(self) -> bool:
        """Validate the connection is active"""
        pass
    
    def ingest(self, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Ingest data from the source"""
        patterns = self.extract_patterns(options)
        return {
            'source': self.name,
            'timestamp': datetime.now().isoformat(),
            'patterns': patterns,
            'metadata': self.metadata
        }


class ProgramTypePlugin(BasePlugin):
    """Base class for program type plugins"""
    
    @abstractmethod
    def get_rules(self) -> Dict[str, Any]:
        """Get business rules for this program type"""
        pass
    
    @abstractmethod
    def get_patterns(self) -> Dict[str, Any]:
        """Get patterns specific to this program type"""
        pass
    
    @abstractmethod
    def get_required_fields(self) -> List[str]:
        """Get required fields for this program type"""
        pass
    
    @abstractmethod
    def validate_request(self, request: Dict[str, Any]) -> bool:
        """Validate a request against program rules"""
        pass
    
    def get_template(self) -> Dict[str, Any]:
        """Get template for this program type"""
        return {
            'program_type': self.name,
            'rules': self.get_rules(),
            'patterns': self.get_patterns(),
            'required_fields': self.get_required_fields()
        }


class GeneratorPlugin(BasePlugin):
    """Base class for generator plugins"""
    
    @abstractmethod
    def generate(self, context: Dict[str, Any], template: Optional[Dict[str, Any]] = None) -> Any:
        """Generate output based on context and template"""
        pass
    
    @abstractmethod
    def validate_output(self, output: Any) -> bool:
        """Validate generated output"""
        pass
    
    @abstractmethod
    def get_output_format(self) -> str:
        """Get the output format this generator produces"""
        pass
    
    def transform(self, data: Dict[str, Any], format_options: Optional[Dict[str, Any]] = None) -> Any:
        """Transform data to output format"""
        return self.generate(data, format_options)


class ProcessorPlugin(BasePlugin):
    """Base class for data processor plugins"""
    
    @abstractmethod
    def process(self, data: Any) -> Any:
        """Process data"""
        pass
    
    @abstractmethod
    def validate_input(self, data: Any) -> bool:
        """Validate input data"""
        pass
    
    @abstractmethod
    def validate_output(self, data: Any) -> bool:
        """Validate output data"""
        pass


class ValidatorPlugin(BasePlugin):
    """Base class for validator plugins"""
    
    @abstractmethod
    def validate(self, data: Any, rules: Optional[Dict[str, Any]] = None) -> bool:
        """Validate data against rules"""
        pass
    
    @abstractmethod
    def get_validation_errors(self) -> List[str]:
        """Get validation errors from last validation"""
        pass
    
    @abstractmethod
    def get_validation_rules(self) -> Dict[str, Any]:
        """Get available validation rules"""
        pass