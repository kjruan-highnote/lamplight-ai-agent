import React, { useEffect, useRef, useState, useMemo } from 'react';
import mermaid from 'mermaid';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../../themes/ThemeContext';
import { AlertCircle, Loader2 } from 'lucide-react';

// Global flag to track if mermaid has been initialized
let globalMermaidInitialized = false;

interface DiagramRendererProps {
  content: string;
  type: 'mermaid' | 'markdown' | 'image';
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
  const [debouncedContent, setDebouncedContent] = useState(content);
  const [isTyping, setIsTyping] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Debounce content changes for Mermaid diagrams
  useEffect(() => {
    if (type === 'mermaid') {
      setIsTyping(true);
      
      // Clear existing timer
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      
      // Set new timer
      debounceTimer.current = setTimeout(() => {
        setDebouncedContent(content);
        setIsTyping(false);
        debounceTimer.current = null;
      }, 1500); // Increased to 1.5 seconds for more relaxed editing
      
      return () => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
          debounceTimer.current = null;
        }
      };
    } else {
      // For non-mermaid types, update immediately
      setDebouncedContent(content);
      setIsTyping(false);
    }
  }, [content, type]);

  // Clear error and mermaid content when type changes
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
  }, [type]);

  // Memoize mermaid config to avoid re-initialization - use JSON.stringify for deep comparison
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
  }), [JSON.stringify(theme.colors)]); // Use JSON.stringify for stable dependency

  // Initialize mermaid once globally
  useEffect(() => {
    if (!globalMermaidInitialized && typeof mermaid !== 'undefined' && mermaid.initialize) {
      try {
        mermaid.initialize(mermaidConfig);
        globalMermaidInitialized = true;
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize mermaid:', err);
      }
    } else if (globalMermaidInitialized) {
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - initialize only once

  // Render Mermaid diagram with proper cleanup
  useEffect(() => {
    let mounted = true;
    let renderTimeout: NodeJS.Timeout | null = null;
    
    if (type === 'mermaid' && debouncedContent && mermaidRef.current && isInitialized && !isTyping) {
      const renderMermaid = async () => {
        if (!mounted) return;
        
        setLoading(true);
        setError(null);
        
        try {
          // Allow empty content - just don't render
          if (!debouncedContent.trim()) {
            setLoading(false);
            return;
          }

          // Ensure the container is clean - remove all children
          if (mermaidRef.current && mounted) {
            // Remove all existing mermaid elements
            while (mermaidRef.current.firstChild) {
              mermaidRef.current.removeChild(mermaidRef.current.firstChild);
            }
            mermaidRef.current.removeAttribute('data-processed');
            mermaidRef.current.style.display = 'block';
          }

          // Generate unique ID for this diagram
          const id = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          
          // Create a pre element with the mermaid content
          const preElement = document.createElement('pre');
          preElement.id = id;
          preElement.className = 'mermaid';
          preElement.textContent = debouncedContent;
          
          if (mermaidRef.current && mounted) {
            mermaidRef.current.appendChild(preElement);
            
            // Add a small delay to ensure DOM is ready
            renderTimeout = setTimeout(() => {
              if (!mounted || !mermaidRef.current) return;
              
              // Wrap in Promise to catch all errors
              Promise.resolve().then(async () => {
                try {
                  // Try different methods based on what's available
                  if (typeof mermaid.run === 'function') {
                    // Use mermaid.run() for newer versions
                    await mermaid.run({
                      querySelector: `#${id}`,
                      suppressErrors: true  // Changed to suppress errors
                    });
                  } else if (typeof mermaid.init === 'function') {
                    // Use mermaid.init() for older versions
                    const element = document.getElementById(id);
                    if (element) {
                      mermaid.init(undefined, element);
                    }
                  } else {
                    // Fallback to contentLoaded
                    await mermaid.contentLoaded();
                  }
                } catch (renderErr) {
                  // Silently handle the error
                  if (mounted && mermaidRef.current) {
                    // Remove the failed render attempt
                    const failedElement = document.getElementById(id);
                    if (failedElement && failedElement.parentNode === mermaidRef.current) {
                      mermaidRef.current.removeChild(failedElement);
                    }
                    // Show the raw code instead
                    const lines = debouncedContent.split('\n');
                    const numberedLines = lines.map((line, i) => 
                      `<span style="color: #666; margin-right: 1em; user-select: none;">${(i + 1).toString().padStart(2, ' ')}</span>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`
                    ).join('\n');
                    
                    mermaidRef.current.innerHTML = `
                      <div style="position: relative;">
                        <div style="position: absolute; top: 8px; right: 8px; padding: 4px 8px; background: rgba(255, 150, 0, 0.1); color: #ffa500; border-radius: 4px; font-size: 11px; font-weight: 500;">
                          Editing Mode - Diagram will render when syntax is valid
                        </div>
                        <pre style="color: #aaa; padding: 1rem; background: #1a1a1a; border-radius: 4px; overflow: auto; font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; line-height: 1.5; border: 1px solid #333;">${numberedLines}</pre>
                      </div>
                    `;
                  }
                }
              }).catch(() => {
                // Catch any remaining promise rejections silently
              });
            }, 50);
          }
        } catch (err: any) {
          // Silently handle errors during editing - don't log to console
          
          if (!mounted) return;
          
          // Don't show errors at all - just show the raw content
          // This allows users to continue typing without distracting error messages
          if (mermaidRef.current) {
            // Show the raw content in a nice code block format
            const lines = debouncedContent.split('\n');
            const numberedLines = lines.map((line, i) => 
              `<span style="color: #666; margin-right: 1em; user-select: none;">${(i + 1).toString().padStart(2, ' ')}</span>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`
            ).join('\n');
            
            mermaidRef.current.innerHTML = `
              <div style="position: relative;">
                <div style="position: absolute; top: 8px; right: 8px; padding: 4px 8px; background: rgba(255, 150, 0, 0.1); color: #ffa500; border-radius: 4px; font-size: 11px; font-weight: 500;">
                  Editing Mode - Diagram will render when syntax is valid
                </div>
                <pre style="color: #aaa; padding: 1rem; background: #1a1a1a; border-radius: 4px; overflow: auto; font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; line-height: 1.5; border: 1px solid #333;">${numberedLines}</pre>
              </div>
            `;
          }
          
          // Clear any previous error state
          setError(null);
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
      // Clean up timeout if it exists
      if (renderTimeout) {
        clearTimeout(renderTimeout);
      }
      // Clean up mermaid container
      if (mermaidRef.current) {
        while (mermaidRef.current.firstChild) {
          mermaidRef.current.removeChild(mermaidRef.current.firstChild);
        }
      }
    };
  }, [debouncedContent, type, isInitialized, isTyping]);

  // Render based on type
  const renderContent = () => {
    if (loading && type === 'mermaid') {
      // Don't show loading spinner for Mermaid - it's too distracting while typing
      return null;
    }
    
    if (loading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin" size={24} style={{ color: theme.colors.primary }} />
        </div>
      );
    }

    // Don't show error messages for Mermaid - handled in the mermaid container
    if (error && type !== 'mermaid') {
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
    <div ref={containerRef} className={`diagram-renderer ${className}`} style={{ position: 'relative' }}>
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
      
      {/* Show typing indicator for mermaid */}
      {type === 'mermaid' && isTyping && (
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          padding: '4px 8px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          color: '#3b82f6',
          borderRadius: theme.borders.radius.sm,
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          zIndex: 10,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="animate-pulse" style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6'
          }} />
          Typing...
        </div>
      )}
      
      {/* Don't show loading/error states for mermaid - they're handled in the container */}
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