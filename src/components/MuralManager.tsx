import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Film,
  Plus,
  Trash2,
  Edit2,
  Share2,
  Award,
  Calendar,
  Search,
  Filter,
  RefreshCw,
  X,
  Check,
  Image as ImageIcon,
  Video as VideoIcon,
  Globe,
  Eye,
  EyeOff,
  Lock,
  Copy,
  ArrowLeft,
  BarChart2,
  AlertCircle,
  Clock,
  Play
} from 'lucide-react';
import { User, MuralPost } from '../types';

interface MuralManagerProps {
  currentUser: User | null;
  isPublicMode?: boolean;
}

export interface UploadItem {
  id: string;
  file: File;
  preview: string;
  isResized: boolean;
  originalSize: number;
  currentSize: number;
}

// Client-side image resize / compression helper
const resizeImage = (file: File, maxSizeMB: number = 10): Promise<{ file: File; preview: string; isResized: boolean }> => {
  return new Promise((resolve, reject) => {
    const isImg = file.type.startsWith('image/');
    if (!isImg) {
      reject(new Error("Arquivo não é uma imagem"));
      return;
    }

    // If file is already smaller than or equal to maxSizeMB, we don't strictly require resizing,
    // but we can still read it as base64 preview format for upload.
    if (file.size <= maxSizeMB * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve({
          file,
          preview: e.target?.result as string,
          isResized: false
        });
      };
      reader.onerror = () => reject(new Error("Erro ao ler o arquivo"));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Downscale to 2048px maximum width or height to optimize size
        const MAX_WIDTH = 2048;
        const MAX_HEIGHT = 2048;

        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
          if (width > height) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          } else {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Não foi possível criar o contexto do canvas"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.85;
        let base64 = canvas.toDataURL('image/jpeg', quality);

        const getBase64Size = (b64: string) => {
          const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
          return (b64.length * 3 / 4) - padding;
        };

        let currentSize = getBase64Size(base64);

        // Progressively lower quality if size still exceeds threshold
        while (currentSize > maxSizeMB * 1024 * 1024 && quality > 0.4) {
          quality -= 0.1;
          base64 = canvas.toDataURL('image/jpeg', quality);
          currentSize = getBase64Size(base64);
        }

        try {
          const byteString = atob(base64.split(',')[1]);
          const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
          }
          const blob = new Blob([ab], { type: mimeString });
          const newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
          const resizedFile = new File([blob], newName, {
            type: mimeString,
            lastModified: Date.now()
          });

          resolve({
            file: resizedFile,
            preview: base64,
            isResized: true
          });
        } catch (convErr) {
          reject(convErr);
        }
      };
      img.onerror = () => reject(new Error("Falha ao processar arquivo de imagem"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsDataURL(file);
  });
};

export default function MuralManager({ currentUser, isPublicMode = false }: MuralManagerProps) {
  // Check if we are in public view mode from the URL or passed prop
  const isPublic = isPublicMode || window.location.search.includes('public=true') || window.location.pathname === '/public-mural';

  // Component States
  const [posts, setPosts] = useState<MuralPost[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [associations, setAssociations] = useState<{
    matches: { id: string; date: string; location: string; label: string }[];
    events: { id: string; date: string; name: string; label: string }[];
  }>({ matches: [], events: [] });
  const [stats, setStats] = useState({ publicationsCount: 0, photosCount: 0, videosCount: 0 });

  // Filtering / Search States
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');

  // Loading & Msg States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals & Form
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<MuralPost | null>(null);
  const [postToEdit, setPostToEdit] = useState<MuralPost | null>(null);

  // Form inputs for uploading
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<'partida' | 'evento' | 'resenha' | 'livre'>('partida');
  const [formAssociation, setFormAssociation] = useState(''); // e.g. "match-123" or "event-456"
  const [formAllowPublic, setFormAllowPublic] = useState(true);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Form inputs for editing
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAllowPublic, setEditAllowPublic] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const postsUrl = isPublic ? '/api/mural/public-posts' : '/api/mural/posts';
      const postsRes = await fetch(postsUrl);
      if (!postsRes.ok) throw new Error('Não foi possível carregar as publicações.');
      const postsData = await postsRes.json();
      setPosts(postsData);

      if (!isPublic) {
        // Load configurations / metadata only for authenticated users
        const [catRes, assocRes, statsRes] = await Promise.all([
          fetch('/api/mural/categories'),
          fetch('/api/mural/associations'),
          fetch('/api/mural/stats')
        ]);

        if (catRes.ok) setCategories(await catRes.json());
        if (assocRes.ok) setAssociations(await assocRes.json());
        if (statsRes.ok) setStats(await statsRes.json());
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar os dados do Mural.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isPublic]);

  // Statistics Calculation (Client side fallback + server-synced)
  const currentPhotosCount = posts.filter(p => p.mediaType === 'image').length;
  const currentVideosCount = posts.filter(p => p.mediaType === 'video').length;
  const currentPublicationsCount = posts.length;

  // Destaque da Semana
  const highlightPost = posts.find((p) => p.isHighlighted);

  // Filter lists derived
  const years = Array.from(new Set(posts.map(p => new Date(p.createdAt).getFullYear()))).sort((a, b) => {
    const numA = Number(a) || 0;
    const numB = Number(b) || 0;
    return numB - numA;
  });
  const months = [
    { value: '01', name: 'Janeiro' },
    { value: '02', name: 'Fevereiro' },
    { value: '03', name: 'Março' },
    { value: '04', name: 'Abril' },
    { value: '05', name: 'Maio' },
    { value: '06', name: 'Junho' },
    { value: '07', name: 'Julho' },
    { value: '08', name: 'Agosto' },
    { value: '09', name: 'Setembro' },
    { value: '10', name: 'Outubro' },
    { value: '11', name: 'Novembro' },
    { value: '12', name: 'Dezembro' }
  ];

  // Apply filters
  const filteredPosts = posts.filter((post) => {
    const postDate = new Date(post.createdAt);
    const postYear = postDate.getFullYear().toString();
    const postMonth = String(postDate.getMonth() + 1).padStart(2, '0');

    const matchesSearch = 
      post.title.toLowerCase().includes(search.toLowerCase()) ||
      post.description.toLowerCase().includes(search.toLowerCase()) ||
      post.authorName.toLowerCase().includes(search.toLowerCase());

    const matchesCategory = filterCategory === 'all' || post.category === filterCategory;
    const matchesYear = filterYear === 'all' || postYear === filterYear;
    const matchesMonth = filterMonth === 'all' || postMonth === filterMonth;

    return matchesSearch && matchesCategory && matchesYear && matchesMonth;
  });

  // Handle Drag & Drop events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processMultipleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processMultipleFiles(Array.from(e.target.files));
    }
  };

  const processMultipleFiles = async (filesToProcess: File[]) => {
    setErrorMsg('');
    const newItems: UploadItem[] = [];

    for (const file of filesToProcess) {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');

      if (!isImg && !isVid) {
        setErrorMsg('Apenas arquivos de imagem (JPG, JPEG, PNG, WEBP) ou vídeo (MP4, MOV) são suportados. Alguns itens foram ignorados.');
        continue;
      }

      if (isImg) {
        try {
          // If the image is larger than 10MB, it will automatically undergo our canvas resize effort.
          // Otherwise, it gets read directly as base64 preview without degradation.
          const result = await resizeImage(file, 10);
          newItems.push({
            id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            file: result.file,
            preview: result.preview,
            isResized: result.isResized,
            originalSize: file.size,
            currentSize: result.file.size
          });
        } catch (err: any) {
          console.error('Erro ao processar imagem:', err);
          setErrorMsg('Falha ao otimizar uma das imagens. Ela pode estar corrompida.');
        }
      } else if (isVid) {
        if (file.size > 200 * 1024 * 1024) {
          setErrorMsg('Vídeos que excedem o limite de 200 MB foram ignorados da seleção.');
          continue;
        }

        try {
          const previewUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("Erro ao ler arquivo de vídeo"));
            reader.readAsDataURL(file);
          });

          newItems.push({
            id: 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            file: file,
            preview: previewUrl,
            isResized: false,
            originalSize: file.size,
            currentSize: file.size
          });
        } catch (err: any) {
          console.error('Erro ao ler vídeo:', err);
          setErrorMsg('Falha ao processar vídeo selecionado.');
        }
      }
    }

    if (newItems.length > 0) {
      setUploadItems(prev => [...prev, ...newItems]);
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (uploadItems.length === 0) {
      setErrorMsg('Por favor, selecione ao menos um arquivo/imagem para publicação.');
      return;
    }
    if (!formTitle.trim()) {
      setErrorMsg('O título é obrigatório.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Loop over every item in series
      for (let i = 0; i < uploadItems.length; i++) {
        const item = uploadItems[i];
        
        // Use custom numbering if multiple files are published at once
        const titleSuffix = uploadItems.length > 1 ? ` (${i + 1}/${uploadItems.length})` : '';
        const finalTitle = `${formTitle.trim()}${titleSuffix}`;

        // 1. Upload base64 file to Express simulated S3 storage
        const uploadRes = await fetch('/api/mural/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: item.file.name,
            fileType: item.file.type,
            fileData: item.preview,
            size: item.file.size
          })
        });

        if (!uploadRes.ok) {
          const uploadErrData = await uploadRes.json();
          throw new Error(uploadErrData.error || `Erro de rede ao enviar arquivo: ${item.file.name}`);
        }

        const uploadResult = await uploadRes.json();

        // Parse Associated match or event ID
        let matchId: string | undefined = undefined;
        let eventId: string | undefined = undefined;

        if (formAssociation) {
          if (formAssociation.startsWith('match-')) {
            matchId = formAssociation;
          } else if (formAssociation.startsWith('event-')) {
            eventId = formAssociation;
          }
        }

        // 2. Publish post in Mural database
        const postPayload = {
          title: finalTitle,
          description: formDescription,
          mediaUrl: uploadResult.localUrl,
          mediaType: uploadResult.mediaType,
          fileSize: item.file.size,
          category: formCategory,
          matchId,
          eventId,
          allowPublicView: formAllowPublic,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorRole: currentUser.role
        };

        const postRes = await fetch('/api/mural/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postPayload)
        });

        if (!postRes.ok) {
          const postErrData = await postRes.json();
          throw new Error(postErrData.error || 'Erro ao salvar publicação no banco.');
        }
      }

      setSuccessMsg(
        uploadItems.length > 1 
          ? `Sucesso! Foram criadas ${uploadItems.length} publicações no Mural do Racha.` 
          : 'Publicação enviada com sucesso ao Mural!'
      );
      resetUploadForm();
      setIsUploadOpen(false);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar publicação de um dos arquivos.');
    } finally {
      setActionLoading(false);
    }
  };

  const resetUploadForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCategory('partida');
    setFormAssociation('');
    setFormAllowPublic(true);
    setUploadItems([]);
  };

  // Submit Edit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !postToEdit) return;
    if (!editTitle.trim()) {
      setErrorMsg('O título é obrigatório.');
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/mural/posts/${postToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          allowPublicView: editAllowPublic,
          reqUserId: currentUser.id,
          reqUserRole: currentUser.role
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao salvar alterações.');
      }

      setSuccessMsg('Publicação atualizada com sucesso!');
      setIsEditOpen(false);
      setPostToEdit(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao editar a publicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Publication
  const handleDeletePost = async (id: string) => {
    if (!currentUser) return;
    if (!window.confirm('Tem certeza absoluta que deseja excluir de forma permanente esta publicação? Esta ação é irreversível.')) {
      return;
    }

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/mural/posts/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reqUserRole: currentUser.role
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao processar exclusão.');
      }

      setSuccessMsg('Publicação removida com sucesso!');
      setSelectedPost(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao remover publicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Highlight Toggle Admin
  const handleToggleHighlight = async (id: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/mural/posts/${id}/highlight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reqUserId: currentUser.id,
          reqUserRole: currentUser.role
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao alternar destaque.');
      }

      const updated = await res.json();
      setSuccessMsg(updated.isHighlighted ? 'Destaque da semana definido!' : 'Destaque removido.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao alterar destaque da publicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Share Actions
  const handleShareWhatsApp = (post: MuralPost) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?public=true#post-${post.id}`;
    const text = `🏆 *Mural do Racha do Fofim* 🏆
Confira a nossa publicação no Mural:

*"${post.title}"*
Categoria: ${post.category.toUpperCase()}
Postado por: ${post.authorName}

Veja o conteúdo completo e assista o vídeo/foto aqui:
${shareUrl}`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCopyLink = (post: MuralPost) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?public=true#post-${post.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Link público copiado com sucesso! Compartilhe onde desejar.');
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn" id="mural-viewport">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-900 pb-5">
        <div>
          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full uppercase font-mono font-bold tracking-widest">
            {isPublic ? 'Mural Público Simplificado' : 'Destaques & Memórias'}
          </span>
          <h2 className="font-display font-extrabold text-2xl text-white mt-2">Mural do Racha</h2>
          <p className="text-zinc-500 text-xs mt-0.5">
            {isPublic 
              ? 'Área pública simplificada contendo os destaques e as fotos e vídeos autorizados do racha.'
              : 'O espaço oficial para compartilhar e eternizar momentos, resenhas e grandes lances.'}
          </p>
        </div>

        {!isPublic && currentUser && (
          <button
            id="btn-upload-mural"
            onClick={() => setIsUploadOpen(true)}
            className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Publicar Foto / Vídeo</span>
          </button>
        )}
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/25 text-[#4ade80] rounded-xl text-xs flex items-center gap-2.5">
          <Check className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SECTION 1: 📸 DESTAQUE DA SEMANA SECTION (Always visible) */}
      {highlightPost && (
        <div className="bg-gradient-to-r from-emerald-950/20 to-zinc-950/40 border border-emerald-500/20 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Award className="w-40 h-40 text-emerald-400" />
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-center">
            {/* Visual Media Cover */}
            <div className="w-full lg:w-[320px] h-[190px] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800 shadow-md group flex-shrink-0 cursor-pointer"
                 onClick={() => setSelectedPost(highlightPost)}>
              {highlightPost.mediaType === 'image' ? (
                <img 
                  src={highlightPost.mediaUrl} 
                  alt={highlightPost.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full relative">
                  <video 
                    src={highlightPost.mediaUrl}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                    <div className="bg-emerald-600 p-3 rounded-full text-white shadow-xl">
                      <Play className="w-5 h-5 fill-current" />
                    </div>
                  </div>
                </div>
              )}
              <span className="absolute top-2.5 left-2.5 bg-emerald-600 text-white font-mono font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                👑 DESTAQUE DA SEMANA
              </span>
            </div>

            {/* details text */}
            <div className="flex-1 space-y-3 w-full">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-zinc-900 text-zinc-400 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                  {highlightPost.category}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {new Date(highlightPost.createdAt).toLocaleDateString('pt-BR')}
                </span>
              </div>

              <h3 className="font-display font-extrabold text-xl md:text-2xl text-white tracking-tight leading-snug">
                {highlightPost.title}
              </h3>

              <p className="text-zinc-300 text-xs md:text-sm leading-relaxed max-w-2xl line-clamp-3">
                {highlightPost.description || 'Nenhuma descrição inserida.'}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-900">
                <div className="text-xs font-mono text-zinc-400">
                  Postado por: <span className="font-bold text-white uppercase">{highlightPost.authorName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPost(highlightPost)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white font-semibold text-xs rounded-lg transition"
                  >
                    Ver Tudo
                  </button>

                  <button
                    onClick={() => handleShareWhatsApp(highlightPost)}
                    className="p-2 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/25 rounded-lg transition"
                    title="Compartilhar no WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATS INFOGRAPH (Hidden in Public mode) */}
      {!isPublic && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" id="mural-stats-block">
          <div className="bg-[#101714] p-4 rounded-xl border border-zinc-850 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Publicações</span>
              <span className="block text-2xl font-black text-white">{currentPublicationsCount}</span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Camera className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#101714] p-4 rounded-xl border border-zinc-850 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Fotos Compartilhadas</span>
              <span className="block text-2xl font-black text-white">{currentPhotosCount}</span>
            </div>
            <div className="p-3 bg-[#0a5c36]/20 rounded-xl text-emerald-400">
              <ImageIcon className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#101714] p-4 rounded-xl border border-zinc-850 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="block text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Vídeos Carregados</span>
              <span className="block text-2xl font-black text-white">{currentVideosCount}</span>
            </div>
            <div className="p-3 bg-[#22c55e]/10 rounded-xl text-emerald-400">
              <Film className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* FILTER & SEARCH PANEL */}
      <div className="bg-[#111815] p-4 rounded-xl border border-zinc-850/80 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por título, descrição ou autor..."
              className="w-full bg-zinc-950 border border-zinc-850 text-xs text-white rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:border-[#22c55e] placeholder-zinc-600"
            />
          </div>

          {/* Filtering Category */}
          <div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-lg px-3 py-2.5 focus:outline-none min-h-[38px] cursor-pointer"
            >
              <option value="all">Todas as Categorias</option>
              <option value="partida">Partida</option>
              <option value="evento">Evento</option>
              <option value="resenha">Resenha</option>
              <option value="livre">Livre</option>
            </select>
          </div>

          {/* Combined Month/Year Filters */}
          <div className="grid grid-cols-2 gap-2">
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-lg px-2 py-2.5 focus:outline-none min-h-[38px] cursor-pointer"
            >
              <option value="all">Ano</option>
              {years.map(y => (
                <option key={y} value={y.toString()}>{y}</option>
              ))}
            </select>

            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-850 text-xs text-zinc-300 rounded-lg px-2 py-2.5 focus:outline-none min-h-[38px] cursor-pointer"
            >
              <option value="all">Mês</option>
              {months.map(m => (
                <option key={m.value} value={m.value}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action tags feedback */}
        {(filterCategory !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || search) && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-zinc-500 font-mono">
              Filtro ativo: mostrando <strong className="text-white">{filteredPosts.length}</strong> de {posts.length} publicações.
            </span>
            <button
              onClick={() => {
                setSearch('');
                setFilterCategory('all');
                setFilterYear('all');
                setFilterMonth('all');
              }}
              className="text-[10px] text-emerald-400 hover:underline font-bold uppercase font-mono tracking-wider cursor-pointer"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* MAIN CARDS LIST GRID */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
          <span className="text-xs text-zinc-500 font-mono">Lendo publicações do Mural...</span>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-zinc-850 bg-[#111815]/10 p-6">
          <ImageIcon className="w-10 h-10 text-zinc-600 mx-auto mb-2.5" />
          <p className="text-zinc-400 font-semibold text-sm">Nenhum registro encontrado no Mural!</p>
          <p className="text-xs text-zinc-600 mt-1">Seja o primeiro a publicar um momento do racha.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-[#0f1512] border border-zinc-900 rounded-xl overflow-hidden hover:border-[#22c55e]/25 transition flex flex-col group relative"
              id={`post-card-${post.id}`}
            >
              {/* Media Visual Header */}
              <div
                onClick={() => setSelectedPost(post)}
                className="h-[180px] bg-zinc-950 overflow-hidden relative cursor-pointer"
              >
                {post.mediaType === 'image' ? (
                  <img
                    src={post.mediaUrl}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full relative flex items-center justify-center">
                    <video
                      src={post.mediaUrl}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="bg-emerald-600 p-2.5 rounded-full text-white shadow-lg">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Badges labels */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                  <span className="bg-zinc-950/85 backdrop-blur-md text-zinc-300 text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-zinc-800 uppercase tracking-wider">
                    {post.category}
                  </span>
                  
                  {post.isHighlighted && (
                    <span className="bg-amber-500 text-zinc-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1 uppercase">
                      <Award className="w-3 h-3" />
                      Destaque
                    </span>
                  )}
                </div>

                {/* Play duration indicator if video */}
                {post.mediaType === 'video' && (
                  <div className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-zinc-400 font-mono font-semibold uppercase flex items-center gap-1">
                    <Film className="w-2.5 h-2.5" />
                    <span>VÍDEO</span>
                  </div>
                )}
              </div>

              {/* details block */}
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mb-2">
                  <span className="font-bold text-zinc-300 text-[11px] truncate uppercase">{post.authorName}</span>
                  <span>•</span>
                  <span>{new Date(post.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>

                <h3
                  onClick={() => setSelectedPost(post)}
                  className="font-display font-bold text-sm text-white tracking-tight line-clamp-1 hover:text-emerald-400 transition cursor-pointer"
                >
                  {post.title}
                </h3>

                <p className="text-zinc-400 text-xs mt-1.5 line-clamp-2 leading-relaxed flex-1">
                  {post.description || 'Nenhuma descrição adicionada.'}
                </p>

                {/* Association Info Badge inside card */}
                {(post.matchId || post.eventId) && (
                  <div className="mt-3 py-1 px-2 border border-zinc-900 bg-zinc-950/65 rounded text-[9px] font-mono text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-500" />
                    <span className="truncate">
                      {post.matchId ? 'Associado a uma Partida' : 'Associado a um Evento'}
                    </span>
                  </div>
                )}

                {/* Action controls footer */}
                <div className="mt-4 pt-3 border-t border-zinc-900/70 flex justify-between items-center gap-2 select-none">
                  <button
                    onClick={() => setSelectedPost(post)}
                    className="text-[11px] text-zinc-400 hover:text-white hover:underline font-mono uppercase"
                  >
                    Ver Completo
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Share Whatsapp */}
                    <button
                      onClick={() => handleShareWhatsApp(post)}
                      className="p-1.5 bg-zinc-900 hover:bg-emerald-950/40 text-zinc-400 hover:text-emerald-400 border border-zinc-850 hover:border-emerald-500/10 rounded-lg transition"
                      title="Compartilhar no WhatsApp"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Copy internal link */}
                    <button
                      onClick={() => handleCopyLink(post)}
                      className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-850 rounded-lg transition"
                      title="Copiar Link Interno"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Admin Actions */}
                    {!isPublic && currentUser && currentUser.role === 'admin' && (
                      <button
                        onClick={() => handleToggleHighlight(post.id)}
                        className={`p-1.5 border rounded-lg transition ${
                          post.isHighlighted
                            ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                            : 'bg-zinc-900 hover:bg-amber-950/20 border-zinc-850 text-zinc-500 hover:text-amber-400'
                        }`}
                        title="Destaque da Semana"
                      >
                        <Award className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete Admin */}
                    {!isPublic && currentUser && currentUser.role === 'admin' && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-1.5 bg-zinc-900 hover:bg-rose-950/20 text-zinc-500 hover:text-rose-400 border border-zinc-850 rounded-lg transition"
                        title="Excluir do Mural"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL 1: PREVIEW DETAILED VIEW WITH EXCLUSIVE COMPONENT VIEW */}
      <AnimatePresence>
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
            <div className="bg-[#090e0c] border border-zinc-850 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
              
              {/* Modal controls bar */}
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-zinc-900 text-zinc-400 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    {selectedPost.category}
                  </span>
                  {selectedPost.isHighlighted && (
                    <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 tracking-wider uppercase font-mono flex items-center gap-1">
                      👑 Destaque
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-1.5 rounded-lg border border-zinc-855 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable contents wrapper */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                
                {/* Visual Cover Screen */}
                <div className="w-full h-[280px] md:h-[360px] bg-zinc-950 rounded-xl overflow-hidden relative border border-zinc-900 flex items-center justify-center">
                  {selectedPost.mediaType === 'image' ? (
                    <img 
                      src={selectedPost.mediaUrl} 
                      alt={selectedPost.title} 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <video 
                      src={selectedPost.mediaUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>

                {/* Author description block details */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 border-b border-zinc-900/60 text-xs text-zinc-500 font-mono">
                    <div>
                      Postado por: <span className="font-bold text-white uppercase">{selectedPost.authorName}</span> ({selectedPost.authorRole})
                    </div>
                    <div>
                      Data: <span className="font-bold text-zinc-300">{new Date(selectedPost.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  <h3 className="font-display font-extrabold text-lg md:text-xl text-white">
                    {selectedPost.title}
                  </h3>

                  <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {selectedPost.description || 'Nenhuma descrição detalhada informada.'}
                  </p>

                  {/* Association indicator elements */}
                  {(selectedPost.matchId || selectedPost.eventId) && (
                    <div className="mt-4 p-3 border border-zinc-900 bg-zinc-950 rounded-xl space-y-1">
                      <span className="block text-[9px] font-mono text-zinc-500 uppercase tracking-wider">Associação do Registro:</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono">
                        <Calendar className="w-4 h-4 text-emerald-500" />
                        <span>
                          {selectedPost.matchId 
                            ? `Partida do Racha do Fofim` 
                            : `Confraternização / Evento do Grupo`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action operations footer bar */}
              <div className="p-4 border-t border-zinc-900 bg-zinc-900/20 flex flex-wrap gap-3 items-center justify-between justify-items-stretch">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleShareWhatsApp(selectedPost)}
                    className="px-4 py-2 bg-[#25d366]/10 text-[#25d366] hover:bg-[#25d366]/20 border border-[#25d366]/20 rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 transition"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => handleCopyLink(selectedPost)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 transition"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copiar Link</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  {/* Author / Admin Edit button */}
                  {!isPublic && currentUser && (currentUser.id === selectedPost.authorId || currentUser.role === 'admin') && (
                    <button
                      onClick={() => {
                        setPostToEdit(selectedPost);
                        setEditTitle(selectedPost.title);
                        setEditDescription(selectedPost.description);
                        setEditAllowPublic(selectedPost.allowPublicView !== false);
                        setIsEditOpen(true);
                        setSelectedPost(null);
                      }}
                      className="px-4 py-2 bg-zinc-950 hover:bg-zinc-90 w-auto hover:text-white border border-zinc-800 text-zinc-300 font-bold font-mono text-xs flex items-center gap-1.5 rounded-xl transition"
                    >
                      <Edit2 className="w-4 h-4" />
                      <span>Editar</span>
                    </button>
                  )}

                  {/* Admin Delete button */}
                  {!isPublic && currentUser && currentUser.role === 'admin' && (
                    <button
                      onClick={() => handleDeletePost(selectedPost.id)}
                      className="px-4 py-2 bg-rose-950/20 border border-rose-500/20 text-rose-400 hover:bg-rose-900 hover:text-white rounded-xl font-bold font-mono text-xs flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Excluir</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: PUBLISH UPLOAD FLOW */}
      <AnimatePresence>
        {isUploadOpen && !isPublic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
            <div className="bg-[#080d0b] border border-zinc-850 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[95vh]">
              
              <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="text-emerald-400 w-5 h-5" />
                  <h3 className="font-display font-extrabold text-sm text-white uppercase tracking-wide">Nova publicação no Mural</h3>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsUploadOpen(false); resetUploadForm(); }}
                  className="p-1.5 rounded-lg border border-zinc-850 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
                
                {/* Drag & Drop Box */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition relative flex flex-col items-center justify-center min-h-[140px] cursor-pointer ${
                    dragActive 
                      ? 'border-[#22c55e] bg-emerald-500/5' 
                      : uploadItems.length > 0 
                        ? 'border-zinc-805 bg-zinc-950/40' 
                        : 'border-zinc-800 hover:border-[#22c55e]/30 bg-zinc-950/20'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/quicktime"
                    onChange={handleFileChange}
                  />

                  <div className="space-y-2 pointer-events-none">
                    <div className="p-3 bg-zinc-900 rounded-full text-zinc-500 inline-block">
                      <Camera className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Arraste e solte seus arquivos aqui</p>
                      <p className="text-[10px] text-zinc-500 mt-1">ou clique para navegar no dispositivo (permite múltiplos)</p>
                    </div>
                    <div className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-900 inline-block uppercase tracking-wide">
                      Foto: até 10 MB | Vídeo: até 200 MB
                    </div>
                  </div>
                </div>

                {/* List of uploaded items preview */}
                {uploadItems.length > 0 && (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest font-mono">
                        Arquivos Selecionados ({uploadItems.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadItems([])}
                        className="text-[10px] text-rose-450 hover:underline uppercase font-mono"
                      >
                        Limpar Tudo
                      </button>
                    </div>
                    <div className="space-y-1.5 font-mono">
                      {uploadItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center gap-3 bg-zinc-950/80 border border-zinc-900 rounded-lg p-2 text-xs"
                        >
                          {/* Thumbnail preview */}
                          <div className="w-10 h-10 bg-zinc-900 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative border border-zinc-850">
                            {item.file.type.startsWith('image/') ? (
                              <img src={item.preview} alt="Mini preview" className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>

                          {/* Metadata */}
                          <div className="flex-1 min-w-0 font-mono text-[10px]">
                            <p className="text-white font-bold truncate max-w-[200px]" title={item.file.name}>
                              {item.file.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-zinc-500 text-[9px] mt-0.5">
                              <span>{(item.originalSize / (1024 * 1024)).toFixed(2)} MB</span>
                              {item.isResized && (
                                <>
                                  <span>→</span>
                                  <span className="text-[#4ade80] font-bold">{(item.currentSize / (1024 * 1024)).toFixed(2)} MB</span>
                                  <span className="bg-emerald-500/10 text-[#4ade80] text-[8px] px-1 rounded border border-emerald-500/20 font-bold uppercase ml-1">
                                    Otimizado
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Action button to delete this specific file from selecting */}
                          <button
                            type="button"
                            onClick={() => setUploadItems(prev => prev.filter(x => x.id !== item.id))}
                            className="p-1 px-1.5 bg-zinc-900 hover:bg-rose-950/40 border border-zinc-850 hover:border-rose-500/10 rounded text-zinc-400 hover:text-rose-400 transition ml-auto"
                            title="Remover"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-3 font-mono text-xs text-zinc-300">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-white uppercase">Título da Publicação *</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Ex: Golaço do racha de quarta-feira!"
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 text-white rounded-lg focus:outline-none focus:border-[#22c55e]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-white uppercase">Descrição / Momentos</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Descreva o que rolou nesse grande lance ou confraternização..."
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 text-white rounded-lg focus:outline-none focus:border-[#22c55e]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-white uppercase">Categoria *</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as any)}
                        className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 text-zinc-300 rounded-lg focus:outline-none cursor-pointer"
                      >
                        <option value="partida">Partida</option>
                        <option value="evento">Evento</option>
                        <option value="resenha">Resenha</option>
                        <option value="livre">Livre</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-bold text-white uppercase">Associação (Opcional)</label>
                      <select
                        value={formAssociation}
                        onChange={(e) => setFormAssociation(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 px-2 py-2 text-zinc-300 rounded-lg focus:outline-none cursor-pointer"
                      >
                        <option value="">Nenhuma</option>
                        <optgroup label="Partidas anteriores">
                          {associations.matches.slice(0,10).map(m => (
                            <option key={m.id} value={m.id}>{m.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Eventos coletivos">
                          {associations.events.slice(0,10).map(e => (
                            <option key={e.id} value={e.id}>{e.label}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                  </div>

                  {/* Public Toggle checkbox */}
                  <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900 flex items-center justify-between gap-4 mt-2">
                    <div className="space-y-0.5 pr-2">
                      <span className="block text-[11px] font-bold text-white uppercase flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-emerald-400" />
                        Disponibilizar na Página Pública
                      </span>
                      <span className="block text-[9px] text-zinc-500">
                        Ative para permitir visualização e acesso de convidados na seção pública offline do racha.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formAllowPublic}
                        onChange={(e) => setFormAllowPublic(e.target.checked)}
                        className="sr-only peer accent-[#22c55e]"
                      />
                      <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white inline-block"></div>
                    </label>
                  </div>
                </div>

                {/* Submitting Actions */}
                <div className="pt-3 flex gap-3 font-mono text-xs uppercase font-bold select-none">
                  <button
                    type="button"
                    onClick={() => { setIsUploadOpen(false); resetUploadForm(); }}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-lg border border-zinc-800 transition cursor-pointer text-center"
                  >
                    Voltar
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading || uploadItems.length === 0 || !formTitle}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 rounded-lg shadow-lg shadow-emerald-500/10 transition cursor-pointer text-center flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Publicando...</span>
                      </>
                    ) : (
                      <span>Publicar</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: EDIT DISCIPLINE */}
      <AnimatePresence>
        {isEditOpen && postToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-fadeIn">
            <div className="bg-[#080d0b] border border-zinc-850 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative p-5 flex flex-col">
              
              <div className="pb-3 border-b border-zinc-900 flex items-center justify-between text-white font-display font-extrabold text-sm uppercase tracking-wider mb-4">
                <span>Editar Informações</span>
                <X className="w-4 h-4 cursor-pointer text-zinc-400" onClick={() => { setIsEditOpen(false); setPostToEdit(null); }} />
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-4 font-mono text-xs text-zinc-300">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-white uppercase">Título da Publicação *</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 text-white rounded-lg focus:outline-none focus:border-[#22c55e]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-white uppercase">Descrição / Momentos</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 text-white rounded-lg focus:outline-none focus:border-[#22c55e]"
                  />
                </div>

                {/* Public Toggle checkbox */}
                <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 pr-2">
                    <span className="block text-[11px] font-bold text-white uppercase flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      Disponibilizar na Página Pública
                    </span>
                    <span className="block text-[9px] text-zinc-500">
                      Permitir visualização na página de convidados externos.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editAllowPublic}
                      onChange={(e) => setEditAllowPublic(e.target.checked)}
                      className="sr-only peer accent-[#22c55e]"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white inline-block"></div>
                  </label>
                </div>

                <div className="pt-3 flex gap-3 font-mono text-xs uppercase font-bold select-none">
                  <button
                    type="button"
                    onClick={() => { setIsEditOpen(false); setPostToEdit(null); }}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-[#111] text-zinc-400 hover:text-white rounded-lg border border-zinc-850 transition cursor-pointer text-center"
                  >
                    Cancelar
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading || !editTitle.trim()}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 rounded-lg shadow-lg transition cursor-pointer text-center flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <span>Salvar</span>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
