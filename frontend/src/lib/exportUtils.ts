import * as XLSX from 'xlsx';
import { RawLead, VerifiedLead } from './types';

/**
 * Export data array as native browser CSV file
 */
export function exportToCSV(data: Record<string, any>[], filename: string) {
  if (!data || !data.length) {
    alert('No data available to export.');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [];

  // Add header row
  csvRows.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] ?? '';
      const escaped = String(val).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  const csvString = '\uFEFF' + csvRows.join('\r\n'); // Add UTF-8 BOM
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export both Raw Scraped Leads and Verified Outreach Queue as a multi-worksheet Excel (.xlsx) file
 */
export function exportToExcel(
  rawLeads: RawLead[],
  verifiedLeads: VerifiedLead[],
  filename: string = 'LenGen_Leads_Database'
) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Raw Scraped Domains
  const rawDataFormatted = rawLeads.map(l => ({
    'Row ID': l.row_index,
    'Domain': l.domain,
    'Company Name': l.company_name,
    'Scraped Emails': l.raw_email,
    'Phone Number': l.phone_number,
    'Top Service Need': l.top_service_need || 'AI Automation & Agentic AI',
    'Need Score': l.need_score || 0,
    'Pain Points': l.pain_points || '',
    'Scrape Status': l.scrape_status,
    'Scraped Date': l.scraped_date
  }));
  const ws1 = XLSX.utils.json_to_sheet(rawDataFormatted);
  XLSX.utils.book_append_sheet(wb, ws1, 'Raw_Scraped_Domains');

  // Sheet 2: Verified Outreach Queue
  const verifiedDataFormatted = verifiedLeads.map(l => ({
    'Row ID': l.row_index,
    'Domain': l.domain,
    'Decision Maker Email': l.decision_maker_email,
    'Phone Number': l.phone_number,
    'Deliverability Score': typeof l.verification_score === 'number' ? `${(l.verification_score * 100).toFixed(0)}%` : l.verification_score,
    'Top Service Need': l.top_service_need || 'AI Automation & Agentic AI',
    'Need Score': l.need_score || 0,
    'Pain Points': l.pain_points || '',
    'Outreach Status': l.outreach_status,
    'Sent Timestamp': l.sent_timestamp
  }));
  const ws2 = XLSX.utils.json_to_sheet(verifiedDataFormatted);
  XLSX.utils.book_append_sheet(wb, ws2, 'Verified_Outreach_Queue');

  // Generate and trigger download
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
