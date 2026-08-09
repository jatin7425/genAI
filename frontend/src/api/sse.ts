export type SseEvent = { event: string; data: string }

function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  const blocks = buffer.split('\n\n')
  const rest = blocks.pop() ?? ''

  for (const block of blocks) {
    let event = 'message'
    const dataLines: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice('event:'.length).trim()
      else if (line.startsWith('data:')) dataLines.push(line.slice('data:'.length).trim())
      // lines starting with ':' are comments (e.g. keepalives) — intentionally ignored
    }
    if (dataLines.length) events.push({ event, data: dataLines.join('\n') })
  }

  return { events, rest }
}

/** Reads an SSE response body to completion, invoking onEvent for each parsed event. */
export async function readSseStream(response: Response, onEvent: (event: SseEvent) => void): Promise<void> {
  if (!response.body) throw new Error('Response has no body to stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const { events, rest } = parseSseChunk(buffer)
    buffer = rest

    for (const event of events) onEvent(event)
  }
}
