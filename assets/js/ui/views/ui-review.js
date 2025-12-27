/**
 * UI-REVIEW (MISTAKE ANALYSIS)
 * Version: 2.4.1 (Patched: Fixes Navigation ID Loss)
 * Path: assets/js/ui/views/ui-review.js
 * Responsibilities:
 * 1. Fetches the Exam Result and the original Questions.
 * 2. Filters questions by status (All, Correct, Wrong, Skipped).
 * 3. Renders the detailed "Question-Answer" breakdown.
 */

import { DB } from '../../services/db.js';
import { CONFIG } from '../../config.js';

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
        container.className = 'view-container pb-40 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300';

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
            console.error(e);
            this._renderError(container, "Failed to load review data.");
        }
    },

    _getResultId() {
        // 1. Memory (Immediate post-quiz)
        if (window.Main && window.Main.state && window.Main.state.lastResultId) {
            return window.Main.state.lastResultId;
        }

        // 2. Router Params (Navigation from Results Page) - 🛡️ CRITICAL FIX
        // This is where Main.navigate('review', { id: ... }) stores the ID
        if (window.Main && window.Main.state && window.Main.state.params && window.Main.state.params.id) {
            return window.Main.state.params.id;
        }

        // 3. Fallback to URL hash
        const hash = window.location.hash;
        if (hash.includes('?id=')) return hash.split('?id=')[1];

        // 4. Fallback to last result object
        if (window.Main && window.Main.state && window.Main.state.lastResult) {
            return window.Main.state.lastResult.id;
        }
        return null;
    },

    async _loadReviewData(id) {
        // 1. Try Memory
        if (window.Main && window.Main.state.lastResult && window.Main.state.lastResult.id === id) {
            this.state.result = window.Main.state.lastResult;
        } else {
            // 2. Fetch DB
            this.state.result = await DB.get('history', id);
        }

        if (!this.state.result) throw new Error("Result not found in DB");

        // 3. Hydrate Questions
        // The result object should contain the snapshot of questions used
        this.state.questions = this.state.result.questions || [];
    },

    // ============================================================
    // 3. RENDER INTERFACE
    // ============================================================

    _renderInterface(container) {
        container.innerHTML = `
            ${this._getHeaderTemplate()}
            ${this._getFilterTabsTemplate()}
            <div id="review-list" class="px-4 space-y-6 animate-slide-up">
                </div>
            ${this._getFooterTemplate()}
        `;

        this._applyFilter('all'); // Default load
    },

    _getHeaderTemplate() {
        const r = this.state.result;
        
        // 🛡️ FIX: Resolve Subject Name
        let subName = 'Review';
        if (r.subject === 'mock_gs1') subName = 'GS Prelims Mock';
        else if (r.subject === 'mock_csat') subName = 'CSAT Mock';
        else {
             const allSubs = [...(CONFIG.subjectsGS1||[]), ...(CONFIG.subjectsCSAT||[])];
             const found = allSubs.find(s => s.id === r.subject);
             if (found) subName = found.name;
        }

        return `
        <div class="sticky top-0 z-30 px-4 py-4 bg-slate-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md border-b border-slate-200 dark:border-white/5 flex items-center justify-between transition-colors">
            <button onclick="Main.navigate('results', {id: '${r.id}'})" class="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5 flex items-center justify-center text-slate-500 dark:text-white/60 hover:opacity-100 active:scale-95 transition-all">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            
            <div class="text-center">
                <div class="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">${subName}</div>
                <div class="text-sm font-black text-slate-900 dark:text-white tracking-wide">
                    ${r.score.toFixed(0)} / ${r.totalMarks}
                </div>
            </div>
            
            <div class="w-10"></div> 
        </div>`;
    },

    _getFilterTabsTemplate() {
        return `
        <div class="flex p-4 gap-2 overflow-x-auto no-scrollbar">
            <button onclick="UIReview._applyFilter('all')" id="filter-all" class="filter-btn active px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all bg-white dark:bg-white/5 text-slate-900 dark:text-white">
                All Questions
            </button>
            <button onclick="UIReview._applyFilter('wrong')" id="filter-wrong" class="filter-btn px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all text-rose-600 dark:text-rose-400 opacity-60">
                Mistakes (${this.state.result.wrong})
            </button>
            <button onclick="UIReview._applyFilter('correct')" id="filter-correct" class="filter-btn px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all text-emerald-600 dark:text-emerald-400 opacity-60">
                Correct (${this.state.result.correct})
            </button>
            <button onclick="UIReview._applyFilter('skipped')" id="filter-skipped" class="filter-btn px-4 py-2 rounded-full border border-slate-200 dark:border-white/10 text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all text-slate-500 dark:text-slate-400 opacity-60">
                Skipped
            </button>
        </div>`;
    },

    _applyFilter(type) {
        this.state.filter = type;
        
        // Update Buttons
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.remove('bg-slate-200', 'dark:bg-white/20', 'opacity-100', 'shadow-sm');
            b.classList.add('opacity-60', 'bg-transparent');
        });
        const activeBtn = document.getElementById(`filter-${type}`);
        if(activeBtn) {
            activeBtn.classList.remove('opacity-60', 'bg-transparent');
            activeBtn.classList.add('bg-slate-200', 'dark:bg-white/20', 'opacity-100', 'shadow-sm');
        }

        // Render List
        const list = document.getElementById('review-list');
        list.innerHTML = '';

        this.state.questions.forEach((q, index) => {
            
            // 🛡️ FIX: Read 'userAnswer' directly from the question object
            const userAnsIdx = q.userAnswer;

            let status = 'skipped';
            if (userAnsIdx !== undefined && userAnsIdx !== null) {
                status = (userAnsIdx === q.correctAnswer) ? 'correct' : 'wrong';
            }

            // Filter Logic
            if (type !== 'all' && type !== status) return;

            list.innerHTML += this._getQuestionCard(q, index, status, userAnsIdx);
        });

        if (list.innerHTML === '') {
            list.innerHTML = `<div class="p-8 text-center opacity-40 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">No questions found in this category.</div>`;
        }
    },

    _getQuestionCard(q, index, status, userAnsIdx) {
        let borderClass = 'border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/50';
        let statusIcon = '<i class="fa-solid fa-minus text-slate-400 dark:text-slate-500"></i>';
        
        if (status === 'correct') {
            borderClass = 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/5 shadow-sm';
            statusIcon = '<i class="fa-solid fa-check text-emerald-500 dark:text-emerald-400"></i>';
        } else if (status === 'wrong') {
            borderClass = 'border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/5 shadow-sm';
            statusIcon = '<i class="fa-solid fa-xmark text-rose-500 dark:text-rose-400"></i>';
        }

        // 🛡️ NEW: Mock Subject Badge (Consistent with Quiz View)
        let badgeHTML = '';
        if (this.state.result.subject && this.state.result.subject.startsWith('mock_') && q.subject) {
             const allSubs = [...(CONFIG.subjectsGS1||[]), ...(CONFIG.subjectsCSAT||[])];
             const subConf = allSubs.find(s => s.id === q.subject);
             if (subConf) {
                 badgeHTML = `<div class="mb-2"><span class="px-2 py-1 rounded bg-${subConf.color}-100 dark:bg-${subConf.color}-500/10 text-${subConf.color}-600 dark:text-${subConf.color}-400 text-[9px] font-bold uppercase tracking-wider border border-${subConf.color}-200 dark:border-${subConf.color}-500/20"><i class="fa-solid fa-${subConf.icon} mr-1"></i> ${subConf.name}</span></div>`;
             }
        }

        // Generate Options
        const optionsHTML = q.options.map((opt, i) => {
            let optClass = 'text-slate-500 dark:text-slate-400';
            let icon = '';

            // Logic to highlight Correct and User Selection
            if (i === q.correctAnswer) {
                optClass = 'text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg px-2 py-1';
                icon = '<i class="fa-solid fa-check ml-2"></i>';
            } 
            else if (i === userAnsIdx && i !== q.correctAnswer) {
                optClass = 'text-rose-700 dark:text-rose-400 font-bold bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-lg px-2 py-1';
                icon = '<i class="fa-solid fa-xmark ml-2"></i>';
            }

            return `<div class="text-xs mb-1.5 ${optClass} flex justify-between items-center transition-colors">
                <span><span class="opacity-50 mr-2">${String.fromCharCode(65+i)}.</span> ${opt}</span>
                ${icon}
            </div>`;
        }).join('');

        return `
        <div class="premium-card p-5 rounded-[24px] border ${borderClass} animate-fade-in relative group shadow-sm transition-all">
            <div class="flex justify-between items-start mb-3">
                <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-md flex items-center justify-center text-sm font-bold opacity-80 border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300">${index + 1}</span>
                    <span class="w-8 h-8 rounded-lg flex items-center justify-center text-lg border border-slate-200 dark:border-white/5 bg-white dark:bg-white/5">${statusIcon}</span>
                </div>
            </div>
            ${badgeHTML}
            <div class="text-sm font-medium leading-relaxed mb-6 text-slate-800 dark:text-slate-100">${q.text}</div>
            <div class="mb-4">${optionsHTML}</div>
            <details class="group/exp">
                <summary class="list-none cursor-pointer flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors select-none">
                    <i class="fa-solid fa-lightbulb"></i><span>Show Explanation</span>
                </summary>
                <div class="mt-3 p-4 rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/5 text-xs leading-relaxed animate-fade-in text-blue-800 dark:text-blue-200">
                    ${q.explanation || "No explanation provided."}
                </div>
            </details>
        </div>`;
    },

    _getLoadingSkeleton() {
        return `
        <div class="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div class="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
            <div class="text-xs font-bold opacity-50 uppercase animate-pulse text-slate-500 dark:text-slate-400">Loading Review...</div>
        </div>`;
    },

    _renderError(container, msg) {
        container.innerHTML = `<div class="p-10 text-center opacity-60 text-sm font-bold text-slate-500 dark:text-slate-400">${msg} <br><br> <button onclick="Main.navigate('home')" class="bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white px-6 py-3 rounded-xl uppercase tracking-widest text-[10px]">Return Home</button></div>`;
    },
    
    _getFooterTemplate() {
        return `<div class="h-12"></div>`; // Spacer
    }
};

window.UIReview = UIReview;

