/**
 * UI visual maps for ticket priorities and severities
 */
export const SEVERITY_COLORS = {
  LOW: {
    bg: 'var(--bg-tertiary, rgba(148, 163, 184, 0.15))',
    text: '#94a3b8',
    border: 'rgba(148, 163, 184, 0.3)',
    icon: 'info'
  },
  MEDIUM: {
    bg: 'rgba(245, 158, 11, 0.15)',
    text: '#f59e0b',
    border: 'rgba(245, 158, 11, 0.3)',
    icon: 'clock'
  },
  HIGH: {
    bg: 'rgba(239, 68, 68, 0.15)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)',
    icon: 'alert'
  },
  CRITICAL: {
    bg: 'rgba(220, 38, 38, 0.25)',
    text: '#dc2626',
    border: '#dc2626',
    icon: 'zap'
  }
};

export const getSeverityStyle = (severity = 'MEDIUM') => {
  const upper = severity.toUpperCase();
  return SEVERITY_COLORS[upper] || SEVERITY_COLORS.MEDIUM;
};
