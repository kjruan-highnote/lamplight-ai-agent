#!/usr/bin/env python3
"""
Schema Update Scheduler

Provides scheduling capabilities for automated schema updates:
- Cron-like scheduling
- Webhook-triggered updates
- Manual trigger endpoints
- Status monitoring
"""

import os
import sys
import json
import time
import threading
import schedule
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
import logging
from flask import Flask, request, jsonify
from dataclasses import dataclass, asdict

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

from update_schema import SchemaUpdater, SchemaUpdateConfig

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/scheduler.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class ScheduleConfig:
    """Configuration for scheduler."""
    enabled: bool = True
    cron_schedule: Optional[str] = None  # e.g., "0 */6 * * *" (every 6 hours)
    simple_schedule: Optional[str] = None  # e.g., "every 6 hours", "daily at 02:00"
    webhook_enabled: bool = False
    webhook_secret: Optional[str] = None
    status_endpoint: bool = True
    max_concurrent_updates: int = 1


class SchemaUpdateScheduler:
    """Handles scheduled schema updates."""
    
    def __init__(self, config_path: str = "config.json", schedule_config_path: str = "schedule_config.json"):
        self.config_path = config_path
        self.schedule_config_path = schedule_config_path
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        
        # Load configurations
        self.update_config = self._load_update_config()
        self.schedule_config = self._load_schedule_config()
        
        # State tracking
        self.update_history: List[Dict[str, Any]] = []
        self.currently_updating = False
        self.last_update_result: Optional[Dict[str, Any]] = None
        
        # Create updater
        self.updater = SchemaUpdater(self.update_config)
        
        # Set up Flask app for web interface
        self.app = Flask(__name__)
        self._setup_web_endpoints()
        
        # Set up scheduler
        self._setup_scheduler()
    
    def _load_update_config(self) -> SchemaUpdateConfig:
        """Load schema update configuration."""
        try:
            with open(self.config_path, 'r') as f:
                config_data = json.load(f)
            return SchemaUpdateConfig(**config_data)
        except Exception as e:
            self.logger.warning(f"Could not load update config from {self.config_path}: {e}")
            return SchemaUpdateConfig()
    
    def _load_schedule_config(self) -> ScheduleConfig:
        """Load scheduler configuration."""
        try:
            with open(self.schedule_config_path, 'r') as f:
                config_data = json.load(f)
            return ScheduleConfig(**config_data)
        except Exception as e:
            self.logger.warning(f"Could not load schedule config from {self.schedule_config_path}: {e}")
            return ScheduleConfig()
    
    def _setup_scheduler(self):
        """Set up the scheduler based on configuration."""
        if not self.schedule_config.enabled:
            self.logger.info("Scheduling disabled")
            return
        
        if self.schedule_config.simple_schedule:
            self._setup_simple_schedule()
        elif self.schedule_config.cron_schedule:
            self._setup_cron_schedule()
        else:
            self.logger.warning("No schedule configuration found")
    
    def _setup_simple_schedule(self):
        """Set up simple schedule using the schedule library."""
        schedule_str = self.schedule_config.simple_schedule.lower()
        
        try:
            if "every" in schedule_str and "hours" in schedule_str:
                # Parse "every X hours"
                hours = int(schedule_str.split()[1])
                schedule.every(hours).hours.do(self._scheduled_update)
                self.logger.info(f"Scheduled update every {hours} hours")
                
            elif "every" in schedule_str and "minutes" in schedule_str:
                # Parse "every X minutes"
                minutes = int(schedule_str.split()[1])
                schedule.every(minutes).minutes.do(self._scheduled_update)
                self.logger.info(f"Scheduled update every {minutes} minutes")
                
            elif "daily at" in schedule_str:
                # Parse "daily at HH:MM"
                time_part = schedule_str.split("at")[1].strip()
                schedule.every().day.at(time_part).do(self._scheduled_update)
                self.logger.info(f"Scheduled daily update at {time_part}")
                
            elif schedule_str == "hourly":
                schedule.every().hour.do(self._scheduled_update)
                self.logger.info("Scheduled hourly updates")
                
            elif schedule_str == "daily":
                schedule.every().day.at("02:00").do(self._scheduled_update)
                self.logger.info("Scheduled daily updates at 02:00")
                
            else:
                self.logger.warning(f"Could not parse schedule: {schedule_str}")
                
        except Exception as e:
            self.logger.error(f"Failed to set up schedule: {e}")
    
    def _setup_cron_schedule(self):
        """Set up cron-like schedule (simplified implementation)."""
        # For a full cron implementation, you'd use croniter or similar
        self.logger.warning("Cron scheduling not implemented yet. Use simple_schedule instead.")
    
    def _scheduled_update(self):
        """Perform a scheduled update."""
        self.logger.info("Running scheduled schema update")
        self.trigger_update(source="scheduled")
    
    def _setup_web_endpoints(self):
        """Set up Flask web endpoints."""
        
        @self.app.route('/health', methods=['GET'])
        def health():
            """Health check endpoint."""
            return jsonify({
                "status": "healthy",
                "scheduler_enabled": self.schedule_config.enabled,
                "currently_updating": self.currently_updating,
                "last_update": self.last_update_result.get('start_time') if self.last_update_result else None
            })
        
        @self.app.route('/status', methods=['GET'])
        def status():
            """Detailed status endpoint."""
            if not self.schedule_config.status_endpoint:
                return jsonify({"error": "Status endpoint disabled"}), 403
            
            return jsonify({
                "scheduler": {
                    "enabled": self.schedule_config.enabled,
                    "schedule": self.schedule_config.simple_schedule or self.schedule_config.cron_schedule,
                    "currently_updating": self.currently_updating
                },
                "last_update": self.last_update_result,
                "update_history": self.update_history[-10:],  # Last 10 updates
                "config": {
                    "sync_to_cloud": self.update_config.sync_to_cloud,
                    "embedding_model": self.update_config.embedding_model
                }
            })
        
        @self.app.route('/trigger', methods=['POST'])
        def trigger_update():
            """Manual trigger endpoint."""
            if self.currently_updating:
                return jsonify({"error": "Update already in progress"}), 409
            
            # Optional: Check for authorization
            auth_header = request.headers.get('Authorization')
            if self.schedule_config.webhook_secret:
                if not auth_header or not auth_header.startswith('Bearer '):
                    return jsonify({"error": "Authorization required"}), 401
                
                token = auth_header.split(' ')[1]
                if token != self.schedule_config.webhook_secret:
                    return jsonify({"error": "Invalid token"}), 401
            
            # Get optional parameters
            force = request.json.get('force', False) if request.is_json else False
            dry_run = request.json.get('dry_run', False) if request.is_json else False
            
            # Trigger update in background
            threading.Thread(
                target=self.trigger_update,
                args=("manual",),
                kwargs={"force": force, "dry_run": dry_run}
            ).start()
            
            return jsonify({
                "message": "Update triggered",
                "force": force,
                "dry_run": dry_run
            })
        
        @self.app.route('/webhook', methods=['POST'])
        def webhook():
            """Webhook endpoint for external triggers."""
            if not self.schedule_config.webhook_enabled:
                return jsonify({"error": "Webhook endpoint disabled"}), 403
            
            # Verify webhook secret if configured
            if self.schedule_config.webhook_secret:
                signature = request.headers.get('X-Hub-Signature-256')
                if not self._verify_webhook_signature(request.data, signature):
                    return jsonify({"error": "Invalid signature"}), 401
            
            if self.currently_updating:
                return jsonify({"error": "Update already in progress"}), 409
            
            # Trigger update in background
            threading.Thread(
                target=self.trigger_update,
                args=("webhook",)
            ).start()
            
            return jsonify({"message": "Update triggered via webhook"})
        
        @self.app.route('/history', methods=['GET'])
        def history():
            """Get update history."""
            limit = request.args.get('limit', 50, type=int)
            return jsonify({
                "history": self.update_history[-limit:],
                "total": len(self.update_history)
            })
    
    def _verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verify webhook signature (GitHub-style)."""
        import hmac
        import hashlib
        
        if not signature or not signature.startswith('sha256='):
            return False
        
        expected = hmac.new(
            self.schedule_config.webhook_secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()
        
        received = signature.split('=')[1]
        return hmac.compare_digest(expected, received)
    
    def trigger_update(self, source: str = "manual", force: bool = False, dry_run: bool = False):
        """Trigger a schema update."""
        if self.currently_updating:
            self.logger.warning("Update already in progress, skipping")
            return
        
        self.currently_updating = True
        start_time = datetime.now(timezone.utc)
        
        self.logger.info(f"Starting schema update (source: {source})")
        
        try:
            # Create temporary config with overrides
            temp_config = SchemaUpdateConfig(**asdict(self.update_config))
            temp_config.force_update = force
            temp_config.dry_run = dry_run
            
            # Create temporary updater
            temp_updater = SchemaUpdater(temp_config)
            
            # Run update
            result = temp_updater.update_schema()
            result["source"] = source
            
            # Store result
            self.last_update_result = result
            self.update_history.append(result)
            
            # Keep only last 100 updates in memory
            if len(self.update_history) > 100:
                self.update_history = self.update_history[-100:]
            
            if result["success"]:
                self.logger.info(f"Schema update completed successfully (source: {source})")
            else:
                self.logger.error(f"Schema update failed (source: {source}): {result.get('error')}")
            
        except Exception as e:
            self.logger.error(f"Schema update failed with exception (source: {source}): {e}")
            
            result = {
                "success": False,
                "start_time": start_time.isoformat(),
                "error": str(e),
                "source": source
            }
            
            self.last_update_result = result
            self.update_history.append(result)
        
        finally:
            self.currently_updating = False
    
    def run_scheduler(self):
        """Run the scheduler in the background."""
        if not self.schedule_config.enabled:
            self.logger.info("Scheduler disabled, running web interface only")
            return
        
        self.logger.info("Starting scheduler thread")
        
        def scheduler_loop():
            while True:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
        
        scheduler_thread = threading.Thread(target=scheduler_loop, daemon=True)
        scheduler_thread.start()
    
    def run_web_server(self, host: str = "0.0.0.0", port: int = 5001, debug: bool = False):
        """Run the web server."""
        self.logger.info(f"Starting web server on {host}:{port}")
        self.app.run(host=host, port=port, debug=debug, threaded=True)
    
    def run(self, host: str = "0.0.0.0", port: int = 5001, debug: bool = False):
        """Run both scheduler and web server."""
        # Create logs directory
        Path("logs").mkdir(exist_ok=True)
        
        # Start scheduler
        self.run_scheduler()
        
        # Run web server (blocking)
        self.run_web_server(host=host, port=port, debug=debug)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Schema Update Scheduler")
    parser.add_argument("--config", default="config.json", help="Update configuration file")
    parser.add_argument("--schedule-config", default="schedule_config.json", help="Schedule configuration file")
    parser.add_argument("--host", default="0.0.0.0", help="Web server host")
    parser.add_argument("--port", type=int, default=5001, help="Web server port")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    
    args = parser.parse_args()
    
    try:
        scheduler = SchemaUpdateScheduler(
            config_path=args.config,
            schedule_config_path=args.schedule_config
        )
        
        print("\033[0;34m[CLOCK]\033[0m Schema Update Scheduler")
        print("=" * 30)
        print(f"Web interface: http://{args.host}:{args.port}")
        print("Endpoints:")
        print(f"  • Health: http://{args.host}:{args.port}/health")
        print(f"  • Status: http://{args.host}:{args.port}/status")
        print(f"  • Trigger: http://{args.host}:{args.port}/trigger [POST]")
        print(f"  • History: http://{args.host}:{args.port}/history")
        print("")
        
        scheduler.run(host=args.host, port=args.port, debug=args.debug)
        
    except KeyboardInterrupt:
        print("\nShutting down scheduler...")
    except Exception as e:
        logger.error(f"Scheduler failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()