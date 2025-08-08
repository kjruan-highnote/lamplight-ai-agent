import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class TemplateEngine {
  private templatesDir: string;
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(__dirname, '..', 'templates');
    this.registerPartials();
  }

  private async registerPartials() {
    const partialsDir = path.join(this.templatesDir, 'partials');
    
    if (await fs.pathExists(partialsDir)) {
      const files = await fs.readdir(partialsDir);
      
      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const name = path.basename(file, '.hbs');
          const content = await fs.readFile(path.join(partialsDir, file), 'utf-8');
          Handlebars.registerPartial(name, content);
        }
      }
    }
  }

  async loadTemplate(name: string): Promise<HandlebarsTemplateDelegate> {
    if (this.compiledTemplates.has(name)) {
      return this.compiledTemplates.get(name)!;
    }

    const templatePath = path.join(this.templatesDir, `${name}.hbs`);
    
    if (!await fs.pathExists(templatePath)) {
      throw new Error(`Template not found: ${name}`);
    }

    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const compiled = Handlebars.compile(templateContent);
    
    this.compiledTemplates.set(name, compiled);
    return compiled;
  }

  async render(templateName: string, data: any): Promise<string> {
    const template = await this.loadTemplate(templateName);
    return template(data);
  }

  // Helper method to render markdown sections
  renderMarkdownSection(title: string, content: string, level: number = 2): string {
    const heading = '#'.repeat(level);
    return `${heading} ${title}\n\n${content}\n\n`;
  }

  // Helper to render tables
  renderTable(headers: string[], rows: string[][]): string {
    const headerRow = `| ${headers.join(' | ')} |`;
    const separator = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
    
    return `${headerRow}\n${separator}\n${dataRows}`;
  }

  // Helper to render lists
  renderList(items: string[], ordered: boolean = false): string {
    return items.map((item, index) => 
      ordered ? `${index + 1}. ${item}` : `- ${item}`
    ).join('\n');
  }
}