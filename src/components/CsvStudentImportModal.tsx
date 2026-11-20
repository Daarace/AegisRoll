import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Users,
  BookOpen,
  Building2,
  RefreshCw
} from 'lucide-react';
import { aegisStore } from '../lib/supabase';
import { CsvStudentRow, BulkImportResult } from '../types';

interface CsvStudentImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportCompleted: () => void;
  preselectedCourseId?: string;
}

export const CsvStudentImportModal: React.FC<CsvStudentImportModalProps> = ({
  isOpen,
  onClose,
  onImportCompleted,
  preselectedCourseId
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<CsvStudentRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);

  // Import options
  const [defaultDeptId, setDefaultDeptId] = useState<string>(
    aegisStore.departments[0]?.id || ''
  );
  const [targetCourseId, setTargetCourseId] = useState<string>(
    preselectedCourseId || ''
  );
  const [updateExisting, setUpdateExisting] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Helper: map fuzzy column names to standard fields
  const normalizeRow = (rawRow: Record<string, any>): CsvStudentRow | null => {
    const keys = Object.keys(rawRow);
    const getVal = (...variants: string[]): string => {
      for (const variant of variants) {
        const foundKey = keys.find(
          (k) => k.trim().toLowerCase().replace(/[\s_-]/g, '') === variant.toLowerCase().replace(/[\s_-]/g, '')
        );
        if (foundKey && rawRow[foundKey] !== undefined && rawRow[foundKey] !== null) {
          const val = String(rawRow[foundKey]).trim();
          if (val) return val;
        }
      }
      return '';
    };

    let matric = getVal('matric_number', 'matriculation_number', 'matric_no', 'matric', 'student_id', 'reg_no', 'regno', 'id');
    if (!matric) return null;
    matric = matric.trim().toUpperCase();
    if (/^\d{4}$/.test(matric)) {
      matric = `U24MTH${matric}`;
    }

    const name = getVal('full_name', 'name', 'student_name', 'fullname', 'first_name', 'last_name');
    const email = getVal('email', 'student_email', 'mail', 'institutional_email');
    const dept = getVal('department_code', 'dept_code', 'department', 'dept', 'program');
    const course = getVal('course_code', 'course', 'class_code', 'subject');
    const cardQr = getVal('card_qr', 'qr_code', 'qr', 'card_id', 'token');

    return {
      matric_number: matric,
      full_name: name || `Student (${matric.toUpperCase()})`,
      email: email || undefined,
      department_code: dept || undefined,
      course_code: course || undefined,
      card_qr: cardQr || undefined
    };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setFileName(selected.name);
    setParseError(null);
    setImportResult(null);

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          setParseError('The selected CSV file appears to be empty.');
          setParsedRows([]);
          return;
        }

        const valid: CsvStudentRow[] = [];
        results.data.forEach((raw: any) => {
          const norm = normalizeRow(raw);
          if (norm) valid.push(norm);
        });

        if (valid.length === 0) {
          setParseError(
            'Could not detect student matriculation numbers. Please ensure your CSV has a column header like "matric_number" or "student_id".'
          );
        }

        setParsedRows(valid);
      },
      error: (err) => {
        setParseError('Error parsing CSV file: ' + err.message);
        setParsedRows([]);
      }
    });
  };

  const handleDownloadTemplate = () => {
    const csvContent =
      'matric_number,full_name,email,department_code,course_code\n' +
      'U24MTH1001,Johnathan Doe,j.doe@student.edu,MTH,MTH 201\n' +
      'U24MTH1002,Amara Chukwu,a.chukwu@student.edu,MTH,MTH 201\n' +
      'U24MTH1019,Enoch Chinyere,e.chinyere@student.edu,MTH,MTH 201\n' +
      'U24MTH1020,Blessing Adeleke,b.adeleke@student.edu,MTH,MTH 201\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'AegisRoll_Student_Roster_Template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExecuteImport = () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      const res = aegisStore.bulkImportStudents(parsedRows, {
        defaultDepartmentId: defaultDeptId,
        targetCourseId: targetCourseId || undefined,
        updateExisting
      });

      setImportResult(res);
      onImportCompleted();
    } catch (err: any) {
      setParseError('Import failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setFileName('');
    setParsedRows([]);
    setParseError(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford-900/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-card rounded-2xl max-w-2xl w-full p-6 shadow-academic-lg border border-surface-border relative max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-oxford-800 text-teal-brand flex items-center justify-center shadow-inner">
            <FileSpreadsheet className="w-6 h-6 text-teal-brand" />
          </div>
          <div>
            <h3 className="font-serif text-xl font-bold text-oxford-800">
              Bulk Import Student Details (CSV)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload spreadsheets to populate students, auto-assign departments, and enroll classes in seconds
            </p>
          </div>
        </div>

        {/* Success View */}
        {importResult ? (
          <div className="space-y-5 animate-fade-in">
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <h4 className="font-serif font-bold text-base text-emerald-950">
                  Student Import Completed Successfully!
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-700">New Students</div>
                  <div className="text-xl font-bold text-emerald-950">{importResult.imported}</div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-700">Updated</div>
                  <div className="text-xl font-bold text-emerald-950">{importResult.updated}</div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-700">Enrollments</div>
                  <div className="text-xl font-bold text-emerald-950">{importResult.enrolled}</div>
                </div>
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                  <div className="text-xs text-emerald-700">Skipped</div>
                  <div className="text-xl font-bold text-emerald-950">{importResult.skipped}</div>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 max-h-32 overflow-y-auto">
                  <p className="font-bold mb-1">Warnings / Row Skips:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                Import Another File
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 rounded-xl transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Upload & Configuration Form */
          <div className="space-y-5">
            {/* Template Download Banner */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2 text-slate-600">
                <HelpCircle className="w-4 h-4 text-teal-brand shrink-0 mt-0.5" />
                <div>
                  <p>
                    Supported columns: <strong>matric_number</strong>, <strong>full_name</strong>, <strong>email</strong>, <strong>department_code</strong>, <strong>course_code</strong>.
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Matric format: <strong className="text-teal-brand">U24MTH####</strong> (e.g. <span className="font-mono">U24MTH1019</span>) or 4-digit serials (auto-prefixed).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-oxford-800 font-semibold rounded-lg shrink-0 transition shadow-xs text-xs"
              >
                <Download className="w-3.5 h-3.5 text-teal-brand" />
                <span>Download Sample Template</span>
              </button>
            </div>

            {/* Error Banner */}
            {parseError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{parseError}</span>
              </div>
            )}

            {/* File Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                fileName
                  ? 'border-teal-brand bg-teal-brand/5'
                  : 'border-slate-300 hover:border-teal-brand hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .tsv, .txt, text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Upload className="w-8 h-8 mx-auto mb-2 text-teal-brand" />
              {fileName ? (
                <div>
                  <p className="text-xs font-bold text-oxford-800">{fileName}</p>
                  <p className="text-[11px] text-teal-dark font-medium mt-0.5">
                    Click to choose a different CSV file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-oxford-800">
                    Click to select or drag and drop your CSV file
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Exported from university portal, Excel, or Google Sheets (.csv)
                  </p>
                </div>
              )}
            </div>

            {/* Import Configuration Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-teal-brand" /> Default Department
                </label>
                <select
                  value={defaultDeptId}
                  onChange={(e) => setDefaultDeptId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white"
                >
                  {aegisStore.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                  {aegisStore.departments.length === 0 && (
                    <option value="">Auto-create General Department</option>
                  )}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Applied to students whose CSV row has no department specified
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-teal-brand" /> Auto-Enroll into Course (Optional)
                </label>
                <select
                  value={targetCourseId}
                  onChange={(e) => setTargetCourseId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-brand bg-white"
                >
                  <option value="">-- Do not auto-enroll into a course --</option>
                  {aegisStore.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.course_code}: {c.title}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Instantly enrolls all imported students into this course roster
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="updateExistingCheckbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
                className="rounded border-slate-300 text-teal-brand focus:ring-teal-brand"
              />
              <label htmlFor="updateExistingCheckbox" className="text-xs text-slate-700 font-medium cursor-pointer">
                Update existing student information if matriculation number already exists
              </label>
            </div>

            {/* Parsed Preview Table */}
            {parsedRows.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-surface-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-oxford-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-teal-brand" />
                    <span>Parsed Roster Preview ({parsedRows.length} students found)</span>
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Showing first {Math.min(parsedRows.length, 5)} rows
                  </span>
                </div>

                <div className="border border-surface-border rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-surface-border uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Matric No</th>
                        <th className="px-3 py-2">Full Name</th>
                        <th className="px-3 py-2">Email</th>
                        <th className="px-3 py-2">Dept</th>
                        <th className="px-3 py-2">Course</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border font-mono text-[11px]">
                      {parsedRows.slice(0, 5).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-1.5 font-bold text-oxford-800">
                            {row.matric_number}
                          </td>
                          <td className="px-3 py-1.5 font-sans text-slate-700">
                            {row.full_name}
                          </td>
                          <td className="px-3 py-1.5 text-slate-500 font-sans">
                            {row.email || 'auto-generated'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">
                            {row.department_code || 'default'}
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">
                            {row.course_code || (targetCourseId ? 'selected course' : 'none')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={parsedRows.length === 0 || isProcessing}
                onClick={handleExecuteImport}
                className="px-5 py-2.5 text-xs font-bold text-white bg-oxford-800 hover:bg-oxford-700 disabled:opacity-50 rounded-xl transition shadow flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing {parsedRows.length} Students...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-teal-brand" />
                    <span>Import {parsedRows.length} Students</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
