import ExpensesClient from '@/components/finance/expenses-client'
import { verifyModuleAccess } from '@/app/actions/access'

export default async function ExpensesPage() {
  await verifyModuleAccess('expenses')
  return (
    <ExpensesClient
      initialExpenses={[]}
      projects={[]}
    />
  )
}
