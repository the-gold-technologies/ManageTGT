export type ProjectStatus = 'pending' | 'in_progress' | 'on_hold' | 'delivered' | 'completed'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed'
export type Priority = 'low' | 'medium' | 'high' | 'urgent'
export type InvoiceStatus = 'paid' | 'partially_paid' | 'pending' | 'overdue'
export type PaymentMode = 'bank_transfer' | 'upi' | 'cash' | 'cheque' | 'card' | 'other'
export type ExpenseType = 'freelancer' | 'designer' | 'developer' | 'advertising' | 'travel' | 'software' | 'hosting' | 'miscellaneous'

export interface Profile {
  id: string
  full_name: string
  email?: string
  avatar_url?: string
  role: string
  roleId?: string
  createdAt: string
  updatedAt: string
}

export interface Client {
  id: string
  name: string
  company_name?: string
  contact_person?: string
  mobile?: string
  email?: string
  address?: string
  gst_number?: string
  pan_number?: string
  notes?: string
  created_by?: string
  createdAt: string
  updatedAt: string
}

export interface ProjectInvoice {
  id: string
  invoice_number: string
  final_billing: number
  amount_received: number
  invoice_date: string
  due_date?: string
  payment_date?: string
  payment_mode?: PaymentMode
  status: InvoiceStatus
  notes?: string
  payments?: InvoicePayment[]
}

export interface Project {
  id: string
  project_code: string
  name: string
  client_id?: string
  service_type: string
  quoted_price: number
  billing_cycle: 'ONE_TIME' | 'MONTHLY' | 'ANNUAL'
  next_billing_date?: string
  start_date?: string
  expected_completion?: string
  team_lead_id?: string
  assigned_member_ids?: string[]
  status: ProjectStatus
  delivery_date?: string
  completion_date?: string
  deliverable_urls?: string[]
  created_by?: string
  notes?: string
  createdAt: string
  updatedAt: string
  // Joined
  client?: Client
  team_lead?: Profile
  invoices?: ProjectInvoice[]
}

export interface Task {
  id: string
  project_id?: string
  title: string
  description?: string
  assigned_by?: string
  assigned_to?: string
  deadline?: string
  completion_date?: string
  status: TaskStatus
  priority: Priority
  createdAt: string
  updatedAt: string
  // Joined
  project?: Project
  assignee?: Profile
  assigner?: Profile
  files?: TaskFile[]
  logs?: ActivityLog[]
}

export interface TaskFile {
  id: string
  task_id: string
  file_name: string
  file_url: string
  file_size?: number
  uploaded_by?: string
  uploaded_at: string
}

export interface ActivityLog {
  id: string
  task_id?: string
  project_id?: string
  action: string
  performed_by?: string
  metadata?: Record<string, unknown>
  performed_at: string
  performer?: Profile
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  amount: number
  payment_date: string
  payment_mode: PaymentMode
  notes?: string
  recorded_by?: string
  createdAt: string
}

export interface Invoice {
  id: string
  invoice_number: string
  project_id?: string
  client_id?: string
  quoted_value: number
  final_billing: number
  amount_received: number
  invoice_date: string
  due_date?: string
  payment_date?: string
  payment_mode?: PaymentMode
  status: InvoiceStatus
  notes?: string
  created_by?: string
  file_urls?: string[]
  createdAt: string
  updatedAt: string
  // Joined
  project?: Project
  client?: Client
  payments?: InvoicePayment[]
}

export interface Expense {
  id: string
  project_id?: string
  expense_type: ExpenseType
  description?: string
  amount: number
  date: string
  bill_urls?: string[]
  created_by?: string
  createdAt: string
  updatedAt: string
  project?: Project
}

export interface SalesTarget {
  id: string
  service_type: string
  month: number
  year: number
  target_count: number
  average_cost?: number
  created_by?: string
  createdAt: string
  // Computed
  achieved?: number
  remaining?: number
}

export interface SalesClosure {
  id: string
  target_id: string
  closed_by?: string
  client_id?: string
  project_id?: string
  closed_at: string
  notes?: string
  closer?: Profile
  client?: Client
}

// Dashboard summary types
export interface DashboardStats {
  totalRevenue: number
  totalProfit: number
  totalExpenses: number
  activeProjects: number
  completedProjects: number
  pendingPayments: number
  monthlyTarget: { achieved: number; total: number }
  revenueChange: number
  profitChange: number
}

export interface ProjectProfitability {
  project_id: string
  project_name: string
  project_code: string
  client_name: string
  revenue: number
  expenses: number
  profit: number
  margin: number
}

export interface Prospect {
  id: string
  name: string
  email: string
  mobile?: string | null
  company_name?: string | null
  proposal_submitted: boolean
  proposal_submission_date?: string | null
  client_converted: boolean
  createdAt: string
  updatedAt: string
}



