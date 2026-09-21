/**
 * exportExcel.js  –  Download data as an Excel (.xlsx) file
 * Uses the SheetJS (xlsx) library.
 */
import * as XLSX from 'xlsx'

/**
 * exportToExcel(sheets, filename)
 * @param {Array}  sheets    – [{ name: 'Sheet1', rows: [{col1, col2, ...}] }]
 * @param {string} filename  – e.g. 'Sales_Report_Sep_2026'
 */
export function exportToExcel(sheets, filename = 'Report') {
  const wb = XLSX.utils.book_new()

  sheets.forEach(({ name, rows, headers }) => {
    if (!rows || rows.length === 0) {
      const ws = XLSX.utils.aoa_to_sheet([['No data available']])
      XLSX.utils.book_append_sheet(wb, ws, name || 'Sheet')
      return
    }

    // Build header row from either provided headers or first row keys
    const hdrs = headers || Object.keys(rows[0])
    const dataRows = rows.map(r => hdrs.map(h => r[h] ?? ''))
    const ws = XLSX.utils.aoa_to_sheet([hdrs, ...dataRows])

    // Auto-width
    const colWidths = hdrs.map((h, i) => ({
      wch: Math.max(h.length, ...dataRows.map(r => String(r[i] ?? '').length), 10)
    }))
    ws['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws, (name || 'Sheet').slice(0, 31))
  })

  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/** Quick single-sheet helper */
export function downloadExcel(rows, headers, filename, sheetName = 'Data') {
  exportToExcel([{ name: sheetName, rows, headers }], filename)
}

/** Format currency values */
export const fmtNum = (n) => Number(n || 0).toFixed(2)
