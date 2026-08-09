import { API_V1 } from './config'
import { authFetch } from './http'

export async function fetchModels(): Promise<string[]> {
  const res = await authFetch(`${API_V1}/models`)
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`)
  const data: { models: string[] } = await res.json()
  return data.models
}
