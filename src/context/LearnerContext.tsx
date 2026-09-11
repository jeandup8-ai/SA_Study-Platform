import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { applyLanguagePreference } from '@/i18n'
import type { Learner, LearnerAvatar, LanguageCode } from '@/types/curriculum'

const ACTIVE_LEARNER_KEY = 'study.activeLearnerId'
// No subscription row exists yet (trial not started) -- falls back to the
// only plan currently on sale (see subscription_plans: both active family
// plans cap at 4) rather than leaving new parents completely uncapped.
const DEFAULT_MAX_LEARNERS = 4

interface CreateLearnerInput {
  displayName: string
  avatar: LearnerAvatar
  curriculumId: string
  gradeId: string
  preferredLanguage: LanguageCode
}

export class MaxLearnersReachedError extends Error {
  readonly max: number
  constructor(max: number) {
    super('max_learners_reached')
    this.max = max
  }
}

interface LearnerContextValue {
  learners: Learner[]
  activeLearner: Learner | null
  loading: boolean
  setActiveLearnerId: (id: string) => void
  createLearner: (input: CreateLearnerInput) => Promise<Learner>
  deleteLearner: (id: string) => Promise<void>
  refreshLearners: () => Promise<void>
}

const LearnerContext = createContext<LearnerContextValue | undefined>(undefined)

export function LearnerProvider({ children }: { children: ReactNode }) {
  const { parent, loading: authLoading } = useAuth()
  const [learners, setLearners] = useState<Learner[]>([])
  const [activeLearnerId, setActiveLearnerIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_LEARNER_KEY),
  )
  const [loading, setLoading] = useState(true)

  const refreshLearners = useCallback(async () => {
    // Auth hasn't settled yet -- `parent` being momentarily null here doesn't
    // mean "no parent," it means "don't know yet." Reporting an empty learner
    // list in that window was sending signed-in parents with existing
    // profiles into onboarding's "create a profile" flow on every reload
    // where the session took a moment to restore (observed on non-Chrome
    // mobile browsers).
    if (authLoading) return
    if (!parent) {
      setLearners([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('learners')
      .select('*')
      .eq('parent_id', parent.id)
      .order('created_at', { ascending: true })
    setLearners(data ?? [])
    setLoading(false)
  }, [parent, authLoading])

  useEffect(() => {
    void refreshLearners()
  }, [refreshLearners])

  useEffect(() => {
    if (learners.length === 0) return
    const stillExists = learners.some((l) => l.id === activeLearnerId)
    if (!stillExists) {
      setActiveLearnerIdState(learners[0].id)
      localStorage.setItem(ACTIVE_LEARNER_KEY, learners[0].id)
    }
  }, [learners, activeLearnerId])

  function setActiveLearnerId(id: string) {
    setActiveLearnerIdState(id)
    localStorage.setItem(ACTIVE_LEARNER_KEY, id)
  }

  async function createLearner(input: CreateLearnerInput): Promise<Learner> {
    if (!parent) throw new Error('No signed-in parent.')

    // Client-side check for immediate, friendly feedback -- the real
    // enforcement is the learners_enforce_limit DB trigger (migration 0041),
    // since a direct API call could otherwise bypass this.
    const { data: latestSubscription } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('parent_id', parent.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    let maxLearners = DEFAULT_MAX_LEARNERS
    if (latestSubscription?.plan_id) {
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('max_learners')
        .eq('id', latestSubscription.plan_id)
        .maybeSingle()
      if (plan) maxLearners = plan.max_learners
    }
    if (learners.length >= maxLearners) {
      throw new MaxLearnersReachedError(maxLearners)
    }

    const { data, error } = await supabase
      .from('learners')
      .insert({
        parent_id: parent.id,
        display_name: input.displayName,
        avatar: input.avatar,
        curriculum_id: input.curriculumId,
        grade_id: input.gradeId,
        preferred_language: input.preferredLanguage,
      })
      .select('*')
      .single()
    if (error) throw error
    await refreshLearners()
    setActiveLearnerId(data.id)
    return data
  }

  async function deleteLearner(id: string): Promise<void> {
    // Cascades to every table referencing learners(id) -- assessment history,
    // AI-tutor logs, points, baselines, everything. See migration 0002 etc.
    // (all "on delete cascade"). Irreversible; the UI confirms before calling
    // this.
    const { error } = await supabase.from('learners').delete().eq('id', id)
    if (error) throw error
    if (activeLearnerId === id) {
      localStorage.removeItem(ACTIVE_LEARNER_KEY)
      setActiveLearnerIdState(null)
    }
    await refreshLearners()
  }

  const activeLearner = learners.find((l) => l.id === activeLearnerId) ?? learners[0] ?? null

  useEffect(() => {
    if (activeLearner) applyLanguagePreference(activeLearner.preferred_language)
  }, [activeLearner])

  return (
    <LearnerContext.Provider
      value={{ learners, activeLearner, loading, setActiveLearnerId, createLearner, deleteLearner, refreshLearners }}
    >
      {children}
    </LearnerContext.Provider>
  )
}

export function useLearner(): LearnerContextValue {
  const ctx = useContext(LearnerContext)
  if (!ctx) throw new Error('useLearner must be used within a LearnerProvider')
  return ctx
}
