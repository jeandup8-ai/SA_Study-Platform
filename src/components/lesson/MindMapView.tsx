import {
  Atom,
  Battery,
  Book,
  Brain,
  Calculator,
  Calendar,
  Clock,
  Cloud,
  Coins,
  Compass,
  Droplet,
  Dumbbell,
  Factory,
  Flame,
  Globe,
  Heart,
  Home,
  Leaf,
  Lightbulb,
  Magnet,
  Map,
  Mountain,
  Music,
  Palette,
  Puzzle,
  Ruler,
  Scale,
  Shapes,
  Shield,
  Sparkles,
  Star,
  Thermometer,
  Users,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui'
import type { MindMap } from '@/lib/tutor/generateMindmap'

// Keys here must match the ICON_KEYS list the model picks from in
// supabase/functions/generate-mindmap/index.ts. An icon key the model
// invents anyway (or an older cached mind map without one) falls back to
// Sparkles below rather than breaking the render.
const ICON_MAP: Record<string, LucideIcon> = {
  lightbulb: Lightbulb,
  atom: Atom,
  calculator: Calculator,
  map: Map,
  book: Book,
  heart: Heart,
  users: Users,
  globe: Globe,
  leaf: Leaf,
  droplet: Droplet,
  flame: Flame,
  zap: Zap,
  shapes: Shapes,
  palette: Palette,
  music: Music,
  ruler: Ruler,
  clock: Clock,
  calendar: Calendar,
  scale: Scale,
  compass: Compass,
  cloud: Cloud,
  mountain: Mountain,
  factory: Factory,
  coins: Coins,
  shield: Shield,
  home: Home,
  brain: Brain,
  dumbbell: Dumbbell,
  utensils: Utensils,
  puzzle: Puzzle,
  star: Star,
  magnet: Magnet,
  thermometer: Thermometer,
  battery: Battery,
}

const BRANCH_STYLES = [
  { header: 'bg-brand-600', body: 'bg-brand-50', border: 'border-brand-200', bullet: 'bg-brand-500', text: 'text-brand-800' },
  { header: 'bg-sun-500', body: 'bg-sun-50', border: 'border-sun-100', bullet: 'bg-sun-500', text: 'text-sun-600' },
  { header: 'bg-coral-500', body: 'bg-coral-100', border: 'border-coral-300', bullet: 'bg-coral-500', text: 'text-coral-500' },
]

export function MindMapView({ mindmap }: { mindmap: MindMap }) {
  return (
    <Card className="mt-3 border-2 border-brand-100 bg-white">
      <div className="rounded-2xl bg-brand-600 px-4 py-3 text-center font-extrabold text-white">{mindmap.central}</div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {mindmap.branches.map((branch, i) => {
          const style = BRANCH_STYLES[i % BRANCH_STYLES.length]
          const Icon = ICON_MAP[branch.icon] ?? Sparkles
          return (
            <div key={i} className={`overflow-hidden rounded-2xl border-2 ${style.border} ${style.body}`}>
              <div className={`flex items-center gap-2 px-3 py-2 ${style.header}`}>
                <Icon className="h-5 w-5 shrink-0 text-white" aria-hidden />
                <p className="text-sm font-bold text-white">{branch.label}</p>
              </div>
              <ul className="space-y-1.5 px-3 py-2.5">
                {branch.children.map((child, j) => (
                  <li key={j} className={`flex items-start gap-2 text-xs font-semibold ${style.text}`}>
                    <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${style.bullet}`} aria-hidden />
                    {child}
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
