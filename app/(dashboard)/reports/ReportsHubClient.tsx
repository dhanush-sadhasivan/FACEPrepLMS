'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { createClient } from '@/lib/supabase/client';
import './reports.css';

type ReportDomain = 'contests' | 'it-attendance' | 'teams' | 'roadmaps' | 'inactivity-audit';
type DatePreset = 'all' | '7d' | '30d' | 'custom';

interface ReportsHubClientProps {
  initialReportType?: ReportDomain;
  userRole: string;
}

export default function ReportsHubClient({ initialReportType = 'contests', userRole }: ReportsHubClientProps) {
  const [activeTab, setActiveTab] = useState<ReportDomain>(initialReportType);
  const [loading, setLoading] = useState(false);
  const [tabPayloads, setTabPayloads] = useState<Record<string, any>>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // Filter states
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedContest, setSelectedContest] = useState('all');
  const [selectedRoadmap, setSelectedRoadmap] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting & Pagination
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Fetch report data from API
  const fetchReportData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('reportType', activeTab);

      if (selectedTeam !== 'all') params.set('team', selectedTeam);
      if (activeTab === 'contests' && selectedContest !== 'all') params.set('contestId', selectedContest);
      if ((activeTab === 'it-attendance' || activeTab === 'roadmaps') && selectedRoadmap !== 'all') {
        params.set('roadmapId', selectedRoadmap);
      }
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      // Date calculations
      const now = new Date();
      if (datePreset === '7d') {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        params.set('startDate', start.toISOString());
      } else if (datePreset === '30d') {
        const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        params.set('startDate', start.toISOString());
      } else if (datePreset === 'custom') {
        if (customStartDate) params.set('startDate', new Date(customStartDate).toISOString());
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          params.set('endDate', end.toISOString());
        }
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/reports?${params.toString()}`, {
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        const errData = await res.json().catch(() => ({}));
        console.warn('Report fetch warning:', errData.error || res.statusText);
        setTabPayloads((prev) => ({ ...prev, [activeTab]: { rows: [], kpis: {}, meta: {} } }));
        return;
      }

      const data = await res.json();
      // Guard: Discard stale response if tab changed while in flight
      if (controller.signal.aborted || (data.reportType && data.reportType !== activeTab)) {
        return;
      }

      setTabPayloads((prev) => ({ ...prev, [activeTab]: data }));
      setCurrentPage(1);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('Error fetching report:', err);
      setTabPayloads((prev) => ({ ...prev, [activeTab]: { rows: [], kpis: {}, meta: {} } }));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [activeTab, datePreset, customStartDate, customEndDate, selectedTeam, selectedContest, selectedRoadmap, searchQuery]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Reset secondary filters when changing tabs
  const handleTabChange = (tab: ReportDomain) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setActiveTab(tab);
    setSelectedContest('all');
    setSelectedRoadmap('all');
    setSortField(null);
    setSortDirection('asc');
    setCurrentPage(1);
  };

  const activePayload = tabPayloads[activeTab] || { rows: [], kpis: {}, meta: {} };
  const rows: any[] = activePayload.rows || [];
  const kpis: any = activePayload.kpis || {};
  const meta: any = activePayload.meta || {};

  // Sort handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Client-side sorted rows
  const sortedRows = useMemo(() => {
    if (!sortField) return rows;
    return [...rows].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();

      if (valA === valB) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (sortDirection === 'asc') return valA > valB ? 1 : -1;
      return valA < valB ? 1 : -1;
    });
  }, [rows, sortField, sortDirection]);

  // Paginated rows
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedRows.length / pageSize) || 1;

  // ─────────────────────────────────────────────────────────────────────────
  // EXPORT HANDLERS (CSV & EXCEL)
  // ─────────────────────────────────────────────────────────────────────────
  const getFormattedExportData = () => {
    if (activeTab === 'contests') {
      return sortedRows.map((r) => ({
        Rank: r.rank,
        'Contest Title': r.contestTitle,
        'HackerRank Slug': r.hackerrankSlug,
        'Trainer Name': r.trainerName,
        'Employee ID': r.empId,
        'Email Address': r.email,
        'Team / Cohort': r.team,
        'Reporting Manager': r.manager,
        'HackerRank ID': r.hackerrankId,
        'Questions Solved': r.solvedCount,
        'Total Questions': r.totalQuestions,
        'Completion Rate (%)': `${r.completionPct}%`,
        'Accuracy (%)': `${r.accuracyPct ?? 0}%`,
        'Percentile': `${r.percentile ?? 0}th`,
        'Total Score': r.score,
        'Max Possible Score': r.maxPossibleScore,
        Status: r.status,
        'Last Submission': r.lastSubmissionAt ? new Date(r.lastSubmissionAt).toLocaleString() : '—',
      }));
    }

    if (activeTab === 'it-attendance') {
      return sortedRows.map((r) => {
        let locationStr = '—';
        if (r.locationDisplay && r.locationDisplay !== '—') {
          locationStr = r.locationDisplay;
        } else if (r.location) {
          let rawLoc = r.location;
          if (typeof rawLoc === 'string' && rawLoc.trim().startsWith('{') && rawLoc.trim().endsWith('}')) {
            try {
              rawLoc = JSON.parse(rawLoc);
            } catch {
              rawLoc = r.location;
            }
          }
          if (typeof rawLoc === 'string') {
            locationStr = rawLoc;
          } else if (typeof rawLoc === 'object' && rawLoc !== null) {
            const locType = rawLoc.type || rawLoc.office_name || '';
            const detailStr = rawLoc.detail || (rawLoc.office_name && rawLoc.office_name !== locType ? rawLoc.office_name : '') || rawLoc.wfh_reason || '';
            const locDetail = detailStr ? ` (${detailStr})` : '';
            locationStr = `${locType}${locDetail}`.trim() || '—';
          }
        }

        let formattedCheckIn = 'Never';
        if (r.lastCheckInDate) {
          try {
            if (r.lastCheckInDate.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(r.lastCheckInDate)) {
              formattedCheckIn = r.lastCheckInDate.slice(0, 10);
            } else {
              formattedCheckIn = new Date(r.lastCheckInDate).toLocaleDateString();
            }
          } catch {
            formattedCheckIn = String(r.lastCheckInDate);
          }
        }

        return {
          'IT Roadmap': r.roadmapTitle,
          'Trainer Name': r.trainerName,
          'Employee ID': r.empId,
          'Email Address': r.email,
          'Team / Cohort': r.team,
          'Reporting Manager': r.manager,
          'IT Days Logged': r.itDaysCount,
          'Current Day': r.currentDay,
          'Total Days': r.totalDays,
          'Check-In Date': formattedCheckIn,
          'Location': locationStr,
          'Questions Completed': r.questionsCompleted,
          'Total Questions': r.totalQuestions,
          'Pending Backlog': r.pendingQuestions,
          'Completion (%)': `${r.completionPct}%`,
          'Velocity (q/day)': r.completionVelocity ?? 0,
          'Days Since Last Activity': r.daysSinceLastActivity ?? '—',
          'Extended Days': r.extendedDays,
          'Attendance Status': r.attendanceStatus,
        };
      });
    }

    if (activeTab === 'teams') {
      return sortedRows.map((r) => ({
        Rank: r.rank,
        'Team Name': r.teamName,
        'Total Members': r.totalMembers,
        'Active Members': r.activeMembers,
        'Participation Rate (%)': `${r.participationRate}%`,
        'Average Score': r.avgScore,
        'Total Team Score': r.totalScore,
        'Average Solved': r.avgSolved,
        'Total Solved': r.totalSolved,
        'Roadmap Completion Rate (%)': `${r.completionRate ?? 0}%`,
        'IT Engagement (%)': `${r.itEngagementPct ?? 0}%`,
        'Min Score': r.scoreDistribution?.min ?? 0,
        'Median Score': r.scoreDistribution?.median ?? 0,
        'Max Score': r.scoreDistribution?.max ?? 0,
        'Master Trainers': r.masterTrainersCount,
        'Top Performer': r.topTrainerName,
        'Top Performer Score': r.topTrainerScore,
      }));
    }

    if (activeTab === 'roadmaps') {
      return sortedRows.map((r) => ({
        'Roadmap Title': r.roadmapTitle,
        Domain: r.domain,
        Level: r.level,
        'Trainer Name': r.trainerName,
        'Employee ID': r.empId,
        'Email Address': r.email,
        'Team / Cohort': r.team,
        'Topics Completed': r.completedTopicsCount,
        'Total Topics': r.totalTopics,
        'Completion (%)': `${r.completionPct}%`,
        'Questions Solved': r.questionsSolved ?? 0,
        'Days Since Started': r.daysSinceStarted ?? '—',
        'Est. Completion Days': r.estimatedCompletionDays ?? '—',
        Status: r.status,
        'Started At': r.startedAt ? new Date(r.startedAt).toLocaleDateString() : '—',
        'Completed At': r.completedAt ? new Date(r.completedAt).toLocaleDateString() : '—',
      }));
    }

    if (activeTab === 'inactivity-audit') {
      return sortedRows.map((r) => ({
        'Trainer Name': r.trainerName,
        'Employee ID': r.empId,
        'Email Address': r.email,
        'Team / Cohort': r.team,
        'Reporting Manager': r.manager,
        'Days Inactive': r.daysInactive,
        'Risk Level': r.riskLevel,
        'Engagement Score': r.engagementScore ?? 0,
        Trend: r.trend ?? '—',
        'Last Activity Type': r.lastActivityType ?? '—',
        'Total Solved': r.totalSolved,
        'Total Contest Score': r.totalScore,
        'IT Days Logged': r.itDaysCount,
        'Pending Tasks': r.pendingTodos,
        'Recommended Action': r.actionRecommendation,
        'Last Active Date': r.lastActiveDate ? new Date(r.lastActiveDate).toLocaleString() : 'Never',
      }));
    }

    return sortedRows;
  };

  const sanitizeExportData = (data: Record<string, any>[]): Record<string, any>[] => {
    const formulaChars = ['=', '+', '-', '@', '\t', '\r'];
    return data.map((row) => {
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(row)) {
        if (value === null || value === undefined) {
          sanitized[key] = '';
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          sanitized[key] = value;
        } else {
          const str = String(value);
          if (str.length > 0 && formulaChars.includes(str.charAt(0))) {
            sanitized[key] = "'" + str;
          } else {
            sanitized[key] = str;
          }
        }
      }
      return sanitized;
    });
  };

  const exportCsv = () => {
    const exportData = getFormattedExportData();
    if (exportData.length === 0) return;
    const sanitizedData = sanitizeExportData(exportData);
    const csv = Papa.unparse(sanitizedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FACEPrep_${activeTab}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const exportExcel = () => {
    const exportData = getFormattedExportData();
    if (exportData.length === 0) return;
    const sanitizedData = sanitizeExportData(exportData);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(sanitizedData);
    XLSX.utils.book_append_sheet(wb, ws, activeTab.slice(0, 31));
    XLSX.writeFile(wb, `FACEPrep_${activeTab}_report_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderSortHeader = (label: string, field: string, align: 'left' | 'center' | 'right' = 'left', minWidth?: number) => {
    const isSorted = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={isSorted ? 'sorted' : ''}
        style={{ textAlign: align, minWidth: minWidth ? `${minWidth}px` : undefined }}
        title={`Sort by ${label}`}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start', width: '100%' }}>
          <span>{label}</span>
          <span style={{ fontSize: '0.72rem', opacity: isSorted ? 1 : 0.4 }}>
            {isSorted ? (sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="reports-header">
        <div>
          <h1 className="reports-title">
            <span>📈</span> Reports &amp; Performance Analytics Hub
          </h1>
          <p className="reports-subtitle">
            Generate, filter, preview, and download organizational reports across contests, IT attendance, cohorts, and skills.
          </p>
        </div>

        <div className="export-actions">
          <button className="btn-export-csv" onClick={exportCsv} disabled={rows.length === 0} title="Export CSV">
            <span>📥</span> Export CSV
          </button>
          <button className="btn-export-excel" onClick={exportExcel} disabled={rows.length === 0} title="Export Excel (.xlsx)">
            <span>📊</span> Export Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* Domain Navigation Tabs */}
      <div className="report-tabs-bar">
        <button
          className={`report-tab-btn ${activeTab === 'contests' ? 'active' : ''}`}
          onClick={() => handleTabChange('contests')}
        >
          <span>🏆</span> Contests &amp; Leaderboards
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'it-attendance' ? 'active' : ''}`}
          onClick={() => handleTabChange('it-attendance')}
        >
          <span>🎓</span> Internal Training &amp; Attendance
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'teams' ? 'active' : ''}`}
          onClick={() => handleTabChange('teams')}
        >
          <span>👥</span> Team Benchmarks
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'roadmaps' ? 'active' : ''}`}
          onClick={() => handleTabChange('roadmaps')}
        >
          <span>🗺️</span> Topic Roadmaps
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'inactivity-audit' ? 'active' : ''}`}
          onClick={() => handleTabChange('inactivity-audit')}
        >
          <span>⚠️</span> Inactivity &amp; At-Risk Audit
        </button>
      </div>

      {/* Dynamic KPI Cards */}
      <div className="kpi-grid">
        {activeTab === 'contests' && (
          <>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>🏆</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.totalContests ?? 0}</span>
                <span className="kpi-label">Contests Included</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(240, 82, 55, 0.12)', color: 'var(--accent)' }}>👥</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.totalEnrolledTrainers ?? 0}</span>
                <span className="kpi-label">Enrolled Trainers</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>👑</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.masteredCount ?? 0}</span>
                <span className="kpi-label">100% Mastered</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>📊</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.avgScore ?? 0} pts</span>
                <span className="kpi-label">Avg Score</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>📈</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.avgCompletionPct ?? 0}%</span>
                <span className="kpi-label">Avg Completion</span>
              </div>
            </div>
            {kpis.scoreDistribution && (
              <div className="kpi-card">
                <div className="kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>📉</div>
                <div className="kpi-details">
                  <span className="kpi-val" style={{ fontSize: '0.82rem' }}>
                    {kpis.scoreDistribution.min} / {kpis.scoreDistribution.median} / {kpis.scoreDistribution.max}
                  </span>
                  <span className="kpi-label">Min / Median / Max</span>
                </div>
              </div>
            )}
            {kpis.topScorerName && kpis.topScorerName !== '—' && (
              <div className="kpi-card">
                <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>🌟</div>
                <div className="kpi-details">
                  <span className="kpi-val" style={{ fontSize: '0.85rem' }}>{kpis.topScorerName}</span>
                  <span className="kpi-label">Top Scorer</span>
                </div>
              </div>
            )}
            {kpis.difficultyBreakdown && (
              <div className="kpi-card">
                <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>🎯</div>
                <div className="kpi-details">
                  <span className="kpi-val" style={{ fontSize: '0.78rem' }}>
                    {kpis.difficultyBreakdown.easy}E · {kpis.difficultyBreakdown.medium}M · {kpis.difficultyBreakdown.hard}H
                  </span>
                  <span className="kpi-label">Easy · Med · Hard Qs</span>
                </div>
              </div>
            )}
          </>
        )}


        {activeTab === 'it-attendance' && (
          <>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>🎓</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.totalTrainers ?? 0}</span>
                <span className="kpi-label">Active IT Trainers</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>✅</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.completedCount ?? 0}</span>
                <span className="kpi-label">Completed</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>🟢</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.onTrackCount ?? 0}</span>
                <span className="kpi-label">On Track</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)' }}>⚠️</div>
              <div className="kpi-details">
                <span className="kpi-val" style={{ color: 'var(--error)' }}>{kpis.behindCount ?? 0}</span>
                <span className="kpi-label">In Backlog</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>📍</div>
              <div className="kpi-details">
                <span className="kpi-val" style={{ fontSize: '0.85rem' }}>
                  {kpis.officeCheckInsCount ?? 0} Office · {kpis.wfhCheckInsCount ?? 0} WFH
                </span>
                <span className="kpi-label">Location Split</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>📈</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.avgItCompletion ?? 0}%</span>
                <span className="kpi-label">Avg Completion</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'teams' && (
          <>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>🏢</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.totalTeams ?? 0}</span>
                <span className="kpi-label">Total Teams</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(240, 82, 55, 0.12)', color: 'var(--accent)' }}>👥</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.orgTotalMembers ?? 0}</span>
                <span className="kpi-label">Total Members</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>⚡</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.orgParticipationRate ?? 0}%</span>
                <span className="kpi-label">Org Participation</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>🥇</div>
              <div className="kpi-details">
                <span className="kpi-val" style={{ fontSize: '1rem' }}>{kpis.topTeamName ?? '—'}</span>
                <span className="kpi-label">Top Performing Team</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'roadmaps' && (
          <>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>🗺️</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.totalRoadmaps ?? 0}</span>
                <span className="kpi-label">Total Roadmaps</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(240, 82, 55, 0.12)', color: 'var(--accent)' }}>👥</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.totalEnrollments ?? 0}</span>
                <span className="kpi-label">Total Enrollments</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>✅</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.completedCount ?? 0}</span>
                <span className="kpi-label">Completed Roadmaps</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>📊</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.avgCompletionPct ?? 0}%</span>
                <span className="kpi-label">Avg Topics Mastery</span>
              </div>
            </div>
          </>
        )}

        {activeTab === 'inactivity-audit' && (
          <>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>🔍</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.totalAudited ?? 0}</span>
                <span className="kpi-label">Audited Trainers</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--error)' }}>🔴</div>
              <div className="kpi-details">
                <span className="kpi-val" style={{ color: 'var(--error)' }}>{kpis.highRiskCount ?? 0}</span>
                <span className="kpi-label">High Risk (&gt;14 Days)</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>🟡</div>
              <div className="kpi-details">
                <span className="kpi-val" style={{ color: '#f59e0b' }}>{kpis.mediumRiskCount ?? 0}</span>
                <span className="kpi-label">Medium Risk (7-14 Days)</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>🟢</div>
              <div className="kpi-details">
                <span className="kpi-val" style={{ color: '#10b981' }}>{kpis.activeCount ?? 0}</span>
                <span className="kpi-label">Fully Active</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(240, 82, 55, 0.12)', color: 'var(--accent)' }}>⚠️</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.atRiskPercentage ?? 0}%</span>
                <span className="kpi-label">Overall At-Risk Rate</span>
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-icon" style={{ background: 'rgba(139, 92, 246, 0.12)', color: '#8b5cf6' }}>💡</div>
              <div className="kpi-details">
                <span className="kpi-val">{kpis.avgEngagementScore ?? 0}<span style={{ fontSize: '0.7rem', fontWeight: 400 }}>/100</span></span>
                <span className="kpi-label">Avg Engagement Score</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="filter-toolbar">
        <div className="filter-row-top">
          {/* Date range presets */}
          <div className="date-preset-group">
            <button
              className={`date-preset-btn ${datePreset === 'all' ? 'active' : ''}`}
              onClick={() => setDatePreset('all')}
            >
              All Time
            </button>
            <button
              className={`date-preset-btn ${datePreset === '30d' ? 'active' : ''}`}
              onClick={() => setDatePreset('30d')}
            >
              Last 30 Days
            </button>
            <button
              className={`date-preset-btn ${datePreset === '7d' ? 'active' : ''}`}
              onClick={() => setDatePreset('7d')}
            >
              Last 7 Days
            </button>
            <button
              className={`date-preset-btn ${datePreset === 'custom' ? 'active' : ''}`}
              onClick={() => setDatePreset('custom')}
            >
              Custom Range
            </button>
          </div>

          {datePreset === 'custom' && (
            <div className="custom-date-picker">
              <span>From:</span>
              <input
                type="date"
                className="custom-date-input"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
              />
              <span>To:</span>
              <input
                type="date"
                className="custom-date-input"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
              />
            </div>
          )}

          <div className="search-box-wrapper" style={{ minWidth: 260 }}>
            <span className="search-box-icon">🔍</span>
            <input
              type="text"
              className="search-box-input"
              placeholder="Search trainer, emp ID, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-row-bottom">
          {/* Team Dropdown */}
          <select
            className="filter-select"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="all">All Teams ({meta.availableTeams?.length || 0})</option>
            {(meta.availableTeams || []).map((t: string) => (
              <option key={t} value={t}>
                Team: {t}
              </option>
            ))}
          </select>

          {/* Contest Dropdown */}
          {activeTab === 'contests' && (
            <select
              className="filter-select"
              value={selectedContest}
              onChange={(e) => setSelectedContest(e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="all">All Contests ({meta.availableContests?.length || 0})</option>
              {(meta.availableContests || []).map((c: any) => (
                <option key={c.id} value={c.id}>
                  Contest: {c.title}
                </option>
              ))}
            </select>
          )}

          {/* Roadmap Dropdown */}
          {(activeTab === 'it-attendance' || activeTab === 'roadmaps') && (
            <select
              className="filter-select"
              value={selectedRoadmap}
              onChange={(e) => setSelectedRoadmap(e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="all">All Roadmaps ({meta.availableRoadmaps?.length || 0})</option>
              {(meta.availableRoadmaps || []).map((r: any) => (
                <option key={r.id} value={r.id}>
                  Roadmap: {r.title}
                </option>
              ))}
            </select>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Showing <strong>{sortedRows.length}</strong> matching records
          </div>
        </div>
      </div>

      {/* Live Table Preview */}
      <div className="report-table-card">
        <div className="table-responsive">
          <table className="report-table">
            <thead>
              {activeTab === 'contests' && (
                <tr>
                  {renderSortHeader('Rank', 'rank', 'center', 70)}
                  {renderSortHeader('Trainer', 'trainerName', 'left', 180)}
                  {renderSortHeader('Emp ID', 'empId', 'left', 110)}
                  {renderSortHeader('Team', 'team', 'left', 120)}
                  {renderSortHeader('Contest', 'contestTitle', 'left', 180)}
                  {renderSortHeader('Solved', 'solvedCount', 'left', 140)}
                  {renderSortHeader('Score', 'score', 'right', 110)}
                  {renderSortHeader('Accuracy', 'accuracyPct', 'center', 100)}
                  {renderSortHeader('Percentile', 'percentile', 'center', 100)}
                  {renderSortHeader('Status', 'status', 'center', 120)}
                  {renderSortHeader('Last Submission', 'lastSubmissionAt', 'right', 150)}
                </tr>
              )}

              {activeTab === 'it-attendance' && (
                <tr>
                  {renderSortHeader('Trainer', 'trainerName', 'left', 180)}
                  {renderSortHeader('Emp ID', 'empId', 'left', 100)}
                  {renderSortHeader('Team', 'team', 'left', 110)}
                  {renderSortHeader('Roadmap', 'roadmapTitle', 'left', 170)}
                  {renderSortHeader('IT Days', 'itDaysCount', 'center', 90)}
                  {renderSortHeader('Day Plan', 'currentDay', 'center', 100)}
                  {renderSortHeader('Solved Progress', 'questionsCompleted', 'left', 150)}
                  {renderSortHeader('Backlog', 'pendingQuestions', 'center', 110)}
                  {renderSortHeader('Location', 'locationDisplay', 'left', 160)}
                  {renderSortHeader('Status', 'attendanceStatus', 'center', 110)}
                  {renderSortHeader('Check-In Date', 'lastCheckInDate', 'right', 120)}
                </tr>
              )}

              {activeTab === 'teams' && (
                <tr>
                  {renderSortHeader('Rank', 'rank', 'center', 70)}
                  {renderSortHeader('Team Name', 'teamName', 'left', 180)}
                  {renderSortHeader('Total Members', 'totalMembers', 'center', 120)}
                  {renderSortHeader('Active Members', 'activeMembers', 'center', 120)}
                  {renderSortHeader('Participation', 'participationRate', 'left', 140)}
                  {renderSortHeader('Avg Score', 'avgScore', 'right', 110)}
                  {renderSortHeader('Roadmap Done %', 'completionRate', 'center', 130)}
                  {renderSortHeader('IT Engagement %', 'itEngagementPct', 'center', 130)}
                  {renderSortHeader('Master Trainers', 'masterTrainersCount', 'center', 120)}
                  {renderSortHeader('Top Performer', 'topTrainerName', 'left', 160)}
                </tr>
              )}

              {activeTab === 'roadmaps' && (
                <tr>
                  {renderSortHeader('Trainer', 'trainerName', 'left', 180)}
                  {renderSortHeader('Emp ID', 'empId', 'left', 110)}
                  {renderSortHeader('Team', 'team', 'left', 120)}
                  {renderSortHeader('Roadmap Title', 'roadmapTitle', 'left', 180)}
                  {renderSortHeader('Domain', 'domain', 'left', 120)}
                  {renderSortHeader('Topics Progress', 'completedTopicsCount', 'left', 150)}
                  {renderSortHeader('Qs Solved', 'questionsSolved', 'center', 100)}
                  {renderSortHeader('Est. Days', 'estimatedCompletionDays', 'center', 100)}
                  {renderSortHeader('Status', 'status', 'center', 120)}
                  {renderSortHeader('Started At', 'startedAt', 'right', 120)}
                </tr>
              )}

              {activeTab === 'inactivity-audit' && (
                <tr>
                  {renderSortHeader('Trainer', 'trainerName', 'left', 180)}
                  {renderSortHeader('Emp ID', 'empId', 'left', 110)}
                  {renderSortHeader('Team', 'team', 'left', 120)}
                  {renderSortHeader('Days Inactive', 'daysInactiveNumber', 'center', 120)}
                  {renderSortHeader('Risk Level', 'riskTier', 'center', 130)}
                  {renderSortHeader('Engagement', 'engagementScore', 'center', 110)}
                  {renderSortHeader('Trend', 'trend', 'center', 100)}
                  {renderSortHeader('Last Activity', 'lastActivityType', 'center', 120)}
                  {renderSortHeader('IT Days', 'itDaysCount', 'center', 90)}
                  {renderSortHeader('Action', 'actionRecommendation', 'left', 240)}
                </tr>
              )}
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'inline-block', width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Loading report analytics…
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="reports-empty-state">
                    <div className="reports-empty-icon">📊</div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>No records match your filters</div>
                    <div style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}>Try clearing the search query or adjusting team and date filters.</div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((r, i) => {
                  return (
                    <tr key={i}>
                      {activeTab === 'contests' && (
                        <>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: r.rank === 1 ? '#f59e0b' : 'var(--text-secondary)' }}>
                            {r.rank === 1 ? '🥇 #1' : r.rank === 2 ? '🥈 #2' : r.rank === 3 ? '🥉 #3' : `#${r.rank}`}
                          </td>
                          <td style={{ fontWeight: 700 }}>{r.trainerName}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.empId}</td>
                          <td><span className="scorecard-chip">{r.team}</span></td>
                          <td style={{ fontSize: '0.84rem' }}>{r.contestTitle}</td>
                          <td>
                            <div className="tbl-progress-wrap">
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '35px' }}>{r.solvedCount}/{r.totalQuestions}</span>
                              <div className="tbl-progress-bar">
                                <div className="tbl-progress-fill" style={{ width: `${r.completionPct}%`, background: r.status === 'Mastered' ? '#10b981' : 'var(--accent)' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: r.score > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {r.score} pts
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.82rem', color: r.accuracyPct >= 70 ? '#10b981' : r.accuracyPct >= 40 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 700 }}>
                            {r.accuracyPct ?? 0}%
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--indigo)', fontWeight: 700 }}>
                            {r.percentile ?? 0}th
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-pill ${r.status === 'Mastered' ? 'mastered' : r.status === 'In Progress' ? 'inprogress' : 'unattempted'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {r.lastSubmissionAt ? new Date(r.lastSubmissionAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </td>
                        </>
                      )}

                      {activeTab === 'it-attendance' && (
                        <>
                          <td style={{ fontWeight: 700 }}>{r.trainerName}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.empId}</td>
                          <td><span className="scorecard-chip">{r.team}</span></td>
                          <td style={{ fontSize: '0.84rem' }}>{r.roadmapTitle}</td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981' }}>🎓 {r.itDaysCount}</td>
                          <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>Day {r.currentDay} / {r.totalDays}</td>
                          <td>
                            <div className="tbl-progress-wrap">
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '35px' }}>{r.questionsCompleted}/{r.totalQuestions}</span>
                              <div className="tbl-progress-bar">
                                <div className="tbl-progress-fill" style={{ width: `${r.completionPct}%`, background: '#10b981' }} />
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{r.completionPct}%</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {r.pendingQuestions > 0 ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                background: 'rgba(239, 68, 68, 0.12)',
                                color: 'var(--error)',
                              }}>
                                ⚠️ {r.pendingQuestions} Qs
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.2rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                background: 'rgba(16, 185, 129, 0.12)',
                                color: '#10b981',
                              }}>
                                ✓ Clear
                              </span>
                            )}
                          </td>
                          <td>
                            {r.locationDisplay && r.locationDisplay !== '—' ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.76rem',
                                fontWeight: 600,
                                color: (r.locationType || '').toLowerCase().includes('office') ? '#10b981' : (r.locationType || '').toLowerCase().includes('wfh') || (r.locationType || '').toLowerCase().includes('home') ? '#3b82f6' : 'var(--text-primary)',
                                maxWidth: '170px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }} title={r.locationDisplay}>
                                <span>{(r.locationType || '').toLowerCase().includes('office') ? '🏢' : (r.locationType || '').toLowerCase().includes('wfh') || (r.locationType || '').toLowerCase().includes('home') ? '🏠' : '📍'}</span>
                                <span>{r.locationDisplay}</span>
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-pill ${
                              r.attendanceStatus === 'Completed' ? 'mastered' :
                              r.attendanceStatus === 'On Track' ? 'ontrack' :
                              r.attendanceStatus === 'Behind' ? 'highrisk' :
                              r.attendanceStatus === 'Extended' ? 'extended' : 'notstarted'
                            }`}>
                              {r.attendanceStatus}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {r.lastCheckInDate ? (
                              r.lastCheckInDate.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(r.lastCheckInDate)
                                ? r.lastCheckInDate.slice(0, 10)
                                : new Date(r.lastCheckInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            ) : 'Never'}
                          </td>
                        </>
                      )}

                      {activeTab === 'teams' && (
                        <>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: r.rank === 1 ? '#f59e0b' : 'var(--text-secondary)' }}>
                            {r.rank === 1 ? '🥇 #1' : r.rank === 2 ? '🥈 #2' : r.rank === 3 ? '🥉 #3' : `#${r.rank}`}
                          </td>
                          <td style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{r.teamName}</td>
                          <td style={{ textAlign: 'center' }}>{r.totalMembers}</td>
                          <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 700 }}>{r.activeMembers}</td>
                          <td>
                            <div className="tbl-progress-wrap">
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '35px' }}>{r.participationRate}%</span>
                              <div className="tbl-progress-bar">
                                <div className="tbl-progress-fill" style={{ width: `${r.participationRate}%`, background: 'var(--indigo)' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--accent)' }}>{r.avgScore} pts</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.completionRate >= 50 ? '#10b981' : '#f59e0b', fontSize: '0.85rem' }}>
                            {r.completionRate ?? 0}%
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: r.itEngagementPct >= 50 ? '#10b981' : '#f59e0b', fontSize: '0.85rem' }}>
                            {r.itEngagementPct ?? 0}%
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#f59e0b' }}>👑 {r.masterTrainersCount}</td>
                          <td style={{ fontSize: '0.84rem' }}>
                            <strong>{r.topTrainerName}</strong> <span style={{ color: 'var(--text-muted)' }}>({r.topTrainerScore} pts)</span>
                          </td>
                        </>
                      )}

                      {activeTab === 'roadmaps' && (
                        <>
                          <td style={{ fontWeight: 700 }}>{r.trainerName}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.empId}</td>
                          <td><span className="scorecard-chip">{r.team}</span></td>
                          <td style={{ fontSize: '0.84rem' }}>{r.roadmapTitle}</td>
                          <td><span className="scorecard-chip">{r.domain}</span></td>
                          <td>
                            <div className="tbl-progress-wrap">
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '35px' }}>{r.completedTopicsCount}/{r.totalTopics}</span>
                              <div className="tbl-progress-bar">
                                <div className="tbl-progress-fill" style={{ width: `${r.completionPct}%`, background: r.status === 'completed' ? '#10b981' : 'var(--indigo)' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--accent)', fontSize: '0.84rem' }}>
                            {r.questionsSolved ?? 0}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {r.estimatedCompletionDays != null ? `~${r.estimatedCompletionDays}d` : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-pill ${r.status === 'completed' ? 'mastered' : r.status === 'in_progress' ? 'inprogress' : 'notstarted'}`}>
                              {r.status === 'completed' ? 'Completed' : r.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {r.startedAt ? new Date(r.startedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'}
                          </td>
                        </>
                      )}

                      {activeTab === 'inactivity-audit' && (
                        <>
                          <td style={{ fontWeight: 700 }}>{r.trainerName}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.empId}</td>
                          <td><span className="scorecard-chip">{r.team}</span></td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: r.riskTier === 'high' ? 'var(--error)' : r.riskTier === 'medium' ? '#f59e0b' : 'var(--text-secondary)' }}>
                            {r.daysInactive}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`status-pill ${r.riskTier === 'high' ? 'highrisk' : r.riskTier === 'medium' ? 'mediumrisk' : 'ontrack'}`}>
                              {r.riskLevel}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.85rem', color: r.engagementScore >= 60 ? '#10b981' : r.engagementScore >= 30 ? '#f59e0b' : 'var(--error)' }}>
                            {r.engagementScore ?? 0}<span style={{ fontSize: '0.65rem', fontWeight: 400 }}>/100</span>
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.82rem', fontWeight: 700, color: r.trend === 'Improving' ? '#10b981' : r.trend === 'Stable' ? '#f59e0b' : 'var(--error)' }}>
                            {r.trend === 'Improving' ? '↑ Improving' : r.trend === 'Stable' ? '→ Stable' : '↓ Declining'}
                          </td>
                          <td style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {r.lastActivityType ?? '—'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 800, color: '#10b981' }}>🎓 {r.itDaysCount}</td>
                          <td style={{ fontSize: '0.8rem', color: r.riskTier === 'high' ? 'var(--error)' : 'var(--text-muted)' }}>
                            {r.actionRecommendation}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {sortedRows.length > 0 && (
          <div className="reports-pagination">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>Show</span>
              <select
                className="filter-select"
                style={{ padding: '0.25rem 0.5rem', minWidth: 'auto' }}
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={15}>15 rows</option>
                <option value={30}>30 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
              </select>
              <span>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({sortedRows.length} total records)
              </span>
            </div>

            <div className="pagination-controls">
              <button
                className="page-num-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                ◀
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                let pageNum = idx + 1;
                if (totalPages > 5 && currentPage > 3) {
                  pageNum = Math.min(totalPages - 4 + idx, currentPage - 2 + idx);
                }
                return (
                  <button
                    key={pageNum}
                    className={`page-num-btn ${currentPage === pageNum ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="page-num-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                ▶
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
