import ExpensesClient from '@/components/finance/expenses-client'
import { getExpenses } from '@/app/actions/finance'
import { getProjects } from '@/app/actions/projects'
import type { Expense, Project } from '@/types'

export default async function ExpensesPage() {
  const expenses = await getExpenses()
  const projects = await getProjects()

  return (
    <ExpensesClient 
      initialExpenses={(expenses as unknown as Expense[]) ?? []} 
      projects={(projects as unknown as Project[]) ?? []} 
    />
  )
}
