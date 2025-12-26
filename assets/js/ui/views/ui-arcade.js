/**
 * UI-ARCADE (THE BRAIN GYM)
 * Version: 2.4.0 (Patched: Dual Theme Support & Telemetry)
 * Path: assets/js/ui/views/ui-arcade.js
 * Responsibilities:
 * 1. Renders the Arcade Dashboard (Game Selection).
 * 2. Manages the "Game Shell" (Canvas, Score, Timer).
 * 3. Contains logic for 3 Mini-Games with Sound & Haptics.
 * 4. Sends Active Signals to Behavioral Engine.
 */

import { CONFIG } from '../../config.js';
import { UI } from '../ui-manager.js';
// ✅ FIX: Import Behavioral Engine to enable "Active Signal" tracking
import { BehavioralEngine } from '../../engine/behavioral-engine.js';

export const UIArcade = {
    // ============================================================
    // 1. STATE & CONFIG
    // ============================================================
    state: {
        activeGameId: null,
        score: 0,
        isPlaying: false,
        timer: null,
        interval: null,
        ctx: null, // Canvas Context for visual games
        audioCtx: null // Web Audio API Context
    },

    // ============================================================
    // 2. VIEW INITIALIZATION (DASHBOARD)
    // ============================================================

    render(container) {
        console.log("🎮 UIArcade: Entering the Gym...");
        
        // 1. Clear & Setup
        container.innerHTML = '';
        container.className = 'view-container pb-40 min-h-screen select-none';

        // 2. Render Dashboard (Menu)
        container.innerHTML = this._getDashboardTemplate();

        // 3. Init Audio Context (User gesture required later)
        if (!this.state.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) this.state.audioCtx = new AudioContext();
        }
    },

    // Cleanup Hook to prevent Ghosting
    onUnmount() {
        console.log("🎮 UIArcade: Unmounting & Cleaning up...");
        this._cleanupGame();
        if (this.state.audioCtx) {
            this.state.audioCtx.close();
            this.state.audioCtx = null;
        }
    },

    /**
     * Generates the Main Menu HTML
     */
    _getDashboardTemplate() {
        // Fetch modes from CONFIG.arcadeModes
        const modes = CONFIG.arcadeModes || [];

        const cardsHTML = modes.map(mode => `
            <button onclick="UIArcade.launchGame('${mode.id}')" class="premium-card w-full p-6 text-left group relative overflow-hidden transition-all duration-300 hover:scale-[1.02] bg-white dark:bg-slate-900/50 shadow-sm rounded-[24px] border border-slate-100 dark:border-white/5">
                
                <div class="relative z-10 flex items-start gap-4">
                    <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-lg bg-${mode.color}-50 dark:bg-${mode.color}-500/10 text-${mode.color}-600 dark:text-${mode.color}-400">
                        <i class="fa-solid fa-${mode.icon}"></i>
                    </div>
                    
                    <div class="flex-1">
                        <h3 class="text-lg font-black uppercase tracking-wide mb-1 text-slate-900 dark:text-white">${mode.name}</h3>
                        <p class="text-xs font-medium opacity-60 leading-relaxed text-slate-500 dark:text-slate-400">${mode.description}</p>
                    </div>
                    
                    <div class="self-center opacity-30 group-hover:opacity-100 transition-all text-slate-900 dark:text-white">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            </button>
        `).join('');

        return `
        <header class="sticky top-0 z-30 px-6 py-6 flex items-center justify-between safe-area-pt bg-slate-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5 transition-colors">
            <div>
                <h2 class="text-xs font-black uppercase tracking-widest mb-1 text-slate-500 dark:text-slate-400">Cognitive Training</h2>
                <h1 class="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Brain Gym</h1>
            </div>
            <div class="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-white/50">
                <i class="fa-solid fa-dumbbell"></i>
            </div>
        </header>

        <main class="dashboard-grid animate-slide-up px-4 gap-4 flex flex-col pt-4">
            ${cardsHTML}
            
            <div class="premium-card opacity-50 border-dashed border-2 border-slate-300 dark:border-white/10 pointer-events-none p-6 flex flex-col items-center justify-center text-center gap-2 rounded-[24px]">
                <i class="fa-solid fa-lock text-2xl text-slate-400 dark:text-slate-600"></i>
                <div class="text-xs font-bold uppercase text-slate-400 dark:text-slate-600">More Modes Locked</div>
            </div>
        </main>
        `;
    },

    // ============================================================
    // 3. GAME LAUNCHER (THE ARENA)
    // ============================================================

    launchGame(gameId) {
        console.log(`🎮 UIArcade: Launching ${gameId}...`);
        
        // Ensure clean state before starting
        this._cleanupGame();

        // Resume Audio Context (Browser policy requires gesture)
        if (this.state.audioCtx && this.state.audioCtx.state === 'suspended') {
            this.state.audioCtx.resume();
        }

        this.state.activeGameId = gameId;
        this.state.score = 0;
        this.state.isPlaying = true;

        // 1. Hide Dashboard / Show Game Shell
        const app = document.getElementById('app-container');
        app.innerHTML = this._getGameShellTemplate(gameId);

        // 2. Cache DOM Elements
        this.dom = {
            score: document.getElementById('game-score'),
            timer: document.getElementById('game-timer'),
            canvas: document.getElementById('game-canvas'),
            container: document.getElementById('game-container')
        };

        // 3. Start Specific Game Logic
        if (gameId === 'blink_test') this._initBlinkTest();
        else if (gameId === 'pressure_valve') this._initPressureValve();
        else if (gameId === 'pattern_architect') this._initPatternArchitect();
        else if (gameId === 'balloon_pop') this._initBalloonPop(); // Placeholder if needed
        
        // 4. Hide Main Nav (Focus Mode)
        if (window.UIHeader) UIHeader.toggle(false);
    },

    quitGame() {
        this._cleanupGame();
        if (window.UIHeader) UIHeader.toggle(true);
        const app = document.getElementById('app-container');
        this.render(app);
    },

    _cleanupGame() {
        this.state.isPlaying = false;
        
        if (this.state.interval) {
            clearInterval(this.state.interval);
            this.state.interval = null;
        }
        if (this.state.timer) {
            clearTimeout(this.state.timer);
            this.state.timer = null;
        }

        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        this.state.ctx = null;
    },

    // ============================================================
    // 4. SOUND & HAPTICS ENGINE (NEW)
    // ============================================================

    _playSound(type) {
        if (!this.state.audioCtx) return;

        const ctx = this.state.audioCtx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;

        if (type === 'pop') {
            // Success Pop (High Pitch Short)
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } 
        else if (type === 'error') {
            // Error Buzz (Low Pitch Sawtooth)
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(100, now + 0.3);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
        else if (type === 'level-up') {
            // Level Up (Arpeggio)
            this._playSound('pop');
            setTimeout(() => this._playSound('pop'), 100);
            setTimeout(() => this._playSound('pop'), 200);
        }
        else if (type === 'tick') {
            // Clock Tick
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        }
    },

    _vibrate(pattern) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    },

    // ============================================================
    // 5. TEMPLATE: GAME SHELL
    // ============================================================

    _getGameShellTemplate(gameId) {
        const config = CONFIG.arcadeModes.find(m => m.id === gameId);
        
        return `
        <div class="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            
            <header class="h-20 px-6 flex items-center justify-between border-b border-slate-200 dark:border-white/5 relative z-20 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md">
                <div class="flex flex-col">
                    <span class="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Score</span>
                    <span id="game-score" class="text-3xl font-black font-mono tracking-tighter text-slate-900 dark:text-white">0</span>
                </div>

                <div class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div class="w-16 h-16 rounded-full flex items-center justify-center text-2xl animate-pulse bg-${config.color}-50 dark:bg-${config.color}-500/20 text-${config.color}-600 dark:text-${config.color}-400">
                        <i class="fa-solid fa-${config.icon}"></i>
                    </div>
                </div>

                <button onclick="UIArcade.quitGame()" class="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/5 text-slate-500 dark:text-white/50 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </header>

            <main id="game-container" class="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
                <canvas id="game-canvas" class="absolute inset-0 w-full h-full opacity-0 transition-opacity duration-500"></canvas>
                
                <div id="game-start-overlay" class="text-center z-10 animate-fade-in p-8">
                    <h2 class="font-black text-2xl mb-2 text-slate-900 dark:text-white">Ready?</h2>
                    <p class="text-sm mb-6 max-w-[200px] mx-auto text-slate-500 dark:text-slate-400 leading-relaxed">${config.description}</p>
                    <button onclick="UIArcade.startGameLoop()" class="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold uppercase tracking-widest shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95 transition-all">
                        Start
                    </button>
                </div>
            </main>

            <footer class="h-24 pb-8 flex items-center justify-center relative z-20 pointer-events-none px-8">
                <div class="w-full max-w-xs rounded-full h-2 overflow-hidden bg-slate-200 dark:bg-white/5">
                    <div id="game-timer" class="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" style="width: 100%"></div>
                </div>
            </footer>
        </div>
        `;
    },
    
    startGameLoop() {
        const overlay = document.getElementById('game-start-overlay');
        if (overlay) overlay.style.display = 'none';
        
        const canvas = document.getElementById('game-canvas');
        if (canvas) canvas.classList.remove('opacity-0');

        this._playSound('level-up'); // Start sound

        if (this.state.activeGameId === 'blink_test') this._runBlinkLoop();
        if (this.state.activeGameId === 'pressure_valve') this._runPressureLoop();
        if (this.state.activeGameId === 'pattern_architect') this._startPatternLevel();
        if (this.state.activeGameId === 'balloon_pop') this._initBalloonPop();
    },

    // ============================================================
    // 6. MINI-GAME: BLINK TEST (REACTION SPEED)
    // ============================================================

    _initBlinkTest() {
        this.gameData = {
            lives: 3,
            spawnRate: 2000,
            targetsClicked: 0
        };
        if (this.dom.timer) this.dom.timer.style.width = '100%';
    },

    _runBlinkLoop() {
        this.dom.container.innerHTML = ''; 
        this._spawnBlinkTarget();

        let timeLeft = 60;
        this.state.interval = setInterval(() => {
            if (!this.state.isPlaying) return;

            timeLeft--;
            const pct = (timeLeft / 60) * 100;
            if (this.dom.timer) this.dom.timer.style.width = `${pct}%`;

            if (timeLeft % 10 === 0) {
                this.gameData.spawnRate = Math.max(600, this.gameData.spawnRate - 200);
            }

            if (timeLeft <= 0) this._endGame(true);
        }, 1000);
    },

    _spawnBlinkTarget() {
        if (!this.state.isPlaying) return;

        const container = this.dom.container;
        const maxX = container.clientWidth - 80; 
        const maxY = container.clientHeight - 80;
        
        const x = Math.random() * maxX + 40;
        const y = Math.random() * maxY + 40;

        const target = document.createElement('div');
        // Cyan is visible on both Dark and Light (if slight shadow used)
        target.className = 'absolute w-16 h-16 rounded-full bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.6)] cursor-pointer active:scale-90 transition-transform animate-pulse';
        target.style.left = `${x}px`;
        target.style.top = `${y}px`;

        const spawnTime = Date.now();
        let clicked = false;

        target.onmousedown = (e) => {
            e.stopPropagation();
            clicked = true;
            
            this._playSound('pop');
            this._vibrate(10); // Haptic

            const reactionTime = Date.now() - spawnTime;
            let points = 100;
            if (reactionTime < 600) points += 50; 
            if (reactionTime < 400) points += 100;

            this._addScore(points);
            this._showFloatingText(x, y, `+${points}`, "text-cyan-600 dark:text-cyan-300");

            target.remove();
            clearTimeout(despawnTimer);
            setTimeout(() => this._spawnBlinkTarget(), Math.random() * 500 + 200);
        };

        container.appendChild(target);

        const despawnTimer = setTimeout(() => {
            if (!clicked && this.state.isPlaying) {
                target.remove();
                this._handleMiss();
                this._spawnBlinkTarget();
            }
        }, this.gameData.spawnRate);
    },

    _handleMiss() {
        this.gameData.lives--;
        this._playSound('error');
        this._vibrate([50, 50, 50]); // Heavy haptic

        const flash = document.createElement('div');
        flash.className = 'absolute inset-0 bg-rose-500/30 z-40 pointer-events-none animate-fade-in';
        this.dom.container.appendChild(flash);
        setTimeout(() => flash.remove(), 200);

        if (this.gameData.lives <= 0) {
            this._endGame(false);
        }
    },

    _addScore(pts) {
        this.state.score += pts;
        if (this.dom.score) {
            this.dom.score.textContent = this.state.score;
            this.dom.score.classList.remove('scale-110');
            void this.dom.score.offsetWidth; 
            this.dom.score.classList.add('scale-110');
        }
    },

    _showFloatingText(x, y, text, colorClass = "text-cyan-600 dark:text-cyan-300") {
        const float = document.createElement('div');
        float.className = `absolute ${colorClass} font-black text-xl pointer-events-none animate-slide-up`;
        float.style.left = `${x}px`;
        float.style.top = `${y - 20}px`;
        float.textContent = text;
        this.dom.container.appendChild(float);
        setTimeout(() => float.remove(), 500);
    },

    // ✅ FIX: NEW METHOD TO BRIDGE GAP WITH BEHAVIORAL ENGINE
    _sendTelemetry(win) {
        if (!BehavioralEngine) return;

        console.log("🎮 UIArcade: Sending Telemetry to Psychologist...");

        // 1. Normalize Score (0.0 to 1.0) based on game type
        let normalizedScore = 0.5;
        let metrics = {};

        if (this.state.activeGameId === 'blink_test') {
            // Max expected score approx 2000 for good performance
            normalizedScore = Math.min(1.0, this.state.score / 2000); 
            metrics = { recoveryRate: win ? 0.8 : 0.4 }; 
        } 
        else if (this.state.activeGameId === 'pressure_valve') {
            // High pressure survival = High Calm
            normalizedScore = Math.min(1.0, this.state.score / 1500); 
            metrics = { reactionTime: 1200 }; // Mock avg reaction
        }
        else if (this.state.activeGameId === 'pattern_architect') {
             // Level 5+ is genius territory
             const level = this.gameData.level || 1;
             normalizedScore = Math.min(1.0, level / 8);
             metrics = { adaptability: win ? 0.9 : 0.5 };
        }

        // 2. Send Signal
        const gameType = this.state.activeGameId.toUpperCase();
        
        // This actually updates the "Psych Profile"
        BehavioralEngine.processArcadeSignal(gameType, { 
            score: parseFloat(normalizedScore.toFixed(2)),
            metrics: metrics
        });
    },

    // ✅ FIX: Updated _endGame to call telemetry
    _endGame(win) {
        this.state.isPlaying = false;
        clearInterval(this.state.interval);
        
        // SEND DATA BEFORE ALERT
        this._sendTelemetry(win);

        this._playSound('error');
        // Simple alert is fine for arcade, keeps flow fast
        alert(`Game Over! Score: ${this.state.score}`);
        this.quitGame();
    },

    // ============================================================
    // 7. MINI-GAME: PRESSURE VALVE (STRESS MANAGEMENT)
    // ============================================================

    _initPressureValve() {
        this.gameData = {
            pressure: 50,
            riseRate: 0.2,
            currentQ: null
        };
        
        this.dom.container.innerHTML = `
            <div class="flex flex-col items-center gap-8 w-full max-w-md px-6">
                <div class="w-full h-6 bg-slate-200 dark:bg-white/10 rounded-full relative overflow-hidden">
                    <div id="pressure-bar" class="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-rose-600 transition-all duration-100 ease-linear" style="width: 50%"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest shadow-black drop-shadow-md text-slate-900 dark:text-white">System Pressure</div>
                </div>

                <div id="pv-card" class="premium-card w-full p-8 flex flex-col items-center justify-center min-h-[200px] animate-slide-up bg-white dark:bg-slate-900/50 shadow-xl border border-slate-100 dark:border-white/5 rounded-[32px]">
                    <div class="text-[10px] font-bold uppercase mb-4 text-slate-500 dark:text-slate-400 tracking-widest">Is this correct?</div>
                    <div id="pv-equation" class="text-5xl font-black mb-2 text-slate-900 dark:text-white">Loading...</div>
                </div>

                <div class="flex gap-4 w-full">
                    <button onclick="UIArcade.handlePressureInput(false)" class="flex-1 py-6 rounded-2xl bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-500 font-black text-xl hover:bg-rose-500 hover:text-white active:scale-95 transition-all shadow-sm">
                        <i class="fa-solid fa-xmark"></i> FALSE
                    </button>
                    <button onclick="UIArcade.handlePressureInput(true)" class="flex-1 py-6 rounded-2xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-500 font-black text-xl hover:bg-emerald-500 hover:text-white active:scale-95 transition-all shadow-sm">
                        <i class="fa-solid fa-check"></i> TRUE
                    </button>
                </div>
            </div>
        `;
        
        this._runPressureLoop();
    },

    _runPressureLoop() {
        this._spawnPressureQuestion();

        this.state.interval = setInterval(() => {
            if (!this.state.isPlaying) return;

            this.gameData.pressure += this.gameData.riseRate;
            
            const bar = document.getElementById('pressure-bar');
            if (bar) {
                bar.style.width = `${Math.min(100, this.gameData.pressure)}%`;
                
                if (this.gameData.pressure > 80) {
                    bar.parentElement.classList.add('ring-2', 'ring-rose-500', 'animate-pulse');
                    if (Math.random() > 0.8) this._playSound('tick'); // Panic tick
                } else {
                    bar.parentElement.classList.remove('ring-2', 'ring-rose-500', 'animate-pulse');
                }
            }

            if (this.gameData.pressure >= 100) {
                this._endGame(false);
            }
        }, 100);
    },

    _spawnPressureQuestion() {
        const ops = ['+', '-'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        
        let correctResult;
        if (op === '+') correctResult = a + b;
        else correctResult = a - b;

        const isTruth = Math.random() > 0.5;
        let displayedResult = isTruth ? correctResult : correctResult + (Math.floor(Math.random() * 5) + 1) * (Math.random() > 0.5 ? 1 : -1);

        this.gameData.currentQ = { isTruth };

        const el = document.getElementById('pv-equation');
        if (el) {
            el.classList.remove('animate-fade-in');
            void el.offsetWidth;
            el.classList.add('animate-fade-in');
            el.textContent = `${a} ${op} ${b} = ${displayedResult}`;
        }
    },

    handlePressureInput(userSaidTrue) {
        if (!this.state.isPlaying || !this.gameData.currentQ) return;

        const isCorrect = userSaidTrue === this.gameData.currentQ.isTruth;

        if (isCorrect) {
            this._playSound('pop');
            this._vibrate(10);
            this.gameData.pressure = Math.max(0, this.gameData.pressure - 15);
            this._addScore(100);
            this.gameData.riseRate += 0.02;
            this._showFloatingText(window.innerWidth / 2, window.innerHeight / 2, "RELIEF!", "text-emerald-600 dark:text-emerald-400");
        } else {
            this._playSound('error');
            this._vibrate(100);
            this.gameData.pressure += 15;
            this._showFloatingText(window.innerWidth / 2, window.innerHeight / 2, "FAIL!", "text-rose-500");
            
            const card = document.getElementById('pv-card');
            if (card) {
                card.classList.add('translate-x-2');
                setTimeout(() => card.classList.remove('translate-x-2'), 100);
            }
        }

        this._spawnPressureQuestion();
    },

    // ============================================================
    // 8. MINI-GAME: PATTERN ARCHITECT (MEMORY & FLUID IQ)
    // ============================================================

    _initPatternArchitect() {
        this.gameData = {
            level: 1,
            gridSize: 3, 
            sequence: [],
            userIndex: 0,
            isShowingPattern: false
        };

        this.dom.container.innerHTML = `
            <div class="flex flex-col items-center gap-6">
                <div class="text-sm font-bold opacity-60 uppercase tracking-widest text-slate-900 dark:text-white">
                    Level <span id="pa-level" class="text-xl ml-2 font-black text-blue-600 dark:text-blue-400">1</span>
                </div>
                
                <div id="pa-grid" class="grid gap-3 p-4 rounded-2xl transition-all duration-300 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5" style="grid-template-columns: repeat(3, 1fr);">
                </div>

                <div id="pa-status" class="h-6 text-xs font-bold uppercase animate-pulse text-slate-500 dark:text-slate-400">Watch the pattern...</div>
            </div>
        `;

        this._startPatternLevel();
    },

    _startPatternLevel() {
        if (this.gameData.level > 3) this.gameData.gridSize = 4;
        if (this.gameData.level > 6) this.gameData.gridSize = 5;

        this._renderPatternGrid();

        const seqLength = this.gameData.level + 2;
        this.gameData.sequence = [];
        const totalCells = this.gameData.gridSize * this.gameData.gridSize;
        
        for (let i = 0; i < seqLength; i++) {
            this.gameData.sequence.push(Math.floor(Math.random() * totalCells));
        }

        this.gameData.userIndex = 0;
        this.gameData.isShowingPattern = true;

        setTimeout(() => this._playSequence(), 1000);
    },

    _renderPatternGrid() {
        const grid = document.getElementById('pa-grid');
        if (!grid) return;

        grid.style.gridTemplateColumns = `repeat(${this.gameData.gridSize}, 1fr)`;
        grid.innerHTML = '';

        const totalCells = this.gameData.gridSize * this.gameData.gridSize;
        
        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.dataset.index = i;
            cell.className = `
                w-16 h-16 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5
                transition-all duration-200 cursor-pointer 
                active:scale-90 hover:opacity-80
            `;
            cell.onclick = () => this._handlePatternClick(i, cell);
            grid.appendChild(cell);
        }

        const lvl = document.getElementById('pa-level');
        if (lvl) lvl.textContent = this.gameData.level;
    },

    async _playSequence() {
        const status = document.getElementById('pa-status');
        if (status) status.textContent = "Memorize...";

        const cells = document.getElementById('pa-grid').children;
        this.gameData.isShowingPattern = true;

        for (let i = 0; i < this.gameData.sequence.length; i++) {
            if (!this.state.isPlaying) return;

            const targetIndex = this.gameData.sequence[i];
            const cell = cells[targetIndex];

            // Flash ON
            this._playSound('tick');
            await new Promise(r => setTimeout(r, 200)); 
            // 🛡️ FIX: Adapted flash color for Light Mode (Indigo) vs Dark Mode (White)
            cell.className = 'w-16 h-16 rounded-xl scale-105 transition-all duration-100 bg-indigo-600 dark:bg-white shadow-[0_0_20px_#4f46e5] dark:shadow-[0_0_20px_white]';
            
            // Flash OFF
            await new Promise(r => setTimeout(r, 600)); 
            cell.className = 'w-16 h-16 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 transition-all duration-200';
        }

        this.gameData.isShowingPattern = false;
        if (status) status.textContent = "Your Turn!";
    },

    _handlePatternClick(index, cellElement) {
        if (this.gameData.isShowingPattern || !this.state.isPlaying) return;

        const expected = this.gameData.sequence[this.gameData.userIndex];

        if (index === expected) {
            this._playSound('pop');
            this._vibrate(10);
            
            // Success Flash
            const originalClass = cellElement.className;
            cellElement.className = 'w-16 h-16 rounded-xl bg-emerald-500 shadow-[0_0_15px_#10b981] scale-105 transition-all duration-100';
            
            setTimeout(() => {
                cellElement.className = 'w-16 h-16 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 transition-all duration-200';
            }, 200);

            this.gameData.userIndex++;

            if (this.gameData.userIndex >= this.gameData.sequence.length) {
                this._addScore(this.gameData.level * 100);
                this._playSound('level-up');
                this.gameData.level++;
                this._showFloatingText(window.innerWidth/2, window.innerHeight/2, "LEVEL UP!", "text-yellow-500 dark:text-yellow-400");
                
                setTimeout(() => this._startPatternLevel(), 1000);
            }
        } else {
            this._playSound('error');
            this._vibrate(200);
            cellElement.classList.add('bg-rose-500', 'shake');
            this._endGame(false);
        }
    },

    // Placeholder for future Balloon Pop game
    _initBalloonPop() {
         alert("Coming Soon to the Gym!");
         this.quitGame();
    }
};

window.UIArcade = UIArcade;

