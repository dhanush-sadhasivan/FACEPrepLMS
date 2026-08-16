'use client';

import { useState, useRef } from 'react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string>('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData(results.data);
        setResult(null);
        showToast(`Parsed ${results.data.length} records from ${file.name}`, 'info');
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        showToast('Failed to parse CSV file. Please check file formatting.', 'error');
      },
    });
  };

  const handleClear = () => {
    setParsedData([]);
    setFileName('');
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        setFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        showToast(`🎉 Successfully created ${data.created} user(s)!`, 'success');
        router.refresh();
      } else {
        showToast(data.error || 'Failed to bulk import users.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('An error occurred during bulk import.', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const csv =
      'emp_id,full_name,email,team,manager,hackerrank_id,role,temp_password\n1001,Jane Doe,jane@example.com,Engineering,John Smith,janedoe_hr,trainer,TempPass123!\n1002,Mark Johnson,mark@example.com,Data Science,Sarah Connor,markj_hr,trainer,';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('Downloaded user_import_template.csv', 'info');
  };

  const copyAllCredentials = () => {
    if (!result?.createdUsers || result.createdUsers.length === 0) return;
    const text = result.createdUsers
      .map((u) => `Name: ${u.full_name}\nEmail: ${u.email}\nTemp Password: ${u.tempPassword}\nRole: ${u.role}`)
      .join('\n\n------------------------\n\n');
    navigator.clipboard.writeText(text);
    showToast(`Copied ${result.createdUsers.length} user credentials to clipboard!`, 'success');
  };

  const cleanDisplay = (val: any) => {
    if (!val) return '—';
    const str = String(val).trim();
    if (['nil', 'null', 'n/a', 'undefined', 'none', '-'].includes(str.toLowerCase())) return '—';
    return str;
  };

  return (
    <div className="bulk-import-card">
      <div className="bulk-header">
        <div>
          <h2 className="bulk-title">
            <span>📥</span> Bulk Import Users
          </h2>
          <p className="page-subtitle" style={{ marginTop: '0.2rem' }}>
            Upload a CSV spreadsheet to create multiple trainer/manager accounts in batch.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
          📄 Download Sample CSV Template
        </button>
      </div>

      {/* CSV Dropzone */}
      <div
        className="csv-dropzone"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept=".csv"
          ref={fileInputRef}
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />

        <span className="csv-dropzone-icon">📁</span>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.25rem 0', color: 'var(--text-primary)' }}>
          {fileName ? `Selected File: ${fileName}` : 'Click to Browse or Drag CSV File Here'}
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0' }}>
          Accepts <code>.csv</code> files formatted with required user headers.
        </p>

        <div className="column-pills-list">
          <span className="col-pill">emp_id</span>
          <span className="col-pill">full_name</span>
          <span className="col-pill">email</span>
          <span className="col-pill">team</span>
          <span className="col-pill">manager</span>
          <span className="col-pill">hackerrank_id</span>
          <span className="col-pill">role</span>
          <span className="col-pill">temp_password</span>
        </div>
      </div>

      {/* CSV Data Preview Area */}
      {parsedData.length > 0 && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Preview Ready: <span style={{ color: 'var(--accent)' }}>{parsedData.length} Users</span>
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={handleClear}>
              ❌ Clear File
            </button>
          </div>

          <div className="users-table-container" style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <table className="users-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Emp ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>Temp Password</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{idx + 1}</td>
                    <td><span className="emp-id-badge">{cleanDisplay(row.emp_id)}</span></td>
                    <td style={{ fontWeight: 700 }}>{cleanDisplay(row.full_name)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{cleanDisplay(row.email || row.emp_email)}</td>
                    <td>{cleanDisplay(row.team)}</td>
                    <td><span className="role-badge trainer">{cleanDisplay(row.role || 'trainer')}</span></td>
                    <td style={{ fontFamily: 'monospace', color: 'var(--accent)', fontWeight: 'bold' }}>
                      {row.temp_password || row.password ? cleanDisplay(row.temp_password || row.password) : '(Auto Generated)'}
                    </td>
                  </tr>
                ))}
                {parsedData.length > 10 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.75rem' }}>
                      ...and {parsedData.length - 10} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleImport}
              disabled={isImporting}
              style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
            >
              {isImporting ? '⏳ Importing Users to Database...' : `🚀 Create & Import ${parsedData.length} Users`}
            </button>
          </div>
        </div>
      )}

      {/* Import Results Summary Card */}
      {result && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>
            🎉 Import Complete Summary
          </h3>

          <div className="results-summary-grid">
            <div className="summary-card" style={{ borderColor: 'var(--success)', background: 'var(--success-muted)' }}>
              <div className="summary-card-val" style={{ color: 'var(--success)' }}>{result.created}</div>
              <div className="summary-card-label">Created</div>
            </div>

            <div className="summary-card" style={{ borderColor: result.skipped > 0 ? 'var(--warning)' : 'var(--border)' }}>
              <div className="summary-card-val" style={{ color: result.skipped > 0 ? 'var(--warning)' : 'var(--text-muted)' }}>{result.skipped}</div>
              <div className="summary-card-label">Skipped / Existed</div>
            </div>

            <div className="summary-card" style={{ borderColor: result.errors.length > 0 ? 'var(--error)' : 'var(--border)' }}>
              <div className="summary-card-val" style={{ color: result.errors.length > 0 ? 'var(--error)' : 'var(--text-muted)' }}>{result.errors.length}</div>
              <div className="summary-card-label">Errors</div>
            </div>
          </div>

          {result.createdUsers && result.createdUsers.length > 0 && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h4 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  🔑 Generated Account Credentials ({result.createdUsers.length})
                </h4>

                <button className="btn btn-secondary btn-sm" onClick={copyAllCredentials}>
                  📋 Copy All Credentials
                </button>
              </div>

              <div className="users-table-container" style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Temporary Password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.createdUsers.map((u, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>{u.full_name}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                        <td><span className="role-badge trainer">{u.role}</span></td>
                        <td style={{ color: 'var(--accent)', fontWeight: 800, fontFamily: 'monospace' }}>
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
            <div style={{ marginTop: '1rem', background: 'var(--error-muted)', border: '1px solid var(--error)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem' }}>
              <h5 style={{ color: 'var(--error)', fontWeight: 800, margin: '0 0 0.4rem 0', fontSize: '0.88rem' }}>
                ⚠️ Errors / Skipped Log
              </h5>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--error)', fontSize: '0.82rem' }}>
                {result.errors.map((err, i) => (
                  <li key={i} style={{ marginBottom: '0.2rem' }}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
