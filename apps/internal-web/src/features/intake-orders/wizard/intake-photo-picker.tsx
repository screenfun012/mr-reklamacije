import { useRef, type ReactElement } from 'react'

/**
 * The camera and the gallery, as two native file inputs plus the two calls that open them.
 *
 * Native inputs, never `getUserMedia`: that demands a secure context, and the tablet reaches the
 * dev server over plain http on the hall LAN (docs/25 §3.8). `capture` is what opens the camera
 * directly — the gallery input is the same element WITHOUT it, which is the whole difference
 * between the two buttons.
 *
 * A hook that hands back its own elements, because both call sites need the pair mounted somewhere
 * of their own choosing: the wizard puts them under its grid, the detail tab under its card.
 */
export function useIntakePhotoPicker(onPick: (files: readonly File[]) => void): {
  openCamera: () => void
  openGallery: () => void
  inputs: ReactElement
} {
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
          accept="image/*"
          multiple
          hidden
          onChange={() => pick(galleryRef.current)}
        />
      </>
    ),
  }
}
