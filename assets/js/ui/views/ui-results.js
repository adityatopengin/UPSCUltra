/**
 * UI-RESULTS (THE REPORT CARD)
 * Version: 3.5.1 (Patched: Fixes Reload Crash via Router Params)
 * Path: assets/js/ui/views/ui-results.js
 */

import { DB } from '../../services/db.js';
import { CONFIG } from '../../config.js';

// We do NOT import BehavioralEngine at the top level to prevent boot deadlocks.
let BehavioralEngine = null;

export const UIResults = {
    // ============================================================
    // 1. STATE & INITIALIZATION
    // ============================================================
    
    state: {
        isNavigating: false // 🛡️ FIX: Debounce flag for buttons
    },

    async render(container) {
        console.log("📊 UIResults: Generating Report...");
        this.state.isNavigating = false; // Reset flag on mount
        
        // 1. Lazy Load Dependencies (Safe Mode)
        if (!BehavioralEngine) {
            try {
                const module = await import('../../engine/behavioral-engine.js');
                BehavioralEngine = module.BehavioralEngine;
            } catch (e) {
                console.warn("UIResults: Psych Engine missing, running in lite mode.");
            }
        }

        container.innerHTML = '';
        container.className = 'view-container pb-40 min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300';

        // 2. Try Memory First (Fastest)
        let result = window.Main && window.Main.state ? window.Main.state.lastResult : null;
        const resultId = this._getResultId();

        container.innerHTML = this._getLoadingSkeleton();

        try {
            // 3. If not in memory, fetch from DB
            if (!result && resultId) {
                console.log("📊 UIResults: Fetching from DB...");
                result = await DB.get('history', resultId);
            }

            if (!result) throw new Error("Result data missing or not found.");

            // 4. Render Content
            this._renderContent(container, result);

            // 5. Animate Progress Bar
            setTimeout(() => {
                const bar = document.getElementById('score-bar-fill');
                if (bar) bar.style.width = `${(result.score / result.totalMarks) * 100}%`;
            }, 100);

        } catch (e) {
            console.error("UIResults Error:", e);
            this._renderError(container, "Could not load results. " + e.message);
        }
    },

    // 🛡️ FIX: Centralized Navigation Handler (Debounce)
    handleNavigation(target, params = null) {
        if (this.state.isNavigating) return;
        this.state.isNavigating = true;

        // Visual feedback
        const btns = document.querySelectorAll('button');
        btns.forEach(b => b.classList.add('opacity-50', 'pointer-events-none'));

        if (window.Main) {
            window.Main.navigate(target, params);
        } else {
            window.location.reload();
        }
    },

    _getResultId() {
        // 1. Memory (Immediate post-quiz)
        if (window.Main && window.Main.state && window.Main.state.lastResultId) {
            return window.Main.state.lastResultId;
        }
        
        // 2. Router Params (Reload/Deep Link) - 🛡️ CRITICAL FIX
        // Main.js puts the ID here when handling a URL like #results?id=...
        if (window.Main && window.Main.state && window.Main.state.params && window.Main.state.params.id) {
            return window.Main.state.params.id;
        }

        // 3. URL Hash (Fallback if Router didn't clean up)
        const hash = window.location.hash;
        if (hash.includes('?id=')) {
            return hash.split('?id=')[1];
        }
        return null;
    },

    // ============================================================
    // 2. RENDERERS
    // ============================================================

    _renderContent(container, result) {
        const subjectConfig = this._getSubjectConfig(result.subject);
        const headerHTML = this._getScoreCardTemplate(result, subjectConfig);
        const bodyHTML = `<div id="analysis-grid" class="p-4 space-y-4 animate-slide-up"></div>`;
        const footerHTML = this._getFooterTemplate(result.id);

        container.innerHTML = `${headerHTML}${bodyHTML}${footerHTML}`;
        this._initAnalysis(result);
    },

    _getScoreCardTemplate(result, config) {
        const percentage = Math.round((result.score / result.totalMarks) * 100);
        const passed = percentage >= 33;
        
        let color = passed ? 'emerald' : 'rose';
        let grade = passed ? 'Qualified' : 'Needs Work';
        if (percentage > 60) { color = 'amber'; grade = 'Excellent'; }

        const mins = Math.floor((result.totalDuration || 0) / 60);

        return `
        <div class="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-slate-200 dark:border-white/5 bg-slate-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md transition-colors">
            <button onclick="UIResults.handleNavigation('home')" class="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-slate-500 dark:text-white/60 flex items-center justify-center active:scale-95 hover:bg-slate-300 dark:hover:bg-white/20 transition-all">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <h2 class="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white">Performance Report</h2>
            <div class="w-8"></div>
        </div>

        <div class="p-6 pb-2">
            <div class="p-8 rounded-[32px] text-center relative overflow-hidden bg-white dark:bg-slate-900/50 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-white/5">
                <div class="w-16 h-16 mx-auto bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 rounded-full flex items-center justify-center text-2xl mb-4 shadow-lg shadow-${color}-500/10">
                    <i class="fa-solid fa-${config.icon}"></i>
                </div>
                <div class="text-5xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">
                    ${result.score.toFixed(1)}
                </div>
                <div class="text-[10px] font-bold uppercase tracking-widest mb-4 text-slate-500 dark:text-slate-400">
                    Target: 66 Marks
                </div>
                <div class="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden mb-4">
                    <div id="score-bar-fill" class="h-full bg-${color}-500 w-0 transition-all duration-1000 ease-out"></div>
                </div>
                <div class="inline-block px-4 py-1 rounded-full bg-${color}-100 dark:bg-${color}-500/10 border border-${color}-200 dark:border-${color}-500/20 text-${color}-600 dark:text-${color}-400 text-xs font-black uppercase tracking-wider">
                    ${grade}
                </div>
            </div>
        </div>

        <div class="grid grid-cols-4 gap-2 px-6 mb-2">
             <div class="p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center shadow-sm">
                <div class="text-lg font-black text-emerald-500 dark:text-emerald-400">${result.correct}</div>
                <div class="text-[8px] font-bold uppercase text-slate-400 dark:text-white/50">Right</div>
            </div>
            <div class="p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center shadow-sm">
                <div class="text-lg font-black text-rose-500 dark:text-rose-400">${result.wrong}</div>
                <div class="text-[8px] font-bold uppercase text-slate-400 dark:text-white/50">Wrong</div>
            </div>
             <div class="p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center shadow-sm">
                <div class="text-lg font-black text-slate-400 dark:text-white/60">${result.skipped}</div>
                <div class="text-[8px] font-bold uppercase text-slate-400 dark:text-white/50">Skip</div>
            </div>
             <div class="p-3 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 text-center shadow-sm">
                <div class="text-lg font-black text-blue-500 dark:text-blue-400">${mins}m</div>
                <div class="text-[8px] font-bold uppercase text-slate-400 dark:text-white/50">Time</div>
            </div>
        </div>
        `;
    },

    _getFooterTemplate(resultId) {
        return `
        <div class="fixed bottom-0 left-0 w-full border-t border-slate-200 dark:border-white/5 p-4 z-30 flex gap-3 safe-area-pb bg-slate-50/90 dark:bg-[#0f172a]/90 backdrop-blur-md transition-colors">
            <button onclick="UIResults.handleNavigation('home')" class="flex-1 py-4 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-white font-bold uppercase tracking-widest text-xs active:scale-95 transition-transform hover:bg-slate-300 dark:hover:bg-white/20">
                Finish
            </button>
            <button onclick="UIResults.handleNavigation('review', { id: '${resultId}' })" class="flex-1 py-4 rounded-xl bg-white dark:bg-indigo-600 text-slate-900 dark:text-white font-bold uppercase tracking-widest text-xs shadow-lg border border-slate-200 dark:border-transparent active:scale-95 transition-transform hover:bg-slate-50 dark:hover:bg-indigo-500">
                Review Mistakes
            </button>
        </div>
        `;
    },

    _initAnalysis(result) {
        const grid = document.getElementById('analysis-grid');
        if (!grid) return;

        // 1. Archetype
        if (BehavioralEngine && BehavioralEngine.getUserArchetype) {
            const archetype = BehavioralEngine.getUserArchetype();
            grid.innerHTML += this._renderPsychCard('Archetype', archetype, 'brain', 'purple');
        }

        // 2. Accuracy
        const accuracy = result.accuracy || 0;
        let accColor = accuracy > 80 ? "emerald" : (accuracy > 50 ? "amber" : "rose");
        grid.innerHTML += this._renderPsychCard('Precision', `${accuracy}%`, 'crosshairs', accColor);

        // 3. Speed
        const qCount = (result.correct + result.wrong + result.skipped) || 1;
        const avgTime = ((result.totalDuration || 0) / qCount).toFixed(1);
        grid.innerHTML += this._renderPsychCard('Avg Speed', `${avgTime}s`, 'stopwatch', 'blue');

        // 4. Mistakes Link
        if (result.wrong > 0) {
            grid.innerHTML += `
            <div onclick="UIResults.handleNavigation('review', { id: '${result.id}' })" class="p-5 rounded-[24px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm flex items-center justify-between cursor-pointer active:scale-95 transition-transform group">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center text-xl"><i class="fa-solid fa-file-circle-xmark"></i></div>
                    <div>
                        <div class="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-500 dark:text-slate-400">Focus Area</div>
                        <div class="text-lg font-black text-slate-900 dark:text-slate-200 leading-tight">Review ${result.wrong} Errors</div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-300 dark:text-white/30 group-hover:text-slate-500 dark:group-hover:text-white transition-colors"></i>
            </div>`;
        }
    },

    _renderPsychCard(title, value, icon, color) {
        return `
        <div class="p-5 rounded-[24px] bg-white dark:bg-white/5 border border-slate-200 dark:border-white/5 shadow-sm flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-${color}-100 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-400 flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-${icon}"></i></div>
            <div>
                <div class="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-slate-500 dark:text-slate-400">${title}</div>
                <div class="text-lg font-black text-slate-900 dark:text-slate-200 leading-tight">${value}</div>
            </div>
        </div>`;
    },

    _getSubjectConfig(id) {
        // 🛡️ FIX: Handle Mock IDs explicitly
        if (id === 'mock_gs1') return { name: 'GS Prelims Mock', color: 'amber', icon: 'trophy' };
        if (id === 'mock_csat') return { name: 'CSAT Mock', color: 'purple', icon: 'flag-checkered' };

        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        return [...gs1, ...csat].find(s => s.id === id) || { name: 'Unknown', color: 'slate', icon: 'question' };
    },

    _getLoadingSkeleton() {
        return `<div class="flex flex-col items-center justify-center h-[60vh] space-y-4"><div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;
    },

    _renderError(container, msg) {
        container.innerHTML = `<div class="p-10 text-center opacity-60 text-slate-500 dark:text-slate-400">${msg} <br><br> <button onclick="UIResults.handleNavigation('home')" class="bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-white px-4 py-2 rounded">Home</button></div>`;
    }
};

window.UIResults = UIResults;

