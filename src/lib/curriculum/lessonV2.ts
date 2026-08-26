import type { Lesson, LanguageCode } from '@/types/curriculum'

/**
 * V2.3 lessons store both languages as sibling columns on one row (see
 * supabase/migrations/0026_add_lesson_v2_columns.sql), unlike the legacy
 * one-row-per-language `lesson_content` model. These helpers pick the right
 * column for the learner's language, falling back to English for the nine
 * locales that don't have translated lesson content yet.
 */

export interface WorkedExample {
  problem: string
  solution_steps: string[]
  final_answer: string
}

export interface StoryboardSlide {
  slide: number
  visual_description: string
  on_screen_text: string
}

export interface PracticeQuestion {
  question: string
  correct_answer: string
  hint: string
}

export function isV2Lesson(lesson: Lesson): boolean {
  return Boolean(lesson.narration_script)
}

function wantsAfrikaans(language: LanguageCode): boolean {
  return language === 'af'
}

export function getNarration(lesson: Lesson, language: LanguageCode): string {
  if (wantsAfrikaans(language) && lesson.afrikaans_narration_script) {
    return lesson.afrikaans_narration_script
  }
  return lesson.narration_script ?? ''
}

export function getStoryboard(lesson: Lesson, language: LanguageCode): StoryboardSlide[] {
  const raw =
    wantsAfrikaans(language) && lesson.afrikaans_visual_storyboard
      ? lesson.afrikaans_visual_storyboard
      : lesson.visual_storyboard
  return Array.isArray(raw) ? (raw as unknown as StoryboardSlide[]) : []
}

export function getWorkedExample(lesson: Lesson, language: LanguageCode): WorkedExample | null {
  const raw =
    wantsAfrikaans(language) && lesson.afrikaans_worked_example
      ? lesson.afrikaans_worked_example
      : lesson.worked_example
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as unknown as WorkedExample
}

export function getPracticeQuestions(lesson: Lesson, language: LanguageCode): PracticeQuestion[] {
  const raw =
    wantsAfrikaans(language) && lesson.afrikaans_practice_questions
      ? lesson.afrikaans_practice_questions
      : lesson.practice_questions
  return Array.isArray(raw) ? (raw as unknown as PracticeQuestion[]) : []
}

/** Break a long narration paragraph into shorter reading chunks at sentence boundaries. */
export function paragraphize(text: string, sentencesPerParagraph = 3): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?=\s|$)/g) ?? [text]
  const paragraphs: string[] = []
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    paragraphs.push(
      sentences
        .slice(i, i + sentencesPerParagraph)
        .join(' ')
        .trim(),
    )
  }
  return paragraphs.filter(Boolean)
}
