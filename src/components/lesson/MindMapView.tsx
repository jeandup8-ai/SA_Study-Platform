import { Card } from '@/components/ui'
import type { MindMap } from '@/lib/tutor/generateMindmap'

const BRANCH_STYLES = [
  { dot: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700' },
  { dot: 'bg-sun-500', chip: 'bg-sun-100 text-sun-600' },
  { dot: 'bg-coral-500', chip: 'bg-coral-100 text-coral-500' },
]

export function MindMapView({ mindmap }: { mindmap: MindMap }) {
  return (
    <Card className="mt-3 border-2 border-brand-100 bg-brand-50/40">
      <div className="rounded-2xl bg-brand-600 px-4 py-3 text-center font-extrabold text-white">
        {mindmap.central}
      </div>
      <div className="mt-4 space-y-4 border-l-2 border-dashed border-slate-300 pl-4">
        {mindmap.branches.map((branch, i) => {
          const style = BRANCH_STYLES[i % BRANCH_STYLES.length]
          return (
            <div key={i} className="relative">
              <span className={`absolute -left-[21px] top-1.5 h-3 w-3 rounded-full ${style.dot}`} aria-hidden />
              <p className="font-bold text-slate-800">{branch.label}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {branch.children.map((child, j) => (
                  <span key={j} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.chip}`}>
                    {child}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
