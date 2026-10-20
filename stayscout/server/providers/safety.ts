// Safety information. StayScout never scores or labels a place "safe". It
// either links to an official source it actually retrieved, says it found
// nothing in the sources it checked, or says it could not check.
//
// The FCDO adapter uses the public GOV.UK Content API
// (https://www.gov.uk/api/content/foreign-travel-advice/<country-slug>).
// NOT LIVE-TESTED: the build environment could not reach www.gov.uk.

import type {
  Accommodation,
  PlaceCategory,
  SafetyEntry,
  SafetyPanel,
} from '../../shared/types.js'
import { OFFICIAL_ADVISORY_LINKS, SAFETY_DISCLAIMER } from '../../shared/safety-copy.js'
import {
  ProviderError,
  cleanText,
  requestJson,
  safeExternalUrl,
  type FetchLike,
} from './http.js'

export interface SafetyProvider {
  readonly name: string
  readonly live: boolean
  getSafetySources(
    accommodation: Accommodation,
    categories: PlaceCategory[],
  ): Promise<SafetyEntry[]>
}

export class NoSafetyProvider implements SafetyProvider {
  readonly name = 'none'
  readonly live = false
  async getSafetySources(accommodation: Accommodation): Promise<SafetyEntry[]> {
    return [
      {
        status: 'not_checked',
        title: accommodation.isSample
          ? 'Sample destination — no advisory exists'
          : 'Travel advice not checked',
        summary: accommodation.isSample
          ? 'Kestrel Bay is fictional, so there is no official advice to show. In a live guide this panel lists the official sources StayScout retrieved.'
          : 'No safety-information source is configured, so StayScout has not checked official advice for this destination. Use the official sources below.',
        source: null,
        limitations: ['Not checked by StayScout.'],
      },
    ]
  }
}

/** GOV.UK slugs are lower-case, hyphenated country names, with a few exceptions. */
const SLUG_OVERRIDES: Record<string, string> = {
  US: 'usa',
  GB: '',
  CI: 'cote-d-ivoire',
  KR: 'south-korea',
  KP: 'north-korea',
  CZ: 'czech-republic',
  AE: 'united-arab-emirates',
  CD: 'democratic-republic-of-the-congo',
  CG: 'congo',
  VN: 'vietnam',
  LA: 'laos',
  RU: 'russia',
  SY: 'syria',
  IR: 'iran',
  TZ: 'tanzania',
  BO: 'bolivia',
  VE: 'venezuela',
}

export function fcdoSlug(
  countryCode: string | null,
  country: string | null,
): string | null {
  if (countryCode && countryCode in SLUG_OVERRIDES)
    return SLUG_OVERRIDES[countryCode] || null
  if (!country) return null
  const slug = country
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || null
}

export class FcdoSafetyProvider implements SafetyProvider {
  readonly name = 'fcdo'
  readonly live = true
  private readonly fetchImpl: FetchLike
  private readonly now: () => Date

  constructor(fetchImpl: FetchLike = fetch, now: () => Date = () => new Date()) {
    this.fetchImpl = fetchImpl
    this.now = now
  }

  async getSafetySources(accommodation: Accommodation): Promise<SafetyEntry[]> {
    const checkedAt = this.now().toISOString()
    if (accommodation.countryCode === 'GB') {
      return [
        {
          status: 'not_found',
          title: 'FCDO advice covers travel outside the UK',
          summary:
            'The FCDO does not publish foreign travel advice for the United Kingdom itself. Check local authority notices.',
          source: null,
          limitations: ['Country-level source only.'],
        },
      ]
    }
    const slug = fcdoSlug(accommodation.countryCode, accommodation.country)
    if (!slug) {
      return [
        unavailable(
          'The destination country could not be determined from the accommodation record.',
          checkedAt,
        ),
      ]
    }
    const pageUrl = `https://www.gov.uk/foreign-travel-advice/${slug}`
    try {
      const { data } = await requestJson<Record<string, unknown>>({
        provider: 'gov.uk',
        url: `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`,
        fetchImpl: this.fetchImpl,
        timeoutMs: 6000,
      })
      const title = cleanText(data.title, 200) ?? `${accommodation.country} travel advice`
      const publishedAt =
        typeof data.public_updated_at === 'string' ? data.public_updated_at : null
      return [
        {
          status: 'source_retrieved',
          title,
          summary:
            'Official UK government travel advice for this country was retrieved. StayScout does not summarise or interpret it — read the full advice, including any regional warnings, before you travel.',
          source: {
            url: safeExternalUrl(pageUrl),
            publisher: 'UK Foreign, Commonwealth & Development Office (GOV.UK)',
            claim: 'Official foreign travel advice for the destination country',
            checkedAt,
            publishedAt,
            sourceType: 'government',
            status: 'ok',
          },
          limitations: [
            'Country-level advice; it does not assess individual attractions or activities.',
            'Written for British nationals; other governments may advise differently.',
          ],
        },
      ]
    } catch (err) {
      if (err instanceof ProviderError && err.status === 404) {
        return [
          {
            status: 'not_found',
            title: 'No FCDO advice page found for this country name',
            summary:
              'StayScout could not match the destination to an FCDO advice page. This does not mean there is no advice — search the FCDO list directly.',
            source: null,
            limitations: ['Matching is by country name and may miss some territories.'],
          },
        ]
      }
      return [
        unavailable('The GOV.UK travel-advice service could not be reached.', checkedAt),
      ]
    }
  }
}

function unavailable(reason: string, checkedAt: string): SafetyEntry {
  return {
    status: 'unavailable',
    title: 'Travel advice could not be verified',
    summary: `${reason} Safety information has not been verified for this guide; please use the official sources below.`,
    source: {
      url: null,
      publisher: 'UK Foreign, Commonwealth & Development Office (GOV.UK)',
      claim: 'Official foreign travel advice',
      checkedAt,
      publishedAt: null,
      sourceType: 'government',
      status: 'failed',
      error: reason,
    },
    limitations: [],
  }
}

export async function buildSafetyPanel(
  provider: SafetyProvider,
  accommodation: Accommodation,
  categories: PlaceCategory[],
  now: Date,
): Promise<SafetyPanel> {
  return {
    checkedAt: now.toISOString(),
    entries: await provider.getSafetySources(accommodation, categories),
    officialLinks: OFFICIAL_ADVISORY_LINKS,
    disclaimer: SAFETY_DISCLAIMER,
  }
}

export { OFFICIAL_ADVISORY_LINKS, SAFETY_DISCLAIMER }
