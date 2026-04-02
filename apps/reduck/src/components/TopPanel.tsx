import {
  AppBar, Toolbar, Typography, Box, TextField,
  Select, MenuItem, FormControl, InputLabel,
  Chip, Tooltip, IconButton, Collapse, Divider,
} from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useState } from 'react';
import type { ProviderGroup } from '../types';

interface Props {
  systemPrompt: string;
  onSystemPromptChange: (v: string) => void;
  providers: ProviderGroup[];
  selectedProviderId: string;
  selectedModelId: string;
  onProviderChange: (providerId: string, modelId: string) => void;
  isProcessing: boolean;
  isDemoMode: boolean;
}

const PRESETS = [
  { label: 'Вычитка',        prompt: 'Вычитай текст, исправь грамматические и стилистические ошибки. Сохрани все заголовки, жирный шрифт, курсив, списки и прочее форматирование в Markdown. Верни исправленный текст в том же формате Markdown.' },
  { label: 'Рерайт',         prompt: 'Перепиши текст, сделав его более ясным и профессиональным. Сохрани структуру: все заголовки, списки, выделения. Формат ответа — Markdown.' },
  { label: 'Структурирование', prompt: 'Структурируй текст: добавь заголовки h1–h3 где уместно, организуй в списки, выдели ключевые моменты жирным. Формат — Markdown.' },
  { label: 'Перевод EN',     prompt: 'Translate the text to English. Preserve all Markdown formatting: headings, bold, italic, lists. Return in Markdown format.' },
  { label: 'Сокращение',     prompt: 'Сократи текст в 2 раза, сохранив ключевые мысли и всё форматирование Markdown. Верни в Markdown.' },
];

export default function TopPanel({
  systemPrompt, onSystemPromptChange,
  providers, selectedProviderId, selectedModelId,
  onProviderChange, isProcessing, isDemoMode,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  const selectedProvider = providers.find((p) => p.id === selectedProviderId);
  const models = selectedProvider?.models ?? [];

  const handleProviderChange = (newId: string) => {
    const prov = providers.find((p) => p.id === newId);
    onProviderChange(newId, prov?.models[0]?.id ?? '');
  };

  const selectSx = {
    color: '#fff',
    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.35)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
    '.MuiSvgIcon-root': { color: '#fff' },
  };
  const labelSx = { color: 'rgba(255,255,255,0.65)', '&.Mui-focused': { color: '#fff' } };

  return (
    <AppBar position="static" color="primary" elevation={4}>
      <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 1 }}>
        {/* Logo */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
          <PetsIcon />
          <Typography variant="h6" fontWeight={700} letterSpacing={1}>
            ReDuck
          </Typography>
          {isDemoMode && (
            <Chip label="Demo" size="small"
              sx={{ bgcolor: 'warning.main', color: '#fff', fontSize: 10, height: 18 }} />
          )}
        </Box>

        {/* Provider */}
        {providers.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel sx={labelSx}>Провайдер</InputLabel>
            <Select value={selectedProviderId} label="Провайдер"
              onChange={(e) => handleProviderChange(e.target.value)}
              disabled={isProcessing} sx={selectSx}>
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Model */}
        {models.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 210 }}>
            <InputLabel sx={labelSx}>Модель</InputLabel>
            <Select value={selectedModelId} label="Модель"
              onChange={(e) => onProviderChange(selectedProviderId, e.target.value)}
              disabled={isProcessing} sx={selectSx}>
              {models.map((m) => (
                <Tooltip key={m.id} title={m.description ?? ''} placement="right">
                  <MenuItem value={m.id}>{m.label}</MenuItem>
                </Tooltip>
              ))}
            </Select>
          </FormControl>
        )}

        <Box sx={{ flex: 1 }} />

        <IconButton size="small" onClick={() => setExpanded((v) => !v)} sx={{ color: '#fff' }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Toolbar>

      <Collapse in={expanded}>
        <Divider sx={{ borderColor: 'rgba(255,255,255,0.15)' }} />
        <Box sx={{ px: 2, py: 1.5, bgcolor: 'primary.dark' }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {PRESETS.map((p) => (
              <Chip key={p.label} label={p.label} size="small" clickable
                onClick={() => onSystemPromptChange(p.prompt)}
                sx={{ bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 11,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' } }} />
            ))}
          </Box>
          <TextField fullWidth multiline rows={2} value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="Введите инструкцию для ИИ..."
            disabled={isProcessing} variant="outlined" size="small" label="System Prompt"
            InputLabelProps={{ sx: labelSx }}
            sx={{
              '& .MuiOutlinedInput-root': {
                color: '#fff', bgcolor: 'rgba(0,0,0,0.18)',
                '& fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.55)' },
                '&.Mui-focused fieldset': { borderColor: '#fff' },
              },
            }} />
        </Box>
      </Collapse>
    </AppBar>
  );
}
