import { API_V1 } from './config'
import { authFetch } from './http'

export async function fetchPersonas(): Promise<string[]> {
  const res = await authFetch(`${API_V1}/personas`)
  if (!res.ok) throw new Error(`Failed to fetch personas: ${res.status}`)
  const data: { personas: string[] } = await res.json()
  return data.personas
}

export async function createPersona(name: string, prompt: string): Promise<void> {
  const res = await authFetch(`${API_V1}/personas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, prompt }),
  })
  if (!res.ok) throw new Error(`Failed to create persona: ${res.status}`)
}

export async function deletePersona(name: string): Promise<void> {
  const res = await authFetch(`${API_V1}/personas/${encodeURIComponent(name)}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete persona: ${res.status}`)
}

export async function fetchPersona(name: string): Promise<{ name: string; prompt: string }> {
  const res = await authFetch(`${API_V1}/personas/${encodeURIComponent(name)}`)
  if (!res.ok) throw new Error(`Failed to load persona: ${res.status}`)
  return res.json()
}

export async function updatePersona(name: string, prompt: string): Promise<void> {
  const res = await authFetch(`${API_V1}/personas/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  if (!res.ok) throw new Error(`Failed to save persona: ${res.status}`)
}
