// Builds a Content-Disposition header value that safely carries a UTF-8 file
// name (RFC 5987 `filename*`) with an ASCII-quoted fallback. The fallback drops
// quotes and control chars (incl. CR/LF) so no caller can inject headers; the
// `filename*` part is percent-encoded, which already escapes control chars.
export function buildAttachmentContentDisposition(fileName: string): string {
  const asciiFallback = Array.from(fileName)
    .filter((char) => {
      const code = char.charCodeAt(0)
      return char !== '"' && code >= 0x20 && code !== 0x7f
    })
    .join('')
  const encoded = encodeURIComponent(fileName)
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}
