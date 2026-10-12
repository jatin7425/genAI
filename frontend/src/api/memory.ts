import { API_V1 } from './config'
import { authFetch } from './http'
export type MemoryEntry = { key: string; value: string }
export async function fetchMemory(): Promise<MemoryEntry[]> {
  const res = await authFetch(`${API_V1}/memory`)
  if (!res.ok) throw new Error('Could not load shared memory.')
  return (await res.json()).entries
}
export async function saveMemory(key: string, value: string): Promise<void> {
  const res = await authFetch(`${API_V1}/memory/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value }) })
  if (!res.ok) throw new Error('Could not save memory. Check the key and value lengths.')
}
export async function removeMemory(key?: string): Promise<void> {
  const res = await authFetch(`${API_V1}/memory${key === undefined ? '' : `/${encodeURIComponent(key)}`}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not delete memory.')
}
