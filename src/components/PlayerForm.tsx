/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { authFetch } from '../lib/authFetch';
import { Player, PlayerPosition, PlayerCategory, PlayerStatus, FAVORITE_TEAMS, POSITION_LABELS } from '../types';
import { X, Heart, Settings, Save, Phone, FileText } from 'lucide-react';

interface PlayerFormProps {
  player?: Player | null; // If provided, we are editing
  onSave: (data: Omit<Player, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function PlayerForm({ player, onSave, onCancel }: PlayerFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [photoOriginal, setPhotoOriginal] = useState('');
  const [playerCardUrl, setPlayerCardUrl] = useState('');
  const [favoriteTeamId, setFavoriteTeamId] = useState('fla');
  const [category, setCategory] = useState<PlayerCategory>('mensalista');
  const [status, setStatus] = useState<PlayerStatus>('disponivel');
  const [statusStartDate, setStatusStartDate] = useState('');
  const [statusEndDate, setStatusEndDate] = useState('');
  const [primaryPosition, setPrimaryPosition] = useState<PlayerPosition>('atacante');
  const [secondaryPositions, setSecondaryPositions] = useState<PlayerPosition[]>([]);

  // Soccer Avatar Custom States
  const [numeroFavorito, setNumeroFavorito] = useState<number>(10);
  const [peDominante, setPeDominante] = useState<string>('Direito');

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [s3Path, setS3Path] = useState('');

  // Initialize form if editing
  useEffect(() => {
    if (player) {
      setName(player.name);
      setPhone(player.phone || '');
      setEmail(player.email || '');
      setAdminNotes(player.adminNotes || '');
      setPhotoOriginal(player.photoOriginal || '');
      setPlayerCardUrl(player.playerCardUrl || '');
      setFavoriteTeamId(player.favoriteTeamId);
      setCategory(player.category);
      setStatus(player.status);
      setStatusStartDate(player.statusStartDate || '');
      setStatusEndDate(player.statusEndDate || '');
      setPrimaryPosition(player.primaryPosition);
      setSecondaryPositions(player.secondaryPositions || []);
      setS3Path(player.photoOriginal && player.photoOriginal.startsWith('http') ? player.photoOriginal : '');
      setNumeroFavorito(player.numeroFavorito || 10);
      setPeDominante(player.peDominante || 'Direito');
    } else {
      // Clear
      setName('');
      setPhone('');
      setEmail('');
      setAdminNotes('');
      setPhotoOriginal('');
      setPlayerCardUrl('');
      setFavoriteTeamId('fla');
      setCategory('mensalista');
      setStatus('disponivel');
      setStatusStartDate('');
      setStatusEndDate('');
      setPrimaryPosition('atacante');
      setSecondaryPositions([]);
      setS3Path('');
      setNumeroFavorito(10);
      setPeDominante('Direito');
    }
  }, [player]);



  const formatPhoneStr = (v: string) => {
    const digits = v.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
  };

  const handleSecondaryPositionToggle = (pos: PlayerPosition) => {
    if (secondaryPositions.includes(pos)) {
      setSecondaryPositions(secondaryPositions.filter((p) => p !== pos));
    } else {
      setSecondaryPositions([...secondaryPositions, pos]);
    }
  };

  const handleFileChange = async (file: File) => {
    setUploadError('');
    
    // Check file extension / mime type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setUploadError('Formato inválido. Use apenas JPG, JPEG, PNG ou WEBP.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Arquivo muito grande. O limite máximo é 5MB.');
      return;
    }

    setUploading(true);
    
    try {
      // Read file to Base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        
         const res = await authFetch('/api/upload-s3', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             filename: file.name,
             fileType: file.type,
             fileData: base64Data,
             playerId: player?.id || null
           })
         });

        if (!res.ok) {
          throw new Error('Falha no upload da imagem.');
        }

        const data = await res.json();
        setPhotoOriginal(data.url);
        setS3Path(data.url);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || 'Erro ao realizar upload de imagem.');
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanPhone = phone.replace(/\D/g, '');
    if (!phone) {
      setUploadError('O campo Celular é obrigatório!');
      return;
    }
    if (cleanPhone.length < 10) {
      setUploadError('Informe um telefone celular válido contendo DDD.');
      return;
    }

    // Build the updated object
    onSave({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      adminNotes: adminNotes.trim(),
      photoOriginal,
      playerCardUrl,
      favoriteTeamId,
      timeDoCoracao: selectedTeamDetails?.name || 'São Paulo',
      numeroFavorito,
      peDominante,
      avatarOriginal: photoOriginal,
      avatarEsportivo: player?.avatarEsportivo || '',
      avatarVersion: player?.avatarVersion || 1,
      category,
      status,
      statusStartDate: (status === 'lesionado' || status === 'indisponivel') ? statusStartDate : undefined,
      statusEndDate: (status === 'lesionado' || status === 'indisponivel') ? statusEndDate : undefined,
      primaryPosition,
      secondaryPositions: secondaryPositions.filter((p) => p !== primaryPosition) // Filter out if redundant
    });
  };

  const selectedTeamDetails = FAVORITE_TEAMS.find(t => t.id === favoriteTeamId);

  return (
    <form
      id="player-form-container"
      onSubmit={handleSubmit}
      className="p-5 md:p-6 rounded-xl sports-card border border-zinc-800 text-sm max-w-2xl mx-auto space-y-5 select-none font-sans"
    >
      <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#22c55e]" />
          <h2 className="font-display font-semibold text-lg text-white">
            {player ? 'Editar Jogador' : 'Adicionar Novo Jogador'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Name */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium">Nome Completo *</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: João Magalhães"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#22c55e] placeholder-zinc-600 transition"
          />
        </div>

        {/* Phone Cellular */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium flex items-center gap-1">
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Celular (Obrigatório)*</span>
          </label>
          <input
            type="text"
            required
            maxLength={15}
            value={phone}
            onChange={(e) => setPhone(formatPhoneStr(e.target.value))}
            placeholder="(85) 99999-9999"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#22c55e] placeholder-zinc-600 transition font-mono"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium">E-mail (Opcional)</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ex: nome@email.com"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#22c55e] placeholder-zinc-600 transition"
          />
        </div>

        {/* Club Selection with accent badge color */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
            <span>Time do Coração</span>
          </label>
          <div className="relative">
            <select
              value={favoriteTeamId}
              onChange={(e) => setFavoriteTeamId(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-3.5 pr-10 py-2.5 text-white focus:outline-none focus:border-[#22c55e] appearance-none transition cursor-pointer"
            >
              {FAVORITE_TEAMS.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
            <div
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-white/10"
              style={{ backgroundColor: selectedTeamDetails?.colorHex || '#ccc' }}
            />
          </div>
        </div>

        {/* Número Favorito */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium flex items-center gap-1.5">
            <span className="text-emerald-400 font-mono">#</span>
            <span>Número Favorito</span>
          </label>
          <input
            type="number"
            min={1}
            max={99}
            required
            value={numeroFavorito}
            onChange={(e) => setNumeroFavorito(Math.max(1, Math.min(99, Number(e.target.value) || 10)))}
            placeholder="Ex: 10"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-white focus:outline-none focus:border-[#22c55e] transition font-mono"
          />
        </div>

        {/* Pé Dominante */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium">Pé Dominante</label>
          <select
            value={peDominante}
            onChange={(e) => setPeDominante(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#22c55e] transition cursor-pointer"
          >
            <option value="Direito">Direito 🦶👉</option>
            <option value="Esquerdo">Esquerdo 🦶👈</option>
            <option value="Ambidestro">Ambidestro ⚡🦶</option>
          </select>
        </div>

        {/* Category Selector with live visual aid guides box */}
        <div className="flex flex-col gap-1.5 md:col-span-1">
          <label className="text-zinc-300 font-medium">Categoria do Racha</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PlayerCategory)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#22c55e] transition cursor-pointer"
          >
            <option value="mensalista">Mensalista</option>
            <option value="reserva">Reserva</option>
          </select>
          
          {/* HELP VISUAL CONTAINER */}
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-885 text-[10px] text-zinc-500 leading-normal">
            <span className="font-bold text-zinc-400 block uppercase mb-1">Impacto Financeiro & Rodadas:</span>
            {category === 'mensalista' && (
              <span>📝 <strong>Mensalista</strong>: Participa da apuração mensal, recebendo mensalidades fixas recorrentes. Prioridade no sorteio do racha. {primaryPosition === 'goleiro' && <strong className="text-emerald-500">(Goleiro Isento de Mensalidade)</strong>}</span>
            )}
            {category === 'reserva' && (
              <span>📋 <strong>Reserva</strong>: Não cobrado por mensalidade regular. Sujeito apenas à taxa de presença unitária quando convocado.</span>
            )}
          </div>
        </div>

        {/* Status Selection */}
        <div className="flex flex-col gap-1.5 md:col-span-1">
          <label className="text-zinc-300 font-medium">Status de Disponibilidade</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PlayerStatus)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#22c55e] transition cursor-pointer"
          >
            <option value="disponivel">Disponível</option>
            <option value="indisponivel">Indisponível (Ausente)</option>
            <option value="lesionado">Lesionado 🩺</option>
            <option value="afastado">Afastado / Fora temporada</option>
          </select>

          {/* Start / End dates for lesionado / indisponivel */}
          {(status === 'lesionado' || status === 'indisponivel') && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500">Ausente de:</label>
                <input
                  type="date"
                  required
                  value={statusStartDate}
                  onChange={(e) => setStatusStartDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-[#22c55e]/20 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#22c55e] text-xs transition font-mono"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500">Até data:</label>
                <input
                  type="date"
                  required
                  value={statusEndDate}
                  onChange={(e) => setStatusEndDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-[#22c55e]/20 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-[#22c55e] text-xs transition font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* Photo upload component */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-zinc-300 font-medium flex items-center gap-1.5">
            <span>Foto Original do Atleta</span>
            <span className="text-[10px] text-zinc-500 font-mono">(Upload direto para armazenamento em nuvem)</span>
          </label>
          
          {photoOriginal ? (
            <div className="flex items-center gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-850">
              <div className="relative w-24 h-24 rounded-full border-2 border-emerald-500 overflow-hidden bg-zinc-950 flex-shrink-0 shadow-lg">
                <img src={photoOriginal} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 space-y-1 min-w-0">
                <span className="text-[10px] font-bold text-emerald-450 block font-mono bg-emerald-550/10 px-2 py-0.5 rounded border border-emerald-500/20 w-fit">● UPLOAD: PRONTO_OK</span>
                <p className="text-[11px] text-zinc-500 truncate font-mono mt-1 select-all" title={s3Path}>
                  {s3Path}
                </p>
                <div className="flex items-center gap-2 pt-1.5">
                  <label className="text-xs text-white bg-zinc-800 hover:bg-zinc-700 hover:text-emerald-450 border border-zinc-750 px-3 py-1.5 rounded-lg cursor-pointer transition font-mono font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Substituir Foto</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => { setPhotoOriginal(''); setS3Path(''); }}
                    className="text-xs text-rose-450 hover:text-rose-350 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-500/10 hover:border-rose-500/35 px-3 py-1.5 rounded-lg transition font-mono font-medium"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center gap-2 cursor-pointer ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-450'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 text-zinc-400'
              }`}
            >
              <input
                type="file"
                id="image-file-input"
                accept="image/png, image/jpeg, image/jpg, image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              />
              <label htmlFor="image-file-input" className="cursor-pointer flex flex-col items-center justify-center w-full h-full py-2 select-none">
                {uploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-emerald-500 border-r-2 border-r-transparent mb-3" />
                ) : (
                  <svg className="w-10 h-10 text-zinc-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
                <p className="text-xs text-zinc-300 font-bold mb-1">
                  Arraste e solte sua foto aqui, ou clique para navegar
                </p>
                <p className="text-[10px] text-zinc-500 font-mono">
                  JPG, JPEG, PNG ou WEBP (Max 5MB)
                </p>
              </label>
            </div>
          )}
        </div>

        {/* Primary Position */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium">Posição Principal *</label>
          <select
            value={primaryPosition}
            onChange={(e) => setPrimaryPosition(e.target.value as PlayerPosition)}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-[#22c55e] transition cursor-pointer"
          >
            {Object.entries(POSITION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          {primaryPosition === 'goleiro' && (
            <span className="text-[9.5px] font-mono text-emerald-450 mt-1 bg-emerald-950/20 px-2 py-1 rounded border border-emerald-500/10">
              🧤 Goleiros possuem isenção automática de mensalidade nas regras de faturamento e regras de sorteio especializadas.
            </span>
          )}
        </div>

        {/* [NEW FIELD] Administrative Notes */}
        <div className="flex flex-col gap-1.5 col-span-1">
          <label className="text-zinc-300 font-medium flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-zinc-450" />
            <span>Observações Administrativas (Opcional)</span>
          </label>
          <textarea
            rows={2}
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Ex: Jogador com grande potencial, indicado por Ricardo. Pagamentos via PIX avulso."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-white font-sans text-xs focus:outline-none focus:border-[#22c55e] placeholder-zinc-650 resize-y transition"
          />
        </div>

        {/* Secondary Positions Checklist */}
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-zinc-300 font-medium">Posições Secundárias (Multipla escolha)</label>
          <p className="text-[11px] text-zinc-500 mb-1">
            Selecione outras posições em que o atleta também consegue atuar em campo.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-zinc-900/40 p-3.5 rounded-lg border border-zinc-800/60">
            {Object.entries(POSITION_LABELS).map(([key, label]) => {
              const typedKey = key as PlayerPosition;
              const isPrimary = primaryPosition === typedKey;
              const isChecked = secondaryPositions.includes(typedKey);

              return (
                <label
                  key={key}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md border text-xs transition select-none ${
                    isPrimary
                      ? 'opacity-40 bg-zinc-900 border-zinc-800 text-zinc-500 cursor-not-allowed'
                      : isChecked
                      ? 'bg-[#22c55e]/10 border-[#22c55e]/40 text-[#4ade80] cursor-pointer'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700/60 text-zinc-400 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={isPrimary}
                    checked={!isPrimary && isChecked}
                    onChange={() => handleSecondaryPositionToggle(typedKey)}
                    className="accent-[#22c55e] rounded border-zinc-800 h-3.5 w-3.5"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {uploadError && (
        <p className="text-xs text-rose-455 font-bold font-mono mt-1 bg-rose-950/20 p-2 rounded border border-rose-500/10">⚠️ Falha no Formulário: {uploadError}</p>
      )}

      {/* Buttons Footer */}
      <div className="flex justify-end gap-3 pt-3 border-t border-zinc-900">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white rounded-lg transition cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          id="btn-save-player"
          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/25 transition duration-150 flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Atleta</span>
        </button>
      </div>
    </form>
  );
}
