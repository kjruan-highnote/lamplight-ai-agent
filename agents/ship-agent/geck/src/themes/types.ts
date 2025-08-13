export interface ThemeColors {
  // Primary brand colors
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryBorder: string;
  primaryBackground: string;
  primaryShadow: string;
  
  // Secondary colors
  secondary: string;
  secondaryHover: string;
  secondaryBorder: string;
  secondaryBackground: string;
  
  // Semantic colors
  success: string;
  warning: string;
  danger: string;
  info: string;
  
  // Base colors
  background: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderHover: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  placeholder: string;
}

export interface ThemeTypography {
  fontFamily: {
    base: string;
    mono: string;
    display: string;
  };
  fontSize: {
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    '2xl': string;
    '3xl': string;
  };
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
}

export interface ThemeSpacing {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  '2xl': string;
  '3xl': string;
}

export interface ThemeBorders {
  radius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  width: {
    thin: string;
    base: string;
    thick: string;
  };
}

export interface ThemeEffects {
  // Shadows
  shadow: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    glow: string;
  };
  
  // Animations
  transition: {
    fast: string;
    base: string;
    slow: string;
  };
  
  // Special effects
  blur: {
    none: string;
    sm: string;
    md: string;
    lg: string;
  };
  
  // Theme-specific effects
  customEffects?: {
    [key: string]: any;
  };
}

export interface ThemeComponents {
  button: {
    base: string;
    variants: {
      primary: string;
      secondary: string;
      danger: string;
      ghost: string;
    };
    sizes: {
      sm: string;
      md: string;
      lg: string;
    };
  };
  
  input: {
    base: string;
    focus: string;
    error: string;
    disabled: string;
  };
  
  select: {
    base: string;
    option: string;
    optionHover: string;
    optionSelected: string;
  };
  
  card: {
    base: string;
    header: string;
    body: string;
    footer: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  author?: string;
  version?: string;
  
  // Core theme properties
  colors: ThemeColors;
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  borders: ThemeBorders;
  effects: ThemeEffects;
  
  // Component-specific styles (optional overrides)
  components?: Partial<ThemeComponents>;
  
  // Custom CSS classes for special effects
  customClasses?: {
    [key: string]: string;
  };
  
  // Whether this theme supports dark mode
  isDark: boolean;
  
  // Parent theme to inherit from (optional)
  extends?: string;
}