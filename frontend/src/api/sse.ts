export type SseEvent = { event: string; data: string }

function parseSseChunk(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  const blocks = buffer.replace(/\r\n/g, '\n').split('\n\n')
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
export async function readSseStream(response: Response, onEvent: (event: SseEvent) => void, idleTimeoutMs = 0): Promise<void> {
  if (!response.body) throw new Error('Response has no body to stream.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([
        reader.read(),
        ...(idleTimeoutMs ? [new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('The response connection stopped sending data. Try again or switch models.')), idleTimeoutMs) })] : []),
      ]).finally(() => { if (timer) clearTimeout(timer) })
      if (result.done) {
        buffer += decoder.decode()
        const { events } = parseSseChunk(buffer + '\n\n')
        for (const event of events) onEvent(event)
        break
      }
      buffer += decoder.decode(result.value, { stream: true })
      const { events, rest } = parseSseChunk(buffer)
      buffer = rest
      for (const event of events) onEvent(event)
    }
  } catch (error) {
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
}
