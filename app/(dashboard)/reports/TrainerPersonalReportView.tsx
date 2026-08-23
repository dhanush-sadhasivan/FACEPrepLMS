'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import './reports.css';

interface TrainerPersonalReportViewProps {
  data: any;
}

export default function TrainerPersonalReportView({ data }: TrainerPersonalReportViewProps) {
  const profile = data?.profile || {};
  const summary = data?.summary || {};
  const contests = data?.contests || [];
  const roadmaps = data?.roadmaps || [];
  const courses = data?.courses || [];

  const [activeTab, setActiveTab] = useState<'contests' | 'roadmaps' | 'courses'>('contests');

  const exportPersonalCsv = () => {
    const csvSections: any[] = [];

    // Header info
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Name', Value: profile.fullName });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Emp ID', Value: profile.empId });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Email', Value: profile.email });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Team', Value: profile.team });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Manager', Value: profile.manager });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'HackerRank ID', Value: profile.hackerrankId });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Total IT Days Logged', Value: summary.itDaysCount });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Total Score', Value: summary.totalScore });
    csvSections.push({ Section: 'TRAINER PROFILE', Field: 'Total Solved Problems', Value: summary.totalSolved });

    contests.forEach((c: any) => {
      csvSections.push({
        Section: 'CONTEST PERFORMANCE',
        Field: c.title,
        Value: `Solved: ${c.solvedCount}/${c.totalQuestions} | Score: ${c.score}/${c.maxScore} (${c.completionPct}%)`,
      });
    });

    roadmaps.forEach((r: any) => {
      csvSections.push({
        Section: 'TOPIC ROADMAPS',
        Field: r.title,
        Value: `Topics: ${r.completedTopics}/${r.totalTopics} (${r.completionPct}%) - Status: ${r.status}`,
      });
    });

    const csv = Papa.unparse(csvSections);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Trainer_Transcript_${profile.empId || 'report'}.csv`;
    a.click();
  };

  const exportPersonalExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary Profile
    const profileData = [
      { Parameter: 'Full Name', Value: profile.fullName },
      { Parameter: 'Employee ID', Value: profile.empId },
      { Parameter: 'Email Address', Value: profile.email },
      { Parameter: 'Team / Cohort', Value: profile.team },
      { Parameter: 'Reporting Manager', Value: profile.manager },
      { Parameter: 'HackerRank Username', Value: profile.hackerrankId },
      { Parameter: 'Total IT Days Logged', Value: summary.itDaysCount },
      { Parameter: 'Total HackerRank Score', Value: summary.totalScore },
      { Parameter: 'Total Solved Questions', Value: summary.totalSolved },
      { Parameter: 'Contests Mastered (100%)', Value: summary.contestsMastered },
      { Parameter: 'Completed Roadmaps', Value: summary.roadmapsCompleted },
    ];
    const wsProfile = XLSX.utils.json_to_sheet(profileData);
    XLSX.utils.book_append_sheet(wb, wsProfile, 'Overview & Profile');

    // Sheet 2: Contests
    const contestRows = contests.map((c: any) => ({
      Contest: c.title,
      'HackerRank Slug': c.hackerrankSlug,
      'Solved Questions': c.solvedCount,
      'Total Questions': c.totalQuestions,
      'Completion Rate (%)': `${c.completionPct}%`,
      'Score Earned': c.score,
      'Max Score': c.maxScore,
    }));
    const wsContests = XLSX.utils.json_to_sheet(contestRows.length > 0 ? contestRows : [{ Note: 'No contest submissions' }]);
    XLSX.utils.book_append_sheet(wb, wsContests, 'Contest Submissions');

    // Sheet 3: Roadmaps
    const roadmapRows = roadmaps.map((r: any) => ({
      Roadmap: r.title,
      Domain: r.domain,
      Level: r.level,
      'Completed Topics': r.completedTopics,
      'Total Topics': r.totalTopics,
      'Completion Rate (%)': `${r.completionPct}%`,
      Status: r.status,
    }));
    const wsRoadmaps = XLSX.utils.json_to_sheet(roadmapRows.length > 0 ? roadmapRows : [{ Note: 'No roadmaps assigned' }]);
    XLSX.utils.book_append_sheet(wb, wsRoadmaps, 'Topic Roadmaps');

    // Sheet 4: Courses
    const courseRows = courses.map((ca: any) => ({
      Course: ca.title,
      Category: ca.category,
      Level: ca.level,
      'Due Date': ca.dueDate ? new Date(ca.dueDate).toLocaleDateString() : 'Self-Paced',
    }));
    const wsCourses = XLSX.utils.json_to_sheet(courseRows.length > 0 ? courseRows : [{ Note: 'No courses assigned' }]);
    XLSX.utils.book_append_sheet(wb, wsCourses, 'Courses & Badges');

    XLSX.writeFile(wb, `Trainer_Scorecard_${profile.empId || 'report'}.xlsx`);
  };

  const initial = (profile.fullName || 'T').charAt(0).toUpperCase();

  return (
    <div className="reports-page">
      {/* Header */}
      <div className="reports-header">
        <div>
          <h1 className="reports-title">
            <span>📊</span> My Performance Transcript &amp; Scorecard
          </h1>
          <p className="reports-subtitle">
            View your complete learning record, contest solutions, internal training attendance, and export official transcripts.
          </p>
        </div>
        <div className="export-actions">
          <button className="btn-export-csv" onClick={exportPersonalCsv} title="Export CSV Summary">
            <span>📥</span> Export CSV Transcript
          </button>
          <button className="btn-export-excel" onClick={exportPersonalExcel} title="Export Detailed Multi-Sheet Excel">
            <span>📊</span> Export Scorecard (.xlsx)
          </button>
        </div>
      </div>

      {/* Hero Profile Card */}
      <div className="personal-scorecard-hero">
        <div className="scorecard-user-info">
          <div className="scorecard-avatar">{initial}</div>
          <div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {profile.fullName || 'Trainer'}
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {profile.email} &bull; <strong style={{ color: 'var(--text-secondary)' }}>{profile.empId}</strong>
            </div>
            <div className="scorecard-meta-chips">
              <span className="scorecard-chip">👥 Team: {profile.team || 'General'}</span>
              <span className="scorecard-chip">👔 Manager: {profile.manager || '—'}</span>
              <span className="scorecard-chip" style={{ color: 'var(--success)' }}>
                ⚡ HackerRank: {profile.hackerrankId || 'Not linked'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
            Internal Training Days
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: '#10b981', lineHeight: 1.1 }}>
            🎓 {summary.itDaysCount || 0}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Last Active: {profile.lastItCheckDate ? new Date(profile.lastItCheckDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(240, 82, 55, 0.12)', color: 'var(--accent)' }}>
            🏆
          </div>
          <div className="kpi-details">
            <span className="kpi-val">{summary.totalScore || 0}</span>
            <span className="kpi-label">Contest Points</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            ✅
          </div>
          <div className="kpi-details">
            <span className="kpi-val">{summary.totalSolved || 0}</span>
            <span className="kpi-label">Problems Solved</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(99, 102, 241, 0.12)', color: 'var(--indigo)' }}>
            🥇
          </div>
          <div className="kpi-details">
            <span className="kpi-val">{summary.contestsMastered || 0}</span>
            <span className="kpi-label">Mastered Contests</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' }}>
            🗺️
          </div>
          <div className="kpi-details">
            <span className="kpi-val">{summary.roadmapsCompleted || 0}</span>
            <span className="kpi-label">Completed Roadmaps</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="report-tabs-bar">
        <button
          className={`report-tab-btn ${activeTab === 'contests' ? 'active' : ''}`}
          onClick={() => setActiveTab('contests')}
        >
          <span>🏆</span> Contests &amp; Submissions
          <span className="tab-badge">{contests.length}</span>
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'roadmaps' ? 'active' : ''}`}
          onClick={() => setActiveTab('roadmaps')}
        >
          <span>🗺️</span> Topic Roadmaps
          <span className="tab-badge">{roadmaps.length}</span>
        </button>
        <button
          className={`report-tab-btn ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          <span>🎓</span> Courses &amp; Badges
          <span className="tab-badge">{courses.length}</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'contests' && (
        <div className="report-table-card">
          <div className="table-responsive">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Contest Title</th>
                  <th>HackerRank Slug</th>
                  <th>Solved Questions</th>
                  <th>Completion Progress</th>
                  <th style={{ textAlign: 'right' }}>Score Earned</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {contests.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No contest submissions recorded yet. Participate in assigned contests to earn points!
                    </td>
                  </tr>
                ) : (
                  contests.map((c: any, i: number) => {
                    const isMastered = c.completionPct >= 100;
                    return (
                      <tr key={c.contestId || i}>
                        <td style={{ fontWeight: 700 }}>{c.title}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {c.hackerrankSlug}
                        </td>
                        <td>
                          {c.solvedCount} / {c.totalQuestions}
                        </td>
                        <td>
                          <div className="tbl-progress-wrap">
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '35px' }}>
                              {c.completionPct}%
                            </span>
                            <div className="tbl-progress-bar">
                              <div
                                className="tbl-progress-fill"
                                style={{
                                  width: `${c.completionPct}%`,
                                  background: isMastered ? '#10b981' : 'var(--accent)',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 900, color: 'var(--accent)' }}>
                          {c.score} / {c.maxScore} pts
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-pill ${isMastered ? 'mastered' : 'inprogress'}`}>
                            {isMastered ? '👑 Mastered' : '⚡ In Progress'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'roadmaps' && (
        <div className="report-table-card">
          <div className="table-responsive">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Roadmap Title</th>
                  <th>Domain</th>
                  <th>Level</th>
                  <th>Topics Completed</th>
                  <th>Progress</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {roadmaps.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No roadmaps assigned yet.
                    </td>
                  </tr>
                ) : (
                  roadmaps.map((r: any, i: number) => {
                    const isDone = r.status === 'completed' || r.completionPct >= 100;
                    return (
                      <tr key={r.roadmapId || i}>
                        <td style={{ fontWeight: 700 }}>{r.title}</td>
                        <td>
                          <span className="scorecard-chip">{r.domain || 'General'}</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.level}</td>
                        <td>
                          {r.completedTopics} / {r.totalTopics}
                        </td>
                        <td>
                          <div className="tbl-progress-wrap">
                            <span style={{ fontSize: '0.78rem', fontWeight: 800, minWidth: '35px' }}>
                              {r.completionPct}%
                            </span>
                            <div className="tbl-progress-bar">
                              <div
                                className="tbl-progress-fill"
                                style={{
                                  width: `${r.completionPct}%`,
                                  background: isDone ? '#10b981' : 'var(--indigo)',
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-pill ${isDone ? 'completed' : r.status === 'in_progress' ? 'inprogress' : 'notstarted'}`}>
                            {isDone ? '✅ Completed' : r.status === 'in_progress' ? '⚡ In Progress' : '⏳ Not Started'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="report-table-card">
          <div className="table-responsive">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Course Title</th>
                  <th>Category</th>
                  <th>Level</th>
                  <th>Schedule / Due Date</th>
                </tr>
              </thead>
              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No courses assigned yet.
                    </td>
                  </tr>
                ) : (
                  courses.map((c: any, i: number) => (
                    <tr key={c.courseId || i}>
                      <td style={{ fontWeight: 700 }}>{c.title}</td>
                      <td>
                        <span className="scorecard-chip">{c.category || 'General'}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.level}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                        {c.dueDate ? new Date(c.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Self-Paced'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
