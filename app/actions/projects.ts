'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createNotification } from './notifications'

export async function getProjects() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        client: {
          select: { id: true, name: true, company_name: true }
        },
        teamLead: {
          select: { id: true, name: true }
        },
        invoices: {
          select: {
            id: true,
            invoice_number: true,
            final_billing: true,
            amount_received: true,
            invoice_date: true,
            due_date: true,
            payment_date: true,
            payment_mode: true,
            status: true,
            notes: true,
          },
          orderBy: { invoice_date: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return projects.map(p => ({
      ...p,
      team_lead: p.teamLead ? { id: p.teamLead.id, full_name: p.teamLead.name } : null
    }))
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export async function deleteProject(id: string) {
  try {
    const project = await prisma.project.delete({
      where: { id }
    })
    
    const session = await auth()
    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'project_update',
        title: 'Project Deleted',
        message: `Successfully deleted project: ${project.name}`,
        link: '/projects'
      })
    }

    revalidatePath('/projects')
    return { success: true }
  } catch (error) {
    console.error('Error deleting project:', error)
    return { success: false, error: 'Failed to delete project' }
  }
}

import { auth } from '@/auth'

export async function createProject(data: any) {
  try {
    const session = await auth()
    const project_code = `PRJ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    
    // Extract relation IDs and other fields
    const { client_id, team_lead_id, deliverable_urls, ...restData } = data

    const project = await prisma.project.create({
      data: {
        ...restData,
        project_code,
        created_by: session?.user?.id,
        deliverable_urls: deliverable_urls || [],
        ...(client_id ? { client: { connect: { id: client_id } } } : {}),
        ...(team_lead_id ? { teamLead: { connect: { id: team_lead_id } } } : {})
      }
    })
    
    // Notify the team lead if they are assigned and they are not the creator
    if (team_lead_id && team_lead_id !== session?.user?.id) {
      await createNotification({
        user_id: team_lead_id,
        type: 'project_assigned',
        title: 'Assigned as Team Lead',
        message: `You have been assigned as the team lead for project: ${restData.name}`,
        link: '/projects'
      })
    }
    
    // Automatically record a SalesClosure if there's an active target for this service type this month
    if (restData.service_type) {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      
      const sTypes = restData.service_type.split(',').map((s: string) => s.trim())
      for (const sType of sTypes) {
        if (!sType) continue
        const target = await prisma.salesTarget.findFirst({
          where: {
            service_type: sType,
            month: currentMonth,
            year: currentYear
          }
        })

        if (target) {
          await prisma.salesClosure.create({
            data: {
              target_id: target.id,
              closed_by: session?.user?.id,
              client_id: client_id || undefined,
              project_id: project.id,
            }
          })
        }
      }
    }

    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'project_update',
        title: 'Project Created',
        message: `Successfully created project: ${project.name}`,
        link: '/projects'
      })
    }

    revalidatePath('/projects')
    revalidatePath('/targets') // Revalidate targets page as well
    revalidatePath('/') // Dashboard might also show targets
    return { success: true, project }
  } catch (error) {
    console.error('Error creating project:', error)
    return { success: false, error: 'Failed to create project' }
  }
}

export async function updateProject(id: string, data: any) {
  try {
    const { client_id, team_lead_id, deliverable_urls, ...restData } = data

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...restData,
        deliverable_urls: deliverable_urls || [],
        ...(client_id !== undefined ? { client: client_id ? { connect: { id: client_id } } : { disconnect: true } } : {}),
        ...(team_lead_id !== undefined ? { teamLead: team_lead_id ? { connect: { id: team_lead_id } } : { disconnect: true } } : {})
      }
    })

    const session = await auth()
    if (session?.user?.id) {
      await createNotification({
        user_id: session.user.id,
        type: 'project_update',
        title: 'Project Updated',
        message: `Successfully updated project: ${project.name}`,
        link: '/projects'
      })
    }

    revalidatePath('/projects')
    return { success: true, project }
  } catch (error) {
    console.error('Error updating project:', error)
    return { success: false, error: 'Failed to update project' }
  }
}
