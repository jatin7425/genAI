import { Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, AudioLines, BarChart3, Brain, Check, CheckCircle2, ChevronDown, CircleAlert, CircleHelp, Code2, Compass, Copy, FileText, Globe, Lightbulb, LoaderCircle, LockKeyhole, LogOut, Menu, MessageSquare, Plus, RefreshCw, Search, Settings2, SlidersHorizontal, Sparkles, Square, Trash2, Upload, UserRound, X, Pencil, Images, Image, Wallpaper, Maximize, type LucideIcon } from 'lucide-react'

const icons: Record<string, LucideIcon> = {
  graphic_eq: AudioLines, add: Plus, arrow_forward: ArrowRight, arrow_back: ArrowLeft,
  arrow_downward: ArrowDown, arrow_upward: ArrowUp, chat_bubble: MessageSquare,
  description: FileText, delete: Trash2, settings: Settings2, logout: LogOut,
  menu: Menu, close: X, tune: SlidersHorizontal, keyboard_arrow_down: ChevronDown,
  expand_more: ChevronDown, check_circle: CheckCircle2, check: Check,
  error: CircleAlert, warning: CircleAlert, help: CircleHelp, edit: Pencil,
  refresh: RefreshCw, content_copy: Copy, send: ArrowUp, stop: Square,
  person: UserRound, lock: LockKeyhole, search: Search, search_insights: Search,
  travel_explore: Globe, psychology: Brain, progress_activity: LoaderCircle,
  bar_chart: BarChart3, route: Compass, code: Code2, lightbulb: Lightbulb,
  photo_library: Images, image: Image, wallpaper: Wallpaper, fullscreen: Maximize,
  auto_awesome: Sparkles, upload_file: Upload, cloud_upload: Upload, bolt: Activity,
}

type IconProps = { name: string; filled?: boolean; className?: string }
export function Icon({ name, className = '' }: IconProps) {
  const Glyph = icons[name] ?? Sparkles
  return <Glyph aria-hidden="true" strokeWidth={1.7} className={`cortex-icon ${className}`} />
}
