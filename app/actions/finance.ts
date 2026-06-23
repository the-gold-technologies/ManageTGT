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
        ...(project_id ? { project: { connect: { id: project_id } } } : {}),
        ...(client_id ? { client: { connect: { id: client_id } } } : {}),
        created_by: session?.user?.id
      }
    })

    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'finance_update',
        title: 'Invoice Created',
        message: `Successfully created invoice: ${invoice.invoice_number}`,
        link: '/finance/revenue'
      })
    }

    revalidatePath('/invoices')
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
        project: project_id ? { connect: { id: project_id } } : { disconnect: true },
        client: client_id ? { connect: { id: client_id } } : { disconnect: true }
      }
    })

    const session = await auth()
    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'finance_update',
        title: 'Invoice Updated',
        message: `Successfully updated invoice: ${invoice.invoice_number}`,
        link: '/finance/revenue'
      })
    }

    revalidatePath('/invoices')
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

  const session = await auth()
  if (session?.user?.id) {
    await createNotification({
      user_id: session.user.id,
      type: 'finance_update',
      title: 'Expense Logged',
      message: `Successfully logged a new expense for ${amount}.`,
      link: '/finance/expenses'
    })
  }

  return expense
}

export async function deleteInvoice(id: string) {
  try {
    const invoice = await prisma.invoice.delete({
      where: { id }
    })
    const session = await auth()
    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'finance_update',
        title: 'Invoice Deleted',
        message: `Successfully deleted invoice: ${invoice.invoice_number}`,
        link: '/finance/revenue'
      })
    }
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

    const session = await auth()
    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'finance_update',
        title: 'Expense Updated',
        message: `Successfully updated an expense.`,
        link: '/finance/expenses'
      })
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
    const session = await auth()
    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'finance_update',
        title: 'Expense Deleted',
        message: `Successfully deleted an expense.`,
        link: '/finance/expenses'
      })
    }
    revalidatePath('/finance/expenses')
    return { success: true }
  } catch (error) {
    console.error('Error deleting expense:', error)
    return { success: false, error: 'Failed to delete expense' }
  }
}


