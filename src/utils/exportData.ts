import * as XLSX from 'xlsx';
import { CandidateRecord } from '../types/recruitment';
import { buildExportRows } from './analytics';

function escapeCsvCell(value: string): string {
  // Guard against spreadsheet formula injection (=, +, -, @) when exporting to CSV
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safeValue)) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function serializeToCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerLine = headers.map(escapeCsvCell).join(',');
  const bodyLines = rows.map((row) =>
    headers.map((header) => escapeCsvCell(row[header] ?? '')).join(',')
  );
  return '\uFEFF' + [headerLine, ...bodyLines].join('\r\n');
}

export function downloadCandidatesCsv(
  records: CandidateRecord[],
  filenamePrefix: string,
  includeSystemTimestamp: boolean
): void {
  const rows = buildExportRows(records, includeSystemTimestamp);
  if (rows.length === 0) return;

  const csvContent = serializeToCsv(rows);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${filenamePrefix}_${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadCandidatesExcel(
  records: CandidateRecord[],
  filenamePrefix: string,
  includeSystemTimestamp: boolean
): void {
  const rows = buildExportRows(records, includeSystemTimestamp);
  if (rows.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 13 }, // Date
    { wch: 20 }, // Manager Name
    { wch: 20 }, // Recruiter Name
    { wch: 24 }, // Client Name
    { wch: 20 }, // Purpose
    { wch: 24 }, // Candidate's Name
    { wch: 16 }, // Candidate's Mobile
    { wch: 24 }, // City
    { wch: 44 }, // Resume URL
    ...(includeSystemTimestamp ? [{ wch: 18 }] : []),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Candidates');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filenamePrefix}_${stamp}.xlsx`);
}
