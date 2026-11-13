export const C = {
  bg: '#F5F6F2',
  surface: '#FFFFFF',
  text: '#16231D',
  muted: '#5C6B64',
  faint: '#8A968F',
  border: '#E3E7E1',
  primary: '#0E6B4E',
  primaryPressed: '#0A5139',
  primarySoft: '#E2F0E9',
  accent: '#F2B33D',
  danger: '#B42318',
  dangerSoft: '#FDECEA',
  warn: '#8A4B08',
  warnSoft: '#FEF3D7',
  info: '#1D4E89',
  infoSoft: '#E6EEF8',
} as const;

export const S = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const R = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
export const MaxWidth = 560;

/** Brand-ish colours for voucher cards. */
export const RETAILER_COLORS: Record<string, string> = {
  Tesco: '#00539F',
  Asda: '#3E8E1A',
  'Sainsbury’s': '#E86A10',
  Aldi: '#1B2A6B',
  Lidl: '#0050AA',
  Morrisons: '#00563F',
  'Co-op': '#0A7FA8',
  'Prepayment meter top-up': '#7A3E9D',
};
