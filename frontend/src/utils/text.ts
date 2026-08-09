// The model sometimes answers in free text using a `<submit_answer>...</submit_answer>`-style
// wrapper instead of a real tool call. Strip that leaked formatting before it's shown/rendered.
export function stripToolTagWrapper(text: string): string {
  const trimmed = text.trim()
  const openMatch = trimmed.match(/^<([a-zA-Z_]+)>\s*/)
  if (!openMatch) return text

  const tag = openMatch[1]
  const closeRe = new RegExp(`\\s*</${tag}>\\s*$`)
  if (!closeRe.test(trimmed)) return text

  return trimmed.slice(openMatch[0].length).replace(closeRe, '').trim()
}
