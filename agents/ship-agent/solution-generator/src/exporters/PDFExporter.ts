import fs from 'fs-extra';
import path from 'path';
import puppeteer from 'puppeteer';
import { HTMLExporter } from './HTMLExporter.js';

export class PDFExporter {
  private htmlExporter: HTMLExporter;

  constructor() {
    this.htmlExporter = new HTMLExporter();
  }

  async export(markdownPath: string): Promise<string> {
    // First convert to HTML
    const htmlPath = await this.htmlExporter.export(markdownPath);
    
    // Then convert HTML to PDF
    const pdfPath = markdownPath.replace(/\.md$/, '.pdf');
    await this.convertHTMLToPDF(htmlPath, pdfPath);
    
    return pdfPath;
  }

  private async convertHTMLToPDF(htmlPath: string, pdfPath: string): Promise<void> {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Load the HTML file
      const htmlContent = await fs.readFile(htmlPath, 'utf-8');
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
      });
      
      // Wait for Mermaid diagrams to render
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (typeof mermaid !== 'undefined') {
            mermaid.init();
            setTimeout(resolve, 1000); // Give Mermaid time to render
          } else {
            resolve(undefined);
          }
        });
      });
      
      // Generate PDF
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; text-align: center; width: 100%; padding: 10px 0;">
            <span class="title"></span>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; text-align: center; width: 100%; padding: 10px 0;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `,
        margin: {
          top: '60px',
          right: '40px',
          bottom: '60px',
          left: '40px'
        }
      });
      
      console.log(`PDF generated: ${pdfPath}`);
    } finally {
      await browser.close();
    }
  }

  async exportWithOptions(
    markdownPath: string,
    options: {
      format?: 'A4' | 'Letter' | 'Legal';
      landscape?: boolean;
      scale?: number;
      displayHeaderFooter?: boolean;
      headerTemplate?: string;
      footerTemplate?: string;
      printBackground?: boolean;
      margin?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
      };
    } = {}
  ): Promise<string> {
    // Convert to HTML first
    const htmlPath = await this.htmlExporter.export(markdownPath);
    const pdfPath = markdownPath.replace(/\.md$/, '.pdf');
    
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      
      // Load the HTML file
      const htmlContent = await fs.readFile(htmlPath, 'utf-8');
      await page.setContent(htmlContent, {
        waitUntil: 'networkidle0'
      });
      
      // Wait for Mermaid diagrams
      await page.evaluate(() => {
        return new Promise((resolve) => {
          if (typeof mermaid !== 'undefined') {
            mermaid.init();
            setTimeout(resolve, 1000);
          } else {
            resolve(undefined);
          }
        });
      });
      
      // Generate PDF with custom options
      await page.pdf({
        path: pdfPath,
        format: options.format || 'A4',
        landscape: options.landscape || false,
        scale: options.scale || 1,
        displayHeaderFooter: options.displayHeaderFooter !== false,
        headerTemplate: options.headerTemplate || '<div></div>',
        footerTemplate: options.footerTemplate || `
          <div style="font-size: 10px; text-align: center; width: 100%;">
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `,
        printBackground: options.printBackground !== false,
        margin: options.margin || {
          top: '60px',
          right: '40px',
          bottom: '60px',
          left: '40px'
        }
      });
      
    } finally {
      await browser.close();
    }
    
    return pdfPath;
  }
}