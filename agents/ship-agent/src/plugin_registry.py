"""
Plugin registry and discovery system for Ship agent
"""
import os
import importlib
import inspect
import logging
from typing import Dict, Any, Optional, Type, List
from pathlib import Path
import json
import yaml

from src.plugin_base import (
    BasePlugin,
    DataSourcePlugin,
    ProgramTypePlugin,
    GeneratorPlugin,
    ProcessorPlugin,
    ValidatorPlugin
)

logger = logging.getLogger(__name__)


class PluginRegistry:
    """
    Dynamic plugin registry with auto-discovery capabilities
    """
    
    def __init__(self, plugin_dir: str = "plugins"):
        self.plugin_dir = Path(plugin_dir)
        self.registries = {
            'data_sources': {},
            'program_types': {},
            'generators': {},
            'processors': {},
            'validators': {}
        }
        self.plugin_instances = {}
        self.metadata = {}
        
    def discover_plugins(self, auto_load: bool = True) -> Dict[str, List[str]]:
        """
        Auto-discover plugins from the plugin directory
        """
        discovered = {
            'data_sources': [],
            'program_types': [],
            'generators': [],
            'processors': [],
            'validators': []
        }
        
        for plugin_type in discovered.keys():
            plugin_path = self.plugin_dir / plugin_type
            if plugin_path.exists():
                for file_path in plugin_path.glob("*.py"):
                    if file_path.name.startswith("_"):
                        continue
                        
                    module_name = file_path.stem
                    try:
                        if auto_load:
                            self._load_plugin_module(plugin_type, module_name)
                        discovered[plugin_type].append(module_name)
                    except Exception as e:
                        logger.error(f"Failed to load plugin {module_name}: {e}")
                        
        logger.info(f"Discovered plugins: {discovered}")
        return discovered
    
    def _load_plugin_module(self, plugin_type: str, module_name: str):
        """Load a plugin module and register its classes"""
        module_path = f"plugins.{plugin_type}.{module_name}"
        
        try:
            module = importlib.import_module(module_path)
            
            # Find all plugin classes in the module
            for name, obj in inspect.getmembers(module):
                if inspect.isclass(obj) and issubclass(obj, BasePlugin) and obj != BasePlugin:
                    # Skip base classes
                    if obj in [DataSourcePlugin, ProgramTypePlugin, GeneratorPlugin, 
                              ProcessorPlugin, ValidatorPlugin]:
                        continue
                        
                    self.register_plugin_class(plugin_type, name.lower(), obj)
                    logger.info(f"Registered plugin class: {name} in {plugin_type}")
                    
        except ImportError as e:
            logger.error(f"Failed to import plugin module {module_path}: {e}")
            raise
    
    def register_plugin_class(self, plugin_type: str, name: str, plugin_class: Type[BasePlugin]):
        """Register a plugin class"""
        if plugin_type not in self.registries:
            self.registries[plugin_type] = {}
            
        self.registries[plugin_type][name] = plugin_class
        self.metadata[name] = {
            'type': plugin_type,
            'class': plugin_class.__name__,
            'module': plugin_class.__module__
        }
    
    def register_plugin_instance(self, plugin_type: str, name: str, instance: BasePlugin):
        """Register a plugin instance"""
        if plugin_type not in self.registries:
            self.registries[plugin_type] = {}
            
        self.plugin_instances[name] = instance
        self.metadata[name] = {
            'type': plugin_type,
            'instance': True,
            'info': instance.get_info()
        }
    
    def get_plugin(self, plugin_type: str, name: str, config: Optional[Dict[str, Any]] = None) -> Optional[BasePlugin]:
        """Get a plugin instance by type and name"""
        # Check if instance already exists
        if name in self.plugin_instances:
            return self.plugin_instances[name]
        
        # Check if class is registered
        if plugin_type in self.registries and name in self.registries[plugin_type]:
            plugin_class = self.registries[plugin_type][name]
            
            try:
                instance = plugin_class(name)
                if config:
                    instance.initialize(config)
                self.plugin_instances[name] = instance
                return instance
            except Exception as e:
                logger.error(f"Failed to instantiate plugin {name}: {e}")
                return None
        
        return None
    
    def list_plugins(self, plugin_type: Optional[str] = None) -> Dict[str, List[str]]:
        """List all registered plugins"""
        if plugin_type:
            return {plugin_type: list(self.registries.get(plugin_type, {}).keys())}
        
        return {
            ptype: list(plugins.keys())
            for ptype, plugins in self.registries.items()
        }
    
    def get_plugin_info(self, name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific plugin"""
        if name in self.metadata:
            return self.metadata[name]
        return None
    
    def load_plugin_config(self, config_file: str) -> Dict[str, Any]:
        """Load plugin configuration from file"""
        config_path = Path(config_file)
        
        if not config_path.exists():
            config_path = self.plugin_dir.parent / "config" / config_file
        
        if config_path.suffix == '.json':
            with open(config_path, 'r') as f:
                return json.load(f)
        elif config_path.suffix in ['.yaml', '.yml']:
            with open(config_path, 'r') as f:
                return yaml.safe_load(f)
        else:
            raise ValueError(f"Unsupported config file format: {config_path.suffix}")
    
    def create_dynamic_plugin(self, plugin_type: str, name: str, 
                            definition: Dict[str, Any]) -> BasePlugin:
        """
        Create a plugin dynamically from a definition
        """
        base_classes = {
            'data_sources': DataSourcePlugin,
            'program_types': ProgramTypePlugin,
            'generators': GeneratorPlugin,
            'processors': ProcessorPlugin,
            'validators': ValidatorPlugin
        }
        
        if plugin_type not in base_classes:
            raise ValueError(f"Unknown plugin type: {plugin_type}")
        
        base_class = base_classes[plugin_type]
        
        # Create dynamic class
        dynamic_class = type(
            f"Dynamic{name.title()}Plugin",
            (base_class,),
            self._create_dynamic_methods(definition)
        )
        
        # Register and return instance
        self.register_plugin_class(plugin_type, name, dynamic_class)
        return self.get_plugin(plugin_type, name, definition.get('config', {}))
    
    def _create_dynamic_methods(self, definition: Dict[str, Any]) -> Dict[str, Any]:
        """Create methods for dynamic plugin class"""
        methods = {}
        
        # Add required methods based on definition
        for method_name, method_def in definition.get('methods', {}).items():
            if isinstance(method_def, dict) and 'code' in method_def:
                # Execute code to create method
                exec(method_def['code'], methods)
            else:
                # Create simple method that returns the definition
                methods[method_name] = lambda self, d=method_def: d
        
        return methods
    
    def unregister_plugin(self, name: str) -> bool:
        """Unregister a plugin"""
        # Remove from instances
        if name in self.plugin_instances:
            del self.plugin_instances[name]
        
        # Remove from registries
        for plugin_type, plugins in self.registries.items():
            if name in plugins:
                del plugins[name]
        
        # Remove metadata
        if name in self.metadata:
            del self.metadata[name]
            
        return True
    
    def reload_plugin(self, plugin_type: str, name: str) -> bool:
        """Reload a plugin module"""
        try:
            # Unregister existing
            self.unregister_plugin(name)
            
            # Reload module
            self._load_plugin_module(plugin_type, name)
            
            return True
        except Exception as e:
            logger.error(f"Failed to reload plugin {name}: {e}")
            return False