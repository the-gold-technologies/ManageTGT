import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { auth } from '@/auth'

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

export const config = {
  api: {
    bodyParser: false,
  },
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    const folder = formData.get('folder') as string

    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, error: 'No files provided' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const uploadedUrls: string[] = []
    const errors: string[] = []

    for (const file of files) {
      if (!file || file.size === 0) continue

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: too large (max 100MB)`)
        continue
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: file type not supported`)
        continue
      }

      const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const fileName = `${Math.random().toString(36).substring(2, 10)}_${Date.now()}_${originalName}`
      const filePath = `${folder}/${fileName}`

      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabase.storage
        .from('agencyos_files')
        .upload(filePath, buffer, { contentType: file.type })

      if (uploadError) {
        console.error('Upload Error:', uploadError)
        errors.push(`${file.name}: upload failed`)
        continue
      }

      const { data: publicUrlData } = supabase.storage
        .from('agencyos_files')
        .getPublicUrl(filePath)

      uploadedUrls.push(publicUrlData.publicUrl)
    }

    if (uploadedUrls.length === 0 && errors.length > 0) {
      return NextResponse.json({ success: false, error: errors.join('; ') }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      urls: uploadedUrls,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error('API Upload Error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 })
  }
}
