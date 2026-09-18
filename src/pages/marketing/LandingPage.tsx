import { useTranslation } from 'react-i18next'
import { MarketingShell } from '@/components/layout/MarketingShell'
import { useSeo } from '@/hooks/useSeo'
import { Hero } from './sections/Hero'
import { MakeSense } from './sections/MakeSense'
import { CoreFlow } from './sections/CoreFlow'
import { Showcase } from './sections/Showcase'
import { Subjects } from './sections/Subjects'
import { AiTutor } from './sections/AiTutor'
import { Progress } from './sections/Progress'
import { ForParents } from './sections/ForParents'
import { Safety } from './sections/Safety'
import { LocalPositioning } from './sections/LocalPositioning'
import { PricingSection } from './sections/PricingSection'
import { FinalCta } from './sections/FinalCta'

/**
 * The public home page.
 *
 * Order is the argument: what it is (Hero), the problem (MakeSense), how it
 * works (CoreFlow), proof it exists (Showcase), what it covers (Subjects),
 * the part parents worry about most (AiTutor), the outcome (Progress), the
 * parent case (ForParents), safety, why it is built here, what it costs, and
 * one closing ask. Each section is its own file so a section can be reordered
 * or reworked without touching the others.
 */
export function LandingPage() {
  const { t } = useTranslation()

  useSeo({
    title: t('m.seo.title'),
    description: t('m.seo.description'),
    path: '/',
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: 'StudyLegends',
      url: 'https://studylegends.co.za/',
      description: t('m.seo.description'),
      areaServed: { '@type': 'Country', name: 'South Africa' },
      availableLanguage: ['en', 'af'],
    },
  })

  return (
    <MarketingShell surface="dark">
      <Hero />
      <MakeSense />
      <CoreFlow />
      <Showcase />
      <Subjects />
      <AiTutor />
      <Progress />
      <ForParents />
      <Safety />
      <LocalPositioning />
      <PricingSection />
      <FinalCta />
    </MarketingShell>
  )
}
