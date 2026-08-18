export type ModerationDecision = 'approved' | 'rejected'

/** Internal machine reason codes only. Never shown verbatim to the child — the UI
 * always renders a single generic, friendly message on rejection (see spec section 11). */
export type ModerationReasonCode =
  | 'unsupported_file_type'
  | 'file_too_large'
  | 'suspected_unsafe_content' // reserved for a real vision-safety provider's verdict
  | 'suspected_pii' // reserved for a real PII-detection provider's verdict
  | 'demo_simulated_rejection'

export interface ModerationResult {
  decision: ModerationDecision
  reasonCodes: ModerationReasonCode[]
}

export interface ModerationProvider {
  /** Name recorded on the moderation_logs row, so swapping providers is auditable. */
  readonly name: string
  moderateFile(file: File, options?: { simulateUnsafe?: boolean }): Promise<ModerationResult>
}
