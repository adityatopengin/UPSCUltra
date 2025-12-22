/**
 * UI-ARCADE (THE BRAIN GYM)
 * Version: 2.0.0
 * Path: assets/js/ui/views/ui-arcade.js
 * Responsibilities:
 * 1. Renders the Arcade Dashboard (Game Selection).
 * 2. Manages the "Game Shell" (Canvas, Score, Timer).
 * 3. Contains logic for 3 Mini-Games: Blink, Pressure, Pattern.
 */

import { CONFIG } from '../../config.js';
import { UI } from '../ui-manager.js';
// We might import specific Game Engines later if we separate them, 
// but for MVP we can encapsulate simple logic here.

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
        ctx: null // Canvas Context for visual games
    },

    // ============================================================
    // 2. VIEW INITIALIZATION (DASHBOARD)
    // ============================================================

    render(container) {
        console.log("🎮 UIArcade: Entering the Gym...");
        
        // 1. Clear & Setup
        container.innerHTML = '';
        container.className = 'view-container pb-24 bg-slate-900 min-h-screen';

        // 2. Render Dashboard (Menu)
        container.innerHTML = this._getDashboardTemplate();

        // 3. Bind Dashboard Events
        // (Delegated listeners for game selection)
    },

    /**
     * Generates the Main Menu HTML
     */
    _getDashboardTemplate() {
        // Fetch modes from CONFIG.arcadeModes
        const modes = CONFIG.arcadeModes || [];

        const cardsHTML = modes.map(mode => `
            <button onclick="UIArcade.launchGame('${mode.id}')" class="glass-card w-full p-6 text-left group relative overflow-hidden transition-all duration-300 hover:scale-[1.02]">
                
                <div class="absolute -right-4 -top-4 w-24 h-24 bg-${mode.color}-500/20 rounded-full blur-2xl transition-all group-hover:bg-${mode.color}-500/30"></div>
                
                <div class="relative z-10 flex items-start gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-${mode.color}-500/10 text-${mode.color}-400 border border-${mode.color}-500/20 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(0,0,0,0.3)]">
                        <i class="fa-solid fa-${mode.icon}"></i>
                    </div>
                    
                    <div class="flex-1">
                        <h3 class="text-lg font-black text-slate-100 uppercase tracking-wide mb-1">${mode.name}</h3>
                        <p class="text-xs font-medium text-slate-400 leading-relaxed">${mode.description}</p>
                    </div>
                    
                    <div class="self-center text-slate-600 group-hover:text-white transition-colors">
                        <i class="fa-solid fa-chevron-right"></i>
                    </div>
                </div>
            </button>
        `).join('');

        return `
        <header class="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between safe-area-pt">
            <div>
                <h2 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cognitive Training</h2>
                <h1 class="text-2xl font-black text-white tracking-tight">Brain Gym</h1>
            </div>
            <div class="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400">
                <i class="fa-solid fa-dumbbell"></i>
            </div>
        </header>

        <main class="dashboard-grid animate-slide-up">
            ${cardsHTML}
            
            <div class="glass-card opacity-50 border-dashed border-slate-700 pointer-events-none p-6 flex flex-col items-center justify-center text-center gap-2">
                <i class="fa-solid fa-lock text-slate-600 text-2xl"></i>
                <div class="text-xs font-bold text-slate-500 uppercase">More Modes Locked</div>
            </div>
        </main>
        `;
    },
    // ============================================================
    // 3. GAME LAUNCHER (THE ARENA)
    // ============================================================

    launchGame(gameId) {
        console.log(`🎮 UIArcade: Launching ${gameId}...`);
        this.state.activeGameId = gameId;
        this.state.score = 0;
        this.state.isPlaying = true;

        // 1. Hide Dashboard / Show Game Shell
        const app = document.getElementById('app-container');
        // We replace the entire view content with the game shell
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
        
        // 4. Hide Main Nav (Focus Mode)
        if (window.UIHeader) UIHeader.toggle(false);
    },

    quitGame() {
        // Stop Loops
        this.state.isPlaying = false;
        if (this.state.interval) clearInterval(this.state.interval);
        if (this.state.timer) clearTimeout(this.state.timer);

        // Restore UI
        if (window.UIHeader) UIHeader.toggle(true);
        
        // Go back to Menu
        const app = document.getElementById('app-container');
        this.render(app);
    },

    // ============================================================
    // 4. TEMPLATE: GAME SHELL
    // ============================================================

    _getGameShellTemplate(gameId) {
        // Find config
        const config = CONFIG.arcadeModes.find(m => m.id === gameId);
        const color = config ? config.color : 'blue';

        return `
        <div class="fixed inset-0 z-50 bg-slate-900 flex flex-col">
            
            <header class="h-20 px-6 flex items-center justify-between bg-slate-900/90 backdrop-blur-md border-b border-white/5 relative z-20">
                <div class="flex flex-col">
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Score</span>
                    <span id="game-score" class="text-3xl font-black text-white font-mono tracking-tighter">0</span>
                </div>

                <div class="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div class="w-16 h-16 rounded-full bg-${color}-500/20 border border-${color}-500/30 flex items-center justify-center text-${color}-400 text-2xl animate-pulse">
                        <i class="fa-solid fa-${config.icon}"></i>
                    </div>
                </div>

                <button onclick="UIArcade.quitGame()" class="w-10 h-10 rounded-full bg-slate-800 text-slate-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </header>

            <main id="game-container" class="flex-1 relative overflow-hidden flex flex-col items-center justify-center">
                <canvas id="game-canvas" class="absolute inset-0 w-full h-full opacity-0 transition-opacity duration-500"></canvas>
                
                <div id="game-start-overlay" class="text-center z-10 animate-fade-in">
                    <h2 class="text-white font-black text-2xl mb-2">Ready?</h2>
                    <p class="text-slate-400 text-sm mb-6 max-w-[200px] mx-auto">${config.description}</p>
                    <button onclick="UIArcade.startGameLoop()" class="px-8 py-3 rounded-full bg-${color}-500 text-white font-bold uppercase tracking-widest shadow-lg shadow-${color}-500/40 hover:scale-105 active:scale-95 transition-all">
                        Start
                    </button>
                </div>
            </main>

            <footer class="h-24 pb-8 flex items-center justify-center relative z-20 pointer-events-none">
                <div class="w-full max-w-xs bg-slate-800/50 rounded-full h-2 overflow-hidden backdrop-blur-sm border border-white/5">
                    <div id="game-timer" class="h-full bg-${color}-400 shadow-[0_0_10px_currentColor]" style="width: 100%"></div>
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

        // Logic split by game type (Part 3)
        if (this.state.activeGameId === 'blink_test') this._runBlinkLoop();
        // ... others
    },
    // ============================================================
    // 5. MINI-GAME: BLINK TEST (REACTION SPEED)
    // ============================================================

    _initBlinkTest() {
        // Setup initial state specific to Blink Test
        this.gameData = {
            lives: 3,
            spawnRate: 2000,
            targetsClicked: 0
        };
        // Reset Visuals
        if (this.dom.timer) this.dom.timer.style.width = '100%';
    },

    _runBlinkLoop() {
        // Clear any existing targets
        this.dom.container.innerHTML = ''; 
        
        // Start the Spawn Cycle
        this._spawnBlinkTarget();

        // Start Global Timer (Game lasts 60s max or until lives lost)
        let timeLeft = 60;
        this.state.interval = setInterval(() => {
            if (!this.state.isPlaying) return;

            timeLeft--;
            const pct = (timeLeft / 60) * 100;
            if (this.dom.timer) this.dom.timer.style.width = `${pct}%`;

            // Increase Difficulty every 10 seconds
            if (timeLeft % 10 === 0) {
                this.gameData.spawnRate = Math.max(600, this.gameData.spawnRate - 200);
            }

            if (timeLeft <= 0) this._endGame(true);
        }, 1000);
    },

    _spawnBlinkTarget() {
        if (!this.state.isPlaying) return;

        // Calculate Random Position (Safe Zone)
        const container = this.dom.container;
        const maxX = container.clientWidth - 80; // 80px buffer
        const maxY = container.clientHeight - 80;
        
        const x = Math.random() * maxX + 40;
        const y = Math.random() * maxY + 40;

        // Create Target Element
        const target = document.createElement('div');
        target.className = 'absolute w-16 h-16 rounded-full bg-cyan-500 shadow-[0_0_20px_currentColor] cursor-pointer active:scale-90 transition-transform animate-pulse';
        target.style.left = `${x}px`;
        target.style.top = `${y}px`;

        // Interaction Logic
        const spawnTime = Date.now();
        let clicked = false;

        target.onmousedown = (e) => {
            e.stopPropagation(); // Prevent container clicks
            clicked = true;
            
            // Calculate Points based on Reaction Time
            const reactionTime = Date.now() - spawnTime;
            let points = 100;
            if (reactionTime < 600) points += 50; // Speed Bonus
            if (reactionTime < 400) points += 100; // Godlike Bonus

            this._addScore(points);
            this._showFloatingText(x, y, `+${points}`);

            // Remove and Schedule Next
            target.remove();
            clearTimeout(despawnTimer);
            
            // Randomize next spawn time slightly
            setTimeout(() => this._spawnBlinkTarget(), Math.random() * 500 + 200);
        };

        container.appendChild(target);

        // Despawn Timer (Missed Target)
        const despawnTimer = setTimeout(() => {
            if (!clicked && this.state.isPlaying) {
                target.remove();
                this._handleMiss();
                // Respawn immediately
                this._spawnBlinkTarget();
            }
        }, this.gameData.spawnRate);
    },

    _handleMiss() {
        this.gameData.lives--;
        
        // Visual Feedback (Screen Flash)
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
        // Animate Score Counter
        if (this.dom.score) {
            this.dom.score.textContent = this.state.score;
            this.dom.score.classList.remove('scale-110');
            void this.dom.score.offsetWidth; // Trigger reflow
            this.dom.score.classList.add('scale-110');
        }
    },

    _showFloatingText(x, y, text) {
        const float = document.createElement('div');
        float.className = 'absolute text-cyan-300 font-black text-xl pointer-events-none animate-slide-up';
        float.style.left = `${x}px`;
        float.style.top = `${y - 20}px`;
        float.textContent = text;
        this.dom.container.appendChild(float);
        setTimeout(() => float.remove(), 500);
    },

    _endGame(win) {
        this.state.isPlaying = false;
        clearInterval(this.state.interval);
        
        // Show Game Over Modal
        alert(`Game Over! Score: ${this.state.score}`);
        this.quitGame();
    },
    // ============================================================
    // 6. MINI-GAME: PRESSURE VALVE (STRESS MANAGEMENT)
    // ============================================================

    _initPressureValve() {
        this.gameData = {
            pressure: 50, // Starts at 50%
            riseRate: 0.2, // Increases over time
            currentQ: null
        };
        
        // Setup UI for Pressure Valve
        // We inject a specific layout into the game container
        this.dom.container.innerHTML = `
            <div class="flex flex-col items-center gap-8 w-full max-w-md">
                
                <div class="w-full h-6 bg-slate-800 rounded-full border border-white/10 relative overflow-hidden">
                    <div id="pressure-bar" class="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-rose-600 transition-all duration-100 ease-linear" style="width: 50%"></div>
                    <div class="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white uppercase tracking-widest shadow-black drop-shadow-md">System Pressure</div>
                </div>

                <div id="pv-card" class="glass-card w-full p-8 flex flex-col items-center justify-center min-h-[200px] animate-slide-up">
                    <div class="text-slate-400 text-xs font-bold uppercase mb-4">Is this correct?</div>
                    <div id="pv-equation" class="text-5xl font-black text-white mb-2">Loading...</div>
                </div>

                <div class="flex gap-4 w-full">
                    <button onclick="UIArcade.handlePressureInput(false)" class="flex-1 py-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-500 font-black text-xl hover:bg-rose-500 hover:text-white active:scale-95 transition-all">
                        <i class="fa-solid fa-xmark"></i> FALSE
                    </button>
                    <button onclick="UIArcade.handlePressureInput(true)" class="flex-1 py-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-black text-xl hover:bg-emerald-500 hover:text-white active:scale-95 transition-all">
                        <i class="fa-solid fa-check"></i> TRUE
                    </button>
                </div>
            </div>
        `;
        
        // Start Loops
        this._runPressureLoop();
    },

    _runPressureLoop() {
        this._spawnPressureQuestion();

        // The Pressure Loop (Runs 60fps equivalent)
        this.state.interval = setInterval(() => {
            if (!this.state.isPlaying) return;

            // 1. Increase Pressure
            this.gameData.pressure += this.gameData.riseRate;
            
            // 2. Update Visuals
            const bar = document.getElementById('pressure-bar');
            if (bar) {
                bar.style.width = `${Math.min(100, this.gameData.pressure)}%`;
                
                // Visual Alarm (Flash Red if > 80%)
                if (this.gameData.pressure > 80) {
                    bar.parentElement.classList.add('ring-2', 'ring-rose-500', 'animate-pulse');
                } else {
                    bar.parentElement.classList.remove('ring-2', 'ring-rose-500', 'animate-pulse');
                }
            }

            // 3. Check Game Over
            if (this.gameData.pressure >= 100) {
                this._endGame(false);
            }
        }, 100); // Updates every 100ms
    },

    _spawnPressureQuestion() {
        // Generate Simple Math (A +/- B = C)
        const ops = ['+', '-'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        const a = Math.floor(Math.random() * 20) + 1;
        const b = Math.floor(Math.random() * 20) + 1;
        
        let correctResult;
        if (op === '+') correctResult = a + b;
        else correctResult = a - b;

        // Coin flip: Should we show the correct answer or a fake one?
        const isTruth = Math.random() > 0.5;
        let displayedResult = isTruth ? correctResult : correctResult + (Math.floor(Math.random() * 5) + 1) * (Math.random() > 0.5 ? 1 : -1);

        this.gameData.currentQ = { isTruth };

        // Update UI
        const el = document.getElementById('pv-equation');
        if (el) {
            // Tiny animation for new question
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
            // Reward: Release Pressure & Add Score
            this.gameData.pressure = Math.max(0, this.gameData.pressure - 15);
            this._addScore(100);
            
            // Increase difficulty slightly
            this.gameData.riseRate += 0.02;
            
            this._showFloatingText(window.innerWidth / 2, window.innerHeight / 2, "RELIEF!", "text-emerald-400");
        } else {
            // Penalty: Spike Pressure
            this.gameData.pressure += 15;
            this._showFloatingText(window.innerWidth / 2, window.innerHeight / 2, "FAIL!", "text-rose-500");
            
            // Shake Effect
            const card = document.getElementById('pv-card');
            if (card) {
                card.classList.add('translate-x-2');
                setTimeout(() => card.classList.remove('translate-x-2'), 100);
            }
        }

        // Next Question
        this._spawnPressureQuestion();
    },
    // ============================================================
    // 7. MINI-GAME: PATTERN ARCHITECT (MEMORY & FLUID IQ)
    // ============================================================

    _initPatternArchitect() {
        this.gameData = {
            level: 1,
            gridSize: 3, // Starts 3x3
            sequence: [],
            userIndex: 0,
            isShowingPattern: false
        };

        // Render Grid Container
        this.dom.container.innerHTML = `
            <div class="flex flex-col items-center gap-6">
                <div class="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    Level <span id="pa-level" class="text-white text-xl ml-2">1</span>
                </div>
                
                <div id="pa-grid" class="grid gap-3 p-4 bg-slate-800/50 rounded-2xl border border-white/5 transition-all duration-300" style="grid-template-columns: repeat(3, 1fr);">
                    </div>

                <div id="pa-status" class="h-6 text-xs font-bold text-slate-500 uppercase animate-pulse">Watch the pattern...</div>
            </div>
        `;

        this._startPatternLevel();
    },

    _startPatternLevel() {
        // 1. Setup Grid Size based on level
        // Level 1-3: 3x3, Level 4-6: 4x4, Level 7+: 5x5
        if (this.gameData.level > 3) this.gameData.gridSize = 4;
        if (this.gameData.level > 6) this.gameData.gridSize = 5;

        this._renderPatternGrid();

        // 2. Generate Sequence
        // Length = Level + 2 (Level 1 = 3 steps)
        const seqLength = this.gameData.level + 2;
        this.gameData.sequence = [];
        const totalCells = this.gameData.gridSize * this.gameData.gridSize;
        
        for (let i = 0; i < seqLength; i++) {
            this.gameData.sequence.push(Math.floor(Math.random() * totalCells));
        }

        this.gameData.userIndex = 0;
        this.gameData.isShowingPattern = true;

        // 3. Play Sequence (after short delay)
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
            // ID stored in dataset for easy checking
            cell.dataset.index = i;
            cell.className = `
                w-16 h-16 rounded-xl bg-slate-700 border border-white/5 
                transition-all duration-200 cursor-pointer 
                active:scale-90 hover:bg-slate-600
            `;
            
            // Interaction
            cell.onclick = () => this._handlePatternClick(i, cell);
            
            grid.appendChild(cell);
        }

        // Update Level Text
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
            await new Promise(r => setTimeout(r, 200)); // Gap
            cell.className = 'w-16 h-16 rounded-xl bg-white shadow-[0_0_20px_white] scale-105 transition-all duration-100';
            
            // Flash OFF
            await new Promise(r => setTimeout(r, 600)); // Duration
            cell.className = 'w-16 h-16 rounded-xl bg-slate-700 border border-white/5 transition-all duration-200';
        }

        this.gameData.isShowingPattern = false;
        if (status) status.textContent = "Your Turn!";
    },

    _handlePatternClick(index, cellElement) {
        if (this.gameData.isShowingPattern || !this.state.isPlaying) return;

        const expected = this.gameData.sequence[this.gameData.userIndex];

        if (index === expected) {
            // Correct
            // Flash Green
            cellElement.classList.remove('bg-slate-700');
            cellElement.classList.add('bg-emerald-500', 'shadow-[0_0_15px_#10b981]');
            setTimeout(() => {
                cellElement.classList.remove('bg-emerald-500', 'shadow-[0_0_15px_#10b981]');
                cellElement.classList.add('bg-slate-700');
            }, 200);

            this.gameData.userIndex++;

            // Check Level Completion
            if (this.gameData.userIndex >= this.gameData.sequence.length) {
                this._addScore(this.gameData.level * 100);
                this.gameData.level++;
                this._showFloatingText(window.innerWidth/2, window.innerHeight/2, "LEVEL UP!", "text-yellow-400");
                
                setTimeout(() => this._startPatternLevel(), 1000);
            }
        } else {
            // Wrong -> Game Over
            cellElement.classList.add('bg-rose-500', 'shake');
            this._endGame(false);
        }
    }
};

// Global Exposure
window.UIArcade = UIArcade;
