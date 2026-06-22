import ExpensesClient from '@/components/finance/expenses-client'

export default function ExpensesPage() {
  return (
    <ExpensesClient
      initialExpenses={[]}
      projects={[]}
    />
  )
}
