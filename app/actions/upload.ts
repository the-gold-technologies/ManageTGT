'use server'

import { createClient } from '@supabase/supabase-js'

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
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function uploadFileAction(formData: FormData) {
  const file = formData.get('file') as File | null
  const folder = formData.get('folder') as string

  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided' }
  }

  // Server-side validation
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: 'File too large. Maximum size is 10MB.' }
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'File type not allowed. Use PDF, Word, Excel, or image files.' }
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
    const filePath = `${folder}/${fileName}`
    
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage.from('agencyos_files').upload(filePath, buffer, {
      contentType: file.type
    })
    
    if (uploadError) {
      console.error('Upload Error:', uploadError)
      return { success: false, error: 'Failed to upload file to storage' }
    }
    
    const { data: publicUrlData } = supabase.storage.from('agencyos_files').getPublicUrl(filePath)
    
    return { success: true, url: publicUrlData.publicUrl }
  } catch (error: any) {
    console.error('Action Upload Error:', error)
    return { success: false, error: error.message || 'Server error' }
  }
}

export async function uploadMultipleFilesAction(formData: FormData) {
  const files = formData.getAll('files') as File[]
  const folder = formData.get('folder') as string

  if (!files || files.length === 0) {
    return { success: false, error: 'No files provided' }
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    const uploadedUrls: string[] = []
    const errors: string[] = []

    for (const file of files) {
      if (file.size === 0) continue

      // Server-side validation per file
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: too large (max 10MB)`)
        continue
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: type not allowed`)
        continue
      }

      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${Math.random().toString(36).substring(2, 10)}_${Date.now()}_${originalName}`
      const filePath = `${folder}/${fileName}`
      
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabase.storage.from('agencyos_files').upload(filePath, buffer, {
        contentType: file.type
      })
      
      if (uploadError) {
        console.error('Upload Error:', uploadError)
        errors.push(`${file.name}: upload failed`)
        continue
      }
      
      const { data: publicUrlData } = supabase.storage.from('agencyos_files').getPublicUrl(filePath)
      uploadedUrls.push(publicUrlData.publicUrl)
    }
    
    if (uploadedUrls.length === 0 && errors.length > 0) {
      return { success: false, error: errors.join('; ') }
    }
    
    return { success: true, urls: uploadedUrls, errors: errors.length > 0 ? errors : undefined }
  } catch (error: any) {
    console.error('Action Multiple Upload Error:', error)
    return { success: false, error: error.message || 'Server error' }
  }
}
