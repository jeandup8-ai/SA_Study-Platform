import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, RotateCcw, Wand2, Lightbulb, Sparkles } from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import { fetchLesson, fetchLessonContent, fetchLessonMedia } from '@/lib/curriculum/queries'
import { fetchQuestionsForTopic, fetchMiniQuizForLesson } from '@/lib/curriculum/questions'
import { recordQuizResult } from '@/lib/mastery/engine'
import { requestAlternateExplanation, type AlternateExplanation } from '@/lib/tutor/explainDifferently'
import { AlternateExplanationCard } from '@/components/lesson/AlternateExplanationCard'
import {
  isV2Lesson,
  getNarration,
  getStoryboard,
  getWorkedExample,
  getPracticeQuestions,
  paragraphize,
} from '@/lib/curriculum/lessonV2'
import { supabase } from '@/lib/supabase'
import { Button, Card, ProgressRing } from '@/components/ui'
import { LessonVisual } from '@/components/lesson/LessonVisual'
import { StoryboardSlides } from '@/components/lesson/StoryboardSlides'
import { WorkedExampleCard } from '@/components/lesson/WorkedExampleCard'
import { PracticeSelfCheck } from '@/components/lesson/PracticeSelfCheck'
import { QuestionRunner, type QuestionWithOptions } from '@/components/lesson/QuestionRunner'
import type { Lesson, LessonContent, Media, LessonSectionType } from '@/types/curriculum'

// Legacy demo lessons: narrative content lives in lesson_content rows, visuals
// in media rows, and questions come from the graded question bank.
const STEPS: LessonSectionType[] = [
  'what_are_we_learning',
  'simple_explanation',
  'visual_explanation',
  'example',
  'try_it_yourself',
  'practice_questions',
  'mini_quiz',
  'what_did_you_learn',
  'mastery_result',
  'next_step',
]

// V2.3 lessons store narration/storyboard/worked-example/practice content
// directly on the lessons row (lib/curriculum/lessonV2.ts), not in
// lesson_content/media/questions — and have no graded quiz bank yet, so they
// walk a shorter path through the same step vocabulary.
const V2_STEPS: LessonSectionType[] = [
  'simple_explanation',
  'visual_explanation',
  'example',
  'practice_questions',
  'next_step',
]

export function LessonPage() {
  const { t } = useTranslation()
  const { lessonId } = useParams<{ lessonId: string }>()
  const { activeLearner } = useLearner()
  const navigate = useNavigate()

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [content, setContent] = useState<LessonContent[]>([])
  const [media, setMedia] = useState<Media[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [simplified, setSimplified] = useState(false)
  const [practiceQuestions, setPracticeQuestions] = useState<QuestionWithOptions[]>([])
  const [quiz, setQuiz] = useState<{ assessmentId: string | null; questions: QuestionWithOptions[] }>({
    assessmentId: null,
    questions: [],
  })
  const [quizResult, setQuizResult] = useState<{ correctCount: number; total: number } | null>(null)
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null)
  const [sessionStartedAt] = useState(() => new Date())
  const [aiExplanation, setAiExplanation] = useState<AlternateExplanation | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  useEffect(() => {
    if (!lessonId || !activeLearner) return
    fetchLesson(lessonId).then(setLesson)
    fetchLessonContent(lessonId).then(setContent)
    fetchLessonMedia(lessonId).then(setMedia)

    supabase
      .from('learner_progress')
      .upsert(
        {
          learner_id: activeLearner.id,
          lesson_id: lessonId,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'learner_id,lesson_id', ignoreDuplicates: false },
      )
      .then(() => {})
  }, [lessonId, activeLearner])

  useEffect(() => {
    if (!lesson || !activeLearner) return
    const v2 = isV2Lesson(lesson)
    const currentSteps = v2 ? V2_STEPS : STEPS
    const currentStep = currentSteps[stepIndex]

    if (!v2 && currentStep === 'practice_questions' && practiceQuestions.length === 0) {
      fetchQuestionsForTopic({ topicId: lesson.topic_id, language: activeLearner.preferred_language, limit: 3 }).then(
        setPracticeQuestions,
      )
    }
    if (!v2 && currentStep === 'mini_quiz' && quiz.questions.length === 0) {
      fetchMiniQuizForLesson(lesson.id, activeLearner.preferred_language).then(async (result) => {
        if (result.questions.length > 0) {
          setQuiz(result)
        } else {
          const fallback = await fetchQuestionsForTopic({
            topicId: lesson.topic_id,
            language: activeLearner.preferred_language,
            limit: 3,
          })
          setQuiz({ assessmentId: null, questions: fallback })
        }
      })
    }
    if (currentStep === 'next_step') {
      supabase
        .from('lessons')
        .select('*')
        .eq('topic_id', lesson.topic_id)
        .gt('sort_order', lesson.sort_order)
        .order('sort_order')
        .limit(1)
        .maybeSingle()
        .then(({ data }) => setNextLesson(data))

      supabase
        .from('learner_progress')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          score: quizResult ? (quizResult.correctCount / Math.max(quizResult.total, 1)) * 100 : null,
          updated_at: new Date().toISOString(),
        })
        .eq('learner_id', activeLearner.id)
        .eq('lesson_id', lesson.id)
        .then(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, lesson, activeLearner])

  if (!lesson || !activeLearner) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
      </div>
    )
  }

  const isV2 = isV2Lesson(lesson)
  const steps = isV2 ? V2_STEPS : STEPS
  const step = steps[stepIndex]

  const narrationParagraphs = isV2 ? paragraphize(getNarration(lesson, activeLearner.preferred_language)) : []
  const storyboard = isV2 ? getStoryboard(lesson, activeLearner.preferred_language) : []
  const workedExample = isV2 ? getWorkedExample(lesson, activeLearner.preferred_language) : null
  const v2PracticeQuestions = isV2 ? getPracticeQuestions(lesson, activeLearner.preferred_language) : []

  const currentContent = (() => {
    const rows = content.filter((c) => c.section_type === step).sort((a, b) => a.sort_order - b.sort_order)
    if (step === 'simple_explanation' && simplified && rows.length > 1) return rows[1]
    return rows[0]
  })()

  async function handleQuizComplete(result: { correctCount: number; total: number; answers: import('@/components/lesson/QuestionRunner').QuestionAnswerRecord[] }) {
    if (!lesson || !activeLearner) return
    setQuizResult(result)
    await recordQuizResult({
      learnerId: activeLearner.id,
      topicId: lesson.topic_id,
      lessonId: lesson.id,
      correctCount: result.correctCount,
      total: result.total,
      answers: result.answers,
      assessmentId: quiz.assessmentId ?? undefined,
      sessionStartedAt,
    })
    setStepIndex((i) => i + 1)
  }

  function goNext() {
    setAiExplanation(null)
    setAiError(null)
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }
  function goBack() {
    setAiExplanation(null)
    setAiError(null)
    if (stepIndex === 0) navigate(-1)
    else setStepIndex((i) => i - 1)
  }

  async function handleRequestAlternateExplanation() {
    if (!activeLearner || !lesson) return
    setAiLoading(true)
    setAiError(null)
    const result = await requestAlternateExplanation(activeLearner.id, lesson.topic_id)
    if (result.ok) {
      setAiExplanation(result.explanation)
    } else {
      setAiError(result.error)
    }
    setAiLoading(false)
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 pt-4">
      <div className="flex items-center gap-2">
        <button onClick={goBack} aria-label={t('common.back')} className="rounded-full p-2 hover:bg-slate-200">
          <ChevronLeft />
        </button>
        <div className="flex-1">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-brand-500 transition-all"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <h1 className="mt-4 text-lg font-extrabold text-slate-900">{t(`lesson.step.${step}`)}</h1>
      {isV2 && <p className="mt-1 text-xs text-slate-400">{t('lesson.aiGeneratedNotice')}</p>}

      <div className="mt-4 flex-1">
        {isV2 && step === 'simple_explanation' && (
          <Card>
            <div className="space-y-3 text-slate-700">
              {narrationParagraphs.length > 0
                ? narrationParagraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)
                : '—'}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <TutorChip
                icon={Lightbulb}
                label={t('lesson.showExample')}
                onClick={() => setStepIndex(steps.indexOf('example'))}
              />
              <TutorChip icon={Sparkles} label={t('lesson.explainDifferently')} onClick={handleRequestAlternateExplanation} />
            </div>
            <AiExplanationPanel loading={aiLoading} error={aiError} explanation={aiExplanation} />
          </Card>
        )}

        {isV2 && step === 'visual_explanation' && (
          <Card>
            <StoryboardSlides slides={storyboard} />
          </Card>
        )}

        {isV2 && step === 'example' && (workedExample ? <WorkedExampleCard example={workedExample} /> : <LoadingCard />)}

        {isV2 &&
          step === 'practice_questions' &&
          (v2PracticeQuestions.length > 0 ? (
            <PracticeSelfCheck questions={v2PracticeQuestions} onComplete={goNext} />
          ) : (
            <LoadingCard />
          ))}

        {!isV2 &&
          (step === 'what_are_we_learning' ||
            step === 'simple_explanation' ||
            step === 'example' ||
            step === 'try_it_yourself' ||
            step === 'what_did_you_learn') && (
            <Card>
              {currentContent?.heading && <p className="font-bold text-slate-800">{currentContent.heading}</p>}
              <p className="mt-2 whitespace-pre-line text-slate-700">
                {currentContent?.body_markdown ?? '—'}
              </p>
              {step === 'simple_explanation' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <TutorChip icon={RotateCcw} label={t('lesson.explainAgain')} onClick={() => setSimplified(false)} />
                  <TutorChip icon={Wand2} label={t('lesson.makeEasier')} onClick={() => setSimplified(true)} />
                  <TutorChip
                    icon={Lightbulb}
                    label={t('lesson.showExample')}
                    onClick={() => setStepIndex(steps.indexOf('example'))}
                  />
                  <TutorChip icon={Sparkles} label={t('lesson.explainDifferently')} onClick={handleRequestAlternateExplanation} />
                </div>
              )}
              {step === 'simple_explanation' && (
                <AiExplanationPanel loading={aiLoading} error={aiError} explanation={aiExplanation} />
              )}
            </Card>
          )}

        {!isV2 && step === 'visual_explanation' && (
          <Card>
            <LessonVisual media={media[0] ?? null} fallbackLabel={lesson.title} />
          </Card>
        )}

        {!isV2 &&
          step === 'practice_questions' &&
          (practiceQuestions.length > 0 ? (
            <QuestionRunner questions={practiceQuestions} onComplete={() => goNext()} />
          ) : (
            <LoadingCard />
          ))}

        {step === 'mini_quiz' &&
          (quiz.questions.length > 0 ? (
            <QuestionRunner questions={quiz.questions} onComplete={handleQuizComplete} />
          ) : (
            <LoadingCard />
          ))}

        {step === 'mastery_result' && (
          <Card className="flex flex-col items-center gap-3 text-center">
            <ProgressRing
              value={quizResult ? (quizResult.correctCount / Math.max(quizResult.total, 1)) * 100 : 0}
              size={96}
              strokeWidth={9}
            />
            <p className="text-slate-600">
              {quizResult
                ? t('quiz.score', {
                    score: Math.round((quizResult.correctCount / Math.max(quizResult.total, 1)) * 100),
                  })
                : t('common.loading')}
            </p>
          </Card>
        )}

        {step === 'next_step' && (
          <Card className="text-center">
            <p className="font-bold text-slate-800">{t('lesson.finishLesson')} 🎉</p>
            {nextLesson ? (
              <Link to={`/app/lessons/${nextLesson.id}`} className="mt-4 block">
                <Button className="w-full">{nextLesson.title}</Button>
              </Link>
            ) : (
              <Link to={`/app/subjects`} className="mt-4 block">
                <Button className="w-full">{t('lesson.backToSubject')}</Button>
              </Link>
            )}
          </Card>
        )}
      </div>

      {step !== 'practice_questions' && step !== 'mini_quiz' && step !== 'next_step' && (
        <Button className="mt-6 w-full" onClick={goNext}>
          {t('common.continue')}
        </Button>
      )}
    </div>
  )
}

function TutorChip({ icon: Icon, label, onClick }: { icon: typeof RotateCcw; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700"
    >
      <Icon size={14} />
      {label}
    </button>
  )
}

function AiExplanationPanel({
  loading,
  error,
  explanation,
}: {
  loading: boolean
  error: string | null
  explanation: AlternateExplanation | null
}) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        {t('lesson.aiExplanationLoading')}
      </div>
    )
  }
  if (error) {
    return <p className="mt-3 text-sm text-slate-500">{t(`lesson.aiExplanationError.${error}`)}</p>
  }
  if (explanation) {
    return <AlternateExplanationCard explanation={explanation} />
  }
  return null
}

function LoadingCard() {
  return (
    <Card className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </Card>
  )
}
