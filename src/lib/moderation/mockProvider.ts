import type { ModerationProvider, ModerationResult } from './types'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_FILE_BYTES = 15 * 1024 * 1024 // 15MB

/**
 * MOCK PROVIDER — real MIME/size validation only. The genuinely hard part of this
 * pipeline — actually looking at pixels to detect nudity, weapons, self-harm imagery,
 * ID documents, or PII in a photo — requires a real vision-moderation API (e.g. a
 * cloud content-safety service) and is NOT implemented here. That check currently
 * always "passes" once the file-type/size gate clears.
 *
 * `simulateUnsafe` exists only so the rejection UX (spec section 11) can be demonstrated
 * end-to-end without a real provider; it must never be wired to anything but an explicit
 * demo toggle in the UI.
 *
 * Swapping in a real provider means implementing `ModerationProvider` against that
 * vendor's API and changing the export in `index.ts` — nothing else in the app changes.
 */
export const mockModerationProvider: ModerationProvider = {
  name: 'mock',
  async moderateFile(file, options): Promise<ModerationResult> {
    // Simulate network latency so the "checking..." UI state is visible, like a real call would be.
    await new Promise((resolve) => setTimeout(resolve, 900))

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return { decision: 'rejected', reasonCodes: ['unsupported_file_type'] }
    }
    if (file.size > MAX_FILE_BYTES) {
      return { decision: 'rejected', reasonCodes: ['file_too_large'] }
    }
    if (options?.simulateUnsafe) {
      return { decision: 'rejected', reasonCodes: ['demo_simulated_rejection'] }
    }
    return { decision: 'approved', reasonCodes: [] }
  },
}
