import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type TopicVideoRow = Database['public']['Tables']['topic_videos']['Row']

/** The one admin-approved video for a topic, if any. Never returns an
 * unverified row -- see 0042_topic_videos.sql and lib/admin/topicVideos.ts
 * for the review queue that gates what reaches here. */
export async function fetchVerifiedTopicVideo(topicId: string): Promise<TopicVideoRow | null> {
  const { data } = await supabase
    .from('topic_videos')
    .select('*')
    .eq('topic_id', topicId)
    .eq('verified', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
