import React, { useEffect, useRef, useState, useMemo } from 'react';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../../themes/ThemeContext';
import { AlertCircle, Loader2 } from 'lucide-react';

interface DiagramRendererProps {
  content: string;
  type: 'mermaid' | 'plantuml' | 'markdown' | 'image';
  imageUrl?: string;
  className?: string;
}

const DiagramRendererInternal: React.FC<DiagramRendererProps> = ({
  content,
  type,
  imageUrl,
  className = ''
}) => {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Clear error and mermaid content when type or content changes
  useEffect(() => {
    try {
      setError(null);
      // Clear the mermaid container when switching types
      if (mermaidRef.current) {
        mermaidRef.current.innerHTML = '';
        mermaidRef.current.removeAttribute('data-processed');
      }
    } catch (err) {
      console.error('Error clearing diagram state:', err);
    }
  }, [type, content]);

  // Memoize mermaid config to avoid re-initialization
  const mermaidConfig = useMemo(() => ({
    startOnLoad: false,
    theme: 'dark' as const,
    securityLevel: 'loose' as const,
    themeVariables: {
      primaryColor: theme.colors.primary,
      primaryTextColor: theme.colors.text,
      primaryBorderColor: theme.colors.primaryBorder,
      lineColor: theme.colors.border,
      secondaryColor: theme.colors.secondary,
      tertiaryColor: theme.colors.surface,
      background: theme.colors.background,
      mainBkg: theme.colors.surface,
      secondBkg: theme.colors.background,
      textColor: theme.colors.text,
      fontSize: '14px'
    },
    flowchart: {
      htmlLabels: true,
      curve: 'basis' as const
    },
    sequence: {
      actorMargin: 50,
      boxMargin: 10,
      boxTextMargin: 5,
      noteMargin: 10,
      messageMargin: 35,
      mirrorActors: true,
      bottomMarginAdj: 1,
      useMaxWidth: true,
      rightAngles: false,
      showSequenceNumbers: false,
      wrap: true,
      wrapPadding: 10
    }
  }), [theme]);

  // Initialize mermaid once
  useEffect(() => {
    if (!isInitialized) {
      try {
        // Ensure mermaid is available
        if (typeof mermaid !== 'undefined' && mermaid.initialize) {
          mermaid.initialize(mermaidConfig);
          setIsInitialized(true);
        } else {
          console.warn('Mermaid library not fully loaded yet');
        }
      } catch (err) {
        console.error('Failed to initialize mermaid:', err);
        // Don't throw, just log the error
      }
    }
  }, [mermaidConfig, isInitialized]);

  // Render Mermaid diagram
  useEffect(() => {
    let mounted = true;
    
    if (type === 'mermaid' && content && mermaidRef.current && isInitialized) {
      const renderMermaid = async () => {
        if (!mounted) return;
        
        setLoading(true);
        setError(null);
        
        try {
          // Validate content is not empty
          if (!content.trim()) {
            setError('Diagram content is empty');
            setLoading(false);
            return;
          }

          // Ensure the container is clean
          if (mermaidRef.current) {
            mermaidRef.current.innerHTML = '';
            mermaidRef.current.removeAttribute('data-processed');
            mermaidRef.current.style.display = 'block';
          }

          // Generate unique ID for this diagram
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Create a pre element with the mermaid content
          const preElement = document.createElement('pre');
          preElement.id = id;
          preElement.className = 'mermaid';
          preElement.textContent = content;
          
          if (mermaidRef.current && mounted) {
            mermaidRef.current.appendChild(preElement);
            
            // Try different methods based on what's available
            if (typeof mermaid.run === 'function') {
              // Use mermaid.run() for newer versions
              await mermaid.run({
                querySelector: `#${id}`,
                suppressErrors: false
              });
            } else if (typeof mermaid.init === 'function') {
              // Use mermaid.init() for older versions
              mermaid.init(undefined, preElement);
            } else {
              // Fallback to contentLoaded
              await mermaid.contentLoaded();
            }
          }
        } catch (err: any) {
          console.error('Mermaid rendering error:', err);
          
          if (!mounted) return;
          
          let errorMessage = 'Failed to render diagram';
          
          // Extract meaningful error message
          if (err?.message) {
            if (err.message.includes('Syntax error') || err.message.includes('getBBox')) {
              errorMessage = 'Syntax error in Mermaid diagram. Please check your syntax.';
            } else if (err.message.includes('Parse error')) {
              errorMessage = 'Parse error in diagram. Please check the diagram syntax.';
            } else {
              errorMessage = err.message.substring(0, 200); // Limit error message length
            }
          }
          
          setError(errorMessage);
          
          // Show the raw content if there's an error
          if (mermaidRef.current) {
            const escapedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            mermaidRef.current.innerHTML = `<pre style="color: #888; padding: 1rem; background: #222; border-radius: 4px; overflow: auto; font-family: monospace; font-size: 12px;">${escapedContent}</pre>`;
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      renderMermaid();
    } else if (type !== 'mermaid' && mermaidRef.current) {
      // Hide mermaid container when switching to other types
      mermaidRef.current.style.display = 'none';
      mermaidRef.current.innerHTML = '';
    }
    
    return () => {
      mounted = false;
    };
  }, [content, type, isInitialized]);

  // Encode PlantUML content using deflate compression
  const encodePlantUML = (text: string): string => {
    // For now, use a simple encoding. For production, you'd want to use
    // the PlantUML text encoding format (deflate + custom base64)
    try {
      // Basic encoding for PlantUML server
      const encoded = btoa(unescape(encodeURIComponent(text)));
      return encoded;
    } catch (err) {
      console.error('Failed to encode PlantUML:', err);
      return '';
    }
  };

  // Render PlantUML diagram (requires server-side rendering or API)
  const renderPlantUML = () => {
    // PlantUML requires server-side processing
    if (!content || !content.trim()) {
      return (
        <div className="text-center p-8" style={{ color: theme.colors.textMuted }}>
          No PlantUML content to display
        </div>
      );
    }

    // Use the PlantUML web service
    // Note: For production, consider hosting your own PlantUML server
    const plantUmlServer = 'https://www.plantuml.com/plantuml';
    
    // PlantUML expects specific encoding
    const encoded = encodePlantUML(content);
    if (!encoded) {
      return (
        <div className="flex items-center gap-2 p-4 rounded" style={{
          backgroundColor: `${theme.colors.warning}20`,
          border: `1px solid ${theme.colors.warning}`,
          color: theme.colors.warning
        }}>
          <AlertCircle size={16} />
          <span className="text-sm">Failed to encode PlantUML diagram</span>
        </div>
      );
    }
    
    // Use the image proxy URL format
    const imageUrl = `${plantUmlServer}/svg/${encoded}`;
    
    return (
      <div className="plantuml-container">
        <img 
          src={imageUrl} 
          alt="PlantUML Diagram"
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            backgroundColor: theme.colors.surface,
            borderRadius: theme.borders.radius.md
          }}
          onError={(e) => {
            try {
              // Only set error if we haven't already
              if (!error) {
                setError('Failed to load PlantUML diagram. Please check your PlantUML syntax or try again later.');
              }
            } catch (err) {
              console.error('Error handling PlantUML load failure:', err);
            }
          }}
          onLoad={() => {
            try {
              // Clear any previous errors when image loads successfully
              if (error && error.includes('PlantUML')) {
                setError(null);
              }
            } catch (err) {
              console.error('Error handling PlantUML load success:', err);
            }
          }}
        />
      </div>
    );
  };

  // Render based on type
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin" size={24} style={{ color: theme.colors.primary }} />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center gap-2 p-4 rounded" style={{
          backgroundColor: `${theme.colors.danger}20`,
          border: `1px solid ${theme.colors.danger}`,
          color: theme.colors.danger
        }}>
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      );
    }

    switch (type) {
      case 'mermaid':
        // Mermaid is handled separately in the main render
        return null;

      case 'plantuml':
        return renderPlantUML();

      case 'markdown':
        return (
          <div className="markdown-container prose prose-invert max-w-none" style={{
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.md,
            borderRadius: theme.borders.radius.md,
            color: theme.colors.text
          }}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                // Custom rendering for code blocks that might contain diagrams
                code: ({ node, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const language = match ? match[1] : '';
                  const inline = node?.position ? false : true;
                  
                  if (!inline && language === 'mermaid') {
                    return (
                      <DiagramRenderer 
                        content={String(children).replace(/\n$/, '')}
                        type="mermaid"
                      />
                    );
                  }
                  
                  return (
                    <code 
                      className={className} 
                      style={{
                        backgroundColor: theme.colors.background,
                        padding: inline ? '2px 4px' : theme.spacing.sm,
                        borderRadius: theme.borders.radius.sm,
                        fontSize: '0.875em',
                        color: theme.colors.primary
                      }}
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        );

      case 'image':
        // Don't show an image tag if there's no URL
        if (!imageUrl && !content) {
          return (
            <div className="image-container" style={{
              backgroundColor: theme.colors.surface,
              padding: '32px',
              borderRadius: theme.borders.radius.md,
              textAlign: 'center',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ color: theme.colors.textMuted }}>
                <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>📷</div>
                <p style={{ margin: 0, fontSize: '14px' }}>No image uploaded yet</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', opacity: 0.7 }}>
                  Upload an image using the file selector above
                </p>
              </div>
            </div>
          );
        }
        
        return (
          <div className="image-container" style={{
            backgroundColor: theme.colors.surface,
            padding: theme.spacing.md,
            borderRadius: theme.borders.radius.md
          }}>
            <img 
              src={imageUrl || content} 
              alt="Workflow Diagram"
              style={{ 
                maxWidth: '100%', 
                height: 'auto',
                borderRadius: theme.borders.radius.sm
              }}
              onError={() => {
                try {
                  setError('Failed to load image');
                } catch (err) {
                  console.error('Error setting image error state:', err);
                }
              }}
            />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className={`diagram-renderer ${className}`}>
      {/* Always render mermaid container but only show when type is mermaid */}
      <div 
        ref={mermaidRef}
        className="mermaid-container"
        style={{
          backgroundColor: theme.colors.surface,
          padding: theme.spacing.md,
          borderRadius: theme.borders.radius.md,
          overflow: 'auto',
          minHeight: '100px',
          display: type === 'mermaid' && !loading && !error ? 'block' : 'none'
        }}
      />
      
      {/* Render other content based on type */}
      {type !== 'mermaid' && renderContent()}
      
      {/* Show loading/error states for mermaid */}
      {type === 'mermaid' && (loading || error) && renderContent()}
    </div>
  );
};

// Export with safe wrapper
export const DiagramRenderer: React.FC<DiagramRendererProps> = (props) => {
  try {
    return <DiagramRendererInternal {...props} />;
  } catch (err) {
    console.error('DiagramRenderer error:', err);
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center', 
        color: '#888',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px'
      }}>
        <p>Error rendering diagram</p>
        <p style={{ fontSize: '12px', marginTop: '8px' }}>Please check your diagram syntax</p>
      </div>
    );
  }
};