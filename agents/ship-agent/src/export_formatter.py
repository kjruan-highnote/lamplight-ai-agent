#!/usr/bin/env python3
"""
Export Formatter Module
Converts markdown documents to various formats for different platforms
"""
import re
from pathlib import Path
from typing import Optional
import logging
import warnings

# Suppress WeasyPrint warnings about missing system libraries
warnings.filterwarnings("ignore", message=".*WeasyPrint.*")
import os
os.environ['PYTHONWARNINGS'] = 'ignore'

logger = logging.getLogger(__name__)


class ExportFormatter:
    """Base class for document format converters"""
    
    @staticmethod
    def markdown_to_confluence(markdown_content: str) -> str:
        """
        Convert Markdown to Confluence Wiki Markup
        
        Confluence uses a specific wiki markup format that's different from Markdown.
        This converter handles the most common conversions.
        """
        content = markdown_content
        
        # Headers (Markdown # to Confluence h1.)
        content = re.sub(r'^# (.+)$', r'h1. \1', content, flags=re.MULTILINE)
        content = re.sub(r'^## (.+)$', r'h2. \1', content, flags=re.MULTILINE)
        content = re.sub(r'^### (.+)$', r'h3. \1', content, flags=re.MULTILINE)
        content = re.sub(r'^#### (.+)$', r'h4. \1', content, flags=re.MULTILINE)
        content = re.sub(r'^##### (.+)$', r'h5. \1', content, flags=re.MULTILINE)
        
        # Bold text (**text** or __text__ to *text*)
        content = re.sub(r'\*\*(.+?)\*\*', r'*\1*', content)
        content = re.sub(r'__(.+?)__', r'*\1*', content)
        
        # Italic text (*text* or _text_ to _text_)
        # Need to be careful not to conflict with Confluence bold
        content = re.sub(r'(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)', r'_\1_', content)
        content = re.sub(r'(?<!_)_(?!_)(.+?)(?<!_)_(?!_)', r'_\1_', content)
        
        # Code blocks (```code``` to {code}...{code})
        content = re.sub(
            r'```(\w+)?\n(.*?)\n```',
            lambda m: '{code:language=' + (m.group(1) or 'none') + '}\n' + m.group(2) + '\n{code}',
            content,
            flags=re.DOTALL
        )
        
        # Inline code (`code` to {{code}})
        content = re.sub(r'`([^`]+)`', r'{{\1}}', content)
        
        # Unordered lists (- item to * item)
        content = re.sub(r'^- (.+)$', r'* \1', content, flags=re.MULTILINE)
        content = re.sub(r'^  - (.+)$', r'** \1', content, flags=re.MULTILINE)
        content = re.sub(r'^    - (.+)$', r'*** \1', content, flags=re.MULTILINE)
        
        # Ordered lists (1. item to # item)
        content = re.sub(r'^\d+\. (.+)$', r'# \1', content, flags=re.MULTILINE)
        content = re.sub(r'^  \d+\. (.+)$', r'## \1', content, flags=re.MULTILINE)
        
        # Tables (convert markdown tables to Confluence format)
        # This is more complex, so we'll do a simplified version
        lines = content.split('\n')
        new_lines = []
        in_table = False
        
        for line in lines:
            if '|' in line and not line.strip().startswith('|---'):
                # It's a table row
                if not in_table:
                    in_table = True
                # Convert | to || for headers (first row)
                if in_table and new_lines and '||' not in new_lines[-1]:
                    line = line.replace('|', '||')
                else:
                    line = line.replace('|', '|')
                new_lines.append(line)
            elif line.strip().startswith('|---'):
                # Skip separator lines in markdown tables
                continue
            else:
                in_table = False
                new_lines.append(line)
        
        content = '\n'.join(new_lines)
        
        # Links [text](url) to [text|url]
        content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'[\1|\2]', content)
        
        # Horizontal rules (--- to ----)
        content = re.sub(r'^---+$', r'----', content, flags=re.MULTILINE)
        
        # Block quotes (> text to {quote}text{quote})
        content = re.sub(r'^> (.+)$', r'{quote}\1{quote}', content, flags=re.MULTILINE)
        
        return content
    
    @staticmethod
    def markdown_to_html(markdown_content: str) -> str:
        """
        Convert Markdown to HTML for PDF generation
        
        Creates a styled HTML document that can be converted to PDF.
        """
        # Use markdown library with extensions for better formatting
        import markdown
        import re
        
        # First, convert Mermaid blocks to HTML divs
        # This prevents markdown from escaping the Mermaid syntax
        markdown_with_mermaid = re.sub(
            r'```mermaid\n(.*?)\n```',
            r'<div class="mermaid">\n\1\n</div>',
            markdown_content,
            flags=re.DOTALL
        )
        
        # Configure markdown with useful extensions
        md = markdown.Markdown(extensions=[
            'extra',           # Tables, footnotes, abbreviations
            'codehilite',      # Code syntax highlighting
            'tables',          # Better table support
            'toc',             # Table of contents
            'nl2br',           # Newline to break
            'sane_lists',      # Better list handling
            'fenced_code',     # GitHub-style code blocks
            'attr_list',       # Add attributes to elements
            'def_list',        # Definition lists
            'abbr',            # Abbreviations
            'md_in_html'       # Markdown inside HTML
        ])
        
        body_html = md.convert(markdown_with_mermaid)
        
        # Create full HTML document with improved styling
        html_template = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solution Document</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({{ 
            startOnLoad: true,
            theme: 'default',
            themeVariables: {{
                primaryColor: '#fff',
                primaryTextColor: '#000',
                primaryBorderColor: '#2c3e50',
                lineColor: '#2c3e50',
                secondaryColor: '#ecf0f1',
                tertiaryColor: '#fff',
                background: '#fff'
            }}
        }});
    </script>
    <style>
        /* GitHub-like styling for better readability */
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: #24292f;
            max-width: 980px;
            margin: 0 auto;
            padding: 20px;
            background-color: #ffffff;
        }}
        
        /* Headers */
        h1 {{
            font-size: 32px;
            font-weight: 600;
            color: #24292f;
            border-bottom: 1px solid #d1d9e0;
            padding-bottom: 0.3em;
            margin-top: 24px;
            margin-bottom: 16px;
        }}
        
        h2 {{
            font-size: 24px;
            font-weight: 600;
            color: #24292f;
            border-bottom: 1px solid #d1d9e0;
            padding-bottom: 0.3em;
            margin-top: 24px;
            margin-bottom: 16px;
        }}
        
        h3 {{
            font-size: 20px;
            font-weight: 600;
            color: #24292f;
            margin-top: 24px;
            margin-bottom: 16px;
        }}
        
        h4 {{
            font-size: 16px;
            font-weight: 600;
            color: #24292f;
            margin-top: 24px;
            margin-bottom: 16px;
        }}
        
        /* Code blocks */
        code {{
            background-color: rgba(175, 184, 193, 0.2);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 85%;
        }}
        
        pre {{
            background-color: #f6f8fa;
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
            margin-top: 0;
            margin-bottom: 16px;
        }}
        
        pre code {{
            background-color: transparent;
            padding: 0;
            border-radius: 0;
            font-size: 100%;
        }}
        
        /* Tables */
        table {{
            border-spacing: 0;
            border-collapse: collapse;
            width: 100%;
            margin-top: 0;
            margin-bottom: 16px;
            overflow: auto;
        }}
        
        table th {{
            font-weight: 600;
            padding: 6px 13px;
            border: 1px solid #d1d9e0;
            background-color: #f6f8fa;
        }}
        
        table td {{
            padding: 6px 13px;
            border: 1px solid #d1d9e0;
        }}
        
        table tr {{
            background-color: #ffffff;
            border-top: 1px solid #d1d9e0;
        }}
        
        table tr:nth-child(2n) {{
            background-color: #f6f8fa;
        }}
        
        /* Lists */
        ul, ol {{
            margin-top: 0;
            margin-bottom: 16px;
            padding-left: 2em;
        }}
        
        ul ul, ul ol, ol ol, ol ul {{
            margin-top: 0;
            margin-bottom: 0;
        }}
        
        li {{
            margin-top: 0.25em;
        }}
        
        li + li {{
            margin-top: 0.25em;
        }}
        
        /* Blockquotes */
        blockquote {{
            margin: 0;
            padding: 0 1em;
            color: #57606a;
            border-left: 0.25em solid #d1d9e0;
            margin-bottom: 16px;
        }}
        
        blockquote > :first-child {{
            margin-top: 0;
        }}
        
        blockquote > :last-child {{
            margin-bottom: 0;
        }}
        
        /* Links */
        a {{
            color: #0969da;
            text-decoration: none;
        }}
        
        a:hover {{
            text-decoration: underline;
        }}
        
        /* Horizontal rules */
        hr {{
            height: 0.25em;
            padding: 0;
            margin: 24px 0;
            background-color: #d1d9e0;
            border: 0;
        }}
        
        /* Strong emphasis */
        strong {{
            font-weight: 600;
        }}
        
        /* Paragraphs */
        p {{
            margin-top: 0;
            margin-bottom: 16px;
        }}
        
        /* Code highlighting if using codehilite */
        .codehilite {{
            background-color: #f6f8fa;
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
            margin-bottom: 16px;
        }}
        
        /* Mermaid diagram styles */
        .mermaid {{
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background-color: #f6f8fa;
            border-radius: 6px;
            border: 1px solid #d1d9e0;
        }}
        
        /* Print styles */
        @media print {{
            body {{
                max-width: 100%;
                margin: 0;
                padding: 20px;
                font-size: 12pt;
            }}
            
            h1, h2, h3, h4, h5, h6 {{
                page-break-after: avoid;
            }}
            
            table, pre, blockquote {{
                page-break-inside: avoid;
            }}
            
            a {{
                color: inherit;
                text-decoration: none;
            }}
            
            a[href^="http"]:after {{
                content: " (" attr(href) ")";
                font-size: 80%;
            }}
        }}
    </style>
</head>
<body>
    {body}
</body>
</html>"""
        
        return html_template.format(body=body_html)
    
    @staticmethod
    def _basic_markdown_to_html(markdown_content: str) -> str:
        """
        Basic Markdown to HTML conversion without external libraries
        """
        html = markdown_content
        
        # Headers
        html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
        
        # Bold
        html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
        
        # Italic
        html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)
        
        # Code blocks
        html = re.sub(r'```[\w]*\n(.*?)\n```', r'<pre><code>\1</code></pre>', html, flags=re.DOTALL)
        
        # Inline code
        html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
        
        # Links
        html = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2">\1</a>', html)
        
        # Line breaks
        html = re.sub(r'\n\n', r'</p><p>', html)
        html = f'<p>{html}</p>'
        
        # Lists (basic)
        html = re.sub(r'^- (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
        html = re.sub(r'(<li>.*</li>\n?)+', r'<ul>\g<0></ul>', html, flags=re.MULTILINE)
        
        return html
    
    @staticmethod
    def save_as_pdf(html_content: str, output_path: str) -> bool:
        """
        Convert HTML to PDF using available libraries
        
        Returns True if successful, False otherwise
        """
        try:
            # Suppress WeasyPrint warnings about missing libraries
            import warnings
            warnings.filterwarnings("ignore", message=".*WeasyPrint.*")
            
            # Use WeasyPrint for best quality PDF generation
            from weasyprint import HTML, CSS
            
            # Create PDF with WeasyPrint
            HTML(string=html_content).write_pdf(output_path)
            logger.info(f"PDF generated using WeasyPrint: {output_path}")
            return True
            
        except ImportError:
            pass  # Silently skip if not installed
            
        except Exception:
            pass  # Silently skip on error
            
        return False
    
    @staticmethod
    def markdown_to_pdf_direct(markdown_content: str, output_path: str) -> bool:
        """
        Convert Markdown directly to PDF using available libraries
        
        Returns True if successful, False otherwise
        """
        # Try pypandoc first (includes pandoc binary, works on macOS)
        try:
            import pypandoc
            
            # Convert markdown to PDF using pandoc
            pypandoc.convert_text(
                markdown_content,
                'pdf',
                format='md',
                outputfile=output_path,
                extra_args=['--variable=geometry:margin=1in']
            )
            
            logger.info(f"PDF generated using pypandoc: {output_path}")
            return True
            
        except (ImportError, RuntimeError):
            pass  # Silently skip if not available or LaTeX missing
        except Exception:
            pass  # Silently skip other errors
        
        # Try md2pdf as fallback
        try:
            # Suppress warnings
            import warnings
            warnings.filterwarnings("ignore")
            
            from md2pdf.core import md2pdf
            
            # Use md2pdf for direct conversion
            md2pdf(output_path,
                   md_content=markdown_content,
                   css_file_path=None,
                   base_url=None)
            
            logger.info(f"PDF generated using md2pdf: {output_path}")
            return True
            
        except (ImportError, OSError):
            pass  # Silently skip if libraries missing
            
        except Exception:
            pass  # Silently skip other errors
            
        return False


class MultiFormatExporter:
    """Export documents in multiple formats"""
    
    def __init__(self, base_output_dir: Path = None):
        self.base_output_dir = base_output_dir or Path("data/generated")
        self.formatter = ExportFormatter()
    
    def export_document(self, markdown_path: str, formats: list = None) -> dict:
        """
        Export a markdown document to multiple formats
        
        Args:
            markdown_path: Path to the markdown file
            formats: List of formats to export ['confluence', 'pdf', 'html']
        
        Returns:
            Dictionary with paths to exported files
        """
        if formats is None:
            formats = ['confluence', 'pdf', 'html']
        
        markdown_path = Path(markdown_path)
        if not markdown_path.exists():
            raise FileNotFoundError(f"Markdown file not found: {markdown_path}")
        
        # Read markdown content
        with open(markdown_path, 'r') as f:
            markdown_content = f.read()
        
        # Create output directory
        output_dir = markdown_path.parent
        base_name = markdown_path.stem
        
        exported_files = {'markdown': str(markdown_path)}
        
        # Export to Confluence format
        if 'confluence' in formats:
            confluence_path = output_dir / f"{base_name}.confluence.txt"
            confluence_content = self.formatter.markdown_to_confluence(markdown_content)
            with open(confluence_path, 'w') as f:
                f.write(confluence_content)
            exported_files['confluence'] = str(confluence_path)
            logger.info(f"Exported to Confluence format: {confluence_path}")
        
        # Export to HTML
        if 'html' in formats or 'pdf' in formats:
            html_path = output_dir / f"{base_name}.html"
            html_content = self.formatter.markdown_to_html(markdown_content)
            with open(html_path, 'w') as f:
                f.write(html_content)
            exported_files['html'] = str(html_path)
            logger.info(f"Exported to HTML: {html_path}")
            
            # Export to PDF (try direct markdown->PDF first, then HTML->PDF)
            if 'pdf' in formats:
                pdf_path = output_dir / f"{base_name}.pdf"
                
                # Try direct markdown to PDF first
                if self.formatter.markdown_to_pdf_direct(markdown_content, str(pdf_path)):
                    exported_files['pdf'] = str(pdf_path)
                # Fall back to HTML to PDF
                elif self.formatter.save_as_pdf(html_content, str(pdf_path)):
                    exported_files['pdf'] = str(pdf_path)
                else:
                    logger.info("PDF export requires additional setup. See documentation for details.")
        
        return exported_files


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python export_formatter.py <markdown_file> [formats]")
        print("Formats: confluence, pdf, html (default: all)")
        sys.exit(1)
    
    markdown_file = sys.argv[1]
    formats = sys.argv[2].split(',') if len(sys.argv) > 2 else ['confluence', 'pdf', 'html']
    
    exporter = MultiFormatExporter()
    try:
        exported = exporter.export_document(markdown_file, formats)
        print("\nExported files:")
        for format_type, path in exported.items():
            print(f"  {format_type}: {path}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)