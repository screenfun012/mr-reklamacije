import { useRef, type ReactElement } from 'react'

/**
 * The camera and the gallery, as two native file inputs plus the two calls that open them.
 *
 * Native inputs, never `getUserMedia`: that demands a secure context, and the tablet reaches the
 * dev server over plain http on the hall LAN (docs/25 §3.8). On top of that the apps send
 * `permissions-policy: camera=()`, so an in-page preview is refused outright. `capture` is what
 * opens the camera directly — the gallery input is the same element WITHOUT it, which is the whole
 * difference between the two buttons.
 *
 * A hook that hands back its own elements, because every call site needs the pair mounted
 * somewhere of its own choosing: the intake wizard under its grid, the chat inside its composer.
 *
 * ⚠ The CAMERA always takes `image/*`: `capture` opens the camera app, and there is no version of
 * that which returns a PDF. Only the gallery honours `accept`, which is what lets the chat offer
 * documents while the intake keeps taking photographs and nothing about it changes.
 */
export function useFilePicker(
  onPick: (files: readonly File[]) => void,
  options: { accept?: string } = {},
): {
  openCamera: () => void
  openGallery: () => void
  inputs: ReactElement
} {
  const accept = options.accept ?? 'image/*'
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const pick = (input: HTMLInputElement | null): void => {
    const files = input?.files
    if (files !== null && files !== undefined && files.length > 0) {
      onPick([...files])
    }
    if (input !== null) {
      // Cleared, or picking the same file twice in a row fires no change event.
      input.value = ''
    }
  }

  return {
    openCamera: () => cameraRef.current?.click(),
    openGallery: () => galleryRef.current?.click(),
    inputs: (
      <>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          hidden
          onChange={() => pick(cameraRef.current)}
        />
        <input
          ref={galleryRef}
          type="file"
          accept={accept}
          multiple
          hidden
          onChange={() => pick(galleryRef.current)}
        />
      </>
    ),
  }
}
