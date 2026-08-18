import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Camera, FileText, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLearner } from '@/context/LearnerContext'
import { moderationProvider, logModerationDecision } from '@/lib/moderation'
import { fetchSubjectsForGrade } from '@/lib/curriculum/queries'
import { Button, Card, Badge } from '@/components/ui'
import type { Subject } from '@/types/curriculum'

type ScanState = 'idle' | 'checking' | 'rejected' | 'approved'

export function ScanMyWorkPage() {
  const { t } = useTranslation()
  const { parent } = useAuth()
  const { activeLearner } = useLearner()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [simulateUnsafe, setSimulateUnsafe] = useState(false)
  const [visualSafetyChecked, setVisualSafetyChecked] = useState(false)

  useEffect(() => {
    if (activeLearner) fetchSubjectsForGrade(activeLearner.grade_id).then(setSubjects)
  }, [activeLearner])

  async function handleFile(file: File) {
    if (!activeLearner || !parent) return
    setSelectedSubject(null)
    setState('checking')
    setPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)

    const result = await moderationProvider.moderateFile(file, { simulateUnsafe })
    await logModerationDecision({
      learnerId: activeLearner.id,
      parentId: parent.id,
      contentType: file.type === 'application/pdf' ? 'pdf' : 'image',
      result,
    })
    setVisualSafetyChecked(result.visualSafetyChecked)
    setState(result.decision === 'approved' ? 'approved' : 'rejected')
  }

  if (!activeLearner) return null

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="text-xl font-extrabold text-slate-900">{t('scan.title')}</h1>
      <p className="mt-1 text-slate-500">{t('scan.subtitle')}</p>

      {state === 'idle' && (
        <div className="mt-6 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFile(file)
            }}
          />
          <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
            <Camera size={20} /> {t('scan.uploadCta')}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => fileInputRef.current?.click()}>
            <FileText size={20} /> {t('scan.uploadPdf')}
          </Button>

          <Card className="mt-4 flex items-start gap-3 bg-slate-50">
            <ShieldCheck className="mt-0.5 shrink-0 text-brand-600" size={20} />
            <p className="text-xs text-slate-500">
              Every upload is checked on our server before it's used — file type, size, and hidden
              location data in the photo are always verified for real. Deep visual scanning for unsafe
              imagery runs too once a vision-safety provider is connected; see the toggle below to
              preview how a rejection looks either way.
            </p>
          </Card>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={simulateUnsafe}
              onChange={(e) => setSimulateUnsafe(e.target.checked)}
            />
            Demo: simulate an unsafe upload being rejected
          </label>
        </div>
      )}

      {state === 'checking' && (
        <Card className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
          <p className="text-sm font-medium text-slate-500">{t('scan.checking')}</p>
        </Card>
      )}

      {state === 'rejected' && (
        <Card className="mt-6 text-center">
          <p className="text-4xl">🚫</p>
          <p className="mt-2 font-semibold text-slate-700">{t('scan.rejected')}</p>
          <Button className="mt-4" onClick={() => setState('idle')}>
            {t('common.tryAgain')}
          </Button>
        </Card>
      )}

      {state === 'approved' && (
        <div className="mt-6 space-y-4">
          <Card>
            {preview && (
              <img src={preview} alt="Your upload" className="mb-3 max-h-48 w-full rounded-2xl object-cover" />
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">{t('scan.approved')}</Badge>
              <Badge tone={visualSafetyChecked ? 'success' : 'neutral'}>
                {visualSafetyChecked ? 'Visual safety scan: checked' : 'Visual safety scan: not connected'}
              </Badge>
            </div>
            <p className="mt-3 font-semibold text-slate-800">{t('scan.detectedSubject')}...</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSubject(s)}
                  className={`min-h-10 rounded-full border-2 px-4 text-sm font-semibold ${
                    selectedSubject?.id === s.id
                      ? 'border-brand-600 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </Card>

          {selectedSubject && (
            <Link to={`/app/subjects/${selectedSubject.id}`}>
              <Button className="w-full">{t('scan.startLesson')}</Button>
            </Link>
          )}

          <Button variant="ghost" className="w-full" onClick={() => setState('idle')}>
            {t('common.tryAgain')}
          </Button>
        </div>
      )}
    </div>
  )
}
