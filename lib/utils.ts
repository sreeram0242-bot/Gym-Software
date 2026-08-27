/**
 * Formats a date string (YYYY-MM-DD, ISO string, or Date) to DD/MM/YYYY format
 */
export function formatDateDDMMYYYY(dateInput?: string | Date | null): string {
  if (!dateInput) return '-';
  try {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const [year, month, day] = trimmed.split('-');
        return `${day}/${month}/${year}`;
      }
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        return trimmed;
      }
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
}

/**
 * Returns today's date in YYYY-MM-DD format based on local timezone, avoiding UTC shift bugs.
 */
export function getLocalTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  csvRows.push(headers.join(','));
  
  for (const row of data) {
    const values = headers.map(header => {
      const escaped = ('' + (row[header] || '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }
  
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
