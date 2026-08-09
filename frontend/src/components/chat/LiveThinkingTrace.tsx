export function LiveThinkingTrace({ lines }: { lines: string[] }) {
  const displayLines = lines.length ? lines : ['Thinking...']

  return (
    <div className="flex flex-col gap-2 pl-4 border-l-2 border-outline-variant opacity-60 font-code-sm text-code-sm text-on-surface-variant">
      {displayLines.map((line, i) => {
        const isLast = i === displayLines.length - 1
        return (
          <div key={i} className="flex items-start gap-2">
            {isLast ? (
              <span className="material-symbols-outlined text-[16px] animate-spin mt-[1px]">progress_activity</span>
            ) : (
              <span className="text-[16px] leading-none mt-[1px]">&gt;</span>
            )}
            <span>{line}</span>
          </div>
        )
      })}
    </div>
  )
}
