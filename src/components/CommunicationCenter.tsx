import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { motion, AnimatePresence } from 'motion/react';
import ResponsiveTabsContainer from './ResponsiveTabsContainer';
import {
  Megaphone,
  BookOpen,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Archive,
  ArrowUp,
  ArrowDown,
  History,
  Clock,
  CheckCircle,
  X,
  AlertCircle,
  User,
  RotateCcw
} from 'lucide-react';
import { User as UserType, MuralPost, Match } from '../types/domain';

interface CommunicationCenterProps {
  currentUser: UserType | null;
  forceTab?: 'regra' | 'aviso' | 'comunicado' | 'history';
  hideTabs?: boolean;
}

export default function CommunicationCenter({ currentUser, forceTab, hideTabs }: CommunicationCenterProps) {
  const isAdmin = currentUser?.role === 'admin';

  // State managers
  const [posts, setPosts] = useState<MuralPost[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // View States
  const [activeTab, setActiveTab] = useState<'regra' | 'aviso' | 'comunicado' | 'history'>('regra');
  
  // Modals / Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editPost, setEditPost] = useState<MuralPost | null>(null);

  // Form Field States
  const [formCategory, setFormCategory] = useState<'regra' | 'aviso' | 'comunicado'>('regra');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<'alta' | 'media' | 'baixa'>('media');
  const [formStartDate, setFormStartDate] = useState('');
  const [formExpirationDate, setFormExpirationDate] = useState('');
  const [formMatchId, setFormMatchId] = useState('');
  const [formOrder, setFormOrder] = useState<number>(1);

  useEffect(() => {
    if (forceTab) {
      setActiveTab(forceTab);
    }
  }, [forceTab]);

  useEffect(() => {
    const handleTriggerAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{ category: 'regra' | 'aviso' | 'comunicado' }>;
      const { category } = customEvent.detail;
      if (
        category === forceTab ||
        (!forceTab && category === activeTab)
      ) {
        handleOpenCreateForm(category);
      }
    };
    window.addEventListener('trigger-add-communication', handleTriggerAdd);
    return () => {
      window.removeEventListener('trigger-add-communication', handleTriggerAdd);
    };
  }, [forceTab, activeTab, posts, matches]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [muralRes, matchesRes] = await Promise.all([
        authFetch('/api/mural/posts'),
        authFetch('/api/matches')
      ]);

      if (!muralRes.ok) throw new Error('Não foi possível carregar as publicações do mural.');
      if (!matchesRes.ok) throw new Error('Não foi possível carregar as rodadas.');

      const muralData = await muralRes.json();
      const matchesData = await matchesRes.json();

      setPosts(muralData || []);
      setMatches(matchesData || []);
    } catch (err: any) {
      console.error('[Load Communication Center Data]', err);
      setErrorMsg(err.message || 'Erro ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = (category: 'regra' | 'aviso' | 'comunicado' = 'regra') => {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];

    // Determine default order for a new rule
    const existingRules = posts.filter(p => p.category === 'regra' && !p.isDeleted);
    const maxOrder = existingRules.reduce((max, r) => Math.max(max, r.order ?? 0), 0);

    setEditPost(null);
    setFormCategory(category);
    setFormTitle('');
    setFormDescription('');
    setFormPriority('media');
    setFormStartDate(today);
    setFormExpirationDate(nextWeekStr);
    setFormMatchId(matches[0]?.id || '');
    setFormOrder(maxOrder + 1);
  };

  const handleOpenCreateForm = (cat: 'regra' | 'aviso' | 'comunicado') => {
    resetForm(cat);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (post: MuralPost) => {
    setEditPost(post);
    setFormCategory(post.category as 'regra' | 'aviso' | 'comunicado');
    setFormTitle(post.title);
    setFormDescription(post.description);
    setFormPriority(post.priority || 'media');
    setFormStartDate(post.startDate || new Date().toISOString().split('T')[0]);
    setFormExpirationDate(post.expirationDate || '');
    setFormMatchId(post.matchId || '');
    setFormOrder(post.order ?? 1);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setErrorMsg('O título é obrigatório.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const payload: any = {
      title: formTitle,
      description: formDescription,
      category: formCategory,
      authorId: currentUser?.id || 'system',
      authorName: currentUser?.name || 'Administrador',
      authorRole: currentUser?.role || 'admin',
      reqUserId: currentUser?.id,
      reqUserRole: currentUser?.role,
    };

    if (formCategory === 'regra') {
      payload.order = Number(formOrder);
    } else if (formCategory === 'aviso') {
      payload.startDate = formStartDate;
      payload.expirationDate = formExpirationDate;
      payload.priority = formPriority;
    } else if (formCategory === 'comunicado') {
      payload.matchId = formMatchId;
    }

    try {
      let res;
      if (editPost) {
        // Edit existing post
        res = await authFetch(`/api/mural/posts/${editPost.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new
        res = await authFetch('/api/mural/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao processar requisição.');
      }

      setSuccessMsg(editPost ? 'Comunicado editado com sucesso!' : 'Novo comunicado criado com sucesso!');
      setIsFormOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('[Submit Communication Form]', err);
      setErrorMsg(err.message || 'Erro ao gravar informações.');
    } finally {
      setActionLoading(false);
    }
  };

  // Archive or Unarchive communication item
  const handleToggleArchive = async (post: MuralPost) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authFetch(`/api/mural/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: post.title,
          description: post.description,
          isArchived: !post.isArchived,
          reqUserId: currentUser?.id,
          reqUserRole: currentUser?.role,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao arquivar/desarquivar.');
      }

      setSuccessMsg(post.isArchived ? 'Item desarquivado com sucesso!' : 'Item arquivado e enviado para o Histórico!');
      await loadData();
    } catch (err: any) {
      console.error('[Archive Communication]', err);
      setErrorMsg(err.message || 'Falha ao alterar estado de arquivamento.');
    } finally {
      setActionLoading(false);
    }
  };

  // Soft delete item
  const handleDeletePost = async (post: MuralPost) => {
    if (!window.confirm('Tem certeza de que deseja enviar esta comunicação para a lixeira/histórico? Ela não será excluída fisicamente do banco de dados.')) {
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authFetch(`/api/mural/posts/${post.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reqUserRole: currentUser?.role,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao excluir.');
      }

      setSuccessMsg('Publicação excluída com sucesso (Soft Delete)!');
      await loadData();
    } catch (err: any) {
      console.error('[Delete Communication]', err);
      setErrorMsg(err.message || 'Falha ao excluir publicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Recover soft-deleted item
  const handleRecoverDeleted = async (post: MuralPost) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authFetch(`/api/mural/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: post.title,
          description: post.description,
          isDeleted: false,
          isArchived: false,
          reqUserId: currentUser?.id,
          reqUserRole: currentUser?.role,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erro ao recuperar publicação.');
      }

      setSuccessMsg('Publicação restaurada nos ativos com sucesso!');
      await loadData();
    } catch (err: any) {
      console.error('[Recover Deleted]', err);
      setErrorMsg(err.message || 'Falha ao restaurar publicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Rule manual ordering
  const handleMoveRule = async (rule: MuralPost, direction: 'up' | 'down') => {
    const rules = posts.filter(p => p.category === 'regra' && !p.isDeleted && !p.isArchived)
                       .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const index = rules.findIndex(r => r.id === rule.id);
    if (index === -1) return;

    let targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rules.length) return;

    const targetRule = rules[targetIndex];

    const currentOrder = rule.order ?? index;
    const targetOrder = targetRule.order ?? targetIndex;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await authFetch(`/api/mural/posts/${rule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: rule.title,
          description: rule.description,
          category: 'regra',
          order: targetOrder,
          reqUserId: currentUser?.id,
          reqUserRole: currentUser?.role
        })
      });

      await authFetch(`/api/mural/posts/${targetRule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: targetRule.title,
          description: targetRule.description,
          category: 'regra',
          order: currentOrder,
          reqUserId: currentUser?.id,
          reqUserRole: currentUser?.role
        })
      });

      setSuccessMsg('Ordenação atualizada com sucesso!');
      await loadData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Falha ao reordenar as regras.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtering list based on selected view tab
  const getFilteredItems = () => {
    // Find completed match IDs
    if (activeTab === 'regra') {
      return posts.filter(p => p.category === 'regra' && !p.isDeleted && !p.isArchived)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }

    if (activeTab === 'aviso') {
      // Ordinary users only see active/non-expired warnings. 
      // Admin sees non-archived ones (the backend autoArchiveMuralPosts will already tag expired ones as archived, so this matches perfectly)
      return posts.filter(p => p.category === 'aviso' && !p.isDeleted && !p.isArchived);
    }

    if (activeTab === 'comunicado') {
      // Ordinary users only see active round announcements. Non-archived.
      return posts.filter(p => p.category === 'comunicado' && !p.isDeleted && !p.isArchived);
    }

    if (activeTab === 'history') {
      // Archived, Expired, or Deleted postings. Ordinary users cannot see deleted items, only archived ones.
      return posts.filter(p => {
        const isComm = ['regra', 'aviso', 'comunicado'].includes(p.category);
        if (!isComm) return false;

        if (isAdmin) {
          return p.isArchived === true || p.isDeleted === true;
        } else {
          return p.isArchived === true && p.isDeleted !== true;
        }
      }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }

    return [];
  };

  const filteredItems = getFilteredItems();

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case 'alta':
        return 'bg-rose-500/10 border border-rose-500/25 text-rose-400 font-extrabold';
      case 'media':
        return 'bg-amber-500/10 border border-amber-500/25 text-amber-400 font-bold';
      case 'baixa':
      default:
        return 'bg-zinc-800 border border-zinc-750 text-zinc-400';
    }
  };

  const getMatchInfoLabel = (matchId?: string) => {
    if (!matchId) return 'Partida não especificada';
    const match = matches.find(m => m.id === matchId);
    if (!match) return `Rodada #${matchId}`;
    return `Rodada de ${match.date} às ${match.time} (${match.location})`;
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex justify-between items-center">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 text-[#4ade80] rounded-xl text-xs flex justify-between items-center">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Categories Tabs Selector */}
      {!hideTabs && (
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between border-b border-zinc-900 pb-4">
          <ResponsiveTabsContainer 
            activeTabId={`tab-comm-${activeTab}`}
            className="bg-zinc-950 p-1.5 rounded-2xl border border-zinc-900 gap-1"
          >
            <button
              id="tab-comm-regra"
              onClick={() => setActiveTab('regra')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer flex-shrink-0 ${
                activeTab === 'regra'
                  ? 'bg-zinc-800 text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Regras do Racha</span>
              <span className="bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] text-zinc-400">
                {posts.filter(p => p.category === 'regra' && !p.isDeleted && !p.isArchived).length}
              </span>
            </button>

            <button
              id="tab-comm-aviso"
              onClick={() => setActiveTab('aviso')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer flex-shrink-0 ${
                activeTab === 'aviso'
                  ? 'bg-zinc-800 text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Megaphone className="w-3.5 h-3.5" />
              <span>Avisos Temporários</span>
              <span className="bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] text-[#4ade80]">
                {posts.filter(p => p.category === 'aviso' && !p.isDeleted && !p.isArchived).length}
              </span>
            </button>

            <button
              id="tab-comm-comunicado"
              onClick={() => setActiveTab('comunicado')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer flex-shrink-0 ${
                activeTab === 'comunicado'
                  ? 'bg-zinc-800 text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Comunicados da Rodada</span>
              <span className="bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] text-zinc-400">
                {posts.filter(p => p.category === 'comunicado' && !p.isDeleted && !p.isArchived).length}
              </span>
            </button>

            <button
              id="tab-comm-history"
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer flex-shrink-0 ${
                activeTab === 'history'
                  ? 'bg-zinc-800 text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Histórico / Arquivo</span>
              <span className="bg-zinc-900 px-1.5 py-0.5 rounded text-[10px] text-zinc-400">
                {posts.filter(p => {
                  const isComm = ['regra', 'aviso', 'comunicado'].includes(p.category);
                  if (!isComm) return false;
                  return isAdmin ? (p.isArchived || p.isDeleted) : (p.isArchived && !p.isDeleted);
                }).length}
              </span>
            </button>
          </ResponsiveTabsContainer>

          {/* Create communication trigger for administrator */}
          {isAdmin && activeTab !== 'history' && (
            <button
              onClick={() => handleOpenCreateForm(activeTab as any)}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Item ({activeTab === 'regra' ? 'Regra' : activeTab === 'aviso' ? 'Aviso' : 'Comunicado'})</span>
            </button>
          )}
        </div>
      )}

      {/* Content Area with lazy loading */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500 text-xs">
          <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span>Buscando comunicados do grupo...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredItems.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-16 bg-zinc-900/40 border border-zinc-850 rounded-2xl p-6"
              >
                {activeTab === 'regra' && <BookOpen className="w-12 h-12 text-zinc-700 mb-3" />}
                {activeTab === 'aviso' && <Megaphone className="w-12 h-12 text-zinc-700 mb-3" />}
                {activeTab === 'comunicado' && <Calendar className="w-12 h-12 text-zinc-700 mb-3" />}
                {activeTab === 'history' && <History className="w-12 h-12 text-zinc-700 mb-3" />}

                <h3 className="font-bold text-zinc-300 text-sm">
                  {activeTab === 'regra' && 'Nenhuma regra cadastrada'}
                  {activeTab === 'aviso' && 'Nenhum aviso ativo'}
                  {activeTab === 'comunicado' && 'Nenhum comunicado'}
                  {activeTab === 'history' && 'Nenhum registro arquivado'}
                </h3>
                <p className="text-zinc-500 text-xs mt-1.5 max-w-sm">
                  {activeTab === 'regra' && 'Nenhuma regra cadastrada.'}
                  {activeTab === 'aviso' && 'Nenhum aviso ativo no momento.'}
                  {activeTab === 'comunicado' && 'Nenhum comunicado publicado para a próxima rodada.'}
                  {activeTab === 'history' && 'O histórico de comunicações expiradas, finalizadas ou arquivadas está limpo.'}
                </p>
              </motion.div>
            ) : (
              filteredItems.map((post, idx) => (
                <motion.div
                  key={post.id}
                  layoutId={post.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`bg-zinc-900/60 border rounded-2xl p-5 md:p-6 shadow-md transition relative flex flex-col md:flex-row justify-between gap-5 border-zinc-800 ${
                    post.isDeleted ? 'opacity-40 border-rose-500/20 bg-rose-950/5' : 
                    post.isArchived ? 'opacity-70 border-zinc-700 bg-zinc-950/30' : ''
                  }`}
                >
                  {/* Left block: item contents */}
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Priority Tag for Avisos */}
                      {post.category === 'aviso' && (
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-mono tracking-wider ${getPriorityBadgeClass(post.priority)}`}>
                          Aviso {post.priority}
                        </span>
                      )}

                      {/* Rule Number Badge */}
                      {post.category === 'regra' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono">
                          Regra #{post.order ?? (idx + 1)}
                        </span>
                      )}

                      {/* Round Identifier Tag */}
                      {post.category === 'comunicado' && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-[#4ade80] font-mono">
                          Comunicado Rodada
                        </span>
                      )}

                      {/* Archived and Deleted tags */}
                      {post.isArchived && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-zinc-800/80 text-zinc-400 font-bold border border-zinc-700 uppercase font-mono tracking-wider">
                          Arquivado
                        </span>
                      )}
                      
                      {post.isDeleted && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-400 font-bold border border-rose-500/25 uppercase font-mono tracking-wider">
                          Lixeira (Excluído)
                        </span>
                      )}

                      {/* Dates and Expiration trackers for Warning */}
                      {post.category === 'aviso' && post.expirationDate && (
                        <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Expira em: {new Date(post.expirationDate).toLocaleDateString('pt-BR')}</span>
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-display font-extrabold text-white text-md tracking-tight leading-tight">
                        {post.title}
                      </h4>
                      {post.category === 'comunicado' && post.matchId && (
                        <p className="text-[11px] text-[#4ade80] font-semibold mt-1 bg-emerald-950/20 border border-emerald-500/10 px-2 py-1 rounded-lg inline-block">
                          {getMatchInfoLabel(post.matchId)}
                        </p>
                      )}
                    </div>

                    <p className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap break-words pr-2">
                      {post.description}
                    </p>

                    <div className="flex items-center gap-3 pt-2 text-[10px] text-zinc-500 border-t border-zinc-800/60">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>Por <strong>{post.authorName}</strong> ({post.authorRole})</span>
                      </span>
                      <span>•</span>
                      <span>Postado em: {new Date(post.createdAt).toLocaleDateString('pt-BR')} às {new Date(post.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Right block: Action handles for administrators */}
                  {isAdmin && (
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-start md:justify-center gap-2 border-t md:border-t-0 border-zinc-800 pt-3.5 md:pt-0 shrink-0 self-stretch md:self-auto">
                      {/* Manual Reordering Controls - ONLY FOR ACTIVE RULES */}
                      {post.category === 'regra' && !post.isArchived && !post.isDeleted && (
                        <div className="flex gap-1 mr-auto md:mr-0">
                          <button
                            onClick={() => handleMoveRule(post, 'up')}
                            disabled={actionLoading}
                            className="p-2 bg-zinc-950 hover:bg-zinc-8 text-zinc-400 hover:text-white rounded-lg border border-zinc-850 hover:border-zinc-750 transition cursor-pointer disabled:opacity-40"
                            title="Mover Regra para Cima"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveRule(post, 'down')}
                            disabled={actionLoading}
                            className="p-2 bg-zinc-950 hover:bg-zinc-8 text-zinc-400 hover:text-white rounded-lg border border-zinc-850 hover:border-zinc-750 transition cursor-pointer disabled:opacity-40"
                            title="Mover Regra para Baixo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {/* Recover Control for deleted items */}
                      {post.isDeleted ? (
                        <button
                          onClick={() => handleRecoverDeleted(post)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-[#4ade80] hover:bg-emerald-600 hover:text-white hover:border-transparent rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer mr-0 ml-auto md:ml-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar</span>
                        </button>
                      ) : (
                        <div className="flex flex-wrap md:flex-col gap-2 items-center w-full md:w-auto md:items-end justify-end">
                          {/* Edit Handle */}
                          <button
                            onClick={() => handleOpenEdit(post)}
                            disabled={actionLoading}
                            className="p-2 bg-zinc-950 hover:bg-zinc-8 text-zinc-400 hover:text-white rounded-lg border border-zinc-850 hover:border-zinc-750 transition cursor-pointer w-9 h-9 flex items-center justify-center"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Archive / Recover Archive Handle */}
                          <button
                            onClick={() => handleToggleArchive(post)}
                            disabled={actionLoading}
                            className={`p-2 rounded-lg border transition cursor-pointer w-9 h-9 flex items-center justify-center ${
                              post.isArchived
                                ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                                : 'bg-zinc-955 border-zinc-850 text-zinc-400 hover:text-white'
                            }`}
                            title={post.isArchived ? 'Mover para Ativos' : 'Arquivar (Enviar para Histórico)'}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>

                          {/* Soft Delete Handle */}
                          <button
                            onClick={() => handleDeletePost(post)}
                            disabled={actionLoading}
                            className="p-2 bg-rose-950/10 border border-rose-950/20 hover:border-rose-500/30 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition cursor-pointer w-9 h-9 flex items-center justify-center"
                            title="Mover para a Lixeira"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* --- CRUD PANEL POPUP DRAWER --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative block">
            
            {/* Header */}
            <div className="p-4 border-b border-zinc-850 flex items-center justify-between">
              <h3 className="font-display font-extrabold text-white text-md flex items-center gap-2">
                {formCategory === 'regra' && <BookOpen className="w-5 h-5 text-emerald-400" />}
                {formCategory === 'aviso' && <Megaphone className="w-5 h-5 text-emerald-400" />}
                {formCategory === 'comunicado' && <Calendar className="w-5 h-5 text-emerald-400" />}
                <span>{editPost ? 'Editar Comunicado' : 'Criar Novo Registro'}</span>
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-zinc-500 hover:text-white hover:bg-zinc-900 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form elements */}
            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              
              {/* Category input */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 text-xs font-bold block">Categoria</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormCategory('regra');
                      const today = new Date().toISOString().split('T')[0];
                      setFormStartDate(today);
                    }}
                    className={`py-2 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
                      formCategory === 'regra'
                        ? 'bg-zinc-800 text-white border border-zinc-700'
                        : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Regra Racha
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCategory('aviso')}
                    className={`py-2 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
                      formCategory === 'aviso'
                        ? 'bg-zinc-800 text-white border border-zinc-700'
                        : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Aviso Prévio
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormCategory('comunicado')}
                    className={`py-2 text-center text-xs font-bold rounded-xl transition cursor-pointer ${
                      formCategory === 'comunicado'
                        ? 'bg-zinc-800 text-white border border-zinc-700'
                        : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Comunicado
                  </button>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5 border-t border-zinc-900 pt-3">
                <label className="text-zinc-400 text-xs font-bold block" htmlFor="comm-title">
                  Título do Informativo
                </label>
                <input
                  id="comm-title"
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 transition"
                  placeholder="Ex: Regulamento de faltas, Aviso de feriado racha no feriado, etc."
                />
              </div>

              {/* Description Content Editor */}
              <div className="space-y-1.5">
                <label className="text-zinc-400 text-xs font-bold block" htmlFor="comm-desc">
                  Informação Completa (Conteúdo)
                </label>
                <textarea
                  id="comm-desc"
                  rows={4}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 transition resize-none leading-relaxed"
                  placeholder="Escreva as diretrizes claras para o grupo..."
                />
              </div>

              {/* Category-Specific Rules Fields */}
              {formCategory === 'regra' && (
                <div className="space-y-1.5 border-t border-zinc-900 pt-3">
                  <label className="text-zinc-400 text-xs font-bold block" htmlFor="comm-order">
                    Ordem de Exibição (Ordenação Manual)
                  </label>
                  <input
                    id="comm-order"
                    type="number"
                    min="1"
                    value={formOrder}
                    onChange={(e) => setFormOrder(Number(e.target.value))}
                    className="w-40 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 transition"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Regras menores aparecem primeiro na lista. Você pode mudá-la manualmente.</p>
                </div>
              )}

              {/* Category-Specific Warning Fields */}
              {formCategory === 'aviso' && (
                <div className="space-y-3.5 border-t border-zinc-900 pt-3">
                  {/* Priority */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-400 text-xs font-bold block">Prioridade</label>
                    <div className="grid grid-cols-3 gap-2">
                       {['baixa', 'media', 'alta'].map((p) => (
                         <button
                           key={p}
                           type="button"
                           onClick={() => setFormPriority(p as any)}
                           className={`py-1.5 text-center text-xs font-bold rounded-lg capitalize transition cursor-pointer ${
                             formPriority === p
                               ? p === 'alta'
                                 ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                 : p === 'media'
                                 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                 : 'bg-zinc-800 text-white border border-zinc-700'
                               : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
                           }`}
                         >
                           {p}
                         </button>
                       ))}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label className="text-zinc-400 text-[11px] font-bold block" htmlFor="comm-start">Data de Início</label>
                      <input
                        id="comm-start"
                        type="date"
                        required
                        value={formStartDate}
                        onChange={(e) => setFormStartDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-zinc-400 text-[11px] font-bold block" htmlFor="comm-expiration">Data de Expiração</label>
                      <input
                        id="comm-expiration"
                        type="date"
                        required
                        value={formExpirationDate}
                        onChange={(e) => setFormExpirationDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500">Avisos expiram automaticamente no fim do dia da data de expiração cadastrada.</p>
                </div>
              )}

              {/* Category-Specific Match Round Announcements Fields */}
              {formCategory === 'comunicado' && (
                <div className="space-y-1.5 border-t border-zinc-900 pt-3">
                  <label className="text-zinc-400 text-xs font-bold block" htmlFor="comm-match">
                    Vincular a uma Partida Específica (Rodada)
                  </label>
                  <select
                    id="comm-match"
                    value={formMatchId}
                    onChange={(e) => setFormMatchId(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                  >
                    {matches.length === 0 ? (
                      <option value="">Nenhuma rodada cadastrada</option>
                    ) : (
                      matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          Rodada de {new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {m.location} ({m.time}) - Status: {m.status.toUpperCase()}
                        </option>
                      ))
                    )}
                  </select>
                  <p className="text-[10px] text-zinc-500 mt-1">Este comunicado será arquivado automaticamente assim que o placar/resultado desta rodada for salvo.</p>
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex border-t border-zinc-900 pt-4 gap-3 justify-end leading-none">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={actionLoading}
                  className="px-4.5 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 shadow-lg shadow-emerald-500/10"
                >
                  {actionLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <span>{editPost ? 'Salvar Alterações' : 'Criar Comunicado'}</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
