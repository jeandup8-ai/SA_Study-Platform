import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ChevronLeft,
  RotateCcw,
  Wand2,
  Lightbulb,
  Sparkles,
  Network,
  PlayCircle,
} from 'lucide-react'
import { useLearner } from '@/context/LearnerContext'
import {
  fetchLesson,
  fetchLessonContent,
  fetchLessonMedia,
  fetchTopicIllustration,
} from '@/lib/curriculum/queries'
import { fetchVerifiedTopicVideo } from '@/lib/curriculum/topicVideos'
import type { Database } from '@/types/database'
import {
  fetchQuestionsForTopic,
  fetchMiniQuizForLesson,
} from '@/lib/curriculum/questions'
import { recordQuizResult } from '@/lib/mastery/engine'
import {
  awardFlatPoints,
  POINTS_PER_PRACTICE_SET_COMPLETED,
} from '@/lib/gamification/points'
import { checkAndAwardBadges, type BadgeCode } from '@/lib/gamification/badges'
import { fetchStreak } from '@/lib/streak/streak'
import { PointsEarnedBanner } from '@/components/lesson/PointsEarnedBanner'
import {
  GuidedHelp,
  GuidedHelpResults,
  type GuidedHelpAction,
} from '@/components/lesson/GuidedHelp'
import { useGuidedHelp } from '@/hooks/useGuidedHelp'
import {
  isV2Lesson,
  getNarration,
  getStoryboard,
  getWorkedExample,
  getPracticeQuestions,
  paragraphize,
} from '@/lib/curriculum/lessonV2'
import { supabase } from '@/lib/supabase'
import { Button, Card, ProgressRing, StepProgress } from '@/components/ui'
import { LessonVisual } from '@/components/lesson/LessonVisual'
import { StoryboardSlides } from '@/components/lesson/StoryboardSlides'
import { WorkedExampleCard } from '@/components/lesson/WorkedExampleCard'
import { PracticeSelfCheck } from '@/components/lesson/PracticeSelfCheck'
import {
  QuestionRunner,
  type QuestionWithOptions,
} from '@/components/lesson/QuestionRunner'
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
  const [quiz, setQuiz] = useState<{
    assessmentId: string | null
    questions: QuestionWithOptions[]
  }>({
    assessmentId: null,
    questions: [],
  })
  const [quizResult, setQuizResult] = useState<{
    correctCount: number
    total: number
  } | null>(null)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [newBadges, setNewBadges] = useState<BadgeCode[]>([])
  const [nextLesson, setNextLesson] = useState<Lesson | null>(null)
  const [sessionStartedAt] = useState(() => new Date())
  const [topicIllustrationUrl, setTopicIllustrationUrl] = useState<string | null>(null)
  const [topicVideo, setTopicVideo] = useState<
    Database['public']['Tables']['topic_videos']['Row'] | null
  >(null)

  const help = useGuidedHelp(activeLearner?.id, lesson?.topic_id)

  useEffect(() => {
    if (!lessonId || !activeLearner) return
    fetchLesson(lessonId).then((row) => {
      setLesson(row)
      if (row) {
        fetchTopicIllustration(row.topic_id).then(setTopicIllustrationUrl)
        fetchVerifiedTopicVideo(row.topic_id, activeLearner.preferred_language).then(
          setTopicVideo,
        )
      }
    })
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
      fetchQuestionsForTopic({
        topicId: lesson.topic_id,
        language: activeLearner.preferred_language,
        limit: 3,
      }).then(setPracticeQuestions)
    }
    if (!v2 && currentStep === 'mini_quiz' && quiz.questions.length === 0) {
      fetchMiniQuizForLesson(lesson.id, activeLearner.preferred_language).then(
        async (result) => {
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
        },
      )
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
          score: quizResult
            ? (quizResult.correctCount / Math.max(quizResult.total, 1)) * 100
            : null,
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

  const narrationParagraphs = isV2
    ? paragraphize(getNarration(lesson, activeLearner.preferred_language))
    : []
  const storyboard = isV2 ? getStoryboard(lesson, activeLearner.preferred_language) : []
  const workedExample = isV2
    ? getWorkedExample(lesson, activeLearner.preferred_language)
    : null
  const v2PracticeQuestions = isV2
    ? getPracticeQuestions(lesson, activeLearner.preferred_language)
    : []

  const currentContent = (() => {
    const rows = content
      .filter((c) => c.section_type === step)
      .sort((a, b) => a.sort_order - b.sort_order)
    if (step === 'simple_explanation' && simplified && rows.length > 1) return rows[1]
    return rows[0]
  })()

  async function handleQuizComplete(result: {
    correctCount: number
    total: number
    answers: import('@/components/lesson/QuestionRunner').QuestionAnswerRecord[]
  }) {
    if (!lesson || !activeLearner) return
    setQuizResult(result)
    const { pointsEarned: earned, newBadges: badges } = await recordQuizResult({
      learnerId: activeLearner.id,
      topicId: lesson.topic_id,
      lessonId: lesson.id,
      correctCount: result.correctCount,
      total: result.total,
      answers: result.answers,
      assessmentId: quiz.assessmentId ?? undefined,
      sessionStartedAt,
    })
    setPointsEarned(earned)
    setNewBadges(badges)
    setStepIndex((i) => i + 1)
  }

  async function handlePracticeSetComplete() {
    if (activeLearner && lesson) {
      await awardFlatPoints(
        activeLearner.id,
        POINTS_PER_PRACTICE_SET_COMPLETED,
        'practice_completed',
        lesson.id,
      )
      setPointsEarned(POINTS_PER_PRACTICE_SET_COMPLETED)
      const { currentStreak } = await fetchStreak(activeLearner.id)
      setNewBadges(await checkAndAwardBadges(activeLearner.id, { currentStreak }))
    }
    goNext()
  }

  // Both directions clear whatever the step just produced -- a mind map
  // generated for this step must not still be on screen at the next one.
  function goNext() {
    help.reset()
    setStepIndex((i) => Math.min(i + 1, steps.length - 1))
  }
  function goBack() {
    help.reset()
    if (stepIndex === 0) navigate(-1)
    else setStepIndex((i) => i - 1)
  }

  // Assembled once rather than written out twice. The V2 and legacy lesson
  // paths had separately maintained chip lists that had already drifted --
  // only the legacy one offered "explain again" and "make it easier",
  // because only the legacy path stores a simplified variant to show.
  const videoAction: GuidedHelpAction[] = topicVideo
    ? [
        {
          key: 'video',
          icon: PlayCircle,
          label: t('lesson.watchVideo'),
          onClick: help.toggleVideo,
        },
      ]
    : []

  const helpActions: GuidedHelpAction[] = [
    {
      key: 'example',
      icon: Lightbulb,
      label: t('lesson.showExample'),
      onClick: () => setStepIndex(steps.indexOf('example')),
    },
    {
      key: 'different',
      icon: Sparkles,
      label: t('lesson.explainDifferently'),
      onClick: () => void help.requestExplanation(),
    },
    {
      key: 'mindmap',
      icon: Network,
      label: t('lesson.mindMap'),
      onClick: () => void help.requestMindMap(),
    },
    ...videoAction,
  ]

  const legacyHelpActions: GuidedHelpAction[] = [
    {
      key: 'again',
      icon: RotateCcw,
      label: t('lesson.explainAgain'),
      onClick: () => setSimplified(false),
    },
    {
      key: 'easier',
      icon: Wand2,
      label: t('lesson.makeEasier'),
      onClick: () => setSimplified(true),
    },
    ...helpActions,
  ]

  return (
    <div className="app-column flex flex-col pt-4">
      <div className="flex items-center gap-2">
        <button
          onClick={goBack}
          aria-label={t('common.back')}
          className="rounded-full p-2 hover:bg-slate-200"
        >
          <ChevronLeft />
        </button>
        <StepProgress
          className="flex-1"
          current={stepIndex + 1}
          total={steps.length}
          label={t('lesson.stepOf', { current: stepIndex + 1, total: steps.length })}
        />
      </div>

      <h1 className="font-display mt-4 text-xl font-extrabold tracking-tight text-slate-900">
        {t(`lesson.step.${step}`)}
      </h1>
      {isV2 && (
        <p className="mt-1 text-xs text-slate-400">{t('lesson.aiGeneratedNotice')}</p>
      )}

      <div className="mt-4 flex-1">
        {isV2 && step === 'simple_explanation' && (
          <Card>
            <div className="space-y-3 text-slate-700">
              {narrationParagraphs.length > 0
                ? narrationParagraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)
                : '—'}
            </div>
            <GuidedHelp actions={helpActions}>
              <GuidedHelpResults help={help} video={topicVideo} />
            </GuidedHelp>
          </Card>
        )}

        {isV2 && step === 'visual_explanation' && (
          <Card>
            {topicIllustrationUrl && (
              <img
                src={topicIllustrationUrl}
                alt=""
                className="mb-4 aspect-square w-full rounded-xl object-cover"
              />
            )}
            <StoryboardSlides slides={storyboard} />
          </Card>
        )}

        {isV2 &&
          step === 'example' &&
          (workedExample ? (
            <WorkedExampleCard example={workedExample} />
          ) : (
            <LoadingCard />
          ))}

        {isV2 &&
          step === 'practice_questions' &&
          (v2PracticeQuestions.length > 0 ? (
            <PracticeSelfCheck
              questions={v2PracticeQuestions}
              onComplete={() => void handlePracticeSetComplete()}
            />
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
              {currentContent?.heading && (
                <p className="font-bold text-slate-800">{currentContent.heading}</p>
              )}
              <p className="mt-2 whitespace-pre-line text-slate-700">
                {currentContent?.body_markdown ?? '—'}
              </p>
              {step === 'simple_explanation' && (
                <GuidedHelp actions={legacyHelpActions}>
                  <GuidedHelpResults help={help} video={topicVideo} />
                </GuidedHelp>
              )}
            </Card>
          )}

        {!isV2 && step === 'visual_explanation' && (
          <Card>
            {topicIllustrationUrl && (
              <img
                src={topicIllustrationUrl}
                alt=""
                className="mb-4 aspect-square w-full rounded-xl object-cover"
              />
            )}
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
              value={
                quizResult
                  ? (quizResult.correctCount / Math.max(quizResult.total, 1)) * 100
                  : 0
              }
              size={96}
              strokeWidth={9}
            />
            <p className="text-slate-600">
              {quizResult
                ? t('quiz.score', {
                    score: Math.round(
                      (quizResult.correctCount / Math.max(quizResult.total, 1)) * 100,
                    ),
                  })
                : t('common.loading')}
            </p>
            <PointsEarnedBanner points={pointsEarned} newBadges={newBadges} />
          </Card>
        )}

        {step === 'next_step' && (
          <Card className="text-center">
            <p className="font-bold text-slate-800">{t('lesson.finishLesson')} 🎉</p>
            {isV2 && <PointsEarnedBanner points={pointsEarned} newBadges={newBadges} />}
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

function LoadingCard() {
  return (
    <Card className="flex justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
    </Card>
  )
}
