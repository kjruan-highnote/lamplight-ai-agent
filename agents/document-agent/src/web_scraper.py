import os
import time
import requests
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from typing import Dict, List, Set, Optional
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class HighnoteDocsScraper:
    """Scraper for Highnote documentation."""
    
    def __init__(self, base_url: str = "https://highnote.com/docs", output_dir: str = "data/docs"):
        self.base_url = base_url
        self.output_dir = output_dir
        self.visited_urls: Set[str] = set()
        self.scraped_pages: List[Dict] = []
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
        
        # Sections to exclude from scraping
        self.excluded_sections = {
            '/docs/api-reference',
            '/docs/explorer',
            '/docs/reference'  # Additional API reference paths
        }
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
    
    def is_valid_docs_url(self, url: str) -> bool:
        """Check if URL is within the docs section and not excluded."""
        parsed = urlparse(url)
        
        # Must be highnote.com docs
        if not (parsed.netloc == 'highnote.com' and parsed.path.startswith('/docs')):
            return False
        
        # Check if URL is in excluded sections
        for excluded in self.excluded_sections:
            if parsed.path.startswith(excluded):
                logger.info(f"Excluding URL (API Reference/Explorer): {url}")
                return False
        
        return True
    
    def extract_page_content(self, soup: BeautifulSoup, url: str) -> Optional[Dict]:
        """Extract structured content from a documentation page."""
        try:
            # Find main content area (adjust selectors based on actual site structure)
            main_content = soup.find('main') or soup.find('article') or soup.find('.docs-content')
            
            if not main_content:
                # Fallback to body content, excluding nav/footer
                main_content = soup.find('body')
                if main_content:
                    # Remove navigation and footer elements
                    for elem in main_content.find_all(['nav', 'footer', 'header', '.sidebar']):
                        elem.decompose()
            
            if not main_content:
                logger.warning(f"No main content found for {url}")
                return None
            
            # Extract title
            title = None
            title_elem = soup.find('h1') or soup.find('title')
            if title_elem:
                title = title_elem.get_text().strip()
            
            # Extract headings and content
            sections = []
            current_section = {"heading": "", "content": ""}
            
            for elem in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'pre', 'code']):
                if elem.name.startswith('h'):
                    # Start new section
                    if current_section["content"].strip():
                        sections.append(current_section.copy())
                    current_section = {
                        "heading": elem.get_text().strip(),
                        "content": "",
                        "level": int(elem.name[1])
                    }
                else:
                    # Add content to current section
                    text = elem.get_text().strip()
                    if text:
                        current_section["content"] += text + "\n\n"
            
            # Add final section
            if current_section["content"].strip():
                sections.append(current_section)
            
            # Extract all text as fallback
            full_text = main_content.get_text()
            # Clean up text
            full_text = ' '.join(full_text.split())
            
            return {
                "url": url,
                "title": title,
                "sections": sections,
                "full_text": full_text,
                "scraped_at": time.time()
            }
            
        except Exception as e:
            logger.error(f"Error extracting content from {url}: {e}")
            return None
    
    def find_doc_links(self, soup: BeautifulSoup, base_url: str) -> Set[str]:
        """Find all documentation links on the page."""
        links = set()
        
        # Find all links in the page
        for link in soup.find_all('a', href=True):
            href = link['href']
            full_url = urljoin(base_url, href)
            
            if self.is_valid_docs_url(full_url) and full_url not in self.visited_urls:
                links.add(full_url)
        
        # Also check for navigation menus, sidebars, and content areas
        nav_selectors = [
            'nav a[href]',
            '.sidebar a[href]', 
            '.navigation a[href]',
            '.nav-menu a[href]',
            '.docs-nav a[href]',
            '.toc a[href]',
            '[data-testid*="nav"] a[href]',
            '[class*="nav"] a[href]',
            '[class*="menu"] a[href]'
        ]
        
        for selector in nav_selectors:
            try:
                for link in soup.select(selector):
                    if link.get('href'):
                        href = link['href']
                        full_url = urljoin(base_url, href)
                        
                        if self.is_valid_docs_url(full_url) and full_url not in self.visited_urls:
                            links.add(full_url)
            except Exception as e:
                logger.debug(f"Error with selector {selector}: {e}")
        
        return links
    
    def scrape_page(self, url: str) -> Optional[Dict]:
        """Scrape a single documentation page."""
        if url in self.visited_urls:
            return None
        
        try:
            logger.info(f"Scraping: {url}")
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            self.visited_urls.add(url)
            
            soup = BeautifulSoup(response.content, 'html.parser')
            content = self.extract_page_content(soup, url)
            
            if content:
                self.scraped_pages.append(content)
                return content
            
        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
        
        return None
    
    def scrape_all(self, max_pages: int = 500) -> List[Dict]:
        """Scrape all documentation pages comprehensively."""
        # Start with main docs page and key section entry points
        to_visit = {
            self.base_url,
            "https://highnote.com/docs/basics",
            "https://highnote.com/docs/issuing", 
            "https://highnote.com/docs/acquiring",
            "https://highnote.com/docs/sdks",
            "https://highnote.com/docs/platform"
        }
        
        iteration = 0
        while to_visit and len(self.scraped_pages) < max_pages:
            iteration += 1
            logger.info(f"Iteration {iteration}: {len(to_visit)} URLs to visit, {len(self.scraped_pages)} pages scraped")
            
            current_batch = list(to_visit)[:10]  # Process in batches
            for url in current_batch:
                to_visit.discard(url)
                
                if url in self.visited_urls:
                    continue
                
                content = self.scrape_page(url)
                
                if content:
                    # Find new links to visit
                    try:
                        response = self.session.get(url, timeout=10)
                        soup = BeautifulSoup(response.content, 'html.parser')
                        new_links = self.find_doc_links(soup, url)
                        to_visit.update(new_links)
                        logger.info(f"Found {len(new_links)} new links from {url}")
                    except Exception as e:
                        logger.error(f"Error finding links on {url}: {e}")
                
                # Be respectful with requests
                time.sleep(0.5)
        
        logger.info(f"Scraping complete: {len(self.scraped_pages)} pages scraped")
        return self.scraped_pages
    
    def save_to_json(self, filename: str = "scraped_docs.json"):
        """Save scraped content to JSON file."""
        filepath = os.path.join(self.output_dir, filename)
        with open(filepath, 'w') as f:
            json.dump(self.scraped_pages, f, indent=2)
        logger.info(f"Saved {len(self.scraped_pages)} pages to {filepath}")
    
    def save_to_text_files(self):
        """Save each page as a separate text file."""
        for i, page in enumerate(self.scraped_pages):
            # Create filename from URL
            url_path = urlparse(page['url']).path
            filename = url_path.replace('/docs/', '').replace('/', '_').strip('_')
            if not filename:
                filename = f"page_{i}"
            filename = f"{filename}.txt"
            
            filepath = os.path.join(self.output_dir, filename)
            
            with open(filepath, 'w') as f:
                f.write(f"Title: {page.get('title', 'N/A')}\n")
                f.write(f"URL: {page['url']}\n")
                f.write("=" * 50 + "\n\n")
                
                if page.get('sections'):
                    for section in page['sections']:
                        if section.get('heading'):
                            f.write(f"## {section['heading']}\n\n")
                        f.write(f"{section.get('content', '').strip()}\n\n")
                else:
                    f.write(page.get('full_text', ''))
        
        logger.info(f"Saved {len(self.scraped_pages)} text files to {self.output_dir}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Scrape Highnote documentation")
    parser.add_argument("--max-pages", type=int, default=500, help="Maximum pages to scrape")
    parser.add_argument("--output-dir", default="data/docs", help="Output directory")
    args = parser.parse_args()
    
    scraper = HighnoteDocsScraper(output_dir=args.output_dir)
    pages = scraper.scrape_all(max_pages=args.max_pages)
    scraper.save_to_json()
    scraper.save_to_text_files()
    print(f"Scraped {len(pages)} pages to {args.output_dir}")