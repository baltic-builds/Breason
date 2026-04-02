import type { ProcessRequest, ProcessResult, ProviderGroup } from '../types';

export async function fetchModels(): Promise<ProviderGroup[]> {
  const res = await fetch('/api/models');
  if (!res.ok) throw new Error(`Failed to load models: ${res.status}`);
  const data = await res.json();
  return data.providers as ProviderGroup[];
}

export async function processText(req: ProcessRequest): Promise<ProcessResult> {
  const res = await fetch('/api/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Server error: ${res.status}`);
  }

  return res.json();
}
