import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatDateDDMMYYYY } from './utils';

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  gymName?: string;
  filename: string;
  head: string[][];
  body: (string | number)[][];
  orientation?: 'portrait' | 'landscape';
  summaryBoxes?: { label: string; value: string }[];
}

export function exportToPDF({
  title,
  subtitle,
  gymName = 'GymFlow Management',
  filename,
  head,
  body,
  orientation = 'portrait',
  summaryBoxes
}: PDFExportOptions) {
  const doc = new jsPDF(orientation);
  
  // Header Branding
  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138); // Deep Navy Blue
  doc.text(gymName, 14, 16);
  
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(title, 14, 23);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate Muted
  const sub = subtitle || `Generated on: ${formatDateDDMMYYYY(new Date().toISOString())} | Total Records: ${body.length}`;
  doc.text(sub, 14, 29);

  let startY = 34;

  // Optional summary boxes
  if (summaryBoxes && summaryBoxes.length > 0) {
    let xOffset = 14;
    const boxWidth = orientation === 'landscape' ? 62 : 42;
    summaryBoxes.forEach(box => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(xOffset, 32, boxWidth, 14, 2, 2, 'FD');
      
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(box.label.toUpperCase(), xOffset + 3, 37);
      
      doc.setFontSize(9.5);
      doc.setTextColor(30, 58, 138);
      doc.text(box.value, xOffset + 3, 43);
      
      xOffset += boxWidth + 4;
    });
    startY = 50;
  }

  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 14, right: 14 }
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
