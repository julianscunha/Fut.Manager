import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { readDb, writeDb } from './server/db';
import { runSmartDraw, recordAffinities } from './server/drawEngine';
import { computeStatsForSeason } from './server/statsEngine';
import { Player, User, UserRole, UserStatus, Season, Match, PresenceStatus, MatchResult } from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON requests with 10MB limit for base64 uploads
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // --- API Routes ---

  // Upload: S3 image upload simulation
  app.post('/api/upload-s3', (req, res) => {
    const { filename, fileType, fileData } = req.body;

    if (!filename || !fileType || !fileData) {
      return res.status(400).json({ error: 'Os campos filename, fileType e fileData são obrigatórios.' });
    }

    // Validate image format
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(fileType.toLowerCase())) {
      return res.status(400).json({ error: 'Formato de imagem inválido. Use JPG, JPEG, PNG ou WEBP.' });
    }

    // Capture potential AWS S3 config
    const awsKey = process.env.AWS_ACCESS_KEY_ID;
    const awsSecret = process.env.AWS_SECRET_ACCESS_KEY;
    const awsRegion = process.env.AWS_REGION || 'sa-east-1';
    const awsBucket = process.env.AWS_S3_BUCKET || 'racha-do-fofim';

    const timestamp = Date.now();
    const sanitizedFilename = filename.toLowerCase().replace(/[^a-z0-9.]/g, '-');
    const uniqueFilename = `${timestamp}-${sanitizedFilename}`;
    const simulatedS3Url = `https://${awsBucket}.s3.${awsRegion}.amazonaws.com/uploads/${uniqueFilename}`;

    console.log(`[Upload S3] S3 Upload completed. Filename: ${uniqueFilename}, simulated S3 URL: ${simulatedS3Url}`);

    // Return mock S3 URL structure and the actual data URI for instant sandbox preview
    return res.json({
      message: 'Upload concluído com sucesso (Estrutura S3 ativa)!',
      s3Url: simulatedS3Url, 
      previewData: fileData 
    });
  });

  // Auth: Registrar Usuário
  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'As senhas não coincidem.' });
    }

    const db = readDb();
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const newUserId = 'user-' + Date.now();
    const newUser: User = {
      id: newUserId,
      name: name.trim(),
      email: normalizedEmail,
      role: 'jogador', // default role
      status: 'pending', // Waiting admin approval
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    db.passwords[newUserId] = password;

    writeDb(db);

    return res.status(201).json({
      message: 'Cadastro realizado com sucesso! Aguardando aprovação do administrador para acesso.',
      user: newUser
    });
  });

  // Auth: Login
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    const db = readDb();
    const normalizedEmail = email.toLowerCase().trim();

    const user = db.users.find((u) => u.email.toLowerCase().trim() === normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const storedPassword = db.passwords[user.id];
    if (storedPassword !== password) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Check Approval Status
    if (user.status === 'pending') {
      return res.status(403).json({
        error: 'Sua conta está aguardando aprovação administrativa. Entre em contato com o organizador.',
        status: 'pending'
      });
    }

    if (user.status === 'rejected') {
      return res.status(403).json({
        error: 'Sua solicitação de cadastro foi negada pelo administrador.',
        status: 'rejected'
      });
    }

    return res.json({
      message: 'Login realizado com sucesso!',
      user
    });
  });

  // Auth: Redefinição de senha (Esqueci minha senha)
  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'O e-mail é obrigatório.' });
    }

    const db = readDb();
    const user = db.users.find((u) => u.email.toLowerCase().trim() === email.toLowerCase().trim());

    if (!user) {
      // For security, don't reveal if user exists or not, but return success
      return res.json({
        message: 'Se o e-mail estiver cadastrado, um link de redefinição foi enviado.',
        simulatedToken: null
      });
    }

    // Generate a simulated recovery token
    const token = 'recovery-' + Math.random().toString(36).substr(2, 9);
    
    // In a real application, we would send this via mail. For our sandbox applet,
    // we return the simulated token to easily complete the flow in the frontend!
    return res.json({
      message: 'E-mail de redefinição enviado com sucesso!',
      simulatedToken: token,
      userId: user.id
    });
  });

  // Auth: Resetar Senha
  app.post('/api/auth/reset-password', (req, res) => {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ error: 'Informações inválidas para redefinição.' });
    }

    const db = readDb();
    if (!db.passwords[userId]) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    db.passwords[userId] = newPassword;
    writeDb(db);

    return res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
  });

  // Usuários: Listar usuários para aprovação (Apenas Admin/Auxiliar)
  app.get('/api/users', (req, res) => {
    const db = readDb();
    // Return all users
    return res.json(db.users);
  });

  // Usuários: Aprovar / Rejeitar / Mudar Permissão (Admin apenas)
  app.post('/api/users/action', (req, res) => {
    const { userId, action, role } = req.body as { userId: string; action: 'approve' | 'reject' | 'update_role'; role?: UserRole };

    if (!userId || !action) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.' });
    }

    const db = readDb();
    const userIndex = db.users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    if (userId === 'user-admin') {
      return res.status(400).json({ error: 'Incapaz de modificar o Administrador raiz.' });
    }

    if (action === 'approve') {
      db.users[userIndex].status = 'approved';
    } else if (action === 'reject') {
      db.users[userIndex].status = 'rejected';
    } else if (action === 'update_role' && role) {
      db.users[userIndex].role = role;
    }

    writeDb(db);
    return res.json({ message: 'Ação realizada com sucesso!', user: db.users[userIndex] });
  });

  // Jogadores: Listar (Retorna ativos se sem parâmetro, ou todos se admin para gerenciamento)
  app.get('/api/players', (req, res) => {
    const db = readDb();
    const includeDeleted = req.query.includeDeleted === 'true';

    let result = db.players;
    if (!includeDeleted) {
      result = db.players.filter((p) => !p.deletedAt);
    }

    return res.json(result);
  });

  // Jogadores: Criar Jogador
  app.post('/api/players', (req, res) => {
    const playerData = req.body as Omit<Player, 'id' | 'createdAt' | 'updatedAt'>;

    if (!playerData.name || !playerData.category || !playerData.status || !playerData.primaryPosition) {
      return res.status(400).json({ error: 'Nome, categoria, status e posição principal são obrigatórios.' });
    }

    const db = readDb();
    const newPlayer: Player = {
      ...playerData,
      id: 'player-' + Date.now(),
      secondaryPositions: playerData.secondaryPositions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStreak: 0,
      maxStreak: 0
    };

    db.players.push(newPlayer);
    writeDb(db);

    return res.status(201).json({ message: 'Jogador cadastrado com sucesso!', player: newPlayer });
  });

  // Jogadores: Atualizar Jogador
  app.put('/api/players/:id', (req, res) => {
    const { id } = req.params;
    const updateData = req.body as Partial<Player>;

    const db = readDb();
    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    const existingPlayer = db.players[index];

    // Merge updates
    const updatedPlayer: Player = {
      ...existingPlayer,
      ...updateData,
      secondaryPositions: updateData.secondaryPositions || existingPlayer.secondaryPositions,
      updatedAt: new Date().toISOString()
    };

    // If change status to disponivel or afastado, wipe the limits
    if (updatedPlayer.status === 'disponivel' || updatedPlayer.status === 'afastado') {
      updatedPlayer.statusStartDate = undefined;
      updatedPlayer.statusEndDate = undefined;
    }

    db.players[index] = updatedPlayer;
    writeDb(db);

    return res.json({ message: 'Jogador atualizado com sucesso!', player: updatedPlayer });
  });

  // Jogadores: Soft Delete (Inativar/Excluir Logicamente)
  app.delete('/api/players/:id', (req, res) => {
    const { id } = req.params;

    const db = readDb();
    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    db.players[index].deletedAt = new Date().toISOString();
    db.players[index].updatedAt = new Date().toISOString();
    writeDb(db);

    return res.json({ message: 'Jogador inativado com sucesso!', player: db.players[index] });
  });

  // Jogadores: Restaurar (Desfazer inativação)
  app.post('/api/players/:id/restore', (req, res) => {
    const { id } = req.params;

    const db = readDb();
    const index = db.players.findIndex((p) => p.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    db.players[index].deletedAt = undefined;
    db.players[index].updatedAt = new Date().toISOString();
    writeDb(db);

    return res.json({ message: 'Jogador reativado com sucesso!', player: db.players[index] });
  });

  // Jogadores: Preparação do fluxograma futuro de Card IA
  app.post('/api/players/:id/generate-card', (req, res) => {
    const { id } = req.params;

    const db = readDb();
    const player = db.players.find((p) => p.id === id);

    if (!player) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    if (!player.photoOriginal) {
      return res.status(400).json({ 
        error: 'missing_photo', 
        message: 'O atleta necessita de uma Foto Original cadastrada no S3 para que o Card IA possa ser gerado.' 
      });
    }

    // Estrutura planejada para a futura versão com serviço de IA integrado:
    // Passo 1: Obter "photoOriginal" do S3.
    // Passo 2: Enviar imagem para o modelo de Visão do Gemini (ou outro gerador generativo).
    // Passo 3: O prompt solicita e segmenta o rosto original do atleta e substitui o corpo com uniforme customizado nas cores do clube (FAVORITE_TEAMS).
    // Passo 4: O card gerado em formato buffer é salvo no S3.
    // Passo 5: A URL resultante é persistida no banco do respectivo Jogador (player.playerCardUrl = resS3Url).
    
    return res.status(200).json({
      success: false,
      error: 'planned_feature',
      message: 'Funcionalidade planejada para a próxima versão. Integração com IA em andamento.',
      details: {
        playerId: player.id,
        photoOriginal: player.photoOriginal,
        favoriteTeamId: player.favoriteTeamId,
        futureSteps: [
          'Download original image from S3',
          'Send to AI generation model with face preservation',
          'Color jersey design using favorite team color palettes',
          'Upload output to S3 bucket /cards',
          'Save persistent card image path back to player database object'
        ]
      }
    });
  });

  // --- Evaluation Helper Function ---
  function computePlayerMetrics(playerId: string, playerPosition: string, evaluations: any[], history: any[]) {
    // Filter evaluations for this player
    const playerEvals = evaluations.filter(e => e.targetPlayerId === playerId);
    const evalCount = playerEvals.length;
    
    // Weights and attributes based on position
    const isGk = playerPosition === 'goleiro';
    const attribs = isGk 
      ? ['reflexo', 'posicionamento', 'saida_gol', 'reposicao']
      : ['defesa', 'passe', 'finalizacao', 'velocidade', 'posicionamento', 'drible', 'marcacao', 'fisico'];
      
    const weights: Record<string, number> = isGk
      ? { reflexo: 0.35, posicionamento: 0.25, saida_gol: 0.20, reposicao: 0.20 }
      : { defesa: 0.15, passe: 0.15, finalizacao: 0.15, velocidade: 0.15, posicionamento: 0.15, drible: 0.10, marcacao: 0.10, fisico: 0.05 };

    // Anti-manipulation constants (Média Ponderada/Suavizada com base neutra)
    const BASE_RATING = 3.5; // Start with a realistic competitive baseline of 3.5
    const BASE_WEIGHT = 4.0; // Acts as 4 initial pre-votes

    const computedAttributes: Record<string, { average: number, rawCount: number }> = {};
    let weightedOverallSum = 0;

    attribs.forEach(attr => {
      // Get all user votes for this attribute
      const votes = playerEvals.map(e => e.ratings[attr]).filter(v => v !== undefined && v !== null);
      const votesSum = votes.reduce((acc, v) => acc + (v as number), 0);
      const votesCount = votes.length;

      // Weighted average formula to prevent sudden mutations
      const weightedAvg = ((BASE_RATING * BASE_WEIGHT) + votesSum) / (BASE_WEIGHT + votesCount);
      
      // Round to 1 decimal place
      const roundedAvg = Math.round(weightedAvg * 10) / 10;

      computedAttributes[attr] = {
        average: roundedAvg,
        rawCount: votesCount
      };

      // Overall contribution
      const weight = weights[attr] || 0;
      weightedOverallSum += roundedAvg * weight;
    });

    const overall = Math.round(weightedOverallSum * 10) / 10;

    // History filtering
    const playerHistory = history
      .filter(h => h.playerId === playerId)
      .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return {
      playerId,
      overall,
      evalCount,
      computedAttributes,
      history: playerHistory
    };
  }

  // evaluations/summary: list metrics and overall rating for all players
  app.get('/api/evaluations/summary', (req, res) => {
    try {
      const db = readDb();
      const summaries = db.players.map(p => {
        return computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
      });
      return res.json(summaries);
    } catch (err) {
      console.error('[Error Summary Evaluations]', err);
      return res.status(500).json({ error: 'Erro interno ao processar resumo de avaliações.' });
    }
  });

  // players/:id/evaluations: specific ratings history, and current active evaluator's vote details
  app.get('/api/players/:id/evaluations', (req, res) => {
    try {
      const { id } = req.params;
      const evaluatorUserId = req.query.evaluatorUserId as string;

      const db = readDb();
      const player = db.players.find(p => p.id === id);

      if (!player) {
        return res.status(404).json({ error: 'Jogador não encontrado.' });
      }

      const metrics = computePlayerMetrics(id, player.primaryPosition, db.evaluations, db.evaluationHistory);
      
      // Find my evaluation (if evaluatorUserId is passed)
      let myEvaluation = null;
      if (evaluatorUserId) {
        myEvaluation = db.evaluations.find(e => e.evaluatorUserId === evaluatorUserId && e.targetPlayerId === id) || null;
      }

      // Calculate attendance statistics dynamically from database
      const playerPresences = db.presences.filter(p => p.playerId === id);
      const presencesCount = playerPresences.filter(p => p.status === 'confirmado').length;
      const absencesCount = playerPresences.filter(p => p.status === 'cancelado').length;

      const participationsList = playerPresences.map(p => {
        const matchObj = db.matches.find(m => m.id === p.matchId);
        return {
          matchId: p.matchId,
          date: matchObj ? matchObj.date : '',
          location: matchObj ? matchObj.location : '',
          status: p.status, // 'confirmado' | 'cancelado' | 'nao_confirmado'
          matchStatus: matchObj ? matchObj.status : ''
        };
      }).filter(item => item.date !== '');

      // Sort by date descending
      participationsList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const lastParticipations = participationsList.slice(0, 5);

      const metricsEnriched = {
        ...metrics,
        presencesCount,
        absencesCount,
        lastParticipations
      };

      return res.json({
        metrics: metricsEnriched,
        myEvaluation
      });
    } catch (err) {
      console.error('[Error Get Player Evaluations]', err);
      return res.status(500).json({ error: 'Erro interno ao buscar faturamento ou avaliações do jogador.' });
    }
  });

  // players/:id/evaluate: evaluates a player
  app.post('/api/players/:id/evaluate', (req, res) => {
    try {
      const { id } = req.params;
      const { evaluatorUserId, ratings } = req.body;

      if (!evaluatorUserId || !ratings) {
        return res.status(400).json({ error: 'Identificação do avaliador e notas são obrigatórios.' });
      }

      const db = readDb();
      const player = db.players.find(p => p.id === id);

      if (!player) {
        return res.status(404).json({ error: 'Jogador sendo avaliado não existe.' });
      }

      // Validate increments of 0.5 & range 0.0 to 5.0
      const keys = Object.keys(ratings);
      for (const key of keys) {
        const val = parseFloat(ratings[key]);
        if (isNaN(val) || val < 0.0 || val > 5.0 || (val * 10) % 5 !== 0) {
          return res.status(400).json({ error: 'Valores técnicos devem ser escalas de 0.0 até 5.0 com incrementos de 0.5.' });
        }
      }

      // Get current period (Year-Month) matching the single evaluation per month rule
      const currentPeriod = new Date().toISOString().substring(0, 7); // "YYYY-MM"
      const previousEval = db.evaluations.find(e => e.evaluatorUserId === evaluatorUserId && e.targetPlayerId === id);

      let messageStr = 'Avaliação registrada com sucesso de forma anônima!';

      if (previousEval) {
        const wasSamePeriod = previousEval.date.startsWith(currentPeriod);
        if (wasSamePeriod) {
          messageStr = 'Sua avaliação anterior para este período foi atualizada com sucesso!';
        } else {
          messageStr = 'Sua nova avaliação substituiu a avaliação do período anterior com sucesso!';
        }

        // Overwrite the existing evaluation to prevent duplication
        previousEval.ratings = ratings;
        previousEval.date = new Date().toISOString().split('T')[0];
      } else {
        db.evaluations.push({
          id: 'eval-' + Date.now(),
          evaluatorUserId,
          targetPlayerId: id,
          date: new Date().toISOString().split('T')[0],
          ratings
        });
      }

      // Trigger metrics recalculation to safely save history entries dynamically on update!
      const newMetrics = computePlayerMetrics(id, player.primaryPosition, db.evaluations, db.evaluationHistory);
      
      // Save/update overall history entry for today YYYY-MM-DD
      const todayStr = new Date().toISOString().split('T')[0];
      const historyIndex = db.evaluationHistory.findIndex(h => h.playerId === id && h.date === todayStr);
      if (historyIndex !== -1) {
        db.evaluationHistory[historyIndex].overall = newMetrics.overall;
      } else {
        db.evaluationHistory.push({
          playerId: id,
          date: todayStr,
          overall: newMetrics.overall
        });
      }

      writeDb(db);
      return res.json({ 
        message: messageStr,
        metrics: newMetrics
      });
    } catch (err) {
      console.error('[Error Post Player Evaluate]', err);
      return res.status(500).json({ error: 'Não foi possível salvar a avaliação.' });
    }
  });

  // ==========================================
  // --- SEASONS (TEMPORADAS) API ENDPOINTS ---
  // ==========================================

  app.get('/api/seasons', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.seasons || []);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao listar temporadas.' });
    }
  });

  app.post('/api/seasons', (req, res) => {
    try {
      const { name, year, startDate, endDate, active } = req.body;
      if (!name || !year || !startDate || !endDate) {
        return res.status(400).json({ error: 'Campos Nome, Ano, Data início e Fim são obrigatórios.' });
      }

      const db = readDb();
      const newSeason: Season = {
        id: 'season-' + Date.now(),
        name,
        year: parseInt(year),
        startDate,
        endDate,
        active: !!active
      };

      if (newSeason.active) {
        // Deactivate all other seasons
        db.seasons = db.seasons.map((s) => ({ ...s, active: false }));
      }

      db.seasons.push(newSeason);
      writeDb(db);
      return res.status(201).json(newSeason);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar temporada.' });
    }
  });

  app.put('/api/seasons/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { name, year, startDate, endDate, active } = req.body;

      const db = readDb();
      const seasonIndex = db.seasons.findIndex((s) => s.id === id);

      if (seasonIndex === -1) {
        return res.status(404).json({ error: 'Temporada não encontrada.' });
      }

      const updatedSeason = {
        ...db.seasons[seasonIndex],
        name: name || db.seasons[seasonIndex].name,
        year: year ? parseInt(year) : db.seasons[seasonIndex].year,
        startDate: startDate || db.seasons[seasonIndex].startDate,
        endDate: endDate || db.seasons[seasonIndex].endDate,
        active: active !== undefined ? !!active : db.seasons[seasonIndex].active
      };

      if (updatedSeason.active) {
        // Deactivate all other seasons
        db.seasons = db.seasons.map((s) => (s.id === id ? s : { ...s, active: false }));
      }

      db.seasons[seasonIndex] = updatedSeason;
      writeDb(db);
      return res.json(updatedSeason);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar temporada.' });
    }
  });

  // ==========================================
  // --- MATCHES (PARTIDAS) API ENDPOINTS ---
  // ==========================================

  app.get('/api/matches', (req, res) => {
    try {
      const db = readDb();
      const activeSeason = db.seasons.find((s) => s.active);
      
      const activePlayerIds = db.players.filter((p) => !p.deletedAt).map((p) => p.id);
      const deadlineDays = db.recurrentConfig ? db.recurrentConfig.confirmationDeadlineDaysBefore : 2;

      const enrichedMatches = db.matches.map((m) => {
        const matchPresences = db.presences.filter((pr) => pr.matchId === m.id);
        const confirmedPlayers = matchPresences.filter(
          (pr) => pr.status === 'confirmado' && activePlayerIds.includes(pr.playerId)
        );
        const confirmedCount = confirmedPlayers.length;

        // Calculations
        const vacancies = Math.max(0, 24 - confirmedCount);
        const hasMinimumPlayers = confirmedCount >= 15;
        const missingPlayersCount = Math.max(0, 15 - confirmedCount);

        // Deadline check
        const matchDate = new Date(`${m.date}T12:00:00`);
        const deadlineDate = new Date(matchDate.getTime() - deadlineDays * 24 * 60 * 60 * 1000);
        const isDeadlineExpired = new Date() >= deadlineDate;

        return {
          ...m,
          confirmedCount,
          vacancies,
          hasMinimumPlayers,
          missingPlayersCount,
          isDeadlineExpired,
          deadlineDateStr: deadlineDate.toISOString().split('T')[0]
        };
      });

      // Filter matches by current season if requested
      const { seasonId } = req.query;
      let filtered = enrichedMatches;
      if (seasonId) {
        filtered = enrichedMatches.filter((m) => m.seasonId === seasonId);
      } else if (activeSeason) {
        filtered = enrichedMatches.filter((m) => m.seasonId === activeSeason.id);
      }

      // Sort matches by date ascending
      filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return res.json(filtered);
    } catch (err) {
      console.error('[Error GET Matches]', err);
      return res.status(500).json({ error: 'Erro ao carregar partidas.' });
    }
  });

  app.post('/api/matches', (req, res) => {
    try {
      const { date, time, location, durationMinutes, status, seasonId } = req.body;
      if (!date || !time) {
        return res.status(400).json({ error: 'Data e Horário são obrigatórios.' });
      }

      const db = readDb();
      const activeSeason = db.seasons.find((s) => s.active);
      const targetSeasonId = seasonId || (activeSeason ? activeSeason.id : null);

      if (!targetSeasonId) {
        return res.status(400).json({ error: 'Você precisa criar/ativar uma Temporada antes de agendar partidas.' });
      }

      // Check if match already exists on this date
      const exists = db.matches.some((m) => m.date === date && m.seasonId === targetSeasonId);
      if (exists) {
        return res.status(400).json({ error: `Já existe uma partida agendada para o dia ${date}.` });
      }

      const newMatch: Match = {
        id: 'match-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
        seasonId: targetSeasonId,
        date,
        time,
        location: location || 'Arena Green Society (Quadra Principal)',
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 120,
        status: status || 'agendada'
      };

      db.matches.push(newMatch);

      // Manual schedule acts as confirmation of occurrence, so we resume recurrent Config if active
      if (db.recurrentConfig && !db.recurrentConfig.active) {
        db.recurrentConfig.active = true;
      }

      writeDb(db);
      return res.status(201).json(newMatch);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao criar partida.' });
    }
  });

  app.put('/api/matches/:id', (req, res) => {
    try {
      const { id } = req.params;
      const { date, time, location, durationMinutes, status } = req.body;

      const db = readDb();
      const index = db.matches.findIndex((m) => m.id === id);

      if (index === -1) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const previousStatus = db.matches[index].status;
      const updatedMatch = {
        ...db.matches[index],
        date: date || db.matches[index].date,
        time: time || db.matches[index].time,
        location: location || db.matches[index].location,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : db.matches[index].durationMinutes,
        status: status || db.matches[index].status
      };

      db.matches[index] = updatedMatch;

      // INTERRUPTION POLICY: Caso uma partida seja cancelada, a recorrência automática deve ser interrompida.
      if (updatedMatch.status === 'cancelada' && previousStatus !== 'cancelada') {
        if (db.recurrentConfig) {
          db.recurrentConfig.active = false; // Parar a recorrência
        }
      }

      // RESUMPTION POLICY: Se o administrador confirma ou agenda a partida manualmente, reativamos a recorrência
      if ((updatedMatch.status === 'agendada' || updatedMatch.status === 'confirmando') && previousStatus === 'cancelada') {
        if (db.recurrentConfig) {
          db.recurrentConfig.active = true; // Retomar a recorrência normal
        }
      }

      writeDb(db);
      return res.json(updatedMatch);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar partida.' });
    }
  });

  app.delete('/api/matches/:id', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();
      db.matches = db.matches.filter((m) => m.id !== id);
      db.presences = db.presences.filter((p) => p.matchId !== id);
      db.reserveAlerts = db.reserveAlerts.filter((a) => a.matchId !== id);

      writeDb(db);
      return res.json({ message: 'Partida excluída com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao remover partida.' });
    }
  });

  // ==========================================
  // --- RECURRENCE API ENDPOINTS & GENERATOR -
  // ==========================================

  app.get('/api/recurrent-config', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.recurrentConfig);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao ler config de recorrência.' });
    }
  });

  app.post('/api/recurrent-config', (req, res) => {
    try {
      const { dayOfWeek, time, location, durationMinutes, confirmationDeadlineDaysBefore, active } = req.body;

      const db = readDb();
      db.recurrentConfig = {
        dayOfWeek: parseInt(dayOfWeek),
        time,
        location: location || 'Arena Green Society (Quadra Principal)',
        durationMinutes: parseInt(durationMinutes),
        confirmationDeadlineDaysBefore: parseInt(confirmationDeadlineDaysBefore),
        active: active !== undefined ? !!active : true
      };

      writeDb(db);
      return res.json(db.recurrentConfig);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao salvar config de recorrência.' });
    }
  });

  app.post('/api/matches/generate-recurrent', (req, res) => {
    try {
      const db = readDb();
      const activeSeason = db.seasons.find((s) => s.active);

      if (!activeSeason) {
        return res.status(400).json({ error: 'Não há nenhuma temporada ativa para calcular recorrências.' });
      }

      const config = db.recurrentConfig;
      if (!config) {
        return res.status(400).json({ error: 'Configuração de recorrência inválida ou não configurada.' });
      }

      // Check current dates inside activeSeason dates
      const start = new Date(); // de hoje em diante
      const end = new Date(activeSeason.endDate);
      let createdCount = 0;

      // Iteramos dia por dia até o final da temporada
      let current = new Date(start);
      current.setHours(12, 0, 0, 0); // Evitar shifts de fuso horário

      while (current <= end) {
        if (current.getDay() === config.dayOfWeek) {
          const dateStr = current.toISOString().split('T')[0];
          const exists = db.matches.some((m) => m.date === dateStr);

          if (!exists) {
            db.matches.push({
              id: 'match-' + Date.now() + '-' + createdCount + '-' + Math.random().toString(36).substring(2, 9),
              seasonId: activeSeason.id,
              date: dateStr,
              time: config.time,
              location: config.location,
              durationMinutes: config.durationMinutes,
              status: 'agendada'
            });
            createdCount++;
          }
        }
        current.setDate(current.getDate() + 1);
      }

      // Quando o administrador gera / confirma a recorrência de forma expressa, garantimos que ela esteja ativa
      db.recurrentConfig.active = true;

      writeDb(db);
      return res.json({
        message: `Partidas recorrentes geradas com sucesso. Foram inseridos ${createdCount} rachas no calendário até ${activeSeason.endDate}.`,
        createdCount
      });
    } catch (err) {
      console.error('[Generate Recurrent]', err);
      return res.status(500).json({ error: 'Falha ao processar recorrência.' });
    }
  });

  // ==========================================
  // --- PRESENCES (CONFIRMAÇÕES DE RACHA) ---
  // ==========================================

  app.get('/api/matches/:matchId/presences', (req, res) => {
    try {
      const { matchId } = req.params;
      const db = readDb();

      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      const matchPresences = db.presences.filter((p) => p.matchId === matchId);
      const activePlayers = db.players.filter((p) => !p.deletedAt);

      // Merge players list with existing presence confirmations, defaults to 'nao_confirmado'
      const mergedList = activePlayers.map((player) => {
        const pres = matchPresences.find((p) => p.playerId === player.id);
        return {
          playerId: player.id,
          name: player.name,
          category: player.category,
          status: player.status,
          presenceStatus: pres ? pres.status : ('nao_confirmado' as PresenceStatus),
          confirmedAt: pres ? pres.confirmedAt : undefined
        };
      });

      // Sort list: mensalistas e mensalistas_goleiros first, reserves second!
      mergedList.sort((a, b) => {
        const catOrder: Record<string, number> = { mensalista_goleiro: 1, mensalista: 2, reserva: 3 };
        return (catOrder[a.category] || 99) - (catOrder[b.category] || 99);
      });

      return res.json({
        match,
        presences: mergedList
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar presenças.' });
    }
  });

  app.post('/api/matches/:matchId/presences/toggle', (req, res) => {
    try {
      const { matchId } = req.params;
      const { playerId, status } = req.body; // status: 'confirmado' | 'nao_confirmado' | 'cancelado'

      if (!playerId || !status) {
        return res.status(400).json({ error: 'playerId e status são obrigatórios.' });
      }

      const db = readDb();
      const match = db.matches.find((m) => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não existe.' });
      }

      const player = db.players.find((p) => p.id === playerId);
      if (!player) {
        return res.status(404).json({ error: 'Jogador não encontrado.' });
      }

      let presenceIndex = db.presences.findIndex((p) => p.matchId === matchId && p.playerId === playerId);
      let previousStatus: PresenceStatus = 'nao_confirmado';

      if (presenceIndex !== -1) {
        previousStatus = db.presences[presenceIndex].status;
        db.presences[presenceIndex].status = status;
        db.presences[presenceIndex].confirmedAt = status === 'confirmado' ? new Date().toISOString() : undefined;
      } else {
        db.presences.push({
          id: 'pres-' + Date.now(),
          matchId,
          playerId,
          status,
          confirmedAt: status === 'confirmado' ? new Date().toISOString() : undefined
        });
      }

      // LOGIC: Se o jogador que cancelou a presença já estava CONFIRMADO
      let alertCreated = null;
      if (previousStatus === 'confirmado' && status === 'cancelado') {
        // Encontrar primeiro reserva elegível (não confirmado ainda para este racha) por ordem do reservesOrder
        const activeReserves = db.players.filter((p) => p.category === 'reserva' && !p.deletedAt && p.status === 'disponivel');
        const activeReserveIds = activeReserves.map((p) => p.id);

        const unconfirmedReserves = activeReserves.filter((p) => {
          const pres = db.presences.find((pr) => pr.matchId === matchId && pr.playerId === p.id);
          return !pres || pres.status !== 'confirmado';
        });

        // Encontrar o topo da lista de prioridade (reservesOrder)
        let suggestedReservePlayerId: string | undefined = undefined;
        const currentReservesOrder = db.reservesOrder || [];

        for (const orderId of currentReservesOrder) {
          const isEligible = unconfirmedReserves.some((r) => r.id === orderId);
          if (isEligible) {
            suggestedReservePlayerId = orderId;
            break;
          }
        }

        // Se a ordem de prioridades estiver vazia, pegamos o primeiro reserva elegível
        if (!suggestedReservePlayerId && unconfirmedReserves.length > 0) {
          suggestedReservePlayerId = unconfirmedReserves[0].id;
        }

        const alertObj = {
          id: 'alert-' + Date.now(),
          matchId,
          cancelledPlayerId: playerId,
          suggestedReservePlayerId,
          createdAt: new Date().toISOString(),
          cleared: false
        };

        db.reserveAlerts.push(alertObj);
        alertCreated = alertObj;
      }

      writeDb(db);
      return res.json({
        message: 'Presença updated with success!',
        alertCreated
      });
    } catch (err) {
      console.error('[Toggle Presence Error]', err);
      return res.status(500).json({ error: 'Erro ao atualizar confirmação de presença.' });
    }
  });

  // ==========================================
  // --- DRAW BALANCING ENGINE ENDPOINTS -----
  // ==========================================

  // List all historic draws
  app.get('/api/draws/history', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.draws || []);
    } catch (err) {
      console.error('[Error getting draws history]:', err);
      return res.status(500).json({ error: 'Erro ao buscar histórico de sorteios.' });
    }
  });

  // Get active draw for a specific match
  app.get('/api/matches/:matchId/draw', (req, res) => {
    try {
      const { matchId } = req.params;
      const db = readDb();
      const draw = (db.draws || []).find((d) => d.matchId === matchId);
      if (!draw) {
        return res.status(404).json({ error: 'Nenhum sorteio registrado para esta partida.' });
      }
      return res.json(draw);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter sorteio.' });
    }
  });

  // Trigger a new smart draw for a specific match
  app.post('/api/matches/:matchId/draw', (req, res) => {
    try {
      const { matchId } = req.params;
      const { captainsConfigured, captains, isSharedGoalkeepers } = req.body;

      const db = readDb();
      const match = db.matches.find(m => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      // Filter confirmed players
      const confirmedPresences = db.presences.filter(p => p.matchId === matchId && p.status === 'confirmado');
      const confirmedPlayerIds = confirmedPresences.map(p => p.playerId);
      const confirmedPlayers = db.players.filter(p => confirmedPlayerIds.includes(p.id) && !p.deletedAt);

      if (confirmedPlayers.length === 0) {
        return res.status(400).json({ error: 'Não há jogadores confirmados nesta partida para realizar o sorteio.' });
      }

      // Precalculate overall rating for each player using the existing helper
      const playerOveralls: Record<string, number> = {};
      db.players.forEach((p) => {
        const metrics = computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
        playerOveralls[p.id] = metrics.overall;
      });

      // Run smart draw balancing
      const drawResult = runSmartDraw({
        confirmedPlayers,
        playerOveralls,
        duoAffinities: db.duoAffinities || [],
        trioAffinities: db.trioAffinities || [],
        captains: captainsConfigured ? captains : {},
        isSharedGoalkeepers: !!isSharedGoalkeepers
      });

      // Assemble final Draw object
      const newDraw = {
        id: 'draw-' + Date.now(),
        matchId,
        date: new Date().toISOString(),
        teams: drawResult.teams,
        overallBlue: drawResult.overallBlue,
        overallRed: drawResult.overallRed,
        overallGreen: drawResult.overallGreen,
        maxDifference: drawResult.maxDifference,
        isSharedGoalkeepers: !!isSharedGoalkeepers,
        captainsConfigured: !!captainsConfigured
      };

      // Remove previous draw for the same match if any
      db.draws = (db.draws || []).filter(d => d.matchId !== matchId);
      db.draws.push(newDraw);

      writeDb(db);
      return res.json(newDraw);
    } catch (err) {
      console.error('[Draw Generation Error]', err);
      return res.status(500).json({ error: 'Erro ao processar sorteio automático.' });
    }
  });

  // Manually update teams and recalculate overalls/metrics
  app.post('/api/draws/:drawId/update-manual', (req, res) => {
    try {
      const { drawId } = req.params;
      const { teams } = req.body; // updated groups configurations: DrawTeam[]

      if (!teams || !Array.isArray(teams)) {
        return res.status(400).json({ error: 'Lista de times formatada é obrigatória.' });
      }

      const db = readDb();
      const drawIndex = (db.draws || []).findIndex(d => d.id === drawId);
      if (drawIndex === -1) {
        return res.status(404).json({ error: 'Sorteio referenciado não foi encontrado.' });
      }

      const drawObj = db.draws[drawIndex];

      // Recompute overalls for the modified groups
      const playerOveralls: Record<string, number> = {};
      db.players.forEach((p) => {
        const metrics = computePlayerMetrics(p.id, p.primaryPosition, db.evaluations, db.evaluationHistory);
        playerOveralls[p.id] = metrics.overall;
      });

      // Find goalkeepers
      const goalkeepers = db.players.filter(p => p.primaryPosition === 'goleiro' && !p.deletedAt);

      const computedAllOveralls = teams.map(t => {
        let count = t.playerIds.length;
        if (count === 0) return 3.5;
        let sum = t.playerIds.reduce((s, pid) => s + (playerOveralls[pid] || 3.5), 0);
        
        if (drawObj.isSharedGoalkeepers && goalkeepers.length > 0) {
          // If shared, average gk rating is added to rating computation too
          const confGkIds = db.presences
            .filter(p => p.matchId === drawObj.matchId && p.status === 'confirmado')
            .map(p => p.playerId);
          const activeGks = goalkeepers.filter(g => confGkIds.includes(g.id));
          if (activeGks.length > 0) {
            const avgGkRating = activeGks.reduce((s, g) => s + (playerOveralls[g.id] || 3.5), 0) / activeGks.length;
            sum += avgGkRating;
            count += 1;
          }
        }
        
        return Math.round((sum / count) * 10) / 10;
      });

      const bOverall = computedAllOveralls[0] || 3.5;
      const rOverall = computedAllOveralls[1] || 3.5;
      const gOverall = computedAllOveralls[2] || 3.5;

      const maxRating = Math.max(bOverall, rOverall, gOverall);
      const minRating = Math.min(bOverall, rOverall, gOverall);
      const diff = Math.round((maxRating - minRating) * 10) / 10;

      // Update values
      drawObj.teams = teams;
      drawObj.overallBlue = bOverall;
      drawObj.overallRed = rOverall;
      drawObj.overallGreen = gOverall;
      drawObj.maxDifference = diff;

      // Update in db
      db.draws[drawIndex] = drawObj;
      writeDb(db);

      return res.json(drawObj);
    } catch (err) {
      console.error('[Manual Draw Update Error]', err);
      return res.status(500).json({ error: 'Erro ao recalcular ajuste de times.' });
    }
  });

  // Lock and Record historical partner affinity stats on final approval/lock
  app.post('/api/draws/:drawId/confirm-lock', (req, res) => {
    try {
      const { drawId } = req.params;
      const db = readDb();

      const drawObj = (db.draws || []).find(d => d.id === drawId);
      if (!drawObj) {
        return res.status(404).json({ error: 'Sorteio não encontrado.' });
      }

      // Initialize collections if they don't exist
      db.duoAffinities = db.duoAffinities || [];
      db.trioAffinities = db.trioAffinities || [];

      // Record affinity increments for each team's players
      drawObj.teams.forEach(t => {
        const teamPlayers = t.playerIds;
        recordAffinities(teamPlayers, db.duoAffinities, db.trioAffinities);
      });

      writeDb(db);
      return res.json({ message: 'Sorteio consolidado com sucesso! Afinidade de duplas e trios atualizada para novas partidas.' });
    } catch (err) {
      console.error('[Error Locking Draw]', err);
      return res.status(500).json({ error: 'Falha ao consolidar relações de afinidades.' });
    }
  });

  // ==========================================
  // --- MATCH RESULTS & STATISTICS ENDPONES ---
  // ==========================================

  // List all historic match results
  app.get('/api/results', (req, res) => {
    try {
      const db = readDb();
      return res.json(db.results || []);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar resultados.' });
    }
  });

  // Get a single result by matchId
  app.get('/api/results/:matchId', (req, res) => {
    try {
      const { matchId } = req.params;
      const db = readDb();
      const result = (db.results || []).find((r) => r.matchId === matchId);
      if (!result) {
        return res.status(404).json({ error: 'Nenhum resultado para esta partida.' });
      }
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar resultado.' });
    }
  });

  // Get computed tournament statistics and rankings
  app.get('/api/stats', (req, res) => {
    try {
      const { seasonId } = req.query;
      const db = readDb();
      
      const stats = computeStatsForSeason({
        players: db.players,
        matches: db.matches,
        presences: db.presences,
        results: db.results || [],
        seasonId: seasonId as string || null
      });

      return res.json(stats);
    } catch (err) {
      console.error('[Error generating stats]:', err);
      return res.status(500).json({ error: 'Erro ao processar estatísticas de jogo.' });
    }
  });

  // Post/register results for a match
  app.post('/api/matches/:matchId/results', (req, res) => {
    try {
      const { matchId } = req.params;
      const { winsBlue, winsRed, winsGreen } = req.body;

      if (winsBlue === undefined || winsRed === undefined || winsGreen === undefined) {
        return res.status(400).json({ error: 'É necessário preencher as vitórias de todas as equipes.' });
      }

      const db = readDb();
      const match = db.matches.find(m => m.id === matchId);
      if (!match) {
        return res.status(404).json({ error: 'Partida não encontrada.' });
      }

      // Check for matching team draw configurations
      const draw = (db.draws || []).find(d => d.matchId === matchId);
      if (!draw) {
        return res.status(400).json({ error: 'É necessário realizar o sorteio de times antes de registrar o resultado da partida.' });
      }

      // Determine who won this match
      const maxWins = Math.max(winsBlue, winsRed, winsGreen);
      const champions: ('Azul' | 'Vermelho' | 'Verde')[] = [];
      if (winsBlue === maxWins) champions.push('Azul');
      if (winsRed === maxWins) champions.push('Vermelho');
      if (winsGreen === maxWins) champions.push('Verde');

      // Build the match result object
      const newResult: MatchResult = {
        id: 'result-' + Date.now(),
        matchId,
        seasonId: match.seasonId,
        date: match.date,
        winsBlue: parseInt(winsBlue),
        winsRed: parseInt(winsRed),
        winsGreen: parseInt(winsGreen),
        champions,
        teams: draw.teams,
        isSharedGoalkeepers: draw.isSharedGoalkeepers
      };

      // Transition match state to encerrada
      match.status = 'encerrada';

      // Safe initialization of collections
      db.results = db.results || [];
      db.results = db.results.filter(r => r.matchId !== matchId); // remove any old duplicate result
      db.results.push(newResult);

      db.duoAffinities = db.duoAffinities || [];
      db.trioAffinities = db.trioAffinities || [];

      // Record played and wins count directly for teams
      draw.teams.forEach(t => {
        const teamPlayers = t.playerIds;
        const isChamp = champions.includes(t.name);

        // Record general partnership count played together first
        recordAffinities(teamPlayers, db.duoAffinities, db.trioAffinities);

        // Record won together (increment winsCount)
        if (isChamp) {
          // Duo partners wins count
          for (let i = 0; i < teamPlayers.length; i++) {
            for (let j = i + 1; j < teamPlayers.length; j++) {
              const first = teamPlayers[i] < teamPlayers[j] ? teamPlayers[i] : teamPlayers[j];
              const second = teamPlayers[i] < teamPlayers[j] ? teamPlayers[j] : teamPlayers[i];
              const recIdx = db.duoAffinities.findIndex(a => a.playerAId === first && a.playerBId === second);
              if (recIdx >= 0) {
                db.duoAffinities[recIdx].winsCount = (db.duoAffinities[recIdx].winsCount || 0) + 1;
              }
            }
          }

          // Trio partners wins count
          for (let i = 0; i < teamPlayers.length; i++) {
            for (let j = i + 1; j < teamPlayers.length; j++) {
              for (let k = j + 1; k < teamPlayers.length; k++) {
                const sorted = [teamPlayers[i], teamPlayers[j], teamPlayers[k]].sort();
                const recIdx = db.trioAffinities.findIndex(a => 
                  a.playerAId === sorted[0] && 
                  a.playerBId === sorted[1] && 
                  a.playerCId === sorted[2]
                );
                if (recIdx >= 0) {
                  db.trioAffinities[recIdx].winsCount = (db.trioAffinities[recIdx].winsCount || 0) + 1;
                }
              }
            }
          }
        }
      });

      // --- STREAK UPDATE FOR PLAYERS ---
      const blueTeamPlayerIds = new Set(draw.teams.find(t => t.name === 'Azul')?.playerIds || []);
      const redTeamPlayerIds = new Set(draw.teams.find(t => t.name === 'Vermelho')?.playerIds || []);
      const greenTeamPlayerIds = new Set(draw.teams.find(t => t.name === 'Verde')?.playerIds || []);

      const activePlayersForStreaks = db.players.filter(p => !p.deletedAt);
      const confPlayerIds = new Set(
        (db.presences || [])
          .filter(p => p.matchId === matchId && p.status === 'confirmado')
          .map(p => p.playerId)
      );

      activePlayersForStreaks.forEach((player) => {
        // Did they play? Or are they in the team lists?
        const isPresent = confPlayerIds.has(player.id) || 
                          blueTeamPlayerIds.has(player.id) || 
                          redTeamPlayerIds.has(player.id) || 
                          greenTeamPlayerIds.has(player.id);

        if (!isPresent) return; // If they did not play, their streak remains unchanged

        // Did they win?
        let won = false;
        const isGoalkeeper = player.primaryPosition === 'goleiro';

        if (draw.isSharedGoalkeepers && isGoalkeeper) {
          // Shared GKs win if any team wins (unless all got 0 wins)
          won = champions.length > 0;
        } else {
          // They win if their team name is in champions list
          const teamNameOfPlayer = blueTeamPlayerIds.has(player.id) ? 'Azul' : 
                                   redTeamPlayerIds.has(player.id) ? 'Vermelho' : 
                                   greenTeamPlayerIds.has(player.id) ? 'Verde' : null;
          if (teamNameOfPlayer && champions.includes(teamNameOfPlayer)) {
            won = true;
          }
        }

        // Initialize values safely
        if (player.currentStreak === undefined) player.currentStreak = 0;
        if (player.maxStreak === undefined) player.maxStreak = 0;

        if (won) {
          player.currentStreak++;
          if (player.currentStreak > player.maxStreak) {
            player.maxStreak = player.currentStreak;
          }
        } else {
          player.currentStreak = 0; // Reset streak
        }
        player.updatedAt = new Date().toISOString();
      });

      writeDb(db);
      return res.json({ message: 'Resultado do racha gravado com sucesso!', result: newResult });
    } catch (err) {
      console.error('[Error posting match results]', err);
      return res.status(500).json({ error: 'Erro ao registrar resultado.' });
    }
  });

  // ==========================================
  // --- CONTROL OF RESERVES ALERTS & PRIO ---
  // ==========================================

  app.get('/api/reserves/order', (req, res) => {
    try {
      const db = readDb();
      const activeReserves = db.players.filter((p) => p.category === 'reserva' && !p.deletedAt);

      // Sort by reservesOrder
      const order = db.reservesOrder || [];
      const sorted = [...activeReserves].sort((a, b) => {
        let idxA = order.indexOf(a.id);
        let idxB = order.indexOf(b.id);
        if (idxA === -1) idxA = 999;
        if (idxB === -1) idxB = 999;
        return idxA - idxB;
      });

      return res.json({
        reserves: sorted,
        order
      });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao buscar prioridade de reservas.' });
    }
  });

  app.post('/api/reserves/order', (req, res) => {
    try {
      const { reorderedIds } = req.body;
      if (!reorderedIds || !Array.isArray(reorderedIds)) {
        return res.status(400).json({ error: 'Lista de IDs reordenada é obrigatória.' });
      }

      const db = readDb();
      db.reservesOrder = reorderedIds;
      writeDb(db);

      return res.json({ message: 'Ordem da lista de reservas salva com sucesso!', order: db.reservesOrder });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao atualizar prioridade de reservas.' });
    }
  });

  app.get('/api/reserve-alerts', (req, res) => {
    try {
      const db = readDb();
      const uncleared = db.reserveAlerts.filter((a) => !a.cleared);

      const enrichedAlerts = uncleared.map((a) => {
        const matchObj = db.matches.find((m) => m.id === a.matchId);
        const cancelledPlayer = db.players.find((p) => p.id === a.cancelledPlayerId);
        const suggestedReserve = a.suggestedReservePlayerId
          ? db.players.find((p) => p.id === a.suggestedReservePlayerId)
          : null;

        return {
          ...a,
          matchDate: matchObj ? matchObj.date : '',
          matchTime: matchObj ? matchObj.time : '',
          cancelledPlayerName: cancelledPlayer ? cancelledPlayer.name : 'Jogador Desconhecido',
          suggestedReservePlayerName: suggestedReserve ? suggestedReserve.name : 'Nenhum reserva disponível'
        };
      });

      return res.json(enrichedAlerts);
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao obter alertas de reservas.' });
    }
  });

  app.post('/api/reserve-alerts/:id/clear', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();

      const alertIndex = db.reserveAlerts.findIndex((a) => a.id === id);
      if (alertIndex !== -1) {
        db.reserveAlerts[alertIndex].cleared = true;
      }

      writeDb(db);
      return res.json({ message: 'Alerta removido.' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao remover alerta.' });
    }
  });

  app.post('/api/reserve-alerts/:id/summon', (req, res) => {
    try {
      const { id } = req.params;
      const db = readDb();

      const alertIndex = db.reserveAlerts.findIndex((a) => a.id === id);
      if (alertIndex === -1) {
        return res.status(404).json({ error: 'Alerta não encontrado.' });
      }

      const alert = db.reserveAlerts[alertIndex];
      if (!alert.suggestedReservePlayerId) {
        return res.status(400).json({ error: 'Não há reserva indicado para efetivar a convocação.' });
      }

      // Encontrar ou atualizar presença do reserva indicado para "confirmado"!
      const matchId = alert.matchId;
      const reserveId = alert.suggestedReservePlayerId;

      let presenceIndex = db.presences.findIndex((p) => p.matchId === matchId && p.playerId === reserveId);
      if (presenceIndex !== -1) {
        db.presences[presenceIndex].status = 'confirmado';
        db.presences[presenceIndex].confirmedAt = new Date().toISOString();
      } else {
        db.presences.push({
          id: 'pres-' + Date.now(),
          matchId,
          playerId: reserveId,
          status: 'confirmado',
          confirmedAt: new Date().toISOString()
        });
      }

      // Marcar alerta como limpo
      db.reserveAlerts[alertIndex].cleared = true;

      writeDb(db);
      return res.json({ message: 'Reserva convocado com sucesso!' });
    } catch (err) {
      return res.status(500).json({ error: 'Erro ao processar convocação.' });
    }
  });

  // --- Vite Dev Server Middleware / Static Client serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Racha do Fofim running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Falha ao iniciar o servidor:', err);
});
