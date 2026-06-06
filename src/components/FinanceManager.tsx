import React, { useState, useEffect } from 'react';
import { User, Player, Bill, PaymentRecord, RecurrentConfig } from '../types';
import { 
  CreditCard, ShieldAlert, CheckCircle2, AlertCircle, FileText, Download,
  Sliders, Plus, Trash2, RefreshCw, Calendar, DollarSign, PieChart, Users, ChevronDown, Printer, AlertTriangle
} from 'lucide-react';

interface FinanceManagerProps {
  currentUser: User;
}

export default function FinanceManager({ currentUser }: FinanceManagerProps) {
  const isAdmin = currentUser.role === 'admin' || currentUser.role === 'auxiliar';

  // Core financial state
  const [bills, setBills] = useState<Bill[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [recurrentConfig, setRecurrentConfig] = useState<Partial<RecurrentConfig>>({});
  const [health, setHealth] = useState({ totalExpected: 0, totalReceived: 0, totalPending: 0 });
  const [players, setPlayers] = useState<Player[]>([]);
  
  // UI views and tabs
  const [activeTab, setActiveTab] = useState<'my' | 'admin_overview' | 'ledger' | 'config'>('my');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Admin filter variables
  const [filterCompetence, setFilterCompetence] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchPlayerQuery, setSearchPlayerQuery] = useState<string>('');

  // Form modals state
  const [isManualBillOpen, setIsManualBillOpen] = useState(false);
  const [newBillPlayerId, setNewBillPlayerId] = useState('');
  const [newBillCompetence, setNewBillCompetence] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillDueDate, setNewBillDueDate] = useState('');

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

  // Local datetime mock helpers
  const [todayStr, setTodayStr] = useState('');

  useEffect(() => {
    // Determine today string
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      setTodayStr(`${y}-${m}-${d}`);
      
      const compVal = `${m}/${y}`;
      setNewBillCompetence(compVal);
      setNewBillDueDate(`${y}-${m}-${d}`);
    } catch (e) {
      setTodayStr('2026-06-05');
    }
  }, []);

  // Fetch complete dataset
  const fetchFinanceData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const url = `/api/finances?email=${encodeURIComponent(currentUser.email)}&role=${currentUser.role}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Não foi possível sincronizar o módulo financeiro.');
      const data = await res.json();
      
      setBills(data.bills || []);
      setPayments(data.payments || []);
      setHealth(data.health || { totalExpected: 0, totalReceived: 0, totalPending: 0 });
      setRecurrentConfig(data.recurrentConfig || {});
      setPlayers(data.players || []);

      if (data.recurrentConfig?.monthlyFee) {
        setNewBillAmount(data.recurrentConfig.monthlyFee.toString());
      }
      
      // Auto redirect to admin tab if they are admin and have no bills of their own
      if (data.bills.length === 0 && (currentUser.role === 'admin' || currentUser.role === 'auxiliar')) {
        setActiveTab('admin_overview');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar dados do provedor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinanceData();
  }, [currentUser]);

  // Handle immediate payment confirmation by player
  const handleConfirmPayment = async (billId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/finances/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, email: currentUser.email, role: currentUser.role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar pagamento.');
      
      setSuccessMsg('Obrigado! Pagamento confirmado e registrado com sucesso!');
      await fetchFinanceData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao comunicar com o servidor.');
    } finally {
      setActionLoading(false);
    }
  };

  // Admin toggle payment back/forth
  const handleTogglePaymentAdmin = async (billId: string) => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/finances/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billId, email: currentUser.email, role: currentUser.role })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar status.');
      
      setSuccessMsg('Status da cobrança alterado com sucesso!');
      await fetchFinanceData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao alterar status.');
    } finally {
      setActionLoading(false);
    }
  };

  // Create custom manual bill
  const handleCreateManualBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBillPlayerId || !newBillCompetence || !newBillAmount || !newBillDueDate) {
      setErrorMsg('Todos os campos obrigatórios devem ser preenchidos.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/finances/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: newBillPlayerId,
          competence: newBillCompetence,
          amount: parseFloat(newBillAmount),
          dueDate: newBillDueDate,
          status: 'pendente'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao lançar cobrança.');

      setSuccessMsg('Cobrança manual gerada e vinculada ao jogador com sucesso!');
      setIsManualBillOpen(false);
      await fetchFinanceData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de comunicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Remove billing record completely
  const handleDeleteBill = (billId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Lançamento',
      message: 'ATENÇÃO: Deseja realmente excluir permanentemente este lançamento financeiro de forma irreversível?',
      confirmText: 'Sim, Excluir',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setActionLoading(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
          const res = await fetch(`/api/finances/bills/${billId}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Falha ao remover lançamento.');

          setSuccessMsg('Lançamento removido com sucesso do histórico!');
          await fetchFinanceData();
          setTimeout(() => setSuccessMsg(''), 4500);
        } catch (err: any) {
          setErrorMsg(err.message || 'Erro de conexão.');
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  // Save changes to recurrent finances
  const handleSaveRecurrentFinConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const fee = (e.currentTarget.elements.namedItem('monthlyFee') as HTMLInputElement).value;
    const rule = (e.currentTarget.elements.namedItem('chargeDateRule') as HTMLSelectElement).value;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // Fetch current schedules to merge
      const curRes = await fetch('/api/recurrent-config');
      const curData = await curRes.json();

      const response = await fetch('/api/recurrent-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...curData,
          monthlyFee: parseFloat(fee),
          chargeDateRule: rule
        })
      });

      if (!response.ok) throw new Error('Erro ao salvar parametrização.');

      setSuccessMsg('Configurações financeiras e regras de cobrança salvas!');
      await fetchFinanceData();
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar.');
    } finally {
      setActionLoading(false);
    }
  };

  // Run a ledger verification scan immediately
  const handleTriggerSync = async () => {
    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/finances/trigger-sync', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao sincronizar.');

      setSuccessMsg(`Varredura concluída! ${data.generatedCount} nova(s) cobrança(s) automática(s) gerada(s).`);
      await fetchFinanceData();
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha de comunicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Excel (CSV) Export Generator
  const exportToExcel = () => {
    try {
      let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 support
      csvContent += 'Jogador;Competencia;Valor Original;Vencimento;Status;Data Pagamento\n';

      // Sort all bills by competence and player name
      const sortedBills = [...bills].sort((a, b) => b.competence.localeCompare(a.competence));

      for (const bill of sortedBills) {
        const player = players.find(p => p.id === bill.playerId);
        const name = player ? player.name : 'Jogador Desconhecido';
        const paidStr = bill.paidAt ? bill.paidAt.split('T')[0].split('-').reverse().join('/') : '-';
        const dueStr = bill.dueDate.split('-').reverse().join('/');
        const status = bill.status === 'pago' ? 'Pago' : 'Pendente';
        
        csvContent += `"${name}";"${bill.competence}";"R$ ${bill.amount.toFixed(2)}";"${dueStr}";"${status}";"${paidStr}"\n`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'Racha_do_Fofim_Ficha_Financeira.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Erro ao exportar arquivo de planilha.');
    }
  };

  // PDF Browser Print Trigger
  const triggerPdfPrint = () => {
    window.print();
  };

  // Compute debtors statistics for the admin dashboard view
  const getDebtorsList = () => {
    const debtorsMap: Record<string, { player: Player; pendingCount: number; pendingTotal: number; pendingComp: string[] }> = {};
    
    // Scan all pending bills
    const pendingBills = bills.filter(b => b.status === 'pendente');
    
    for (const fb of pendingBills) {
      const pid = fb.playerId;
      const player = players.find(p => p.id === pid);
      if (!player) continue;

      if (!debtorsMap[pid]) {
        debtorsMap[pid] = {
          player,
          pendingCount: 0,
          pendingTotal: 0,
          pendingComp: []
        };
      }
      debtorsMap[pid].pendingCount += 1;
      debtorsMap[pid].pendingTotal += fb.amount;
      debtorsMap[pid].pendingComp.push(fb.competence);
    }

    return Object.values(debtorsMap).sort((a, b) => b.pendingTotal - a.pendingTotal);
  };

  const debtorsList = getDebtorsList();

  // Distinct competencies list inside system bills
  const distinctCompetences = Array.from(new Set<string>(bills.map(b => b.competence)))
    .sort((a, b) => {
      const [mA, yA] = a.split('/').map(Number);
      const [mB, yB] = b.split('/').map(Number);
      return (yB * 12 + mB) - (yA * 12 + mA); // Descending chronologically
    });

  // Filtered bills shown in the admin ledger list view
  const filteredLedgerBills = bills.filter(b => {
    const player = players.find(p => p.id === b.playerId);
    const matchesSearch = !searchPlayerQuery || (player?.name.toLowerCase().includes(searchPlayerQuery.toLowerCase()) || false);
    const matchesComp = filterCompetence === 'all' || b.competence === filterCompetence;
    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
    return matchesSearch && matchesComp && matchesStatus;
  }).sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  // Compute percentage counters
  const paidPercent = health.totalExpected > 0 ? Math.round((health.totalReceived / health.totalExpected) * 100) : 0;
  const pendingPercent = health.totalExpected > 0 ? Math.round((health.totalPending / health.totalExpected) * 100) : 0;

  // Personal user bills count
  const myBills = bills.filter(b => {
    const p = players.find(p => p.id === b.playerId);
    return p && p.email.toLowerCase().trim() === currentUser.email.toLowerCase().trim();
  }).sort((a, b) => b.dueDate.localeCompare(a.dueDate));

  const myPendingTotal = myBills.filter(b => b.status === 'pendente').reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-6" id="finances-manager-view">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-4">
        <div>
          <span className="text-[10px] uppercase font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
            Módulo Financeiro
          </span>
          <h2 className="font-display font-extrabold text-2xl text-white mt-1">
            Controle de Caixa & Mensalidades
          </h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            Acompanhe a saúde financeira, gere guias de cobrança e consulte pendências da comissão técnica da rodada.
          </p>
        </div>

        {/* Sync Trigger / Manual billing button */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  if (players.length > 0) {
                    setNewBillPlayerId(players[0].id);
                  }
                  setIsManualBillOpen(true);
                }}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Cobrança Manual</span>
              </button>
              <button
                onClick={handleTriggerSync}
                disabled={actionLoading}
                title="Efetuar varredura de pendências agora"
                className="p-2 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition cursor-pointer flex items-center justify-center"
              >
                <RefreshCw className={`w-4 h-4 ${actionLoading ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* HEALTH METRICS CARDS (SAÚDE FINANCEIRA - ANONYMOUS GLOBAL TOTALS FOR ALL) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="anon-health-dashboard">
        
        {/* TOTAL PREVISTO */}
        <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="absolute top-3 right-3 text-zinc-650">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 font-extrabold block">Total Previsto</span>
            <span className="text-xl font-display font-black text-white block mt-1">
              R$ {health.totalExpected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="text-[10px] text-zinc-500 font-mono mt-1 pt-2 border-t border-zinc-900/40">
            Soma histórica de todos os lançamentos
          </div>
        </div>

        {/* TOTAL RECEBIDO */}
        <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="absolute top-3 right-3 text-emerald-500/35">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-400 font-extrabold block">Total Recebido</span>
            <span className="text-xl font-display font-black text-emerald-400 block mt-1">
              R$ {health.totalReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="space-y-1.5 mt-2 pt-1 border-t border-zinc-900/40">
            <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400">
              <span>Arrecadação completa</span>
              <span className="font-extrabold text-emerald-400">{paidPercent}%</span>
            </div>
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${paidPercent}%` }} />
            </div>
          </div>
        </div>

        {/* TOTAL PENDENTE */}
        <div className="bg-zinc-950/40 border border-zinc-900/80 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="absolute top-3 right-3 text-amber-500/35">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[9px] uppercase font-mono tracking-wider text-amber-400 font-extrabold block">Total Pendente</span>
            <span className="text-xl font-display font-black text-amber-500 block mt-1">
              R$ {health.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="space-y-1.5 mt-2 pt-1 border-t border-zinc-900/40">
            <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400">
              <span>Taxa de Inadimplência</span>
              <span className="font-extrabold text-amber-400">{pendingPercent}%</span>
            </div>
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pendingPercent}%` }} />
            </div>
          </div>
        </div>

      </div>

      {/* ACTION TABS NAVIGATION */}
      <div className="flex border-b border-zinc-900 text-xs font-semibold overflow-x-auto pr-2 scrollbar-none">
        
        {/* Minhas Cobranças */}
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-3 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'my'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
              : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Minhas Cobranças</span>
          {myPendingTotal > 0 && (
            <span className="bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded-full text-[9px]">
              R$ {myPendingTotal}
            </span>
          )}
        </button>

        {/* Admin Debtoes Summary */}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('admin_overview')}
            className={`px-4 py-3 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'admin_overview'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Controle de Inadimplência</span>
            {debtorsList.length > 0 && (
              <span className="bg-amber-500 text-zinc-950 font-extrabold px-1.5 py-0.5 rounded-full text-[9px]">
                {debtorsList.length} devedor(es)
              </span>
            )}
          </button>
        )}

        {/* Global billing ledger */}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-3 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ledger'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Livro Caixa do Grupo</span>
          </button>
        )}

        {/* Settings params */}
        {isAdmin && (
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-3 border-b-2 whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'config'
                ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Parâmetros de Rodada</span>
          </button>
        )}
      </div>

      {/* ACTIVE SCREEN RENDERING CONTENT */}

      {/* LOADING INDICATOR */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 font-mono">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
          <span className="text-xs text-zinc-500">Sincronizando registros da comissão...</span>
        </div>
      )}

      {/* TAB 1: PLAYER MY BILLS (MINHAS MENSALIDADES) */}
      {!loading && activeTab === 'my' && (
        <div className="space-y-6">
          <div className="bg-[#111815] border border-zinc-850 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono">
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-extrabold">Configuração de Vínculo</span>
              <div className="text-xs text-zinc-300">
                Você está cadastrado como jogador na categoria:{' '}
                <span className="text-emerald-400 font-extrabold uppercase">
                  {currentUser.role === 'admin' ? 'Administrador' : 'Mensalista'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 max-w-xl">
                Mensalistas pagam uma taxa mensal automática definida pelo administrador da rodada. Reservas e Goleiros possuem isenção de mensalidade regular.
              </p>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-right">
              <span className="text-[9px] text-zinc-500 uppercase">Seu saldo pendente</span>
              <div className={`text-md font-bold ${myPendingTotal > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                R$ {myPendingTotal.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-display font-medium text-white text-sm">Seu Histórico de Cobranças</h3>
            
            {myBills.length === 0 ? (
              <div className="text-center py-12 rounded-xl bg-zinc-950/20 border border-dashed border-zinc-850 text-xs text-zinc-500 p-6 leading-relaxed">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="font-bold text-zinc-400">Nenhum lançamento vinculado à sua conta!</p>
                <p className="text-[11px] text-zinc-650 mt-1">Caso você seja do grupo e não tenha cobranças, verifique se seu perfil está como Mensalista ativo na lista.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myBills.map((bill) => (
                  <div 
                    key={bill.id} 
                    className={`bg-zinc-950/40 p-4 rounded-xl border flex justify-between items-center gap-4 transition font-mono ${
                      bill.status === 'pago' 
                        ? 'border-emerald-500/10 hover:border-emerald-500/20' 
                        : 'border-rose-500/15 hover:border-rose-500/25 bg-rose-500/[0.01]'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-500 text-[10px] uppercase">Competência</span>
                        <span className="text-xs text-white font-extrabold bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {bill.competence}
                        </span>
                      </div>
                      
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-zinc-500 uppercase block">Valor da parcela</span>
                        <span className="text-sm font-black text-white">
                          R$ {bill.amount.toFixed(2)}
                        </span>
                      </div>

                      <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Vencimento: {bill.dueDate.split('-').reverse().join('/')}</span>
                      </div>
                    </div>

                    <div className="text-right space-y-2">
                      <span className={`inline-block text-[9px] font-bold uppercase rounded border px-2 py-0.5 ${
                        bill.status === 'pago' 
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' 
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                      }`}>
                        {bill.status === 'pago' ? 'Pago ✅' : 'Pendente ⏳'}
                      </span>
                      
                      {bill.status === 'pendente' ? (
                        <button
                          onClick={() => handleConfirmPayment(bill.id)}
                          disabled={actionLoading}
                          className="w-full text-center bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-wider block transition cursor-pointer"
                        >
                          Confirmar Pagamento
                        </button>
                      ) : (
                        <div className="text-[9px] text-zinc-500 leading-relaxed italic text-right block pt-1">
                          Pago em:<br />
                          {bill.paidAt ? bill.paidAt.split('T')[0].split('-').reverse().join('/') : '-'}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ADMIN OVERVIEW - INADIMPLÊNCIA (MENSALIDADES PENDENTES) */}
      {!loading && activeTab === 'admin_overview' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-[#1c120c] border border-amber-950/40 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
            <div className="space-y-1">
              <span className="text-[10px] text-amber-400 uppercase tracking-wider font-extrabold flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Auditoria de Mensalistas em Atraso</span>
              </span>
              <p className="text-xs text-zinc-300">
                Abaixo estão listados de forma consolidada todos os atletas mensalistas do grupo que possuem uma ou mais mensalidades em aberto.
              </p>
              <p className="text-[10px] text-zinc-500 max-w-2xl leading-normal">
                Novos lançamentos automáticos são gerados no momento das rodadas recorrentes parametrizadas. Você pode ligar diretamente para incentivar a quitação ou dar baixa manual.
              </p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-900 text-right">
              <span className="text-[9px] text-zinc-500 uppercase block">Atletas Devendo</span>
              <div className="text-md font-bold text-amber-400">
                {debtorsList.length} Atletas
              </div>
            </div>
          </div>

          {debtorsList.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850/80 bg-zinc-900/15 p-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-white font-semibold text-sm">Parabéns! Grupo 100% Adimplente! 🎉</p>
              <p className="text-xs text-zinc-500 mt-1">Nenhuma parcela atrasada ou em aberto para os mensalistas regulares.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {debtorsList.map(({ player, pendingCount, pendingTotal, pendingComp }) => (
                <div key={player.id} className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-900 flex justify-between gap-4 font-mono">
                  <div className="flex gap-3">
                    <img 
                      src={player.photoOriginal || 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=100'} 
                      alt={player.name}
                      referrerPolicy="no-referrer"
                      className="w-11 h-11 rounded-full object-cover border border-zinc-800"
                    />
                    <div className="space-y-1">
                      <h4 className="text-white font-bold text-xs">{player.name}</h4>
                      <span className="text-[9px] text-zinc-500 block">{player.email}</span>
                      
                      <div className="flex flex-wrap gap-1 pt-1">
                        {pendingComp.map((comp, idx) => (
                          <span key={idx} className="bg-rose-950/30 text-rose-400 border border-rose-900/40 text-[8px] font-black px-1.5 py-0.5 rounded">
                            {comp}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="text-right space-y-2">
                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase">Meses pendentes</span>
                      <span className="text-rose-400 font-extrabold text-xs">
                        {pendingCount} mensalidade(s)
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] text-zinc-500 block uppercase">Lançado total</span>
                      <span className="text-white font-black text-xs text-rose-400">
                        R$ {pendingTotal.toFixed(2)}
                      </span>
                    </div>

                    {/* Fast Admin Actions */}
                    <div className="flex items-center gap-1 justify-end pt-1">
                      <button 
                        onClick={() => {
                          const userBills = bills.filter(b => b.playerId === player.id && b.status === 'pendente');
                          if (userBills.length > 0) {
                            setIsManualBillOpen(false);
                            setFilterStatus('pendente');
                            setSearchPlayerQuery(player.name);
                            setActiveTab('ledger');
                          }
                        }}
                        className="bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white px-2 py-1 rounded text-[9px] uppercase tracking-wider transition cursor-pointer border border-zinc-800"
                        title="Ver guias deste jogador no livro caixa"
                      >
                        Auditar Guias
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ADMIN LEDGER - LIVRO CAIXA DO GRUPO */}
      {!loading && activeTab === 'ledger' && isAdmin && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-[#111815] p-3.5 rounded-xl border border-zinc-850/80 font-mono text-xs">
            
            {/* Search filter player */}
            <div className="relative w-full md:w-initial md:flex-1">
              <input
                type="text"
                value={searchPlayerQuery}
                onChange={(e) => setSearchPlayerQuery(e.target.value)}
                placeholder="Filtrar por nome do jogador..."
                className="w-full bg-zinc-950 border border-zinc-850 text-xs text-white rounded-lg px-3 py-2 focus:outline-none focus:border-[#22c55e]"
              />
            </div>

            {/* Selector by competence */}
            <div className="w-full md:w-36">
              <select
                value={filterCompetence}
                onChange={(e) => setFilterCompetence(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-lg px-2 py-2 focus:outline-none cursor-pointer"
              >
                <option value="all">Todas Competências</option>
                {distinctCompetences.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Selector by status */}
            <div className="w-full md:w-32">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-lg px-2 py-2 focus:outline-none cursor-pointer"
              >
                <option value="all">Todos Status</option>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
            </div>

            {/* EXPORTS SELECTION */}
            <div className="flex gap-1.5 w-full md:w-auto">
              <button
                onClick={exportToExcel}
                className="flex-1 md:flex-initial px-3 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg font-bold border border-zinc-800 text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                title="Exportar para formato CSV compatível com Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Excel (CSV)</span>
              </button>
              
              <button
                onClick={triggerPdfPrint}
                className="flex-1 md:flex-initial px-2.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg font-bold border border-zinc-800 text-xs flex items-center justify-center gap-1 cursor-pointer transition"
                title="Imprimir visualização financeira como documento"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimir PDF</span>
              </button>
            </div>
          </div>

          {filteredLedgerBills.length === 0 ? (
            <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850 bg-zinc-950/15 p-6">
              <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
              <p className="text-zinc-400 font-semibold text-sm">Nenhum lançamento no livro caixa para os filtros atuais!</p>
              <p className="text-xs text-zinc-650 mt-1">Experimente remover os termos buscados ou reescrever as palavras.</p>
            </div>
          ) : (
            <div className="bg-zinc-950/40 rounded-xl border border-zinc-900 overflow-hidden font-mono text-xs">
              <div className="overflow-x-auto min-w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/60 text-zinc-400 border-b border-zinc-850 text-[10px] uppercase">
                      <th className="p-3">Jogador</th>
                      <th className="p-3">Competência</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Vencimento</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-center">Ações de Auditoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-900">
                    {filteredLedgerBills.map((bill) => {
                      const ply = players.find(p => p.id === bill.playerId);
                      return (
                        <tr key={bill.id} className="hover:bg-zinc-900/20 text-zinc-300">
                          <td className="p-3 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              {ply?.photoOriginal && (
                                <img 
                                  src={ply.photoOriginal} 
                                  alt="atleta" 
                                  referrerPolicy="no-referrer"
                                  className="w-5 h-5 rounded-full object-cover flex-shrink-0" 
                                />
                              )}
                              <span>{ply ? ply.name : 'Jogador Desconhecido'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <span className="bg-zinc-900 px-2 py-0.5 rounded border border-zinc-850 text-zinc-400 text-[10px]">
                              {bill.competence}
                            </span>
                          </td>
                          <td className="p-3 text-white font-extrabold">
                            R$ {bill.amount.toFixed(2)}
                          </td>
                          <td className="p-3">
                            {bill.dueDate.split('-').reverse().join('/')}
                          </td>
                          <td className="p-3">
                            <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              bill.status === 'pago' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {bill.status === 'pago' ? 'PAGO' : 'PENDENTE'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleTogglePaymentAdmin(bill.id)}
                                className={`px-2 py-1 rounded font-bold text-[10px] uppercase transition cursor-pointer border ${
                                  bill.status === 'pago'
                                    ? 'bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-black border-amber-500/20'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent'
                                }`}
                                title={bill.status === 'pago' ? 'Marcar como Pendente' : 'Marcar como Quitado'}
                              >
                                {bill.status === 'pago' ? 'Estornar' : 'Efetivar Baixa'}
                              </button>
                              
                              <button
                                onClick={() => handleDeleteBill(bill.id)}
                                className="p-1 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                                title="Excluir cobrança permanentemente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECURRENCE FINANCE CONFIGS (CONFIGURAR MENSALIDADE) */}
      {!loading && activeTab === 'config' && isAdmin && (
        <div className="max-w-xl bg-zinc-950/40 p-5 rounded-xl border border-zinc-900 font-mono text-xs">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b border-zinc-900/60">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <h3 className="font-display font-medium text-white text-sm">Parametrização de Lançamentos Recorrentes</h3>
          </div>
          
          <form onSubmit={handleSaveRecurrentFinConfig} className="space-y-4">
            
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase block font-bold">Valor da Parcela Mensal (R$)</label>
              <input
                type="number"
                name="monthlyFee"
                required
                min="0"
                step="0.01"
                defaultValue={recurrentConfig.monthlyFee || 100}
                placeholder="Exemplo: 100"
                className="w-full bg-[#1c1c1e] text-white border border-zinc-850 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[9px] text-zinc-650 mt-0.5 block">
                Valor utilizado como semente para a cobrança automática e simulações.
              </span>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase block font-bold">Data de Gatilho / Vencimento no Mês</label>
              <select
                name="chargeDateRule"
                defaultValue={recurrentConfig.chargeDateRule || 'primeiro_jogo'}
                className="w-full bg-[#1c1c1e] text-zinc-300 border border-zinc-850 rounded-lg px-3 py-2 text-xs focus:outline-none cursor-pointer"
              >
                <option value="primeiro_jogo">No Primeiro Jogo do Mês</option>
                <option value="ultimo_jogo">No Último Jogo do Mês</option>
              </select>
              <span className="text-[9px] text-zinc-650 mt-0.5 block">
                Garantia permanente de compatibilidade histórica: No dia correspondente à rodada de gatilho, as cobranças de todos os mensalistas são geradas permanentemente.
              </span>
            </div>

            <p className="text-[10px] text-zinc-500 leading-normal bg-zinc-950 p-2.5 rounded-lg border border-zinc-900/40">
              💡 As parcelas são retroativas de acordo com as regras acordadas e nunca interferem em parcelas de meses pretéritos previamente liquidadas!
            </p>

            <button
              type="submit"
              disabled={actionLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl py-2 uppercase tracking-wider text-[11px] block transition cursor-pointer"
            >
              Confirmar e Salvar Mudanças
            </button>
          </form>
        </div>
      )}

      {/* MANUAL BILL MODAL */}
      {isManualBillOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111613] rounded-xl border border-zinc-850 w-full max-w-sm p-5 font-mono text-xs space-y-4 shadow-2xl animate-scaleUp">
            
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900">
              <span className="font-bold text-white uppercase text-xs">Lançar Cobrança Manual</span>
              <button 
                onClick={() => setIsManualBillOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateManualBill} className="space-y-3">
              
              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase block font-bold">Atleta Beneficiário</label>
                <select
                  required
                  value={newBillPlayerId}
                  onChange={(e) => setNewBillPlayerId(e.target.value)}
                  className="w-full bg-[#1c1c1e] text-zinc-300 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  {players.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase block font-bold">Competência (MM/AAAA)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 06/2026"
                  value={newBillCompetence}
                  onChange={(e) => setNewBillCompetence(e.target.value)}
                  className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase block font-bold">Valor (R$)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  placeholder="Ex: 100"
                  value={newBillAmount}
                  onChange={(e) => setNewBillAmount(e.target.value)}
                  className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] text-zinc-500 uppercase block font-bold">Data de Vencimento</label>
                <input
                  type="date"
                  required
                  value={newBillDueDate}
                  onChange={(e) => setNewBillDueDate(e.target.value)}
                  className="w-full bg-[#1c1c1e] text-white border border-zinc-800 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg py-2 uppercase tracking-wider text-[10px] block transition cursor-pointer"
              >
                Gerar Cobrança
              </button>
            </form>
          </div>
        </div>
      )}
      
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

    </div>
  );
}
