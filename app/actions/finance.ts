'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

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

export async function createInvoice(data: any) {
  try {
    const session = await auth()
    const { project_id, client_id, ...restData } = data
    const invoice_number = `INV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    const invoice = await prisma.invoice.create({
      data: {
        ...restData,
        invoice_number,
        ...(project_id ? { project: { connect: { id: project_id } } } : {}),
        ...(client_id ? { client: { connect: { id: client_id } } } : {}),
        created_by: session?.user?.id
      }
    })
    revalidatePath('/invoices')
    return { success: true, invoice }
  } catch (error) {
    console.error('Error creating invoice:', error)
    return { success: false, error: 'Failed to create invoice' }
  }
}

export async function updateInvoice(id: string, data: any) {
  try {
    const { project_id, client_id, ...restData } = data

    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        ...restData,
        ...(project_id !== undefined ? { project: project_id ? { connect: { id: project_id } } : { disconnect: true } } : {}),
        ...(client_id !== undefined ? { client: client_id ? { connect: { id: client_id } } : { disconnect: true } } : {})
      }
    })
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

  return expense
}
