import { API_V1 } from './config'
import { authFetch } from './http'

export type Suggestion = {
  icon: string
  title: string
  description: string
}

export async function fetchSuggestions(): Promise<Suggestion[]> {
  const res = await authFetch(`${API_V1}/suggestions`)
  if (!res.ok) throw new Error(`Failed to fetch suggestions: ${res.status}`)
  const data: { suggestions: Suggestion[] } = await res.json()
  return data.suggestions
}
