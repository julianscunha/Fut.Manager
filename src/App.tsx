/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Player } from './types';
import AuthScreens from './components/AuthScreens';
import { authFetch } from './lib/authFetch';
import { BrandName, useAppConfig } from './contexts/AppConfigContext';
import DashboardStatus from './components/DashboardStatus';
import PlayerCard from './components/PlayerCard';
import { PlayerHero } from './components/PlayerHero';
import { 
  PlayerStatCard, 
  PlayerPerformanceCard, 
  PlayerAchievementsCard, 
  PlayerProgressCard, 
  PlayerHistoryCard, 
  PlayerIdentityCard, 
  PlayerComparisonCard, 
  PlayerGoalsCard 
} from './components/PlayerDomainCards';
import PlayerForm from './components/PlayerForm';
import UserApprovalList from './components/UserApprovalList';
import TechnicalRanking from './components/TechnicalRanking';
import {
  Shield,
  LogOut,
  Users,
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Search,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
  Award,
  Calendar,
  DollarSign,
  Gift,
  AlertTriangle,
  Activity,
  Trophy,
  TrendingUp,
  X,
  FlaskConical,
  Settings
} from 'lucide-react';
import CalendarManager from './components/CalendarManager';
import DrawManager from './components/DrawManager';
import FinanceManager from './components/FinanceManager';
import EventManager from './components/EventManager';
import MuralManager from './components/MuralManager';
import NotificationCenter from './components/NotificationCenter';
import LaboratorioManager from './components/LaboratorioManager';
import { Camera } from 'lucide-react';

type NavTab = 'dash' | 'players' | 'approvals' | 'ranking' | 'calendar' | 'draw' | 'finances' | 'events' | 'mural' | 'profile' | 'laboratorio' | 'administration';

export default function App() {
  const { appName } = useAppConfig();
  const [adminSubTab, setAdminSubTab] = useState<'approvals' | 'laboratorio'>('approvals');
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('racha_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    const saved = localStorage.getItem('racha_active_tab');
    const tab = (saved as NavTab) || 'dash';
    return tab === 'profile' ? 'players' : tab;
  });

  const [featuredPlayerId, setFeaturedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== 'profile') {
      localStorage.setItem('racha_active_tab', activeTab);
    }
  }, [activeTab]);

  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      const match = hash.match(/^#\/players\/(.+)$/);
      if (match) {
        const id = match[1];
        setFeaturedPlayerId(id);
        setActiveTab('profile');
      } else if (hash === '#/players' || hash === '#/jogadores') {
        setActiveTab('players');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Execute initially

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Sync URL hash based on activeTab to prevent getting stuck in navigation
  useEffect(() => {
    if (activeTab === 'profile') {
      if (featuredPlayerId && window.location.hash !== `#/players/${featuredPlayerId}`) {
        window.location.hash = `#/players/${featuredPlayerId}`;
      }
    } else if (activeTab === 'players') {
      if (window.location.hash !== '#/players') {
        window.location.hash = '#/players';
      }
    } else {
      // Clear player-related hash for other tabs to allow seamless navigation
      if (window.location.hash.startsWith('#/players')) {
        window.location.hash = '';
      }
    }
  }, [activeTab, featuredPlayerId]);

  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [simulatedState, setSimulatedState] = useState<number | null>(null);

  // Player search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);
  const [sortBy, setSortBy] = useState<string>('name');

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // States for domain showcase components
  const [featuredMetrics, setFeaturedMetrics] = useState<any>(null);
  const [featuredRachaStats, setFeaturedRachaStats] = useState<any>(null);
  const [allPlayersStats, setAllPlayersStats] = useState<any[]>([]);
  const [featuredResults, setFeaturedResults] = useState<('V' | 'D' | 'E' | 'NP')[]>([]);

  // Fetch domain metrics and statistics for the selected featured player
  useEffect(() => {
    if (!currentUser || !players || players.length === 0) return;
    
    // Find matching self or fallback featured player
    const matchingSelfPlayer = players.find(p => p.email?.toLowerCase() === currentUser?.email?.toLowerCase());
    const defaultFeaturedPlayer = matchingSelfPlayer || players[0];
    const featured = players.find(p => p.id === featuredPlayerId) || defaultFeaturedPlayer;

    if (!featured) return;

    let active = true;

    const loadData = async () => {
      try {
        const [evalsRes, statsRes, resultsRes] = await Promise.all([
          authFetch(`/api/players/${featured.id}/evaluations?evaluatorUserId=${currentUser.id}`),
          authFetch('/api/stats'),
          authFetch('/api/results')
        ]);

        if (!active) return;
        if (evalsRes.ok) {
          const data = await evalsRes.json();
          setFeaturedMetrics(data.metrics);
        }
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.individual) {
            setAllPlayersStats(statsData.individual);
            const found = statsData.individual.find((s: any) => s.playerId === featured.id);
            if (found) {
              setFeaturedRachaStats(found);
            }
          }
        }

        if (resultsRes.ok) {
          const resultsData = await resultsRes.json();
          const sortedResults = [...resultsData];
          let pWins = 0;
          let pLosses = 0;
          let pDraws = 0;
          let pPresences = 0;

          const last5Results = sortedResults.slice(-5);
          const recentOutcomes = last5Results.map(resObj => {
            const isGoalkeeper = featured.primaryPosition === 'goleiro';
            const blueTeam = resObj.teams?.find((t: any) => t.name === 'Azul')?.playerIds || [];
            const redTeam = resObj.teams?.find((t: any) => t.name === 'Vermelho')?.playerIds || [];
            const greenTeam = resObj.teams?.find((t: any) => t.name === 'Verde')?.playerIds || [];

            const isBlue = blueTeam.includes(featured.id);
            const isRed = redTeam.includes(featured.id);
            const isGreen = greenTeam.includes(featured.id);

            const hasPlayed = isBlue || isRed || isGreen;
            if (!hasPlayed) return 'NP';

            pPresences++;
            const champTeams = resObj.champions || [];
            if (resObj.isSharedGoalkeepers && isGoalkeeper) {
              pWins++;
              return champTeams.length > 0 ? 'V' : 'E';
            }

            const playerTeam = isBlue ? 'Azul' : isRed ? 'Vermelho' : isGreen ? 'Verde' : null;
            if (!playerTeam) return 'NP';

            if (champTeams.length === 0 || champTeams.length > 1) {
              pDraws++;
              return 'E';
            }
            if (champTeams.includes(playerTeam)) {
              pWins++;
              return 'V';
            }
            pLosses++;
            return 'D';
          });

          setFeaturedResults(recentOutcomes);
        }
      } catch (err) {
        console.error('Error fetching Player Domain details in App.tsx:', err);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, [featuredPlayerId, players, currentUser?.id]);

  // Custom confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    onConfirm: () => {}
  });

  // Loading / Messages status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [mensalistaAlerts, setMensalistaAlerts] = useState<any>(null);

  // Save/retrieve session helper
  const handleLoginSuccess = (user: User, token: string) => {
    localStorage.setItem('racha_user', JSON.stringify(user));
    localStorage.setItem('racha_token', token);
    setCurrentUser(user);
    setActiveTab('dash');
  };

  const handleLogout = () => {
    localStorage.removeItem('racha_user');
    localStorage.removeItem('racha_token');
    setCurrentUser(null);
    setPlayers([]);
  };

  // Load players data
  const fetchPlayers = async () => {
    if (!currentUser) return;
    setLoading(true);
    setErrorMsg('');
    try {
      // Admins/Auxiliars can inspect soft-deleted players too
      const isAdminOrAux = currentUser.role === 'admin' || currentUser.role === 'auxiliar';
      const url = `/api/players?includeDeleted=${isAdminOrAux ? 'true' : 'false'}`;
      
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Não foi possível carregar o roster de atletas.');
      const data = await res.json();
      setPlayers(data);
      
      // Also fetch vacancy alerts
      await fetchMensalistaAlerts();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão com o banco.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMensalistaAlerts = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch('/api/mensalista-alerts');
      if (res.ok) {
        const data = await res.json();
        setMensalistaAlerts(data);
      }
    } catch (err) {
      console.error('Falha ao sincronizar alertas de mensalistas', err);
    }
  };
  // Fetch pending registrations countdown (Admin/Auxiliar)
  const fetchPendingCount = async () => {
    if (!currentUser) return;
    if (currentUser.role !== 'admin' && currentUser.role !== 'auxiliar') return;
    try {
      const res = await authFetch('/api/users');
      if (res.ok) {
        const usersList: User[] = await res.json();
        const pending = usersList.filter((u) => u.status === 'pending');
        setPendingApprovalsCount(pending.length);
      }
    } catch (err) {
      console.error('Falha ao sincronizar cadastros pendentes', err);
    }
  };

  // Sync details on mounting or tab modifications
  useEffect(() => {
    if (currentUser) {
      fetchPlayers();
      fetchPendingCount();
      fetchMensalistaAlerts();
    }
  }, [currentUser, activeTab]);

  useEffect(() => {
    const handleSetActiveTabEvent = (e: Event) => {
      const customEvent = e as CustomEvent<NavTab>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener('set-active-tab', handleSetActiveTabEvent);
    const handleMensalistasUpdated = () => {
      fetchPlayers();
      fetchMensalistaAlerts();
    };
    window.addEventListener('mensalistas-updated', handleMensalistasUpdated);
    return () => {
      window.removeEventListener('set-active-tab', handleSetActiveTabEvent);
      window.removeEventListener('mensalistas-updated', handleMensalistasUpdated);
    };
  }, []);

  // Poll players list if any avatar is pending or processing to get real-time status updates
  useEffect(() => {
    if (!currentUser || players.length === 0) return;
    
    const hasActiveGamerGeneration = players.some(
      (p) => p.avatarStatus === 'PENDENTE' || p.avatarStatus === 'PROCESSANDO'
    );
    
    if (!hasActiveGamerGeneration) return;
    
    const interval = setInterval(async () => {
      try {
        const isAdminOrAux = currentUser.role === 'admin' || currentUser.role === 'auxiliar';
        const url = `/api/players?includeDeleted=${isAdminOrAux ? 'true' : 'false'}`;
        const res = await authFetch(url);
        if (res.ok) {
          const data = await res.json();
          setPlayers(data);
        }
      } catch (err) {
        console.error('Error during real-time avatar sync:', err);
      }
    }, 4000);
    
    return () => clearInterval(interval);
  }, [players, currentUser]);

  // Player CRUD actions
  const handleSavePlayer = async (formData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const isEdit = !!editingPlayer;
      const url = isEdit ? `/api/players/${editingPlayer.id}` : '/api/players';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        body: JSON.stringify({
          ...formData,
          responsibleName: currentUser?.name || 'Administrador'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao persistir informações do jogador.');

      setSuccessMsg(isEdit ? 'Jogador atualizado com sucesso!' : 'Jogador cadastrado com sucesso!');
      setIsFormOpen(false);
      setEditingPlayer(null);
      await fetchPlayers();

      // Dismiss alert
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao interagir com o servidor.');
    }
  };




  const handleEditClick = (player: Player) => {
    setEditingPlayer(player);
    setIsFormOpen(true);
  };

  const handleInactivatePlayer = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Inativar Jogador',
      message: 'Tem certeza que deseja inativar este jogador? Ele não aparecerá nas próximas convocações, mas seus históricos anteriores e faturamentos serão preservados.',
      confirmText: 'Sim, Inativar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await authFetch(`/api/players/${id}`, { 
            method: 'DELETE'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Erro ao inativar jogador.');

          setSuccessMsg('Jogador inativado (soft delete aplicado).');
          await fetchPlayers();
          setTimeout(() => setSuccessMsg(''), 4000);
        } catch (err: any) {
          setErrorMsg(err.message || 'Falha ao inativar usuário.');
        }
      }
    });
  };

  const handleRestorePlayer = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await authFetch(`/api/players/${id}/restore`, { 
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao reativar.');

      setSuccessMsg('Atleta reativado com sucesso no roster!');
      await fetchPlayers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Não foi possível reativar.');
    }
  };

  if (!currentUser) {
    return <AuthScreens onLoginSuccess={handleLoginSuccess} />;
  }

  const isEditor = currentUser.role === 'admin' || currentUser.role === 'auxiliar';

  // Filtered Players computed property
  const filteredPlayers = players.filter((player) => {
    // Search match
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (player.email && player.email.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Category match
    const matchesCategory = categoryFilter === 'all' || player.category === categoryFilter;

    // Status match
    const matchesStatus = statusFilter === 'all' || player.status === statusFilter;

    // Soft Deleted logic
    const isSoftDeleted = !!player.deletedAt;
    const matchesSoftDelete = showSoftDeleted ? isSoftDeleted : !isSoftDeleted;

    return matchesSearch && matchesCategory && matchesStatus && matchesSoftDelete;
  });

  // Featured Player calculation
  const matchingSelfPlayer = players.find(p => p.email?.toLowerCase() === currentUser?.email?.toLowerCase());
  const defaultFeaturedPlayer = matchingSelfPlayer || players[0];
  const featuredPlayer = players.find(p => p.id === featuredPlayerId) || defaultFeaturedPlayer;

  // Sort logic for players
  const positionOrder: Record<string, number> = {
    goleiro: 1,
    zagueiro: 2,
    volante: 3,
    meio_campo: 4,
    atacante: 5,
  };

  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    if (sortBy === 'position') {
      const orderA = positionOrder[a.primaryPosition] || 99;
      const orderB = positionOrder[b.primaryPosition] || 99;
      if (orderA !== orderB) {
        return orderA - orderB;
      }
    }
    return a.name.localeCompare(b.name, 'pt-BR');
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#0b110e] w-full max-w-full overflow-x-hidden" id="racha-app-viewport">
      {/* Dynamic Sports Header */}
      <header className="sticky top-0 z-40 bg-[#0d1612]/95 border-b border-zinc-900 backdrop-blur-md px-4 py-3 select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              id="btn-mobile-menu"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/40 rounded-xl border border-zinc-850 h-[44px] px-3 flex items-center justify-center gap-1.5"
              title="Abrir Menu"
            >
              <span className="text-lg">☰</span>
              <span className="font-semibold text-xs text-white">Menu</span>
            </button>

            <div className="hidden sm:flex items-center gap-2">
              <div className="bg-[#22c55e] p-1.5 rounded-lg border border-white/10 flex items-center justify-center shadow shadow-emerald-500/10">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="font-display font-black text-sm tracking-tight text-white uppercase">
                  <BrandName />
                </span>
                <span className="block text-[8px] font-mono text-zinc-500 uppercase tracking-wide">
                  Private Soccer Group
                </span>
              </div>
            </div>
          </div>

          {/* Quick Nav bar links */}
          <nav className="hidden lg:flex items-center bg-[#131e18] p-1 rounded-xl border border-zinc-850 text-xs">
            <button
              id="tab-dash"
              onClick={() => { setActiveTab('dash'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'dash'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            <button
              id="tab-calendar"
              onClick={() => { setActiveTab('calendar'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Rodadas</span>
            </button>

            <button
              id="tab-players"
              onClick={() => { setActiveTab('players'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'players'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Atletas</span>
            </button>

            <button
              id="tab-draw"
              onClick={() => { setActiveTab('draw'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'draw'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sorteio</span>
            </button>

            <button
              id="tab-ranking"
              onClick={() => { setActiveTab('ranking'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'ranking'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Performance</span>
            </button>

            <button
              id="tab-mural"
              onClick={() => { setActiveTab('mural'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'mural'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Museu</span>
            </button>

            <button
              id="tab-finances"
              onClick={() => { setActiveTab('finances'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'finances'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span>Tesouraria</span>
            </button>

            <button
              id="tab-events"
              onClick={() => { setActiveTab('events'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                activeTab === 'events'
                  ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Gift className="w-3.5 h-3.5" />
              <span>Eventos</span>
            </button>

            {isEditor && (
              <button
                id="tab-administration"
                onClick={() => { setActiveTab('administration'); setIsFormOpen(false); }}
                className={`relative px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition-all duration-200 active:scale-[0.96] cursor-pointer ${
                  activeTab === 'administration'
                    ? 'bg-emerald-600 text-white shadow shadow-emerald-600/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Administração</span>
                {pendingApprovalsCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 bg-amber-500 text-zinc-950 font-black px-1 rounded-full text-[9px] min-w-4 text-center ring-2 ring-[#0d1612]">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
            )}
          </nav>

          {/* User profile actions summary */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const selfPlayer = players.find(p => p.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                if (selfPlayer) {
                  setFeaturedPlayerId(selfPlayer.id);
                  setActiveTab('profile');
                  window.location.hash = `#/players/${selfPlayer.id}`;
                }
              }}
              className="hidden md:flex flex-col text-right font-sans hover:text-emerald-400 text-white cursor-pointer transition text-left group"
              title="Visualizar meu perfil de atleta"
            >
              <span className="text-[11px] font-bold group-hover:text-[#22c55e] transition-colors">{currentUser.name}</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase">{currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'auxiliar' ? 'Auxiliar Técnico' : 'Atleta'}</span>
            </button>
            
            {/* Unified Notification Center */}
            <NotificationCenter currentUser={currentUser} />

            <button
              id="btn-logout"
              onClick={handleLogout}
              className="p-2 border border-zinc-850 hover:bg-rose-950/20 text-zinc-400 hover:text-rose-400 rounded-xl transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MOBILE SIDEBAR MENU DRAWER */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[150] lg:hidden" id="mobile-menu-drawer">
          {/* Backdrop with transition fade effect */}
          <div 
            className="absolute inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-305"
            onClick={() => setIsMobileMenuOpen(false)} 
          />
          
          {/* Menu Panel sliding from left */}
          <div className="absolute top-0 bottom-0 left-0 w-[280px] max-w-[85vw] bg-[#0c1210] border-r border-zinc-800/80 flex flex-col justify-between p-5 shadow-2xl h-full transition-transform duration-300">
            <div className="space-y-6">
              {/* Drawer Title Block */}
              <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
                <div className="flex items-center gap-2">
                  <div className="bg-[#22c55e] p-1.5 rounded-lg border border-white/10 flex items-center justify-center shadow">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <span className="font-display font-black text-sm tracking-tight text-white uppercase block">
                      <BrandName />
                    </span>
                    <span className="text-[8px] font-mono text-zinc-500 uppercase tracking-wider block">
                      Grupo Privado Society
                    </span>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1.5 border border-zinc-800 hover:bg-zinc-800/80 text-zinc-400 hover:text-white rounded-lg transition min-h-[38px] min-w-[38px] flex items-center justify-center cursor-pointer"
                  title="Fechar Menu"
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Connected Active Profile info card */}
              <div 
                onClick={() => {
                  const selfPlayer = players.find(p => p.email?.toLowerCase() === currentUser?.email?.toLowerCase());
                  if (selfPlayer) {
                    setFeaturedPlayerId(selfPlayer.id);
                    setActiveTab('profile');
                    window.location.hash = `#/players/${selfPlayer.id}`;
                    setIsMobileMenuOpen(false);
                  }
                }}
                className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-900/40 flex items-center gap-2.5 cursor-pointer hover:border-emerald-500/30 transition group"
                title="Visualizar meu perfil de atleta"
              >
                <div className="w-9 h-9 rounded-full bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs uppercase group-hover:bg-emerald-600/30 transition-colors">
                  {currentUser.name?.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-white truncate leading-tight group-hover:text-[#22c55e] transition-colors">{currentUser.name}</span>
                  <span className="block text-[8px] font-mono text-emerald-400 uppercase tracking-wider mt-0.5">{currentUser.role === 'admin' ? 'Administrador' : currentUser.role === 'auxiliar' ? 'Auxiliar Técnico' : 'Atleta'}</span>
                </div>
              </div>

              {/* Navigation Items list (Interactive and touch-safe) */}
              <nav className="flex flex-col gap-1.5 font-sans">
                {[
                  { id: 'dash', label: 'Home', icon: LayoutDashboard },
                  { id: 'calendar', label: 'Rodadas', icon: Calendar },
                  { id: 'players', label: 'Atletas', icon: Users },
                  { id: 'draw', label: 'Sorteio', icon: Sparkles },
                  { id: 'ranking', label: 'Performance', icon: Award },
                  { id: 'mural', label: 'Museu', icon: Camera },
                  { id: 'finances', label: 'Tesouraria', icon: DollarSign },
                  { id: 'events', label: 'Eventos', icon: Gift },
                  ...(isEditor ? [
                    { id: 'administration', label: 'Administração', icon: Settings, showBadge: true }
                  ] : [])
                ].map((item) => {
                  const IconComp = item.icon;
                  const isCurActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveTab(item.id as NavTab);
                        setIsFormOpen(false);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full min-h-[44px] px-3.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all duration-200 active:scale-[0.97] cursor-pointer ${
                        isCurActive
                          ? 'bg-emerald-600 text-white shadow shadow-emerald-500/15'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80 border border-transparent hover:border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <IconComp className={`w-4 h-4 ${isCurActive ? 'text-white' : 'text-zinc-500'}`} />
                        <span>{item.label}</span>
                      </div>
                      
                      {item.showBadge && pendingApprovalsCount > 0 && (
                        <span className="bg-amber-500 text-zinc-950 font-black px-1.5 py-0.5 rounded-full text-[9px] font-mono leading-none">
                          {pendingApprovalsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Logout actions of main app */}
            <div className="border-t border-zinc-900 pt-4 mt-auto">
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full min-h-[44px] px-4 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white font-bold text-xs rounded-xl border border-rose-500/20 hover:border-transparent flex items-center justify-center gap-2 transition cursor-pointer uppercase tracking-wider font-mono"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6 relative overflow-x-hidden" id="main-content-area">
        <div className="absolute inset-0 field-decor pointer-events-none opacity-5" />

        {/* Action confirmation notifications */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg('')}
              className="p-1 text-rose-400 hover:text-white hover:bg-rose-500/10 rounded transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/25 text-[#4ade80] rounded-xl text-xs flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-4.5 h-4.5 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg('')}
              className="p-1 text-[#4ade80] hover:text-white hover:bg-emerald-500/10 rounded transition cursor-pointer"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* TAB 1 - DASHBOARD INICIAL */}
        {activeTab === 'dash' && (
          <DashboardStatus
            currentUser={currentUser}
            onNavigateToApprovals={isEditor ? (() => setActiveTab('approvals')) : undefined}
            onNavigateToFinances={() => setActiveTab('finances')}
            simulatedState={simulatedState}
            setSimulatedState={setSimulatedState}
          />
        )}

        {/* TAB - FINANCE DISCIPLINE */}
        {activeTab === 'finances' && (
          <FinanceManager currentUser={currentUser} />
        )}

        {/* TAB - GROUP EVENTS & FEED */}
        {activeTab === 'events' && (
          <EventManager currentUser={currentUser} />
        )}

        {/* TAB 5 - CALENDARIO, TEMPORADAS E RESERVAS */}
        {activeTab === 'calendar' && (
          <CalendarManager 
            currentUser={currentUser} 
            simulatedState={simulatedState}
            setSimulatedState={setSimulatedState}
          />
        )}

        {/* TAB - DRAW MANAGER BALANCING */}
        {activeTab === 'draw' && (
          <DrawManager currentUser={currentUser} />
        )}

        {/* TAB 2 - JOGADORES ROSTER */}
        {activeTab === 'players' && (
          <div className="space-y-6">
            
            {/* Roster Controls & Filtering Panel */}
            {!isFormOpen && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-zinc-900 pb-4">
                  <div>
                    <h2 className="font-display font-extrabold text-xl text-white">Roster de Atletas</h2>
                    <p className="text-zinc-500 text-xs mt-0.5">Exiba, filtre e gerencie a lista técnica do racha.</p>
                  </div>
                  
                  {isEditor && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        id="btn-new-player"
                        onClick={() => { setEditingPlayer(null); setIsFormOpen(true); }}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition cursor-pointer"
                      >
                        <PlusCircle className="w-4" />
                        <span>Cadastrar Atleta</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Filter and Search Bar */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-[#111815] p-3.5 rounded-xl border border-zinc-850/80">
                  
                  {/* Search */}
                  <div className="relative md:col-span-2">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Pesquisar por nome ou e-mail..."
                      className="w-full bg-zinc-950 border border-zinc-850 text-xs text-white rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#22c55e] placeholder-zinc-650"
                    />
                  </div>

                  {/* Category select */}
                  <div>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none min-h-[38px] cursor-pointer"
                    >
                      <option value="all">Todas as Categorias</option>
                      <option value="mensalista">Mensalista</option>
                      <option value="reserva">Reserva</option>
                    </select>
                  </div>

                  {/* Status select */}
                  <div>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none min-h-[38px] cursor-pointer"
                    >
                      <option value="all">Todos os Status</option>
                      <option value="disponivel">Disponível</option>
                      <option value="indisponivel">Indisponível</option>
                      <option value="lesionado">Lesionado</option>
                      <option value="afastado">Afastado</option>
                    </select>
                  </div>

                  {/* Sort select */}
                  <div>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 text-xs text-emerald-450 rounded-lg px-3 py-2.5 focus:outline-none min-h-[38px] cursor-pointer font-semibold"
                    >
                      <option value="name" className="text-zinc-300">Ordenar por Nome</option>
                      <option value="position" className="text-zinc-300">Ordenar por Posição</option>
                    </select>
                  </div>

                  {/* Toggle Active / Inactive if Editor */}
                  {isEditor && (
                    <div className="md:col-span-5 flex justify-between items-center bg-zinc-950/40 p-2 rounded-lg border border-zinc-900/60 mt-1">
                      <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-zinc-600" />
                        <span>Registros deletados ficam arquivados logicamente (Soft Delete).</span>
                      </span>

                      <label className="flex items-center gap-2 text-xs text-zinc-400 select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showSoftDeleted}
                          onChange={(e) => setShowSoftDeleted(e.target.checked)}
                          className="accent-[#22c55e] rounded h-3.5 w-3.5"
                        />
                        <span className="font-medium">Visualizar Atletas Inativos</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Display Grid of Players */}
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3">
                    <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
                    <span className="text-xs text-zinc-500 font-mono">Consultando banco de dados...</span>
                  </div>
                ) : sortedPlayers.length === 0 ? (
                  <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850/80 bg-zinc-900/15 p-6">
                    <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
                    <p className="text-zinc-400 font-semibold text-sm">Nenhum jogador encontrado!</p>
                    <p className="text-xs text-zinc-600 mt-1">Tente trocar os filtros aplicados acima ou faça um cadastro.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {sortedPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        currentUser={currentUser}
                        canEdit={isEditor}
                        onEdit={handleEditClick}
                        onInactivate={handleInactivatePlayer}
                        onRestore={handleRestorePlayer}
                        onEvaluationSavedGlobal={() => fetchPlayers()}
                        onSelect={(p) => {
                          setFeaturedPlayerId(p.id);
                          setActiveTab('profile');
                          window.location.hash = `#/players/${p.id}`;
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Editing / Creating state */}
            {isFormOpen && (
              <PlayerForm
                player={editingPlayer}
                onSave={handleSavePlayer}
                onCancel={() => { setIsFormOpen(false); setEditingPlayer(null); }}
              />
            )}
          </div>
        )}

        {/* TAB - PERFIL DO ATLETA (STANDALONE FULL PAGE) */}
        {activeTab === 'profile' && featuredPlayer && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div>
                <button
                  onClick={() => {
                    setActiveTab('players');
                    window.location.hash = '#/players';
                  }}
                  className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-[#1a1c1a] text-zinc-350 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition mb-2"
                >
                  ← Voltar para Jogadores
                </button>
                <h2 className="font-display font-extrabold text-xl text-white">Perfil do Atleta</h2>
                <p className="text-zinc-500 text-xs mt-0.5">Ficha técnica, métricas e conquistas completas do atleta.</p>
              </div>
            </div>

            <div className="bg-[#111815] border border-zinc-850/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/5 via-transparent to-transparent pointer-events-none" />
              
              <PlayerHero 
                player={featuredPlayer}
                currentUser={currentUser}
                isAdmin={currentUser?.role === 'admin'}
              />

              {/* DETAILED ATHLETE DOMAIN COMPONENTS SHOWCASE */}
              <div className="mt-8 pt-8 border-t border-zinc-900 space-y-6">
                <div className="flex flex-col gap-1">
                  <h4 className="font-display font-black text-sm text-zinc-100 uppercase tracking-tight">
                    Dashboard de Rendimento do Atleta
                  </h4>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    Métricas e análises geradas dinamicamente com base nas rodadas desta temporada.
                  </p>
                </div>

                {/* 1. Stat Cards Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <PlayerStatCard 
                    title="MÉDIA OVR"
                    value={(featuredMetrics?.overall || 3.5).toFixed(1)}
                    subtitle={`Baseado em ${featuredMetrics?.evalCount || 0} avaliações`}
                    icon={<Activity className="w-4 h-4 text-emerald-400" />}
                    trend={(featuredMetrics?.overall || 3.5) >= 3.5 ? 'up' : 'down'}
                    trendLabel={`${(featuredMetrics?.overall || 3.5) >= 3.5 ? '+' : ''}${((featuredMetrics?.overall || 3.5) - 3.5).toFixed(1)}`}
                    glowColor="green"
                  />
                  <PlayerStatCard 
                    title="RANKING GERAL"
                    value={featuredRachaStats?.rank ? `${featuredRachaStats.rank}º` : '—'}
                    subtitle="Posição nesta temporada"
                    icon={<Trophy className="w-4 h-4 text-amber-500" />}
                    trend={featuredRachaStats?.rank && featuredRachaStats.rank <= 5 ? 'up' : 'neutral'}
                    trendLabel={featuredRachaStats?.rank ? `Top ${featuredRachaStats.rank}` : undefined}
                    glowColor="sky"
                  />
                  <PlayerStatCard 
                    title="VITÓRIAS"
                    value={featuredRachaStats?.vitorias || 0}
                    subtitle={`${featuredRachaStats?.presences || 0} partidas jogadas`}
                    icon={<Award className="w-4 h-4 text-purple-400" />}
                    trend={(featuredRachaStats?.vitorias || 0) >= 5 ? 'up' : 'neutral'}
                    trendLabel="Foco ativo"
                    glowColor="purple"
                  />
                  <PlayerStatCard 
                    title="APROVEITAMENTO"
                    value={featuredRachaStats ? `${featuredRachaStats.aproveitamento}%` : '0%'}
                    subtitle="Taxa de vitória geral"
                    icon={<TrendingUp className="w-4 h-4 text-sky-400" />}
                    trend={featuredRachaStats && featuredRachaStats.aproveitamento >= 50 ? 'up' : 'neutral'}
                    trendLabel={featuredRachaStats ? `${featuredRachaStats.aproveitamento}%` : '0%'}
                    glowColor="none"
                  />
                </div>

                {/* Remaining 7 Components Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Column 1 */}
                  <div className="space-y-6">
                    {/* 2. Identity Card */}
                    <PlayerIdentityCard 
                      player={featuredPlayer}
                      displayOvr={(featuredMetrics?.overall || 3.5).toFixed(1)}
                    />

                    {/* 3. Performance Card */}
                    <PlayerPerformanceCard 
                      player={featuredPlayer}
                      metrics={featuredMetrics}
                    />

                    {/* 4. Goals Card */}
                    <PlayerGoalsCard 
                      player={featuredPlayer}
                      rachaStats={featuredRachaStats}
                      metrics={featuredMetrics}
                    />
                  </div>

                  {/* Column 2 */}
                  <div className="space-y-6">
                    {/* 5. Achievements Card */}
                    <PlayerAchievementsCard 
                      player={featuredPlayer}
                      rachaStats={featuredRachaStats}
                      metrics={featuredMetrics}
                    />

                    {/* 6. Progress Card */}
                    <PlayerProgressCard 
                      player={featuredPlayer}
                      rachaStats={featuredRachaStats}
                      metrics={featuredMetrics}
                    />

                    {/* 7. History Card */}
                    <PlayerHistoryCard 
                      player={featuredPlayer}
                      recentResults={featuredResults}
                    />

                    {/* 8. Comparison Card */}
                    <PlayerComparisonCard 
                      player={featuredPlayer}
                      rachaStats={featuredRachaStats}
                      allPlayersStats={allPlayersStats}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB - ADMINISTRAÇÃO PAINEL UNIFICADO */}
        {activeTab === 'administration' && isEditor && (
          <div className="space-y-6">
            <div className="flex flex-col gap-1 border-b border-zinc-900 pb-4">
              <h2 className="font-display font-extrabold text-xl text-white">⚙️ Painel de Administração</h2>
              <p className="text-zinc-500 text-xs">Acesse e gerencie as ferramentas administrativas e estados do racha fofim.</p>
            </div>

            <div className="flex gap-2 bg-[#121c16] p-1 rounded-xl border border-zinc-850 max-w-max">
              <button
                type="button"
                onClick={() => setAdminSubTab('approvals')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  adminSubTab === 'approvals'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Aprovações</span>
                {pendingApprovalsCount > 0 && (
                  <span className="bg-amber-500 text-zinc-950 font-black px-1.5 py-0.5 rounded-full text-[9px] leading-none">
                    {pendingApprovalsCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setAdminSubTab('laboratorio')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  adminSubTab === 'laboratorio'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span>Laboratório de Estados</span>
              </button>
            </div>

            <div className="pt-2">
              {adminSubTab === 'approvals' ? (
                <UserApprovalList currentUser={currentUser} />
              ) : (
                <LaboratorioManager 
                  currentUser={currentUser}
                  simulatedState={simulatedState}
                  setSimulatedState={setSimulatedState}
                />
              )}
            </div>
          </div>
        )}

        {/* TAB 4 - RANKING TÉCNICO */}
        {activeTab === 'ranking' && (
          <TechnicalRanking players={players} currentUser={currentUser} />
        )}

        {/* TAB - MURAL DO RACHA MEMORIES */}
        {activeTab === 'mural' && (
          <MuralManager currentUser={currentUser} />
        )}
      </main>

      {/* CUSTOM STATE-BASED CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0b100e] border border-zinc-800 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative p-5 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <h4 className="font-display font-bold text-sm uppercase tracking-wide text-white">
                {confirmModal.title}
              </h4>
            </div>
            <p className="text-xs font-mono text-zinc-300 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex gap-3 pt-2 font-mono text-xs font-bold">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white py-2 rounded-lg border border-zinc-800 transition cursor-pointer text-center uppercase text-[10px] tracking-wider"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="flex-1 bg-rose-950/45 hover:bg-rose-900 border border-rose-500/25 text-rose-400 hover:text-white py-2 rounded-lg transition cursor-pointer text-center uppercase text-[10px] tracking-wider"
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-[#0a0e0c] border-t border-zinc-950 py-5 text-center text-xs text-zinc-600 select-none">
        <p>© 2026 {appName}. Sistema PWA preparado para celular e desktop.</p>
        <p className="text-[10px] text-zinc-700 mt-1">Fundação do Sistema com Controle de Acesso RBAC completo.</p>
      </footer>
    </div>
  );
}
