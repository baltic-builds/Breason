import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2fc7f7',
      dark: '#0066a1',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#C9FF36',
      contrastText: '#0D0D0D',
    },
    background: {
      default: '#f0f4ff',
      paper: '#ffffff',   // ← непрозрачный белый — используется для всех Popover/Menu
    },
    text: {
      primary: '#0D0D0D',
      secondary: '#151515',
      disabled: 'rgba(13,13,13,0.38)',
    },
  },
  typography: {
    fontFamily: '"Nunito", "Helvetica Neue", Arial, sans-serif',
    h6: { fontWeight: 700 },
    subtitle2: { fontWeight: 700 },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 20,
          background: 'rgba(255,255,255,0.62)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.85)',
          boxShadow: '0 8px 32px rgba(47,199,247,0.10), 0 1.5px 8px rgba(0,102,161,0.07)',
        },
      },
    },
    MuiFab: {
      styleOverrides: {
        root: { borderRadius: 16 },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          background: 'rgba(255,255,255,0.45)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8 },
      },
    },
    // ── Выпадающие списки — всегда непрозрачные ──────────────────────
    MuiMenu: {
      styleOverrides: {
        paper: {
          background: '#ffffff !important',
          backdropFilter: 'none !important',
          WebkitBackdropFilter: 'none !important',
          boxShadow: '0 4px 24px rgba(0,102,161,0.12)',
          border: '1px solid rgba(47,199,247,0.15)',
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: {
          background: '#ffffff !important',
          backdropFilter: 'none !important',
          WebkitBackdropFilter: 'none !important',
          boxShadow: '0 4px 24px rgba(0,102,161,0.12)',
          border: '1px solid rgba(47,199,247,0.15)',
        },
      },
    },
  },
});

export default theme;
