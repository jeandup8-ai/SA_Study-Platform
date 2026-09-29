import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Sparkles, Lightbulb, RotateCw, ImageOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useLearner } from '@/context/LearnerContext'
import { moderationProvider, logModerationDecision } from '@/lib/moderation'
import { fetchSubjectsForGrade, fetchTopicById } from '@/lib/curriculum/queries'
import { detectScanTopic } from '@/lib/scan/detectTopic'
import { Button, Card, Badge, PageHeader } from '@/components/ui'
import { UploadZone } from '@/components/scan/UploadZone'
import type { Subject, Topic } from '@/types/curriculum'

type ScanState = 'idle' | 'checking' | 'detecting' | 'rejected' | 'approved'

export function ScanMyWorkPage() {
  const { t } = useTranslation()
  const { parent } = useAuth()
  const { activeLearner } = useLearner()
  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [simulateUnsafe, setSimulateUnsafe] = useState(false)
  const [visualSafetyChecked, setVisualSafetyChecked] = useState(false)
  const [detectedTopic, setDetectedTopic] = useState<Topic | null>(null)
  const [showManualPicker, setShowManualPicker] = useState(false)
  const [mistakeFeedback, setMistakeFeedback] = useState<string | null>(null)
  const [approvedFile, setApprovedFile] = useState<File | null>(null)
  const [detectionUnavailable, setDetectionUnavailable] = useState(false)
  const [retryingDetection, setRetryingDetection] = useState(false)

  useEffect(() => {
    if (activeLearner)
      fetchSubjectsForGrade(
        activeLearner.grade_id,
        activeLearner.preferred_language,
      ).then(setSubjects)
  }, [activeLearner])

  async function handleFile(file: File) {
    if (!activeLearner || !parent) return
    setSelectedSubject(null)
    setDetectedTopic(null)
    setShowManualPicker(false)
    setMistakeFeedback(null)
    setDetectionUnavailable(false)
    setApprovedFile(null)
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

    if (result.decision !== 'approved') {
      setState('rejected')
      return
    }

    setApprovedFile(file)
    setState('detecting')
    await runDetection(file)
    setState('approved')
  }

  // Split out from handleFile so a technical detection failure (as opposed to
  // a genuine "couldn't confidently match anything") can be retried on its
  // own -- the photo already passed moderation, so retrying shouldn't force
  // the parent to re-take or re-upload it, only re-run the AI lookup.
  async function runDetection(file: File) {
    if (!activeLearner) return
    const detection = await detectScanTopic(activeLearner.id, file)
    if (detection === null) {
      setDetectionUnavailable(true)
      return
    }
    setDetectionUnavailable(false)
    if (detection.topicId && detection.confidence !== 'low') {
      const topic = await fetchTopicById(
        detection.topicId,
        activeLearner.preferred_language,
      )
      if (topic) {
        setDetectedTopic(topic)
        setSelectedSubject(subjects.find((s) => s.id === detection.subjectId) ?? null)
        setMistakeFeedback(detection.mistakeFeedback)
      }
    }
  }

  async function handleRetryDetection() {
    if (!approvedFile) return
    setRetryingDetection(true)
    await runDetection(approvedFile)
    setRetryingDetection(false)
  }

  if (!activeLearner) return null

  return (
    <div className="app-column pt-6 pb-10">
      <PageHeader title={t('scan.title')} subtitle={t('scan.subtitle')} />

      {state === 'idle' && (
        <>
          <UploadZone onFile={(file) => void handleFile(file)} />
          <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-500">
            <input
              type="checkbox"
              checked={simulateUnsafe}
              onChange={(e) => setSimulateUnsafe(e.target.checked)}
            />
            {t('scan.simulateUnsafeToggle')}
          </label>
        </>
      )}

      {(state === 'checking' || state === 'detecting') && (
        <Card className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          {/* Showing the page being worked on, rather than a bare spinner, is
              the difference between "something is happening" and "the right
              thing is happening" -- it confirms the upload landed and that
              it is the photo the learner meant to send. */}
          {preview && (
            <img
              src={preview}
              alt={t('scan.uploadAlt')}
              className="max-h-40 w-full rounded-card object-cover opacity-70"
            />
          )}
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 motion-reduce:animate-none"
            aria-hidden
          />
          <p className="text-sm font-medium text-slate-500" role="status">
            {state === 'detecting' ? t('scan.detecting') : t('scan.checking')}
          </p>
        </Card>
      )}

      {state === 'rejected' && (
        <Card className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          {/* Deliberately calm. A child sees this screen, and the reason is
              usually something innocent -- a photo of the wrong thing --
              rather than anything they did wrong. */}
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"
            aria-hidden
          >
            <ImageOff size={24} />
          </span>
          <p className="font-semibold text-slate-700">{t('scan.rejected')}</p>
          <Button onClick={() => setState('idle')}>{t('common.tryAgain')}</Button>
        </Card>
      )}

      {state === 'approved' && (
        <div className="mt-6 space-y-4">
          <Card>
            {preview && (
              <img
                src={preview}
                alt={t('scan.uploadAlt')}
                className="mb-3 max-h-48 w-full rounded-2xl object-cover"
              />
            )}
            <div className="flex flex-wrap gap-2">
              <Badge tone="success">{t('scan.approved')}</Badge>
              <Badge tone={visualSafetyChecked ? 'success' : 'neutral'}>
                {visualSafetyChecked
                  ? t('scan.safetyChecked')
                  : t('scan.safetyNotConnected')}
              </Badge>
            </div>

            {detectedTopic && !showManualPicker ? (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-brand-700">
                  <Sparkles size={16} />
                  <p className="font-semibold">{t('scan.weThinkThisIs')}</p>
                </div>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {detectedTopic.name}
                </p>
                {subjects.find((s) => s.id === detectedTopic.subject_id) && (
                  <p className="text-sm text-slate-500">
                    {subjects.find((s) => s.id === detectedTopic.subject_id)?.name}
                  </p>
                )}
                {mistakeFeedback && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-sun-50 px-4 py-3">
                    <Lightbulb size={16} className="mt-0.5 shrink-0 text-sun-600" />
                    <p className="text-sm text-sun-700">{mistakeFeedback}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {detectionUnavailable && !showManualPicker && (
                  <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-sm text-slate-600">
                      {t('scan.detectionUnavailable')}
                    </p>
                    <Button
                      variant="secondary"
                      size="md"
                      className="mt-2"
                      disabled={retryingDetection || !approvedFile}
                      onClick={() => void handleRetryDetection()}
                    >
                      <RotateCw
                        size={14}
                        className={retryingDetection ? 'animate-spin' : undefined}
                      />
                      {t('scan.tryDetectionAgain')}
                    </Button>
                  </div>
                )}
                <p className="mt-3 font-semibold text-slate-800">
                  {t('scan.detectedSubject')}...
                </p>
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
              </>
            )}
          </Card>

          {detectedTopic && !showManualPicker && (
            <>
              <Link
                to={`/app/subjects/${detectedTopic.subject_id}/topics/${detectedTopic.id}`}
              >
                <Button className="w-full">{t('scan.startLesson')}</Button>
              </Link>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setShowManualPicker(true)}
              >
                {t('scan.notQuiteRight')}
              </Button>
            </>
          )}

          {(!detectedTopic || showManualPicker) && selectedSubject && (
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
