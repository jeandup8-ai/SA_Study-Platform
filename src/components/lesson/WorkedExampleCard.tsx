import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card } from '@/components/ui'
import type { WorkedExample } from '@/lib/curriculum/lessonV2'

export function WorkedExampleCard({ example }: { example: WorkedExample }) {
  const { t } = useTranslation()
  const [revealed, setRevealed] = useState(false)

  return (
    <Card>
      <p className="font-bold text-slate-800">{example.problem}</p>

      {revealed ? (
        <div className="mt-4 space-y-3">
          {example.solution_steps.length > 0 && (
            <ol className="list-decimal space-y-2 pl-5 text-slate-700">
              {example.solution_steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          )}
          <div className="rounded-xl bg-success-50 px-4 py-3 font-bold text-success-600">
            {example.final_answer}
          </div>
        </div>
      ) : (
        <Button className="mt-4" variant="secondary" size="md" onClick={() => setRevealed(true)}>
          {t('lesson.showWorking')}
        </Button>
      )}
    </Card>
  )
}
