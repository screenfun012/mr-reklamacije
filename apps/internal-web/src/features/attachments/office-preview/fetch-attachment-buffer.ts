export async function fetchAttachmentBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { credentials: 'include' })

  if (!response.ok) {
    throw new Error(`Failed to fetch attachment: ${response.status}`)
  }

  return response.arrayBuffer()
}
