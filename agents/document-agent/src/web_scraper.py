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
        
        # Ensure output directory exists
        os.makedirs(output_dir, exist_ok=True)
    
    def is_valid_docs_url(self, url: str) -> bool:
        """Check if URL is within the docs section."""
        parsed = urlparse(url)
        return (
            parsed.netloc == 'highnote.com' and 
            parsed.path.startswith('/docs')
        )
    
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
        
        for link in soup.find_all('a', href=True):
            href = link['href']
            full_url = urljoin(base_url, href)
            
            if self.is_valid_docs_url(full_url) and full_url not in self.visited_urls:
                links.add(full_url)
        
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
    
    def scrape_all(self, max_pages: int = 100) -> List[Dict]:
        """Scrape all documentation pages."""
        to_visit = {self.base_url}
        
        while to_visit and len(self.scraped_pages) < max_pages:
            url = to_visit.pop()
            
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
                except Exception as e:
                    logger.error(f"Error finding links on {url}: {e}")
            
            # Be respectful with requests
            time.sleep(1)
        
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
    scraper = HighnoteDocsScraper()
    pages = scraper.scrape_all(max_pages=50)  # Limit for initial testing
    scraper.save_to_json()
    scraper.save_to_text_files()
    print(f"Scraped {len(pages)} pages")