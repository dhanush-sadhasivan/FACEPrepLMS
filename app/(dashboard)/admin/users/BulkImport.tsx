'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';

interface BulkResult {
  created: number;
  skipped: number;
  errors: string[];
  createdUsers?: Array<{ email: string; full_name: string; tempPassword: string; role: string }>;
}

export default function BulkImport() {
  const router = useRouter();
  const { showToast } = useToast();
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData(results.data);
        setResult(null);
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        showToast('Failed to parse CSV file', 'error');
      }
    });
  };

  const handleImport = async () => {
    if (parsedData.length === 0) return;
    setIsImporting(true);
    setResult(null);

    try {
      const res = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: parsedData }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setParsedData([]);
        showToast(`Successfully created ${data.created} user(s)!`, 'success');
        router.refresh();
      } else {
        showToast(data.error || 'Failed to bulk import users.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('An error occurred during import.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'emp_id,full_name,email,team,manager,hackerrank_id,role,temp_password\n1001,Jane Doe,jane@example.com,Engineering,John Smith,janedoe_hr,trainer,TempPass123!\n1002,Mark Johnson,mark@example.com,Data Science,Sarah Connor,markj_hr,trainer,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const cleanDisplay = (val: any) => {
    if (!val) return '—';
    const str = String(val).trim();
    if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(str.toLowerCase())) return '—';
    return str;
  };

  return (
    <div className="bulk-import-section">
      <div className="flex justify-between items-center mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 className="text-xl font-bold">Bulk Import Users</h2>
          <p className="text-sm text-muted">Upload a CSV file to create multiple user accounts at once.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          📥 Download CSV Template
        </button>
      </div>

      <div className="upload-area mb-4">
        <label className="label">Upload CSV File (.csv)</label>
        <input
          type="file"
          accept=".csv"
          className="input file-input"
          onChange={handleFileUpload}
        />
        <p className="text-sm text-muted mt-2">
          Expected CSV columns: <code>emp_id, full_name, email, team, manager, hackerrank_id, role, temp_password</code> (temp_password is optional).
        </p>
      </div>

      {parsedData.length > 0 && (
        <div className="preview-area" style={{ marginTop: '1.5rem' }}>
          <h3 className="text-lg font-medium mb-2">Preview ({parsedData.length} records ready to import)</h3>
          <div className="table-container max-h-64 overflow-y-auto mb-4" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>Temp Password</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.slice(0, 5).map((row, i) => (
                  <tr key={i}>
                    <td>{cleanDisplay(row.emp_id)}</td>
                    <td>{cleanDisplay(row.full_name)}</td>
                    <td>{cleanDisplay(row.email || row.emp_email)}</td>
                    <td>{cleanDisplay(row.team)}</td>
                    <td>{cleanDisplay(row.role)}</td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>
                      {row.temp_password || row.password ? cleanDisplay(row.temp_password || row.password) : '(auto-generate)'}
                    </td>
                  </tr>
                ))}
                {parsedData.length > 5 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted">...and {parsedData.length - 5} more rows</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            className="btn btn-primary mt-2"
            onClick={handleImport}
            disabled={isImporting}
          >
            {isImporting ? 'Importing Users...' : `🚀 Import ${parsedData.length} User(s)`}
          </button>
        </div>
      )}

      {result && (
        <div className="import-results mt-4 p-4 rounded-md border border-border bg-surface" style={{ background: 'var(--surface-2)', padding: '1.25rem', borderRadius: 8, border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-lg mb-2">Import Results</h3>
          <p style={{ color: 'var(--success)', fontWeight: 600 }}>✅ Successfully created: {result.created}</p>
          {result.skipped > 0 && (
            <p style={{ color: 'var(--warning)', fontWeight: 600 }}>⚠️ Skipped: {result.skipped}</p>
          )}

          {result.createdUsers && result.createdUsers.length > 0 && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Generated Account Credentials:</h4>
              <div className="table-container max-h-48 overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Temporary Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.createdUsers.map((u, idx) => (
                      <tr key={idx}>
                        <td>{u.full_name}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td style={{ color: 'var(--accent)', fontWeight: 'bold', fontFamily: 'monospace' }}>
                          {u.tempPassword}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="mt-3">
              <p className="text-danger font-medium">Errors / Warnings:</p>
              <ul className="list-disc list-inside text-sm text-danger max-h-32 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
