import React, { useState, useEffect, useRef, useMemo } from 'react';
import { authFetch } from '../lib/authFetch';
import { AnimatePresence } from 'motion/react';
import ResponsiveTabsContainer from './ResponsiveTabsContainer';
import {
  Camera,
  Film,
  Plus,
  Trash2,
  Edit2,
  Share2,
  Award,
  Star,
  Calendar,
  Search,
  RefreshCw,
  X,
  Check,
  Image as ImageIcon,
  Copy,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  Clock,
  Play,
  Megaphone,
  ChevronDown,
  BookOpen,
  History
} from 'lucide-react';
import { User, MuralPost } from '../types';
import CommunicationCenter from './CommunicationCenter';
import { useAppConfig } from '../contexts/AppConfigContext';

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

const createResizedDataUrl = (file: File, maxDim: number, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string); // fallback to original dataurl
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error("Falha ao carregar imagem para redimensionamento"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo para redimensionamento"));
    reader.readAsDataURL(file);
  });
};

export default function MuralManager({ currentUser, isPublicMode = false }: MuralManagerProps) {
  const { appName } = useAppConfig();
  // Check if we are in public view mode from the URL or passed prop
  const isPublic = isPublicMode || window.location.search.includes('public=true') || window.location.pathname === '/public-mural';

  const [muralSubTab, setMuralSubTab] = useState<'comunicacao' | 'memorias'>('comunicacao');
  
  // New States for Museu do Clube V2 (5 Tabs)
  const [museuTab, setMuseuTab] = useState<'memorias' | 'momentos' | 'historia' | 'comunicacao' | 'arquivo'>('memorias');
  const [fullMatches, setFullMatches] = useState<any[]>([]);
  const [fullResults, setFullResults] = useState<any[]>([]);
  const [selectedHistoryMatchId, setSelectedHistoryMatchId] = useState<string | null>(null);

  // Mobile accordion state and compact publish state
  const [expandedSection, setExpandedSection] = useState<'regra' | 'aviso' | 'comunicado' | 'memoria' | 'history' | null>('regra');
  const [isPublishDropdownOpen, setIsPublishDropdownOpen] = useState(false);

  const handleDropdownOptionClick = (type: 'regra' | 'aviso' | 'comunicado' | 'memoria') => {
    setIsPublishDropdownOpen(false);
    if (type === 'memoria') {
      setMuseuTab('memorias');
      setMuralSubTab('memorias');
      setExpandedSection('memoria');
      setIsUploadOpen(true);
    } else {
      setMuseuTab('comunicacao');
      setMuralSubTab('comunicacao');
      setExpandedSection(type);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('trigger-add-communication', { detail: { category: type } }));
      }, 120);
    }
  };

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
  const [formShowOnLanding, setFormShowOnLanding] = useState(false);
  const [formIsHighlighted, setFormIsHighlighted] = useState(false);
  const [formEventDate, setFormEventDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Form inputs for editing
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editShowOnLanding, setEditShowOnLanding] = useState(false);
  const [editIsHighlighted, setEditIsHighlighted] = useState(false);
  const [editEventDate, setEditEventDate] = useState<string>('');

  // States for album date grouping, custom delete, and mobile touch swiping
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeAlbumDate, setActiveAlbumDate] = useState<string | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [activeHighlightIdx, setActiveHighlightIdx] = useState(0);

  const [memoriesPage, setMemoriesPage] = useState(1);
  const [albumPage, setAlbumPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);

  // Reset memories pagination when filters or search change
  useEffect(() => {
    setMemoriesPage(1);
  }, [search, filterCategory, filterYear, filterMonth, selectedHistoryMatchId]);

  // Reset album pagination when active album date changes
  useEffect(() => {
    setAlbumPage(1);
  }, [activeAlbumDate]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const postsUrl = isPublic ? '/api/mural/public-posts' : '/api/mural/posts';
      const postsRes = await authFetch(postsUrl);
      if (!postsRes.ok) throw new Error('Não foi possível carregar as publicações.');
      const postsData = await postsRes.json();
      setPosts(postsData);

      // Load configurations, metadata, matches, results, and stats for all users (both public and authenticated)
      const [catRes, assocRes, statsRes, matchesRes, resultsRes] = await Promise.all([
        authFetch('/api/mural/categories'),
        authFetch('/api/mural/associations'),
        authFetch('/api/mural/stats'),
        authFetch('/api/matches'),
        authFetch('/api/results')
      ]);

      if (catRes.ok) setCategories(await catRes.json());
      if (assocRes.ok) setAssociations(await assocRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      if (matchesRes && matchesRes.ok) setFullMatches(await matchesRes.json());
      if (resultsRes && resultsRes.ok) setFullResults(await resultsRes.json());
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao carregar os dados do Mural.');
    } finally {
      setLoading(false);
    }
  };

  const [pendingMatchIdToOpen, setPendingMatchIdToOpen] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [isPublic]);

  useEffect(() => {
    const handleOpenMuralPost = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const matchId = customEvent.detail;
      if (matchId) {
        setPendingMatchIdToOpen(matchId);
      }
    };
    window.addEventListener('open-mural-post', handleOpenMuralPost);
    return () => {
      window.removeEventListener('open-mural-post', handleOpenMuralPost);
    };
  }, []);

  useEffect(() => {
    if (pendingMatchIdToOpen && posts.length > 0) {
      const matchPost = posts.find(p => p.matchId === pendingMatchIdToOpen);
      if (matchPost) {
        setSelectedPost(matchPost);
        setPendingMatchIdToOpen(null);
      }
    }
  }, [pendingMatchIdToOpen, posts]);

  // Statistics Calculation (Client side fallback + server-synced)
  const currentPhotosCount = posts.filter(p => p.mediaType === 'image' && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted).length;
  const currentVideosCount = posts.filter(p => p.mediaType === 'video' && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted).length;
  const currentPublicationsCount = posts.filter(p => !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted).length;

  const highlightedPosts = posts.filter(p => !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted);
  const latestHighlightedPost = highlightedPosts.find(p => p.isHighlighted === true && p.mediaUrl && p.mediaType === 'image') || highlightedPosts.find(p => p.mediaUrl && p.mediaType === 'image');
  const capaImageUrl = latestHighlightedPost?.mediaUrl || 'https://picsum.photos/seed/football1/1200/800?grayscale&blur=2'; // Placeholder de futebol genérico

  // Destaques do Mural (No máximo 3)
  const muralHighlights = useMemo(() => {
    return posts.filter(p => p.isHighlighted === true).slice(0, 3);
  }, [posts]);

  // Adjust active index if it goes out of bounds
  useEffect(() => {
    if (activeHighlightIdx >= muralHighlights.length && muralHighlights.length > 0) {
      setActiveHighlightIdx(0);
    }
  }, [muralHighlights, activeHighlightIdx]);

  const activeHighlight = muralHighlights[activeHighlightIdx] || muralHighlights[0] || null;

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
    // DO NOT show communication categories under Galeria de Memórias or Momentos Épicos
    if (['regra', 'aviso', 'comunicado'].includes(post.category)) return false;

    // Filter by selected history match
    if (selectedHistoryMatchId && post.matchId !== selectedHistoryMatchId) return false;

    // Determine event date
    const rawDateStr = post.eventDate || post.createdAt.split('T')[0];
    const postDate = new Date(rawDateStr + 'T12:00:00'); 
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

  // Group filtered posts by their event date (YYYY-MM-DD)
  const groupedByDateMap = useMemo(() => {
    const map: Record<string, MuralPost[]> = {};
    filteredPosts.forEach((post) => {
      const dateKey = post.eventDate || post.createdAt.split('T')[0];
      if (!map[dateKey]) {
        map[dateKey] = [];
      }
      map[dateKey].push(post);
    });
    return map;
  }, [filteredPosts]);

  // Sorted list of dates for UI rendering
  const sortedDateKeys = useMemo(() => {
    return Object.keys(groupedByDateMap).sort((a, b) => b.localeCompare(a));
  }, [groupedByDateMap]);

  // Slideshow source list depending on whether an album has been clicked
  const activeSlideshowList = useMemo(() => {
    if (activeAlbumDate) {
      return filteredPosts.filter((p) => {
        const pDate = p.eventDate || p.createdAt.split('T')[0];
        return pDate === activeAlbumDate;
      });
    }
    return filteredPosts;
  }, [filteredPosts, activeAlbumDate]);

  // Paginated list of date keys (main memories feed)
  const paginatedDateKeys = useMemo(() => {
    const startIndex = (memoriesPage - 1) * 10;
    return sortedDateKeys.slice(startIndex, startIndex + 10);
  }, [sortedDateKeys, memoriesPage]);

  // Paginated active album items
  const paginatedAlbumList = useMemo(() => {
    const startIndex = (albumPage - 1) * 10;
    return activeSlideshowList.slice(startIndex, startIndex + 10);
  }, [activeSlideshowList, albumPage]);

  // Slideshow Navigation Methods
  const handlePrevPost = () => {
    if (!selectedPost || activeSlideshowList.length === 0) return;
    const currentIndex = activeSlideshowList.findIndex(p => p.id === selectedPost.id);
    if (currentIndex === -1) return;
    const prevIndex = (currentIndex - 1 + activeSlideshowList.length) % activeSlideshowList.length;
    setSelectedPost(activeSlideshowList[prevIndex]);
  };

  const handleNextPost = () => {
    if (!selectedPost || activeSlideshowList.length === 0) return;
    const currentIndex = activeSlideshowList.findIndex(p => p.id === selectedPost.id);
    if (currentIndex === -1) return;
    const nextIndex = (currentIndex + 1) % activeSlideshowList.length;
    setSelectedPost(activeSlideshowList[nextIndex]);
  };

  // Keyboard navigation listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedPost) return;
      if (e.key === 'ArrowLeft') {
        handlePrevPost();
      } else if (e.key === 'ArrowRight') {
        handleNextPost();
      } else if (e.key === 'Escape') {
        setSelectedPost(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPost, activeSlideshowList]);

  // Mobile Touch Gestures on media item container
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.touches[0].clientX;
    const diffX = touchStartX - touchEndX;

    // Detect horizontal swipes greater than 60px
    if (Math.abs(diffX) > 60) {
      if (diffX > 0) {
        handleNextPost(); // Swiped left -> load next image
      } else {
        handlePrevPost(); // Swiped right -> load original image
      }
      setTouchStartX(null); // Clear touch movement
    }
  };

  const handleTouchEnd = () => {
    setTouchStartX(null);
  };

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

        // 1. Upload original file to Supabase Storage
        const uploadRes = await authFetch('/api/mural/upload', {
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

        // 2. Generate and Upload Thumbnail and Medium sizes if it is an image
        let thumbnailUrl = uploadResult.url;
        let mediumUrl = uploadResult.url;

        const isImage = item.file.type.startsWith('image/');
        if (isImage) {
          try {
            // Generate Thumbnail (max 300px, quality 0.7)
            const thumbData = await createResizedDataUrl(item.file, 300, 0.7);
            const thumbUploadRes = await authFetch('/api/mural/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: `thumb-${item.file.name}`,
                fileType: 'image/jpeg',
                fileData: thumbData,
                size: thumbData.length
              })
            });
            if (thumbUploadRes.ok) {
              const thumbRes = await thumbUploadRes.json();
              thumbnailUrl = thumbRes.url;
            }

            // Generate Medium (max 1000px, quality 0.8)
            const mediumData = await createResizedDataUrl(item.file, 1000, 0.8);
            const mediumUploadRes = await authFetch('/api/mural/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                filename: `medium-${item.file.name}`,
                fileType: 'image/jpeg',
                fileData: mediumData,
                size: mediumData.length
              })
            });
            if (mediumUploadRes.ok) {
              const medRes = await mediumUploadRes.json();
              mediumUrl = medRes.url;
            }
          } catch (resizeErr) {
            console.error('[Error auto-generating optimized versions - falling back to original]', resizeErr);
          }
        }

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

        // 3. Publish post in Mural database
        const postPayload = {
          title: finalTitle,
          description: formDescription,
          mediaUrl: uploadResult.url,
          mediaType: uploadResult.mediaType,
          fileSize: item.file.size,
          category: formCategory,
          matchId,
          eventId,
          showOnLanding: formShowOnLanding,
          isHighlighted: formIsHighlighted,
          thumbnailUrl,
          mediumUrl,
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorRole: currentUser.role,
          eventDate: formEventDate
        };

        const postRes = await authFetch('/api/mural/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postPayload)
        });

        if (!postRes.ok) {
          const postErrData = await postRes.json();
          throw new Error(postErrData.error || 'Erro ao salvar publicação no banco.');
        }
      }

      setSuccessMsg('✅ Publicação enviada para o mural.');
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
    setFormShowOnLanding(false);
    setFormEventDate(new Date().toISOString().split('T')[0]);
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
      const res = await authFetch(`/api/mural/posts/${postToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          showOnLanding: editShowOnLanding,
          isHighlighted: editIsHighlighted,
          reqUserId: currentUser.id,
          reqUserRole: currentUser.role,
          eventDate: editEventDate
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

  // Delete Publication Trigger
  const handleDeletePost = (id: string) => {
    setConfirmDeleteId(id);
  };

  // Perform actual deletion with the backend
  const executeDeletePost = async () => {
    if (!currentUser || !confirmDeleteId) return;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authFetch(`/api/mural/posts/${confirmDeleteId}`, {
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
      setConfirmDeleteId(null);
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao remover publicação.');
    } finally {
      setActionLoading(false);
    }
  };

  // Highlight Toggle Admin (isHighlighted - Mural)
  const handleToggleHighlight = async (id: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authFetch(`/api/mural/posts/${id}/highlight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reqUserId: currentUser.id,
          reqUserRole: currentUser.role
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao alternar destaque do mural.');
      }

      const updated = await res.json();
      setSuccessMsg(updated.isHighlighted ? '📌 Destacado no Mural (limite de 3)!' : 'Removido dos destaques do mural.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao alterar destaque do mural.');
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle Landing Screen Highlight (showOnLanding)
  const handleToggleLanding = async (id: string) => {
    if (!currentUser || currentUser.role !== 'admin') return;

    setActionLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await authFetch(`/api/mural/posts/${id}/toggle-landing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reqUserId: currentUser.id,
          reqUserRole: currentUser.role
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Erro ao alternar destaque na tela inicial.');
      }

      const updated = await res.json();
      setSuccessMsg(updated.showOnLanding ? '⭐ Destacado na Tela Inicial!' : 'Removido dos destaques da tela inicial.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao alterar destaque na tela inicial.');
    } finally {
      setActionLoading(false);
    }
  };

  // Share Actions
  const handleShareWhatsApp = (post: MuralPost) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?public=true#post-${post.id}`;
    const text = `\uD83C\uDFC6 *Mural do ${appName}* \uD83C\uDFC6
Confira a nossa publicação no Mural:

*"${post.title}"*
Categoria: ${post.category.toUpperCase()}
Postado por: ${post.authorName}

Veja o conteúdo completo e assista o vídeo/foto aqui:
${shareUrl}`;

    const escapedMsg = encodeURIComponent(text);
    const url = `https://wa.me/?text=${escapedMsg}`;

    console.log("RAW MESSAGE (MURAL):", text);
    console.log("ENCODED (MURAL):", escapedMsg);
    console.log("WHATSAPP URL (MURAL):", url);

    window.open(url, '_blank');
  };

  const handleCopyLink = (post: MuralPost) => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?public=true#post-${post.id}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      alert('Link copiado com sucesso! Compartilhe onde desejar.');
    });
  };

  // Count helpers
  const rulesCount = posts.filter(p => p.category === 'regra' && !p.isDeleted && !p.isArchived).length;
  const warningsCount = posts.filter(p => p.category === 'aviso' && !p.isDeleted && !p.isArchived).length;
  const announcementsCount = posts.filter(p => p.category === 'comunicado' && !p.isDeleted && !p.isArchived).length;
  const memoriesCount = posts.filter(p => !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted).length;
  const historyCount = posts.filter(p => {
    const isComm = ['regra', 'aviso', 'comunicado'].includes(p.category);
    if (!isComm) return false;
    return currentUser?.role === 'admin' 
      ? (p.isArchived === true || p.isDeleted === true)
      : (p.isArchived === true && p.isDeleted !== true);
  }).length;

  const renderMemoriesContent = () => {
    return (
      <>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            onClick={() => setErrorMsg('')}
            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-rose-400 hover:text-white hover:bg-rose-500/10 rounded transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/25 text-[#4ade80] rounded-xl text-xs flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <Check className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg('')}
            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#4ade80] hover:text-white hover:bg-emerald-500/10 rounded transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: 📸 DESTAQUES DO MURAL (Supports up to 3 items) */}
      {muralHighlights.length > 0 && activeHighlight && (
        <div className="bg-gradient-to-r from-emerald-950/20 to-zinc-950/40 border border-emerald-500/20 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Award className="w-40 h-40 text-emerald-400" />
          </div>

          <div className="flex flex-col lg:flex-row gap-6 items-center">
            {/* Visual Media Cover */}
            <div className="w-full lg:w-[320px] h-[190px] bg-zinc-900 rounded-xl overflow-hidden relative border border-zinc-800 shadow-md group flex-shrink-0 cursor-pointer"
                 onClick={() => setSelectedPost(activeHighlight)}>
              {activeHighlight.mediaType === 'image' ? (
                <img 
                  src={activeHighlight.mediaUrl || undefined} 
                  alt={activeHighlight.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full relative">
                  <video 
                    src={activeHighlight.mediaUrl || undefined}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                    <div className="bg-emerald-600 p-3 rounded-full text-white shadow-xl">
                      <Play className="w-5 h-5 fill-current ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
              <span className="absolute top-2.5 left-2.5 bg-emerald-500 text-zinc-950 font-sans font-black text-[9px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                📌 DESTAQUE DO MURAL
              </span>
            </div>

            {/* details text */}
            <div className="flex-1 space-y-3 w-full relative">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activeHighlight.origin === 'automatic' ? (
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/20 font-bold px-2.5 py-0.5 rounded font-mono tracking-wider uppercase">
                      🤖 Registro Automático
                    </span>
                  ) : (
                    <span className="text-[10px] bg-zinc-900 text-zinc-400 font-bold px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                      {activeHighlight.category}
                    </span>
                  )}
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {new Date(activeHighlight.createdAt).toLocaleDateString('pt-BR')}
                  </span>
                </div>

                {/* Left/Right controls if more than 1 item */}
                {muralHighlights.length > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveHighlightIdx(prev => (prev - 1 + muralHighlights.length) % muralHighlights.length)}
                      className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                      title="Anterior"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[10px] text-zinc-500 font-mono font-bold px-1.5 selection:bg-transparent">
                      {activeHighlightIdx + 1}/{muralHighlights.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveHighlightIdx(prev => (prev + 1) % muralHighlights.length)}
                      className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                      title="Próximo"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="font-display font-extrabold text-xl md:text-2xl text-white tracking-tight leading-snug">
                {activeHighlight.title}
              </h3>

              <p className="text-zinc-300 text-xs md:text-sm leading-relaxed max-w-2xl line-clamp-3">
                {activeHighlight.description || 'Nenhuma descrição inserida.'}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-zinc-900">
                <div className="text-xs font-mono text-zinc-400">
                  Postado por: <span className="font-bold text-white uppercase">{activeHighlight.authorName}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedPost(activeHighlight)}
                    className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white font-semibold text-xs rounded-lg transition"
                  >
                    Ver Tudo
                  </button>

                  <button
                    onClick={() => handleShareWhatsApp(activeHighlight)}
                    className="p-2 bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-500/25 rounded-lg transition"
                    title="Compartilhar no WhatsApp"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Carousel Dot Indicators at the bottom center if more than 1 */}
          {muralHighlights.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-4">
              {muralHighlights.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveHighlightIdx(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === activeHighlightIdx ? 'bg-emerald-500 w-5' : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* STATS INFOGRAPH (Hidden in Public mode) */}
      {!isPublic && (
        currentPublicationsCount === 0 && currentPhotosCount === 0 && currentVideosCount === 0 ? (
          <div className="bg-[#101714] p-6 rounded-xl border border-zinc-850 text-center space-y-1.5 shadow-md animate-fadeIn" id="mural-stats-block">
            <div className="text-xl">🏛️</div>
            <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Museu em Construção</h4>
            <p className="text-zinc-500 text-xs font-mono">Nenhuma memória registrada até o momento.</p>
          </div>
        ) : (
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
        )
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
        <div className="text-center py-20 rounded-2xl border border-dashed border-zinc-800 bg-[#111815]/15 max-w-xl mx-auto p-8 space-y-4 shadow-xl animate-fadeIn">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-400 mx-auto text-2xl">
            🏛️
          </div>
          <div className="space-y-1.5">
            <h3 className="text-white font-display font-extrabold text-base md:text-lg tracking-tight uppercase">
              🏛 O Museu ainda está sendo construído.
            </h3>
            <p className="text-zinc-400 text-xs md:text-sm font-medium">
              Toda grande história começa com um primeiro capítulo.
            </p>
            <p className="text-zinc-500 text-[11px] md:text-xs">
              Publique fotos, vídeos e momentos marcantes para eternizar a história do clube.
            </p>
          </div>
          
          <button
            type="button"
            onClick={() => {
              if (!isPublic && currentUser) {
                setMuseuTab('memorias');
                setMuralSubTab('memorias');
                setExpandedSection('memoria');
                setIsUploadOpen(true);
              } else {
                alert('Faça login na plataforma para publicar memórias no Museu!');
              }
            }}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs inline-flex items-center gap-2 shadow-lg shadow-emerald-600/15 transition cursor-pointer"
          >
            <span>📸 Publicar Primeira Memória</span>
          </button>
        </div>
      ) : activeAlbumDate ? (
        <div className="space-y-6">
          {/* Album header metadata & Return controls button */}
          <div className="space-y-3">
            <button
              onClick={() => setActiveAlbumDate(null)}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 w-auto hover:text-white border border-zinc-850 text-zinc-350 font-bold font-mono text-xs flex items-center gap-1.5 rounded-xl transition cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-emerald-450" />
              <span>Voltar para Álbuns</span>
            </button>

            <div className="p-4 rounded-xl bg-[#0e1411] border border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-white font-display font-extrabold text-sm uppercase tracking-wider flex items-center gap-2">
                  <span>📅 Álbum de {activeAlbumDate.split('-').reverse().join('/')}</span>
                </h3>
                <p className="text-zinc-500 text-xs font-mono">
                  Mostrando {activeSlideshowList.length} mídias capturadas e publicadas nesta data específica do jogo.
                </p>
              </div>
              <div className="text-[10px] font-bold font-mono px-3 py-1 bg-[#22c55e]/10 text-emerald-400 border border-emerald-580 rounded-md self-start sm:self-auto uppercase">
                Visualizando Álbum
              </div>
            </div>
          </div>

          {/* Album items sub-grid content mapping */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedAlbumList.map((post) => (
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
                      src={post.mediaUrl || undefined}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full relative flex items-center justify-center">
                      <video
                        src={post.mediaUrl || undefined}
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
                  <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5 z-10 text-[9px] font-mono select-none">
                    {post.origin === 'automatic' ? (
                      <span className="bg-emerald-950/90 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                        🤖 Registro Automático
                      </span>
                    ) : (
                      <span className="bg-zinc-950/85 backdrop-blur-md text-zinc-300 font-bold px-2.5 py-0.5 rounded-full border border-zinc-800 uppercase tracking-wider">
                        {post.category}
                      </span>
                    )}
                    
                    {post.showOnLanding && (
                      <span className="bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1 uppercase tracking-wider font-mono">
                        <Star className="w-3 h-3 fill-zinc-950" />
                        Capa
                      </span>
                    )}

                    {post.isHighlighted && (
                      <span className="bg-emerald-500 text-zinc-950 font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1 uppercase tracking-wider font-mono">
                        <Award className="w-3 h-3 fill-zinc-950 text-zinc-950" />
                        Destaque Mural
                      </span>
                    )}
                  </div>

                  {/* Play duration indicator if video */}
                  {post.mediaType === 'video' && (
                    <div className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-zinc-400 font-mono font-semibold uppercase flex items-center gap-1 leading-none">
                      <Film className="w-2.5 h-2.5" />
                      <span>VÍDEO</span>
                    </div>
                  )}
                </div>

                {/* Details info section */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mb-2">
                    <span className="font-bold text-zinc-300 text-[11px] truncate uppercase">{post.authorName}</span>
                    <span>•</span>
                    <span>{post.eventDate ? post.eventDate.split('-').reverse().join('/') : new Date(post.createdAt).toLocaleDateString('pt-BR')}</span>
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

                      {/* Admin Toggle Actions: separating Landing vs Mural header */}
                      {currentUser && currentUser.role === 'admin' && (
                        <>
                          <button
                            onClick={() => handleToggleLanding(post.id)}
                            className={`p-1.5 border rounded-lg transition ${
                              post.showOnLanding
                                ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                                : 'bg-zinc-900 hover:bg-amber-950/20 border-zinc-850 text-zinc-500 hover:text-amber-400'
                            }`}
                            title="Destacar na Tela Inicial (Capa)"
                          >
                            <Star className={`w-3.5 h-3.5 ${post.showOnLanding ? 'fill-amber-400' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleToggleHighlight(post.id)}
                            className={`p-1.5 border rounded-lg transition ${
                              post.isHighlighted
                                ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                                : 'bg-zinc-900 hover:bg-emerald-950/20 border-zinc-850 text-zinc-500 hover:text-emerald-400'
                            }`}
                            title="Destacar no Mural (Topo)"
                          >
                            <Award className={`w-3.5 h-3.5 ${post.isHighlighted ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                          </button>
                        </>
                      )}

                      {/* Delete Admin */}
                      {!isPublic && currentUser && currentUser.role === 'admin' && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-1.5 bg-zinc-900 hover:bg-rose-955/20 text-zinc-500 hover:text-rose-450 border border-zinc-855 rounded-lg transition"
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

          {/* Pagination Controls for Album */}
          {Math.ceil(activeSlideshowList.length / 10) > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-900 pt-6 mt-4">
              <span className="text-xs text-zinc-500 font-mono">
                Página <strong className="text-zinc-350">{albumPage}</strong> de <strong className="text-zinc-350">{Math.ceil(activeSlideshowList.length / 10)}</strong> ({activeSlideshowList.length} itens)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={albumPage === 1}
                  onClick={() => setAlbumPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-850 disabled:hover:bg-zinc-900 text-zinc-350 hover:text-white rounded-lg text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-emerald-450" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  disabled={albumPage === Math.ceil(activeSlideshowList.length / 10)}
                  onClick={() => setAlbumPage(prev => Math.min(Math.ceil(activeSlideshowList.length / 10), prev + 1))}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-850 disabled:hover:bg-zinc-900 text-zinc-350 hover:text-white rounded-lg text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-4 h-4 text-emerald-450" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Display feed categorized with Grouped Albums if multiple uploads share date, or singular post cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedDateKeys.map((dateStr) => {
            const postsForDate = groupedByDateMap[dateStr];
            
            // IF MULTIPLE ASSETS EXIST FOR THE CURRENT DATE, COMPILE THEM INTO AN ALBUM CARD
            if (postsForDate.length > 1) {
              const albumTitle = postsForDate[0].title.replace(/\s?\(\d+\/\d+\)$/, '');
              const albumDesc = postsForDate[0].description || 'Compilado coletivo de mídias e registro de momentos do grupo.';
              const formattedDateStr = dateStr.split('-').reverse().join('/');
              
              return (
                <div
                  key={`album-${dateStr}`}
                  onClick={() => setActiveAlbumDate(dateStr)}
                  className="bg-[#0f1512] border border-zinc-900 rounded-xl overflow-hidden hover:border-emerald-555/30 transition flex flex-col group relative pt-3 px-1 cursor-pointer"
                >
                  {/* Visual photograph stacked layering cards effect */}
                  <div className="absolute top-1.5 left-4 right-4 h-[178px] bg-[#14201a] border border-zinc-850/80 rounded-xl -z-10 transition-transform group-hover:-translate-y-1.5 duration-200"></div>
                  <div className="absolute top-0 left-6 right-6 h-[178px] bg-[#1b2f25] border border-zinc-800/80 rounded-xl -z-20 transition-transform group-hover:-translate-y-2.5 duration-300"></div>

                  {/* Album Cover wrapper */}
                  <div className="h-[180px] bg-zinc-950 overflow-hidden relative rounded-lg border border-zinc-900/50">
                    {postsForDate[0].mediaType === 'image' ? (
                      <img
                        src={postsForDate[0].mediaUrl || undefined}
                        alt="Album Cover"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full relative flex items-center justify-center">
                        <video src={postsForDate[0].mediaUrl || undefined} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                          <Play className="w-6 h-6 text-emerald-400 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Floating Date Badge */}
                    <div className="absolute top-2.5 left-2.5 bg-[#090e0c]/90 backdrop-blur-md text-[#22c55e] text-[9.5px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-zinc-800">
                      📆 {formattedDateStr}
                    </div>

                    {/* Highlighted Album Counter Badge */}
                    <div className="absolute bottom-2.5 right-2.5 bg-emerald-600 font-mono text-[9px] font-bold px-2.5 py-1 text-white rounded-md shadow-lg uppercase flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      <span>{postsForDate.length} mídias</span>
                    </div>
                  </div>

                  {/* Folder Details metadata block */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-1">
                      <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-white group-hover:text-emerald-400 transition line-clamp-1">
                        Álbum: {albumTitle}
                      </h3>
                      <p className="text-zinc-500 text-xs line-clamp-2 leading-relaxed">
                        {albumDesc}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-zinc-900/60 flex items-center justify-between text-[10px] font-mono text-zinc-500">
                      <span className="truncate">Por: <strong>{postsForDate[0].authorName}</strong></span>
                      <span className="text-emerald-400 font-bold hover:underline">Abrir Álbum &rarr;</span>
                    </div>
                  </div>
                </div>
              );
            }

            // IF ONLY SINGLE POST HAS THIS DATE KEY, RENDER IT AS A STANDALONE POST CARD
            const post = postsForDate[0];
            const formattedDateStr = dateStr.split('-').reverse().join('/');
            
            return (
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
                      src={post.mediaUrl || undefined}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full relative flex items-center justify-center">
                      <video
                        src={post.mediaUrl || undefined}
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
                  <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5 z-10 text-[9px] font-mono select-none">
                    {post.origin === 'automatic' ? (
                      <span className="bg-emerald-950/90 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider flex items-center gap-1">
                        🤖 Registro Automático
                      </span>
                    ) : (
                      <span className="bg-zinc-950/85 backdrop-blur-md text-zinc-300 font-bold px-2.5 py-0.5 rounded-full border border-zinc-800 uppercase tracking-wider">
                        {post.category}
                      </span>
                    )}
                    
                    {post.showOnLanding && (
                      <span className="bg-amber-500 text-zinc-950 font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1 uppercase tracking-wider font-mono">
                        <Star className="w-3 h-3 fill-zinc-950" />
                        Capa
                      </span>
                    )}

                    {post.isHighlighted && (
                      <span className="bg-emerald-500 text-zinc-950 font-black px-2 py-0.5 rounded-full shadow flex items-center gap-1 uppercase tracking-wider font-mono">
                        <Award className="w-3 h-3 fill-zinc-950 text-zinc-950" />
                        Destaque Mural
                      </span>
                    )}
                  </div>

                  {/* Play duration indicator if video */}
                  {post.mediaType === 'video' && (
                    <div className="absolute bottom-2 right-2 bg-black/75 px-1.5 py-0.5 rounded text-[8px] text-zinc-400 font-mono font-semibold uppercase flex items-center gap-1 leading-none">
                      <Film className="w-2.5 h-2.5" />
                      <span>VÍDEO</span>
                    </div>
                  )}
                </div>

                {/* Details text labels */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono mb-2">
                    <span className="font-bold text-zinc-300 text-[11px] truncate uppercase">{post.authorName}</span>
                    <span>•</span>
                    <span>{formattedDateStr}</span>
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
                    <div className="mt-3 py-1 px-2 border border-zinc-905 bg-zinc-950/65 rounded text-[9px] font-mono text-zinc-400 flex items-center gap-1">
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

                      {/* Admin Toggle Actions: separating Landing vs Mural header */}
                      {currentUser && currentUser.role === 'admin' && (
                        <>
                          <button
                            onClick={() => handleToggleLanding(post.id)}
                            className={`p-1.5 border rounded-lg transition ${
                              post.showOnLanding
                                ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                                : 'bg-zinc-900 hover:bg-amber-950/20 border-zinc-850 text-zinc-500 hover:text-amber-400'
                            }`}
                            title="Destacar na Tela Inicial (Capa)"
                          >
                            <Star className={`w-3.5 h-3.5 ${post.showOnLanding ? 'fill-amber-400' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleToggleHighlight(post.id)}
                            className={`p-1.5 border rounded-lg transition ${
                              post.isHighlighted
                                ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
                                : 'bg-zinc-900 hover:bg-emerald-950/20 border-zinc-850 text-zinc-500 hover:text-emerald-400'
                            }`}
                            title="Destacar no Mural (Topo)"
                          >
                            <Award className={`w-3.5 h-3.5 ${post.isHighlighted ? 'fill-emerald-400 text-emerald-400' : ''}`} />
                          </button>
                        </>
                      )}

                      {/* Delete Admin */}
                      {!isPublic && currentUser && currentUser.role === 'admin' && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="p-1.5 bg-zinc-900 hover:bg-rose-950/20 text-zinc-505 hover:text-rose-450 border border-zinc-850 rounded-lg transition"
                          title="Excluir do Mural"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          </div>

          {/* Pagination Controls for Memories Main Feed */}
          {Math.ceil(sortedDateKeys.length / 10) > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-900 pt-6 mt-4">
              <span className="text-xs text-zinc-500 font-mono">
                Página <strong className="text-zinc-350">{memoriesPage}</strong> de <strong className="text-zinc-350">{Math.ceil(sortedDateKeys.length / 10)}</strong> ({sortedDateKeys.length} álbuns/postagens)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={memoriesPage === 1}
                  onClick={() => setMemoriesPage(prev => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-850 disabled:hover:bg-zinc-900 text-zinc-350 hover:text-white rounded-lg text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-emerald-450" />
                  <span>Anterior</span>
                </button>
                <button
                  type="button"
                  disabled={memoriesPage === Math.ceil(sortedDateKeys.length / 10)}
                  onClick={() => setMemoriesPage(prev => Math.min(Math.ceil(sortedDateKeys.length / 10), prev + 1))}
                  className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-850 disabled:hover:bg-zinc-900 text-zinc-350 hover:text-white rounded-lg text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer"
                >
                  <span>Próximo</span>
                  <ChevronRight className="w-4 h-4 text-emerald-450" />
                </button>
              </div>
            </div>
          )}
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
                  {selectedPost.origin === 'automatic' ? (
                    <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-500/20 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      🤖 Registro Automático
                    </span>
                  ) : (
                    <span className="text-[10px] bg-zinc-900 text-zinc-400 font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                      {selectedPost.category}
                    </span>
                  )}
                  {activeSlideshowList.length > 1 && (
                    <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded border border-emerald-500/20 tracking-wider uppercase font-mono">
                      {activeSlideshowList.findIndex(p => p.id === selectedPost.id) + 1} / {activeSlideshowList.length}
                    </span>
                  )}
                  {selectedPost.showOnLanding && (
                    <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/20 tracking-wider uppercase font-mono flex items-center gap-1">
                      ⭐ Destacado na Tela Inicial
                    </span>
                  )}
                </div>

                <button
                  onClick={() => setSelectedPost(null)}
                  className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-zinc-855 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable contents wrapper */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                
                {/* Visual Cover Screen */}
                <div 
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className="w-full h-[280px] md:h-[360px] bg-zinc-950 rounded-xl overflow-hidden relative border border-zinc-900 flex items-center justify-center select-none group"
                >
                  {/* Left navigation overlay button */}
                  {activeSlideshowList.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePrevPost(); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-[#22c55e]/90 hover:scale-105 border border-zinc-800 hover:border-emerald-400 rounded-full text-white transition z-20 flex items-center justify-center opacity-75 group-hover:opacity-100"
                      title="Item Anterior"
                    >
                      <ChevronLeft className="w-5 h-5 pointer-events-none" />
                    </button>
                  )}

                  {selectedPost.mediaType === 'image' ? (
                    <img 
                      src={selectedPost.mediaUrl || undefined} 
                      alt={selectedPost.title} 
                      className="w-full h-full object-contain pointer-events-none select-none"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <video 
                      src={selectedPost.mediaUrl || undefined}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  )}

                  {/* Right navigation overlay button */}
                  {activeSlideshowList.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleNextPost(); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-[#22c55e]/90 hover:scale-105 border border-zinc-800 hover:border-emerald-400 rounded-full text-white transition z-20 flex items-center justify-center opacity-75 group-hover:opacity-100"
                      title="Próximo Item"
                    >
                      <ChevronRight className="w-5 h-5 pointer-events-none" />
                    </button>
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
                      <div className="flex items-center justify-between gap-2 text-xs text-zinc-300 font-mono flex-wrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-500" />
                          <span>
                            {selectedPost.matchId 
                              ? `Partida do ${appName}`
                              : `Confraternização / Evento do Grupo`}
                          </span>
                        </div>
                        {selectedPost.matchId && (
                          <button
                            onClick={() => {
                              setSelectedPost(null);
                              window.dispatchEvent(new CustomEvent('set-active-tab', { detail: 'calendar' }));
                            }}
                            className="text-[10px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded px-2 py-0.5 font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            ⚽ Ir para a Partida
                          </button>
                        )}
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
                        setEditShowOnLanding(selectedPost.showOnLanding === true);
                        setEditIsHighlighted(selectedPost.isHighlighted === true);
                        setEditEventDate(selectedPost.eventDate || selectedPost.createdAt.split('T')[0]);
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
                  className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-zinc-850 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUploadSubmit} className="overflow-y-auto flex-1 p-5 space-y-5">
                
                {/* 1. Arquivos (Área de upload) */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition relative flex flex-col items-center justify-center min-h-[140px] cursor-pointer ${
                    dragActive 
                      ? 'border-[#22c55e] bg-emerald-500/5' 
                      : uploadItems.length > 0 
                        ? 'border-zinc-850 bg-zinc-950/40' 
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
                      <p className="text-xs font-bold text-white">Arraste e solte ou toque para selecionar arquivos</p>
                      <p className="text-[10px] text-zinc-500 mt-1">Selecione fotos e/ou vídeos do racha</p>
                    </div>
                    <div className="text-[9px] font-mono text-zinc-500 bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-900 inline-block uppercase tracking-wide">
                      Múltiplas mídias permitidas
                    </div>
                  </div>
                </div>

                {/* Resumo do Upload com Miniaturas */}
                {uploadItems.length > 0 && (
                  <div className="space-y-3.5 p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-900 font-sans">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2.5">
                      <div className="space-y-1">
                        <span className="block text-xs font-bold text-white uppercase tracking-wider font-mono">
                          Arquivos Selecionados ({uploadItems.length})
                        </span>
                        <div className="flex flex-col gap-1 text-xs text-zinc-300 font-sans mt-0.5">
                          {uploadItems.filter(item => item.file.type.startsWith('image/')).length > 0 && (
                            <span className="flex items-center gap-1.5 font-bold text-white">
                              📷 {uploadItems.filter(item => item.file.type.startsWith('image/')).length} {uploadItems.filter(item => item.file.type.startsWith('image/')).length === 1 ? 'foto selecionada' : 'fotos selecionadas'}
                            </span>
                          )}
                          {uploadItems.filter(item => item.file.type.startsWith('video/')).length > 0 && (
                            <span className="flex items-center gap-1.5 font-bold text-white">
                              🎥 {uploadItems.filter(item => item.file.type.startsWith('video/')).length} {uploadItems.filter(item => item.file.type.startsWith('video/')).length === 1 ? 'vídeo selecionado' : 'vídeos selecionados'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUploadItems([])}
                        className="text-[11px] text-rose-400 hover:text-rose-300 font-mono font-bold min-h-[44px] px-2.5"
                      >
                        Limpar Tudo
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
                      {uploadItems.map((item) => (
                        <div 
                          key={item.id} 
                          className="flex items-center gap-2.5 bg-zinc-950 border border-zinc-850 rounded-lg p-2 text-xs"
                        >
                          <div className="w-8 h-8 bg-zinc-900 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative border border-zinc-800">
                            {item.file.type.startsWith('image/') ? (
                              <img src={item.preview || undefined} alt="Mini preview" className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-3.5 h-3.5 text-[#22c55e]" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0 font-mono text-[9px]">
                            <p className="text-white font-bold truncate max-w-[130px]" title={item.file.name}>
                              {item.file.name}
                            </p>
                            <span className="text-zinc-500 text-[8px]">
                              {(item.originalSize / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setUploadItems(prev => prev.filter(x => x.id !== item.id))}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 rounded transition"
                            title="Remover"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Form fields in clean vertical block layout (all full-width) */}
                <div className="space-y-4 font-sans text-xs text-zinc-300">
                  
                  {/* 2. Título */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide">Título da Publicação *</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Ex: Gol do João, Racha de Quinta, Churrasco da Resenha..."
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-3 text-sm text-white rounded-xl focus:outline-none focus:border-[#22c55e] transition min-h-[44px]"
                    />
                  </div>

                  {/* 3. Categoria */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide">Categoria *</label>
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-3 text-sm text-zinc-300 rounded-xl focus:outline-none cursor-pointer min-h-[44px] transition focus:border-[#22c55e]"
                    >
                      <option value="partida">Partida</option>
                      <option value="evento">Evento</option>
                      <option value="resenha">Resenha</option>
                      <option value="livre">Livre</option>
                    </select>
                  </div>

                  {/* 4. Relacionado a (Opcional) */}
                  {(associations.matches?.length > 0 || associations.events?.length > 0) && (
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-white uppercase tracking-wide">Relacionado a (Opcional)</label>
                      <select
                        value={formAssociation}
                        onChange={(e) => setFormAssociation(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-850 px-3 py-3 text-sm text-zinc-300 rounded-xl focus:outline-none cursor-pointer min-h-[44px] transition focus:border-[#22c55e]"
                      >
                        <option value="">Nenhum (não associar)</option>
                        {associations.matches?.length > 0 && (
                          <optgroup label="Partidas anteriores">
                            {associations.matches.slice(0, 10).map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {associations.events?.length > 0 && (
                          <optgroup label="Eventos coletivos">
                            {associations.events.slice(0, 10).map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>
                  )}

                  {/* 5. Data */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide">Data do Evento ou Foto *</label>
                    <input
                      type="date"
                      required
                      value={formEventDate}
                      onChange={(e) => setFormEventDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-3 text-sm text-white rounded-xl focus:outline-none focus:border-[#22c55e] transition min-h-[44px]"
                    />
                  </div>

                  {/* 6. Descrição */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-white uppercase tracking-wide">Descrição (Opcional)</label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Conte um pouco sobre este momento..."
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-850 px-3 py-3 text-sm text-white rounded-xl focus:outline-none focus:border-[#22c55e] transition"
                    />
                  </div>

                  {/* 7. Destaque */}
                  <div className="space-y-3">
                    <span className="block text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      7. Destaque
                    </span>

                    <div className="grid grid-cols-1 gap-3">
                      {/* Checkbox: Landing Screen */}
                      <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-900 flex items-center justify-between gap-4">
                        <div className="space-y-1 pr-2">
                          <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5 selection:bg-transparent">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            ⭐ Destacar na Tela Inicial
                          </span>
                          <span className="block text-[10px] text-zinc-400 leading-normal">
                            Esta publicação poderá aparecer na capa do sistema antes do login.
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                          <input
                            type="checkbox"
                            checked={formShowOnLanding}
                            onChange={(e) => setFormShowOnLanding(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white inline-block"></div>
                        </label>
                      </div>

                      {/* Checkbox: Pinned to Mural (Admin only) */}
                      {currentUser?.role === 'admin' && (
                        <div className="p-3.5 bg-zinc-950/60 rounded-xl border border-zinc-900 flex items-center justify-between gap-4">
                          <div className="space-y-1 pr-2">
                            <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5 selection:bg-transparent">
                              <Award className="w-3.5 h-3.5 text-emerald-400" />
                              📌 Destacar no Mural
                            </span>
                            <span className="block text-[10px] text-zinc-400 leading-normal">
                              Esta publicação aparecerá no banner de destaques no topo do mural (máximo 3).
                            </span>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                            <input
                              type="checkbox"
                              checked={formIsHighlighted}
                              onChange={(e) => setFormIsHighlighted(e.target.checked)}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white inline-block"></div>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Submitting Actions */}
                <div className="pt-3 flex gap-3 font-sans text-xs uppercase font-bold select-none">
                  <button
                    type="button"
                    onClick={() => { setIsUploadOpen(false); resetUploadForm(); }}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition cursor-pointer text-center min-h-[44px]"
                  >
                    Voltar
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading || uploadItems.length === 0 || !formTitle}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-white disabled:text-zinc-500 rounded-xl shadow-lg shadow-emerald-500/10 transition cursor-pointer text-center flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    {actionLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Publicando...</span>
                      </>
                    ) : (
                      <span>📤 Publicar no Mural</span>
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
                <button
                  type="button"
                  onClick={() => { setIsEditOpen(false); setPostToEdit(null); }}
                  className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition cursor-pointer -mr-2.5"
                >
                  <X className="w-4 h-4" />
                </button>
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

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-white uppercase">Data do Evento / Foto *</label>
                  <input
                    type="date"
                    required
                    value={editEventDate}
                    onChange={(e) => setEditEventDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 px-3 py-2 text-white rounded-lg focus:outline-none focus:border-[#22c55e]"
                  />
                </div>

                 {/* Destacar Options toggles */}
                 <div className="space-y-3">
                   {/* Checkbox: Landing Screen */}
                   <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900 flex items-center justify-between gap-4">
                     <div className="space-y-0.5 pr-2">
                       <span className="block text-[11px] font-bold text-white uppercase flex items-center gap-1.5 selection:bg-transparent">
                         <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                         ⭐ Destacar na Tela Inicial
                       </span>
                       <span className="block text-[9px] text-zinc-500 leading-normal font-sans">
                         Esta publicação poderá aparecer na capa do {appName} antes do login.
                       </span>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                       <input
                         type="checkbox"
                         checked={editShowOnLanding}
                         onChange={(e) => setEditShowOnLanding(e.target.checked)}
                         className="sr-only peer"
                       />
                       <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white inline-block"></div>
                     </label>
                   </div>

                   {/* Checkbox: Pinned to Mural (Admin only) */}
                   {currentUser?.role === 'admin' && (
                     <div className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900 flex items-center justify-between gap-4">
                       <div className="space-y-0.5 pr-2">
                         <span className="block text-[11px] font-bold text-white uppercase flex items-center gap-1.5 selection:bg-transparent">
                           <Award className="w-3.5 h-3.5 text-emerald-400" />
                           📌 Destacar no Mural
                         </span>
                         <span className="block text-[9px] text-zinc-500 leading-normal font-sans">
                           Esta publicação aparecerá no topo do mural (máximo 3).
                         </span>
                       </div>
                       <label className="relative inline-flex items-center cursor-pointer min-h-[44px]">
                         <input
                           type="checkbox"
                           checked={editIsHighlighted}
                           onChange={(e) => setEditIsHighlighted(e.target.checked)}
                           className="sr-only peer"
                         />
                         <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 peer-checked:after:bg-white inline-block"></div>
                       </label>
                     </div>
                   )}
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

      {/* CUSTOM STATE-BASED CONFIRM ROUTE MODAL */}
      <AnimatePresence>
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fadeIn">
            <div className="bg-[#090e0c] border border-zinc-900 rounded-xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative">
              <div className="mx-auto w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-white font-display font-extrabold text-base uppercase tracking-wider">
                  Confirmar Exclusão
                </h4>
                <p className="text-zinc-400 text-xs font-mono">
                  Deseja excluir de forma permanente esta publicação? Esta ação é irreversível.
                </p>
              </div>
              
              <div className="flex gap-3 pt-2 font-mono text-xs uppercase font-bold select-none">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg border border-zinc-850 transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeDeletePost}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition flex items-center justify-center gap-1.5"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>Excluir</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

  return (
    <div className="space-y-6 animate-fadeIn font-sans" id="mural-viewport">
      
      {/* Capa & Hero do Museu */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-zinc-850/60 shadow-2xl mb-6">
        {/* Capa Image Background */}
        <div className="absolute inset-0 z-0">
          <img
            src={capaImageUrl}
            alt="Capa do Museu"
            className="w-full h-full object-cover brightness-[0.25] contrast-[1.05]"
            referrerPolicy="no-referrer"
          />
          {/* Gradient overlay to ensure superb text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#090e0c] via-black/35 to-black/75" />
        </div>

        {/* Hero Content */}
        <div className="relative z-10 px-6 py-10 md:py-14 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-sans font-extrabold uppercase tracking-widest select-none">
              🏛️ Acervo Oficial do Clube
            </div>
            <h1 className="font-display font-black text-3xl md:text-4xl text-white tracking-tight leading-none uppercase">
              🏛️ Museu do Clube
            </h1>
            <p className="text-zinc-300 text-xs md:text-sm leading-relaxed font-sans">
              O acervo vivo das histórias, resenhas e momentos do {appName}.
            </p>
          </div>

          {/* Quick Summary Statistics Grid */}
          <div className="grid grid-cols-2 gap-3 min-w-[280px] sm:min-w-[340px] font-sans">
            <div className="p-3 bg-zinc-950/75 border border-zinc-900/60 rounded-xl backdrop-blur-md flex items-center gap-2.5 shadow-lg">
              <span className="text-lg">📸</span>
              <div>
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Memórias</span>
                <span className="block text-sm font-black text-white">{currentPublicationsCount}</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-950/75 border border-zinc-900/60 rounded-xl backdrop-blur-md flex items-center gap-2.5 shadow-lg">
              <span className="text-lg">🎥</span>
              <div>
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Vídeos</span>
                <span className="block text-sm font-black text-white">{currentVideosCount}</span>
              </div>
            </div>

            <div className="p-3 bg-zinc-950/75 border border-zinc-900/60 rounded-xl backdrop-blur-md flex items-center gap-2.5 shadow-lg">
              <span className="text-lg">⚽</span>
              <div>
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Rodadas</span>
                <span className="block text-sm font-black text-white">
                  {fullMatches.length}
                </span>
              </div>
            </div>

            <div className="p-3 bg-zinc-950/75 border border-zinc-900/60 rounded-xl backdrop-blur-md flex items-center gap-2.5 shadow-lg">
              <span className="text-lg">🏆</span>
              <div>
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-wider">Épicos</span>
                <span className="block text-sm font-black text-white">
                  {posts.filter(p => (p.isHighlighted === true || p.showOnLanding === true) && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Compact publish and header row */}
      {!isPublic && currentUser && (
        <div className="flex justify-end items-center gap-4 pb-1">
          {/* Compact publish dropdown picker */}
          <div className="relative w-full sm:w-auto font-sans">
            {currentUser.role === 'admin' ? (
              <>
                <button
                  type="button"
                  id="btn-publish-dropdown-toggle"
                  onClick={() => setIsPublishDropdownOpen(!isPublishDropdownOpen)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Publicar no Museu</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {isPublishDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsPublishDropdownOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 py-1.5 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => handleDropdownOptionClick('regra')}
                        className="w-full text-left px-4 py-3 sm:py-2 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                        <span>📌 Nova Regra</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDropdownOptionClick('aviso')}
                        className="w-full text-left px-4 py-3 sm:py-2 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Megaphone className="w-3.5 h-3.5 text-emerald-500" />
                        <span>📢 Novo Aviso</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDropdownOptionClick('comunicado')}
                        className="w-full text-left px-4 py-3 sm:py-2 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        <span>📅 Novo Comunicado</span>
                      </button>
                      <div className="border-t border-zinc-800/80 my-1"></div>
                      <button
                        type="button"
                        onClick={() => handleDropdownOptionClick('memoria')}
                        className="w-full text-left px-4 py-3 sm:py-2 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center gap-2.5 transition cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5 text-emerald-500" />
                        <span>📷 Nova Foto / Vídeo</span>
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMuseuTab('memorias');
                  setIsUploadOpen(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md hover:shadow-lg transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Enviar Foto / Vídeo</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs Navigation Selector - Swipeable/Scrollable on mobile, Clean list on desktop */}
      <div className="sticky top-0 bg-[#090e0c]/95 backdrop-blur-md py-3 z-30 border-b border-zinc-900/60 -mx-4 px-4 sm:mx-0 sm:px-0">
        <ResponsiveTabsContainer 
          activeTabId={`tab-museu-${museuTab}`}
          className="flex md:flex-nowrap gap-2 pb-1"
          noBorder={true}
        >
          <button
            type="button"
            id="tab-museu-memorias"
            onClick={() => {
              setMuseuTab('memorias');
              setMuralSubTab('memorias');
            }}
            className={`flex-auto sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
              museuTab === 'memorias'
                ? 'bg-emerald-600 text-white shadow-lg'
                : 'bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Memórias ({memoriesCount})</span>
          </button>

          <button
            type="button"
            id="tab-museu-momentos"
            onClick={() => {
              setMuseuTab('momentos');
            }}
            className={`flex-auto sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
              museuTab === 'momentos'
                ? 'bg-amber-600 text-white shadow-lg'
                : 'bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Star className="w-4 h-4" />
            <span>Momentos Épicos</span>
          </button>

          <button
            type="button"
            id="tab-museu-historia"
            onClick={() => {
              setMuseuTab('historia');
              setHistoryPage(1);
            }}
            className={`flex-auto sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
              museuTab === 'historia'
                ? 'bg-emerald-805/40 text-emerald-400 border border-emerald-500/20 shadow-lg'
                : 'bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>História do Clube</span>
          </button>

          <button
            type="button"
            id="tab-museu-comunicacao"
            onClick={() => {
              setMuseuTab('comunicacao');
              setMuralSubTab('comunicacao');
            }}
            className={`flex-auto sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
              museuTab === 'comunicacao'
                ? 'bg-[#1e3a2f] text-[#4ade80] border border-emerald-500/40'
                : 'bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Comunicação ({rulesCount + warningsCount + announcementsCount})</span>
          </button>

          {!isPublic && currentUser && (currentUser.role === 'admin' || currentUser.role === 'auxiliar') && (
            <button
              type="button"
              id="tab-museu-arquivo"
              onClick={() => {
                setMuseuTab('arquivo');
              }}
              className={`flex-auto sm:flex-initial px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                museuTab === 'arquivo'
                  ? 'bg-zinc-800 text-white shadow-lg'
                  : 'bg-zinc-950 border border-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Arquivo ({historyCount})</span>
            </button>
          )}
        </ResponsiveTabsContainer>
      </div>

      {/* Render selected content tab view */}
      <div className="space-y-6">
        {museuTab === 'memorias' && (
          <div className="space-y-4">
            {selectedHistoryMatchId && (
              <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between gap-3 text-emerald-400 animate-slideDown">
                <span className="font-mono flex items-center gap-1.5">
                  🔍 Filtrando fotos e vídeos de: <strong>Rodada de {
                    fullMatches.find(m => m.id === selectedHistoryMatchId)
                      ? new Date(fullMatches.find(m => m.id === selectedHistoryMatchId).date + 'T12:00:00').toLocaleDateString('pt-BR')
                      : 'Selecionada'
                  }</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedHistoryMatchId(null)}
                  className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-md border border-emerald-500/20 transition text-emerald-300 cursor-pointer"
                >
                  Limpar Filtro
                </button>
              </div>
            )}
            {renderMemoriesContent()}
          </div>
        )}

        {museuTab === 'momentos' && (
          <div className="space-y-6">
            {/* Header Area Premium style */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1c1404] via-[#090e0c] to-[#0d1210] border border-amber-500/30 rounded-2xl p-6 md:p-8 shadow-xl">
              {/* Decorative faint background glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                    ⭐️ GALERIA DE HONRA DO CLUBE ⭐️
                  </div>
                  <h2 className="font-display font-black text-2xl md:text-3xl text-amber-100 tracking-tight leading-none uppercase flex items-center gap-2">
                    🏆 HALL DA FAMA
                  </h2>
                  <p className="text-zinc-350 text-xs md:text-sm max-w-xl leading-relaxed">
                    Os acontecimentos históricos, as resenhas lendárias e os lances imortalizados que construíram a lenda do <strong className="text-amber-400">{appName}</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-zinc-950/60 border border-zinc-850 p-4 rounded-xl self-start md:self-auto backdrop-blur">
                  <Award className="w-10 h-10 text-amber-400 animate-pulse flex-shrink-0" />
                  <div className="font-mono">
                    <span className="block text-[10px] text-zinc-500 uppercase font-bold tracking-wider">Lendas Consagradas</span>
                    <strong className="block text-xl text-amber-450 font-extrabold leading-none mt-1">
                      {posts.filter(p => (p.isHighlighted === true || p.showOnLanding === true) && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted).length}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter posts that are marked highlighted or showOnLanding */}
            {posts.filter(p => (p.isHighlighted === true || p.showOnLanding === true) && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted).length === 0 ? (
              <div className="text-center py-12 bg-[#090e0c]/40 border border-zinc-900 rounded-xl max-w-md mx-auto space-y-3">
                <Star className="w-8 h-8 text-zinc-600 mx-auto opacity-40 animate-pulse" />
                <div className="space-y-0.5">
                  <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Nenhum Momento Marcado</p>
                  <p className="text-[10px] text-zinc-500 font-mono">Os lances e resenhas que receberem destaque dos administradores aparecerão consagrados aqui.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts
                  .filter(p => (p.isHighlighted === true || p.showOnLanding === true) && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted)
                  .map(post => {
                    // Dynamically map a visual title tag depending on its context
                    let badgeLabel = '🔥 Momento Épico';
                    let badgeStyle = 'from-amber-600/30 to-amber-900/20 text-amber-400 border-amber-500/30';
                    
                    if (post.title.toLowerCase().includes('clássico') || post.description?.toLowerCase().includes('clássico')) {
                      badgeLabel = '👑 Clássico Memorável';
                      badgeStyle = 'from-yellow-500/30 to-amber-600/20 text-amber-300 border-amber-500/40';
                    } else if (post.title.toLowerCase().includes('rodada') || post.category === 'partida') {
                      badgeLabel = '⚽ Grande Rodada';
                      badgeStyle = 'from-emerald-600/30 to-teal-900/20 text-emerald-400 border-emerald-500/30';
                    } else if (post.mediaType === 'image') {
                      badgeLabel = '📸 Foto Histórica';
                      badgeStyle = 'from-cyan-600/30 to-blue-900/20 text-cyan-300 border-cyan-500/30';
                    }

                    const formattedDateStr = post.eventDate 
                      ? post.eventDate.split('-').reverse().join('/') 
                      : new Date(post.createdAt).toLocaleDateString('pt-BR');

                    return (
                      <div
                        key={`highlight-${post.id}`}
                        className="bg-[#0b100e] border-2 border-amber-500/25 rounded-2xl overflow-hidden hover:border-amber-400/60 shadow-xl hover:shadow-amber-500/5 transition duration-500 flex flex-col group relative"
                      >
                        {/* Shimmer overlay for extra premium styling */}
                        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none" />

                        <div
                          onClick={() => setSelectedPost(post)}
                          className="h-[210px] bg-zinc-950 overflow-hidden relative cursor-pointer"
                        >
                          {post.mediaType === 'image' ? (
                            <img
                              src={post.mediaUrl || undefined}
                              alt={post.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full relative flex items-center justify-center">
                              <video
                                src={post.mediaUrl || undefined}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="bg-amber-500 p-2.5 rounded-full text-zinc-950 shadow-lg">
                                  <Play className="w-4 h-4 fill-current ml-0.5" />
                                </div>
                              </div>
                            </div>
                          )}

                          <div className={`absolute top-3 left-3 bg-gradient-to-r ${badgeStyle} text-[10px] font-sans font-black px-3 py-1 rounded-full border shadow-md uppercase tracking-wider`}>
                            {badgeLabel}
                          </div>

                          <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur border border-amber-500/30 p-1.5 rounded-full text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                          </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between bg-gradient-to-b from-zinc-950 to-[#0e1411]">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[10px] text-zinc-550 font-mono">
                              <span className="font-extrabold text-amber-400 uppercase">{post.authorName}</span>
                              <span>•</span>
                              <span>{formattedDateStr}</span>
                            </div>
                            <h4
                              onClick={() => setSelectedPost(post)}
                              className="font-display font-black text-base text-zinc-100 tracking-tight hover:text-amber-400 cursor-pointer transition line-clamp-1 uppercase"
                            >
                              {post.title}
                            </h4>
                            <p className="text-zinc-400 text-xs leading-relaxed line-clamp-3">
                              {post.description || 'Nenhuma descrição detalhada informada.'}
                            </p>
                          </div>

                          <div className="mt-5 pt-3 border-t border-zinc-900/60 flex items-center justify-between text-[11px] font-mono">
                            <button
                              onClick={() => setSelectedPost(post)}
                              className="text-amber-450 hover:text-amber-350 hover:underline uppercase text-[9.5px] font-bold tracking-wider"
                            >
                              Ver Detalhes &rarr;
                            </button>

                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleShareWhatsApp(post)}
                                className="p-1.5 bg-zinc-950 hover:bg-emerald-950/20 text-zinc-400 hover:text-emerald-400 border border-zinc-850 rounded-lg transition"
                                title="Compartilhar"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              
                              {/* Only Admin can edit/remove highlights */}
                              {currentUser?.role === 'admin' && (
                                <button
                                  onClick={() => handleToggleHighlight(post.id)}
                                  className="p-1.5 bg-zinc-950 hover:bg-amber-950/20 text-yellow-550 hover:text-zinc-400 border border-zinc-850 rounded-lg transition"
                                  title="Remover Categoria de Destaque"
                                >
                                  <Star className="w-3.5 h-3.5 fill-yellow-550 text-yellow-550" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {museuTab === 'historia' && (
          <div className="space-y-6">
            <div className="relative overflow-hidden bg-gradient-to-r from-[#0d1612] to-[#090e0c] border border-emerald-500/25 rounded-2xl p-5 md:p-6 shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-3 relative z-10">
                <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-base text-white uppercase tracking-wider">
                    📜 HISTÓRIA DO CLUBE
                  </h3>
                  <p className="text-zinc-400 text-xs font-mono">
                    A trajetória rodada a rodada do {appName}, seus placares lendários e mídias associadas.
                  </p>
                </div>
              </div>
            </div>

            {fullMatches.length === 0 ? (
              <div className="text-center py-12 bg-[#090e0c]/40 border border-zinc-900 rounded-xl max-w-sm mx-auto space-y-2">
                <Calendar className="w-6 h-6 text-zinc-650 mx-auto opacity-35 animate-bounce" />
                <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">Sem Histórico de Rodadas</p>
                <p className="text-[10px] text-zinc-500 font-mono">Nenhuma rodada foi sorteada ou encerrada nesta temporada.</p>
              </div>
            ) : (
              <div className="space-y-6 max-w-3xl mx-auto">
                {(() => {
                  // Rodadas concluídas/canceladas vão para o final, para as próximas
                  // rodadas relevantes ficarem sempre visíveis primeiro na paginação.
                  // Ordenação original (createdAt/date ascendente) preservada dentro de cada bloco.
                  const isFinishedRound = (m: any) => m.status === 'encerrada' || m.status === 'cancelada';
                  const sortedMatches = [...fullMatches].sort((a, b) => {
                    const aFinished = isFinishedRound(a);
                    const bFinished = isFinishedRound(b);
                    if (aFinished !== bFinished) return aFinished ? 1 : -1;

                    const createdDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    if (createdDiff !== 0) return createdDiff;
                    return a.date.localeCompare(b.date);
                  });

                  const itemsPerPage = 5;
                  const totalPages = Math.ceil(sortedMatches.length / itemsPerPage);
                  const safeHistoryPage = Math.min(Math.max(1, historyPage), totalPages || 1);
                  const startIndex = (safeHistoryPage - 1) * itemsPerPage;
                  const endIndex = startIndex + itemsPerPage;
                  const paginatedMatches = sortedMatches.slice(startIndex, endIndex);

                  const matchesByYear: { [year: string]: typeof fullMatches } = {};
                  paginatedMatches.forEach(match => {
                    const year = match.date ? match.date.split('-')[0] : '2026';
                    if (!matchesByYear[year]) {
                      matchesByYear[year] = [];
                    }
                    matchesByYear[year].push(match);
                  });

                   const sortedYears = Object.keys(matchesByYear).sort((a, b) => a.localeCompare(b));

                  return (
                    <>
                      <div className="space-y-10">
                        {sortedYears.map((year) => (
                          <div key={year} className="space-y-6 relative">
                            {/* Year Header Indicator */}
                            <div className="flex items-center gap-3 pt-4">
                              <div className="px-4 py-1.5 bg-gradient-to-r from-zinc-950 via-[#0e1612] to-zinc-950 border border-emerald-500/30 text-emerald-300 font-display font-black text-sm tracking-widest uppercase rounded-xl shadow-md flex items-center gap-2.5">
                                <span>📅 {year}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-[10px] font-mono text-zinc-500 lowercase bg-zinc-900/80 px-2 py-0.5 rounded border border-zinc-850">
                                  {matchesByYear[year].length} {matchesByYear[year].length === 1 ? 'rodada' : 'rodadas'}
                                </span>
                              </div>
                              <div className="h-[1px] flex-1 bg-gradient-to-r from-emerald-500/20 via-zinc-850 to-transparent" />
                            </div>

                            {/* Timeline down connection line */}
                            <div className="absolute top-[48px] left-[18px] md:left-[22px] bottom-0 w-[2px] bg-gradient-to-b from-emerald-500/20 via-zinc-800 to-zinc-950/20 pointer-events-none" />

                            {/* Year Round Cards List */}
                            <div className="space-y-6 pl-7 md:pl-9">
                              {matchesByYear[year].map((match, matchIdx, roundArr) => {
                                const result = fullResults.find(r => r.matchId === match.id);
                                const matchMedias = posts.filter(p => p.matchId === match.id && !['regra', 'aviso', 'comunicado'].includes(p.category) && !p.isDeleted);
                                const photosCount = matchMedias.filter(m => m.mediaType === 'image').length;
                                const videosCount = matchMedias.filter(m => m.mediaType === 'video').length;
                                const hasMedias = matchMedias.length > 0;

                                const formattedDate = new Date(match.date + 'T12:00:00').toLocaleDateString('pt-BR');
                                return (
                                  <div key={match.id} className="relative group">
                                    {/* Connector Arrow Icon indicator */}
                                    <div className={`absolute -left-[30px] md:-left-[36px] top-4.5 w-5 h-5 rounded-full border bg-zinc-950 flex items-center justify-center transition-all duration-300 group-hover:scale-115 ${
                                      hasMedias
                                        ? 'border-emerald-500/50 bg-emerald-950/85 text-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                                        : 'border-zinc-800 bg-zinc-900 text-zinc-500'
                                    }`}>
                                      <div className={`w-1.5 h-1.5 rounded-full ${hasMedias ? 'bg-emerald-400' : 'bg-zinc-650'}`} />
                                    </div>

                                    {/* Timeline card with sports flavor */}
                                    <div className="bg-gradient-to-b from-[#0b100e] to-[#080c0a] border border-zinc-900 hover:border-emerald-500/25 rounded-2xl p-5 shadow-lg hover:shadow-emerald-500/2 transition duration-300 flex flex-col md:flex-row md:items-center justify-between gap-5 relative">
                                      <div className="space-y-3.5 flex-1 min-w-0">
                                        {/* Badges / Header details */}
                                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
                                          <span className="bg-[#111915] border border-emerald-500/15 px-3 py-1 rounded-full text-emerald-400 font-extrabold flex items-center gap-1 leading-none shadow-sm uppercase">
                                             ⚽ Rodada #{sortedMatches.findIndex(m => m.id === match.id) + 1}
                                          </span>
                                          <span className="bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-full text-zinc-400 font-semibold leading-none">
                                            📅 {formattedDate}
                                          </span>
                                          <span className="text-zinc-500 font-medium truncate">
                                            ({match.location || 'Arena Society'})
                                          </span>
                                        </div>

                                        {/* Scoreboard and Champions details */}
                                        <div className="space-y-3">
                                          {result ? (
                                            <div className="space-y-3">
                                              {/* Score table layout */}
                                              <div className="flex flex-wrap gap-2.5 max-w-md">
                                                {/* Verde */}
                                                <div className="flex-1 min-w-[85px] bg-[#0c1410] border border-emerald-500/10 hover:border-emerald-500/20 px-3 py-2 rounded-xl text-center flex flex-col items-center">
                                                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-450" /> Verde
                                                  </span>
                                                  <strong className="text-emerald-400 font-display font-black text-sm mt-0.5">{result.winsGreen || 0} vit</strong>
                                                </div>

                                                {/* Vermelho */}
                                                <div className="flex-1 min-w-[85px] bg-[#140c0d] border border-rose-500/10 hover:border-rose-500/20 px-3 py-2 rounded-xl text-center flex flex-col items-center">
                                                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Vermelho
                                                  </span>
                                                  <strong className="text-rose-400 font-display font-black text-sm mt-0.5">{result.winsRed || 0} vit</strong>
                                                </div>

                                                {/* Azul */}
                                                <div className="flex-1 min-w-[85px] bg-[#0c1014] border border-blue-500/10 hover:border-blue-500/20 px-3 py-2 rounded-xl text-center flex flex-col items-center">
                                                  <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-extrabold flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Azul
                                                  </span>
                                                  <strong className="text-blue-400 font-display font-black text-sm mt-0.5">{result.winsBlue || 0} vit</strong>
                                                </div>
                                              </div>

                                              {/* Golden Trophy Ribbon for Champions */}
                                              {result.champions && result.champions.length > 0 && (
                                                <div className="inline-flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-xl text-xs font-mono leading-none shadow-sm">
                                                  <div className="p-1 bg-amber-500/10 text-amber-400 rounded-md">
                                                    <Award className="w-3.5 h-3.5 fill-amber-500" />
                                                  </div>
                                                  <span>
                                                    Campeão da Rodada: <strong className="text-amber-300 font-bold uppercase">{result.champions.join(' & ')}</strong>
                                                  </span>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <div className="py-2.5 px-3 bg-zinc-950/60 border border-zinc-900 rounded-xl max-w-sm">
                                              <p className="text-xs text-zinc-500 font-mono italic flex items-center gap-1.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500/60 animate-ping" />
                                                {match.status === 'encerrada' ? 'Placar em processamento / auditoria' : 'Partida futura programada'}
                                              </p>
                                            </div>
                                          )}
                                        </div>

                                        {/* Media counter row */}
                                        <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2 pt-0.5">
                                          <span className="flex items-center gap-1">📸 <strong>{photosCount}</strong> fotos</span>
                                          <span>•</span>
                                          <span className="flex items-center gap-1">🎥 <strong>{videosCount}</strong> vídeos</span>
                                        </div>
                                      </div>

                                      {/* Responsive CTA Buttons */}
                                      <div className="flex flex-row md:flex-col items-stretch gap-2 pt-2 md:pt-0 w-full md:w-auto">
                                        {hasMedias ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedHistoryMatchId(match.id);
                                              setMuseuTab('memorias');
                                            }}
                                            className="flex-1 md:flex-none px-4 py-2 bg-[#1b2f25] hover:bg-emerald-500 text-emerald-300 hover:text-zinc-950 rounded-xl text-[11px] font-black tracking-wider uppercase transition border border-emerald-500/10 hover:border-emerald-450 cursor-pointer text-center font-mono"
                                          >
                                            🏛️ Acervo da Rodada
                                          </button>
                                        ) : (
                                          match.status === 'encerrada' && !isPublic && currentUser && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setFormAssociation(`match-${match.id}`);
                                                setFormCategory('partida');
                                                setIsUploadOpen(true);
                                              }}
                                              className="flex-1 md:flex-none px-3.5 py-2 bg-zinc-900 hover:bg-zinc-805 text-zinc-400 hover:text-white rounded-xl text-[10.5px] font-mono font-bold transition border border-zinc-850 cursor-pointer text-center"
                                            >
                                              📷 Registrar Mídia
                                            </button>
                                          )
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between border-t border-zinc-900 pt-4 mt-2">
                          <span className="text-xs text-zinc-500 font-mono">
                            Página <strong className="text-zinc-350">{safeHistoryPage}</strong> de <strong className="text-zinc-350">{totalPages}</strong>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={safeHistoryPage === 1}
                              onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-850 disabled:hover:bg-zinc-900 text-zinc-350 hover:text-white rounded-lg text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer"
                            >
                              <ChevronLeft className="w-4 h-4 text-emerald-450" />
                              <span>Anterior</span>
                            </button>
                            <button
                              type="button"
                              disabled={safeHistoryPage === totalPages}
                              onClick={() => setHistoryPage(prev => Math.min(totalPages, prev + 1))}
                              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 border border-zinc-850 disabled:hover:bg-zinc-900 text-zinc-350 hover:text-white rounded-lg text-xs font-bold font-mono transition flex items-center gap-1 cursor-pointer"
                            >
                              <span>Próximo</span>
                              <ChevronRight className="w-4 h-4 text-emerald-450" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {museuTab === 'comunicacao' && (
          <div className="space-y-4 animate-fadeIn">
            <CommunicationCenter currentUser={currentUser} />
          </div>
        )}

        {museuTab === 'arquivo' && (
          <div className="bg-[#090e0c]/60 p-5 border border-zinc-900 rounded-xl space-y-4 animate-fadeIn">
            <div className="space-y-1 pb-3 border-b border-zinc-900/60">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <History className="w-4 h-4 text-zinc-450" />
                <span>Arquivo Histórico e Auditoria</span>
              </h3>
              <p className="text-[11px] text-zinc-500 font-mono">
                Central de governança para publicações arquivadas ou excluídas logicamente.
              </p>
            </div>
            
            <CommunicationCenter currentUser={currentUser} forceTab="history" hideTabs={true} />
          </div>
        )}
      </div>

    </div>
  );
}
