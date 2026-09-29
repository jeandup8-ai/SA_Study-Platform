import { useCallback, useState } from 'react'
import {
  requestAlternateExplanation,
  type AlternateExplanation,
} from '@/lib/tutor/explainDifferently'
import { generateMindMap, type MindMap } from '@/lib/tutor/generateMindmap'

/**
 * Everything the Guided help region needs, in one place.
 *
 * This was seven pieces of state, two async handlers and a five-line reset
 * spread through LessonPage and interleaved with lesson progression. The
 * reset in particular was the problem: moving to the next step or back to
 * the previous one both have to clear whatever the last step produced,
 * otherwise a mind map generated for "fractions" is still on screen when
 * the learner reaches the worked example. That obligation lived as two
 * hand-maintained copies of the same five lines, which is precisely the
 * kind of thing that survives until someone adds a third navigation path.
 *
 * It is now `reset()`, and the page calls it from both.
 *
 * The hook deliberately does NOT own the action list. Two of the actions
 * offered in the Guided help region -- "show me an example" and "make it
 * easier" -- are lesson progression and content selection, not tutor
 * requests, so the page composes the list and this hook supplies only the
 * parts that talk to the tutor.
 */
export interface GuidedHelpState {
  explanation: AlternateExplanation | null
  explanationLoading: boolean
  explanationError: string | null
  mindMap: MindMap | null
  mindMapLoading: boolean
  mindMapError: string | null
  videoOpen: boolean
  toggleVideo: () => void
  requestExplanation: () => Promise<void>
  requestMindMap: () => Promise<void>
  /** Clears anything the current step produced. Call on every step change. */
  reset: () => void
}

export function useGuidedHelp(
  learnerId: string | undefined,
  topicId: string | undefined,
): GuidedHelpState {
  const [explanation, setExplanation] = useState<AlternateExplanation | null>(null)
  const [explanationLoading, setExplanationLoading] = useState(false)
  const [explanationError, setExplanationError] = useState<string | null>(null)
  const [mindMap, setMindMap] = useState<MindMap | null>(null)
  const [mindMapLoading, setMindMapLoading] = useState(false)
  const [mindMapError, setMindMapError] = useState<string | null>(null)
  const [videoOpen, setVideoOpen] = useState(false)

  const requestExplanation = useCallback(async () => {
    if (!learnerId || !topicId) return
    setExplanationLoading(true)
    setExplanationError(null)
    const result = await requestAlternateExplanation(learnerId, topicId)
    if (result.ok) setExplanation(result.explanation)
    else setExplanationError(result.error)
    setExplanationLoading(false)
  }, [learnerId, topicId])

  const requestMindMap = useCallback(async () => {
    if (!learnerId || !topicId) return
    setMindMapLoading(true)
    setMindMapError(null)
    const result = await generateMindMap(learnerId, topicId)
    if (result.ok) setMindMap(result.mindmap)
    else setMindMapError(result.error)
    setMindMapLoading(false)
  }, [learnerId, topicId])

  const toggleVideo = useCallback(() => setVideoOpen((open) => !open), [])

  // Loading flags are deliberately left alone: a request already in flight
  // resolves into state that the next reset clears, and cancelling it here
  // would only hide a spinner the learner has already navigated away from.
  const reset = useCallback(() => {
    setExplanation(null)
    setExplanationError(null)
    setMindMap(null)
    setMindMapError(null)
    setVideoOpen(false)
  }, [])

  return {
    explanation,
    explanationLoading,
    explanationError,
    mindMap,
    mindMapLoading,
    mindMapError,
    videoOpen,
    toggleVideo,
    requestExplanation,
    requestMindMap,
    reset,
  }
}
