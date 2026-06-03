/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Shield, Check, X, Users, AlertCircle, Sparkles, Clock, Ban } from 'lucide-react';

interface UserApprovalListProps {
  currentUser: User;
}

export default function UserApprovalList({ currentUser }: UserApprovalListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Não foi possível carregar os usuários.');
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAction = async (userId: string, action: 'approve' | 'reject') => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar ação.');

      setSuccessMsg(action === 'approve' ? 'Usuário aprovado com sucesso!' : 'Cadastro recusado.');
      
      // Auto dismiss success
      setTimeout(() => setSuccessMsg(''), 4000);

      // Re-fetch list
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar alteração.');
    }
  };

  const handleRoleChange = async (userId: string, targetRole: UserRole) => {
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'update_role', role: targetRole })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar privilégio.');

      setSuccessMsg(`Cargo alterado para ${targetRole === 'admin' ? 'Administrador' : targetRole === 'auxiliar' ? 'Auxiliar' : 'Jogador'} com sucesso!`);
      setTimeout(() => setSuccessMsg(''), 4000);

      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao alterar cargo.');
    }
  };

  const pendingUsers = users.filter((u) => u.status === 'pending');
  const activeMembers = users.filter((u) => u.status === 'approved');
  const rejectedUsers = users.filter((u) => u.status === 'rejected');

  return (
    <div className="space-y-6" id="user-approval-panel">
      {/* Messages */}
      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs flex items-center gap-2">
          <Sparkles className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Pending Approval List (Col span 2 on large screens) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-500" />
              <h3 className="font-display font-semibold text-base text-white">
                Aprovações Pendentes ({pendingUsers.length})
              </h3>
            </div>
            <span className="text-xs text-zinc-500">Aguardando decisão</span>
          </div>

          {loading && users.length === 0 ? (
            <div className="text-center py-10 text-zinc-500 text-xs">Carregando solicitações...</div>
          ) : pendingUsers.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/10 p-6">
              <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-60" />
              <p className="text-zinc-400 font-medium">Nenhuma aprovação pendente!</p>
              <p className="text-xs text-zinc-600 mt-1">Todos os cadastros foram analisados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/30 hover:border-zinc-700/50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <p className="font-display font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-zinc-400">{user.email}</p>
                    <p className="text-[10px] text-zinc-600">
                      Cadastrado em: {new Date(user.createdAt).toLocaleDateString('pt-BR')} às {new Date(user.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  <div className="flex items-center flex-wrap gap-2.5">
                    {/* Role Suggestion before approval */}
                    <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1 rounded border border-zinc-800">
                      <span className="text-[10px] text-zinc-500 font-mono">Cargo inicial:</span>
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                        className="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer"
                      >
                        <option value="jogador">Jogador</option>
                        <option value="auxiliar">Auxiliar</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto md:ml-0">
                      <button
                        id={`btn-approve-${user.id}`}
                        onClick={() => handleAction(user.id, 'approve')}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shadow-md transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Aprovar</span>
                      </button>
                      <button
                        id={`btn-reject-${user.id}`}
                        onClick={() => handleAction(user.id, 'reject')}
                        className="px-3 py-1.5 bg-zinc-850 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Recusar</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members & Controls Panel */}
        <div className="space-y-4">
          <div className="pb-3 border-b border-zinc-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-[#22c55e]" />
            <h3 className="font-display font-semibold text-base text-white">
              Jogadores & Permissões ({activeMembers.length})
            </h3>
          </div>

          <div className="bg-[#121a15]/50 border border-zinc-800/80 rounded-xl p-4 space-y-3.5 max-h-[420px] overflow-y-auto">
            {activeMembers.map((user) => {
              const isRootAdmin = user.id === 'user-admin';
              return (
                <div key={user.id} className="flex items-center justify-between pb-2.5 border-b border-zinc-900 last:border-0 last:pb-0">
                  <div className="min-w-0 pr-2">
                    <p className="font-medium text-xs text-white truncate">{user.name}</p>
                    <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                  </div>

                  {isRootAdmin ? (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono font-bold uppercase">
                      Admin Raiz
                    </span>
                  ) : (
                    <select
                      value={user.role}
                      disabled={currentUser.role !== 'admin'}
                      onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                      className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300 focus:outline-[#22c55e] cursor-pointer"
                    >
                      <option value="jogador">Jogador</option>
                      <option value="auxiliar">Auxiliar</option>
                      <option value="admin">Administrador</option>
                    </select>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recused List */}
          {rejectedUsers.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Ban className="w-4 h-4 text-rose-500" />
                <span>Solicitações Rejeitadas ({rejectedUsers.length})</span>
              </div>
              <div className="bg-zinc-950 border border-zinc-900 rounded-lg p-3 max-h-[140px] overflow-y-auto space-y-1.5 text-[11px] text-zinc-500">
                {rejectedUsers.map((u) => (
                  <div key={u.id} className="flex justify-between items-center bg-zinc-900/40 p-2 rounded">
                    <span className="truncate max-w-[140px]">{u.name}</span>
                    <button
                      onClick={() => handleAction(u.id, 'approve')}
                      className="text-[#4ade80] hover:underline cursor-pointer"
                      title="Reavaliar e aprovar"
                    >
                      Reaprovar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
