import { Sparkles } from 'lucide-react'

export function GenericConceptAnimation({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="animate-float-y flex h-32 w-32 items-center justify-center rounded-full bg-brand-100 text-brand-600">
        <Sparkles size={48} />
      </div>
      <p className="max-w-xs text-center text-lg font-bold text-slate-700">{label}</p>
    </div>
  )
}
