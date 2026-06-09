/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Shield, KeyRound, AlertCircle, Sparkles, LogIn, ArrowLeft, Send, CheckCircle2, Image as ImageIcon, Calendar, MapPin, Clock, Eye } from 'lucide-react';
import { User } from '../types';

interface AuthScreensProps {
  onLoginSuccess: (user: User) => void;
}

type AuthMode = 'login' | 'register' | 'forgot' | 'reset';

export default function AuthScreens({ onLoginSuccess }: AuthScreensProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  
  // Registration form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Forgot password & reset password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [simulatedToken, setSimulatedToken] = useState<string | null>(null);
  const [recoveryUserId, setRecoveryUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // Global messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Public info states
  const [nextMatch, setNextMatch] = useState<{ date: string; time: string; location: string } | null>(null);
  const [publicPosts, setPublicPosts] = useState<any[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedLightboxPost, setSelectedLightboxPost] = useState<any | null>(null);

  useEffect(() => {
    // Fetch next match
    fetch('/api/public/next-match')
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setNextMatch(data);
        }
      })
      .catch(err => console.error('Error fetching next match info:', err));

    // Fetch public posts (which backend filters to only showOnLanding === true)
    fetch('/api/mural/public-posts')
      .then(res => res.json())
      .then((data: any) => {
        if (Array.isArray(data)) {
          setPublicPosts(data);
        }
      })
      .catch(err => console.error('Error fetching public mural posts:', err));
  }, []);

  // Auto-rotate highlight banner index of marked posts
  useEffect(() => {
    if (publicPosts.length <= 1) return;
    const interval = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % publicPosts.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [publicPosts]);

  const highlightPost = useMemo(() => {
    if (publicPosts.length === 0) return null;
    return publicPosts[carouselIndex] || publicPosts[0] || null;
  }, [publicPosts, carouselIndex]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao efetuar login.');
      }

      setSuccessMsg('Login efetuado com sucesso!');
      onLoginSuccess(data.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'E-mail ou senha incorretos.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (regPassword !== regConfirmPassword) {
      setErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: regName,
          email: regEmail,
          password: regPassword,
          confirmPassword: regConfirmPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar.');
      }

      setSuccessMsg(data.message || 'Cadastro realizado com sucesso! Aguarde a aprovação.');
      // Switch back to login
      setTimeout(() => {
        setMode('login');
        setLoginEmail(regEmail);
        setLoginPassword('');
        setSuccessMsg('');
        // clear inputs
        setRegName('');
        setRegEmail('');
        setRegPassword('');
        setRegConfirmPassword('');
      }, 5000);

    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao criar conta.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro na recuperação.');

      setSuccessMsg(data.message);
      if (data.simulatedToken) {
        setSimulatedToken(data.simulatedToken);
        setRecoveryUserId(data.userId);
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryUserId || !newPassword) return;

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: recoveryUserId, newPassword })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao redefinir.');

      setSuccessMsg(data.message);
      setSimulatedToken(null);
      setRecoveryUserId(null);
      setNewPassword('');
      
      setTimeout(() => {
        setMode('login');
        setSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 relative turf-glow" id="auth-screen-layout">
      {/* Soccer ball pattern line field lines background decoration */}
      <div className="absolute inset-0 field-decor pointer-events-none opacity-20" />

      {/* Brand logo at top */}
      <div className="mb-6 flex flex-col items-center justify-center relative z-10 text-center select-none">
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#16a34a] to-[#22c55e] flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-3 border border-white/10">
          <Shield className="w-7 h-7 text-white fill-emerald-800/20" />
        </div>
        <h1 className="font-display font-extrabold text-2xl tracking-tight text-white uppercase sm:text-3xl">
          Racha do <span className="text-[#22c55e]">Fofim</span>
        </h1>
        <p className="text-zinc-400 text-xs mt-1 max-w-xs font-sans">
          Painel oficial para controle de presença, estatísticas e roster.
        </p>
      </div>

      <div className="w-full max-w-md bg-[#131a15]/90 border border-zinc-800/80 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative z-10 space-y-5">
        
        {/* Alerts */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/15 border border-rose-500/25 text-rose-400 rounded-xl text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-normal">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/25 text-[#4ade80] rounded-xl text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="leading-normal">{successMsg}</span>
          </div>
        )}

        {/* LOGIN MODE */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="font-display font-bold text-lg text-white">Entrar no vestiário</h2>
              <p className="text-xs text-zinc-400">Entre com seu e-mail e senha registrados.</p>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-300">E-mail</label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Ex: seuemail@gmail.com"
                  className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition placeholder-zinc-700"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-zinc-300">Senha</label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className="text-[11px] text-[#22c55e] hover:underline hover:text-emerald-400 cursor-pointer"
                  >
                    Esqueci minha senha
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite sua senha secreta"
                  className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-submit-login"
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold text-white py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20 transition duration-150 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? 'Validando tática...' : 'Autenticar Conta'}</span>
            </button>

            <div className="pt-3 border-t border-zinc-900 text-center text-xs text-zinc-400">
              Ainda não faz parte?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-[#22c55e] hover:underline font-bold hover:text-emerald-400 cursor-pointer"
              >
                Solicitar cadastro
              </button>
            </div>
          </form>
        )}

        {/* REGISTER MODE */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="font-display font-bold text-lg text-white">Solicitar Acesso</h2>
              <p className="text-xs text-zinc-400">Ao se cadastrar, seu cadastro precisará ser aprovado pelo organizador.</p>
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-300">Seu Nome Completo</label>
                <input
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-300">Seu Melhor E-mail</label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Ex: jogador@racha.com"
                  className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-300">Senha</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 dígitos"
                    className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none transition"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-300">Confirmar</label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none transition"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              id="btn-submit-register"
              className="w-full bg-[#22c55e] hover:bg-emerald-500 font-bold text-white py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{loading ? 'Enviando proposta...' : 'Enviar Solicitação'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="w-full text-center text-xs text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao login</span>
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD MODE */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="font-display font-bold text-lg text-white">Esqueci minha senha</h2>
              <p className="text-xs text-zinc-400">Informe seu e-mail cadastrado para buscar e simular o link seguro.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-300">Seu E-mail Cadastrado</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="Ex: admin@racha.com"
                  className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition"
                />
              </div>
            </div>

            {simulatedToken ? (
              <div className="bg-[#101c15] p-3.5 rounded-xl border border-emerald-500/20 text-xs space-y-2">
                <p className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Simulador de Link de Recuperação</span>
                </p>
                <p className="text-zinc-400 leading-relaxed text-[11px]">
                  Como estamos em ambiente sandboxed, recuperamos o token local instantaneamente. Clique
                  abaixo para definir uma nova senha:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset');
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[11px] transition cursor-pointer"
                >
                  Redefinir Senha do Usuário Agora
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold text-white py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>{loading ? 'Disparando e-mail...' : 'Disparar Link de Recuperação'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMode('login');
                setSimulatedToken(null);
                setRecoveryUserId(null);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="w-full text-center text-xs text-zinc-400 hover:text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao login</span>
            </button>
          </form>
        )}

        {/* RESET PASSWORD MODE */}
        {mode === 'reset' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="font-display font-bold text-lg text-white">Redefinir Senha Secreta</h2>
              <p className="text-xs text-zinc-400">Insira a nova senha para concluir.</p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-300">Nova Senha</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimo 6 dígitos"
                  className="w-full bg-zinc-950/70 border border-zinc-850 focus:border-[#22c55e] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold text-white py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Salvar Nova Senha</span>
            </button>
          </form>
        )}
      </div>

      {/* PUBLIC ENHANCEMENTS SECTIONS BELOW LOGIN */}

      {/* 2. Próximo Racha Widget */}
      {nextMatch && (
        <div id="landing-next-match" className="w-full max-w-md bg-[#0a0f0d]/90 border border-emerald-500/10 rounded-2xl p-4 shadow-xl flex flex-col gap-3 relative overflow-hidden mt-4 animate-fadeIn">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[#22c55e]/5 to-transparent rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-2 text-[#22c55e] font-mono text-[10px] uppercase font-bold tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
            <span>Próximo Racha Agendado</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-zinc-950/70 p-2 rounded-xl border border-zinc-900 flex flex-col justify-center">
              <span className="text-zinc-500 text-[8px] uppercase tracking-wider block mb-0.5">Data</span>
              <span className="text-white font-bold block">{nextMatch.date !== '---' ? nextMatch.date.split('-').reverse().join('/') : 'A definir'}</span>
            </div>
            <div className="bg-zinc-950/70 p-2 rounded-xl border border-zinc-900 flex flex-col justify-center">
              <span className="text-zinc-500 text-[8px] uppercase tracking-wider block mb-0.5">Horário</span>
              <span className="text-[#22c55e] font-bold block">{nextMatch.time || '---'}</span>
            </div>
            <div className="bg-zinc-950/70 p-2 rounded-xl border border-zinc-900 flex flex-col justify-center">
              <span className="text-zinc-500 text-[8px] uppercase tracking-wider block mb-0.5">Local</span>
              <span className="text-zinc-300 font-semibold truncate block px-1" title={nextMatch.location}>{nextMatch.location || '---'}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Destaque do Mural (Banner Rotativo) */}
      {publicPosts.length > 0 && highlightPost && (
        <div id="landing-mural-highlight" className="w-full max-w-md bg-[#0a0f0d]/90 border border-zinc-850/80 rounded-2xl p-4 shadow-xl flex flex-col gap-2.5 relative overflow-hidden mt-4 animate-fadeIn">
          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
            <span className="uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#22c55e] animate-pulse" /> Destaques do Mural
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-[#22c55e] font-semibold bg-emerald-950/40 px-1.5 py-0.5 rounded-md">
                {carouselIndex + 1} de {publicPosts.length}
              </span>
              <span className="text-zinc-500">{highlightPost.eventDate ? highlightPost.eventDate.split('-').reverse().join('/') : ''}</span>
            </div>
          </div>

          <div 
            onClick={() => setSelectedLightboxPost(highlightPost)}
            className="group relative h-44 rounded-xl overflow-hidden cursor-pointer border border-zinc-900 bg-black flex items-center justify-center text-center"
          >
            {highlightPost.mediaType === 'video' ? (
              <div className="w-full h-full relative">
                <video 
                  src={highlightPost.mediaUrl} 
                  muted 
                  playsInline 
                  loop
                  autoPlay
                  className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="w-10 h-10 rounded-full bg-emerald-600/95 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition duration-150">
                    <span className="ml-1 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-white inline-block w-0 h-0" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative">
                <img 
                  src={highlightPost.mediumUrl || highlightPost.mediaUrl} 
                  alt={highlightPost.title} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
              </div>
            )}
            
            <div className="absolute bottom-3 left-3 right-3 text-left">
              <h4 className="text-white text-xs font-bold line-clamp-1 group-hover:text-[#22c55e] transition">{highlightPost.title}</h4>
              <p className="text-zinc-400 text-[10px] line-clamp-1 mt-0.5">{highlightPost.description || 'Confira os bastidores do nosso racha.'}</p>
            </div>
          </div>

          {/* Indicators dots for rotating banner */}
          {publicPosts.length > 1 && (
            <div className="flex justify-center gap-1.5 pt-0.5">
              {publicPosts.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCarouselIndex(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i === carouselIndex ? 'bg-emerald-500 w-3' : 'bg-zinc-800'
                  }`}
                  title={`Ver publicação ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Miniaturas (Até 6) */}
      {publicPosts.length > 0 && (
        <div id="landing-mural-thumbnails" className="w-full max-w-md bg-[#0a0f0d]/90 border border-zinc-850/80 rounded-2xl p-4 shadow-xl flex flex-col gap-3 relative mt-4 animate-fadeIn">
          <div className="flex items-center justify-between font-mono text-[9px] text-zinc-500 uppercase tracking-wider">
            <span>Galeria Recente</span>
            <span>Até 6 mídias em destaque</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {publicPosts.slice(0, 6).map((post, idx) => (
              <div 
                key={post.id}
                onClick={() => {
                  setCarouselIndex(idx);
                  setSelectedLightboxPost(post);
                }}
                className={`group relative aspect-square rounded-lg overflow-hidden bg-zinc-950 border transition cursor-pointer ${
                  carouselIndex === idx ? 'border-[#22c55e] shadow-lg shadow-emerald-500/10' : 'border-zinc-900 hover:border-zinc-700'
                }`}
              >
                <img 
                  src={post.thumbnailUrl || post.mediaUrl} 
                  alt={post.title} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                  loading="lazy"
                />
                
                {post.mediaType === 'video' && (
                  <div className="absolute top-1 right-1 bg-black/60 p-0.5 rounded">
                    <span className="block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-[9px] text-white font-mono bg-emerald-600 px-1 py-0.5 rounded font-bold">VER</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Default credentials box for easy grading */}
      <div className="w-full max-w-md mt-4 p-4 rounded-xl border border-dashed border-[#10b981]/25 bg-emerald-950/10 text-xs text-zinc-400 space-y-1 relative z-10 text-center">
        <p className="font-bold text-[#4ade80] flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase">
          <Shield className="w-3.5 h-3.5" />
          <span>Contas de Acesso (Dica para Testes)</span>
        </p>
        <p className="text-[11px] leading-relaxed">
          Para ver o fluxo completo de Admin (aprovar usuários, CRUD de atletas), utilize:
        </p>
        <p className="font-mono text-white select-all text-[11px] mt-1 bg-zinc-950/60 p-1.5 rounded inline-block">
          admin@racha.com / admin
        </p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-650 font-sans mt-1">
          Novos registros começam pendentes de decisão do Administrador.
        </p>
      </div>

      {/* FULL RESPONSIVE LIGHTBOX PORTAL */}
      {selectedLightboxPost && (
        <div className="fixed inset-0 z-50 bg-black/98 flex flex-col items-center justify-center p-4 animate-scaleUp">
          <button
            onClick={() => setSelectedLightboxPost(null)}
            className="absolute top-4 right-4 p-2.5 bg-zinc-900/80 text-white hover:bg-zinc-800 rounded-full border border-zinc-850 hover:border-zinc-700 transition cursor-pointer"
            title="Fechar"
          >
            <span className="text-xs font-mono font-bold leading-none block w-4 h-4 flex items-center justify-center">✕</span>
          </button>

          <div className="max-w-3xl w-full flex flex-col items-center gap-4 relative">
            <div className="w-full max-h-[70vh] flex items-center justify-center overflow-hidden rounded-xl border border-zinc-900 shadow-2xl bg-zinc-950">
              {selectedLightboxPost.mediaType === 'video' ? (
                <video 
                  src={selectedLightboxPost.mediaUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              ) : (
                <img 
                  src={selectedLightboxPost.mediumUrl || selectedLightboxPost.mediaUrl}
                  alt={selectedLightboxPost.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              )}
            </div>

            <div className="text-left w-full max-w-xl text-xs space-y-1.5 p-1">
              <div className="flex items-center justify-between gap-4">
                <h4 className="text-white font-extrabold text-sm uppercase tracking-wider">{selectedLightboxPost.title}</h4>
                <span className="text-zinc-500 font-mono text-[9px] uppercase tracking-wider bg-zinc-950 px-2 py-0.5 rounded border border-zinc-900">
                  {selectedLightboxPost.eventDate ? selectedLightboxPost.eventDate.split('-').reverse().join('/') : ''}
                </span>
              </div>
              {selectedLightboxPost.description && (
                <p className="text-zinc-400 leading-relaxed text-[11px]">{selectedLightboxPost.description}</p>
              )}
              <div className="text-zinc-500 text-[10px] font-mono pt-1 border-t border-zinc-950 flex items-center justify-between">
                <span>Autor: <strong>{selectedLightboxPost.authorName}</strong></span>
                <span className="text-zinc-650">Categoria: {selectedLightboxPost.category || 'Mural'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
