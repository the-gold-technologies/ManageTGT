'use server'

import { createClient } from '@supabase/supabase-js'

export async function uploadFileAction(formData: FormData) {
  const file = formData.get('file') as File | null
  const folder = formData.get('folder') as string

  if (!file || file.size === 0) {
    return { success: false, error: 'No file provided' }
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

    for (const file of files) {
      if (file.size === 0) continue

      const fileExt = file.name.split('.').pop()
      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${Math.random().toString(36).substring(2, 10)}_${Date.now()}_${originalName}`
      const filePath = `${folder}/${fileName}`
      
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabase.storage.from('agencyos_files').upload(filePath, buffer, {
        contentType: file.type
      })
      
      if (uploadError) {
        console.error('Upload Error:', uploadError)
        continue // Skip to the next file if one fails, or we could throw
      }
      
      const { data: publicUrlData } = supabase.storage.from('agencyos_files').getPublicUrl(filePath)
      uploadedUrls.push(publicUrlData.publicUrl)
    }
    
    return { success: true, urls: uploadedUrls }
  } catch (error: any) {
    console.error('Action Multiple Upload Error:', error)
    return { success: false, error: error.message || 'Server error' }
  }
}
