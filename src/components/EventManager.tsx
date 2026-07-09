import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { 
  Calendar, MapPin, Clock, Users, DollarSign, Plus, Edit3, 
  X, Flame, Gift, Compass, Settings, Share2, 
  Download, FileText, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw,
  ChevronDown, ChevronUp, Baby, User as UserIcon
} from 'lucide-react';
import { User, GrupalEvent, GrupalEventType, GrupalEventStatus, CATEGORY_LABELS, PlayerCategory } from '../types';

interface EventManagerProps {
  currentUser: User;
}

// Map event types to design tokens (colors and icons)
const EVENT_TYPE_CONFIG: Record<GrupalEventType, { label: string; bg: string; text: string; border: string; icon: any }> = {
  churrasco: { 
    label: 'Churrasco', 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-400', 
    border: 'border-amber-500/20', 
    icon: Flame 
  },
  confraternizacao: { 
    label: 'Confraternização', 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-400', 
    border: 'border-emerald-500/20', 
    icon: Users 
  },
  festa: { 
    label: 'Festa do Grupo', 
    bg: 'bg-purple-500/10', 
    text: 'text-purple-400', 
    border: 'border-purple-500/20', 
    icon: Gift 
  },
  viagem: { 
    label: 'Viagem / Acampamento', 
    bg: 'bg-blue-500/10', 
    text: 'text-blue-400', 
    border: 'border-blue-500/20', 
    icon: Compass 
  },
  personalizado: { 
    label: 'Especial / Personalizado', 
    bg: 'bg-zinc-500/10', 
    text: 'text-zinc-400', 
    border: 'border-zinc-500/20', 
    icon: Settings 
  },
};

const STATUS_CONFIG: Record<GrupalEventStatus, { label: string; bg: string; text: string; border: string }> = {
  agendado: { label: 'Agendado', bg: 'bg-zinc-800', text: 'text-zinc-300', border: 'border-zinc-750' },
  confirmando: { label: 'Confirmando Presenças', bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  encerrado: { label: 'Encerrado', bg: 'bg-zinc-950 text-zinc-500 border-zinc-900', text: 'text-zinc-500', border: 'border-zinc-900' },
  cancelado: { label: 'Cancelado', bg: 'bg-rose-500/15 text-rose-400 border-rose-500/25', text: 'text-rose-400', border: 'border-rose-500/20' }
};

export default function EventManager({ currentUser }: EventManagerProps) {
  const isEditor = currentUser.role === 'admin' || currentUser.role === 'auxiliar';
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states (Create/Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GrupalEventType>('churrasco');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [adultPrice, setAdultPrice] = useState('0');
  const [childPrice, setChildPrice] = useState('0');
  const [eventStatus, setEventStatus] = useState<GrupalEventStatus>('agendado');

  // Participants modal state
  const [activeParticipantsEvent, setActiveParticipantsEvent] = useState<any | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);

  // Quick RSVP interactive counter states
  const [tempAdults, setTempAdults] = useState<Record<string, number>>({});
  const [tempChildren, setTempChildren] = useState<Record<string, number>>({});
  const [isSavingRsvp, setIsSavingRsvp] = useState<Record<string, boolean>>({});

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

  // Confirmed event participants details states
  const [eventParticipantsMap, setEventParticipantsMap] = useState<Record<string, any[]>>({});
  const [loadingParticipantsMap, setLoadingParticipantsMap] = useState<Record<string, boolean>>({});
  const [expandedParticipantsMap, setExpandedParticipantsMap] = useState<Record<string, boolean>>({});

  // Fetch player data to know category
  const [playerCategory, setPlayerCategory] = useState<string>('reserva');
  const [playerPrimaryPosition, setPlayerPrimaryPosition] = useState<string>('atacante');

  const fetchPlayerInfo = async () => {
    try {
      const res = await authFetch('/api/players');
      if (res.ok) {
        const playersList = await res.json();
        const meObj = playersList.find((p: any) => p.email === currentUser.email);
        if (meObj) {
          setPlayerCategory(meObj.category);
          setPlayerPrimaryPosition(meObj.primaryPosition || 'atacante');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await authFetch(`/api/events?playerId=${currentUser.id}`);
      if (!res.ok) throw new Error('Não foi possível carregar os eventos.');
      const data = await res.json();
      setEvents(data || []);

      // Pre-populate interactive values
      const adultsMap: Record<string, number> = {};
      const childMap: Record<string, number> = {};
      data.forEach((evt: any) => {
        if (evt.myParticipant) {
          adultsMap[evt.id] = evt.myParticipant.adultsCount;
          childMap[evt.id] = evt.myParticipant.childrenCount;
        } else {
          adultsMap[evt.id] = 0;
          childMap[evt.id] = 0;
        }
      });
      setTempAdults(adultsMap);
      setTempChildren(childMap);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayerInfo();
    loadEvents();
  }, []);

  // Form handlers
  const handleOpenCreateForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setType('churrasco');
    setDate('');
    setTime('12:00');
    setLocation('Sede Campestre ou Arena do Fofim');
    setAdultPrice('50');
    setChildPrice('25');
    setEventStatus('agendado');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (evt: GrupalEvent) => {
    setEditingId(evt.id);
    setName(evt.name);
    setDescription(evt.description);
    setType(evt.type);
    setDate(evt.date);
    setTime(evt.time);
    setLocation(evt.location);
    setAdultPrice(evt.adultPrice.toString());
    setChildPrice(evt.childPrice.toString());
    setEventStatus(evt.status);
    setIsFormOpen(true);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!name || !type || !date) {
      setErrorMsg('Nome, tipo e data são campos obrigatórios.');
      return;
    }

    try {
      const url = editingId ? `/api/events/${editingId}` : '/api/events';
      const method = editingId ? 'PUT' : 'POST';

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          type,
          date,
          time,
          location,
          adultPrice: parseFloat(adultPrice || '0'),
          childPrice: parseFloat(childPrice || '0'),
          status: eventStatus
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao registrar evento.');
      }

      setSuccessMsg(editingId ? 'Evento alterado com sucesso!' : 'Novo evento cadastrado!');
      setIsFormOpen(false);
      await loadEvents();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar chamada.');
    }
  };

  const handleCancelEvent = (eventId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Evento',
      message: 'Tem certeza que deseja CANCELAR este evento do grupo? Isso suspenderá todas as cobranças vinculadas em definitivo.',
      confirmText: 'Sim, Cancelar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await authFetch(`/api/events/${eventId}/cancel`, { method: 'POST' });
          if (res.ok) {
            setSuccessMsg('Evento cancelado e cobranças suspensas com sucesso.');
            await loadEvents();
          } else {
            const data = await res.json();
            setErrorMsg(data.error || 'Erro ao suspender evento.');
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Falha de comunicação.');
        }
      }
    });
  };

  const handleEndEvent = (eventId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Encerrar Evento',
      message: 'Deseja ENCERRAR o evento? A lista de presenças será congelada para fins de histórico e faturamento.',
      confirmText: 'Sim, Encerrar',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await authFetch(`/api/events/${eventId}/end`, { method: 'POST' });
          if (res.ok) {
            setSuccessMsg('Evento encerrado com sucesso!');
            await loadEvents();
          } else {
            const data = await res.json();
            setErrorMsg(data.error || 'Erro ao fechar evento.');
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Falha de comunicação.');
        }
      }
    });
  };

  const handleDeleteEvent = (eventId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Evento',
      message: 'Tem certeza que deseja EXCLUIR permanentemente este evento cancelado? Esta ação removerá totalmente o evento do sistema de forma irreversível.',
      confirmText: 'Sim, Excluir',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const res = await authFetch(`/api/events/${eventId}`, { method: 'DELETE' });
          if (res.ok) {
            setSuccessMsg('Evento excluído com sucesso!');
            await loadEvents();
          } else {
            const data = await res.json();
            setErrorMsg(data.error || 'Erro ao excluir o evento.');
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Falha de comunicação.');
        }
      }
    });
  };

  // Participant details fetch
  const handleOpenParticipants = async (evt: any) => {
    setActiveParticipantsEvent(evt);
    setLoadingParticipants(true);
    try {
      const res = await authFetch(`/api/events/${evt.id}/participants?userRole=${currentUser.role}`);
      if (res.ok) {
        const data = await res.json();
        setParticipants(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingParticipants(false);
    }
  };

  // RSVP counter changes
  const changeRsvpCount = (eventId: string, isAdult: boolean, increment: boolean) => {
    if (isAdult) {
      const current = tempAdults[eventId] || 0;
      const next = increment ? current + 1 : Math.max(0, current - 1);
      setTempAdults(prev => ({ ...prev, [eventId]: next }));
    } else {
      const current = tempChildren[eventId] || 0;
      const next = increment ? current + 1 : Math.max(0, current - 1);
      setTempChildren(prev => ({ ...prev, [eventId]: next }));
    }
  };

  const handleSaveRsvp = async (eventId: string) => {
    setIsSavingRsvp(prev => ({ ...prev, [eventId]: true }));
    setErrorMsg('');
    setSuccessMsg('');

    const adults = tempAdults[eventId] || 0;
    const children = tempChildren[eventId] || 0;

    try {
      const res = await authFetch(`/api/events/${eventId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: currentUser.id,
          adultsCount: adults,
          childrenCount: children
        })
      });

      if (res.ok) {
        setSuccessMsg('Presença atualizada com sucesso!');
        await loadEvents();
        refreshParticipantsList(eventId);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Erro ao salvar sua presença.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro de conexão.');
    } finally {
      setIsSavingRsvp(prev => ({ ...prev, [eventId]: false }));
    }
  };

  const handleCancelRsvp = (eventId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cancelar Presença',
      message: 'Tem certeza que deseja cancelar sua presença neste evento? Isso removerá seus acompanhantes e cobranças associadas.',
      confirmText: 'Confirmar Cancelamento',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSavingRsvp(prev => ({ ...prev, [eventId]: true }));
        setErrorMsg('');
        setSuccessMsg('');

        try {
          const res = await authFetch(`/api/events/${eventId}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerId: currentUser.id,
              adultsCount: 0,
              childrenCount: 0
            })
          });

          if (res.ok) {
            setSuccessMsg('Presença cancelada com sucesso!');
            await loadEvents();
            refreshParticipantsList(eventId);
          } else {
            const data = await res.json();
            setErrorMsg(data.error || 'Erro ao cancelar sua presença.');
          }
        } catch (err: any) {
          setErrorMsg(err.message || 'Erro de conexão.');
        } finally {
          setIsSavingRsvp(prev => ({ ...prev, [eventId]: false }));
        }
      }
    });
  };

  // Toggle participants list with lazy loading
  const toggleParticipantsList = async (eventId: string) => {
    const isExpanded = !!expandedParticipantsMap[eventId];
    setExpandedParticipantsMap(prev => ({ ...prev, [eventId]: !isExpanded }));

    if (!isExpanded && !eventParticipantsMap[eventId]) {
      setLoadingParticipantsMap(prev => ({ ...prev, [eventId]: true }));
      try {
        const res = await authFetch(`/api/events/${eventId}/participants?userRole=${currentUser.role}`);
        if (res.ok) {
          const data = await res.json();
          setEventParticipantsMap(prev => ({ ...prev, [eventId]: data }));
        }
      } catch (err) {
        console.error('Erro ao buscar participantes do evento:', err);
      } finally {
        setLoadingParticipantsMap(prev => ({ ...prev, [eventId]: false }));
      }
    }
  };

  // Re-fetch list dynamically on RSVP updates
  const refreshParticipantsList = async (eventId: string) => {
    try {
      const res = await authFetch(`/api/events/${eventId}/participants?userRole=${currentUser.role}`);
      if (res.ok) {
        const data = await res.json();
        setEventParticipantsMap(prev => ({ ...prev, [eventId]: data }));
      }
    } catch (err) {
      console.error('Erro ao atualizar participantes do evento:', err);
    }
  };

  // Share confirmed event participants list on WhatsApp
  const handleShareConfirmedList = async (evt: any) => {
    let list = eventParticipantsMap[evt.id];
    if (!list) {
      setLoadingParticipantsMap(prev => ({ ...prev, [evt.id]: true }));
      try {
        const res = await authFetch(`/api/events/${evt.id}/participants?userRole=${currentUser.role}`);
        if (res.ok) {
          list = await res.json();
          setEventParticipantsMap(prev => ({ ...prev, [evt.id]: list }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingParticipantsMap(prev => ({ ...prev, [evt.id]: false }));
      }
    }

    if (!list || list.length === 0) {
      alert('Nenhum participante confirmado para gerar a lista de compartilhamento.');
      return;
    }

    // Sort: Alphabetically since everyone here has confirmed
    const sortedList = [...list].sort((a, b) => a.playerName.localeCompare(b.playerName));

    const totalPessoas = sortedList.reduce((sum, p) => sum + p.adultsCount + p.childrenCount, 0);

    const confirmedLines = sortedList.map(p => {
      const parts: string[] = [];
      const companionAdults = p.adultsCount - 1;
      if (companionAdults > 0) {
        parts.push(`+${companionAdults} adulto${companionAdults > 1 ? 's' : ''}`);
      }
      if (p.childrenCount > 0) {
        parts.push(`+${p.childrenCount} criança${p.childrenCount > 1 ? 's' : ''}`);
      }

      if (parts.length > 0) {
        return `${p.playerName} (${parts.join(', ')})`;
      } else {
        return `${p.playerName}`;
      }
    }).join('\n');

    const formattedDate = evt.date.split('-').reverse().join('/');

    const textMsg = `\uD83C\uDF89 Evento Racha do Fofim: *${evt.name}*\n\n\uD83D\uDC65 *Confirmados*\n\n${confirmedLines}\n\n*Total previsto:*\n${totalPessoas} pessoas\n\n\uD83D\uDCC5 *Data:* ${formattedDate} às ${evt.time}\n\uD83D\uDCCD *Local:* ${evt.location || 'Não especificado'}`;
    const escapedMsg = encodeURIComponent(textMsg);
    const url = `https://wa.me/?text=${escapedMsg}`;

    console.log("RAW MESSAGE (EVENT ATTS):", textMsg);
    console.log("ENCODED (EVENT ATTS):", escapedMsg);
    console.log("WHATSAPP URL (EVENT ATTS):", url);

    window.open(url, '_blank');
  };

  // Mark personal bill as paid
  const handleMarkAsPaid = async (eventId: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await authFetch(`/api/events/${eventId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: currentUser.id })
      });
      if (res.ok) {
        setSuccessMsg('Pagamento marcado com sucesso! Obrigado!');
        await loadEvents();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Erro ao registrar pagamento.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao processar pagamento.');
    }
  };

  // Live price calculations
  const getLiveEstimationText = (evt: any, adults: number, children: number) => {
    const isChurrasco = evt.type === 'churrasco';
    const isGoalkeeper = playerPrimaryPosition === 'goleiro';
    const isMensalista = playerCategory === 'mensalista';

    let breakdown = '';
    let total = 0;

    if (isChurrasco && (isGoalkeeper || isMensalista)) {
      const paidAdults = Math.max(0, adults - 1);
      const isFreeUser = adults > 0;
      total = (paidAdults * evt.adultPrice) + (children * evt.childPrice);
      breakdown = `${isFreeUser ? '1 Adulto Isento (Você) + ' : ''}${paidAdults} acompanhante(s) (R$ ${evt.adultPrice} cada) + ${children} criança(s) (R$ ${evt.childPrice} cada)`;
    } else {
      total = (adults * evt.adultPrice) + (children * evt.childPrice);
      breakdown = `${adults} adulto(s) (R$ ${evt.adultPrice} cada) + ${children} criança(s) (R$ ${evt.childPrice} cada)`;
    }

    return { total, breakdown };
  };

  // Compartilhar WhatsApp message content
  const handleShareWhatsApp = (evt: any) => {
    const isFree = evt.adultPrice === 0 && evt.childPrice === 0;
    const valueStr = isFree 
      ? 'Acesso Grátis' 
      : `Preço por Adulto: R$ ${evt.adultPrice.toFixed(2)} | Crianças: R$ ${evt.childPrice.toFixed(2)}`;

    const textMsg = `\uD83C\uDF89 Evento Racha do Fofim: *${evt.name}*\n\uD83D\uDCC5 Data: ${evt.date.split('-').reverse().join('/')} às ${evt.time}\n\uD83D\uDCCD Local: ${evt.location || 'Não especificado'}\n\uD83D\uDCB0 Valor: ${valueStr}\n\nConfirme sua presença no aplicativo do Racha do Fofim para garantir sua vaga! \u26BD\uD83C\uDF57\uD83C\uDF7B`;
    const escapedMsg = encodeURIComponent(textMsg);
    const url = `https://wa.me/?text=${escapedMsg}`;

    console.log("RAW MESSAGE (EVENT DETAILS):", textMsg);
    console.log("ENCODED (EVENT DETAILS):", escapedMsg);
    console.log("WHATSAPP URL (EVENT DETAILS):", url);

    window.open(url, '_blank');
  };

  // --- REPORT EXPORTS ---
  const exportToExcel = () => {
    if (!activeParticipantsEvent) return;
    // CSV content representation
    let csv = '\uFEFF'; // BOM to allow excel UTF-8 matching
    csv += 'Relatório de Evento: ' + activeParticipantsEvent.name + '\n';
    csv += 'Tipo: ' + EVENT_TYPE_CONFIG[activeParticipantsEvent.type as GrupalEventType]?.label + '\n';
    csv += 'Data: ' + activeParticipantsEvent.date + '\n';
    csv += 'Local: ' + activeParticipantsEvent.location + '\n\n';

    csv += 'Atleta;Adultos;Crianças;Faturamento Devido;Faturamento Pago;Status Financeiro\n';

    let totalAdults = 0;
    let totalChildren = 0;
    let totalDue = 0;
    let totalPaid = 0;

    participants.forEach(p => {
      const amountDue = p.amount;
      const isPaid = p.status === 'pago';
      csv += `${p.playerName};${p.adultsCount};${p.childrenCount};R$ ${amountDue.toFixed(2)};${isPaid ? 'R$ ' + amountDue.toFixed(2) : 'R$ 0,00'};${isPaid ? 'Pago' : 'Pendente'}\n`;

      totalAdults += p.adultsCount;
      totalChildren += p.childrenCount;
      totalDue += amountDue;
      if (isPaid) totalPaid += amountDue;
    });

    csv += `\nTOTAL;${totalAdults};${totalChildren};R$ ${totalDue.toFixed(2)};R$ ${totalPaid.toFixed(2)};\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `evento_${activeParticipantsEvent.id}_financeiro.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 container mx-auto px-4 py-2 text-zinc-300" id="events-manager-container">
      
      {/* Top Banner & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850">
        <div>
          <h2 className="text-xl font-display font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Gift className="w-5 h-5 text-emerald-400" />
            <span>Eventos & Confraternizações</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Churrascos especiais, celebrações e viagens do grupo society. Confirme seus convidados e acompanhe suas cobranças.
          </p>
        </div>

        {isEditor && (
          <button 
            type="button"
            onClick={handleOpenCreateForm}
            className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-mono tracking-wider uppercase transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Evento</span>
          </button>
        )}
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-zinc-500 hover:text-white text-sm font-bold">×</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono rounded-lg flex items-center justify-between animate-shake">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-zinc-500 hover:text-white text-sm font-bold">×</button>
        </div>
      )}

      {/* Grid List of Events */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 font-mono text-xs gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
          <span>Sincronizando eventos com o calendário...</span>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-zinc-950/20 rounded-xl border border-zinc-900 p-12 text-center space-y-3">
          <Calendar className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-white font-bold text-sm">Nenhum evento registrado</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Por enquanto não há churrascos ou festas programadas no calendário de confraternizações.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {events.map((evt) => {
            const typeConfig = EVENT_TYPE_CONFIG[evt.type as GrupalEventType] || EVENT_TYPE_CONFIG.personalizado;
            const statusConfig = STATUS_CONFIG[evt.status as GrupalEventStatus] || STATUS_CONFIG.agendado;
            const TypeIcon = typeConfig.icon;

            const liveEst = getLiveEstimationText(evt, tempAdults[evt.id] || 0, tempChildren[evt.id] || 0);

            // Check if user has updated RSVP counts compared to original DB state to enable saving
            const originalAdults = evt.myParticipant?.adultsCount || 0;
            const originalChildren = evt.myParticipant?.childrenCount || 0;
            const hasDraftChanges = (tempAdults[evt.id] !== originalAdults) || (tempChildren[evt.id] !== originalChildren);

            return (
              <div 
                key={evt.id} 
                className={`bg-[#0d1411]/55 border transition rounded-2xl p-4 md:p-5 flex flex-col justify-between space-y-4 shadow-lg ${
                  evt.status === 'cancelado' ? 'opacity-60 border-zinc-900' : 'border-zinc-850 hover:border-emerald-500/20'
                }`}
              >
                {/* Event Hero Area */}
                <div className="space-y-4">
                  <div className="flex justify-between items-start gap-2 flex-wrap sm:flex-nowrap">
                    <div className="flex gap-2.5 items-center">
                      <div className={`p-2 rounded-xl border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}>
                        <TypeIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded border ${typeConfig.bg} ${typeConfig.text} ${typeConfig.border}`}>
                          {typeConfig.label}
                        </span>
                        <h3 className="font-display font-bold text-white text-base mt-1 tracking-tight">
                          {evt.name}
                        </h3>
                      </div>
                    </div>

                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusConfig.bg}`}>
                      {statusConfig.label}
                    </span>
                  </div>

                  {evt.description && (
                    <p className="text-zinc-400 text-xs bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900 leading-relaxed font-mono">
                      {evt.description}
                    </p>
                  )}

                  {/* Info Card Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-900 font-mono text-[11px] text-zinc-400">
                    <div className="space-y-1">
                      <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black block">Data & Horário</span>
                      <div className="flex items-center gap-1.5 font-bold text-zinc-300">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{evt.date.split('-').reverse().join('/')} às {evt.time}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black block">Preço Adulto / Criança</span>
                      <div className="flex items-center gap-1 font-bold text-emerald-400">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>R$ {evt.adultPrice} / R$ {evt.childPrice}</span>
                      </div>
                    </div>
                    <div className="space-y-1 sm:col-span-2 border-t border-zinc-900/40 pt-2 flex items-center justify-between text-zinc-300">
                      <div>
                        <span className="text-[8px] text-zinc-500 uppercase tracking-widest font-black block">Localização</span>
                        <div className="flex items-center gap-1.5 font-bold text-zinc-300 mt-1 leading-tight">
                          <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span className="truncate max-w-xs">{evt.location || 'Sem local especificado'}</span>
                        </div>
                      </div>

                      <div className="text-right font-bold text-xs flex flex-col items-end">
                        <span className="text-[8px] text-zinc-500 uppercase block">Confirmados</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{evt.totalParticipants || 0} pessoas</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RSVP / User Panel */}
                {evt.status !== 'cancelado' && (
                  <div className="border-t border-zinc-900/60 pt-4 space-y-3.5">
                    
                    {evt.status !== 'encerrado' ? (
                      <div className="bg-[#0c1613] border border-emerald-500/10 rounded-xl p-3 space-y-3 font-mono">
                        <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                          Sua Confirmação de Presença e Convidados:
                        </span>

                        <div className="flex items-center justify-between gap-4 py-1">
                          {/* Adult Counter */}
                          <div className="flex items-center gap-3 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-900" title="Adultos (Participante + Acompanhantes)">
                            <UserIcon className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <div className="flex items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => changeRsvpCount(evt.id, true, false)}
                                className="w-6 h-6 rounded bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs"
                              >
                                -
                              </button>
                              <span className="w-4 text-center text-white font-bold">{tempAdults[evt.id] || 0}</span>
                              <button 
                                type="button"
                                onClick={() => changeRsvpCount(evt.id, true, true)}
                                className="w-6 h-6 rounded bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          {/* Children Counter */}
                          <div className="flex items-center gap-3 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-900" title="Crianças">
                            <Baby className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            <div className="flex items-center gap-2">
                              <button 
                                type="button"
                                onClick={() => changeRsvpCount(evt.id, false, false)}
                                className="w-6 h-6 rounded bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs"
                              >
                                -
                              </button>
                              <span className="w-4 text-center text-white font-bold">{tempChildren[evt.id] || 0}</span>
                              <button 
                                type="button"
                                onClick={() => changeRsvpCount(evt.id, false, true)}
                                className="w-6 h-6 rounded bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 font-bold text-xs"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Cost Helper text */}
                        <div className="bg-zinc-950/50 p-2.5 rounded border border-zinc-900 text-[10px] text-zinc-400">
                          <div className="flex justify-between font-bold text-emerald-400">
                            <span>Estimativa de Cobrança:</span>
                            <span>R$ {liveEst.total.toFixed(2)}</span>
                          </div>
                          <span className="block text-[8px] text-zinc-500 mt-1 uppercase tracking-wide leading-relaxed">
                            👉 {liveEst.breakdown}
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          {hasDraftChanges && (
                            <button
                              type="button"
                              disabled={isSavingRsvp[evt.id]}
                              onClick={() => handleSaveRsvp(evt.id)}
                              className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-xs uppercase tracking-wider transition cursor-pointer text-center"
                            >
                              {isSavingRsvp[evt.id] ? 'Salvando Presença...' : 'Confirmar Presença'}
                            </button>
                          )}

                          {evt.myParticipant && (
                            <button
                              type="button"
                              disabled={isSavingRsvp[evt.id]}
                              onClick={() => handleCancelRsvp(evt.id)}
                              className="flex-1 py-2 bg-zinc-900 hover:bg-rose-950/30 border border-zinc-850 hover:border-rose-900/45 text-zinc-400 hover:text-rose-400 rounded font-bold text-xs uppercase tracking-wider transition cursor-pointer text-center"
                            >
                              Cancelar Presença
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-900 text-zinc-500 text-center italic text-xs flex justify-center items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Evento encerrado. Alterações de presença congeladas.</span>
                      </div>
                    )}

                    {/* Own billing representation */}
                    {evt.myBill && (
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-zinc-950 p-3.5 rounded-xl border border-zinc-900 text-xs font-mono">
                        <div className="space-y-0.5">
                          <span className="text-[9px] text-zinc-500 uppercase tracking-wider block">Seu Status Financeiro</span>
                          <span className="text-zinc-300 font-semibold block">
                            Cobrança Total: <strong className="text-white text-sm">R$ {evt.myBill.amount.toFixed(2)}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between">
                          <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded border ${
                            evt.myBill.status === 'pago'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/25 animate-pulse'
                          }`}>
                            {evt.myBill.status === 'pago' ? 'Pago' : 'Pendente de Pagamento'}
                          </span>

                          {evt.myBill.status === 'pendente' && (
                            <button
                              type="button"
                              onClick={() => handleMarkAsPaid(evt.id)}
                              className="px-3 py-1 bg-[#14261d] hover:bg-[#22c55e] border border-emerald-500/20 text-emerald-400 hover:text-black rounded text-[10px] font-bold uppercase transition block"
                            >
                              Marcar Pago
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                  </div>
                )}

                {/* Actions Bottom Bar */}
                <div className="border-t border-zinc-900/60 pt-3.5 flex flex-wrap justify-between items-center gap-2.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Share action always available */}
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(evt)}
                      className="px-3 py-1.5 bg-[#0e2017] hover:bg-[#1a3828] border border-emerald-500/15 hover:border-emerald-500/30 text-emerald-400 hover:text-[#4ade80] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      <span>Divulgar WhatsApp</span>
                    </button>

                    {isEditor && (
                      <button
                        type="button"
                        onClick={() => handleOpenParticipants(evt)}
                        className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-300 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer"
                      >
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Participantes ({evt.totalParticipants || 0})</span>
                      </button>
                    )}
                  </div>

                  {/* Admin Editor controls */}
                  {isEditor && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      {evt.status === 'agendado' && (
                        <button
                          type="button"
                          onClick={() => {
                            // Quick toggle event to setting open for RSVPs
                            authFetch(`/api/events/${evt.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ status: 'confirmando' })
                            }).then(() => loadEvents());
                          }}
                          className="px-2.5 py-1.5 bg-zinc-950 border border-emerald-600/20 text-emerald-400 text-[10px] rounded hover:bg-emerald-950/15"
                        >
                          Confirmar Presença
                        </button>
                      )}

                      {evt.status !== 'cancelado' && evt.status !== 'encerrado' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEndEvent(evt.id)}
                            className="px-2 py-1.5 bg-[#121c24] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[10px] rounded uppercase font-mono tracking-tight"
                            title="Encerrar evento (congelar presenças)"
                          >
                            Encerrar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelEvent(evt.id)}
                            className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded text-[10px] uppercase font-mono tracking-tight"
                            title="Cancelar evento"
                          >
                            Cancelar
                          </button>
                        </>
                      )}

                      {evt.status === 'cancelado' && !evt.hasPaidBills && (
                        <button
                          type="button"
                          onClick={() => handleDeleteEvent(evt.id)}
                          className="px-2 py-1.5 bg-rose-950/20 hover:bg-rose-900 border border-rose-900 text-rose-300 hover:text-white rounded text-[10px] uppercase font-mono tracking-tight animate-pulseFast"
                          title="Excluir evento permanentemente"
                        >
                          Excluir
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEditForm(evt)}
                        className="p-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded transition"
                        title="Editar Evento"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* COLLAPSIBLE CONFIRMED PARTICIPANTS SECTION */}
                <div className="border-t border-zinc-900/60 pt-3.5 space-y-2">
                  <button
                    type="button"
                    onClick={() => toggleParticipantsList(evt.id)}
                    className="w-full py-2 px-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 rounded-lg flex items-center justify-between text-[11px] text-zinc-300 transition"
                  >
                    <span className="flex items-center gap-1.5 font-bold">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Participantes Confirmados</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                        {evt.totalParticipants || 0} pessoas
                      </span>
                      {expandedParticipantsMap[evt.id] ? (
                        <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
                      )}
                    </div>
                  </button>

                  {expandedParticipantsMap[evt.id] && (
                    <div className="mt-2.5 bg-zinc-950/50 rounded-lg border border-zinc-900/60 p-3 space-y-3">
                      {loadingParticipantsMap[evt.id] ? (
                        <div className="text-center py-2 text-zinc-500 text-[10px] flex items-center justify-center gap-2 font-mono">
                          <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                          <span>Carregando dados...</span>
                        </div>
                      ) : !eventParticipantsMap[evt.id] || eventParticipantsMap[evt.id].length === 0 ? (
                        <div className="text-center py-2 text-zinc-500 italic text-[10px] font-mono">
                          Nenhum participante confirmado ainda.
                        </div>
                      ) : (() => {
                        const partsList = eventParticipantsMap[evt.id] || [];
                        const countPlayers = partsList.length;
                        const countAdultCompanions = partsList.reduce((sum, p) => sum + Math.max(0, p.adultsCount - 1), 0);
                        const countChildren = partsList.reduce((sum, p) => sum + p.childrenCount, 0);
                        const totalPessoas = partsList.reduce((sum, p) => sum + p.adultsCount + p.childrenCount, 0);

                        const sortedPartsList = [...partsList].sort((a, b) => a.playerName.localeCompare(b.playerName));

                        return (
                          <div className="space-y-3 font-mono">
                            {/* Dashboard do Evento / Stats Summary */}
                            <div className="bg-[#090f0d] border border-emerald-500/5 p-2 rounded text-[10px] space-y-1">
                              <div className="grid grid-cols-2 gap-2 text-zinc-400">
                                <div>
                                  <span className="text-zinc-500 text-[8px] uppercase block font-bold">👥 Confirmados</span>
                                  <span className="text-white font-medium">{countPlayers} atletas</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 text-[8px] uppercase block font-bold">👨 Adultos</span>
                                  <span className="text-white font-medium">+{countAdultCompanions} acomp.</span>
                                </div>
                                <div>
                                  <span className="text-zinc-500 text-[8px] uppercase block font-bold">👶 Crianças</span>
                                  <span className="text-white font-medium">{countChildren} crianças</span>
                                </div>
                                <div className="border-l border-zinc-900 pl-1.5 font-bold">
                                  <span className="text-emerald-500 text-[8px] uppercase block font-bold">📊 Total Geral</span>
                                  <span className="text-emerald-400 font-bold">{totalPessoas} pessoas</span>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-zinc-900 mt-1 flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => handleShareConfirmedList(evt)}
                                  className="px-2 py-1 bg-[#102419] hover:bg-emerald-600 border border-emerald-500/10 hover:border-emerald-500 hover:text-white text-emerald-400 font-bold text-[9px] uppercase rounded transition cursor-pointer flex items-center gap-1"
                                >
                                  <Share2 className="w-2.5 h-2.5" />
                                  <span>Compartilhar Lista</span>
                                </button>
                              </div>
                            </div>

                            {/* Simple List of confirmed cards */}
                            <div className="grid grid-cols-1 gap-1.5 text-[10px]">
                              {sortedPartsList.map(p => {
                                const companionAdults = p.adultsCount - 1;
                                const hasAdults = companionAdults > 0;
                                const hasChildren = p.childrenCount > 0;

                                return (
                                  <div key={p.id} className="bg-zinc-900 border border-zinc-850 p-1.5 rounded flex items-center gap-2">
                                    {p.photoOriginal ? (
                                      <img src={p.photoOriginal} alt="" className="w-6 h-6 rounded-full object-cover border border-zinc-850" referralPolicy="no-referrer" />
                                    ) : (
                                      <div className="w-6 h-6 rounded-full bg-zinc-805 flex items-center justify-center text-zinc-400 font-sans border border-zinc-750 text-[8px]">
                                        {p.playerName?.slice(0, 2).toUpperCase()}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <span className="font-sans font-bold text-zinc-200 block truncate">{p.playerName}</span>
                                      <div className="text-[9px] text-zinc-500 flex flex-wrap gap-x-1 font-mono">
                                        {!hasAdults && !hasChildren ? (
                                          <span>Somente participante</span>
                                        ) : (
                                          <>
                                            {hasAdults && (
                                              <span className="text-emerald-400">+{companionAdults} adulto{companionAdults > 1 ? 's' : ''}</span>
                                            )}
                                            {hasChildren && (
                                              <span className="text-amber-400">+{p.childrenCount} criança{p.childrenCount > 1 ? 's' : ''}</span>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* --------------------------------- */}
      {/* MODAL FORM: CREATE / EDIT EVENT   */}
      {/* --------------------------------- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0b100e] border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
            <div className="flex justify-between items-center bg-[#0e1613] px-5 py-4 border-b border-zinc-900">
              <h3 className="font-display font-bold text-sm text-white uppercase tracking-wider">
                {editingId ? 'Editar Evento do Grupo' : 'Cadastrar Novo Evento'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-zinc-505 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              
              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">Nome do Evento</label>
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Churrasco dos Atletas - Fim de Ano"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">Descrição</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Traga acompanhantes para comemorar os jogos da temporada."
                  rows={2}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">Tipo de Evento</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as GrupalEventType)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="churrasco">Churrasco 🍗</option>
                    <option value="confraternizacao">Confraternização 🤝</option>
                    <option value="festa">Festa 🥳</option>
                    <option value="viagem">Viagem 🚌</option>
                    <option value="personalizado">Personalizado ⭐</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">Status Inicial</label>
                  <select
                    value={eventStatus}
                    onChange={(e) => setEventStatus(e.target.value as GrupalEventStatus)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="agendado">Agendado</option>
                    <option value="confirmando">Confirmando Presenças</option>
                    <option value="encerrado">Encerrado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">Data do Evento</label>
                  <input 
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">Horário de Início</label>
                  <input 
                    type="text"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    placeholder="12:00"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] font-mono uppercase text-zinc-400 font-bold">Local do Evento</label>
                <input 
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Granja Faria, Sede Principal"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 bg-zinc-950 p-3 rounded-lg border border-zinc-900">
                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-zinc-500 font-bold">Preço Adulto (R$)</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={adultPrice}
                    onChange={(e) => setAdultPrice(e.target.value)}
                    className="w-full bg-[#0a100d] border border-zinc-850 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-mono uppercase text-zinc-500 font-bold">Preço Criança (R$)</label>
                  <input 
                    type="number"
                    min="0"
                    step="any"
                    value={childPrice}
                    onChange={(e) => setChildPrice(e.target.value)}
                    className="w-full bg-[#0a100d] border border-zinc-850 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none"
                  />
                </div>

                <div className="col-span-2 text-[9px] text-zinc-500 font-mono mt-2 italic">
                  * Dica: Churrascos possuem isenção automática de 1 adulto para atletas associados (Mensalistas)!
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-900 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 bg-zinc-900 text-zinc-400 hover:text-white rounded-lg text-xs font-mono uppercase transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer"
                >
                  Confirmar Registro
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* --------------------------------- */}
      {/* MODAL LIST OF PARTICIPANTS (ADMIN) */}
      {/* --------------------------------- */}
      {activeParticipantsEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn" id="participants-report-modal">
          <div className="bg-[#0b100e] border border-zinc-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl relative block">
            
            <div className="flex justify-between items-center bg-[#0e1613] px-5 py-4 border-b border-zinc-900">
              <div>
                <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block font-bold">Controle Financeiro & Presenças</span>
                <h3 className="font-display font-medium text-sm text-white uppercase tracking-wider mt-0.5">
                  {activeParticipantsEvent.name}
                </h3>
              </div>
              <button 
                onClick={() => setActiveParticipantsEvent(null)}
                className="text-zinc-505 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Event stats header cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 font-mono text-center">
                  <span className="text-[9px] text-zinc-500 uppercase block">Total Adultos</span>
                  <span className="text-white text-base font-black mt-0.5 block">
                    {participants.reduce((sum, p) => sum + p.adultsCount, 0)}
                  </span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 font-mono text-center">
                  <span className="text-[9px] text-zinc-500 uppercase block">Total Crianças</span>
                  <span className="text-white text-base font-black mt-0.5 block">
                    {participants.reduce((sum, p) => sum + p.childrenCount, 0)}
                  </span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 font-mono text-center">
                  <span className="text-[9px] text-emerald-500 uppercase block font-bold">Faturamento Total</span>
                  <span className="text-emerald-400 text-base font-black mt-0.5 block">
                    R$ {participants.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                  </span>
                </div>
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-900 font-mono text-center">
                  <span className="text-[9px] text-zinc-500 uppercase block">Valor Pago</span>
                  <span className="text-emerald-500 text-base font-black mt-0.5 block">
                    R$ {participants.filter(p => p.status === 'pago').reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action row */}
              <div className="flex justify-between items-center bg-zinc-900/30 p-2 rounded-xl border border-zinc-900 text-xs">
                <span className="font-mono text-zinc-400 font-bold ml-1">Lista de Convocados</span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={exportToExcel}
                    className="bg-[#142a1f] hover:bg-[#204a35] border border-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>Excel (CSV)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    className="bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-400 px-3 py-1.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Imprimir (PDF)</span>
                  </button>
                </div>
              </div>

              {/* Main table */}
              {loadingParticipants ? (
                <div className="text-center py-6 text-xs font-mono text-zinc-500">Buscando confirmações...</div>
              ) : participants.length === 0 ? (
                <div className="text-center italic text-zinc-600 py-8 font-mono text-xs border border-zinc-900 rounded-xl bg-zinc-950/20">
                  Nenhum jogador se inscreveu neste evento até o momento.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-zinc-900">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-950 text-zinc-500 border-b border-zinc-900">
                        <th className="p-3">Atleta</th>
                        <th className="p-3">Categoria</th>
                        <th className="p-3 text-center">Adultos</th>
                        <th className="p-3 text-center">Crianças</th>
                        <th className="p-3 text-right">Cobrança devido</th>
                        <th className="p-3 text-center">Pagamento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/40">
                      {participants.map((p) => (
                        <tr key={p.id} className="hover:bg-zinc-950/60 transition text-zinc-300">
                          <td className="p-3 font-bold text-white flex items-center gap-2">
                            {p.photoOriginal && (
                              <img src={p.photoOriginal} alt="" className="w-6 h-6 rounded-full object-cover border border-zinc-800" referralPolicy="no-referrer" />
                            )}
                            <span>{p.playerName}</span>
                          </td>
                          <td className="p-3 text-[10px] uppercase text-zinc-400">
                            {CATEGORY_LABELS[p.category as PlayerCategory] || p.category}
                          </td>
                          <td className="p-3 text-center font-bold">{p.adultsCount}</td>
                          <td className="p-3 text-center text-zinc-450">{p.childrenCount}</td>
                          <td className="p-3 text-right font-bold text-white">R$ {p.amount.toFixed(2)}</td>
                          <td className="p-3 text-center">
                            <span className={`text-[9.5px] px-2 py-0.5 rounded border uppercase font-bold ${
                              p.status === 'pago' 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-amber-500/10 text-amber-500 border-amber-500/20 font-black'
                            }`}>
                              {p.status === 'pago' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
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
