'use client'
import { useState, useEffect, useCallback } from 'react'
import { collection, query, orderBy, where, getDocs, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { formatDate, todayStr, currentMonth } from '@/lib/utils'
import { useAuth } from '@/lib/context/AuthContext'
import toast from 'react-hot-toast'
import { CalendarDays } from 'lucide-react'

const STATUS_OPTIONS = ['present','absent','half_day','leave','holiday'] as const
type AttStatus = typeof STATUS_OPTIONS[number]
const STATUS_COLORS: Record<AttStatus, string> = {
  present: 'badge-success', absent: 'badge-danger', half_day: 'badge-warning',
  leave: 'badge-info', holiday: 'badge-muted',
}

export default function AttendancePage() {
  const { user } = useAuth()
  const [employees, setEmployees] = useState<any[]>([])
  const [attendance, setAttendance] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayStr())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [eSnap, aSnap] = await Promise.all([
        getDocs(query(collection(db,'employees'), where('status','==','active'), orderBy('name'))),
        getDocs(query(collection(db,'attendance'), where('attendanceDate','==',date))),
      ])
      setEmployees(eSnap.docs.map(d=>({id:d.id,...d.data()})))
      const attMap: Record<string,string> = {}
      aSnap.docs.forEach(d => { attMap[d.data().employeeId] = d.data().status })
      setAttendance(attMap)
    } catch {}
    setLoading(false)
  }, [date])

  useEffect(()=>{load()},[load])

  function setStatus(empId: string, status: AttStatus) {
    setAttendance(p=>({...p,[empId]:status}))
  }

  async function saveAll() {
    setSaving(true)
    try {
      await Promise.all(employees.map(emp => {
        const status = attendance[emp.id] || 'present'
        const docId = `${emp.id}_${date}`
        return setDoc(doc(db,'attendance',docId), {
          employeeId: emp.id, employeeName: emp.name, attendanceDate: date,
          status, createdBy: user!.uid, createdAt: serverTimestamp(),
        }, { merge: true })
      }))
      toast.success('Attendance saved for ' + formatDate(date))
    } catch (err:any) { toast.error(err.message) }
    setSaving(false)
  }

  const summary = { present: 0, absent: 0, half_day: 0, leave: 0, holiday: 0 }
  employees.forEach(e => {
    const s = (attendance[e.id] || 'present') as AttStatus
    if (summary[s] !== undefined) summary[s]++
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="page-title">Attendance</h1><p className="page-subtitle">{employees.length} active employees</p></div>
        <div className="flex gap-2 items-center">
          <input type="date" className="form-input w-auto" value={date} onChange={e=>setDate(e.target.value)}/>
          <button className="btn btn-primary" onClick={saveAll} disabled={saving}>{saving?'Saving…':'💾 Save Attendance'}</button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-3 flex-wrap mb-5">
        {Object.entries(summary).map(([s,c])=>(
          <div key={s} className="kpi-card flex items-center gap-3 py-3 px-4 !rounded-xl" style={{'--kpi-accent': s==='present'?'#10B981':s==='absent'?'#EF4444':s==='half_day'?'#F59E0B':'#6B7280'} as any}>
            <span className={`badge ${STATUS_COLORS[s as AttStatus]} capitalize`}>{s.replace('_',' ')}</span>
            <span className="text-xl font-bold text-white">{c}</span>
          </div>
        ))}
      </div>

      {loading ? <div className="loading-overlay"><div className="spinner spinner-lg"/></div> : (
        <div className="glass-card overflow-hidden">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  {STATUS_OPTIONS.map(s=><th key={s} className="capitalize text-center">{s.replace('_',' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr><td colSpan={6}><div className="empty-state"><CalendarDays size={40} className="opacity-30 mb-3"/><p>No active employees</p></div></td></tr>
                ) : employees.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div className="font-semibold text-gray-200">{emp.name}</div>
                      <div className="text-xs text-gray-600">{emp.designation||''}</div>
                    </td>
                    {STATUS_OPTIONS.map(s=>(
                      <td key={s} className="text-center">
                        <button
                          onClick={()=>setStatus(emp.id,s)}
                          className={`w-7 h-7 rounded-full border-2 transition-all ${attendance[emp.id]===s ? `border-transparent ${s==='present'?'bg-emerald-500':s==='absent'?'bg-red-500':s==='half_day'?'bg-amber-500':s==='leave'?'bg-blue-500':'bg-gray-500'}` : 'border-white/10 bg-white/5 hover:bg-white/10'}`}
                          title={s}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
