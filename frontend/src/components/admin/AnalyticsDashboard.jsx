import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';

export default function AnalyticsDashboard() {
  const [overview, setOverview] = useState(null);
  const [dailyData, setDailyData] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [overRes, dailyRes, catRes] = await Promise.all([
        fetch(`${API_BASE}/admin/support/analytics/overview`),
        fetch(`${API_BASE}/admin/support/analytics/daily?days=30`),
        fetch(`${API_BASE}/admin/support/analytics/categories`)
      ]);

      const overData = await overRes.json();
      const dayData = await dailyRes.json();
      const categoryData = await catRes.json();

      if (overData.success) setOverview(overData.stats);
      if (dayData.success) setDailyData(dayData.data);
      if (categoryData.success) setCategories(categoryData.categories);

    } catch (err) {
      console.warn('Failed to load support analytics:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleExportCSV = () => {
    window.open(`${API_BASE}/admin/support/export?format=csv`, '_blank');
  };

  if (loading) return <div style={{ color: 'var(--text-secondary)', padding: '24px' }}>Loading analytics reports...</div>;

  // Compute maximum ticket count for scaling SVG charts
  const maxDailyTotal = dailyData.length > 0 ? Math.max(...dailyData.map(d => d.total || 1)) : 10;
  const maxCategoryCount = categories.length > 0 ? Math.max(...categories.map(c => c.count || 1)) : 10;

  return (
    <div className="analytics-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '24px', color: 'var(--text)' }}>
      
      {/* Stats Cards Row */}
      {overview && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginBottom: '4px', textTransform: 'uppercase' }}>Total Tickets</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{overview.totalTickets}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', color: '#f59e0b', marginBottom: '4px', textTransform: 'uppercase' }}>Open Tickets</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#f59e0b' }}>{overview.openTickets}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', color: '#ef4444', marginBottom: '4px', textTransform: 'uppercase' }}>Critical Open</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#ef4444' }}>{overview.criticalOpenTickets}</div>
          </div>
          <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', color: '#10b981', marginBottom: '4px', textTransform: 'uppercase' }}>Avg Resolution</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#10b981' }}>{overview.avgResolutionHours}h</div>
          </div>
          <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary, #94a3b8)', marginBottom: '4px', textTransform: 'uppercase' }}>AI Confidence</div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>{(overview.avgConfidenceScore * 100).toFixed(0)}%</div>
          </div>
          <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '16px', borderRadius: '12px' }}>
            <div style={{ fontSize: '11px', color: '#ec4899', marginBottom: '4px', textTransform: 'uppercase' }}>Handoffs</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#ec4899' }}>{overview.activeHandoffs}</div>
          </div>
        </div>
      )}

      {/* Main Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Chart 1: Stacked bar chart */}
        <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700 }}>Daily Tickets Volume (Last 30 Days)</h4>
          {dailyData.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', color: 'var(--text-secondary)' }}>No volume data recorded.</div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', height: '180px', gap: '4px', paddingBottom: '8px' }}>
              {dailyData.map((d, i) => {
                const total = d.total || 0;
                const scale = total > 0 ? (total / maxDailyTotal) * 150 : 0;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }} title={`${d.date}: ${total} tickets`}>
                    <div style={{ display: 'flex', flexDirection: 'column-reverse', width: '100%', height: '150px', background: 'rgba(255,255,255,0.02)', borderRadius: '2px', overflow: 'hidden', justifyContent: 'flex-start' }}>
                      <div style={{ height: `${scale}px`, background: 'var(--primary, #6366f1)', borderRadius: '2px 2px 0 0' }} />
                    </div>
                    <span style={{ fontSize: '8px', color: 'var(--text-secondary)', marginTop: '4px', transform: 'rotate(-45deg)', transformOrigin: 'top left', display: 'inline-block', height: '12px' }}>
                      {d.date.split('-')[2]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Chart 2: Category distribution progress bars */}
        <div style={{ background: 'var(--bg-secondary, #1e293b)', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '20px', borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700 }}>Ticket Categories Breakdown</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {categories.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No categories data.</div>
            ) : (
              categories.map((c, i) => {
                const scale = (c.count / maxCategoryCount) * 100;
                return (
                  <div key={i} style={{ fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{c.category.replace('_', ' ')}</span>
                      <strong>{c.count} tickets</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${scale}%`, height: '100%', background: '#10b981', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span>Avg Confidence: {(c.avgConfidence * 100).toFixed(0)}%</span>
                      <span>Avg Resolution: {c.avgResolutionHours}h</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* CSV Export & Actions bar */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(99,102,241,0.05)',
          border: '1px solid rgba(99,102,241,0.2)',
          borderRadius: '12px',
          padding: '16px'
        }}
      >
        <div style={{ fontSize: '13px' }}>
          <strong>Support Ticket Records Exporter</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>Download a spreadsheet CSV compilation of all ticket metrics for external archiving.</p>
        </div>
        <button
          onClick={handleExportCSV}
          style={{
            background: 'var(--primary, #6366f1)',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 18px',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          📥 Download CSV Export
        </button>
      </div>

    </div>
  );
}
