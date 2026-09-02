import { useTranslation } from 'react-i18next'
import { Card, Badge } from '@/components/ui'
import type { AlternateExplanation } from '@/lib/tutor/explainDifferently'

export function AlternateExplanationCard({ explanation }: { explanation: AlternateExplanation }) {
  const { t } = useTranslation()
  return (
    <Card className="mt-3 border-2 border-brand-100 bg-brand-50/40">
      <Badge tone="brand">{t(`lesson.aiFraming.${explanation.framing}`)}</Badge>
      <p className="mt-3 text-slate-700">{explanation.explanation}</p>
      <div className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-slate-600">{explanation.mini_example}</div>
    </Card>
  )
}
