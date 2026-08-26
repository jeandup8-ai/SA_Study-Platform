import { useState } from 'react'
import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react'
import type { StoryboardSlide } from '@/lib/curriculum/lessonV2'

/**
 * V2.3 lessons ship AI-written storyboard descriptions (no real illustrations
 * yet), so each slide is rendered as a poster-style card: the on-screen text
 * as the headline, and the visual description as a muted caption describing
 * what an illustrator/video would show.
 */
export function StoryboardSlides({ slides }: { slides: StoryboardSlide[] }) {
  const [index, setIndex] = useState(0)

  if (slides.length === 0) return null
  const slide = slides[Math.min(index, slides.length - 1)]

  return (
    <div>
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-2xl bg-brand-50 px-6 text-center">
        <ImageIcon className="text-brand-300" size={36} aria-hidden="true" />
        <p className="text-lg font-extrabold text-slate-800">{slide.on_screen_text}</p>
      </div>
      <p className="mt-3 text-sm italic text-slate-500">{slide.visual_description}</p>

      {slides.length > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            className="rounded-full p-2 hover:bg-slate-200 disabled:opacity-30"
            aria-label="Previous slide"
          >
            <ChevronLeft />
          </button>
          <div className="flex gap-1.5">
            {slides.map((s, i) => (
              <span
                key={s.slide}
                className={`h-2 w-2 rounded-full ${i === index ? 'bg-brand-500' : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={index === slides.length - 1}
            onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
            className="rounded-full p-2 hover:bg-slate-200 disabled:opacity-30"
            aria-label="Next slide"
          >
            <ChevronRight />
          </button>
        </div>
      )}
    </div>
  )
}
