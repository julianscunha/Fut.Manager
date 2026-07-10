# FASE 2 — UX/UI ESPORTIVO
# ETAPA 3 — DIREÇÃO DE ARTE E COMPOSIÇÃO DA HOME

Este documento define as diretrizes estéticas e a **Direção de Arte** oficial para a Home Dinâmica do **Fut.Manager**. Ele atua como o manual visual obrigatório para a construção das interfaces, garantindo consistência, emoção esportiva e alta legibilidade em todas as circunstâncias de jogo.

---

## 🎨 1. CONCEITO CENTRAL: "APLICATIVO DE CLUBE"
A Home do Fut.Manager não deve remeter a um painel corporativo, planilha de escritório ou ferramenta financeira genérica. Ela foi projetada para emular os aplicativos oficiais de grandes ligas esportivas (NFL, FIFA, UEFA Champion League), onde o atleta se sente imerso na atmosfera tática de um vestiário minutos antes de entrar em campo.

### Princípios Diretores:
* **Sentimento de Pertencimento:** "Ao abrir o app, eu não vejo apenas estatísticas, eu sinto que faço parte de um time oficial."
* **Densidade Tática:** Organização espacial baseada em grids fluidos e blocos integrados, evitando tabelas cinzentas ou listas sem graça.
* **Ambientação "Premium Dark":** Fundo em escala de grafites profundos e carvão que emitem foco e elegância, com brilhos (glows) acentuando informações cruciais.

---

## 📐 2. COMPOSIÇÃO DA HOME EM 5 CAMADAS VISUAIS

A tela é montada verticalmente em uma hierarquia de profundidade que segue a velocidade de leitura mobile:

```
┌───────────────────────────────────────────────────────────┐
│ CAMADA 1: HERO (35% a 40% da Tela - O Protagonista)      │
│ Imagem de fundo opaca, grande título e contagem regressiva │
├───────────────────────────────────────────────────────────┤
│ CAMADA 2: AÇÃO PRINCIPAL (CTA de Impacto Único)           │
│ Botão gigante com gradiente e glow para guiar o dedão     │
├───────────────────────────────────────────────────────────┤
│ CAMADA 3: STATUS PESSOAL (Identidade do Atleta)           │
│ Cartão esportivo com OVR, posição e sequência de badges    │
├───────────────────────────────────────────────────────────┤
│ CAMADA 4: STATUS DO GRUPO (Informação Coletiva)           │
│ Lista visual de confirmados e fila de reservas tática      │
├───────────────────────────────────────────────────────────┤
│ CAMADA 5: SOCIAL (Resenha, Fotos e Conquistas)            │
│ Galeria de mídias, últimos MVPs e histórias do racha      │
└───────────────────────────────────────────────────────────┘
```

### Camada 1 — Hero (O Protagonista)
* **Visual:** Ocupa a parte superior da tela com um gradiente suave que se funde com o fundo escuro da página. Pode apresentar texturas que remetem a grama sintética ou asfalto molhado.
* **Destaques:** Grande contagem regressiva para o jogo ou placar do time em destaque na cor camuflada correspondente.

### Camada 2 — Ação Principal (CTA Dominante)
* **Regra de Ouro:** Apenas **UMA** ação principal com alto destaque visual por tela.
* **Estilo:** Botões amplos de cantos arredondados (`rounded-2xl`), utilizando gradientes brilhantes baseados em verde esmeralda (para confirmação) ou dourado (para avaliações).
* **Feedback Físico:** Sutil brilho de contorno (`glow`) pulsante no mobile para atrair a atenção ergonômica sem poluir a leitura.

### Camada 3 — Status Pessoal (A "Ficha" de Jogador)
* **Visual:** Substitui as velhas tabelas por um layout inspirado nos cartões clássicos do *Ultimate Team* (FIFA).
* **Elementos:**
  * OVR do jogador em tamanho display destacado em tipografia mono.
  * Coleção de Badges de Presença (Pontual, Comprometido, Inabalável) dispostas como selos de honra com efeitos metálicos.
  * Gráfico radar minimalista de evolução de notas técnicas.

### Camada 4 — Status do Grupo (O Vestiário)
* **Visual:** Exibição tática dos confirmados utilizando pequenos avatares circulares organizados em um mini-campo ou em grids compactos subdivididos por posições de atuação (GK, DEF, MEI, ATA).
* **Reserva:** Fila de espera representada por uma barra de progresso horizontal moderna em tom âmbar sóbrio.

### Camada 5 — Social (A Resenha de Fim de Jogo)
* **Visual:** Visualizador de fotos tipo carrossel horizontal flutuante, cartões de parabenização aos MVPs da semana com efeitos dourados e lembranças de lances históricos preservados no Museu.

---

## 🎨 3. PALETA DE CORES REGULAMENTAR

O sistema utiliza cores contrastantes de forma cirúrgica para indicar estados e pesos táticos sem criar cansaço visual:

* **Fundo Primário (Deep Black):** `#09090b` (`zinc-950`) — Escuridão de estádio à noite.
* **Superfícies de Cartões (Carbon Charcoal):** `#18181b` (`zinc-900`) misturado com transparências (`bg-zinc-900/60 backdrop-blur-md`).
* **Verde Campo (Ação / Sucesso):** `#10b981` (`emerald-500`) — Representa convocação aberta, vagas disponíveis e atletas confirmados.
* **Dourado Glória (Destaque / Conquista):** `#f59e0b` (`amber-500`) — Representa notas altas, MVPs, badges lendárias e certificação estatística.
* **Azul Campeão (Cor de Equipe):** `#2563eb` (`blue-600`) — Cor oficial do Time Azul do racha.
* **Vermelho Alerta (Urgência / Erro):** `#ef4444` (`rose-500`) — Utilizado estritamente para faltas, suspensões ou desclassificação estatística.

---

## ✍️ 4. TIPOGRAFIA E RITMO VISUAL

As fontes aplicadas carregam o dinamismo e a precisão do esporte:

* **Títulos Principais & Displays:** `Space Grotesk` ou `Inter` (sans-serif) em peso pesado (`font-black` ou `font-bold`), com espaçamento ligeiramente comprimido (`tracking-tight`) para dar robustez e impacto de manchete esportiva.
* **Dados, Números & Notas:** `JetBrains Mono` ou `Fira Code` (monospace) em todas as exibições de notas, OVR, placares e cronômetros, denotando exatidão de cronômetro profissional de arbitragem.
* **Textos de Apoio:** `Inter` (sans-serif) regular para excelente legibilidade mesmo sob forte luz solar na beira do campo.

---

## ⚡ 5. MICROINTERAÇÕES E ANIMAÇÕES DINÂMICAS

Animações refinadas e discretas reforçam o espírito de gameficação esportiva, limitadas a um teto de **300ms** para evitar sensação de lentidão:

1. **Efeito Desbloqueio de Badge (Unlock):**
   * Ao conquistar uma badge nova, o ícone correspondente faz uma animação de escala suave (0.8x -> 1.1x -> 1.0x) acompanhada de uma explosão discreta de partículas brilhantes na cor dourada.
2. **Navegação de Times (Swipe):**
   * O carrossel de equipes do sorteio desliza suavemente com efeito de paralaxe 3D leve nas abas laterais.
3. **Pulsar do CTA:**
   * O botão principal de "VOU JOGAR!" emite ondas de opacidade sutis no seu gradiente esmeralda de fundo quando o atleta ainda possui pendência de resposta.

---

## 📱 6. DIRETRIZES MOBILE-FIRST E ACESSIBILIDADE

* **Zona do Polegar (Thumb Zone):** Os botões mais cruciais (Confirmação, Cancelamento e Avaliações) ficam centralizados na metade inferior da tela do smartphone, facilitando o uso rápido com apenas uma mão.
* **Área de Toque Confortável:** Touch targets de no mínimo **48px x 48px** em todos os seletores e botões interativos para evitar cliques acidentais no asfalto.
* **Contraste de Rigor (WCAG AAA):** Elementos textuais mantêm alta relação de contraste contra as superfícies pretas e grafites, acompanhados sempre de ícones representativos (`lucide-react`) para que as cores não sejam o único meio de identificação de status.

---

## 📋 7. PRÓXIMOS PASSOS: DRAFTS DA HOME DINÂMICA
Conforme especificado pelo fluxo regulamentar, a próxima etapa consistirá na elaboração detalhada de **3 Rascunhos Conceituais Completos** representando cenários essenciais do app antes do início da reestruturação visual do código:
1. **Rascunho A:** Visão do Atleta no Estado "Convocação Aberta" (Foco em RSVP e urgência de vagas).
2. **Rascunho B:** Visão do Atleta no Estado "Times Sorteados" (Foco na experiência "Meu Time" e táticas).
3. **Rascunho C:** Visão do Administrador no Estado "Convocação Encerrada" (Foco em ferramentas de governança discretas).

Este guia está formalmente consolidado e servirá como a bíblia estética do Fut.Manager.
