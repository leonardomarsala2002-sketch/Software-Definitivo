export const colors = {
  bg: "#f8f9fc",
  card: "#ffffff",
  hover: "#f3f4f8",
  border: "#e4e7ec",
  borderHover: "#c8cdd8",
  textPrimary: "#0f1117",
  textSecondary: "#6b7280",
  textDisabled: "#c4c9d4",

  primary: "#635bff",
  primaryHover: "#4f46e5",
  secondary: "#00d4aa",
  accentWarm: "#ff6b6b",
  accentYellow: "#fbbf24",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#3b82f6",
} as const;

export const gradients = {
  hero: "linear-gradient(135deg, #635bff 0%, #00d4aa 100%)",
  cardAccent: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  success: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  warning: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
  sala: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
  cucina: "linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)",
} as const;

export const typography = {
  headingXL: { size: "30px", weight: "700" },
  headingL: { size: "24px", weight: "600" },
  headingM: { size: "18px", weight: "600" },
  body: { size: "14px", weight: "400" },
  small: { size: "12px", weight: "400" },
} as const;

export const spacing = {
  cardRadius: "16px",
  buttonRadius: "10px",
  badgeRadius: "20px",
  cardPadding: "24px",
  sectionGap: "28px",
} as const;

export const shadows = {
  card: "0 4px 24px rgba(99,91,255,0.08)",
  cardHover: "0 8px 32px rgba(99,91,255,0.15)",
  button: "0 4px 14px rgba(99,91,255,0.35)",
} as const;

export const transitions = {
  default: "200ms cubic-bezier(0.4, 0, 0.2, 1)",
  spring: "300ms cubic-bezier(0.34, 1.56, 0.64, 1)",
} as const;
