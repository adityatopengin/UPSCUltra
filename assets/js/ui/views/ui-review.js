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
        questions: [], // The full question objects
        filter: 'all' // 'all', 'wrong', 'correct', 'skipped'
    },

    // ============================================================
    // 2. VIEW INITIALIZATION
    // ============================================================

    async render(container) {
        console.log("🧐 UIReview: Opening Inspection...");
        
        container.innerHTML = '';
        container.className = 'view-container pb-24 bg-slate-900 min-h-screen';

        // 1. Get Result ID (From Memory or URL)
        const resultId = this._getResultId();
        
        if (!resultId) {
            this._renderError(container, "No Result ID found to review.");
            return;
        }

        // 2. Render Loading State
        container.innerHTML = this._getLoadingSkeleton();

        try {
            // 3. Fetch Data (Result + Questions)
            await this._loadReviewData(resultId);

            // 4. Render Main Interface
            this._renderInterface(container);

        } catch (e) {
            console.error("UIReview: Load Failed", e);
            this._renderError(container, "Could not load review data. " + e.message);
        }
    },

    // ============================================================
    // 3. DATA FETCHING (The Heavy Lifting)
    // ============================================================

    async _loadReviewData(resultId) {
        // A. Fetch the Result Record
        let result = window.Main && window.Main.state ? window.Main.state.lastResult : null;
        
        if (!result || result.id !== resultId) {
            result = await DB.get('history', resultId);
        }

        if (!result) throw new Error("Result record missing.");
        this.state.result = result;

        // B. Reconstruct Questions
        // Since we didn't save full question text in History (to save space),
        // we try to fetch them from DB or Regenerate Mock data if they were mocks.
        
        // Strategy: If DB has them, use them. If not, use the Mock Generator.
        // For this version, we will assume they are Mock if not found.
        this.state.questions = await this._fetchOrGenerateQuestions(result.subject, result.totalMarks / 2);
    },

    async _fetchOrGenerateQuestions(subjectId, count) {
        // 1. Try DB first (Real Scenario)
        // const realQs = await DB.getAll('questions'); 
        // Filter by subject... (Skipped for MVP Mock consistency)

        // 2. Fallback to Mock Generator (Matches quiz-engine.js logic)
        // This ensures the Review page shows data even without a seeded DB.
        return Array.from({ length: count }, (_, i) => ({
            id: `q_${subjectId}_${i}`,
            text: `Question ${i + 1} for ${subjectId}. <br> What is the correct answer?`,
            options: [
                "This is the wrong answer",
                "This is the correct answer (Option B)",
                "Another wrong answer",
                "Definitely not this one"
            ],
            correctAnswer: 1, // Always B for test
            explanation: "Option B is correct because this is a mock explanation generated for testing purposes. In a real app, this would come from the database."
        }));
    },

    _getResultId() {
        if (window.Main && window.Main.state && window.Main.state.lastResultId) return Main.state.lastResultId;
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
        
        // Initial Render of List
        this._renderQuestionsList();
    },

    /**
     * Updates the list based on the current filter
     */
    _renderQuestionsList() {
        const container = document.getElementById('review-list');
        if (!container) return;

        container.innerHTML = '';
        
        // 1. Filter Questions
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

        // 2. Render Cards
        if (filtered.length === 0) {
            container.innerHTML = `<div class="text-center text-slate-500 py-10 font-bold uppercase text-xs">No questions found for this filter.</div>`;
            return;
        }

        filtered.forEach(q => {
            container.innerHTML += this._getQuestionCardTemplate(q);
        });
    },

    // ============================================================
    // 5. ACTIONS (Filtering)
    // ============================================================

    setFilter(filterType) {
        this.state.filter = filterType;
        
        // Update UI Tabs
        document.querySelectorAll('.filter-tab').forEach(btn => {
            if (btn.dataset.filter === filterType) {
                btn.classList.add('bg-blue-600', 'text-white');
                btn.classList.remove('bg-slate-800', 'text-slate-400');
            } else {
                btn.classList.remove('bg-blue-600', 'text-white');
                btn.classList.add('bg-slate-800', 'text-slate-400');
            }
        });

        // Re-render List
        this._renderQuestionsList();
    },
    
        // ... Continued from Part 1 ...

    // ============================================================
    // 6. TEMPLATES: HEADER & FILTERS
    // ============================================================

    _getHeaderTemplate() {
        return `
        <div class="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <button onclick="Main.navigate('results')" class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center active:scale-95 transition-transform hover:text-white">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h2 class="text-sm font-black text-slate-200 uppercase tracking-wide">Review Answers</h2>
                    <div class="text-[10px] font-bold text-slate-500 uppercase">
                        ${this.state.result.subject} &bull; ${this.state.result.score.toFixed(1)} Marks
                    </div>
                </div>
            </div>
        </div>
        `;
    },

    _getFilterBarTemplate() {
        // Count stats for badges
        const r = this.state.result;
        return `
        <div class="p-4 pb-0 overflow-x-auto no-scrollbar flex gap-2">
            <button onclick="UIReview.setFilter('all')" data-filter="all" class="filter-tab px-4 py-2 rounded-full bg-blue-600 text-white text-xs font-bold uppercase whitespace-nowrap transition-colors shadow-lg shadow-blue-900/20">
                All <span class="ml-1 opacity-70 bg-black/20 px-1.5 rounded-full text-[9px]">${r.questions ? r.questions.length : 15}</span>
            </button>
            
            <button onclick="UIReview.setFilter('wrong')" data-filter="wrong" class="filter-tab px-4 py-2 rounded-full bg-slate-800 text-slate-400 text-xs font-bold uppercase whitespace-nowrap transition-colors border border-white/5">
                Wrong <span class="ml-1 opacity-70 bg-slate-700 px-1.5 rounded-full text-[9px] text-rose-400">${r.wrong}</span>
            </button>
            
            <button onclick="UIReview.setFilter('skipped')" data-filter="skipped" class="filter-tab px-4 py-2 rounded-full bg-slate-800 text-slate-400 text-xs font-bold uppercase whitespace-nowrap transition-colors border border-white/5">
                Skipped <span class="ml-1 opacity-70 bg-slate-700 px-1.5 rounded-full text-[9px] text-amber-400">${r.skipped}</span>
            </button>
            
            <button onclick="UIReview.setFilter('correct')" data-filter="correct" class="filter-tab px-4 py-2 rounded-full bg-slate-800 text-slate-400 text-xs font-bold uppercase whitespace-nowrap transition-colors border border-white/5">
                Correct <span class="ml-1 opacity-70 bg-slate-700 px-1.5 rounded-full text-[9px] text-emerald-400">${r.correct}</span>
            </button>
        </div>
        `;
    },

    // ============================================================
    // 7. TEMPLATES: QUESTION CARD
    // ============================================================

    _getQuestionCardTemplate(q) {
        // Determine Border Color based on Status
        let borderColor = 'border-slate-800'; // Skipped/Default
        let statusIcon = '<i class="fa-solid fa-minus text-slate-500"></i>';
        
        if (q.status === 'correct') {
            borderColor = 'border-emerald-500/50';
            statusIcon = '<i class="fa-solid fa-check text-emerald-500"></i>';
        } else if (q.status === 'wrong') {
            borderColor = 'border-rose-500/50';
            statusIcon = '<i class="fa-solid fa-xmark text-rose-500"></i>';
        } else {
            statusIcon = '<i class="fa-solid fa-forward text-amber-500"></i>'; // Skipped
        }

        // Generate Options HTML
        const optionsHTML = q.options.map((opt, idx) => {
            const isCorrect = idx === q.correctAnswer;
            const isSelected = idx === q.userAnswer;
            
            let bgClass = "bg-slate-800/50 text-slate-400 border-transparent"; // Default
            let iconClass = "bg-slate-700 text-slate-500";

            if (isCorrect) {
                // Correct Answer (Always highlight Green)
                bgClass = "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
                iconClass = "bg-emerald-500 text-white";
            } else if (isSelected && !isCorrect) {
                // Wrong Selection (Highlight Red)
                bgClass = "bg-rose-500/10 text-rose-300 border-rose-500/30";
                iconClass = "bg-rose-500 text-white";
            }

            return `
                <div class="p-3 rounded-lg border ${bgClass} flex items-start gap-3 mb-2 text-sm">
                    <div class="w-5 h-5 rounded-full ${iconClass} flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                        ${String.fromCharCode(65 + idx)}
                    </div>
                    <div class="leading-snug">${opt}</div>
                    ${isSelected ? '<span class="ml-auto text-[9px] font-bold uppercase opacity-70 tracking-wider mt-1">You</span>' : ''}
                    ${isCorrect ? '<span class="ml-auto text-[9px] font-bold uppercase opacity-70 tracking-wider mt-1"><i class="fa-solid fa-check"></i></span>' : ''}
                </div>
            `;
        }).join('');

        return `
        <div class="premium-card p-5 rounded-[20px] border ${borderColor} bg-slate-800/50 relative overflow-hidden group">
            
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center gap-3">
                    <span class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-sm font-bold text-slate-300 border border-white/5">
                        ${q.index + 1}
                    </span>
                    <span class="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-lg border border-white/5">
                        ${statusIcon}
                    </span>
                </div>
            </div>

            <div class="text-sm font-medium text-slate-200 leading-relaxed mb-6">
                ${q.text}
            </div>

            <div class="mb-4">
                ${optionsHTML}
            </div>

            <details class="group/exp">
                <summary class="list-none cursor-pointer flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-blue-400 transition-colors select-none">
                    <i class="fa-solid fa-lightbulb"></i>
                    <span>Show Explanation</span>
                    <i class="fa-solid fa-chevron-down ml-auto group-open/exp:rotate-180 transition-transform"></i>
                </summary>
                <div class="mt-3 p-4 rounded-xl bg-blue-900/20 border border-blue-500/20 text-blue-200 text-xs leading-relaxed animate-fade-in">
                    <strong class="block mb-1 text-blue-400 uppercase text-[9px]">Explanation:</strong>
                    ${q.explanation || "No explanation provided for this question."}
                </div>
            </details>

        </div>
        `;
    },

    // ============================================================
    // 8. HELPERS
    // ============================================================

    _getLoadingSkeleton() {
        return `
        <div class="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div class="w-12 h-12 border-4 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-xs font-bold text-slate-500 uppercase animate-pulse">Loading Review...</div>
        </div>`;
    },

    _renderError(container, msg) {
        container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-[60vh] space-y-4 p-8 text-center">
            <div class="text-3xl text-slate-600"><i class="fa-solid fa-file-circle-question"></i></div>
            <div class="text-sm font-bold text-slate-400">${msg}</div>
            <button onclick="Main.navigate('home')" class="px-6 py-2 bg-slate-800 rounded-lg text-white text-xs font-bold uppercase mt-4">Go Back</button>
        </div>`;
    }
};

// Global Registration
window.UIReview = UIReview;

