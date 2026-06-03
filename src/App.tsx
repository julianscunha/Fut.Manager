/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, Player, POSITION_LABELS, CATEGORY_LABELS, FAVORITE_TEAMS } from './types';
import AuthScreens from './components/AuthScreens';
import DashboardStatus from './components/DashboardStatus';
import PlayerCard from './components/PlayerCard';
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
  Filter,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
  Award,
  Calendar
} from 'lucide-react';
import CalendarManager from './components/CalendarManager';
import DrawManager from './components/DrawManager';

type NavTab = 'dash' | 'players' | 'approvals' | 'ranking' | 'calendar' | 'draw';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('racha_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<NavTab>('dash');
  const [players, setPlayers] = useState<Player[]>([]);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Player search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showSoftDeleted, setShowSoftDeleted] = useState(false);

  // Modal / Form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);

  // Loading / Messages status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Save/retrieve session helper
  const handleLoginSuccess = (user: User) => {
    localStorage.setItem('racha_user', JSON.stringify(user));
    setCurrentUser(user);
    setActiveTab('dash');
  };

  const handleLogout = () => {
    localStorage.removeItem('racha_user');
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
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('Não foi possível carregar o roster de atletas.');
      const data = await res.json();
      setPlayers(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão com o banco.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch pending registrations countdown (Admin/Auxiliar)
  const fetchPendingCount = async () => {
    if (!currentUser) return;
    if (currentUser.role !== 'admin' && currentUser.role !== 'auxiliar') return;
    try {
      const res = await fetch('/api/users');
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
    }
  }, [currentUser, activeTab]);

  // Player CRUD actions
  const handleSavePlayer = async (formData: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const isEdit = !!editingPlayer;
      const url = isEdit ? `/api/players/${editingPlayer.id}` : '/api/players';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
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

  const handleInactivatePlayer = async (id: string) => {
    if (!confirm('Deseja realmente inativar este jogador?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/players/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao inativar jogador.');

      setSuccessMsg('Jogador inativado (soft delete aplicado).');
      await fetchPlayers();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao inativar usuário.');
    }
  };

  const handleRestorePlayer = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch(`/api/players/${id}/restore`, { method: 'POST' });
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

  return (
    <div className="min-h-screen flex flex-col bg-[#0b110e]" id="racha-app-viewport">
      {/* Dynamic Sports Header */}
      <header className="sticky top-0 z-40 bg-[#0d1612]/95 border-b border-zinc-900 backdrop-blur-md px-4 py-3 select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-[#22c55e] p-1.5 rounded-lg border border-white/10 flex items-center justify-center shadow shadow-emerald-500/10">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-display font-black text-sm tracking-tight text-white uppercase">
                Racha do <span className="text-[#22c55e]">Fofim</span>
              </span>
              <span className="block text-[8px] font-mono text-zinc-500 uppercase tracking-wide">
                Private Soccer Group
              </span>
            </div>
          </div>

          {/* Quick Nav bar links */}
          <nav className="flex items-center bg-[#131e18] p-1 rounded-xl border border-zinc-850 text-xs">
            <button
              id="tab-dash"
              onClick={() => { setActiveTab('dash'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'dash'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ínicio</span>
            </button>

            <button
              id="tab-players"
              onClick={() => { setActiveTab('players'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'players'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Jogadores</span>
            </button>

            <button
              id="tab-calendar"
              onClick={() => { setActiveTab('calendar'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'calendar'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendário</span>
            </button>

            <button
              id="tab-draw"
              onClick={() => { setActiveTab('draw'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'draw'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sorteio</span>
            </button>

            <button
              id="tab-ranking"
              onClick={() => { setActiveTab('ranking'); setIsFormOpen(false); }}
              className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                activeTab === 'ranking'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Ranking</span>
            </button>

            {isEditor && (
              <button
                id="tab-approvals"
                onClick={() => { setActiveTab('approvals'); setIsFormOpen(false); }}
                className={`relative px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeTab === 'approvals'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Aprovações</span>
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
            <div className="hidden md:flex flex-col text-right font-sans">
              <span className="text-[11px] font-bold text-white">{currentUser.name}</span>
              <span className="text-[9px] font-mono text-zinc-500 uppercase">{currentUser.role}</span>
            </div>
            <button
              id="btn-logout"
              onClick={handleLogout}
              className="p-2 border border-zinc-850 hover:bg-rose-950/20 text-zinc-400 hover:text-rose-400 rounded-xl transition cursor-pointer"
              title="Sair da Conta"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 relative">
        <div className="absolute inset-0 field-decor pointer-events-none opacity-5" />

        {/* Action confirmation notifications */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/25 text-[#4ade80] rounded-xl text-xs flex items-center gap-2.5">
            <Sparkles className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* TAB 1 - DASHBOARD INICIAL */}
        {activeTab === 'dash' && (
          <DashboardStatus
            currentUser={currentUser}
            onNavigateToPlayers={() => setActiveTab('players')}
            onNavigateToApprovals={isEditor ? (() => setActiveTab('approvals')) : undefined}
            pendingApprovalsCount={pendingApprovalsCount}
          />
        )}

        {/* TAB 5 - CALENDARIO, TEMPORADAS E RESERVAS */}
        {activeTab === 'calendar' && (
          <CalendarManager currentUser={currentUser} />
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
                    <button
                      id="btn-new-player"
                      onClick={() => { setEditingPlayer(null); setIsFormOpen(true); }}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition cursor-pointer"
                    >
                      <PlusCircle className="w-4" />
                      <span>Cadastrar Atleta</span>
                    </button>
                  )}
                </div>

                {/* Filter and Search Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-[#111815] p-3.5 rounded-xl border border-zinc-850/80">
                  
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
                      <option value="mensalista_goleiro">Mensalista Goleiro</option>
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

                  {/* Toggle Active / Inactive if Editor */}
                  {isEditor && (
                    <div className="md:col-span-4 flex justify-between items-center bg-zinc-950/40 p-2 rounded-lg border border-zinc-900/60 mt-1">
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
                ) : filteredPlayers.length === 0 ? (
                  <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850/80 bg-zinc-900/15 p-6">
                    <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
                    <p className="text-zinc-400 font-semibold text-sm">Nenhum jogador encontrado!</p>
                    <p className="text-xs text-zinc-600 mt-1">Tente trocar os filtros aplicados acima ou faça um cadastro.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPlayers.map((player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        currentUser={currentUser}
                        canEdit={isEditor}
                        onEdit={handleEditClick}
                        onInactivate={handleInactivatePlayer}
                        onRestore={handleRestorePlayer}
                        onEvaluationSavedGlobal={() => fetchPlayers()}
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

        {/* TAB 3 - APROVAÇÕES GRUPO */}
        {activeTab === 'approvals' && isEditor && (
          <UserApprovalList currentUser={currentUser} />
        )}

        {/* TAB 4 - RANKING TÉCNICO */}
        {activeTab === 'ranking' && (
          <TechnicalRanking players={players} currentUser={currentUser} />
        )}
      </main>

      <footer className="bg-[#0a0e0c] border-t border-zinc-950 py-5 text-center text-xs text-zinc-600 select-none">
        <p>© 2026 Racha do Fofim. Sistema PWA preparado para celular e desktop.</p>
        <p className="text-[10px] text-zinc-700 mt-1">Fundação do Sistema com Controle de Acesso RBAC completo.</p>
      </footer>
    </div>
  );
}
