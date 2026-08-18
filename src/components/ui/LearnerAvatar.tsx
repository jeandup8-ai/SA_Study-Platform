import clsx from 'clsx'
import type { LearnerAvatar } from '@/types/curriculum'

const AVATAR_EMOJI: Record<LearnerAvatar, string> = {
  fox: '🦊',
  owl: '🦉',
  lion: '🦁',
  elephant: '🐘',
  zebra: '🦓',
  meerkat: '🐾',
  tortoise: '🐢',
  eagle: '🦅',
}

const AVATAR_BG: Record<LearnerAvatar, string> = {
  fox: 'bg-sun-100',
  owl: 'bg-brand-100',
  lion: 'bg-sun-100',
  elephant: 'bg-slate-200',
  zebra: 'bg-slate-200',
  meerkat: 'bg-coral-100',
  tortoise: 'bg-success-50',
  eagle: 'bg-brand-100',
}

export function LearnerAvatarIcon({
  avatar,
  size = 'md',
  selected = false,
}: {
  avatar: LearnerAvatar
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
}) {
  const sizeClasses = { sm: 'h-10 w-10 text-xl', md: 'h-14 w-14 text-2xl', lg: 'h-20 w-20 text-4xl' }
  return (
    <div
      className={clsx(
        'flex items-center justify-center rounded-full',
        AVATAR_BG[avatar],
        sizeClasses[size],
        selected && 'ring-4 ring-brand-400',
      )}
      aria-hidden
    >
      {AVATAR_EMOJI[avatar]}
    </div>
  )
}

export const AVATAR_OPTIONS = Object.keys(AVATAR_EMOJI) as LearnerAvatar[]
