import React, { createContext, useContext, useState, useEffect } from 'react';
import { Theme } from './types';

// Import theme presets
import vaultTecTheme from './presets/vault-tec.json';
import corporateTheme from './presets/corporate.json';
import cyberpunkTheme from './presets/cyberpunk.json';
import highnoteTheme from './presets/highnote.json';
import highnoteDarkTheme from './presets/highnote-dark.json';

interface ThemeContextType {
  theme: Theme;
  themes: Theme[];
  setTheme: (themeId: string) => void;
  customThemes: Theme[];
  addCustomTheme: (theme: Theme) => void;
  removeCustomTheme: (themeId: string) => void;
  importTheme: (themeJson: string) => void;
  exportTheme: (themeId: string) => string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Default themes
const defaultThemes: Theme[] = [
  vaultTecTheme as Theme,
  corporateTheme as Theme,
  cyberpunkTheme as Theme,
  highnoteTheme as Theme,
  highnoteDarkTheme as Theme,
];


export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => {
    // Load saved theme from localStorage
    return localStorage.getItem('geck-theme') || 'vault-tec';
  });
  
  const [customThemes, setCustomThemes] = useState<Theme[]>(() => {
    // Load custom themes from localStorage
    const saved = localStorage.getItem('geck-custom-themes');
    return saved ? JSON.parse(saved) : [];
  });

  const allThemes = [...defaultThemes, ...customThemes];
  const theme = allThemes.find(t => t.id === currentThemeId) || defaultThemes[0];

  useEffect(() => {
    // Save theme preference
    localStorage.setItem('geck-theme', currentThemeId);
  }, [currentThemeId]);

  useEffect(() => {
    // Save custom themes
    localStorage.setItem('geck-custom-themes', JSON.stringify(customThemes));
  }, [customThemes]);

  useEffect(() => {
    // Apply theme CSS variables to root
    if (theme) {
      applyThemeToDOM(theme);
      // Remove the window event dispatch that causes unnecessary re-renders
      // Components that need to react to theme changes already do so via context
    }
  }, [theme]);

  const setTheme = (themeId: string) => {
    const newTheme = allThemes.find(t => t.id === themeId);
    if (newTheme) {
      setCurrentThemeId(themeId);
      // Theme will be applied via useEffect to avoid double application
    }
  };

  const addCustomTheme = (theme: Theme) => {
    // Ensure unique ID
    if (allThemes.some(t => t.id === theme.id)) {
      theme.id = `${theme.id}-${Date.now()}`;
    }
    setCustomThemes(prev => [...prev, theme]);
  };

  const removeCustomTheme = (themeId: string) => {
    setCustomThemes(prev => prev.filter(t => t.id !== themeId));
    // If removing current theme, switch to default
    if (currentThemeId === themeId) {
      setCurrentThemeId('vault-tec');
    }
  };

  const importTheme = (themeJson: string) => {
    try {
      const theme = JSON.parse(themeJson) as Theme;
      addCustomTheme(theme);
    } catch (error) {
      console.error('Failed to import theme:', error);
      throw new Error('Invalid theme JSON');
    }
  };

  const exportTheme = (themeId: string): string => {
    const theme = allThemes.find(t => t.id === themeId);
    if (!theme) {
      throw new Error(`Theme with id "${themeId}" not found`);
    }
    return JSON.stringify(theme, null, 2);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themes: allThemes,
        setTheme,
        customThemes,
        addCustomTheme,
        removeCustomTheme,
        importTheme,
        exportTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper function to apply theme to DOM
function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  const body = document.body;
  
  // Apply color variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    root.style.setProperty(`--color-${camelToKebab(key)}`, value);
  });
  
  // Apply spacing variables
  Object.entries(theme.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, value);
  });
  
  // Apply border radius variables
  Object.entries(theme.borders.radius).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, value);
  });
  
  // Apply shadow variables
  Object.entries(theme.effects.shadow).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value);
  });
  
  // Apply font families
  Object.entries(theme.typography.fontFamily).forEach(([key, value]) => {
    root.style.setProperty(`--font-${key}`, value);
  });
  
  // Apply font sizes
  Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
    root.style.setProperty(`--text-${key}`, value);
  });
  
  // Set theme mode
  root.setAttribute('data-theme', theme.id);
  root.classList.toggle('dark', theme.isDark);
  
  // Apply background and text colors directly to body
  if (body) {
    body.style.backgroundColor = theme.colors.background;
    body.style.color = theme.colors.text;
    body.style.fontFamily = theme.typography.fontFamily.base;
  }
  
  // Apply custom effects if any
  if (theme.effects.customEffects) {
    Object.entries(theme.effects.customEffects).forEach(([key, value]) => {
      root.style.setProperty(`--effect-${camelToKebab(key)}`, value as string);
    });
  }
}

function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
}