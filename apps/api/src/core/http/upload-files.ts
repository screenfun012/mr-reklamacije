export interface UploadFile {
  readonly fileName: string
  readonly data: Buffer
  readonly caption: string | null
}

/**
 * Reads multipart upload files from a FormData body. Accepts `files` and `file` field names and
 * pairs each with an optional `caption` by index. Shared by claim- and submission-attachment
 * upload controllers (lives in core so the two modules don't import each other).
 */
export async function readUploadFiles(formData: FormData): Promise<UploadFile[]> {
  const entries = [...formData.getAll('files'), ...formData.getAll('file')]
  const captions = formData
    .getAll('caption')
    .map((value) => (typeof value === 'string' ? value : null))
  const files: UploadFile[] = []

  for (const [index, entry] of entries.entries()) {
    if (typeof entry === 'string') {
      continue
    }

    const fileName =
      'name' in entry && typeof entry.name === 'string' && entry.name.length > 0
        ? entry.name
        : 'upload'
    const data = Buffer.from(await entry.arrayBuffer())
    files.push({
      fileName,
      data,
      caption: captions[index] ?? null,
    })
  }

  return files
}
