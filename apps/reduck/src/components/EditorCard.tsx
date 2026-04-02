import { Card, CardHeader, CardContent, Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { useCallback } from 'react';
import { richTextToMarkdown, isMarkdown } from '../utils/markdown';

interface Props {
  value: string;
  onChange: (v: string) => void;
  isProcessing: boolean;
}

export default function EditorCard({ value, onChange, isProcessing }: Props) {
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.getData('text/html')) {
      e.preventDefault();
      onChange(richTextToMarkdown(e.clipboardData));
    }
  }, [onChange]);

  const fmt = value ? (isMarkdown(value) ? 'Markdown' : 'Plain') : null;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <Card elevation={0} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <CardHeader
        avatar={
          <Box sx={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(47,199,247,0.25), rgba(201,255,54,0.20))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <EditNoteIcon sx={{ fontSize: 16, color: '#0066a1' }} />
          </Box>
        }
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle2" sx={{ color: '#0D0D0D', fontSize: 13 }}>Оригинал</Typography>
            {fmt && (
              <Chip label={fmt} size="small" sx={{
                fontSize: 9, height: 16,
                bgcolor: 'rgba(201,255,54,0.25)',
                color: '#0D0D0D',
                border: '1px solid rgba(201,255,54,0.5)',
                fontWeight: 700,
              }} />
            )}
          </Box>
        }
        subheader={value
          ? <Typography variant="caption" sx={{ color: 'rgba(13,13,13,0.45)', fontSize: 11 }}>{words} слов · {value.length} зн.</Typography>
          : null}
        action={value ? (
          <Tooltip title="Очистить">
            <IconButton size="small" onClick={() => onChange('')}
              sx={{ color: 'rgba(13,13,13,0.35)', '&:hover': { color: '#ff4444' } }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        ) : null}
        sx={{
          pb: 0,
          borderBottom: '1px solid rgba(47,199,247,0.15)',
          '& .MuiCardHeader-root': { py: 1 },
        }}
      />
      <CardContent sx={{ flex: 1, p: 0, '&:last-child': { pb: 0 } }}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          disabled={isProcessing}
          placeholder={'Вставьте текст сюда...\n\nПоддерживается:\n• Обычный текст\n• Markdown\n• Rich Text из Google Docs'}
          style={{
            width: '100%', height: '100%',
            border: 'none', outline: 'none', resize: 'none',
            padding: '12px 16px', boxSizing: 'border-box',
            fontFamily: '"Montserrat", sans-serif',
            fontSize: 12, lineHeight: 1.65,
            color: isProcessing ? 'rgba(13,13,13,0.35)' : '#0D0D0D',
            backgroundColor: 'transparent',
          }}
          spellCheck={false}
        />
      </CardContent>
    </Card>
  );
}
