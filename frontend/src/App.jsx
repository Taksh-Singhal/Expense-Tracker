import { useCallback, useEffect, useMemo, useState } from 'react'
import { BASE_URL } from './config'
import api from './api'
import DatePickerInput from './DatePickerInput'
import {
  LayoutDashboard,
  CreditCard,
  BarChart3,
  Settings,
  ReceiptText,
  Search,
  Pencil,
  Wallet,
  Trophy,
  Flame,
  Shield,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const INITIAL_CATEGORIES = [
  'Food',
  'Transport',
  'Shopping',
  'Bills',
  'Entertainment',
]

const CUSTOM_CATEGORY_VALUE = '__custom__'

function getCategoryBadgeClass(category) {
  const c = (category || '').toLowerCase()
  if (c === 'food') return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  if (c === 'transport') return 'bg-sky-500/20 text-sky-300 border-sky-500/40'
  if (c === 'shopping') return 'bg-violet-500/20 text-violet-300 border-violet-500/40'
  if (c === 'bills') return 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  if (c === 'entertainment') return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  return 'bg-slate-500/20 text-slate-300 border-slate-500/40'
}

const emptyForm = {
  title: '',
  amount: '',
  category: '',
  date: '',
}

const PIE_COLORS = ['#f59e0b', '#0ea5e9', '#8b5cf6', '#ef4444', '#10b981', '#64748b']

function getBadgeLevel(points, streak) {
  const score = points + streak * 5
  if (score >= 100) return { label: 'Pro Saver', color: 'text-amber-400', bg: 'bg-amber-500/20' }
  if (score >= 30) return { label: 'Saver', color: 'text-emerald-400', bg: 'bg-emerald-500/20' }
  return { label: 'Beginner', color: 'text-sky-400', bg: 'bg-sky-500/20' }
}

function App() {
  const [expenses, setExpenses] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)
  const [monthlySummaryFile, setMonthlySummaryFile] = useState(null)
  const [monthlyUploading, setMonthlyUploading] = useState(false)
  const [dateRange, setDateRange] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [incomeEntries, setIncomeEntries] = useState([])
  const [incomeForm, setIncomeForm] = useState({ source: '', amount: '', date: '' })
  const [editingExpense, setEditingExpense] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [savingsPoints, setSavingsPoints] = useState(() => Number(localStorage.getItem('savingsPoints')) || 0)
  const [savingsStreak, setSavingsStreak] = useState(() => Number(localStorage.getItem('savingsStreak')) || 0)
  const [lastStreakDate, setLastStreakDate] = useState(() => localStorage.getItem('lastStreakDate') || '')
  const [monthlyEmergencyAmount, setMonthlyEmergencyAmount] = useState(() => Number(localStorage.getItem('monthlyEmergencyAmount')) || 0)
  const [emergencySavings, setEmergencySavings] = useState(() => Number(localStorage.getItem('emergencySavings')) || 0)
  const [emergencyUsage, setEmergencyUsage] = useState(() => {
    try {
      const stored = localStorage.getItem('emergencyUsage')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [showUseEmergencyModal, setShowUseEmergencyModal] = useState(false)
  const [useEmergencyForm, setUseEmergencyForm] = useState({ reason: '', amount: '' })
  const [categories, setCategories] = useState(INITIAL_CATEGORIES)
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryInput, setCustomCategoryInput] = useState('')
  const [editIsCustomCategory, setEditIsCustomCategory] = useState(false)
  const [editCustomCategoryInput, setEditCustomCategoryInput] = useState('')

  // --- API integration: fetchExpenses (unchanged endpoint) ---
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await api.get('/expenses')
      setExpenses(response?.data || [])
    } catch (err) {
      setError(err?.message || 'Something went wrong while loading data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchExpenses()
  }, [fetchExpenses])

  const filteredExpenses = useMemo(() => {
    let list = [...expenses]

    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    if (dateRange === 'week') {
      list = list.filter((item) => item.date && new Date(item.date) >= startOfWeek)
    } else if (dateRange === 'month') {
      list = list.filter((item) => item.date && new Date(item.date) >= startOfMonth)
    } else if (dateRange === 'year') {
      list = list.filter((item) => item.date && new Date(item.date) >= startOfYear)
    }

    if (categoryFilter !== 'all') {
      list = list.filter(
        (item) => String(item.category || '').toLowerCase() === categoryFilter.toLowerCase(),
      )
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter((item) => {
        const title = String(item.title || '').toLowerCase()
        const category = String(item.category || '').toLowerCase()
        const amount = String(item.amount ?? '').toLowerCase()
        return title.includes(q) || category.includes(q) || amount.includes(q)
      })
    }

    return list
  }, [expenses, dateRange, categoryFilter, searchQuery])

  const total = useMemo(
    () =>
      filteredExpenses.reduce(
        (acc, item) => acc + (Number(item.amount) || 0),
        0,
      ),
    [filteredExpenses],
  )

  const budget = 1000
  const remaining = Math.max(budget - total, 0)
  const recentActivity = filteredExpenses
    .slice()
    .sort(
      (a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime(),
    )
    .slice(0, 3)

  const dailySpendingData = useMemo(() => {
    const map = new Map()
    filteredExpenses.forEach((item) => {
      const key = item.date ? new Date(item.date).toLocaleDateString() : 'N/A'
      const prev = map.get(key) || 0
      map.set(key, prev + (Number(item.amount) || 0))
    })
    return Array.from(map.entries()).map(([date, amount]) => ({
      date,
      amount,
    }))
  }, [filteredExpenses])

  const totalIncome = useMemo(
    () =>
      incomeEntries.reduce((acc, e) => acc + (Number(e.amount) || 0), 0),
    [incomeEntries],
  )
  const totalExpensesAll = useMemo(
    () => expenses.reduce((acc, item) => acc + (Number(item.amount) || 0), 0),
    [expenses],
  )
  const balance = totalIncome - totalExpensesAll

  const spendingByCategory = useMemo(() => {
    const map = new Map()
    expenses.forEach((item) => {
      const cat = item.category || 'Other'
      map.set(cat, (map.get(cat) || 0) + (Number(item.amount) || 0))
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [expenses])

  const spendingByMonth = useMemo(() => {
    const map = new Map()
    expenses.forEach((item) => {
      if (!item.date) return
      const d = new Date(item.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      map.set(key, (map.get(key) || 0) + (Number(item.amount) || 0))
    })
    return Array.from(map.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }, [expenses])

  useEffect(() => {
    if (totalExpensesAll > budget) {
      setSavingsStreak(0)
      setLastStreakDate('')
      localStorage.setItem('savingsStreak', '0')
      localStorage.removeItem('lastStreakDate')
      return
    }
    const today = new Date().toDateString()
    if (lastStreakDate === today) return
    const nextStreak = lastStreakDate ? savingsStreak + 1 : 1
    setSavingsStreak(nextStreak)
    setLastStreakDate(today)
    localStorage.setItem('savingsStreak', String(nextStreak))
    localStorage.setItem('lastStreakDate', today)
    setSavingsPoints((p) => {
      const next = p + 10
      localStorage.setItem('savingsPoints', String(next))
      return next
    })
  }, [totalExpensesAll, budget])

  const handleChange = (event) => {
    const { name, value } = event.target

    if (name === 'category') {
      if (value === CUSTOM_CATEGORY_VALUE) {
        setIsCustomCategory(true)
        setForm((prev) => ({ ...prev, category: '' }))
      } else {
        setIsCustomCategory(false)
        setCustomCategoryInput('')
        setForm((prev) => ({ ...prev, category: value }))
      }
      return
    }

    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleReceiptChange = (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Only PDF receipts are supported right now.')
      return
    }
    setError('')
    setReceiptFile(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    handleReceiptChange(file)
  }

  const handleMonthlySummaryUpload = async (file) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      setError('Only PDF files are supported for Monthly Summary.')
      return
    }
    setError('')
    setMonthlySummaryFile(file)
  }

  const handleMonthlySummaryDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    handleMonthlySummaryUpload(file)
  }

  const handleDragOver = (event) => {
    event.preventDefault()
  }

  // --- API integration: addExpense (unchanged endpoint & JSON body) ---
  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    // If a Monthly Summary PDF is attached, upload it and refresh expenses.
    if (monthlySummaryFile) {
      try {
        setSubmitting(true)
        setMonthlyUploading(true)
        const formData = new FormData()
        formData.append('file', monthlySummaryFile)
        const response = await api.post('/upload-pdf', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        const processedCount = Array.isArray(response?.data?.transactions)
          ? response.data.transactions.length
          : 0
        console.log('PDF Processed, Refreshing list...')
        await fetchExpenses()
        if (processedCount > 0) {
          alert(`Processed ${processedCount} transactions from PDF`)
        } else {
          alert('PDF processed, but no transactions were found.')
        }
        setMonthlySummaryFile(null)
      } catch (err) {
        setError(err?.message || 'Unable to upload Monthly Summary PDF right now.')
      } finally {
        setSubmitting(false)
        setMonthlyUploading(false)
      }
      return
    }

    // Otherwise, enforce manual field validation for single expense entry.
    const categoryToUse = isCustomCategory ? customCategoryInput.trim() : form.category

    if (!form.title || !form.amount || !categoryToUse || !form.date) {
      setError('Please fill out all fields before submitting.')
      return
    }

    const payload = {
      title: form.title,
      amount: Number(form.amount),
      category: categoryToUse,
      date: form.date,
    }

    try {
      setSubmitting(true)
      const response = await api.post('/expenses', payload)
      const created = response?.data
      const expenseWithId = {
        ...payload,
        // Contract returns `{ message, id }`, so merge the id onto the payload we just sent
        id: created?.id,
      }
      setExpenses((prev) => [...prev, expenseWithId])
      setForm(emptyForm)
      setIsCustomCategory(false)
      setCustomCategoryInput('')
      setReceiptFile(null)

      // If a new custom category was used, add it to the list for this session
      if (isCustomCategory && categoryToUse && !categories.includes(categoryToUse)) {
        setCategories((prev) => [...prev, categoryToUse])
      }
    } catch (err) {
      setError(err?.message || 'Unable to add expense right now.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditOpen = (item) => {
    setEditingExpense(item)
    setEditForm({
      title: item.title || '',
      amount: String(item.amount ?? ''),
      category: item.category || '',
      date: item.date || '',
    })
    // Ensure categories list includes the category we are editing
    if (item.category && !categories.includes(item.category)) {
      setCategories((prev) => [...prev, item.category])
    }
    setEditIsCustomCategory(false)
    setEditCustomCategoryInput('')
    setError('')
  }

  const handleEditChange = (event) => {
    const { name, value } = event.target

    if (name === 'category') {
      if (value === CUSTOM_CATEGORY_VALUE) {
        setEditIsCustomCategory(true)
        setEditForm((prev) => ({ ...prev, category: '' }))
      } else {
        setEditIsCustomCategory(false)
        setEditCustomCategoryInput('')
        setEditForm((prev) => ({ ...prev, category: value }))
      }
      return
    }

    setEditForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditSubmit = async (event) => {
    event.preventDefault()
    if (!editingExpense?.id) return
    setError('')
    const categoryToUse = editIsCustomCategory ? editCustomCategoryInput.trim() : editForm.category

    if (!editForm.title || !editForm.amount || !categoryToUse || !editForm.date) {
      setError('Please fill out all fields before saving.')
      return
    }

    const payload = {
      title: editForm.title,
      amount: Number(editForm.amount),
      category: categoryToUse,
      date: editForm.date,
    }
    try {
      setSubmitting(true)
      await api.put(`/expenses/${editingExpense.id}`, payload)

      // Re-fetch from backend so table + charts stay in sync
      await fetchExpenses()
      setEditingExpense(null)
      setEditForm(emptyForm)
      if (editIsCustomCategory && categoryToUse && !categories.includes(categoryToUse)) {
        setCategories((prev) => [...prev, categoryToUse])
      }
    } catch (err) {
      setError(err?.message || 'Unable to update expense.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteExpense = async (expense) => {
    if (!expense?.id) return
    const confirmed = window.confirm('Delete this expense?')
    if (!confirmed) return

    try {
      setSubmitting(true)
      await api.delete(`/expenses/${expense.id}`)

      // Refresh list and charts after deletion
      await fetchExpenses()
    } catch (err) {
      setError(err?.message || 'Unable to delete expense.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleIncomeSubmit = (event) => {
    event.preventDefault()
    if (!incomeForm.source?.trim() || !incomeForm.amount || !incomeForm.date) return
    setIncomeEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID?.() || Date.now(),
        source: incomeForm.source.trim(),
        amount: Number(incomeForm.amount),
        date: incomeForm.date,
      },
    ])
    setIncomeForm({ source: '', amount: '', date: '' })
  }

  const totalEmergencyUsed = useMemo(
    () => emergencyUsage.reduce((sum, u) => sum + (Number(u.amount) || 0), 0),
    [emergencyUsage],
  )
  const remainingEmergencyBalance = Math.max(emergencySavings - totalEmergencyUsed, 0)

  const handleSetMonthlyEmergency = (amount) => {
    const numAmount = Number(amount) || 0
    setMonthlyEmergencyAmount(numAmount)
    localStorage.setItem('monthlyEmergencyAmount', String(numAmount))
  }

  const handleAddEmergencySavings = (amount) => {
    const numAmount = Number(amount) || 0
    setEmergencySavings((prev) => {
      const next = prev + numAmount
      localStorage.setItem('emergencySavings', String(next))
      return next
    })
  }

  const handleUseEmergencyFunds = (event) => {
    event.preventDefault()
    if (!useEmergencyForm.reason?.trim() || !useEmergencyForm.amount) return
    const amount = Number(useEmergencyForm.amount)
    if (amount <= 0 || amount > remainingEmergencyBalance) {
      setError('Invalid amount or exceeds remaining balance.')
      return
    }
    setEmergencyUsage((prev) => {
      const next = [
        ...prev,
        {
          id: crypto.randomUUID?.() || Date.now(),
          reason: useEmergencyForm.reason.trim(),
          amount,
          date: new Date().toISOString().split('T')[0],
        },
      ]
      localStorage.setItem('emergencyUsage', JSON.stringify(next))
      return next
    })
    setUseEmergencyForm({ reason: '', amount: '' })
    setShowUseEmergencyModal(false)
    setError('')
  }

  const badgeLevel = getBadgeLevel(savingsPoints, savingsStreak)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              Expense
            </p>
            <p className="text-sm font-semibold text-slate-50">Tracker</p>
          </div>
        </div>

        <nav className="mt-2 px-3 space-y-1">
          <button
            type="button"
            onClick={() => setCurrentPage('dashboard')}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              currentPage === 'dashboard' ? 'bg-slate-800 text-slate-50' : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60"
          >
            <CreditCard className="h-4 w-4" />
            <span>Transactions</span>
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage('analytics')}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              currentPage === 'analytics' ? 'bg-indigo-500 text-slate-50 shadow-md shadow-indigo-500/40' : 'text-slate-300 hover:bg-slate-800/60'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Analytics</span>
          </button>
          <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-slate-800/60">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </button>
        </nav>

        <div className="mt-auto px-6 pb-6 text-xs text-slate-500">
          <p className="mb-1 font-medium text-slate-400">Backend</p>
          <p className="truncate font-mono text-[11px] text-slate-500">
            {BASE_URL}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                {currentPage === 'analytics' ? 'Analytics' : 'Dashboard'}
              </p>
              <h1 className="text-lg sm:text-2xl font-semibold text-slate-50">
                {currentPage === 'analytics' ? 'Spending insights' : 'Spending overview'}
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400">
                Powered by{' '}
                <code className="rounded bg-slate-900/80 px-1.5 py-0.5 text-[11px] font-mono text-slate-300">
                  {BASE_URL}
                </code>
              </p>
            </div>

            <div className="hidden sm:flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs text-slate-400">Total spent</span>
                <span className="text-lg font-semibold text-slate-50">
                  ₹{total.toLocaleString()}
                </span>
              </div>
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 text-slate-950 flex items-center justify-center text-xs font-semibold">
                EX
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 mx-auto max-w-6xl px-4 py-6 space-y-6">
          {currentPage === 'analytics' ? (
            /* Analytics page: Pie (% by category) + Bar (total per category) + Bar (by month) */
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Pie: percentage of total spending by category, legend on right */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/50">
                <h2 className="text-sm font-semibold text-slate-100">Category spending distribution</h2>
                <p className="mt-1 text-xs text-slate-500">Percentage of total spending per category (current expenses only)</p>
                <div className="mt-4 h-72">
                  {spendingByCategory.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      No expense data yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={spendingByCategory}
                          dataKey="value"
                          nameKey="name"
                          cx="40%"
                          cy="50%"
                          outerRadius={90}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {spendingByCategory.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#020617',
                            border: '1px solid #1f2937',
                            borderRadius: '0.75rem',
                            fontSize: '0.7rem',
                            color: '#e5e7eb',
                          }}
                          formatter={(value, name, props) => {
                            const total = spendingByCategory.reduce((s, d) => s + d.value, 0)
                            const pct = total ? ((value / total) * 100).toFixed(1) : 0
                            return [`₹${Number(value).toLocaleString()} (${pct}%)`, name]
                          }}
                        />
                        <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ paddingLeft: 16 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Bar: total spending per category */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/50">
                <h2 className="text-sm font-semibold text-slate-100">Total spending per category</h2>
                <p className="mt-1 text-xs text-slate-500">From existing expenses (no new API)</p>
                <div className="mt-4 h-72">
                  {spendingByCategory.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      No expense data yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spendingByCategory} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#020617',
                            border: '1px solid #1f2937',
                            borderRadius: '0.75rem',
                            fontSize: '0.7rem',
                            color: '#e5e7eb',
                          }}
                          formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                          labelFormatter={(label) => `Category: ${label}`}
                        />
                        <Bar dataKey="value" fill="url(#categoryBarGradient)" radius={[6, 6, 0, 0]} name="Spending" />
                        <defs>
                          <linearGradient id="categoryBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={1} />
                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Bar: spending by month */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/50 lg:col-span-2">
                <h2 className="text-sm font-semibold text-slate-100">Spending by month</h2>
                <p className="mt-1 text-xs text-slate-500">From existing expenses (no new API)</p>
                <div className="mt-4 h-72">
                  {spendingByMonth.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      No expense data yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={spendingByMonth} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#020617',
                            border: '1px solid #1f2937',
                            borderRadius: '0.75rem',
                            fontSize: '0.7rem',
                            color: '#e5e7eb',
                          }}
                        />
                        <Bar dataKey="amount" fill="url(#analyticsBarGradient)" radius={[6, 6, 0, 0]} />
                        <defs>
                          <linearGradient id="analyticsBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={1} />
                            <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.3} />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <>
          {/* Stats row */}
          <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400">Total spent</p>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">Live</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-slate-50">₹{total.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">{filteredExpenses.length} transaction(s)</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/40">
              <p className="text-xs font-medium text-slate-400">Total income</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-400">₹{totalIncome.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">{incomeEntries.length} entry(ies)</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/40">
              <p className="text-xs font-medium text-slate-400">Balance</p>
              <p className={`mt-2 text-2xl font-semibold ${balance >= 0 ? 'text-slate-50' : 'text-rose-400'}`}>
                ₹{balance.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">Income − expenses</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/40">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <p className="text-xs font-medium text-slate-400">Savings progress</p>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-lg font-semibold text-slate-50">
                <span className={badgeLevel.color}>{badgeLevel.label}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${badgeLevel.bg} ${badgeLevel.color}`}>
                  <Trophy className="h-3 w-3" /> {savingsPoints} pts
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-orange-300">
                  <Flame className="h-3 w-3" /> {savingsStreak} day streak
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Stay under budget to grow streak</p>
            </div>
          </section>

          {/* Income section */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/50">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-emerald-400" />
              <h2 className="text-sm font-semibold text-slate-100">Income</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Track income in state (no API).</p>
            <form onSubmit={handleIncomeSubmit} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
                Source
                <input
                  value={incomeForm.source}
                  onChange={(e) => setIncomeForm((p) => ({ ...p, source: e.target.value }))}
                  placeholder="e.g. Salary"
                  className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
                Amount
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeForm.amount}
                  onChange={(e) => setIncomeForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="h-9 w-20 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                />
              </label>
              <DatePickerInput
                label="Date"
                value={incomeForm.date}
                onChange={(iso) => setIncomeForm((p) => ({ ...p, date: iso }))}
              />
              <button
                type="submit"
                className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Add income
              </button>
            </form>
            {incomeEntries.length > 0 && (
              <div className="mt-3 max-h-32 overflow-auto rounded-lg border border-slate-800/80 bg-slate-950/40">
                <table className="min-w-full text-left text-xs text-slate-200">
                  <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                    <tr><th className="px-3 py-1.5 font-medium">Source</th><th className="px-3 py-1.5 font-medium text-right">Amount</th><th className="px-3 py-1.5 font-medium">Date</th></tr>
                  </thead>
                  <tbody>
                    {incomeEntries.slice().reverse().slice(0, 10).map((e) => (
                      <tr key={e.id} className="border-t border-slate-800/60">
                        <td className="px-3 py-1.5 text-slate-100">{e.source}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-emerald-300">+₹{Number(e.amount).toLocaleString()}</td>
                        <td className="px-3 py-1.5 text-slate-400">{e.date ? new Date(e.date).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Emergency Fund section */}
          <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-900/60 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/20 p-2.5 border border-emerald-500/30">
                  <Shield className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-50">Emergency Fund</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Separate from regular expenses</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 backdrop-blur">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total Saved</p>
                <p className="mt-2 text-2xl font-bold text-emerald-400">₹{emergencySavings.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-slate-500">Accumulated savings</p>
              </div>
              <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 backdrop-blur">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Total Used</p>
                <p className="mt-2 text-2xl font-bold text-rose-400">₹{totalEmergencyUsed.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-slate-500">{emergencyUsage.length} withdrawal(s)</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 p-4 backdrop-blur">
                <p className="text-[11px] font-medium text-emerald-300 uppercase tracking-wide">Remaining Balance</p>
                <p className="mt-2 text-2xl font-bold text-emerald-300">₹{remainingEmergencyBalance.toLocaleString()}</p>
                <p className="mt-1 text-[11px] text-emerald-400/70">Available for emergencies</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-200">
                Monthly Emergency Fund Amount
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyEmergencyAmount || ''}
                    onChange={(e) => handleSetMonthlyEmergency(e.target.value)}
                    placeholder="e.g. 500"
                    className="h-9 flex-1 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (monthlyEmergencyAmount > 0) {
                        handleAddEmergencySavings(monthlyEmergencyAmount)
                      }
                    }}
                    className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500 transition"
                  >
                    Add This Month
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">Set monthly amount and click to add to savings</p>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowUseEmergencyModal(true)}
                disabled={remainingEmergencyBalance <= 0}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50 transition"
              >
                <AlertCircle className="h-4 w-4" />
                Use Emergency Funds
              </button>
              {emergencyUsage.length > 0 && (
                <div className="flex-1 max-h-32 overflow-auto rounded-lg border border-slate-800/80 bg-slate-950/40">
                  <table className="min-w-full text-left text-xs text-slate-200">
                    <thead className="bg-slate-950/60 text-[11px] text-slate-400">
                      <tr>
                        <th className="px-3 py-1.5 font-medium">Reason</th>
                        <th className="px-3 py-1.5 font-medium text-right">Amount</th>
                        <th className="px-3 py-1.5 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {emergencyUsage.slice().reverse().slice(0, 5).map((u) => (
                        <tr key={u.id} className="border-t border-slate-800/60">
                          <td className="px-3 py-1.5 text-slate-100">{u.reason}</td>
                          <td className="px-3 py-1.5 text-right font-medium text-rose-300">-₹{Number(u.amount).toLocaleString()}</td>
                          <td className="px-3 py-1.5 text-slate-400">{u.date ? new Date(u.date).toLocaleDateString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {/* Main grid: form + chart/table */}
          <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
            {/* Add Expense card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-slate-950/50">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Add expense
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Sends a POST request to{' '}
                    <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] font-mono text-slate-300">
                      /expenses
                    </code>
                    .
                  </p>
                </div>
                <ReceiptText className="h-5 w-5 text-slate-500" />
              </div>

              {error && (
                <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {error}
                </div>
              )}

              <form
                className="mt-4 grid gap-3"
                onSubmit={handleSubmit}
                noValidate
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-200">
                    Title
                    <input
                      name="title"
                      value={form.title}
                      onChange={handleChange}
                      placeholder="e.g., Coffee"
                      className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-200">
                    Amount
                    <input
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.amount}
                      onChange={handleChange}
                      placeholder="e.g., 12.50"
                      className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-200">
                    Category
                    <select
                      name="category"
                      value={isCustomCategory ? CUSTOM_CATEGORY_VALUE : form.category}
                      onChange={handleChange}
                      className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none ring-0 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                      <option value={CUSTOM_CATEGORY_VALUE}>Other...</option>
                    </select>
                    {isCustomCategory && (
                      <input
                        type="text"
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        placeholder="Enter custom category"
                        className="mt-1 h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                      />
                    )}
                  </label>

                  <DatePickerInput
                    label="Date"
                    value={form.date}
                    onChange={(iso) => setForm((prev) => ({ ...prev, date: iso }))}
                  />
                </div>

                {/* Receipt upload drag-and-drop zone */}
                <div className="mt-1">
                  <p className="mb-1.5 text-xs font-medium text-slate-200">
                    Receipt (PDF)
                  </p>
                  <label
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-3 py-4 text-center text-xs text-slate-400 transition hover:border-indigo-500/70 hover:bg-slate-900/70"
                  >
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(event) =>
                        handleReceiptChange(event.target.files?.[0])
                      }
                    />
                    <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-slate-200">
                      <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] text-indigo-300">
                        Drag &amp; drop
                      </span>
                      <span className="text-slate-400">or click to upload</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      PDF files only. This is UI-only for now; upload will be
                      wired to the backend later.
                    </p>
                    {receiptFile && (
                      <p className="mt-2 text-[11px] font-medium text-emerald-300">
                        Selected: {receiptFile.name}
                      </p>
                    )}
                  </label>
                </div>

                {/* Monthly Summary PDF upload drag-and-drop zone */}
                <div className="mt-4">
                  <p className="mb-1.5 text-xs font-medium text-slate-200">
                    Monthly Summary PDF
                  </p>
                  <label
                    onDrop={handleMonthlySummaryDrop}
                    onDragOver={handleDragOver}
                    className="group flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-700/80 bg-slate-950/40 px-3 py-4 text-center text-xs text-slate-400 transition hover:border-indigo-500/70 hover:bg-slate-900/70"
                  >
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      className="hidden"
                      onChange={(event) =>
                        handleMonthlySummaryUpload(event.target.files?.[0])
                      }
                    />
                    <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-slate-200">
                      <span className="rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] text-indigo-300">
                        Drag &amp; drop
                      </span>
                      <span className="text-slate-400">or click to upload</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Upload your Monthly Summary PDF to auto-add expenses.
                    </p>
                    {monthlySummaryFile && (
                      <p className="mt-2 text-[11px] font-medium text-emerald-300">
                        {monthlyUploading ? 'Uploading… ' : 'Uploaded: '}
                        {monthlySummaryFile.name}
                      </p>
                    )}
                  </label>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-slate-50 shadow-md shadow-indigo-500/40 transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Add expense'}
                  </button>
                </div>
              </form>
            </div>

            {/* Chart + table */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-slate-950/50">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Daily spending
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Placeholder bar chart powered by Recharts.
                    </p>
                  </div>
                </div>
                <div className="mt-3 h-44">
                  {dailySpendingData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-xs text-slate-500">
                      No data yet. Add an expense to populate the chart.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailySpendingData}>
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10, fill: '#9CA3AF' }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#020617',
                            border: '1px solid #1f2937',
                            borderRadius: '0.75rem',
                            fontSize: '0.7rem',
                            color: '#e5e7eb',
                          }}
                          labelStyle={{ color: '#9CA3AF' }}
                        />
                        <Bar
                          dataKey="amount"
                          radius={[6, 6, 0, 0]}
                          fill="url(#spendingGradient)"
                        />
                        <defs>
                          <linearGradient
                            id="spendingGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={1} />
                            <stop
                              offset="95%"
                              stopColor="#06B6D4"
                              stopOpacity={0.2}
                            />
                          </linearGradient>
                        </defs>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-slate-950/50">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100">
                      Expenses
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Fetched from{' '}
                      <code className="rounded bg-slate-950/80 px-1 py-0.5 text-[11px] font-mono text-slate-300">
                        /expenses
                      </code>
                      .
                    </p>
                  </div>
                </div>

                {/* Search + filters */}
                {!loading && (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                    <div className="relative flex-1 min-w-[180px]">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search by title, category, or amount"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-700/80 bg-slate-950/60 pl-9 pr-3 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        Date:
                      </span>
                      {[
                        { value: 'all', label: 'All' },
                        { value: 'week', label: 'This Week' },
                        { value: 'month', label: 'This Month' },
                        { value: 'year', label: 'This Year' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setDateRange(value)}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition ${
                            dateRange === value
                              ? 'bg-indigo-500 text-slate-50 shadow-md shadow-indigo-500/40'
                              : 'border border-slate-700/80 bg-slate-950/60 text-slate-300 hover:bg-slate-800/60'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-400">
                        Category:
                      </span>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                      >
                        <option value="all">All</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {loading ? (
                  <p className="mt-4 text-xs text-slate-500">
                    Loading expenses…
                  </p>
                ) : (
                  <div className="mt-3 overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/40">
                    <div className="max-h-72 overflow-auto">
                      <table className="min-w-full text-left text-xs text-slate-200">
                        <thead className="bg-slate-950/60 text-[11px] uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-3 py-2 font-medium">Title</th>
                            <th className="px-3 py-2 font-medium text-right">Amount</th>
                            <th className="px-3 py-2 font-medium">Category</th>
                            <th className="px-3 py-2 font-medium">Date</th>
                            <th className="px-3 py-2 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredExpenses.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="px-3 py-6 text-center text-xs text-slate-500">
                                No expenses found.
                              </td>
                            </tr>
                          ) : (
                            filteredExpenses.map((item, index) => (
                              <tr
                                key={item.id || `${item.title}-${item.date}-${index}`}
                                className="border-t border-slate-800/60 odd:bg-slate-950/40 even:bg-slate-950/20"
                              >
                                <td className="px-3 py-2 text-xs font-medium text-slate-100">{item.title}</td>
                          <td className="px-3 py-2 text-right text-xs font-semibold text-slate-50">
                                  ₹{Number(item.amount ?? 0).toLocaleString()}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${getCategoryBadgeClass(item.category)}`}>
                                    {item.category || 'Other'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-300">
                                  {item.date ? new Date(item.date).toLocaleDateString() : '—'}
                                </td>
                                <td className="px-3 py-2 text-right space-x-1">
                                  <button
                                    type="button"
                                    onClick={() => handleEditOpen(item)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-300 hover:border-indigo-500/60 hover:bg-indigo-500/20 hover:text-indigo-300"
                                    title="Edit"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteExpense(item)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-400 hover:border-rose-500/60 hover:bg-rose-500/20 hover:text-rose-300"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
            </>
          )}
        </main>

        {/* Edit expense modal */}
        {editingExpense && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <h3 className="text-sm font-semibold text-slate-100">Edit expense</h3>
                <button
                  type="button"
                  onClick={() => { setEditingExpense(null); setError('') }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleEditSubmit} className="p-5 space-y-3">
                {error && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {error}
                  </div>
                )}
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
                  Title
                  <input name="title" value={editForm.title} onChange={handleEditChange} className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
                  Amount
                  <input name="amount" type="number" min="0" step="0.01" value={editForm.amount} onChange={handleEditChange} className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30" />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
                  Category
                  <select
                    name="category"
                    value={editIsCustomCategory ? CUSTOM_CATEGORY_VALUE : editForm.category}
                    onChange={handleEditChange}
                    className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value={CUSTOM_CATEGORY_VALUE}>Other...</option>
                  </select>
                  {editIsCustomCategory && (
                    <input
                      type="text"
                      value={editCustomCategoryInput}
                      onChange={(e) => setEditCustomCategoryInput(e.target.value)}
                      placeholder="Enter custom category"
                      className="mt-1 h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
                    />
                  )}
                </label>
                <DatePickerInput
                  label="Date"
                  value={editForm.date}
                  onChange={(iso) => setEditForm((prev) => ({ ...prev, date: iso }))}
                />
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setEditingExpense(null); setError('') }} className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-indigo-500 py-2 text-xs font-semibold text-slate-50 hover:bg-indigo-400 disabled:opacity-60">
                    {submitting ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Use Emergency Funds modal */}
        {showUseEmergencyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-rose-400" />
                  <h3 className="text-sm font-semibold text-slate-100">Use Emergency Funds</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowUseEmergencyModal(false); setUseEmergencyForm({ reason: '', amount: '' }); setError('') }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleUseEmergencyFunds} className="p-5 space-y-4">
                {error && (
                  <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                    {error}
                  </div>
                )}
                <div className="rounded-lg bg-slate-950/60 border border-slate-800 p-3">
                  <p className="text-[11px] font-medium text-slate-400 mb-1">Available Balance</p>
                  <p className="text-xl font-bold text-emerald-400">₹{remainingEmergencyBalance.toLocaleString()}</p>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
                  Reason for withdrawal
                  <input
                    type="text"
                    value={useEmergencyForm.reason}
                    onChange={(e) => setUseEmergencyForm((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="e.g. Medical emergency, Car repair"
                    className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-slate-200">
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    max={remainingEmergencyBalance}
                    value={useEmergencyForm.amount}
                    onChange={(e) => setUseEmergencyForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    className="h-9 rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/30"
                  />
                  <p className="text-[11px] text-slate-500 mt-0.5">Maximum: ₹{remainingEmergencyBalance.toLocaleString()}</p>
                </label>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowUseEmergencyModal(false); setUseEmergencyForm({ reason: '', amount: '' }); setError('') }}
                    className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!useEmergencyForm.reason?.trim() || !useEmergencyForm.amount || Number(useEmergencyForm.amount) <= 0}
                    className="flex-1 rounded-lg bg-rose-600 py-2 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Withdraw
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
