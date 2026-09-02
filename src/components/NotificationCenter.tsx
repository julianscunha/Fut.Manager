import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { 
  Bell, 
  Settings, 
  X, 
  Check, 
  Info, 
  Sparkles, 
  DollarSign, 
  Gift, 
  UserPlus, 
  Dice5 
} from 'lucide-react';
import { Notification, NotificationCategory, NotificationPreferences } from '../types/domain';

interface NotificationCenterProps {
  currentUser: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export default function NotificationCenter({ currentUser }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'all' | NotificationCategory>('all');
  
  // Preferences state
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: currentUser.id,
    all: true,
    partidas: true,
    eventos: true,
    financeiro: true,
    sistema: true
  });

  const [savingPref, setSavingPref] = useState(false);

  // Load notifications
  const loadNotifications = async () => {
    try {
      const res = await authFetch(`/api/notifications?userId=${currentUser.id}&email=${currentUser.email}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Falha ao carregar notificações', err);
    }
  };

  // Load preferences
  const loadPreferences = async () => {
    try {
      const res = await authFetch(`/api/notifications/preferences?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setPreferences(data);
      }
    } catch (err) {
      console.error('Falha ao carregar preferências de notificação', err);
    }
  };

  // Poll notifications every 30 seconds for real-time vibe
  useEffect(() => {
    loadNotifications();
    loadPreferences();
    
    const interval = setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Handle Mark Single Notification as Read
  const handleMarkRead = async (id: string) => {
    try {
      const res = await authFetch('/api/notifications/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        // Optimistic UI updates
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'lida' } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error('Falha ao marcar como lida', err);
    }
  };

  // Handle Mark All as Read
  const handleMarkAllRead = async () => {
    try {
      const res = await authFetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, email: currentUser.email })
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'lida' })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Falha ao marcar todas como lidas', err);
    }
  };

  // Update Preference
  const handleUpdatePreference = async (key: keyof Omit<NotificationPreferences, 'userId'>, value: boolean) => {
    const updated = {
      ...preferences,
      [key]: value
    };

    // If "all" toggle is set to true, enable everything
    if (key === 'all' && value === true) {
      updated.partidas = true;
      updated.eventos = true;
      updated.financeiro = true;
      updated.sistema = true;
    } else if (key !== 'all' && value === false) {
      // If any of specific category is disabled, all is false
      updated.all = false;
    }

    setPreferences(updated);
    setSavingPref(true);

    try {
      const res = await authFetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, preferences: updated })
      });
      if (res.ok) {
        // Reload notifications to apply filtered preferences list instantly
        await loadNotifications();
      }
    } catch (err) {
      console.error('Erro ao salvar preferências', err);
    } finally {
      setSavingPref(false);
    }
  };

  // Helper to get category icon and colors
  const getCategoryTheme = (category: NotificationCategory) => {
    switch (category) {
      case 'partida':
        return {
          icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
          bgColor: 'bg-emerald-500/10 border-emerald-500/20'
        };
      case 'evento':
        return {
          icon: <Gift className="w-4 h-4 text-violet-400" />,
          bgColor: 'bg-violet-500/10 border-violet-500/20'
        };
      case 'financeiro':
        return {
          icon: <DollarSign className="w-4 h-4 text-amber-500" />,
          bgColor: 'bg-amber-500/10 border-amber-500/20'
        };
      case 'sorteio':
        return {
          icon: <Dice5 className="w-4 h-4 text-sky-400" />,
          bgColor: 'bg-sky-500/10 border-sky-500/20'
        };
      case 'jogador':
        return {
          icon: <UserPlus className="w-4 h-4 text-rose-400" />,
          bgColor: 'bg-rose-500/10 border-rose-500/20'
        };
      case 'sistema':
      default:
        return {
          icon: <Info className="w-4 h-4 text-zinc-400" />,
          bgColor: 'bg-zinc-800/60 border-zinc-700/50'
        };
    }
  };

  // Handle click on notification custom trigger (e.g. click "calendar" directs to tab-calendar)
  const handleActionRedirect = (actionUrl?: string) => {
    if (!actionUrl) return;
    
    // Custom DOM event to swap tabs in App.tsx
    const customEvent = new CustomEvent('set-active-tab', { detail: actionUrl });
    window.dispatchEvent(customEvent);
    setIsOpen(false);
  };

  // Filter local notifications computed on screen
  const displayedNotifications = notifications.filter(n => {
    if (selectedCategoryFilter === 'all') return true;
    return n.category === selectedCategoryFilter;
  });

  return (
    <div className="relative font-sans" id="notification-center-module">
      {/* Trigger Bell Icon button with responsive bubble */}
      <button
        id="btn-trigger-notifications"
        onClick={() => {
          setIsOpen(!isOpen);
          setShowConfig(false);
          // Auto load on open
          loadNotifications();
        }}
        className="relative p-2.5 border border-zinc-850 hover:bg-zinc-800/40 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer flex items-center justify-center"
        title="Notificações"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-amber-500 text-zinc-950 font-black text-[10px] h-4.5 min-w-4.5 px-1 flex items-center justify-center rounded-full ring-2 ring-[#0d1612] animate-bounce">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Backdrop for click out dismissal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-[1px]" 
          onClick={() => setIsOpen(false)} 
        />
      )}

      {/* Slide-out Drawer Panel (Mobile First!) */}
      {isOpen && (
        <div
          id="panel-notifications"
          className="fixed md:absolute right-0 top-0 md:top-14 z-50 w-full sm:w-[420px] h-screen md:h-[540px] md:max-h-[calc(100vh-100px)] bg-[#0c1310] border-l md:border border-zinc-850 shadow-2xl rounded-none md:rounded-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        >
          {/* Header */}
          <div className="p-4 border-b border-zinc-850 flex items-center justify-between gap-4 bg-[#0d1612] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Mural de Avisos
              </h2>
              {unreadCount > 0 && (
                <span className="bg-amber-500/10 text-amber-400 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-amber-500/20">
                  {unreadCount} novos
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                id="btn-toggle-notif-settings"
                onClick={() => setShowConfig(!showConfig)}
                className={`p-1.5 rounded-lg border text-zinc-400 hover:text-white transition cursor-pointer ${
                  showConfig ? 'bg-emerald-950/30 border-emerald-500/30' : 'border-transparent hover:bg-zinc-800/40'
                }`}
                title="Configurações de Notificações"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                id="btn-close-notif-panel"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/40 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preferences Settings View */}
          {showConfig ? (
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0b120f]">
              <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
                <div>
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-1">
                    Preferências de Envio
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Defina quais tipos de avisos importantes você deseja receber no seu mural privado.
                  </p>
                </div>

                <div className="space-y-3.5 border-t border-zinc-900 pt-4">
                  {/* Receive All */}
                  <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-900/10 transition">
                    <input
                      type="checkbox"
                      checked={preferences.all}
                      onChange={(e) => handleUpdatePreference('all', e.target.checked)}
                      className="mt-0.5 rounded border-zinc-750 text-emerald-500 focus:ring-emerald-500/40 bg-zinc-950 w-4.5 h-4.5 cursor-pointer accent-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-white block">Todas as Notificações</span>
                      <span className="text-[10px] text-zinc-500 block">Sintonizar com toda e qualquer alteração no racha</span>
                    </div>
                  </label>

                  {/* Matches */}
                  <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-900/10 transition">
                    <input
                      type="checkbox"
                      checked={preferences.partidas}
                      disabled={preferences.all}
                      onChange={(e) => handleUpdatePreference('partidas', e.target.checked)}
                      className="mt-0.5 rounded border-zinc-750 text-emerald-500 focus:ring-emerald-500/40 bg-zinc-950 w-4.5 h-4.5 cursor-pointer accent-emerald-500 disabled:opacity-50"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Partidas & Escalações</span>
                      <span className="text-[10px] text-zinc-500 block">Novos rachas, convocações de reservas e cancelamentos</span>
                    </div>
                  </label>

                  {/* Events */}
                  <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-900/10 transition">
                    <input
                      type="checkbox"
                      checked={preferences.eventos}
                      disabled={preferences.all}
                      onChange={(e) => handleUpdatePreference('eventos', e.target.checked)}
                      className="mt-0.5 rounded border-zinc-750 text-emerald-500 focus:ring-emerald-500/40 bg-zinc-950 w-4.5 h-4.5 cursor-pointer accent-emerald-500 disabled:opacity-50"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Churrascos & Eventos</span>
                      <span className="text-[10px] text-zinc-500 block">Avisos de resenhas do grupo, confraternizações e churrascos</span>
                    </div>
                  </label>

                  {/* Finances */}
                  <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-900/10 transition">
                    <input
                      type="checkbox"
                      checked={preferences.financeiro}
                      disabled={preferences.all}
                      onChange={(e) => handleUpdatePreference('financeiro', e.target.checked)}
                      className="mt-0.5 rounded border-zinc-750 text-emerald-500 focus:ring-emerald-500/40 bg-zinc-950 w-4.5 h-4.5 cursor-pointer accent-emerald-500 disabled:opacity-50"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Cobranças & Pagamentos</span>
                      <span className="text-[10px] text-zinc-500 block">Confirmações de mensalidades pagas e novos débitos gerados</span>
                    </div>
                  </label>

                  {/* System */}
                  <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-900/10 transition">
                    <input
                      type="checkbox"
                      checked={preferences.sistema}
                      disabled={preferences.all}
                      onChange={(e) => handleUpdatePreference('sistema', e.target.checked)}
                      className="mt-0.5 rounded border-zinc-750 text-emerald-500 focus:ring-emerald-500/40 bg-zinc-950 w-4.5 h-4.5 cursor-pointer accent-emerald-500 disabled:opacity-50"
                    />
                    <div>
                      <span className="text-xs font-semibold text-zinc-300 block">Avisos do Sistema & Sorteios</span>
                      <span className="text-[10px] text-zinc-500 block">Aprovações de novos atletas, promoções e sorteios de times</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Fixed Settings Footer */}
              <div className="p-4 border-t border-zinc-900 bg-[#0c1310] flex justify-between items-center text-[10px] text-zinc-500 flex-shrink-0">
                <span>{savingPref ? 'Sincronizando preferências...' : 'Salvo na nuvem'}</span>
                <button
                  id="btn-return-notifications"
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 hover:text-white rounded-lg transition font-semibold font-sans cursor-pointer"
                >
                  Voltar para Mensagens
                </button>
              </div>
            </div>
          ) : (
            /* Notifications List View */
            <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0f0d]">
              {/* Filter Pills Category Navigation */}
              <div className="p-3 border-b border-zinc-900 bg-[#0c1310] flex flex-wrap items-center justify-start gap-1.5 select-none flex-shrink-0">
                <button
                  id="pill-cat-all"
                  onClick={() => setSelectedCategoryFilter('all')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition whitespace-nowrap cursor-pointer ${
                    selectedCategoryFilter === 'all'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 font-extrabold shadow-sm'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Todos
                </button>
                <button
                  id="pill-cat-partidas"
                  onClick={() => setSelectedCategoryFilter('partida')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition whitespace-nowrap cursor-pointer ${
                    selectedCategoryFilter === 'partida'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 font-extrabold shadow-sm'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Partidas
                </button>
                <button
                  id="pill-cat-sorteio"
                  onClick={() => setSelectedCategoryFilter('sorteio')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition whitespace-nowrap cursor-pointer ${
                    selectedCategoryFilter === 'sorteio'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400 font-extrabold shadow-sm'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sorteios
                </button>
                <button
                  id="pill-cat-financeiro"
                  onClick={() => setSelectedCategoryFilter('financeiro')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition whitespace-nowrap cursor-pointer ${
                    selectedCategoryFilter === 'financeiro'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-[#fbbf24] font-extrabold shadow-sm'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Financeiro
                </button>
                <button
                  id="pill-cat-jogador"
                  onClick={() => setSelectedCategoryFilter('jogador')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition whitespace-nowrap cursor-pointer ${
                    selectedCategoryFilter === 'jogador'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-[#fb7185] font-extrabold shadow-sm'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Atletas
                </button>
                <button
                  id="pill-cat-evento"
                  onClick={() => setSelectedCategoryFilter('evento')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition whitespace-nowrap cursor-pointer ${
                    selectedCategoryFilter === 'evento'
                      ? 'bg-emerald-500/15 border-emerald-500/35 text-[#a78bfa] font-extrabold shadow-sm'
                      : 'bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Eventos
                </button>
              </div>

              {/* List body */}
              <div className="flex-grow overflow-y-auto divide-y divide-zinc-900 custom-scrollbar">
                {displayedNotifications.length === 0 ? (
                  <div className="h-48 flex flex-col items-center justify-center text-center p-5 space-y-2">
                    <Bell className="w-8 h-8 text-zinc-700/60" />
                    <p className="text-xs text-zinc-500 font-medium">Nenhum aviso no mural</p>
                    <p className="text-[10px] text-zinc-600 max-w-[200px]">
                      Você não possui notificações pendentes ou filtradas nesta seção.
                    </p>
                  </div>
                ) : (
                  displayedNotifications.map((notif) => {
                    const { icon, bgColor } = getCategoryTheme(notif.category);
                    const isUnread = notif.status === 'nao_lida';

                    return (
                      <div
                        key={notif.id}
                        id={`notif-item-${notif.id}`}
                        className={`p-4 transition flex gap-3 relative ${
                          isUnread ? 'bg-[#0f1915]/60 hover:bg-[#121d19]' : 'hover:bg-zinc-900/25'
                        }`}
                      >
                        {/* Status Unread Side Dot */}
                        {isUnread && (
                          <div className="absolute top-4.5 left-2.5 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        )}

                        {/* Visual Icon Badge */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border flex-shrink-0 ${bgColor}`}>
                          {icon}
                        </div>

                        {/* Title & Body */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-1.5">
                            <h4 className="text-xs font-bold text-zinc-200 truncate pr-4">
                              {notif.title}
                            </h4>
                            <span className="text-[9px] font-mono text-zinc-650 flex-shrink-0">
                              {new Date(notif.createdAt).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          
                          <p className="text-[11px] text-zinc-400 leading-normal font-sans">
                            {notif.message}
                          </p>

                          {/* Quick Interactive Actions block */}
                          <div className="flex items-center gap-3 pt-1">
                            {/* Action Redirect if present */}
                            {notif.actionUrl && (
                              <button
                                id={`notif-act-dir-${notif.id}`}
                                onClick={() => handleActionRedirect(notif.actionUrl)}
                                className="text-[10px] font-bold text-emerald-400 hover:text-emerald-350 transition flex items-center gap-0.5 cursor-pointer underline decoration-dotted animate-pulse"
                              >
                                Ver Detalhes
                              </button>
                            )}

                            {/* Mark single read button */}
                            {isUnread && (
                              <button
                                id={`notif-mar-read-${notif.id}`}
                                onClick={() => handleMarkRead(notif.id)}
                                className="text-[10px] font-bold text-zinc-500 hover:text-emerald-400 transition flex items-center gap-0.5 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Marcar lida
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action Button Footer */}
              {displayedNotifications.some(n => n.status === 'nao_lida') && (
                <div className="p-3 border-t border-zinc-900 bg-[#0c1310] flex justify-center flex-shrink-0">
                  <button
                    id="btn-mark-all-read"
                    onClick={handleMarkAllRead}
                    className="text-[11px] font-bold text-emerald-400 hover:text-[#34d399] flex items-center gap-1 cursor-pointer hover:underline transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Marcar todas as visíveis como lidas
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
