import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportToPDF(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][],
  summaryItems?: { label: string; value: string | number }[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 95);
  doc.text(title, 14, 20);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 28);

  let startY = 36;

  // Summary section
  if (summaryItems && summaryItems.length > 0) {
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(14, startY - 4, pageWidth - 28, summaryItems.length * 8 + 8, 3, 3, 'F');
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text('Summary', 18, startY + 4);
    startY += 10;

    doc.setFontSize(9);
    summaryItems.forEach((item) => {
      doc.setTextColor(100, 100, 100);
      doc.text(item.label + ':', 18, startY);
      doc.setTextColor(30, 30, 30);
      doc.text(String(item.value), 80, startY);
      startY += 7;
    });
    startY += 6;
  }

  // Table
  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(String)),
    startY,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 95],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 30, doc.internal.pageSize.getHeight() - 10);
    doc.text('Production Management System', 14, doc.internal.pageSize.getHeight() - 10);
  }

  doc.save(`${filename}.pdf`);
}
