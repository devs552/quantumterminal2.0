import { COLORS } from "./constants";

// CSS Variables for Theme System
export const generateThemeCSS = () => `
:root {
  --color-primary: ${COLORS.primary};
  --color-secondary: ${COLORS.secondary};
  --color-accent: ${COLORS.accent};
  --color-danger: ${COLORS.danger};
  
  --color-background: ${COLORS.background};
  --color-surface: ${COLORS.surface};
  --color-surface-light: ${COLORS.surfaceLight};
  
  --color-text-primary: ${COLORS.textPrimary};
  --color-text-secondary: ${COLORS.textSecondary};
  --color-text-tertiary: ${COLORS.textTertiary};
  
  --color-success: ${COLORS.success};
  --color-warning: ${COLORS.warning};
  --color-error: ${COLORS.error};
  --color-info: ${COLORS.info};
  
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
  --shadow-glow: 0 0 20px 0 ${COLORS.primary}40;
  --shadow-glow-danger: 0 0 20px 0 ${COLORS.danger}40;
}

html {
  color-scheme: dark;
}

body {
  background-color: ${COLORS.background};
  color: ${COLORS.textPrimary};
}
`;

// Glassmorphism Utility
export const glassmorphism = (opacity: number = 0.1) => `
  background: rgba(255, 255, 255, ${opacity});
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

// Glow Border Utility
export const glowBorder = (color: string = COLORS.primary, intensity: number = 1) => `
  border: 1px solid ${color};
  box-shadow: 0 0 ${10 * intensity}px 0 ${color}${Math.floor(40 * intensity).toString(16)};
`;

// Neon Text Glow
export const neonGlow = (color: string = COLORS.primary) => `
  color: ${color};
  text-shadow: 0 0 10px ${color}, 0 0 20px ${color}40;
`;

// Animated Gradient Background
export const animatedGradient = () => `
  background: linear-gradient(
    45deg,
    ${COLORS.background},
    ${COLORS.surface},
    ${COLORS.background}
  );
  background-size: 400% 400%;
  animation: gradient-shift 15s ease infinite;
  
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

// Pulse Animation
export const pulseAnimation = (color: string = COLORS.primary) => `
  animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  
  @keyframes pulse-glow {
    0%, 100% {
      box-shadow: 0 0 0 0 ${color}80;
    }
    50% {
      box-shadow: 0 0 0 10px ${color}00;
    }
  }
`;

// Severity-based Color Function
export const getSeverityColor = (severity: number): string => {
  const colors: Record<number, string> = {
    1: COLORS.info,      // Cyan - Low
    2: COLORS.secondary,  // Green - Low-Medium
    3: COLORS.accent,     // Amber - Medium
    4: "#FF8C00",         // Orange - High
    5: COLORS.danger,     // Red - Critical
  };
  return colors[Math.min(severity, 5)] || COLORS.info;
};

// Sentiment-based Color Function
export const getSentimentColor = (sentiment: string): string => {
  const colors: Record<string, string> = {
    positive: COLORS.secondary,
    neutral: COLORS.textSecondary,
    negative: COLORS.danger,
  };
  return colors[sentiment.toLowerCase()] || COLORS.textSecondary;
};

// Change-based Color Function
export const getChangeColor = (change: number): string => {
  if (change > 0) return COLORS.secondary;
  if (change < 0) return COLORS.danger;
  return COLORS.textSecondary;
};

// Tailwind Classes Generator
export const getTailwindClasses = () => ({
  // Backgrounds
  bgPrimary: "bg-[#0A0E27]",
  bgSecondary: "bg-[#0F1432]",
  bgTertiary: "bg-[#1A1F3A]",
  
  // Text Colors
  textPrimary: "text-white",
  textSecondary: "text-[#B0B9C1]",
  textTertiary: "text-[#7A8391]",
  
  // Accent Colors
  textCyan: "text-[#00D9FF]",
  textGreen: "text-[#0FFF50]",
  textAmber: "text-[#FFD700]",
  textRed: "text-[#FF1744]",
  
  // Borders
  borderCyan: "border-[#00D9FF]",
  borderGreen: "border-[#0FFF50]",
  borderAmber: "border-[#FFD700]",
  borderRed: "border-[#FF1744]",
  
  // Common Patterns
  card: "bg-[#0F1432] border border-[#00D9FF]20 rounded-lg p-4",
  glassPanel: "bg-white/5 backdrop-blur-md border border-white/10 rounded-lg",
  button: "bg-[#00D9FF] hover:bg-[#00D9FF]/90 text-[#0A0E27] font-semibold rounded-lg px-4 py-2 transition-colors",
  buttonOutline: "border border-[#00D9FF] text-[#00D9FF] hover:bg-[#00D9FF]/10 rounded-lg px-4 py-2 transition-colors",
});

// Animation Classes
export const getAnimationClasses = () => ({
  fadeIn: "animate-fade-in",
  slideIn: "animate-slide-in",
  pulse: "animate-pulse",
  spin: "animate-spin",
  bounce: "animate-bounce",
});

// Responsive Breakpoints
export const BREAKPOINTS = {
  xs: "320px",
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
  "3xl": "1920px",
  "4xl": "2560px",
};

// Font Stack
export const FONTS = {
  sans: '"Inter", "Helvetica Neue", sans-serif',
  mono: '"Fira Code", monospace',
  heading: '"Space Mono", monospace',
};

// Z-Index Scale
export const Z_INDEX = {
  hidden: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  backdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
};

// Motion Presets
export const MOTION_PRESETS = {
  enterFromLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3 },
  },
  enterFromRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3 },
  },
  enterFromTop: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  },
  enterFromBottom: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3 },
  },
  fadeInScale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.2 },
  },
  pulse: {
    animate: {
      opacity: [0.6, 1, 0.6],
    },
    transition: {
      duration: 2,
      repeat: Infinity,
    },
  },
};

// Chart Color Schemes
export const CHART_COLORS = {
  uptrend: COLORS.secondary,  // Green
  downtrend: COLORS.danger,   // Red
  neutral: COLORS.textSecondary,
  volume: `${COLORS.primary}40`,
  ma50: COLORS.primary,
  ma200: COLORS.accent,
  bollinger: `${COLORS.secondary}20`,
};

// Map Color Schemes
export const MAP_COLOR_SCHEMES = {
  light: {
    background: "#FAFAFA",
    text: "#212121",
    border: "#E0E0E0",
  },
  dark: {
    background: COLORS.background,
    text: COLORS.textPrimary,
    border: `${COLORS.primary}40`,
  },
};
