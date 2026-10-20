// fontkit ships no type declarations; we only use create() for glyph checks.
declare module 'fontkit' {
  export function create(buffer: Buffer): unknown
}
