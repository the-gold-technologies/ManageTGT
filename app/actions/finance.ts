'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from './notifications'

export async function getExpenses() {
  try {
    const expenses = await prisma.expense.findMany({
      include: {
        project: {
          select: { id: true, name: true, project_code: true }
        }
      },
      orderBy: { date: 'desc' }
    })
    return expenses
  } catch (error) {
    console.error('Error fetching expenses:', error)
    return []
  }
}

export async function getInvoices() {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        project: {
          select: { id: true, name: true, project_code: true }
        },
        client: {
          select: { id: true, name: true }
        },
        payments: {
          orderBy: { payment_date: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return invoices
  } catch (error) {
    console.error('Error fetching invoices:', error)
    return []
  }
}

import { auth } from '@/auth'

export async function createInvoice(formData: FormData) {
  try {
    const session = await auth()
    const invoice_number = formData.get('invoice_number') as string
    const project_id = formData.get('project_id') as string || null
    const client_id = formData.get('client_id') as string || null
    const quoted_value = parseFloat(formData.get('quoted_value') as string || '0')
    const final_billing = parseFloat(formData.get('final_billing') as string || '0')
    const amount_received = parseFloat(formData.get('amount_received') as string || '0')
    const invoice_date = new Date(formData.get('invoice_date') as string)
    const due_date = formData.get('due_date') ? new Date(formData.get('due_date') as string) : null
    const payment_date = formData.get('payment_date') ? new Date(formData.get('payment_date') as string) : null
    const payment_mode = formData.get('payment_mode') as any || null
    const status = formData.get('status') as any || 'pending'
    const notes = formData.get('notes') as string || null
    const gst_applied = formData.get('gst_applied') === 'true'

    const files = formData.getAll('files') as File[]
    const file_urls: string[] = []

    if (files && files.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      for (const file of files) {
        if (file.size === 0) continue
        
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `invoices/${fileName}`
        
        const buffer = Buffer.from(await file.arrayBuffer())

        const { error: uploadError } = await supabase.storage.from('agencyos_files').upload(filePath, buffer, {
          contentType: file.type
        })
        
        if (uploadError) {
          console.error('Upload Error:', uploadError)
          continue
        }
        
        const { data: publicUrlData } = supabase.storage.from('agencyos_files').getPublicUrl(filePath)
        file_urls.push(publicUrlData.publicUrl)
      }
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoice_number,
        quoted_value,
        final_billing,
        amount_received,
        invoice_date,
        due_date,
        payment_date,
        payment_mode,
        status,
        notes,
        file_urls,
        gst_applied,
        ...(project_id ? { project: { connect: { id: project_id } } } : {}),
        ...(client_id ? { client: { connect: { id: client_id } } } : {}),
        created_by: session?.user?.id
      }
    })

    // Sync newly uploaded files to FileRecord
    if (files && files.length > 0) {
      const syncData = []
      for (const file of files) {
        if (file.size === 0) continue
        const fileExt = file.name.split('.').pop()
        const matchingUrl = file_urls.find(u => u.includes(fileExt!))
        if (matchingUrl) {
          const storagePath = matchingUrl.split('/agencyos_files/')[1] || matchingUrl
          syncData.push({
            name: file.name,
            url: matchingUrl,
            storage_path: storagePath,
            size: file.size,
            mime_type: file.type,
            category: 'invoice_docs' as const,
            invoice_id: invoice.id,
            uploaded_by: session?.user?.id ?? null,
            uploader_name: session?.user?.name ?? null,
          })
        }
      }
      if (syncData.length > 0) {
        try {
          await prisma.fileRecord.createMany({ data: syncData })
        } catch (e) {
          console.warn('FileRecord sync failed for invoice:', e)
        }
      }
    }

    revalidatePath('/finance/revenue')
    return { success: true, invoice }
  } catch (error) {
    console.error('Error creating invoice:', error)
    return { success: false, error: 'Failed to create invoice' }
  }
}

export async function updateInvoice(id: string, formData: FormData) {
  try {
    const project_id = formData.get('project_id') as string || null
    const client_id = formData.get('client_id') as string || null
    const invoice_number = formData.get('invoice_number') as string
    const quoted_value = parseFloat(formData.get('quoted_value') as string || '0')
    const final_billing = parseFloat(formData.get('final_billing') as string || '0')
    const amount_received = parseFloat(formData.get('amount_received') as string || '0')
    const invoice_date = new Date(formData.get('invoice_date') as string)
    const due_date = formData.get('due_date') ? new Date(formData.get('due_date') as string) : null
    const payment_date = formData.get('payment_date') ? new Date(formData.get('payment_date') as string) : null
    const payment_mode = formData.get('payment_mode') as any || null
    const status = formData.get('status') as any || 'pending'
    const notes = formData.get('notes') as string || null
    const gst_applied = formData.get('gst_applied') === 'true'

    const files = formData.getAll('files') as File[]
    const file_urls: string[] = []

    const existing = await prisma.invoice.findUnique({ where: { id } })
    if (existing && Array.isArray(existing.file_urls)) {
      file_urls.push(...existing.file_urls)
    }

    if (files && files.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      for (const file of files) {
        if (file.size === 0) continue
        
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `invoices/${fileName}`
        
        const buffer = Buffer.from(await file.arrayBuffer())

        const { error: uploadError } = await supabase.storage.from('agencyos_files').upload(filePath, buffer, {
          contentType: file.type
        })
        
        if (uploadError) {
          console.error('Upload Error:', uploadError)
          continue
        }
        
        const { data: publicUrlData } = supabase.storage.from('agencyos_files').getPublicUrl(filePath)
        file_urls.push(publicUrlData.publicUrl)
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        invoice_number,
        quoted_value,
        final_billing,
        amount_received,
        invoice_date,
        due_date,
        payment_date,
        payment_mode,
        status,
        notes,
        file_urls,
        gst_applied,
        project: project_id ? { connect: { id: project_id } } : { disconnect: true },
        client: client_id ? { connect: { id: client_id } } : { disconnect: true }
      }
    })

    // Sync newly uploaded files to FileRecord
    const newlyUploaded = file_urls.filter((u: string) => !(existing?.file_urls ?? []).includes(u))
    if (newlyUploaded.length > 0) {
      const syncData = newlyUploaded.map((url: string) => ({
        name: url.split('/').pop() || 'file',
        url,
        storage_path: url.split('/agencyos_files/')[1] || url,
        category: 'invoice_docs' as const,
        invoice_id: id,
        uploaded_by: null as string | null,
        uploader_name: null as string | null,
      }))
      try {
        await prisma.fileRecord.createMany({ data: syncData })
      } catch (e) {
        console.warn('FileRecord sync failed for invoice update:', e)
      }
    }

    revalidatePath('/finance/revenue')
    return { success: true, invoice }
  } catch (error) {
    console.error('Error updating invoice:', error)
    return { success: false, error: 'Failed to update invoice' }
  }
}

// NextAuth replacement for addExpense
export async function addExpense(formData: FormData) {
  const expense_type = formData.get('expense_type') as string
  const amount = parseFloat(formData.get('amount') as string)
  const date = new Date(formData.get('date') as string)
  const project_id = formData.get('project_id') as string || null
  const description = formData.get('description') as string
  const created_by = formData.get('created_by') as string
  
  const files = formData.getAll('files') as File[]
  const bill_urls: string[] = []

  if (files && files.length > 0) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY! // need service role to bypass RLS since user is not logged into Supabase Auth
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    for (const file of files) {
      if (file.size === 0) continue
      
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
      const filePath = `receipts/${fileName}`
      
      const buffer = Buffer.from(await file.arrayBuffer())

      const { error: uploadError } = await supabase.storage.from('agencyos_files').upload(filePath, buffer, {
        contentType: file.type
      })
      
      if (uploadError) {
        console.error('Upload Error:', uploadError)
        continue
      }
      
      const { data: publicUrlData } = supabase.storage.from('agencyos_files').getPublicUrl(filePath)
      bill_urls.push(publicUrlData.publicUrl)
    }
  }

  const expense = await prisma.expense.create({
    data: {
      expense_type: expense_type as any,
      amount,
      date,
      project_id,
      description,
      created_by,
      bill_urls,
    }
  })

  // Sync bill files to FileRecord
  if (bill_urls.length > 0) {
    const syncData = bill_urls.map((url: string) => ({
      name: url.split('/').pop() || 'receipt',
      url,
      storage_path: url.split('/agencyos_files/')[1] || url,
      category: 'bill_receipt' as const,
      expense_id: expense.id,
      uploaded_by: created_by || null,
      uploader_name: null as string | null,
    }))
    try {
      await prisma.fileRecord.createMany({ data: syncData })
    } catch (e) {
      console.warn('FileRecord sync failed for expense:', e)
    }
  }

  return expense
}

export async function deleteInvoice(id: string) {
  try {
    const invoice = await prisma.invoice.delete({
      where: { id }
    })
    revalidatePath('/finance/revenue')
    return { success: true }
  } catch (error) {
    console.error('Error deleting invoice:', error)
    return { success: false, error: 'Failed to delete invoice' }
  }
}

export async function updateExpense(id: string, formData: FormData) {
  try {
    const expense_type = formData.get('expense_type') as string
    const amount = parseFloat(formData.get('amount') as string)
    const date = new Date(formData.get('date') as string)
    const project_id = formData.get('project_id') as string || null
    const description = formData.get('description') as string
    
    const files = formData.getAll('files') as File[]
    const bill_urls: string[] = []
    
    const existing = await prisma.expense.findUnique({ where: { id } })
    if (existing) {
      bill_urls.push(...existing.bill_urls)
    }

    if (files && files.length > 0) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      for (const file of files) {
        if (file.size === 0) continue
        
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`
        const filePath = `receipts/${fileName}`
        
        const buffer = Buffer.from(await file.arrayBuffer())

        const { error: uploadError } = await supabase.storage.from('agencyos_files').upload(filePath, buffer, {
          contentType: file.type
        })
        
        if (uploadError) {
          console.error('Upload Error:', uploadError)
          continue
        }
        
        const { data: publicUrlData } = supabase.storage.from('agencyos_files').getPublicUrl(filePath)
        bill_urls.push(publicUrlData.publicUrl)
      }
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        expense_type: expense_type as any,
        amount,
        date,
        project_id,
        description,
        bill_urls,
      }
    })

    // Sync newly added bill files to FileRecord
    const prevUrls = (existing?.bill_urls ?? []) as string[]
    const newUrls = bill_urls.filter((u: string) => !prevUrls.includes(u))
    if (newUrls.length > 0) {
      const syncData = newUrls.map((url: string) => ({
        name: url.split('/').pop() || 'receipt',
        url,
        storage_path: url.split('/agencyos_files/')[1] || url,
        category: 'bill_receipt' as const,
        expense_id: id,
        uploaded_by: null as string | null,
        uploader_name: null as string | null,
      }))
      try {
        await prisma.fileRecord.createMany({ data: syncData })
      } catch (e) {
        console.warn('FileRecord sync failed for expense update:', e)
      }
    }

    revalidatePath('/finance/expenses')
    return { success: true, expense }
  } catch (error) {
    console.error('Error updating expense:', error)
    return { success: false, error: 'Failed to update expense' }
  }
}

export async function deleteExpense(id: string) {
  try {
    await prisma.expense.delete({
      where: { id }
    })
    revalidatePath('/finance/expenses')
    return { success: true }
  } catch (error) {
    console.error('Error deleting expense:', error)
    return { success: false, error: 'Failed to delete expense' }
  }
}

export async function recordInvoicePayment(invoiceId: string, data: { amount: number, payment_date: string, payment_mode: string, notes?: string }) {
  try {
    const session = await auth()
    
    const invoice = await prisma.invoice.findUnique({ 
      where: { id: invoiceId },
      include: { payments: true }
    })

    if (invoice && invoice.payments.length === 0 && invoice.amount_received > 0) {
      await prisma.invoicePayment.create({
        data: {
          invoice_id: invoiceId,
          amount: invoice.amount_received,
          payment_date: invoice.payment_date || invoice.invoice_date || new Date(),
          payment_mode: invoice.payment_mode || 'other',
          notes: 'Initial Record',
          recorded_by: session?.user?.id
        }
      })
    }

    // Create the new payment record
    await prisma.invoicePayment.create({
      data: {
        invoice_id: invoiceId,
        amount: data.amount,
        payment_date: new Date(data.payment_date),
        payment_mode: data.payment_mode as any,
        notes: data.notes || '',
        recorded_by: session?.user?.id
      }
    })

    // Re-calculate total amount received
    const allPayments = await prisma.invoicePayment.findMany({
      where: { invoice_id: invoiceId }
    })
    const totalReceived = allPayments.reduce((sum, p) => sum + p.amount, 0)
    
    if (invoice) {
      let newStatus = invoice.status
      if (totalReceived >= invoice.final_billing) {
        newStatus = 'paid'
      } else if (totalReceived > 0) {
        newStatus = 'partially_paid'
      }

      await prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          amount_received: totalReceived,
          status: newStatus,
          payment_date: new Date(data.payment_date) // Keep the latest payment date on the invoice
        }
      })
    }

    revalidatePath('/finance/revenue')
    revalidatePath('/projects')
    return { success: true }
  } catch (error) {
    console.error('Error recording payment:', error)
    return { success: false, error: 'Failed to record payment' }
  }
}

export async function generateNextInvoice(projectId: string) {
  try {
    const session = await auth()
    
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { invoices: { orderBy: { invoice_date: 'desc' }, take: 1 } }
    })
    
    if (!project || project.billing_cycle === 'ONE_TIME' || !project.next_billing_date) {
      return { success: false, error: 'Project is not eligible for recurring invoices' }
    }

    let invoice_number = `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    if (project.invoices && project.invoices.length > 0) {
      const lastInvoiceNumber = project.invoices[0].invoice_number
      const match = lastInvoiceNumber.match(/^(.*?)(\d+)$/)
      if (match) {
        const prefix = match[1]
        const numStr = match[2]
        const nextNum = parseInt(numStr, 10) + 1
        const paddedNum = nextNum.toString().padStart(numStr.length, '0')
        invoice_number = `${prefix}${paddedNum}`
      }
    }
    const invoice_date = project.next_billing_date
    const due_date = new Date(invoice_date)
    due_date.setDate(due_date.getDate() + 7) // default 7 days due

    // Generate new invoice
    const newInvoice = await prisma.invoice.create({
      data: {
        invoice_number,
        project_id: projectId,
        client_id: project.client_id,
        quoted_value: project.quoted_price,
        final_billing: project.quoted_price,
        amount_received: 0,
        invoice_date,
        due_date,
        status: 'pending',
        notes: `Recurring ${project.billing_cycle} invoice`,
        created_by: session?.user?.id
      }
    })

    // Advance next_billing_date
    const nextDate = new Date(project.next_billing_date)
    if (project.billing_cycle === 'MONTHLY') {
      nextDate.setMonth(nextDate.getMonth() + 1)
    } else if (project.billing_cycle === 'ANNUAL') {
      nextDate.setFullYear(nextDate.getFullYear() + 1)
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { next_billing_date: nextDate }
    })

    revalidatePath('/finance/invoices')
    revalidatePath('/projects')
    return { success: true, invoice: newInvoice }
  } catch (error) {
    console.error('Error generating next invoice:', error)
    return { success: false, error: 'Failed to generate next invoice' }
  }
}
