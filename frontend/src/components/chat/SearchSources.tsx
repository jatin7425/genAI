import { Icon } from '../Icon'

export function SearchSources({ sources, note }: { sources?: string[]; note?: string }) {
  const links = [...new Set(sources ?? [])].flatMap(value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? [{ href: url.href, label: url.hostname.replace(/^www\./, '') }] : [] }
    catch { return [] }
  }).slice(0, 12)
  if (!links.length) return null
  return <nav aria-label="Web search sources" className="mt-4 border-t border-outline-variant/50 pt-3"><p className="text-xs text-on-surface-variant mb-2">Sources</p>{note && <p className="text-xs text-on-surface-variant mb-3">{note}</p>}<div className="flex flex-wrap gap-2">{links.map((link, index) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" title={link.href} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-xs text-primary hover:bg-surface-container-high"><Icon name="travel_explore" className="w-3.5 h-3.5"/><span className="truncate">{index + 1}. {link.label}</span></a>)}</div></nav>
}
