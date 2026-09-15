import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type TopicVideoRow = Database['public']['Tables']['topic_videos']['Row']
type LanguageCode = Database['public']['Enums']['language_code']

/** The one admin-approved video for a topic in the learner's language, if
 * any -- falling back to any other approved video for that topic rather
 * than showing nothing, since a video in a different language is still
 * better than none. Never returns an unverified row -- see
 * 0042_topic_videos.sql and lib/admin/topicVideos.ts for the review queue
 * that gates what reaches here. */
export async function fetchVerifiedTopicVideo(
  topicId: string,
  preferredLanguage: LanguageCode,
): Promise<TopicVideoRow | null> {
  const { data } = await supabase
    .from('topic_videos')
    .select('*')
    .eq('topic_id', topicId)
    .eq('verified', true)
    .order('created_at', { ascending: false })
  if (!data || data.length === 0) return null
  return data.find((v) => v.language === preferredLanguage) ?? data[0]
}
