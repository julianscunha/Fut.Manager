/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, UserRole, UserStatus, PlayerCategory, PlayerPosition } from '../types';
import { 
  Shield, Check, X, Users, AlertCircle, Sparkles, Clock, Ban, 
  Search, Filter, Edit2, History, UserCheck, RefreshCw, UserCog, CheckCircle2, AlertTriangle, ArrowRight, Phone, Award, Sparkle
} from 'lucide-react';
import ResponsiveTabsContainer from './ResponsiveTabsContainer';

interface UserApprovalListProps {
  currentUser: User;
}

export default function UserApprovalList({ currentUser }: UserApprovalListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Tab state for the administration center
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'approvals' | 'audits'>('users');
  
  // Filters & search
  const [roleFilter, setRoleFilter] = useState<'all' | 'jogador' | 'auxiliar' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved' | 'pending' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Editing state for selected user
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('jogador');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [inlineUpdatingId, setInlineUpdatingId] = useState<string | null>(null);

  // Pending users custom initial roles configuration
  const [initialRoles, setInitialRoles] = useState<Record<string, UserRole>>({});

  // Decoupled approval modal states
  const [approvingUser, setApprovingUser] = useState<User | null>(null);
  const [approxRole, setApproxRole] = useState<UserRole>('jogador');
  const [linkOption, setLinkOption] = useState<'existing' | 'create'>('create');
  const [phone, setPhone] = useState<string>('');
  const [playerCategory, setPlayerCategory] = useState<PlayerCategory>('reserva');
  const [primaryPosition, setPrimaryPosition] = useState<PlayerPosition>('atacante');
  const [secondaryPositions, setSecondaryPositions] = useState<PlayerPosition[]>([]);
  const [favoriteTeamId, setFavoriteTeamId] = useState<string>('out');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const uRes = await fetch('/api/users');
      if (!uRes.ok) throw new Error('Não foi possível carregar os usuários.');
      const uData = await uRes.json();
      setUsers(uData);

      const pRes = await fetch('/api/players');
      if (pRes.ok) {
        const pData = await pRes.json();
        setPlayers(pData);
      }

      const aRes = await fetch('/api/users/audits');
      if (aRes.ok) {
        const aData = await aRes.json();
        setAudits([...aData].reverse());
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar dados do painel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatPhoneStr = (v: string) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handleAction = async (userId: string, action: 'approve' | 'reject', customRole?: UserRole) => {
    setError('');
    setSuccessMsg('');

    if (action === 'approve') {
      const u = users.find(x => x.id === userId);
      if (u) {
        setApprovingUser(u);
        setApproxRole(customRole || 'jogador');
        
        // Auto match existing player by name or email
        const similarPlayer = players.find(p => 
          (p.name.toLowerCase().trim() === u.name.toLowerCase().trim() || 
           (p.email && p.email.toLowerCase().trim() === u.email.toLowerCase().trim())) && 
          !p.deletedAt
        );

        if (similarPlayer) {
          setSelectedPlayerId(similarPlayer.id);
          setLinkOption('existing');
        } else {
          setSelectedPlayerId('');
          setLinkOption('create');
        }

        setPhone('');
        setPlayerCategory('reserva');
        setPrimaryPosition('atacante');
        setSecondaryPositions([]);
        setFavoriteTeamId('out');
      }
      return;
    }

    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          action, 
          role: customRole,
          adminName: currentUser.name 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar ação.');

      setSuccessMsg('Cadastro recusado com sucesso.');
      setTimeout(() => setSuccessMsg(''), 4500);

      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar alteração.');
    }
  };

  const handleApproveWithDetails = async () => {
    if (!approvingUser) return;
    setError('');
    setSuccessMsg('');

    try {
      if (linkOption === 'existing' && !selectedPlayerId) {
        throw new Error('Selecione qual atleta existente corresponderá ao usuário.');
      }

      if (linkOption === 'create') {
        if (!phone) {
          throw new Error('O telefone celular deve ser fornecido para criar um novo atleta.');
        }
        if (phone.replace(/\D/g, '').length < 10) {
          throw new Error('Informe um número de telefone celular válido (DDD + número).');
        }
      }

      const payload = {
        userId: approvingUser.id,
        action: 'approve',
        role: approxRole,
        adminName: currentUser.name,
        linkOption,
        selectedPlayerId,
        phone: linkOption === 'create' ? phone : undefined,
        playerCategory: linkOption === 'create' ? playerCategory : undefined,
        primaryPosition: linkOption === 'create' ? primaryPosition : undefined,
        secondaryPositions: linkOption === 'create' ? secondaryPositions : undefined,
        favoriteTeamId: linkOption === 'create' ? favoriteTeamId : undefined
      };

      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar liberação provisória.');

      setSuccessMsg(`Usuário ${approvingUser.name} aprovado com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 4500);
      setApprovingUser(null);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Erro na liberação do cadastro.');
    }
  };

  const handleRoleChangeDirect = async () => {
    if (!editingUser) return;
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: editingUser.id, 
          action: 'update_role', 
          role: selectedRole,
          adminName: currentUser.name,
          selectedPlayerId: selectedPlayerId || undefined
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar privilégio.');

      setSuccessMsg(`Perfil de ${editingUser.name} alterado com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 4500);
      setEditingUser(null);

      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar cargo.');
    }
  };

  const handleInlineRoleAndLink = async (userId: string, role: UserRole, playerId: string) => {
    setError('');
    setSuccessMsg('');
    setInlineUpdatingId(userId);
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId, 
          action: 'update_role', 
          role,
          adminName: currentUser.name,
          selectedPlayerId: playerId || ""
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar dados inline.');

      setSuccessMsg('Alteração inline realizada com sucesso!');
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchData();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar alteração.');
    } finally {
      setInlineUpdatingId(null);
    }
  };

  const getRoleLabel = (r: UserRole) => {
    switch (r) {
      case 'admin': return 'Administrador';
      case 'auxiliar': return 'Auxiliar';
      case 'jogador': return 'Jogador';
      default: return r;
    }
  };

  const getStatusLabel = (s: UserStatus) => {
    switch (s) {
      case 'approved': return 'Aprovado';
      case 'pending': return 'Pendente';
      case 'rejected': return 'Rejeitado';
      default: return s;
    }
  };

  const getLinkedPlayer = (user: User) => {
    if (!user) return null;
    if (user.playerId) {
      return players.find(p => p.id === user.playerId && !p.deletedAt);
    }
    if (!user.email) return null;
    return players.find(p => p.email && p.email.toLowerCase().trim() === user.email.toLowerCase().trim() && !p.deletedAt);
  };

  const startEditRole = (user: User) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedPlayerId(user.playerId || '');
  };

  // Filter pending lists
  const pendingUsers = users.filter((u) => u.status === 'pending');

  // Filter general users list
  const filteredUsers = users.filter((u) => {
    const textMatch = 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const roleMatch = roleFilter === 'all' || u.role === roleFilter;
    const statusMatch = statusFilter === 'all' || u.status === statusFilter;

    return textMatch && roleMatch && statusMatch;
  });

  return (
    <div className="space-y-6" id="user-admin-control-center">
      
      {/* Header and stats overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-display font-black text-white tracking-tight uppercase">
              Aprovações & Central de Permissões
            </h2>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
            Gerencie o acesso do grupo, defina atribuições de perfis administrativos, aprove novos integrantes e audite alterações de segurança no sistema do racha.
          </p>
        </div>

        <button 
          onClick={fetchData}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 text-xs font-semibold rounded-lg border border-zinc-800 active:scale-95 transition whitespace-nowrap cursor-pointer self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {/* Live System Messages */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-center justify-between gap-3 animate-slideDown">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span className="font-mono font-bold">{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="p-1 text-rose-450 hover:text-white hover:bg-rose-500/10 rounded transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 rounded-xl text-xs flex items-center justify-between gap-3 animate-slideDown">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            <span className="font-sans font-bold">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-500/10 rounded transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs navigation */}
      <ResponsiveTabsContainer activeTabId={`tab-sub-${activeSubTab}`}>
        <button
          id="tab-sub-users"
          onClick={() => setActiveSubTab('users')}
          className={`px-4 py-2.5 rounded-t-lg text-xs font-display font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap lg:gap-2.5 ${
            activeSubTab === 'users'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/40'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>
            <span className="hidden md:inline">Acesso de Contas</span>
            <span className="md:hidden">Contas</span>
            {` (${users.length})`}
          </span>
        </button>
        
        <button
          id="tab-sub-approvals"
          onClick={() => setActiveSubTab('approvals')}
          className={`px-4 py-2.5 rounded-t-lg text-xs font-display font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap relative ${
            activeSubTab === 'approvals'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/40'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>
            <span className="hidden md:inline">Pendentes Liberar</span>
            <span className="md:hidden">Pendentes</span>
            {` (${pendingUsers.length})`}
          </span>
          {pendingUsers.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-ping" />
          )}
        </button>

        <button
          id="tab-sub-audits"
          onClick={() => setActiveSubTab('audits')}
          className={`px-4 py-2.5 rounded-t-lg text-xs font-display font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeSubTab === 'audits'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-900/40'
          }`}
        >
          <History className="w-4 h-4" />
          <span>
            <span className="hidden md:inline">Registro de Auditoria</span>
            <span className="md:hidden">Auditoria</span>
            {` (${audits.length})`}
          </span>
        </button>
      </ResponsiveTabsContainer>

      {/* Subtab Contents */}

      {/* 1. USERS LIST & MANAGEMENT SUBTAB */}
      {activeSubTab === 'users' && (
        <div className="space-y-4 animate-fadeIn">
          
          {/* Filters shelf */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#0a0f0d] p-4 rounded-xl border border-zinc-900 shadow-inner">
            
            {/* Search inputs */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-3.5 w-3.5 text-zinc-500" />
              </span>
              <input
                type="text"
                placeholder="Buscar usuário por nome/email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-zinc-880 bg-zinc-950/80 text-xs text-white focus:outline-none focus:border-emerald-555 transition font-sans"
              />
            </div>

            {/* Profile Role Filters */}
            <div className="flex items-center gap-2 bg-zinc-950/80 rounded-lg border border-zinc-900 px-3 py-1.5">
              <Filter className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
              <span className="text-[10px] text-zinc-500 uppercase font-mono whitespace-nowrap">Perfil:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer w-full"
              >
                <option value="all">Todos os Perfis</option>
                <option value="jogador">Jogadores</option>
                <option value="auxiliar">Auxiliares</option>
                <option value="admin">Administradores</option>
              </select>
            </div>

            {/* Status Filters */}
            <div className="flex items-center gap-2 bg-zinc-950/80 rounded-lg border border-zinc-900 px-3 py-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
              <span className="text-[10px] text-zinc-500 uppercase font-mono whitespace-nowrap">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer w-full"
              >
                <option value="all">Todos os Status</option>
                <option value="approved">Aprovados</option>
                <option value="pending">Pendentes</option>
                <option value="rejected">Rejeitados</option>
              </select>
            </div>

          </div>

          {/* User Results Board */}
          {loading ? (
            <div className="text-center py-16 text-xs text-zinc-500 font-mono">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-emerald-450" />
              <span>Sincronizando usuários...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-zinc-900 bg-zinc-900/10">
              <Users className="w-8 h-8 text-zinc-650 mx-auto mb-2" />
              <p className="text-zinc-400 font-bold text-sm">Nenhum usuário encontrado</p>
              <p className="text-xs text-zinc-600 mt-1">Experimente ajustar seus parâmetros de busca ou filtros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map((user) => {
                const linkedPlayer = getLinkedPlayer(user);
                const isRoot = user.id === 'user-admin';

                // Display profile styling
                let roleColor = 'text-emerald-400 border-emerald-500/25 bg-emerald-555/5';
                if (user.role === 'admin') roleColor = 'text-rose-400 border-rose-500/25 bg-rose-555/5';
                if (user.role === 'auxiliar') roleColor = 'text-amber-400 border-amber-500/25 bg-amber-555/5';

                // Display status badge
                let statusBadge = 'text-zinc-500 border-zinc-800 bg-zinc-900/20';
                if (user.status === 'approved') statusBadge = 'text-[#22c55e] border-[#22c55e]/25 bg-[#22c55e]/5';
                if (user.status === 'pending') statusBadge = 'text-amber-400 border-amber-500/25 bg-amber-500/5 animate-pulse';
                if (user.status === 'rejected') statusBadge = 'text-rose-500 border-rose-500/25 bg-rose-500/5';

                return (
                  <div 
                    key={user.id}
                    className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/20 shadow-sm flex flex-col justify-between gap-3 hover:border-zinc-800 transition"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="min-w-0">
                          <p className="font-display font-black text-xs text-white leading-tight truncate">{user.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono truncate">{user.email}</p>
                        </div>

                        {/* Status badge and Profile Label */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-[9px] font-mono border uppercase font-extrabold px-1.5 py-0.5 rounded tracking-wider ${statusBadge}`}>
                            {getStatusLabel(user.status)}
                          </span>
                          <span className={`text-[9px] font-mono border uppercase font-extrabold px-1.5 py-0.5 rounded tracking-wider ${roleColor}`}>
                            {getRoleLabel(user.role)}
                          </span>
                        </div>
                      </div>

                      {/* Explicit Bind Details */}
                      <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-zinc-950 border border-zinc-900/80 text-[11px]">
                        <span className="text-zinc-500 font-mono uppercase text-[9px] tracking-wide shrink-0">⚽ Estado de Vínculo:</span>
                        {linkedPlayer ? (
                          <div className="flex items-center gap-1.5 text-zinc-300 truncate">
                            <span className="font-bold text-emerald-400 truncate">{linkedPlayer.name}</span>
                            <span className="text-zinc-650 font-mono text-[10px]">({linkedPlayer.category})</span>
                          </div>
                        ) : (
                          <span className="text-zinc-650 italic">Ficha não associada</span>
                        )}
                      </div>

                      {/* Painel Administrativo Rápido (Inline) */}
                      {currentUser.role === 'admin' && (
                        <div className="mt-2.5 pt-2.5 border-t border-zinc-900/65 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-fadeIn">
                          {/* Nível de Acesso (Delegar permissão) */}
                          <div className="flex flex-col gap-1 text-left">
                            <label className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider font-extrabold">Cargo / Acesso:</label>
                            <select
                              value={user.role}
                              disabled={inlineUpdatingId === user.id || isRoot}
                              onChange={async (e) => {
                                const newRole = e.target.value as UserRole;
                                await handleInlineRoleAndLink(user.id, newRole, user.playerId || '');
                              }}
                              className="w-full bg-[#0d1310] border border-zinc-900 hover:border-zinc-800 rounded-lg text-xs text-zinc-200 p-2 focus:outline-none focus:border-emerald-555 cursor-pointer font-bold leading-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="jogador">Jogador</option>
                              <option value="auxiliar">Auxiliar</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </div>

                          {/* Vínculo de Jogador */}
                          <div className="flex flex-col gap-1 text-left">
                            <label className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider font-extrabold">Ficha do Atleta:</label>
                            <select
                              value={user.playerId || ''}
                              disabled={inlineUpdatingId === user.id}
                              onChange={async (e) => {
                                const newPlayerId = e.target.value;
                                await handleInlineRoleAndLink(user.id, user.role, newPlayerId);
                              }}
                              className="w-full bg-[#0d1310] border border-zinc-900 hover:border-zinc-800 rounded-lg text-xs text-zinc-200 p-2 focus:outline-none focus:border-emerald-555 cursor-pointer"
                            >
                              {!isRoot && <option value="">-- Sem Vínculo (Não associado) --</option>}
                              {players.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.category === 'mensalista' ? 'Mensalista' : 'Reserva'})
                                </option>
                              ))}
                            </select>
                          </div>

                          {inlineUpdatingId === user.id && (
                            <div className="col-span-1 sm:col-span-2 text-[10px] text-emerald-400 font-mono flex items-center justify-center gap-1.5 my-1 bg-emerald-500/5 py-1 px-2 rounded border border-emerald-500/10">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Sincronizando privilégios...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 border-t border-zinc-900/60 pt-2 text-[10px] text-zinc-650 font-mono">
                      <span>Criado: {new Date(user.createdAt).toLocaleDateString()}</span>
                      
                      {currentUser.role === 'admin' && !isRoot && (
                        <button
                          onClick={() => startEditRole(user)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 hover:text-white border border-zinc-800 rounded transition cursor-pointer text-zinc-400"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Editar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit Role Overlay Modal Popup */}
          {editingUser && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
              <div className="bg-[#0b100e] border border-zinc-800 rounded-xl w-full max-w-sm overflow-hidden shadow-2xl relative p-5 space-y-4">
                
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[9px] font-mono text-emerald-400 font-extrabold uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      ⚙️ Alterar Nível de Acesso
                    </span>
                    <h3 className="font-display font-black text-sm text-white pt-1">
                      Editar Perfil: {editingUser.name}
                    </h3>
                  </div>
                  <button 
                    onClick={() => setEditingUser(null)}
                    className="p-1 text-zinc-500 hover:text-white rounded hover:bg-zinc-900 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 font-sans">
                  <div className="text-xs text-zinc-400 font-mono leading-relaxed bg-zinc-950 p-2.5 rounded border border-zinc-900">
                    <p className="font-bold text-zinc-500 uppercase text-[9px]">DADOS DO USUÁRIO:</p>
                    <p className="mt-0.5 text-zinc-300"><span className="text-zinc-600">ID:</span> {editingUser.id}</p>
                    <p className="text-zinc-300"><span className="text-zinc-600">Email:</span> {editingUser.email}</p>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono uppercase font-bold block mb-1">Selecionar Novo Cargo:</label>
                    <div className="grid grid-cols-1 gap-2">
                      <label className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                        selectedRole === 'jogador' 
                          ? 'border-emerald-550 bg-emerald-950/10 text-emerald-400' 
                          : 'border-zinc-855 bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/40'
                      }`}>
                        <input 
                          type="radio" 
                          name="assignedRole" 
                          value="jogador" 
                          checked={selectedRole === 'jogador'}
                          onChange={() => setSelectedRole('jogador')}
                          className="accent-emerald-555 h-3.5 w-3.5"
                        />
                        <div className="text-[11px] leading-tight flex-1">
                          <p className="font-bold text-white">Jogador</p>
                          <p className="text-[9.5px] text-zinc-500 mt-0.5">Acesso comum para confirmar presença e visualizar estatísticas do grupo.</p>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                        selectedRole === 'auxiliar' 
                          ? 'border-amber-550 bg-amber-950/10 text-amber-400' 
                          : 'border-zinc-855 bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/40'
                      }`}>
                        <input 
                          type="radio" 
                          name="assignedRole" 
                          value="auxiliar" 
                          checked={selectedRole === 'auxiliar'}
                          onChange={() => setSelectedRole('auxiliar')}
                          className="accent-amber-550 h-3.5 w-3.5"
                        />
                        <div className="text-[11px] leading-tight flex-1">
                          <p className="font-bold text-white">Auxiliar</p>
                          <p className="text-[9.5px] text-zinc-500 mt-0.5">Pode agendar rodadas, registrar presenças e votar em avaliações.</p>
                        </div>
                      </label>

                      <label className={`p-2.5 rounded-lg border flex items-center gap-2.5 cursor-pointer transition ${
                        selectedRole === 'admin' 
                          ? 'border-rose-550 bg-rose-950/10 text-rose-400' 
                          : 'border-zinc-855 bg-zinc-900/20 text-zinc-400 hover:bg-zinc-900/40'
                      }`}>
                        <input 
                          type="radio" 
                          name="assignedRole" 
                          value="admin" 
                          checked={selectedRole === 'admin'}
                          onChange={() => setSelectedRole('admin')}
                          className="accent-rose-550 h-3.5 w-3.5"
                        />
                        <div className="text-[11px] leading-tight flex-1">
                          <p className="font-bold text-white">Administrador</p>
                          <p className="text-[9.5px] text-zinc-500 mt-0.5">Acesso integral, incluindo financeiro, segurança e controle de usuários.</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Explicit Athlete Link mapping drawer in user editor */}
                  <div className="border-t border-zinc-900 pt-3">
                    <label className="text-[10px] text-zinc-500 font-mono uppercase font-bold block mb-1">🔗 Vínculo Esportivo (Atleta):</label>
                    <select
                      value={selectedPlayerId}
                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-lg text-xs text-zinc-300 p-2 focus:outline-none"
                    >
                      <option value="">-- Não Associado / Sem Ficha --</option>
                      {players.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.category})
                        </option>
                      ))}
                    </select>
                    <p className="text-[9px] text-zinc-600 font-mono mt-1">
                      Determine de forma explícita qual atleta herda o login desta conta.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleRoleChangeDirect}
                    className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                  >
                    Salvar Perfil
                  </button>
                  <button
                    onClick={() => setEditingUser(null)}
                    className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-medium rounded-lg text-xs transition border border-zinc-800 cursor-pointer"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 2. PENDING REQUESTS PROCESSOR */}
      {activeSubTab === 'approvals' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="pb-2 border-b border-zinc-900 flex justify-between items-center">
            <h3 className="font-display font-semibold text-sm text-white">
              Análise e Liberação de Novos Usuários ({pendingUsers.length})
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">Cadastros não avaliados</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-500 text-xs">Atualizando lista de aprovação...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-14 rounded-xl border border-dashed border-zinc-850 bg-zinc-950/10 p-6">
              <Check className="w-10 h-10 text-emerald-500 mx-auto mb-2 opacity-60" />
              <p className="text-zinc-300 font-display font-black text-xs uppercase tracking-wider">Tudo em ordem!</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto leading-normal">
                Nenhum novo registro de cadastro pendente de aprovação. Todos os pretendentes foram devidamente liberados ou recusados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => {
                const selectedInitialRole = initialRoles[user.id] || 'jogador';

                return (
                  <div
                    key={user.id}
                    className="p-4 rounded-xl border border-zinc-850 bg-[#0a0f0d] hover:border-zinc-700/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn"
                  >
                    <div className="space-y-1">
                      <p className="font-display font-black text-xs text-white uppercase tracking-tight">{user.name}</p>
                      <p className="text-xs text-zinc-400 font-mono leading-none">{user.email}</p>
                      <p className="text-[9px] text-zinc-600 font-mono mt-1">
                        Cadastrado em: {new Date(user.createdAt).toLocaleDateString('pt-BR')} às {new Date(user.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 self-start sm:self-auto">
                      
                      {/* Initial Role Select dropdown */}
                      <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1.5 rounded-lg border border-zinc-900">
                        <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-wider">Perfil Inicial:</span>
                        <select
                          value={selectedInitialRole}
                          onChange={(e) => {
                            const val = e.target.value as UserRole;
                            setInitialRoles(prev => ({ ...prev, [user.id]: val }));
                          }}
                          className="bg-transparent text-xs text-zinc-300 font-bold focus:outline-none cursor-pointer"
                        >
                          <option value="jogador">Jogador (Padrão)</option>
                          <option value="auxiliar">Auxiliar</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>

                      {/* Approval triggers */}
                      <div className="flex items-center gap-1.5 font-sans">
                        <button
                          onClick={() => handleAction(user.id, 'approve', selectedInitialRole)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow transition cursor-pointer active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Liberar racha</span>
                        </button>
                        <button
                          onClick={() => handleAction(user.id, 'reject')}
                          className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-rose-500/10 text-zinc-500 hover:text-rose-400 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Recusar</span>
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DETAILED ATHLETE DECOUPLE AND LINK MODAL OVERLAY */}
      {approvingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0b100e] border border-zinc-800 rounded-2xl w-full max-w-lg overflow-y-auto max-h-[90vh] shadow-2xl relative p-6 space-y-5 font-sans">
            
            <div className="flex justify-between items-start border-b border-zinc-900 pb-3">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-emerald-400 font-extrabold uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  ⚡ Vincular Ficha de Atleta
                </span>
                <h3 className="font-display font-black text-sm text-white uppercase mt-1">
                  Liberar Usuário: {approvingUser.name}
                </h3>
                <p className="text-[10px] text-zinc-500 font-mono">{approvingUser.email}</p>
              </div>
              <button 
                onClick={() => setApprovingUser(null)}
                className="p-1.5 text-zinc-600 hover:text-white rounded bg-zinc-950 hover:bg-zinc-900 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Link Option selection cards */}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-zinc-500 font-mono uppercase font-bold block mb-2">
                  Escolha como gerenciar a ficha esportiva:
                </label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Select Option 1: Link Existing */}
                  <button
                    type="button"
                    onClick={() => setLinkOption('existing')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      linkOption === 'existing'
                        ? 'border-emerald-500 bg-emerald-950/10 text-white'
                        : 'border-zinc-880 bg-zinc-950/30 text-zinc-400 hover:bg-zinc-950/65'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className={`w-4 h-4 ${linkOption === 'existing' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                      <span className="text-xs font-black uppercase tracking-tight">Atleta Existente</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 leading-snug">
                      Associa a conta a uma ficha histórica/esportiva que já está cadastrada no racha.
                    </p>
                  </button>

                  {/* Select Option 2: Create Brand New */}
                  <button
                    type="button"
                    onClick={() => setLinkOption('create')}
                    className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      linkOption === 'create'
                        ? 'border-emerald-500 bg-emerald-950/10 text-white'
                        : 'border-zinc-880 bg-zinc-950/30 text-zinc-400 hover:bg-zinc-950/65'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className={`w-4 h-4 ${linkOption === 'create' ? 'text-emerald-400' : 'text-zinc-600'}`} />
                      <span className="text-xs font-black uppercase tracking-tight">Criar Novo Atleta</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 leading-snug">
                      Cria um atleta completamente do zero no racha para herdar esta conta de acesso.
                    </p>
                  </button>
                </div>
              </div>

              {/* Conditional Layout: select existing player athlete */}
              {linkOption === 'existing' ? (
                <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-2.5 animate-fadeIn">
                  <label className="text-[10px] text-zinc-500 font-mono uppercase font-bold block">
                    Vincular a qual ficha de atleta existente?
                  </label>
                  <select
                    value={selectedPlayerId}
                    onChange={(e) => setSelectedPlayerId(e.target.value)}
                    className="w-full bg-[#0a0f0d] border border-zinc-800 rounded-lg text-xs text-white p-2.5 font-sans focus:outline-none focus:border-emerald-550"
                  >
                    <option value="">-- Selecione o Atleta --</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.category}) - {p.phone || 'Sem celular'}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9.5px] text-zinc-600 leading-snug">
                    O atleta selecionado acima será vinculado de forma direta à conta. Todas as estatísticas e logs históricos deste atleta estarão atrelados ao login desse proprietário.
                  </p>
                </div>
              ) : (
                /* Conditional Layout: create new player athlete fields definition */
                <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl space-y-4 animate-fadeIn">
                  
                  {/* Phone Cellular (Mandatory) */}
                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono uppercase font-bold flex items-center gap-1.5 mb-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Telefone Celular (Obrigatório)*:</span>
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      placeholder="(85) 99999-9999"
                      value={phone}
                      onChange={(e) => setPhone(formatPhoneStr(e.target.value))}
                      className="w-full bg-[#0a0f0d] border border-zinc-800 rounded-lg text-xs text-white p-2.5 focus:outline-none focus:border-emerald-555 font-mono"
                    />
                    <p className="text-[9px] text-zinc-600 mt-1">Insira com DDD. Exemplo: (85) 91234-5678</p>
                  </div>

                  {/* Sports Category with visual aid details helper box */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-zinc-500 font-mono uppercase font-bold block">
                      Categoria do Atleta:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['mensalista', 'reserva'] as PlayerCategory[]).map((cat) => {
                        let catLabel = 'Mensalista';
                        if (cat === 'reserva') catLabel = 'Reserva';

                        return (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setPlayerCategory(cat)}
                            className={`p-2 rounded border text-[10px] font-bold uppercase transition ${
                              playerCategory === cat
                                ? 'border-emerald-550 bg-emerald-950/20 text-emerald-450'
                                : 'border-zinc-850 bg-zinc-900/10 text-zinc-400 hover:bg-zinc-900/20'
                            }`}
                          >
                            {catLabel}
                          </button>
                        );
                      })}
                    </div>

                    {/* Visual Aid helper box describing categorization rules */}
                    <div className="bg-zinc-900/50 p-2.5 rounded-lg border border-zinc-850 text-[10px] text-zinc-400 space-y-1 mt-1 text-left leading-normal">
                      <p className="font-bold text-zinc-300 uppercase text-[9px] tracking-wide flex items-center gap-1">
                        <Award className="w-3 h-3 text-emerald-400" />
                        Guia de Categorização Esportiva:
                      </p>
                      {playerCategory === 'mensalista' && (
                        <p>⭐️ <strong>Mensalista</strong>: Participa da escala regular de faturamento mensal. Contribuinte fixo do racha com prioridade de sorteios. {primaryPosition === 'goleiro' && <strong className="text-emerald-500">(Goleiro Isento de Mensalidade)</strong>}</p>
                      )}
                      {playerCategory === 'reserva' && (
                        <p>📋 <strong>Reserva</strong>: Jogador avulso convidado sob demanda. Isento de mensalidades fixas recorrentes do faturamento.</p>
                      )}
                    </div>
                  </div>

                  {/* Sports Position with goalkeeper automated rules alert */}
                  <div>
                    <label className="text-[10px] text-zinc-500 font-mono uppercase font-bold block mb-1">
                      Posição Principal:
                    </label>
                    <select
                      value={primaryPosition}
                      onChange={(e) => setPrimaryPosition(e.target.value as PlayerPosition)}
                      className="w-full bg-[#0a0f0d] border border-zinc-800 rounded-lg text-xs text-white p-2"
                    >
                      <option value="goleiro">🧤 Goleiro (Arqueiro)</option>
                      <option value="fixo">🛡️ Fixo (Defensor)</option>
                      <option value="ala">⚡ Ala (Lateral/Meio)</option>
                      <option value="pivo">🎯 Pivô (Centroavante)</option>
                      <option value="atacante">⚽ Atacante (Geral)</option>
                    </select>

                    {primaryPosition === 'goleiro' && (
                      <div className="mt-2 p-2 bg-emerald-500/5 rounded border border-emerald-500/10 text-[9.5px] text-emerald-450 leading-relaxed font-mono">
                        🧤 [REGRA AUTOMÁTICA]: Goleiros terão regras específicas aplicadas durante sorteios automatizados de equipes e terão destaque visual de goleiro.
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* Action Triggers footer */}
            <div className="flex gap-2.5 border-t border-zinc-900 pt-4 font-sans">
              <button
                type="button"
                onClick={handleApproveWithDetails}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md transition-all active:scale-95 cursor-pointer leading-none flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Confirmar e Liberar Conta</span>
              </button>
              <button
                type="button"
                onClick={() => setApprovingUser(null)}
                className="px-4 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-medium rounded-xl text-xs transition cursor-pointer"
              >
                Voltar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* 3. AUDIT LOG SUBTAB */}
      {activeSubTab === 'audits' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="pb-2 border-b border-zinc-900 flex justify-between items-center">
            <h3 className="font-display font-semibold text-sm text-white">
              Histórico de Alterações e Auditoria de Acesso
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">LOG DO BANCO DE DADOS</span>
          </div>

          {audits.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850 p-6 bg-zinc-950/20 text-zinc-500 text-xs">
              <History className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
              <span>Nenhuma alteração registrada em logs de auditoria até o momento.</span>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1 font-sans">
              {audits.map((log: any) => {
                return (
                  <div 
                    key={log.id} 
                    className="p-3 bg-zinc-950/40 border border-zinc-900 rounded-lg text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-zinc-800/80 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] bg-zinc-900 font-mono text-zinc-300 px-2 py-0.5 rounded border border-zinc-850 uppercase font-black tracking-wider text-[9px]">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {new Date(log.timestamp).toLocaleDateString('pt-BR')} às {new Date(log.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      <div className="text-[11px] text-zinc-300">
                        Acesso de <span className="font-bold text-white">{log.userName}</span> ({log.userEmail}) gerenciado.
                      </div>

                      {log.details && (
                        <div className="text-[10px] text-emerald-400 font-mono italic mt-1 bg-zinc-950/60 p-1.5 rounded border border-zinc-900 w-full max-w-xl">
                          ℹ️ {typeof log.details === 'object'
                            ? (log.details.loggedMessage || JSON.stringify(log.details))
                            : String(log.details)}
                        </div>
                      )}

                      {(log.previousRole || log.newRole || log.previousStatus || log.newStatus) && (
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                          {log.previousRole && (
                            <>
                              <span>Perfil: {log.previousRole}</span>
                              <ArrowRight className="w-3 h-3 text-zinc-655" />
                              <span className="text-emerald-400 font-bold">{log.newRole}</span>
                            </>
                          )}
                          {log.previousStatus !== log.newStatus && (
                            <>
                              {log.previousRole && <span className="text-zinc-700">|</span>}
                              <span>Status: {getStatusLabel(log.previousStatus)}</span>
                              <ArrowRight className="w-3 h-3 text-zinc-655" />
                              <span className="text-emerald-400 font-bold">{getStatusLabel(log.newStatus)}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right text-[10px] font-mono shrink-0">
                      <span className="text-zinc-500 block">Autor da Ação:</span>
                      <span className="text-zinc-400 font-bold">{log.performedBy}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
