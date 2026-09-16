'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatCurrency, formatDate, todayStr, currentMonth } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, X, CheckCircle } from 'lucide-react'
import type { SalaryRecord, Employee } from '@/types'

export default function SalaryPage() {
  const { user } = useAuth()
  const [salaries, setSalaries] = useState<SalaryRecord[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [month, setMonth] = useState(currentMonth())
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sSnap, eSnap] = await Promise.all([
        getDocs(query(collection(db, 'salaries'), where('salaryMonth', '==', month), orderBy('employeeName'))),
        getDocs(query(collection(db, 'employees'), where('status', '==', 'active'), orderBy('name'))),
      ])
      setSalaries(sSnap.docs.map(d => ({ id: d.id, ...d.data() }) as SalaryRecord))
      setEmployees(eSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Employee))
    } catch {}
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  async function generateSalaries() {
    if (salaries.length > 0) return toast.error('Salaries already generated for this month')
    setGenerating(true)
    try {
      const daysInMonth = new Date(Number(month.split('-')[0]), Number(month.split('-')[1]), 0).getDate()
      await Promise.all(employees.map(emp =>
        addDoc(collection(db, 'salaries'), {
          employeeId: emp.id, employeeName: emp.name, salaryMonth: month,
          basicSalary: emp.basicSalary, workingDays: daysInMonth, presentDays: daysInMonth,
          overtimeHours: 0, overtimeAmount: 0, bonus: 0, incentive: 0,
          advanceDeduction: 0, leaveDeduction: 0, otherDeduction: 0,
          netSalary: emp.basicSalary, paidAmount: 0, status: 'pending',
          createdBy: user!.uid, createdAt: serverTimestamp(),
        })
      ))
      toast.success(`${employees.length} salary records generated`)
      load()
    } catch (err: any) { toast.error(err.message) }
    setGenerating(false)
  }

  async function markPaid(salary: SalaryRecord) {
    try {
      await updateDoc(doc(db, 'salaries', salary.id), { status: 'paid', paidAmount: salary.netSalary, paymentDate: todayStr(), paymentMode: 'cash', updatedAt: serverTimestamp() })
      toast.success('Salary marked as paid')
      load()
    } catch (err: any) { toast.error(err.message) }
  }

  const totalNet = salaries.reduce((s, r) => s + (r.netSalary || 0), 0)
  const totalPaid = salaries.filter(r => r.status === 'paid').reduce((s, r) => s + (r.netSalary || 0), 0)
  const totalPending = totalNet - totalPaid

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Salary Management</h1>
          <p className="page-subtitle">Payable: {formatCurrency(totalPending)} · Paid: {formatCurrency(totalPaid)}</p>
        </div>
        <div className="flex gap-2">
          <input type="month" className="form-input w-auto" value={month} onChange={e => setMonth(e.target.value)} />
          {salaries.length === 0 && <button className="btn btn-primary" onClick={generateSalaries} disabled={generating}>{generating ? 'Generating…' : '⚙️ Generate'}</button>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="kpi-card" style={{'--kpi-accent':'#7C3AED'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Total Payroll</p><p className="text-xl font-bold text-white mt-1">{formatCurrency(totalNet)}</p></div>
        <div className="kpi-card" style={{'--kpi-accent':'#10B981'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Paid</p><p className="text-xl font-bold text-emerald-300 mt-1">{formatCurrency(totalPaid)}</p></div>
        <div className="kpi-card" style={{'--kpi-accent':'#F59E0B'} as any}><p className="text-xs text-gray-500 uppercase tracking-wider">Pending</p><p className="text-xl font-bold text-amber-300 mt-1">{formatCurrency(totalPending)}</p></div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Employee</th><th>Basic</th><th>Days</th><th>Bonus</th><th>Deductions</th><th className="text-right">Net Salary</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={8} className="text-center py-10"><div className="spinner mx-auto" /></td></tr>
                : salaries.length === 0 ? (
                  <tr><td colSpan={8}><div className="empty-state py-10">
                    <p className="mb-3">No salaries for {month}</p>
                    {employees.length > 0 && <button className="btn btn-primary btn-sm" onClick={generateSalaries}>Generate Salaries</button>}
                  </div></td></tr>
                ) : salaries.map(s => (
                  <tr key={s.id}>
                    <td className="font-semibold text-gray-200">{s.employeeName}</td>
                    <td>{formatCurrency(s.basicSalary)}</td>
                    <td>{s.presentDays}/{s.workingDays}</td>
                    <td className="text-emerald-300">{s.bonus || s.incentive ? formatCurrency((s.bonus || 0) + (s.incentive || 0)) : '—'}</td>
                    <td className="text-red-400">{(s.advanceDeduction || 0) + (s.leaveDeduction || 0) + (s.otherDeduction || 0) > 0 ? formatCurrency((s.advanceDeduction || 0) + (s.leaveDeduction || 0) + (s.otherDeduction || 0)) : '—'}</td>
                    <td className="text-right font-bold text-gray-200">{formatCurrency(s.netSalary)}</td>
                    <td><span className={`badge ${s.status === 'paid' ? 'badge-success' : 'badge-warning'}`}>{s.status}</span></td>
                    <td>{s.status !== 'paid' && <button className="btn btn-success btn-sm" onClick={() => markPaid(s)}><CheckCircle size={13} /> Pay</button>}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
