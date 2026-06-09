import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../config';
import { Ic } from '../components/Icons';

// Phase 2 Support Imports
import useSupportSession from '../hooks/useSupportSession';
import useAIChat from '../hooks/useAIChat';
import useEscalation from '../hooks/useEscalation';
import useHandoff from '../hooks/useHandoff';
import SessionSidebar from '../components/support/SessionSidebar';
import AIMessageBubble, { formatMessageText, renderMarkdownAndHashes } from '../components/support/AIMessageBubble';
import ContextPreview from '../components/support/ContextPreview';
import PromptSuggestions from '../components/support/PromptSuggestions';
import HumanHandoffBanner from '../components/support/HumanHandoffBanner';
import TypingIndicator from '../components/support/TypingIndicator';
import EscalationModal from '../components/support/EscalationModal';
import '../components/support/support.css';

const CATEGORIES = [
  { value: 'payment_failed', label: 'Payment Failed', icon: 'x', color: 'var(--danger)' },
  { value: 'settlement_delayed', label: 'Settlement Delayed', icon: 'history', color: 'var(--warning)' },
  { value: 'pricing_issue', label: 'Pricing Issue', icon: 'chart', color: 'var(--primary)' },
  { value: 'account_issue', label: 'Account Issue', icon: 'wallet', color: '#8b5cf6' },
  { value: 'feature_request', label: 'Feature Request', icon: 'zap', color: '#06b6d4' },
  { value: 'general', label: 'General Inquiry', icon: 'help', color: 'var(--text-secondary)' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#64748b' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'urgent', label: 'Urgent', color: '#dc2626' },
];

const STATUS_BADGES = {
  open: { label: 'Open', bg: 'var(--primary-light)', color: 'var(--primary)', icon: 'alert' },
  in_progress: { label: 'In Progress', bg: '#fef3c7', color: '#d97706', icon: 'refresh' },
  resolved: { label: 'Resolved', bg: '#d1fae5', color: '#059669', icon: 'check' },
  closed: { label: 'Closed', bg: 'var(--bg-tertiary)', color: 'var(--text-secondary)', icon: 'x' },
};

const FAQ_ITEMS = [
  {
    q: 'How do PharosPay payments work?',
    a: 'PharosPay converts your PROS tokens to local fiat currency (INR, BRL, SGD, etc.) and settles directly to the merchant\'s bank account or mobile wallet using local payment rails like UPI, PIX, PayNow, and ACH.'
  },
  {
    q: 'Why is my payment stuck in "Pending Settlement"?',
    a: 'Settlement typically completes within 30 seconds for instant rails (UPI, PIX). If delayed beyond 5 minutes, check the blockchain confirmation status. The settlement engine retries automatically up to 3 times.'
  },
  {
    q: 'How is the PROS price determined?',
    a: 'PROS/USD price is fetched live from the Coinbase Exchange API every 30 seconds. If Coinbase is unreachable and the cached price is older than 5 minutes, payments are blocked to protect you from stale pricing.'
  },
  {
    q: 'Can I get a receipt for my payment?',
    a: 'Yes. Visit the History page and click "View Receipt" on any completed payment. You can download a PDF receipt, share it via link, or copy the transaction details.'
  },
  {
    q: 'What payment rails are supported?',
    a: 'PharosPay currently supports UPI (India), PIX (Brazil), PayNow (Singapore), ACH (USA), SEPA (Europe), Faster Payments (UK), PromptPay (Thailand), and PayPay (Japan).'
  },
  {
    q: 'What happens if the blockchain transaction reverts?',
    a: 'If the on-chain transaction reverts (e.g., due to insufficient PROS balance or gas), the payment will show as "Failed". No fiat settlement is initiated, and no funds are deducted. You can retry the payment.'
  },
  {
    q: 'How do I become a merchant?',
    a: 'Navigate to Merchant OS in the sidebar. Complete the 4-step onboarding: register your business profile, pass KYC verification, link your payout bank account, and you\'re ready to receive payments.'
  },
  {
    q: 'What fees does PharosPay charge?',
    a: 'PharosPay charges a small platform fee (visible in the quote breakdown). The fee is deducted from the PROS amount before settlement. There are no hidden charges: the quoted amount is exactly what you pay.'
  }
];

function timeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - new Date(date)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function Support({ wallet }) {
  const [activeTab, setActiveTab] = useState('ai_chat');
  
  // Phase 2 Support Session Hooks
  const { sessionId, sessions, loadingSessions, startNewSession, switchSession } = useSupportSession(wallet.address);
  const { messages, loading: loadingChat, typing, sendMessage } = useAIChat(wallet.address, sessionId);
  const { handoffStatus, bannerMessage } = useHandoff(sessionId);
  const { escalate } = useEscalation(wallet.address, sessionId);

  const [escalationOpen, setEscalationOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [aiStatus, setAiStatus] = useState({ enabled: false, provider: '', model: '' });
  const [showDebug, setShowDebug] = useState(false);
  const [debugClickCount, setDebugClickCount] = useState(0);
  const [ticketTyping, setTicketTyping] = useState(false);

  // Mobile sidebar drawer
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Client-side dynamic session details pre-fetching
  const [sessionDetails, setSessionDetails] = useState({});
  const fetchingSessionIds = useRef(new Set());

  const generateClientSessionTitle = (firstUserMessageContent) => {
    if (!firstUserMessageContent) return 'Support Session';
    const text = firstUserMessageContent.toLowerCase();
    
    if (text.includes('payment') || text.includes('pay') || text.includes('failed') || text.includes('revert') || text.includes('debit') || text.includes('wrong') || text.includes('price') || text.includes('rate') || text.includes('pros') || text.includes('usd') || text.includes('inr')) {
      return 'Wrong Payment Issue';
    }
    if (text.includes('settle') || text.includes('delay') || text.includes('payout') || text.includes('receive') || text.includes('bank') || text.includes('pending') || text.includes('routing') || text.includes('router')) {
      return 'Settlement Delay';
    }
    if (text.includes('receipt') || text.includes('verify') || text.includes('proof') || text.includes('pdf') || text.includes('explorer') || text.includes('pharosscan')) {
      return 'Receipt Verification';
    }
    if (text.includes('tx') || text.includes('hash') || text.includes('transaction') || text.includes('blockchain') || text.includes('oracle') || text.includes('support') || text.includes('atlantic') || text.includes('testnet') || text.includes('ca')) {
      return 'Transaction Support';
    }
    return 'Support Session';
  };

  useEffect(() => {
    if (!sessions || sessions.length === 0) return;
    
    sessions.forEach(async (sess) => {
      if (sessionDetails[sess.sessionId] || fetchingSessionIds.current.has(sess.sessionId)) return;
      
      fetchingSessionIds.current.add(sess.sessionId);
      try {
        const res = await fetch(`${API_BASE}/support/session/${sess.sessionId}/messages`);
        const data = await res.json();
        if (data.success && data.messages) {
          const validMsgs = data.messages.filter(m => m.content !== '[New Support Session Initiated]');
          if (validMsgs.length > 0) {
            const firstUser = validMsgs.find(m => m.senderType === 'user');
            const lastMsg = validMsgs[validMsgs.length - 1];
            
            setSessionDetails(prev => ({
              ...prev,
              [sess.sessionId]: {
                title: generateClientSessionTitle(firstUser?.content || lastMsg?.content),
                lastMessage: lastMsg?.content || '',
                lastAiMessage: validMsgs.filter(m => m.senderType === 'ai').pop()?.content || ''
              }
            }));
          } else {
            setSessionDetails(prev => ({
              ...prev,
              [sess.sessionId]: {
                title: 'Support Session',
                lastMessage: '',
                lastAiMessage: ''
              }
            }));
          }
        }
      } catch (err) {
        console.error('Failed to pre-fetch session details:', err);
        fetchingSessionIds.current.delete(sess.sessionId);
      }
    });
  }, [sessions, sessionDetails]);

  const enrichedSessions = sessions.map(sess => {
    const isActive = sess.sessionId === sessionId;
    if (isActive && messages.length > 0) {
      const validMsgs = messages.filter(m => m.content !== '[New Support Session Initiated]');
      if (validMsgs.length > 0) {
        const firstUser = validMsgs.find(m => m.senderType === 'user');
        const lastMsg = validMsgs[validMsgs.length - 1];
        return {
          ...sess,
          title: generateClientSessionTitle(firstUser?.content || lastMsg?.content),
          lastMessage: lastMsg?.content || '',
          lastAiMessage: validMsgs.filter(m => m.senderType === 'ai').pop()?.content || ''
        };
      }
    }
    
    const details = sessionDetails[sess.sessionId];
    if (details) {
      return {
        ...sess,
        title: details.title,
        lastMessage: details.lastMessage,
        lastAiMessage: details.lastAiMessage
      };
    }
    return sess;
  });

  const handleTitleClick = () => {
    setDebugClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowDebug(curr => !curr);
        return 0;
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`${API_BASE}/support/status`);
        const data = await res.json();
        setAiStatus(data);
      } catch (err) {
        console.error('Failed to fetch AI Support status:', err);
      }
    };
    fetchStatus();
  }, []);

  const aiChatMessagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll AI chat messages robust implementation
  const scrollToBottom = useCallback(() => {
    const chatContainer = document.querySelector('.chat-messages-area');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    if (aiChatMessagesEndRef.current) {
      aiChatMessagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, typing, scrollToBottom, activeTab]);

  // Auto-open escalation modal if AI flags high/critical issue
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.senderType === 'ai' && lastMsg.metadata) {
        const sev = lastMsg.metadata.severity;
        if (lastMsg.metadata.needsEscalation || sev === 'HIGH' || sev === 'CRITICAL') {
          setEscalationOpen(true);
        }
      }
    }
  }, [messages]);

  // Handle Escalation Modal Submit — forward ALL form fields including walletAddress + transactionHash
  const handleEscalateSubmit = async (formData) => {
    const lastAiMsg = [...messages].reverse().find(m => m.senderType === 'ai');
    const severity = formData.urgency?.toUpperCase() || lastAiMsg?.metadata?.severity || 'MEDIUM';
    const confidence = lastAiMsg?.metadata?.confidence || 0.85;
    const ticketId = lastAiMsg?.metadata?.ticketId || null;

    const res = await escalate({
      ...formData,
      // Ensure these critical fields are explicitly forwarded
      walletAddress: formData.walletAddress || wallet.address,
      transactionHash: formData.transactionHash || null,
      severity,
      confidence,
      ticketId
    });
    return !!res;
  };

  // Auto-expand textarea
  const autoExpand = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, []);

  useEffect(() => { autoExpand(); }, [inputText, autoExpand]);

  const handleSendAI = (e) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    sendMessage(text);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendAI();
    }
  };

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create Ticket form state
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(null);

  // Reply state
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef(null);

  // FAQ state
  const [openFaq, setOpenFaq] = useState(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all');

  // Mobile detection
  const [isMob, setIsMob] = useState(window.innerWidth < 768);
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024);
  useEffect(() => {
    const h = () => {
      setIsMob(window.innerWidth < 768);
      setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  // Load tickets when tab switches
  useEffect(() => {
    if (activeTab === 'tickets' && wallet.isConnected && wallet.address) {
      fetchTickets();
    }
  }, [activeTab, wallet.isConnected, wallet.address]);

  // Scroll messages to bottom robust implementation
  const scrollTicketToBottom = useCallback(() => {
    const ticketContainer = document.querySelector('.ticket-messages-container');
    if (ticketContainer) {
      ticketContainer.scrollTop = ticketContainer.scrollHeight;
    }
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    scrollTicketToBottom();
    const timer = setTimeout(scrollTicketToBottom, 100);
    return () => clearTimeout(timer);
  }, [ticketDetail?.messages, ticketTyping, scrollTicketToBottom, activeTab]);

  // Auto-detect category preview
  const previewCategory = category || (subject || description
    ? CATEGORIES.find(c => {
        const text = `${subject} ${description}`.toLowerCase();
        const keywords = {
          payment_failed: ['payment failed', 'failed', 'error', 'reverted'],
          settlement_delayed: ['settlement', 'delayed', 'not received', 'pending'],
          pricing_issue: ['price', 'rate', 'conversion', 'overcharged'],
          account_issue: ['wallet', 'connect', 'login', 'kyc'],
          feature_request: ['feature', 'suggestion', 'please add'],
        };
        return (keywords[c.value] || []).some(k => text.includes(k));
      })?.value || 'general'
    : '');

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await fetch(`${API_BASE}/support/tickets?wallet=${wallet.address}`);
      const data = await res.json();
      if (data.success) setTickets(data.tickets);
    } catch (err) {
      console.warn('Failed to load tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchTicketDetail = async (ticketId) => {
    setLoadingDetail(true);
    try {
      const res = await fetch(`${API_BASE}/support/tickets/${ticketId}`);
      const data = await res.json();
      if (data.success) {
        setTicketDetail(data.ticket);
        setSelectedTicket(ticketId);
      }
    } catch (err) {
      console.warn('Failed to load ticket detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!wallet.isConnected || !subject) return;
    setCreating(true);
    setCreateSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: wallet.address,
          subject,
          description,
          category: category || undefined,
          priority: priority || undefined,
          paymentId: paymentId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCreateSuccess(data.ticket);
        setSubject('');
        setDescription('');
        setCategory('');
        setPriority('');
        setPaymentId('');
        setTimeout(() => setCreateSuccess(null), 8000);
      }
    } catch (err) {
      alert('Failed to create ticket. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    const currentReplyText = replyMessage.trim();
    if (!currentReplyText || !selectedTicket) return;
    setSendingReply(true);
    setReplyMessage('');

    // Append user message locally instantly with sending status
    const tempId = 'temp_ticket_' + Date.now();
    setTicketDetail(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: [
          ...(prev.messages || []),
          {
            id: tempId,
            senderType: 'user',
            senderName: wallet.address ? wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4) : 'User',
            message: currentReplyText,
            createdAt: new Date().toISOString(),
            status: 'sending'
          }
        ]
      };
    });

    setTicketTyping(true);

    try {
      const res = await fetch(`${API_BASE}/support/tickets/${selectedTicket}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentReplyText, senderType: 'user' }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTicketDetail(selectedTicket);
      }
    } catch (err) {
      setTicketDetail(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map(m => m.id === tempId ? { ...m, status: 'failed' } : m)
        };
      });
    } finally {
      setSendingReply(false);
      setTicketTyping(false);
    }
  };

  const filteredTickets = tickets.filter(t =>
    statusFilter === 'all' || t.status === statusFilter
  );

  const MAX_INPUT_LENGTH = 2000;
  const charCount = inputText.length;

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (!wallet.isConnected) {
    return (
      <div className="page-enter" style={{ padding: '60px 24px', textAlign: 'center', maxWidth: '480px', margin: '60px auto' }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          boxShadow: '0 4px 20px rgba(59,130,246,0.15)',
        }}>
          <Ic name="help" size={30} color="var(--primary)" />
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', margin: '0 0 8px 0' }}>Connect Your Wallet</h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Connect your wallet to access the AI support assistant, create tickets, and manage your account.
        </p>
      </div>
    );
  }

  return (
    <div className="page-enter" style={{ padding: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto', overflowX: 'hidden' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 
            onClick={handleTitleClick}
            style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ic name="help" size={20} color="#fff" />
            </div>
            Support Center
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Get help with payments, settlements, and account issues</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '8px', marginBottom: '24px' }}>
        {[
          { id: 'ai_chat', label: 'AI Assistant', icon: 'chat' },
          { id: 'create', label: 'New Ticket', icon: 'plus' },
          { id: 'tickets', label: 'My Tickets', icon: 'ticket' },
          { id: 'faq', label: 'FAQ & Help', icon: 'help' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSelectedTicket(null); setTicketDetail(null); }}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 800 : 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'var(--transition)',
              fontFamily: 'inherit',
            }}
          >
            <Ic name={tab.icon} size={15} color={activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)'} />
            {tab.label}
            {tab.id === 'tickets' && tickets.length > 0 && (
              <span style={{
                fontSize: '11px', fontWeight: 800, background: 'var(--primary)',
                color: '#fff', borderRadius: '10px', padding: '1px 7px', minWidth: '18px', textAlign: 'center'
              }}>
                {tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length || tickets.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: AI CHAT — Premium redesign
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai_chat' && (
        <>
          {/* Mobile drawer */}
          {isMob && mobileDrawerOpen && (
            <>
              <div className="mobile-drawer-overlay" onClick={() => setMobileDrawerOpen(false)} />
              <div className="mobile-drawer">
                <SessionSidebar 
                  sessions={enrichedSessions} 
                  activeSessionId={sessionId} 
                  onSelectSession={(id) => { switchSession(id); setMobileDrawerOpen(false); }} 
                  onNewSession={() => {
                    startNewSession();
                    sendMessage('[New Support Session Initiated]');
                    setMobileDrawerOpen(false);
                  }} 
                  loading={loadingSessions} 
                />
              </div>
            </>
          )}

          <div className="support-chat-shell" style={{ overflowX: 'hidden' }}>
            {/* Desktop / Tablet Session Sidebar */}
            {!isMob && (
              <SessionSidebar 
                sessions={enrichedSessions} 
                activeSessionId={sessionId} 
                onSelectSession={switchSession} 
                onNewSession={() => {
                  startNewSession();
                  sendMessage('[New Support Session Initiated]');
                }} 
                loading={loadingSessions} 
              />
            )}

            {/* Chat Panel */}
            <div className="chat-panel">
              {/* ── Chat Header ────────────────────────────────────────── */}
              <div className="chat-header">
                <div className="chat-header-left">
                  {/* Mobile menu button */}
                  {isMob && (
                    <button
                      onClick={() => setMobileDrawerOpen(true)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        width: '32px', height: '32px',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '14px',
                      }}
                      aria-label="Open sessions"
                    >
                      ☰
                    </button>
                  )}
                  <div className="chat-header-avatar" style={{ overflow: 'hidden', padding: 0 }}>
                    <img 
                      src="/support-logo.png" 
                      alt="PharosPay Support" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} 
                      onError={(e) => { e.target.style.display = 'none'; e.target.parentNode.textContent = '⚡'; }}
                    />
                  </div>
                  <div>
                    <p className="chat-header-name">Pharos Support</p>
                    <p className="chat-header-subtitle">
                      {handoffStatus === 'AI_ONLY' ? 'AI-powered assistant' : 'Live agent connected'}
                    </p>
                  </div>
                  {showDebug && aiStatus.enabled && (
                    <div className="chat-header-status">
                      <span className="chat-header-status-dot" />
                      {aiStatus.provider === 'grok' ? 'Grok' : 'OpenRouter'}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {handoffStatus === 'AI_ONLY' ? (
                    <button className="escalate-btn" onClick={() => setEscalationOpen(true)}>
                      <Ic name="alert" size={12} color="#ef4444" />
                      Escalate
                    </button>
                  ) : (
                    <div className="chat-header-status">
                      <span className="chat-header-status-dot" style={{ background: '#22c55e' }} />
                      Live Agent
                    </div>
                  )}
                </div>
              </div>

              {/* ── Chat Messages Scroll Area ──────────────────────────── */}
              <div className="chat-messages-area support-scroll">
                <HumanHandoffBanner status={handoffStatus} message={bannerMessage} />
                <ContextPreview wallet={wallet.address} sessionId={sessionId} />

                {messages.length <= 1 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <PromptSuggestions 
                      onSelect={(text) => setInputText(text)}
                    />
                  </div>
                ) : (
                  messages.filter(m => m.content !== '[New Support Session Initiated]').map((msg, idx, arr) => {
                    const isNewGroup = idx === 0 || arr[idx - 1].senderType !== msg.senderType;
                    const style = isNewGroup && idx > 0 ? { marginTop: '8px' } : {};

                    if (msg.senderType === 'ai') {
                      return (
                        <AIMessageBubble 
                          key={msg.id} 
                          message={msg} 
                          showDebug={showDebug} 
                          onSelectOption={(opt) => sendMessage(opt)} 
                          style={style}
                        />
                      );
                    }
                    
                    // User bubble
                    const time = msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    return (
                      <div key={msg.id} className="msg-row user" style={style}>
                        <div className="user-bubble message-content">
                          {renderMarkdownAndHashes(msg.content)}
                        </div>
                        <span className="msg-time" style={{ textAlign: 'right' }}>{time}</span>
                      </div>
                    );
                  })
                )}

                {typing && <TypingIndicator />}
                <div ref={aiChatMessagesEndRef} />
              </div>

              {/* ── Bottom Input Area ──────────────────────────────────── */}
              <div className="chat-input-area">


                <form onSubmit={handleSendAI}>
                  <div className="chat-input-wrapper">
                    <textarea
                      ref={textareaRef}
                      className="chat-textarea"
                      value={inputText}
                      onChange={(e) => {
                        if (e.target.value.length <= MAX_INPUT_LENGTH) {
                          setInputText(e.target.value);
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask Pharos Support anything…"
                      rows={1}
                    />
                    <button
                      type="submit"
                      className="send-btn"
                      disabled={loadingChat || typing || !inputText.trim()}
                    >
                      <Ic name="send" size={16} color="#fff" />
                    </button>
                  </div>
                  <div className="chat-input-meta">
                    <span className="input-hint">
                      Enter to send · Shift+Enter for new line
                    </span>
                    <span className={`char-counter ${charCount > 1800 ? (charCount > 1950 ? 'danger' : 'warn') : ''}`}>
                      {charCount > 0 ? `${charCount}/${MAX_INPUT_LENGTH}` : ''}
                    </span>
                  </div>
                </form>
              </div>
            </div>

            {/* Escalation Modal */}
            <EscalationModal 
              isOpen={escalationOpen} 
              onClose={() => setEscalationOpen(false)} 
              onSubmit={handleEscalateSubmit} 
              ticketId={messages.find(m => m.metadata?.ticketId)?.metadata?.ticketId}
              userWallet={wallet.address}
            />
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: Create Ticket (unchanged logic, same premium styling)
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'create' && (
        <div className="page-enter">
          {createSuccess && (
            <div className="card" style={{
              padding: '16px 20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px',
              border: '1px solid var(--success)', background: 'var(--success-light)',
            }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ic name="check" size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--success-dark)', margin: 0 }}>
                  Ticket Created | {createSuccess.ticketNumber}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Category: {CATEGORIES.find(c => c.value === createSuccess.category)?.label || createSuccess.category} • Priority: {createSuccess.priority?.toUpperCase()}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleCreateTicket} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Ic name="ticket" size={18} color="var(--primary)" />
                Create Support Ticket
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Describe your issue and our team will respond promptly.</p>
            </div>

            {/* Subject */}
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <div className="form-input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of your issue"
                  required
                  maxLength={255}
                />
              </div>
            </div>

            {/* Description */}
            <div className="form-group">
              <label className="form-label">Description</label>
              <div className="form-input-wrapper" style={{ height: 'auto' }}>
                <textarea
                  className="form-input"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide detailed information about your issue. Include any error messages, transaction hashes, or screenshots."
                  rows={5}
                  style={{ resize: 'vertical', minHeight: '100px', fontFamily: 'inherit', border: 'none', outline: 'none', width: '100%', background: 'transparent', padding: '12px', fontSize: '14px', color: 'var(--text)' }}
                />
              </div>
            </div>

            {/* Category & Priority Row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMob ? '1fr' : '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Category (auto-detected)</label>
                <div className="form-input-wrapper">
                  <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value)} style={{ background: 'transparent', border: 'none' }}>
                    <option value="">Auto-detect from description</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                {previewCategory && !category && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Ic name={CATEGORIES.find(c => c.value === previewCategory)?.icon || 'help'} size={12} color={CATEGORIES.find(c => c.value === previewCategory)?.color} />
                    Auto-detected: {CATEGORIES.find(c => c.value === previewCategory)?.label}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Priority</label>
                <div className="form-input-wrapper">
                  <select className="form-input" value={priority} onChange={(e) => setPriority(e.target.value)} style={{ background: 'transparent', border: 'none' }}>
                    <option value="">Auto-assign</option>
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Link Payment (Optional) */}
            <div className="form-group">
              <label className="form-label">Link Payment ID (Optional)</label>
              <div className="form-input-wrapper">
                <input
                  type="text"
                  className="form-input"
                  value={paymentId}
                  onChange={(e) => setPaymentId(e.target.value)}
                  placeholder="Paste a payment UUID or on-chain payment ID"
                />
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>If your issue is related to a specific payment, link it here for faster resolution.</p>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={creating || !subject}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {creating ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  Creating Ticket...
                </>
              ) : (
                <>
                  <Ic name="send" size={16} color="#fff" />
                  Submit Support Ticket
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: My Tickets
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tickets' && !selectedTicket && (
        <div className="page-enter">
          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['all', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '12px', textTransform: 'capitalize' }}
              >
                {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
                {s !== 'all' && (
                  <span style={{ fontSize: '10px', marginLeft: '4px', opacity: 0.7 }}>
                    ({tickets.filter(t => t.status === s).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {loadingTickets ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: '28px', height: '28px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading tickets...</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="card" style={{ padding: '40px 24px', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Ic name="ticket" size={22} color="var(--text-secondary)" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px 0' }}>No Tickets Found</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                {statusFilter !== 'all' ? `No ${statusFilter} tickets.` : 'Create your first support ticket to get help.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTickets.map(t => {
                const statusBadge = STATUS_BADGES[t.status] || STATUS_BADGES.open;
                const catInfo = CATEGORIES.find(c => c.value === t.category);
                const priInfo = PRIORITIES.find(p => p.value === t.priority);
                return (
                  <div
                    key={t.id}
                    className="card"
                    onClick={() => fetchTicketDetail(t.id)}
                    style={{
                      padding: '16px 20px', cursor: 'pointer',
                      transition: 'var(--transition)', display: 'flex', alignItems: 'center', gap: '14px',
                    }}
                  >
                    {/* Status icon */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: statusBadge.bg, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <Ic name={statusBadge.icon} size={16} color={statusBadge.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{t.ticketNumber}</span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                          background: statusBadge.bg, color: statusBadge.color
                        }}>
                          {statusBadge.label}
                        </span>
                        {priInfo && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: priInfo.color }}>
                            <Ic name="flag" size={10} color={priInfo.color} /> {priInfo.label}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', margin: '4px 0 2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.subject}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {catInfo && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Ic name={catInfo.icon} size={11} color={catInfo.color} />
                            {catInfo.label}
                          </span>
                        )}
                        <span>{timeAgo(t.createdAt)}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <Ic name="arrow" size={16} color="var(--text-secondary)" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: Ticket Detail (Thread View) */}
      {activeTab === 'tickets' && selectedTicket && (
        <div className="page-enter">
          {/* Back button */}
          <button
            onClick={() => { setSelectedTicket(null); setTicketDetail(null); }}
            className="btn btn-ghost btn-sm"
            style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Ic name="arrowL" size={14} /> Back to Tickets
          </button>

          {loadingDetail ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ width: '28px', height: '28px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading ticket...</p>
            </div>
          ) : ticketDetail && (
            <>
              {/* Ticket Header */}
              <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--primary)', fontFamily: 'monospace' }}>{ticketDetail.ticketNumber}</span>
                      {(() => {
                        const sb = STATUS_BADGES[ticketDetail.status];
                        return (
                          <span className="badge" style={{ background: sb?.bg, color: sb?.color, padding: '3px 8px', fontSize: '10px', fontWeight: 700, borderRadius: '6px' }}>
                            <Ic name={sb?.icon} size={10} color={sb?.color} /> {sb?.label}
                          </span>
                        );
                      })()}
                      {(() => {
                        const pi = PRIORITIES.find(p => p.value === ticketDetail.priority);
                        return pi ? (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: pi.color, display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Ic name="flag" size={10} color={pi.color} /> {pi.label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>{ticketDetail.subject}</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Created {new Date(ticketDetail.createdAt).toLocaleString()} •
                      Category: {CATEGORIES.find(c => c.value === ticketDetail.category)?.label || ticketDetail.category}
                    </p>
                  </div>
                </div>

                {/* Linked Payment */}
                {ticketDetail.linkedPayment && (
                  <div style={{
                    marginTop: '12px', padding: '10px 14px', borderRadius: '8px',
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px'
                  }}>
                    <Ic name="receipt" size={14} color="var(--primary)" />
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>Linked Payment:</span>
                     <span style={{ color: 'var(--text-secondary)' }}>
                      {ticketDetail.linkedPayment.fiatAmount} {ticketDetail.linkedPayment.fiatCurrency} | {ticketDetail.linkedPayment.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Message Thread */}
              <div className="card" style={{ padding: '0', marginBottom: '16px', overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Ic name="chat" size={15} color="var(--primary)" />
                  <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)' }}>Conversation</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>({ticketDetail.messages?.length || 0} messages)</span>
                </div>

                <div className="support-scroll ticket-messages-container" style={{ maxHeight: '400px', overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
                  {ticketDetail.messages?.map((msg, idx, arr) => {
                    const isUser = msg.senderType === 'user';
                    const isSystem = msg.senderType === 'system';
                    const isNewGroup = idx === 0 || arr[idx - 1].senderType !== msg.senderType;
                    const groupStyle = isNewGroup && idx > 0 ? { marginTop: '8px' } : {};
                    return (
                      <div key={msg.id} className="msg-row" style={{
                        alignItems: isUser ? 'flex-end' : isSystem ? 'center' : 'flex-start',
                        animation: 'msg-in 0.3s ease-out forwards',
                        overflowX: 'hidden',
                        ...groupStyle
                      }}>
                        {isSystem ? (
                          <div style={{
                            fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic',
                            textAlign: 'center', width: '100%', padding: '8px 0',
                            borderBottom: '1px dashed var(--border)'
                          }}>
                            <Ic name="alert" size={10} color="var(--text-secondary)" /> {msg.message}
                            <span style={{ display: 'block', fontSize: '10px', marginTop: '2px' }}>{timeAgo(msg.createdAt)}</span>
                          </div>
                        ) : (
                          <>
                            <div style={{
                              fontSize: '10px', fontWeight: 700, marginBottom: '4px',
                              color: isUser ? 'var(--primary)' : '#8b5cf6',
                              display: 'flex', alignItems: 'center', gap: '4px'
                            }}>
                              <Ic name={isUser ? 'wallet' : 'shield'} size={10} color={isUser ? 'var(--primary)' : '#8b5cf6'} />
                              {msg.senderName}
                            </div>
                            <div className={`${isUser ? 'user-bubble' : 'ai-bubble'} message-content`}>
                              {renderMarkdownAndHashes(msg.message)}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                              <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                                {timeAgo(msg.createdAt)}
                              </span>
                              {isUser && msg.status === 'sending' && (
                                <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                  • Sending...
                                </span>
                              )}
                              {isUser && msg.status === 'failed' && (
                                <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 600 }}>
                                  • Failed to send
                                </span>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {ticketTyping && (
                    <div style={{ alignSelf: 'flex-start', marginLeft: '12px' }}>
                      <TypingIndicator />
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply Composer */}
                {ticketDetail.status !== 'closed' && (
                  <form onSubmit={handleSendReply} style={{
                    padding: '12px 20px', borderTop: '1px solid var(--border)',
                    display: 'flex', gap: '10px', alignItems: 'center'
                  }}>
                    <div className="form-input-wrapper" style={{ flex: 1, margin: 0 }}>
                      <input
                        type="text"
                        className="form-input"
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Type your reply..."
                        style={{ fontSize: '13px' }}
                      />
                    </div>
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={sendingReply || !replyMessage.trim()}
                      style={{ flexShrink: 0, height: '38px', padding: '0 16px' }}
                    >
                      {sendingReply ? (
                        <div style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Ic name="send" size={14} color="#fff" />
                      )}
                    </button>
                  </form>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB: FAQ
         ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'faq' && (
        <div className="page-enter" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)', margin: '0 0 4px 0' }}>Frequently Asked Questions</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Quick answers to common questions about PharosPay</p>
          </div>

          {FAQ_ITEMS.map((faq, idx) => (
            <div
              key={idx}
              className="card"
              style={{ padding: 0, overflow: 'hidden', transition: 'var(--transition)' }}
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                style={{
                  width: '100%', padding: '16px 20px', border: 'none', background: 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                    background: openFaq === idx ? 'var(--primary)' : 'var(--bg-tertiary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'var(--transition)'
                  }}>
                    <Ic name="help" size={14} color={openFaq === idx ? '#fff' : 'var(--text-secondary)'} />
                  </div>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>{faq.q}</span>
                </div>
                <Ic name="arrow" size={14} color="var(--text-secondary)" />
              </button>
              {openFaq === idx && (
                <div style={{
                  padding: '0 20px 16px 58px',
                  fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)',
                  animation: 'fadeIn 0.2s ease',
                }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}

          {/* Contact Banner */}
          <div className="card" style={{
            padding: '20px 24px', marginTop: '12px', display: 'flex', alignItems: 'center',
            gap: '16px', background: 'var(--primary-light)', border: '1px solid var(--primary)',
          }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Ic name="chat" size={20} color="#fff" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text)', margin: 0 }}>Still need help?</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Create a support ticket and our team will respond within 24 hours.</p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setActiveTab('create')}>
              <Ic name="plus" size={14} color="#fff" /> New Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
