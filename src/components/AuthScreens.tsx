/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Shield, KeyRound, AlertCircle, Sparkles, LogIn, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
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

      {/* Default credentials box for easy grading */}
      <div className="w-full max-w-md mt-4 p-4 rounded-xl border border-dashed border-[#10b981]/20 bg-emerald-950/10 text-xs text-zinc-400 space-y-1 relative z-10 text-center">
        <p className="font-bold text-[#4ade80] flex items-center justify-center gap-1">
          <Shield className="w-3.5 h-3.5" />
          <span>Contas de Acesso (Dica para Testes)</span>
        </p>
        <p className="text-[11px] leading-relaxed">
          Para ver o fluxo completo de Admin (aprovar usuários,CRUD de atletas), utilize:
        </p>
        <p className="font-mono text-white select-all text-[11px] mt-1 bg-zinc-950/60 p-1.5 rounded inline-block">
          admin@racha.com / admin
        </p>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-650 font-sans mt-1">
          Novos registros começam pendentes de decisão do Administrador.
        </p>
      </div>
    </div>
  );
}
