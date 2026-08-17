'use server'

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'text/csv',
  'text/plain',
  'video/mp4',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
]
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

/**
 * Upload a single file via the /api/upload route handler.
 * Using an API route instead of a server action avoids the Next.js server action
 * body size limit (which also includes RSC state and causes 400 errors on production).
 */
export async function uploadFileAction(formData: FormData) {
  const file = formData.get('file') as File | null
  const folder = formData.get('folder') as string

  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided' }
  }
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'File too large. Maximum size is 100MB.' }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'File type not allowed. Please upload a standard document, image, video, audio, or zip file.' }
  }

  // Forward to the API route which has no RSC-state overhead
  try {
    const multiForm = new FormData()
    multiForm.append('files', file)
    multiForm.append('folder', folder)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: multiForm,
    })
    const json = await res.json()
    if (!json.success || !json.urls?.[0]) {
      return { success: false, error: json.error || 'Upload failed' }
    }
    return { success: true, url: json.urls[0] }
  } catch (error: any) {
    console.error('Action Upload Error:', error)
    return { success: false, error: error.message || 'Server error' }
  }
}

/**
 * Upload multiple files via the /api/upload route handler.
 * Using an API route instead of a server action avoids the Next.js server action
 * body size limit (which also includes RSC state and causes 400 errors on production).
 */
export async function uploadMultipleFilesAction(formData: FormData) {
  const files = formData.getAll('files') as File[]
  const folder = formData.get('folder') as string

  if (!files || files.length === 0) {
    return { success: false, error: 'No files provided' }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    return json
  } catch (error: any) {
    console.error('Action Multiple Upload Error:', error)
    return { success: false, error: error.message || 'Server error' }
  }
}
