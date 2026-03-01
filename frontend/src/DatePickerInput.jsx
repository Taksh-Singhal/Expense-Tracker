import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'

function toDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export default function DatePickerInput({ label, value, onChange, className = '' }) {
  const selected = toDate(value)

  const handleChange = (date) => {
    const iso = date ? date.toISOString().split('T')[0] : ''
    onChange(iso)
  }

  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-slate-200">
      {label}
      <DatePicker
        selected={selected}
        onChange={handleChange}
        dateFormat="dd/MM/yyyy"
        placeholderText="dd/MM/yyyy"
        className={`h-9 w-full rounded-lg border border-slate-700/80 bg-slate-950/60 px-3 text-xs text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 ${className}`}
      />
    </label>
  )
}

