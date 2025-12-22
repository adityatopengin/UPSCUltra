/**
 * UI-QUIZ (THE EXAM HALL)
 * Version: 2.0.0
 * Path: assets/js/ui/views/ui-quiz.js
 * Responsibilities:
 * 1. Renders the active question interface.
 * 2. Listens to Engine events (Ticks, Navigation).
 * 3. Handles user inputs (Clicks, Keyboard Shortcuts).
 */

import { Engine } from '../../engine/quiz-engine.js';
import { CONFIG } from '../../config.js';

export const UIQuiz = {
    // ============================================================
    // 1. VIEW INITIALIZATION
    // ============================================================

    render(container) {
        console.log("📝 UIQuiz: Entering Exam Hall...");
        
        // 1. Clear & Prepare Container
        container.innerHTML = '';
        container.className = 'view-container h-screen flex flex-col bg-slate-900 overflow-hidden';

        // 2. Get Subject Metadata (for Header)
        const subId = Engine.state.subjectId;
        const subConfig = this._getSubjectConfig(subId);

        // 3. Inject Layout Skeleton
        container.innerHTML = this._getTemplate(subConfig);

        // 4. Cache DOM Elements (for performance)
        this.dom = {
            timer: document.getElementById('quiz-timer'),
            timerBar: document.getElementById('timer-bar'),
            questionText: document.getElementById('q-text'),
            optionsContainer: document.getElementById('options-list'),
            qIndex: document.getElementById('q-index'),
            navGrid: document.getElementById('nav-grid'),
            bookmarkBtn: document.getElementById('btn-bookmark')
        };

        // 5. Initialize Listeners (Part 2)
        this._bindEvents();

        // 6. Check if Session is Active
        if (!Engine.state.active) {
            console.warn("UIQuiz: No active session found. Redirecting...");
            if (window.Main) Main.navigate('home');
            return;
        }

        // 7. Render Initial State
        // If engine already has questions loaded, render current one
        if (Engine.state.questions.length > 0) {
            this._renderQuestion();
            this._updateTimerDisplay(Engine.state.timeLeft);
        }
    },

    // ============================================================
    // 2. TEMPLATE STRUCTURE
    // ============================================================

    _getTemplate(config) {
        // Theme Colors based on subject
        const color = config.color || 'blue';

        return `
        <header class="h-16 px-4 flex items-center justify-between border-b border-white/5 bg-slate-900/50 backdrop-blur-md z-20">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-${color}-500/20 text-${color}-400 flex items-center justify-center text-sm border border-${color}-500/30">
                    <i class="fa-solid fa-${config.icon}"></i>
                </div>
                <div>
                    <h2 class="text-xs font-black text-slate-200 uppercase tracking-wider">${config.name}</h2>
                    <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                        <span id="q-index">Q 1 / 15</span>
                        <span class="w-1 h-1 rounded-full bg-slate-600"></span>
                        <span class="text-${color}-400">Standard Mode</span>
                    </div>
                </div>
            </div>

            <div class="flex flex-col items-end">
                <div id="quiz-timer" class="text-xl font-black text-slate-200 font-mono tracking-tight leading-none">00:00</div>
                <span class="text-[9px] font-bold text-slate-500 uppercase mt-0.5">Time Left</span>
            </div>
        </header>

        <div class="h-1 w-full bg-slate-800">
            <div id="timer-bar" class="h-full bg-${color}-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-linear" style="width: 100%"></div>
        </div>

        <main class="flex-1 overflow-y-auto overflow-x-hidden p-5 pb-32 relative">
            
            <div id="q-card" class="animate-slide-up">
                <div class="mb-8">
                    <p id="q-text" class="text-lg font-medium text-slate-200 leading-relaxed selection:bg-${color}-500/30">
                        Loading Question...
                    </p>
                </div>

                <div id="options-list" class="flex flex-col gap-3">
                    </div>
            </div>

        </main>

        <footer class="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl border-t border-white/5 p-4 z-30 flex items-center justify-between safe-area-pb">
            
            <div class="flex items-center gap-2">
                <button id="btn-prev" onclick="UIQuiz.prev()" class="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white active:scale-95 transition-all flex items-center justify-center">
                    <i class="fa-solid fa-chevron-left"></i>
                </button>
                
                <button id="btn-bookmark" onclick="UIQuiz.bookmark()" class="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:text-yellow-400 active:scale-95 transition-all flex items-center justify-center">
                    <i class="fa-regular fa-bookmark"></i>
                </button>
            </div>

            <button onclick="UIQuiz.toggleGrid()" class="px-6 h-12 rounded-2xl bg-slate-800 text-slate-300 font-bold text-sm tracking-wide uppercase hover:bg-slate-700 active:scale-95 transition-all border border-white/5">
                <i class="fa-solid fa-grid-2 mr-2"></i> Review
            </button>

            <button id="btn-next" onclick="UIQuiz.next()" class="w-12 h-12 rounded-2xl bg-${color}-600 text-white shadow-lg shadow-${color}-500/20 hover:bg-${color}-500 active:scale-95 transition-all flex items-center justify-center">
                <i class="fa-solid fa-chevron-right"></i>
            </button>
        </footer>

        <div id="grid-modal" class="fixed inset-0 z-50 bg-slate-900/95 backdrop-blur-sm hidden flex-col animate-fade-in">
            <div class="p-6 border-b border-white/10 flex justify-between items-center">
                <h3 class="text-lg font-black text-white uppercase tracking-wider">Question Map</h3>
                <button onclick="UIQuiz.toggleGrid()" class="w-10 h-10 rounded-full bg-slate-800 text-slate-400"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="p-6 overflow-y-auto flex-1">
                <div id="nav-grid" class="grid grid-cols-5 gap-3">
                    </div>
            </div>
            <div class="p-6 border-t border-white/10">
                <button onclick="UIQuiz.finish()" class="w-full py-4 rounded-xl bg-rose-600 text-white font-black uppercase tracking-widest shadow-lg shadow-rose-600/20 active:scale-95 transition-transform">
                    Submit Test
                </button>
            </div>
        </div>
        `;
    },

    /**
     * Helper to find subject name/color from ID
     */
    _getSubjectConfig(id) {
        // Search GS1 list
        let conf = CONFIG.subjectsGS1.find(s => s.id === id);
        if (conf) return conf;

        // Search CSAT list
        conf = CONFIG.subjectsCSAT.find(s => s.id === id);
        if (conf) return conf;

        return { name: 'Practice Session', color: 'blue', icon: 'pen' };
    }

    // ============================================================
    // 3. EVENT BINDING (THE NERVOUS SYSTEM)
    // ============================================================

    _bindEvents() {
        // A. Listen for Engine Ticks (The Heartbeat)
        // Updates the timer every second without re-rendering the whole page
        this._tickHandler = (e) => this._updateTimerDisplay(e.detail.timeLeft);
        window.addEventListener('quiz-tick', this._tickHandler);

        // B. Listen for Engine State Changes (Navigation, Answers)
        this._updateHandler = (e) => {
            const { type, state } = e.detail;
            
            // Re-render question if we moved to a new one
            if (type === 'NAVIGATE' || type === 'SESSION_START') {
                this._renderQuestion();
            }
            // Update UI feedback if an answer was saved
            if (type === 'ANSWER_SAVED') {
                this._renderOptions(state.currentIndex); // Re-render options to show selection
            }
            // Update Bookmark Icon
            if (type === 'BOOKMARK_TOGGLED') {
                this._updateBookmarkIcon();
            }
        };
        window.addEventListener('quiz-update', this._updateHandler);

        // C. Keyboard Shortcuts (Power User Features)
        this._keyHandler = (e) => {
            if (!Engine.state.active) return;
            
            if (e.key === 'ArrowRight') this.next();
            if (e.key === 'ArrowLeft') this.prev();
            if (e.key === 'b') this.bookmark();
            // Number keys 1-4 to select options
            if (['1', '2', '3', '4'].includes(e.key)) {
                const idx = parseInt(e.key) - 1;
                const currentQ = Engine.state.questions[Engine.state.currentIndex];
                if (currentQ) Engine.submitAnswer(currentQ.id, idx);
            }
        };
        window.addEventListener('keydown', this._keyHandler);

        // Cleanup on View Unload (prevent memory leaks)
        this._cleanup = () => {
            window.removeEventListener('quiz-tick', this._tickHandler);
            window.removeEventListener('quiz-update', this._updateHandler);
            window.removeEventListener('keydown', this._keyHandler);
        };
    },

    // ============================================================
    // 4. RENDERING LOGIC (THE PAINTER)
    // ============================================================

    _renderQuestion() {
        const { questions, currentIndex } = Engine.state;
        const q = questions[currentIndex];

        if (!q) return;

        // 1. Update Progress Text (e.g., "Q 5 / 15")
        if (this.dom.qIndex) {
            this.dom.qIndex.textContent = `Q ${currentIndex + 1} / ${questions.length}`;
        }

        // 2. Update Question Text
        // We handle simple markdown if needed, but innerText is safer for now
        if (this.dom.questionText) {
            // Add fade animation reset
            this.dom.questionText.classList.remove('animate-fade-in');
            void this.dom.questionText.offsetWidth; // Trigger reflow
            this.dom.questionText.classList.add('animate-fade-in');
            
            this.dom.questionText.innerHTML = q.text || "Question text missing.";
        }

        // 3. Render Options
        this._renderOptions(currentIndex);

        // 4. Update Bookmark State
        this._updateBookmarkIcon();

        // 5. Update Navigation Button States
        const btnPrev = document.getElementById('btn-prev');
        const btnNext = document.getElementById('btn-next');
        
        if (btnPrev) btnPrev.disabled = currentIndex === 0;
        if (btnPrev) btnPrev.style.opacity = currentIndex === 0 ? '0.5' : '1';
        
        // Change "Next" to "Finish" on last question (Visual cue only)
        // The actual click still calls UIQuiz.next(), which logic handles elsewhere
        if (btnNext && currentIndex === questions.length - 1) {
            btnNext.innerHTML = '<i class="fa-solid fa-flag-checkered"></i>';
            btnNext.onclick = () => this.toggleGrid(); // Open grid on last 'next'
        } else {
            btnNext.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            btnNext.onclick = () => this.next();
        }
    },

    _renderOptions(index) {
        if (!this.dom.optionsContainer) return;
        
        const q = Engine.state.questions[index];
        const selectedOption = Engine.state.answers[q.id]; // 0, 1, 2, 3 or undefined

        this.dom.optionsContainer.innerHTML = '';

        q.options.forEach((optText, i) => {
            const isSelected = selectedOption === i;
            
            const btn = document.createElement('button');
            // Styles: Base + Conditional Selection
            // Uses Tailwind for "ring" effect on selection
            btn.className = `
                w-full text-left p-4 rounded-xl relative transition-all duration-200 group
                ${isSelected 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 scale-[1.01] ring-2 ring-blue-400' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white active:scale-98 border border-white/5'}
            `;
            
            btn.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 
                        ${isSelected ? 'bg-white text-blue-600' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'}">
                        ${String.fromCharCode(65 + i)}
                    </div>
                    <div class="text-sm font-medium leading-snug">${optText}</div>
                </div>
            `;

            // Click Handler -> Send to Engine
            btn.onclick = () => {
                Engine.submitAnswer(q.id, i);
                // Engine emits 'ANSWER_SAVED', which triggers _renderOptions via listener
                // So we don't manually add style classes here to keep state pure.
            };

            this.dom.optionsContainer.appendChild(btn);
        });
    },

    _updateTimerDisplay(seconds) {
        if (!this.dom.timer) return;

        // Format MM:SS
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        this.dom.timer.textContent = `${m}:${s}`;

        // Update Progress Bar Width
        if (this.dom.timerBar) {
            const total = Engine.state.totalDuration;
            const pct = (seconds / total) * 100;
            this.dom.timerBar.style.width = `${pct}%`;
            
            // Color Shift (Green -> Yellow -> Red)
            if (pct < 20) this.dom.timerBar.classList.replace('bg-blue-500', 'bg-rose-500');
            else if (pct < 50) this.dom.timerBar.classList.replace('bg-blue-500', 'bg-amber-500');
        }
    },
    // ============================================================
    // 5. USER ACTIONS (PUBLIC API)
    // ============================================================
    // These are called by the HTML onclick handlers

    next() {
        Engine.nextQuestion();
    },

    prev() {
        Engine.prevQuestion();
    },

    bookmark() {
        const { questions, currentIndex } = Engine.state;
        const q = questions[currentIndex];
        if (q) Engine.toggleBookmark(q.id);
    },

    finish() {
        // Trigger Engine Submission
        // Engine handles the confirmation dialog and then calls Main.handleQuizCompletion
        Engine.submitQuiz(); 
    },

    // ============================================================
    // 6. GRID NAVIGATION (REVIEW MODAL)
    // ============================================================

    toggleGrid() {
        const modal = document.getElementById('grid-modal');
        if (!modal) return;

        const isHidden = modal.classList.contains('hidden');

        if (isHidden) {
            // OPEN MODAL
            this._renderGridItems(); // Refresh data before showing
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            // CLOSE MODAL
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

            // Determine Color Class
            let bgClass = 'bg-slate-800 text-slate-400 border-slate-700'; // Default (Unseen)
            
            if (isCurrent) {
                bgClass = 'bg-white text-blue-900 border-white ring-2 ring-blue-500'; // Active
            } else if (isAnswered) {
                bgClass = 'bg-blue-600 text-white border-blue-500'; // Answered
            } else if (isBookmarked) {
                bgClass = 'bg-amber-500/20 text-amber-500 border-amber-500/50'; // Marked for Review
            }

            // Create Grid Item
            const btn = document.createElement('button');
            btn.className = `w-full aspect-square rounded-lg flex flex-col items-center justify-center border transition-all ${bgClass}`;
            
            // Inner Content
            btn.innerHTML = `
                <span class="text-sm font-bold">${index + 1}</span>
                ${isBookmarked ? '<i class="fa-solid fa-bookmark text-[8px] mt-1"></i>' : ''}
            `;

            btn.onclick = () => {
                Engine.goToQuestion(index);
                this.toggleGrid(); // Close modal after selection
            };

            this.dom.navGrid.appendChild(btn);
        });
    },

    // ============================================================
    // 7. UTILITIES & CLEANUP
    // ============================================================

    _updateBookmarkIcon() {
        if (!this.dom.bookmarkBtn) return;
        
        const { questions, currentIndex, bookmarks } = Engine.state;
        const q = questions[currentIndex];
        
        if (q && bookmarks.has(q.id)) {
            // Active State
            this.dom.bookmarkBtn.className = "w-12 h-12 rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center";
            this.dom.bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        } else {
            // Inactive State
            this.dom.bookmarkBtn.className = "w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 hover:text-amber-400 active:scale-95 transition-all flex items-center justify-center";
            this.dom.bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
        }
    },

    /**
     * Called automatically if the router switches views away from #quiz.
     * Prevents "Ghost Listeners" from firing in the background.
     */
    destroy() {
        if (this._cleanup) this._cleanup();
        this.dom = {}; // Clear DOM references
        console.log("📝 UIQuiz: View Destroyed.");
    }
};

// Global Exposure (for onclick handlers in HTML string)
window.UIQuiz = UIQuiz;
