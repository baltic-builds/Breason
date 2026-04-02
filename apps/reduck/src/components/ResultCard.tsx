import {
  Card, CardHeader, CardContent, Box, Typography, IconButton,
  Tooltip, Chip, ToggleButtonGroup, ToggleButton,
  CircularProgress, Snackbar, Alert,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CodeIcon from '@mui/icons-material/Code';
import { useState, useMemo } from 'react';
import { markdownToHtml, copyAsRichText } from '../utils/markdown';

type ViewMode = 'preview' | 'markdown';

interface Props {
  value: string;
  isProcessing: boolean;
  tokensUsed?: number;
}

export default function ResultCard({ value, isProcessing, tokensUsed }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [snack, setSnack] = useState<{ open: boolean; msg: string; ok: boolean }>({ open: false, msg: '', ok: true });

  const html = useMemo(() => markdownToHtml(value), [value]);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  const notify = (msg: string, ok: boolean) => setSnack({ open: true, msg, ok });

  return (
    <>
      <Card elevation={0} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <CardHeader
          avatar={
            isProcessing ? (
              <CircularProgress size={18} thickness={4} sx={{ color: '#2fc7f7' }} />
            ) : (
              <Box sx={{
                width: 28, height: 28, borderRadius: '50%',
                background: value
                  ? 'linear-gradient(135deg, #2fc7f7, #0066a1)'
                  : 'rgba(200,200,200,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AutoFixHighIcon sx={{ fontSize: 16, color: '#fff' }} />
              </Box>
            )
          }
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2" sx={{ color: '#0D0D0D', fontSize: 13 }}>
                {isProcessing ? 'Обработка...' : 'Результат'}
              </Typography>
              {value && !isProcessing && (
                <Chip label={`${words} слов`} size="small" sx={{
                  fontSize: 9, height: 16,
                  bgcolor: 'rgba(47,199,247,0.15)',
                  color: '#0066a1',
                  border: '1px solid rgba(47,199,247,0.35)',
                  fontWeight: 700,
                }} />
              )}
              {!!tokensUsed && (
                <Chip label={`${tokensUsed} токенов`} size="small" sx={{
                  fontSize: 9, height: 16,
                  bgcolor: 'rgba(201,255,54,0.20)',
                  color: '#0D0D0D',
                  border: '1px solid rgba(201,255,54,0.4)',
                  fontWeight: 600,
                }} />
              )}
            </Box>
          }
          action={value && !isProcessing ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ToggleButtonGroup value={viewMode} exclusive size="small"
                onChange={(_, v) => v && setViewMode(v)}
                sx={{ mr: 0.5, '& .MuiToggleButton-root': { border: '1px solid rgba(47,199,247,0.3)', borderRadius: '8px !important', px: 0.75, py: 0.25 } }}>
                <ToggleButton value="preview">
                  <Tooltip title="Предпросмотр"><VisibilityIcon sx={{ fontSize: 14 }} /></Tooltip>
                </ToggleButton>
                <ToggleButton value="markdown">
                  <Tooltip title="Markdown"><CodeIcon sx={{ fontSize: 14 }} /></Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>

              <Tooltip title="Копировать Markdown">
                <IconButton size="small"
                  sx={{ color: 'rgba(13,13,13,0.4)', '&:hover': { color: '#0066a1' } }}
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(value); notify('✓ Markdown скопирован!', true); }
                    catch { notify('✗ Ошибка', false); }
                  }}>
                  <ContentCopyIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>

              <Tooltip title="Копировать как Rich Text для Google Docs">
                <Chip
                  label="Copy Rich Text"
                  size="small"
                  clickable
                  icon={<ContentCopyIcon sx={{ fontSize: '13px !important' }} />}
                  onClick={async () => {
                    const ok = await copyAsRichText(html);
                    notify(ok ? '✓ Скопировано как Rich Text!' : '✗ Ошибка', ok);
                  }}
                  sx={{
                    fontSize: 10,
                    bgcolor: 'rgba(201,255,54,0.25)',
                    color: '#0D0D0D',
                    border: '1px solid rgba(201,255,54,0.5)',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#C9FF36' },
                  }}
                />
              </Tooltip>
            </Box>
          ) : null}
          sx={{
            pb: 0,
            borderBottom: '1px solid rgba(47,199,247,0.15)',
          }}
        />

        <CardContent sx={{ flex: 1, overflow: 'auto', p: 0, '&:last-child': { pb: 0 } }}>
          {isProcessing ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 2 }}>
              <Box sx={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(47,199,247,0.15), rgba(201,255,54,0.10))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CircularProgress size={28} sx={{ color: '#2fc7f7' }} />
              </Box>
              <Typography variant="body2" sx={{ color: 'rgba(13,13,13,0.5)', fontSize: 13 }}>
                ИИ форматирует текст...
              </Typography>
            </Box>
          ) : value ? (
            <Box sx={{ p: 2, height: '100%', overflow: 'auto', boxSizing: 'border-box' }}>
              {viewMode === 'preview' ? (
                <Box dangerouslySetInnerHTML={{ __html: html }} sx={{
                  fontFamily: '"Montserrat", sans-serif', fontSize: 12, lineHeight: 1.75, color: '#0D0D0D',
                  '& h1': { fontSize: '1.5em', fontWeight: 800, color: '#0066a1', mt: 2, mb: 1 },
                  '& h2': { fontSize: '1.25em', fontWeight: 700, color: '#0066a1', mt: 1.5, mb: 0.75 },
                  '& h3': { fontSize: '1.1em', fontWeight: 700, mt: 1.5, mb: 0.5 },
                  '& p': { mt: 0, mb: 1.5 },
                  '& ul, & ol': { pl: 2.5, mb: 1.5 }, '& li': { mb: 0.4 },
                  '& strong': { fontWeight: 800 },
                  '& blockquote': {
                    borderLeft: '3px solid #2fc7f7',
                    pl: 2, ml: 0,
                    color: 'rgba(13,13,13,0.6)',
                    fontStyle: 'italic',
                    bgcolor: 'rgba(47,199,247,0.05)',
                    borderRadius: '0 8px 8px 0',
                    py: 0.5,
                  },
                  '& code': {
                    fontFamily: '"Nunito Mono", monospace',
                    fontSize: '0.85em',
                    bgcolor: 'rgba(201,255,54,0.20)',
                    px: 0.75, py: 0.2, borderRadius: 1,
                  },
                  '& pre': {
                    bgcolor: 'rgba(13,13,13,0.04)',
                    p: 2, borderRadius: 2, overflow: 'auto',
                    border: '1px solid rgba(47,199,247,0.2)',
                    '& code': { bgcolor: 'transparent', p: 0 },
                  },
                  '& table': { borderCollapse: 'collapse', width: '100%', mb: 2 },
                  '& th, & td': { border: '1px solid rgba(47,199,247,0.25)', p: '6px 12px' },
                  '& th': { bgcolor: 'rgba(47,199,247,0.12)', color: '#0066a1', fontWeight: 700 },
                  '& tr:nth-of-type(even)': { bgcolor: 'rgba(47,199,247,0.04)' },
                  '& hr': { border: 'none', borderTop: '1px solid rgba(47,199,247,0.2)', my: 2 },
                }} />
              ) : (
                <Box component="pre" sx={{
                  fontFamily: '"Montserrat", monospace', fontSize: 12,
                  lineHeight: 1.6, color: '#0D0D0D',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', m: 0,
                }}>
                  {value}
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 1.5, px: 4 }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(47,199,247,0.12), rgba(201,255,54,0.08))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AutoFixHighIcon sx={{ fontSize: 28, color: 'rgba(47,199,247,0.5)' }} />
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      <Snackbar open={snack.open} autoHideDuration={2500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.ok ? 'success' : 'error'} variant="filled" sx={{ fontSize: 13 }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
