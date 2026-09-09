import { supabase } from '@/lib/supabase'
import type { LanguageCode } from '@/types/curriculum'

export interface ScanTopicDetection {
  detectedLanguage: LanguageCode
  subjectId: string | null
  topicId: string | null
  confidence: 'high' | 'medium' | 'low'
  mistakeFeedback: string | null
}

const DETECTABLE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Calls the `detect-scan-topic` Edge Function to identify which curriculum
 * topic a scanned worksheet photo most likely matches. Only ever run on
 * plain image uploads (not PDFs -- see supabase/functions/detect-scan-topic).
 * Returns null on any failure or when the feature isn't configured, so the
 * caller can silently fall back to manual subject selection.
 */
export async function detectScanTopic(learnerId: string, file: File): Promise<ScanTopicDetection | null> {
  if (!DETECTABLE_MIME_TYPES.includes(file.type)) return null

  try {
    const form = new FormData()
    form.append('file', file)
    form.append('learnerId', learnerId)

    const { data, error } = await supabase.functions.invoke('detect-scan-topic', { body: form })
    if (error || !data || typeof data.confidence !== 'string') return null

    return {
      detectedLanguage: data.detectedLanguage === 'af' ? 'af' : 'en',
      subjectId: typeof data.subjectId === 'string' ? data.subjectId : null,
      topicId: typeof data.topicId === 'string' ? data.topicId : null,
      confidence: data.confidence === 'high' || data.confidence === 'medium' ? data.confidence : 'low',
      mistakeFeedback: typeof data.mistakeFeedback === 'string' ? data.mistakeFeedback : null,
    }
  } catch {
    return null
  }
}
