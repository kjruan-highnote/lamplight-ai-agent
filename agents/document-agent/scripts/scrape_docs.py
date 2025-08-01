#!/usr/bin/env python3
"""
Script to scrape Highnote documentation.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.web_scraper import HighnoteDocsScraper
import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Scrape Highnote documentation")
    parser.add_argument("--max-pages", type=int, default=100, help="Maximum pages to scrape")
    parser.add_argument("--output-dir", default="data/docs", help="Output directory")
    
    args = parser.parse_args()
    
    scraper = HighnoteDocsScraper(output_dir=args.output_dir)
    pages = scraper.scrape_all(max_pages=args.max_pages)
    scraper.save_to_json()
    scraper.save_to_text_files()
    
    print(f"Successfully scraped {len(pages)} pages to {args.output_dir}")