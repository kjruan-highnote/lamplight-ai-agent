import fs from 'fs-extra';
import path from 'path';
import MarkdownIt from 'markdown-it';
import markdownItAnchor from 'markdown-it-anchor';
import markdownItToc from 'markdown-it-toc-done-right';

export class HTMLExporter {
  private md: MarkdownIt;

  constructor() {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true
    })
    .use(markdownItAnchor)
    .use(markdownItToc, {
      containerClass: 'table-of-contents',
      containerId: 'toc',
      listType: 'ul',
      listClass: 'toc-list',
      itemClass: 'toc-item',
      linkClass: 'toc-link'
    });
  }

  async export(markdownPath: string): Promise<string> {
    const content = await fs.readFile(markdownPath, 'utf-8');
    const htmlContent = this.convertToHTML(content);
    
    const outputPath = markdownPath.replace(/\.md$/, '.html');
    await fs.writeFile(outputPath, htmlContent);
    
    return outputPath;
  }

  private convertToHTML(markdown: string): string {
    // Store Mermaid blocks temporarily
    const mermaidBlocks: string[] = [];
    let mermaidIndex = 0;
    
    // Replace Mermaid blocks with placeholders
    const markdownWithPlaceholders = markdown.replace(
      /```mermaid\n([\s\S]*?)\n```/g,
      (match, diagram) => {
        mermaidBlocks.push(diagram);
        return `<!--MERMAID_PLACEHOLDER_${mermaidIndex++}-->`;
      }
    );
    
    // Convert markdown to HTML
    let bodyContent = this.md.render(markdownWithPlaceholders);
    
    // Replace placeholders with Mermaid divs
    for (let i = 0; i < mermaidBlocks.length; i++) {
      bodyContent = bodyContent.replace(
        `<!--MERMAID_PLACEHOLDER_${i}-->`,
        `<div class="mermaid">\n${mermaidBlocks[i]}\n</div>`
      );
    }
    
    // Wrap in HTML template
    return this.wrapInTemplate(bodyContent);
  }

  private processMermaidBlocks(markdown: string): string {
    // This method is no longer used but kept for backward compatibility
    return markdown.replace(
      /```mermaid\n([\s\S]*?)\n```/g,
      (match, diagram) => {
        return `<div class="mermaid">\n${diagram}\n</div>`;
      }
    );
  }

  private wrapInTemplate(bodyContent: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solution Document</title>
    
    <!-- Mermaid -->
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'default',
            sequence: {
                showSequenceNumbers: true
            }
        });
    </script>
    
    <style>
        /* GitHub-like styling */
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: #24292f;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
        }
        
        .container {
            max-width: 980px;
            margin: 0 auto;
            padding: 45px;
        }
        
        h1 {
            font-size: 32px;
            font-weight: 600;
            padding-bottom: 0.3em;
            border-bottom: 1px solid #d1d9e0;
            margin-bottom: 16px;
            margin-top: 24px;
        }
        
        h2 {
            font-size: 24px;
            font-weight: 600;
            padding-bottom: 0.3em;
            border-bottom: 1px solid #d1d9e0;
            margin-bottom: 16px;
            margin-top: 24px;
        }
        
        h3 {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 16px;
            margin-top: 24px;
        }
        
        h4 {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            margin-top: 24px;
        }
        
        code {
            background-color: rgba(175, 184, 193, 0.2);
            padding: 0.2em 0.4em;
            border-radius: 3px;
            font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;
            font-size: 85%;
        }
        
        pre {
            background-color: #f6f8fa;
            border-radius: 6px;
            padding: 16px;
            overflow: auto;
            font-size: 85%;
            line-height: 1.45;
        }
        
        pre code {
            background-color: transparent;
            padding: 0;
            font-size: 100%;
        }
        
        table {
            border-spacing: 0;
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 16px;
        }
        
        table th {
            font-weight: 600;
            padding: 6px 13px;
            border: 1px solid #d1d9e0;
            background-color: #f6f8fa;
        }
        
        table td {
            padding: 6px 13px;
            border: 1px solid #d1d9e0;
        }
        
        table tr {
            background-color: #ffffff;
        }
        
        table tr:nth-child(2n) {
            background-color: #f6f8fa;
        }
        
        blockquote {
            padding: 0 1em;
            color: #57606a;
            border-left: 0.25em solid #d1d9e0;
            margin: 0 0 16px 0;
        }
        
        ul, ol {
            padding-left: 2em;
            margin-bottom: 16px;
        }
        
        li {
            margin-bottom: 0.25em;
        }
        
        .mermaid {
            text-align: center;
            margin: 20px 0;
            background: #f6f8fa;
            padding: 20px;
            border-radius: 6px;
        }
        
        .table-of-contents {
            background: #f6f8fa;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 30px;
        }
        
        .toc-list {
            list-style: none;
            padding-left: 0;
        }
        
        .toc-list ul {
            list-style: none;
            padding-left: 20px;
        }
        
        .toc-link {
            color: #0969da;
            text-decoration: none;
        }
        
        .toc-link:hover {
            text-decoration: underline;
        }
        
        @media print {
            .container {
                max-width: 100%;
                padding: 20px;
            }
            
            .table-of-contents {
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${bodyContent}
    </div>
</body>
</html>`;
  }
}