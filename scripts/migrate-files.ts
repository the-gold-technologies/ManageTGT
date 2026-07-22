import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function migrate() {
  console.log('Starting file migration...')

  let added = 0
  let skipped = 0

  async function syncFile(
    url: string,
    contextInfo: any
  ) {
    // Check if exists
    const exists = await prisma.fileRecord.findFirst({
      where: { url }
    })
    if (exists) {
      skipped++
      return
    }

    const name = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Unknown File')
    let storage_path = ''
    try {
      const parts = url.split('agencyos_files/')
      if (parts.length > 1) {
        storage_path = decodeURIComponent(parts[1])
      }
    } catch(e) {}

    const ext = name.split('.').pop()?.toLowerCase() || ''
    let mime_type = 'application/octet-stream'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) mime_type = `image/${ext === 'jpg' ? 'jpeg' : ext}`
    else if (ext === 'pdf') mime_type = 'application/pdf'
    else if (ext === 'docx' || ext === 'doc') mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    await prisma.fileRecord.create({
      data: {
        name,
        url,
        storage_path,
        mime_type,
        ...contextInfo
      }
    })
    added++
  }

  // Clients
  const clients = await prisma.client.findMany({ select: { id: true, document_urls: true, createdBy: true, createdAt: true } })
  for (const c of clients) {
    for (const url of c.document_urls) {
      await syncFile(url, {
        client_id: c.id,
        category: 'reference',
        uploaded_by: c.createdBy,
        source_date: c.createdAt
      })
    }
  }

  // Projects
  const projects = await prisma.project.findMany({ select: { id: true, deliverable_urls: true, created_by: true, createdAt: true } })
  for (const p of projects) {
    for (const url of p.deliverable_urls) {
      await syncFile(url, {
        project_id: p.id,
        category: 'deliverable',
        uploaded_by: p.created_by,
        source_date: p.createdAt
      })
    }
  }

  // Invoices
  const invoices = await prisma.invoice.findMany({ select: { id: true, file_urls: true, created_by: true, createdAt: true, project_id: true, client_id: true } })
  for (const i of invoices) {
    for (const url of i.file_urls) {
      await syncFile(url, {
        invoice_id: i.id,
        project_id: i.project_id,
        client_id: i.client_id,
        category: 'invoice_docs',
        uploaded_by: i.created_by,
        source_date: i.createdAt
      })
    }
  }

  // Expenses
  const expenses = await prisma.expense.findMany({ select: { id: true, bill_urls: true, created_by: true, createdAt: true, project_id: true } })
  for (const e of expenses) {
    for (const url of e.bill_urls) {
      await syncFile(url, {
        expense_id: e.id,
        project_id: e.project_id,
        category: 'bill_receipt',
        uploaded_by: e.created_by,
        source_date: e.createdAt
      })
    }
  }

  // Prospects
  const prospects = await prisma.prospect.findMany({ select: { id: true, document_urls: true, createdAt: true } })
  for (const p of prospects) {
    for (const url of p.document_urls) {
      await syncFile(url, {
        prospect_id: p.id,
        category: 'reference',
        source_date: p.createdAt
      })
    }
  }

  // TaskFiles
  const taskFiles = await prisma.taskFile.findMany({ select: { id: true, task_id: true, file_url: true, file_name: true, file_size: true, uploaded_by: true, uploaded_at: true, task: { select: { project_id: true } } } })
  for (const t of taskFiles) {
    const exists = await prisma.fileRecord.findFirst({ where: { url: t.file_url } })
    if (exists) {
      skipped++
      continue
    }

    let storage_path = ''
    try {
      const parts = t.file_url.split('agencyos_files/')
      if (parts.length > 1) {
        storage_path = decodeURIComponent(parts[1])
      }
    } catch(e) {}

    const ext = t.file_name.split('.').pop()?.toLowerCase() || ''
    let mime_type = 'application/octet-stream'
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) mime_type = `image/${ext === 'jpg' ? 'jpeg' : ext}`
    else if (ext === 'pdf') mime_type = 'application/pdf'
    else if (ext === 'docx' || ext === 'doc') mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

    await prisma.fileRecord.create({
      data: {
        name: t.file_name,
        url: t.file_url,
        storage_path,
        size: t.file_size,
        mime_type,
        task_id: t.task_id,
        project_id: t.task?.project_id,
        category: 'deliverable',
        uploaded_by: t.uploaded_by,
        source_date: t.uploaded_at
      }
    })
    added++
  }

  console.log(`Migration complete! Added: ${added}, Skipped (already exist): ${skipped}`)
}

migrate().catch(console.error).finally(() => prisma.$disconnect())
