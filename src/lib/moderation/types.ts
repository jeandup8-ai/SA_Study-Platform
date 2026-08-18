export type ModerationDecision = 'approved' | 'rejected'

/** Internal machine reason codes only. Never shown verbatim to the child — the UI
 * always renders a single generic, friendly message on rejection (see spec section 11). */
export type ModerationReasonCode =
  | 'unsupported_file_type'
  | 'file_too_large'
  | 'suspected_unsafe_content' // a real vision-safety provider flagged the image
  | 'gps_location_detected' // real EXIF GPS metadata found in the photo
  | 'suspected_pii' // reserved for a future OCR/PII-detection pass on the image/PDF text
  | 'moderation_provider_error' // the safety provider call failed — treated as a rejection, not a pass
  | 'demo_simulated_rejection'

export interface ModerationResult {
  decision: ModerationDecision
  reasonCodes: ModerationReasonCode[]
  /** Did a real visual-safety model actually run, or only structural checks
   * (file type/size, EXIF GPS)? Lets the UI be honest about what was checked. */
  visualSafetyChecked: boolean
}

export interface ModerationProvider {
  /** Name recorded on the moderation_logs row, so swapping providers is auditable. */
  readonly name: string
  moderateFile(file: File, options?: { simulateUnsafe?: boolean }): Promise<ModerationResult>
}
