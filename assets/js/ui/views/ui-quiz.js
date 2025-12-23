/**
 * UI-QUIZ (THE EXAM HALL)
 * Version: 2.2.0 (Verified Syntax)
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
        // REFACTOR: Removed bg-slate-900.
        container.className = 'view-container h-screen flex flex-col overflow-hidden';

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
        
        // REFACTOR: Replaced bg-slate-900/50 with basic border/flex classes.
        // Removed text-slate-200.
        return `
        <header class="h-16 px-4 flex items-center justify-between border-b border-white/5 z-20">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm border border-white/10 opacity-80">
                    <i class="fa-solid fa-${config.icon}"></i>
                </div>
                <div>
                    <h2 class="premium-text-head text-xs font-black uppercase tracking-wider">${config.name}</h2>
                    <div class="flex items-center gap-2 text-[10px] font-bold opacity-50">
                        <span id="q-index">Q 1 / 15</span>
                        <span class="w-1 h-1 rounded-full bg-white/20"></span>
                        <span class="text-${color}-400">Standard Mode</span>
                    </div>
                </div>
            </div>
            <div class="flex flex-col items-end">
                <div id="quiz-timer" class="text-xl font-black font-mono tracking-tight leading-none">00:00</div>
                <span class="text-[9px] font-bold opacity-50 uppercase mt-0.5">Time Left</span>
            </div>
        </header>

        <div class="h-1 w-full bg-white/5">
            <div id="timer-bar" class="h-full bg-${color}-500 transition-all duration-1000 ease-linear" style="width: 100%"></div>
        </div>

        <main class="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-32 relative">
            <div id="q-card" class="animate-slide-up">
                <div class="mb-8">
                    <p id="q-text" class="text-lg font-medium leading-relaxed">Loading...</p>
                </div>
                <div id="options-list" class="flex flex-col gap-3"></div>
            </div>
        </main>

        <footer class="fixed bottom-0 left-0 w-full border-t border-white/5 p-4 z-30 flex items-center justify-between safe-area-pb bg-inherit backdrop-blur-md">
            <div class="flex items-center gap-2">
                <button id="btn-prev" onclick="UIQuiz.prev()" class="w-12 h-12 rounded-2xl premium-panel flex items-center justify-center active:scale-95 transition-all opacity-80 hover:opacity-100"><i class="fa-solid fa-chevron-left"></i></button>
                <button id="btn-bookmark" onclick="UIQuiz.bookmark()" class="w-12 h-12 rounded-2xl premium-panel flex items-center justify-center active:scale-95 transition-all opacity-80 hover:text-yellow-400"><i class="fa-regular fa-bookmark"></i></button>
            </div>
            <button onclick="UIQuiz.toggleGrid()" class="px-6 h-12 rounded-2xl premium-panel font-bold text-sm tracking-wide uppercase active:scale-95 transition-all border border-white/5 opacity-80 hover:opacity-100"><i class="fa-solid fa-grid-2 mr-2"></i> Review</button>
            <button id="btn-next" onclick="UIQuiz.next()" class="w-12 h-12 rounded-2xl bg-${color}-600 text-white shadow-lg hover:bg-${color}-500 active:scale-95 transition-all flex items-center justify-center"><i class="fa-solid fa-chevron-right"></i></button>
        </footer>

        <div id="grid-modal" class="fixed inset-0 z-50 premium-card rounded-none hidden flex-col animate-fade-in">
            <div class="p-6 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-lg font-black uppercase tracking-wider">Question Map</h3>
                <button onclick="UIQuiz.toggleGrid()" class="w-10 h-10 rounded-full premium-panel"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
                <div id="nav-grid" class="grid grid-cols-5 gap-3"></div>
            </div>
            <div class="p-6 border-t border-white/10">
                <button onclick="UIQuiz.finish()" class="w-full py-4 rounded-xl bg-rose-600 text-white font-black uppercase tracking-widest shadow-lg active:scale-95 transition-transform">Submit Test</button>
            </div>
        </div>
        `;
    },

    _getSubjectConfig(id) {
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
                if (currentQ) Engine.submitAnswer(currentQ.id, idx);
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
        const selectedOption = Engine.state.answers[q.id];

        this.dom.optionsContainer.innerHTML = '';

        q.options.forEach((optText, i) => {
            const isSelected = selectedOption === i;
            const btn = document.createElement('button');
            // REFACTOR: Replaced bg-slate-800 with premium-panel logic
            const bgClass = isSelected ? 'bg-blue-600 text-white shadow-lg ring-2 ring-blue-400' : 'premium-panel opacity-90 hover:opacity-100 hover:border-white/20';
            
            btn.className = `w-full text-left p-4 rounded-xl relative transition-all duration-200 group ${bgClass}`;
            
            btn.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${isSelected ? 'bg-white text-blue-600' : 'bg-white/10 opacity-50'}">${String.fromCharCode(65 + i)}</div>
                    <div class="text-sm font-medium leading-snug">${optText}</div>
                </div>
            `;
            btn.onclick = () => Engine.submitAnswer(q.id, i);
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
            const isAnswered = answers[q.id] !== undefined;
            const isCurrent = index === currentIndex;
            const isBookmarked = bookmarks.has(q.id);
            
            // REFACTOR: Replaced bg-slate-800 with premium-panel logic
            let bgClass = 'premium-panel opacity-60';
            if (isCurrent) bgClass = 'bg-white text-blue-900 ring-2 ring-blue-500';
            else if (isAnswered) bgClass = 'bg-blue-600 text-white border-blue-500';
            else if (isBookmarked) bgClass = 'bg-amber-500/20 text-amber-500 border-amber-500/50';

            const btn = document.createElement('button');
            btn.className = `w-full aspect-square rounded-lg flex flex-col items-center justify-center border transition-all ${bgClass}`;
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
            this.dom.bookmarkBtn.className = "w-12 h-12 rounded-2xl bg-amber-500 text-white shadow-lg active:scale-95 transition-all flex items-center justify-center";
            this.dom.bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        } else {
            this.dom.bookmarkBtn.className = "w-12 h-12 rounded-2xl premium-panel opacity-80 active:scale-95 transition-all flex items-center justify-center hover:text-amber-400";
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


