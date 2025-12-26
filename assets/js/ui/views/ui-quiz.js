/**
 * UI-QUIZ (THE EXAM HALL)
 * Version: 3.0.0 (Patched: Dual Theme Support)
 * Path: assets/js/ui/views/ui-quiz.js
 */

import { Engine } from '../../engine/quiz-engine.js';
import { CONFIG } from '../../config.js';

export const UIQuiz = {
    // ============================================================
    // 1. VIEW INITIALIZATION
    // ============================================================

    render(container) {
        console.log("📝 UIQuiz: Entering Exam Hall...");
        
        container.innerHTML = '';
        container.className = 'view-container h-screen flex flex-col overflow-hidden select-none';

        if (!Engine || !Engine.state) {
            console.warn("UIQuiz: Engine state missing. Redirecting...");
            if (window.Main) Main.navigate('home');
            return;
        }

        const subId = Engine.state.subjectId || 'unknown';
        const subConfig = this._getSubjectConfig(subId);

        container.innerHTML = this._getTemplate(subConfig);

        this.dom = {
            timer: document.getElementById('quiz-timer'),
            timerBar: document.getElementById('timer-bar'),
            questionText: document.getElementById('q-text'),
            qBadge: document.getElementById('q-badge'), // Badge Container
            optionsContainer: document.getElementById('options-list'),
            qIndex: document.getElementById('q-index'),
            navGrid: document.getElementById('nav-grid'),
            bookmarkBtn: document.getElementById('btn-bookmark')
        };

        this._bindEvents();

        if (!Engine.state.active) {
            console.warn("UIQuiz: No active session found. Redirecting...");
            if (window.Main) Main.navigate('home');
            return;
        }

        if (Engine.state.questions && Engine.state.questions.length > 0) {
            this._renderQuestion();
            if (this.dom.timer) this._updateTimerDisplay(Engine.state.timeLeft);
        }
    },

    // ============================================================
    // 2. TEMPLATES & CONFIG
    // ============================================================

    _getTemplate(config) {
        const color = config.color || 'blue';
        
        return `
        <header class="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-white/5 z-20 bg-slate-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md transition-colors">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 shadow-sm">
                    <i class="fa-solid fa-${config.icon}"></i>
                </div>
                <div>
                    <h2 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">${config.name}</h2>
                    <div class="flex items-center gap-2 text-[10px] font-bold opacity-50 text-slate-500 dark:text-slate-400">
                        <span id="q-index">Q 1 / 15</span>
                        <span class="w-1 h-1 rounded-full bg-slate-400 dark:bg-white/20"></span>
                        <span class="text-${color}-600 dark:text-${color}-400">Standard Mode</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-end">
                <div id="quiz-timer" class="text-xl font-black font-mono tracking-tight leading-none text-slate-900 dark:text-white">00:00</div>
                <span class="text-[9px] font-bold opacity-50 uppercase mt-0.5 text-slate-500 dark:text-slate-400">Time Left</span>
            </div>
        </header>

        <div class="h-1 w-full bg-slate-200 dark:bg-white/5">
            <div id="timer-bar" class="h-full bg-${color}-500 transition-all duration-1000 ease-linear" style="width: 100%"></div>
        </div>

        <main class="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-32 relative bg-slate-50 dark:bg-slate-900 transition-colors">
            <div id="q-card" class="animate-slide-up max-w-3xl mx-auto">
                <div class="mb-8">
                    <div id="q-badge" class="hidden mb-3 flex flex-wrap gap-2"></div>
                    <p id="q-text" class="text-lg font-medium leading-relaxed text-slate-800 dark:text-slate-100">Loading...</p>
                </div>
                <div id="options-list" class="flex flex-col gap-3"></div>
            </div>
        </main>

        <footer class="fixed bottom-0 left-0 w-full border-t border-slate-200 dark:border-white/5 p-4 z-30 flex items-center justify-between safe-area-pb bg-slate-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md transition-colors">
            <div class="flex items-center gap-2">
                <button id="btn-prev" onclick="UIQuiz.prev()" class="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/60 flex items-center justify-center active:scale-95 transition-all hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm"><i class="fa-solid fa-chevron-left"></i></button>
                <button id="btn-bookmark" onclick="UIQuiz.bookmark()" class="w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/60 flex items-center justify-center active:scale-95 transition-all hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm"><i class="fa-regular fa-bookmark"></i></button>
            </div>
            <button onclick="UIQuiz.toggleGrid()" class="px-6 h-12 rounded-2xl font-bold text-sm tracking-wide uppercase active:scale-95 transition-all border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm"><i class="fa-solid fa-grid-2 mr-2"></i> Review</button>
            <button id="btn-next" onclick="UIQuiz.next()" class="w-12 h-12 rounded-2xl bg-${color}-600 hover:bg-${color}-500 text-white shadow-lg shadow-${color}-500/30 active:scale-95 transition-all flex items-center justify-center"><i class="fa-solid fa-chevron-right"></i></button>
        </footer>

        <div id="grid-modal" class="fixed inset-0 z-50 bg-slate-50 dark:bg-slate-900 hidden flex-col animate-fade-in">
            <div class="p-6 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur">
                <h3 class="text-lg font-black uppercase tracking-wider text-slate-900 dark:text-white">Question Map</h3>
                <button onclick="UIQuiz.toggleGrid()" class="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-white/50 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-6 overflow-y-auto flex-1 bg-slate-50 dark:bg-slate-900">
                <div id="nav-grid" class="grid grid-cols-5 gap-3 max-w-md mx-auto"></div>
            </div>
            <div class="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur">
                <button onclick="UIQuiz.finish()" class="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest shadow-lg shadow-rose-500/30 active:scale-95 transition-transform">Submit Test</button>
            </div>
        </div>
        `;
    },

    _getSubjectConfig(id) {
        if (id === 'mock_gs1') return { name: 'GS Prelims Mock', color: 'amber', icon: 'trophy' };
        if (id === 'mock_csat') return { name: 'CSAT Mock', color: 'purple', icon: 'flag-checkered' };

        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        let conf = gs1.find(s => s.id === id) || csat.find(s => s.id === id);
        return conf || { name: 'Practice Session', color: 'blue', icon: 'pen' };
    },

    // ============================================================
    // 3. EVENT BINDING
    // ============================================================

    _bindEvents() {
        this._tickHandler = (e) => this._updateTimerDisplay(e.detail.timeLeft);
        window.addEventListener('quiz-tick', this._tickHandler);

        this._updateHandler = (e) => {
            const { type, state } = e.detail;
            if (type === 'NAVIGATE' || type === 'SESSION_START') this._renderQuestion();
            if (type === 'ANSWER_SAVED') this._renderOptions(state.currentIndex);
            if (type === 'BOOKMARK_TOGGLED') this._updateBookmarkIcon();
        };
        window.addEventListener('quiz-update', this._updateHandler);

        this._keyHandler = (e) => {
            if (!Engine.state.active) return;
            if (e.key === 'ArrowRight') this.next();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'b') this.bookmark();
            if (['1', '2', '3', '4'].includes(e.key)) {
                const idx = parseInt(e.key) - 1;
                const currentQ = Engine.state.questions[Engine.state.currentIndex];
                // 🛡️ FIX: Use Index (Engine.state.currentIndex) instead of ID
                if (currentQ) Engine.submitAnswer(Engine.state.currentIndex, idx);
            }
        };
        window.addEventListener('keydown', this._keyHandler);

        this._cleanup = () => {
            window.removeEventListener('quiz-tick', this._tickHandler);
            window.removeEventListener('quiz-update', this._updateHandler);
            window.removeEventListener('keydown', this._keyHandler);
        };
    },

    // ============================================================
    // 4. RENDERING LOGIC
    // ============================================================

    _renderQuestion() {
        const { questions, currentIndex } = Engine.state;
        const q = questions[currentIndex];
        if (!q) return;

        if (this.dom.qIndex) this.dom.qIndex.textContent = `Q ${currentIndex + 1} / ${questions.length}`;
        
        // 🛡️ UPDATED: Multi-Badge Logic (Subject + Source)
        if (this.dom.qBadge) {
            let badgeHTML = '';

            // 1. Subject Badge (Only relevant in Mocks where subjects are mixed)
            if (Engine.state.subjectId && Engine.state.subjectId.startsWith('mock_') && q.subject) {
                const subConf = this._getSubjectConfig(q.subject);
                badgeHTML += `<span class="inline-flex items-center px-2 py-1 rounded bg-${subConf.color}-100 dark:bg-${subConf.color}-500/10 text-${subConf.color}-600 dark:text-${subConf.color}-400 text-[10px] font-bold uppercase tracking-wider border border-${subConf.color}-200 dark:border-${subConf.color}-500/20">
                    <i class="fa-solid fa-${subConf.icon} mr-1"></i> ${subConf.name}
                </span>`;
            }

            // 2. Source Badge (e.g., "UPSC 2022" vs "Mock")
            if (q.source) {
                const isPYQ = q.source.toLowerCase().includes('upsc') || q.source.toLowerCase().includes('pyq');
                // PYQ = Red/Rose (Official/Serious), Mock = Cyan/Blue (Practice/Experimental)
                const color = isPYQ ? 'rose' : 'cyan';
                const icon = isPYQ ? 'building-columns' : 'flask';
                
                badgeHTML += `<span class="inline-flex items-center px-2 py-1 rounded bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 text-[10px] font-bold uppercase tracking-wider border border-${color}-200 dark:border-${color}-500/20">
                    <i class="fa-solid fa-${icon} mr-1"></i> ${q.source}
                </span>`;
            }

            // Render
            if (badgeHTML) {
                this.dom.qBadge.innerHTML = badgeHTML;
                this.dom.qBadge.classList.remove('hidden');
            } else {
                this.dom.qBadge.classList.add('hidden');
            }
        }

        if (this.dom.questionText) {
            this.dom.questionText.classList.remove('animate-fade-in');
            void this.dom.questionText.offsetWidth; 
            this.dom.questionText.classList.add('animate-fade-in');
            this.dom.questionText.innerHTML = q.text || "Question text missing.";
        }

        this._renderOptions(currentIndex);
        this._updateBookmarkIcon();

        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        
        if (btnPrev) {
            btnPrev.disabled = currentIndex === 0;
            btnPrev.style.opacity = currentIndex === 0 ? '0.5' : '1';
        }
        
        if (btnNext) {
            if (currentIndex === questions.length - 1) {
                btnNext.innerHTML = '<i class="fa-solid fa-flag-checkered"></i>';
                btnNext.onclick = () => this.toggleGrid();
            } else {
                btnNext.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
                btnNext.onclick = () => this.next();
            }
        }
    },

    _renderOptions(index) {
        if (!this.dom.optionsContainer) return;
        const q = Engine.state.questions[index];
        // 🛡️ FIX: Look up answer by INDEX, not ID
        const selectedOption = Engine.state.answers[index];

        this.dom.optionsContainer.innerHTML = '';

        q.options.forEach((optText, i) => {
            const isSelected = selectedOption === i;
            
            // Adaptive styling for Selected vs Default
            const bgClass = isSelected 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400' 
                : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10';
            
            // Circle styling
            const circleClass = isSelected 
                ? 'bg-white text-blue-600' 
                : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50';

            const btn = document.createElement('button');
            btn.className = `w-full text-left p-4 rounded-xl relative transition-all duration-200 group ${bgClass} shadow-sm`;
            
            btn.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${circleClass}">${String.fromCharCode(65 + i)}</div>
                    <div class="text-sm font-medium leading-snug">${optText}</div>
                </div>
            `;
            // 🛡️ CRITICAL FIX: Pass 'index' (0,1,2...) not 'q.id' (POLY_001)
            btn.onclick = () => Engine.submitAnswer(index, i);
            this.dom.optionsContainer.appendChild(btn);
        });
    },

    _updateTimerDisplay(seconds) {
        if (!this.dom.timer) return;
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        this.dom.timer.textContent = `${m}:${s}`;
        
        if (this.dom.timerBar && Engine.state.totalDuration) {
            const pct = (seconds / Engine.state.totalDuration) * 100;
            this.dom.timerBar.style.width = `${pct}%`;
        }
    },

    // ============================================================
    // 5. PUBLIC ACTIONS
    // ============================================================

    next() { Engine.nextQuestion(); },
    prev() { Engine.prevQuestion(); },
    
    bookmark() {
        if (!Engine.state) return;
        const q = Engine.state.questions[Engine.state.currentIndex];
        if (q) Engine.toggleBookmark(q.id);
    },

    finish() { Engine.submitQuiz(); },

    toggleGrid() {
        const modal = document.getElementById('grid-modal');
        if (!modal) return;
        const isHidden = modal.classList.contains('hidden');
        if (isHidden) {
            this._renderGridItems();
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    },

    _renderGridItems() {
        if (!this.dom.navGrid) return;
        this.dom.navGrid.innerHTML = '';
        const { questions, currentIndex, answers, bookmarks } = Engine.state;

        questions.forEach((q, index) => {
            const isAnswered = answers[index] !== undefined;
            const isCurrent = index === currentIndex;
            const isBookmarked = bookmarks.has(q.id);
            
            let bgClass = 'bg-slate-200 dark:bg-white/5 border border-transparent text-slate-500 dark:text-white/40';
            if (isCurrent) bgClass = 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 ring-2 ring-blue-500 shadow-lg';
            else if (isAnswered) bgClass = 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20';
            else if (isBookmarked) bgClass = 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 border-amber-500/50';

            const btn = document.createElement('button');
            btn.className = `w-full aspect-square rounded-lg flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 ${bgClass}`;
            btn.innerHTML = `<span class="text-sm font-bold">${index + 1}</span>${isBookmarked ? '<i class="fa-solid fa-bookmark text-[8px] mt-1"></i>' : ''}`;
            
            btn.onclick = () => {
                Engine.goToQuestion(index);
                this.toggleGrid();
            };
            this.dom.navGrid.appendChild(btn);
        });
    },

    _updateBookmarkIcon() {
        if (!this.dom.bookmarkBtn) return;
        const { questions, currentIndex, bookmarks } = Engine.state;
        const q = questions[currentIndex];
        
        if (q && bookmarks.has(q.id)) {
            // Active
            this.dom.bookmarkBtn.className = "w-12 h-12 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/30 active:scale-95 transition-all flex items-center justify-center";
            this.dom.bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        } else {
            // Inactive
            this.dom.bookmarkBtn.className = "w-12 h-12 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-400 dark:text-white/60 flex items-center justify-center active:scale-95 transition-all hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-white/10 shadow-sm";
            this.dom.bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
        }
    },

    destroy() {
        if (this._cleanup) this._cleanup();
        this.dom = {};
        console.log("📝 UIQuiz: View Destroyed.");
    }
};

window.UIQuiz = UIQuiz;

