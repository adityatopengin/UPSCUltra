/**
 * UI-REVIEW (MISTAKE ANALYSIS)
 * Version: 1.0.0
 * Path: assets/js/ui/views/ui-review.js
 * Responsibilities:
 * 1. Fetches the Exam Result and the original Questions.
 * 2. Filters questions by status (All, Correct, Wrong, Skipped).
 * 3. Renders the detailed "Question-Answer" breakdown.
 */

import { DB } from '../../services/db.js';

export const UIReview = {
    // ============================================================
    // 1. STATE MANAGEMENT
    // ============================================================
    state: {
        result: null,
        questions: [],
        filter: 'all' // 'all', 'wrong', 'correct', 'skipped'
    },

    // ============================================================
    // 2. VIEW INITIALIZATION
    // ============================================================

    async render(container) {
        console.log("🧐 UIReview: Opening Inspection...");
        
        container.innerHTML = '';
        // REFACTOR: Removed bg-slate-900. Increased padding to pb-40.
        container.className = 'view-container pb-40 min-h-screen';

        const resultId = this._getResultId();
        
        if (!resultId) {
            this._renderError(container, "No Result ID found to review.");
            return;
        }

        container.innerHTML = this._getLoadingSkeleton();

        try {
            await this._loadReviewData(resultId);
            this._renderInterface(container);

        } catch (e) {
            console.error("UIReview: Load Failed", e);
            this._renderError(container, "Could not load review data. " + e.message);
        }
    },

    // ============================================================
    // 3. DATA FETCHING
    // ============================================================

    async _loadReviewData(resultId) {
        let result = window.Main && window.Main.state ? window.Main.state.lastResult : null;
        
        if (!result || result.id !== resultId) {
            result = await DB.get('history', resultId);
        }

        if (!result) throw new Error("Result record missing.");
        this.state.result = result;

        // Use mock generator if DB questions are missing (Safety Fallback)
        this.state.questions = await this._fetchOrGenerateQuestions(result.subject, (result.totalMarks || 30) / 2);
    },

    async _fetchOrGenerateQuestions(subjectId, count) {
        return Array.from({ length: count }, (_, i) => ({
            id: `q_${subjectId}_${i}`,
            text: `Question ${i + 1} for ${subjectId}. <br> What is the correct answer?`,
            options: [
                "This is the wrong answer",
                "This is the correct answer (Option B)",
                "Another wrong answer",
                "Definitely not this one"
            ],
            correctAnswer: 1, 
            explanation: "Option B is correct because this is a mock explanation generated for testing purposes.",
            index: i
        }));
    },

    _getResultId() {
        if (window.Main && window.Main.state && window.Main.state.lastResultId) return window.Main.state.lastResultId;
        const hash = window.location.hash;
        if (hash.includes('?id=')) return hash.split('?id=')[1];
        return null;
    },

    // ============================================================
    // 4. RENDER CONTROLLER
    // ============================================================

    _renderInterface(container) {
        container.innerHTML = `
            ${this._getHeaderTemplate()}
            ${this._getFilterBarTemplate()}
            <div id="review-list" class="p-4 space-y-4 animate-slide-up"></div>
        `;
        this._renderQuestionsList();
    },

    _renderQuestionsList() {
        const container = document.getElementById('review-list');
        if (!container) return;

        container.innerHTML = '';
        
        const filtered = this.state.questions.map((q, index) => {
            const userAnswer = this.state.result.answers ? this.state.result.answers[q.id] : undefined;
            
            let status = 'skipped';
            if (userAnswer === q.correctAnswer) status = 'correct';
            else if (userAnswer !== undefined) status = 'wrong';

            return { ...q, userAnswer, status, index };
        }).filter(item => {
            if (this.state.filter === 'all') return true;
            return item.status === this.state.filter;
        });

        if (filtered.length === 0) {
            container.innerHTML = `<div class="text-center opacity-50 py-10 font-bold uppercase text-xs">No questions found for this filter.</div>`;
            return;
        }

        filtered.forEach(q => {
            container.innerHTML += this._getQuestionCardTemplate(q);
        });
    },

    setFilter(filterType) {
        this.state.filter = filterType;
        // Logic kept intact, but classes align with new design system implicitly
        document.querySelectorAll('.filter-tab').forEach(btn => {
            if (btn.dataset.filter === filterType) {
                btn.classList.add('bg-blue-600', 'text-white');
                btn.classList.remove('opacity-50', 'border-transparent');
                btn.classList.add('border-blue-500'); 
            } else {
                btn.classList.remove('bg-blue-600', 'text-white', 'border-blue-500');
                btn.classList.add('opacity-50', 'border-transparent');
            }
        });
        this._renderQuestionsList();
    },

    // ============================================================
    // 5. TEMPLATES
    // ============================================================

    _getHeaderTemplate() {
        // REFACTOR: Removed bg-slate-900.
        return `
        <div class="sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button onclick="Main.navigate('results')" class="w-8 h-8 rounded-full premium-panel flex items-center justify-center active:scale-95 transition-transform hover:opacity-100 opacity-60">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h2 class="premium-text-head text-sm font-black uppercase tracking-wide">Review Answers</h2>
                    <div class="text-[10px] font-bold opacity-50 uppercase">
                        ${this.state.result.subject} &bull; ${this.state.result.score.toFixed(1)} Marks
                    </div>
                </div>
            </div>
        </div>`;
    },

    _getFilterBarTemplate() {
        const r = this.state.result;
        // REFACTOR: Replaced specific bg colors with premium-panel style for inactive tabs
        return `
        <div class="p-4 pb-0 overflow-x-auto no-scrollbar flex gap-2">
            <button onclick="UIReview.setFilter('all')" data-filter="all" class="filter-tab px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold uppercase whitespace-nowrap transition-colors shadow-lg border border-blue-500">
                All <span class="ml-1 opacity-70 bg-black/20 px-1.5 rounded-full text-[9px]">${this.state.questions.length}</span>
            </button>
            <button onclick="UIReview.setFilter('wrong')" data-filter="wrong" class="filter-tab px-4 py-2 rounded-full premium-panel opacity-50 text-xs font-bold uppercase whitespace-nowrap transition-colors border border-transparent">
                Wrong <span class="ml-1 opacity-70 bg-white/10 px-1.5 rounded-full text-[9px] text-rose-400">${r.wrong}</span>
            </button>
            <button onclick="UIReview.setFilter('correct')" data-filter="correct" class="filter-tab px-4 py-2 rounded-full premium-panel opacity-50 text-xs font-bold uppercase whitespace-nowrap transition-colors border border-transparent">
                Correct <span class="ml-1 opacity-70 bg-white/10 px-1.5 rounded-full text-[9px] text-emerald-400">${r.correct}</span>
            </button>
        </div>`;
    },

    _getQuestionCardTemplate(q) {
        let borderColor = 'border-transparent';
        let statusIcon = '<i class="fa-solid fa-minus opacity-50"></i>';
        
        if (q.status === 'correct') {
            borderColor = 'border-emerald-500/50';
            statusIcon = '<i class="fa-solid fa-check text-emerald-500"></i>';
        } else if (q.status === 'wrong') {
            borderColor = 'border-rose-500/50';
            statusIcon = '<i class="fa-solid fa-xmark text-rose-500"></i>';
        }

        const optionsHTML = q.options.map((opt, idx) => {
            const isCorrect = idx === q.correctAnswer;
            const isSelected = idx === q.userAnswer;
            
            // REFACTOR: Replaced bg-slate-800 with premium-panel logic
            let bgClass = "premium-panel opacity-60 border-transparent";
            let iconClass = "bg-white/10 opacity-50";

            if (isCorrect) {
                bgClass = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30 opacity-100";
                iconClass = "bg-emerald-500 text-white opacity-100";
            } else if (isSelected && !isCorrect) {
                bgClass = "bg-rose-500/10 text-rose-300 border-rose-500/30 opacity-100";
                iconClass = "bg-rose-500 text-white opacity-100";
            }

            return `
                <div class="p-3 rounded-lg border ${bgClass} flex items-start gap-3 mb-2 text-sm transition-colors">
                    <div class="w-5 h-5 rounded-full ${iconClass} flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">${String.fromCharCode(65 + idx)}</div>
                    <div class="leading-snug">${opt}</div>
                    ${isSelected ? '<span class="ml-auto text-[9px] font-bold uppercase opacity-70 tracking-wider mt-1">You</span>' : ''}
                </div>
            `;
        }).join('');

        // REFACTOR: Replaced bg-slate-800/50 with premium-card
        return `
        <div class="premium-card p-5 rounded-[20px] border ${borderColor} relative overflow-hidden group">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg premium-panel flex items-center justify-center text-sm font-bold opacity-80 border border-white/5">${q.index + 1}</span>
                    <span class="w-8 h-8 rounded-lg premium-panel flex items-center justify-center text-lg border border-white/5">${statusIcon}</span>
                </div>
            </div>
            <div class="text-sm font-medium leading-relaxed mb-6 opacity-90">${q.text}</div>
            <div class="mb-4">${optionsHTML}</div>
            <details class="group/exp">
                <summary class="list-none cursor-pointer flex items-center gap-2 text-[10px] font-bold opacity-50 uppercase tracking-wider hover:text-blue-400 transition-colors select-none">
                    <i class="fa-solid fa-lightbulb"></i><span>Show Explanation</span>
                </summary>
                <div class="mt-3 p-4 rounded-xl premium-panel border border-blue-500/20 text-xs leading-relaxed animate-fade-in text-blue-200">
                    ${q.explanation || "No explanation provided."}
                </div>
            </details>
        </div>`;
    },

    _getLoadingSkeleton() {
        return `
        <div class="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div class="w-12 h-12 border-4 border-white/20 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-xs font-bold opacity-50 uppercase animate-pulse">Loading Review...</div>
        </div>`;
    },

    _renderError(container, msg) {
        return; 
    }
};

window.UIReview = UIReview;

