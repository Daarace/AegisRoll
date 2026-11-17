import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType
} from 'docx';
import { saveAs } from 'file-saver';
import { AttendanceReportSummary } from '../types';

/**
 * Exports attendance records to clean CSV using PapaParse
 */
export function exportAttendanceToCSV(
  data: AttendanceReportSummary[],
  fileName: string = 'AegisRoll_Attendance_Report.csv'
) {
  const formatted = data.map((item, index) => ({
    'S/N': index + 1,
    'Matric Number': item.matric_number,
    'Student Name': item.student_name,
    'Department': item.department_name,
    'Course Code': item.course_code,
    'Course Title': item.course_title,
    'Credit Load': item.credit_load,
    'Total Sessions': item.total_sessions,
    'Sessions Attended': item.sessions_attended,
    'Attendance %': `${item.attendance_percentage.toFixed(1)}%`,
    'Status': item.attendance_percentage >= 75 ? 'Satisfactory' : 'Below Minimum (Flagged)'
  }));

  const csv = Papa.unparse(formatted);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, fileName);
}

/**
 * Generates an authoritative, publication-quality Academic PDF Report
 */
export function exportAttendanceToPDF(
  data: AttendanceReportSummary[],
  filterMeta?: {
    courseCode?: string;
    courseTitle?: string;
    departmentName?: string;
    startDate?: string;
    endDate?: string;
  },
  fileName: string = 'AegisRoll_Attendance_Audit.pdf'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Oxford Navy Header Bar
  doc.setFillColor(15, 33, 55); // #0F2137
  doc.rect(0, 0, pageWidth, 30, 'F');

  // Academic Teal Accent Stripe
  doc.setFillColor(38, 185, 168); // #26B9A8
  doc.rect(0, 30, pageWidth, 2.5, 'F');

  // 2. Title & Institution Branding
  doc.setFont('times', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('AEGISROLL | ACADEMIC ATTENDANCE AUDIT', 14, 15);

  doc.setFont('times', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(217, 179, 84); // Prestige Gold #D9B354
  doc.text('Verified Presence • Academic Integrity • Geofence Certified', 14, 22);

  // 3. Document Metadata Box
  doc.setTextColor(30, 41, 59); // Slate-800
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('AUDIT RECORD DETAILS', 14, 40);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const courseStr = filterMeta?.courseCode
    ? `${filterMeta.courseCode} - ${filterMeta.courseTitle || 'All Classes'}`
    : 'All Courses';
  const deptStr = filterMeta?.departmentName || 'All Academic Departments';
  const dateStr = filterMeta?.startDate && filterMeta?.endDate
    ? `${filterMeta.startDate} to ${filterMeta.endDate}`
    : 'Current Academic Semester';

  doc.text(`Course: ${courseStr}`, 14, 46);
  doc.text(`Department: ${deptStr}`, 14, 51);
  doc.text(`Reporting Period: ${dateStr}`, 14, 56);
  doc.text(`Generated At: ${new Date().toLocaleString()} (UTC)`, 120, 46);
  doc.text(`Total Records: ${data.length}`, 120, 51);

  const avgAttendance = data.length > 0
    ? (data.reduce((acc, curr) => acc + curr.attendance_percentage, 0) / data.length).toFixed(1)
    : '0.0';
  doc.text(`Class Average: ${avgAttendance}%`, 120, 56);

  // Thin dividing line
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 61, pageWidth - 14, 61);

  // 4. Data Table via jsPDF AutoTable
  const tableRows = data.map((item, idx) => [
    (idx + 1).toString(),
    item.matric_number,
    item.student_name,
    item.course_code,
    item.credit_load.toString(),
    `${item.sessions_attended} / ${item.total_sessions}`,
    `${item.attendance_percentage.toFixed(1)}%`,
    item.attendance_percentage >= 75 ? 'Satisfactory' : 'Flagged (<75%)'
  ]);

  autoTable(doc, {
    startY: 65,
    head: [[
      '#',
      'Matric No.',
      'Student Name',
      'Course',
      'Credits',
      'Sessions',
      'Attendance %',
      'Status'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 33, 55],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 26 },
      2: { halign: 'left', cellWidth: 44 },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 22 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
      7: { halign: 'center', cellWidth: 25 }
    },
    didParseCell: (hookData) => {
      // Color-code the status and attendance cells
      if (hookData.section === 'body' && hookData.column.index === 7) {
        const text = hookData.cell.raw as string;
        if (text && text.includes('Flagged')) {
          hookData.cell.styles.textColor = [220, 38, 38]; // Red
          hookData.cell.styles.fontStyle = 'bold';
        } else {
          hookData.cell.styles.textColor = [22, 101, 52]; // Green
        }
      }
    },
    margin: { left: 14, right: 14, bottom: 35 }
  });

  // 5. Verification & Dean Sign-off Footer Block
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 12 : 220;
  const footerY = Math.min(finalY, 250);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 33, 55);

  // Left signature
  doc.line(14, footerY + 15, 75, footerY + 15);
  doc.text('Course Lecturer Signature', 14, footerY + 20);

  // Right signature
  doc.line(pageWidth - 75, footerY + 15, pageWidth - 14, footerY + 15);
  doc.text('Faculty Dean / Academic Registrar', pageWidth - 75, footerY + 20);

  // Bottom Security Notice
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This document contains cryptographically verified attendance records governed by AegisRoll dynamic geofencing.',
    pageWidth / 2,
    288,
    { align: 'center' }
  );

  doc.save(fileName);
}

/**
 * Generates an authentic Microsoft Word (.docx) Document
 */
export async function exportAttendanceToWord(
  data: AttendanceReportSummary[],
  filterMeta?: {
    courseCode?: string;
    courseTitle?: string;
    departmentName?: string;
    startDate?: string;
    endDate?: string;
  },
  fileName: string = 'AegisRoll_Attendance_Report.docx'
) {
  const tableHeaderCell = (text: string, widthPercent: number) =>
    new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: '0F2137' },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text,
              bold: true,
              color: 'FFFFFF',
              size: 18 // 9pt
            })
          ]
        })
      ]
    });

  const tableDataCell = (
    text: string,
    widthPercent: number,
    align: any = AlignmentType.LEFT,
    isBold: boolean = false,
    textColor: string = '1E293B'
  ) =>
    new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          alignment: align,
          children: [
            new TextRun({
              text,
              bold: isBold,
              color: textColor,
              size: 17 // 8.5pt
            })
          ]
        })
      ]
    });

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      tableHeaderCell('#', 6),
      tableHeaderCell('Matric No.', 18),
      tableHeaderCell('Student Name', 26),
      tableHeaderCell('Course', 12),
      tableHeaderCell('Credits', 10),
      tableHeaderCell('Attended', 14),
      tableHeaderCell('Rate %', 14)
    ]
  });

  const dataRows = data.map((item, idx) => {
    const isFlagged = item.attendance_percentage < 75;
    return new TableRow({
      children: [
        tableDataCell((idx + 1).toString(), 6, AlignmentType.CENTER),
        tableDataCell(item.matric_number, 18, AlignmentType.LEFT, true),
        tableDataCell(item.student_name, 26, AlignmentType.LEFT),
        tableDataCell(item.course_code, 12, AlignmentType.CENTER),
        tableDataCell(item.credit_load.toString(), 10, AlignmentType.CENTER),
        tableDataCell(`${item.sessions_attended} / ${item.total_sessions}`, 14, AlignmentType.CENTER),
        tableDataCell(
          `${item.attendance_percentage.toFixed(1)}%`,
          14,
          AlignmentType.CENTER,
          true,
          isFlagged ? 'DC2626' : '15803D'
        )
      ]
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({
                text: 'AEGISROLL ACADEMIC ATTENDANCE AUDIT',
                bold: true,
                color: '0F2137',
                size: 28
              })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Verified Presence • Academic Integrity • Geofence Certified Audit',
                italics: true,
                color: '26B9A8',
                size: 20
              })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Course: ', bold: true }),
              new TextRun(filterMeta?.courseCode ? `${filterMeta.courseCode} - ${filterMeta.courseTitle || ''}` : 'All Courses'),
              new TextRun({ text: '   |   Department: ', bold: true }),
              new TextRun(filterMeta?.departmentName || 'All Departments'),
              new TextRun({ text: '   |   Generated: ', bold: true }),
              new TextRun(new Date().toLocaleDateString())
            ]
          }),
          new Paragraph({ text: '' }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [headerRow, ...dataRows]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Registrar & Academic Affairs Certification',
                bold: true,
                size: 20,
                color: '0F2137'
              })
            ]
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'I hereby certify that this attendance record has been generated in accordance with institution attendance regulations and geofence verification protocols.',
                italics: true,
                color: '64748B',
                size: 18
              })
            ]
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Sign: ____________________________        Date: ____________________' })
            ]
          })
        ]
      }
    ]
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, fileName);
}
