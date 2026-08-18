import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  BookOpen,
  Languages,
  Sparkles,
  MessageCircleHeart,
  ScanLine,
  GraduationCap,
  LineChart,
  ShieldCheck,
} from 'lucide-react'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { Button } from '@/components/ui'

const FEATURES = [
  { key: 'grades', icon: BookOpen },
  { key: 'languages', icon: Languages },
  { key: 'lessons', icon: Sparkles },
  { key: 'tutor', icon: MessageCircleHeart },
  { key: 'scan', icon: ScanLine },
  { key: 'exam', icon: GraduationCap },
  { key: 'progress', icon: LineChart },
  { key: 'safety', icon: ShieldCheck },
] as const

export function LandingPage() {
  const { t } = useTranslation()

  return (
    <MarketingShell>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">
              Grade 4 – 7 · CAPS-aligned
            </span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-3 text-xl font-semibold text-brand-600">{t('landing.heroSubtitle')}</p>
            <p className="mt-4 max-w-lg text-lg text-slate-600">{t('landing.heroBody')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/sign-up">
                <Button size="lg">{t('landing.ctaPrimary')}</Button>
              </Link>
              <a href="#features">
                <Button size="lg" variant="secondary">
                  {t('landing.ctaSecondary')}
                </Button>
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section id="features" className="bg-white py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-extrabold text-slate-900">
            {t('landing.featuresTitle')}
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ key, icon: Icon }) => (
              <div key={key} className="rounded-3xl border border-slate-200 p-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icon size={22} />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">
                  {t(`landing.feature.${key}.title`)}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">{t(`landing.feature.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-3xl font-extrabold text-slate-900">{t('landing.heroSubtitle')}</h2>
          <p className="mt-4 text-lg text-slate-600">{t('landing.heroBody')}</p>
          <div className="mt-8">
            <Link to="/sign-up">
              <Button size="lg">{t('landing.ctaPrimary')}</Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-400">{t('landing.disclaimer')}</p>
        </div>
      </section>
    </MarketingShell>
  )
}

function DashboardPreview() {
  return (
    <div className="rounded-[2.5rem] border-8 border-slate-900 bg-slate-900 shadow-2xl">
      <div className="rounded-[2rem] bg-slate-50 p-4">
        <p className="text-lg font-bold text-slate-900">Hi Liam 👋</p>
        <p className="text-sm text-slate-500">Grade 5 · Let's learn something today.</p>
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl bg-brand-600 p-4 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-100">
              Continue learning
            </p>
            <p className="mt-1 font-bold">Fractions · Equivalent fractions</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">Mathematics</p>
              <p className="text-lg font-extrabold text-brand-600">78%</p>
            </div>
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-500">English</p>
              <p className="text-lg font-extrabold text-brand-600">82%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
