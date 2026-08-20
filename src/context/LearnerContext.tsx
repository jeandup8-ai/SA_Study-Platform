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

interface CreateLearnerInput {
  displayName: string
  avatar: LearnerAvatar
  curriculumId: string
  gradeId: string
  preferredLanguage: LanguageCode
}

interface LearnerContextValue {
  learners: Learner[]
  activeLearner: Learner | null
  loading: boolean
  setActiveLearnerId: (id: string) => void
  createLearner: (input: CreateLearnerInput) => Promise<Learner>
  refreshLearners: () => Promise<void>
}

const LearnerContext = createContext<LearnerContextValue | undefined>(undefined)

export function LearnerProvider({ children }: { children: ReactNode }) {
  const { parent } = useAuth()
  const [learners, setLearners] = useState<Learner[]>([])
  const [activeLearnerId, setActiveLearnerIdState] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_LEARNER_KEY),
  )
  const [loading, setLoading] = useState(true)

  const refreshLearners = useCallback(async () => {
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
  }, [parent])

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

  const activeLearner = learners.find((l) => l.id === activeLearnerId) ?? learners[0] ?? null

  useEffect(() => {
    if (activeLearner) applyLanguagePreference(activeLearner.preferred_language)
  }, [activeLearner])

  return (
    <LearnerContext.Provider
      value={{ learners, activeLearner, loading, setActiveLearnerId, createLearner, refreshLearners }}
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
