/**
 * UI-RESULTS (THE REPORT CARD)
 * Version: 3.2.0 (Lazy Load Fix)
 * Path: assets/js/ui/views/ui-results.js
 */

import { DB } from '../../services/db.js';
import { CONFIG } from '../../config.js';

// We do NOT import BehavioralEngine at the top level to prevent boot deadlocks.
let BehavioralEngine = null;

export const UIResults = {
    // ============================================================
    // 1. VIEW INITIALIZATION
    // ============================================================

    async render(container) {
        console.log("📊 UIResults: Generating Report...");
        
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
        // REFACTOR: Removed bg-slate-900. Increased padding to pb-40.
        container.className = 'view-container pb-40 min-h-screen';

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

            if (!result) throw new Error("Result data missing.");

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

    _getResultId() {
        if (window.Main && window.Main.state && window.Main.state.lastResultId) {
            return window.Main.state.lastResultId;
        }
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

        // REFACTOR: Replaced bg-slate-900/backdrop with premium header logic.
        // Replaced card styling with premium-card.
        return `
        <div class="sticky top-0 z-30 px-4 py-3 flex items-center justify-between border-b border-white/5 bg-inherit backdrop-blur-md">
            <button onclick="Main.navigate('home')" class="w-8 h-8 rounded-full premium-panel flex items-center justify-center active:scale-95 opacity-60 hover:opacity-100">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <h2 class="premium-text-head text-xs font-black uppercase tracking-widest">Performance Report</h2>
            <div class="w-8"></div>
        </div>

        <div class="p-6 pb-2">
            <div class="premium-card p-8 rounded-[32px] text-center relative overflow-hidden shadow-2xl">
                <div class="w-16 h-16 mx-auto bg-${color}-500/10 text-${color}-400 rounded-full flex items-center justify-center text-2xl mb-4 shadow-lg shadow-${color}-500/10">
                    <i class="fa-solid fa-${config.icon}"></i>
                </div>
                <div class="text-5xl font-black text-white tracking-tighter mb-1 shadow-black drop-shadow-md">
                    ${result.score.toFixed(1)}
                </div>
                <div class="text-[10px] font-bold opacity-50 uppercase tracking-widest mb-4">
                    Target: 66 Marks
                </div>
                <div class="h-2 w-full bg-white/10 rounded-full overflow-hidden mb-4">
                    <div id="score-bar-fill" class="h-full bg-${color}-500 w-0 transition-all duration-1000 ease-out"></div>
                </div>
                <div class="inline-block px-4 py-1 rounded-full bg-${color}-500/10 border border-${color}-500/20 text-${color}-400 text-xs font-black uppercase tracking-wider">
                    ${grade}
                </div>
            </div>
        </div>

        <div class="grid grid-cols-4 gap-2 px-6 mb-2">
             <div class="p-3 rounded-2xl premium-panel border border-white/5 text-center">
                <div class="text-lg font-black text-emerald-400">${result.correct}</div>
                <div class="text-[8px] font-bold opacity-50 uppercase">Right</div>
            </div>
            <div class="p-3 rounded-2xl premium-panel border border-white/5 text-center">
                <div class="text-lg font-black text-rose-400">${result.wrong}</div>
                <div class="text-[8px] font-bold opacity-50 uppercase">Wrong</div>
            </div>
             <div class="p-3 rounded-2xl premium-panel border border-white/5 text-center">
                <div class="text-lg font-black opacity-60">${result.skipped}</div>
                <div class="text-[8px] font-bold opacity-50 uppercase">Skip</div>
            </div>
             <div class="p-3 rounded-2xl premium-panel border border-white/5 text-center">
                <div class="text-lg font-black text-blue-400">${mins}m</div>
                <div class="text-[8px] font-bold opacity-50 uppercase">Time</div>
            </div>
        </div>
        `;
    },

    _getFooterTemplate(resultId) {
        // REFACTOR: Replaced bg-slate-900 with premium styling
        return `
        <div class="fixed bottom-0 left-0 w-full border-t border-white/5 p-4 z-30 flex gap-3 safe-area-pb bg-inherit backdrop-blur-md">
            <button onclick="Main.navigate('home')" class="flex-1 py-4 rounded-xl premium-panel font-bold uppercase tracking-widest text-xs active:scale-95 transition-transform opacity-80 hover:opacity-100">
                Finish
            </button>
            <button onclick="Main.navigate('review', { id: '${resultId}' })" class="flex-1 py-4 rounded-xl bg-white text-slate-900 font-bold uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform hover:bg-gray-100">
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
            // REFACTOR: Replaced bg-slate-800 with premium-card
            grid.innerHTML += `
            <div onclick="Main.navigate('review', { id: '${result.id}' })" class="p-5 rounded-[24px] premium-card border border-white/5 flex items-center justify-between cursor-pointer active:scale-95 transition-transform group">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center text-xl"><i class="fa-solid fa-file-circle-xmark"></i></div>
                    <div>
                        <div class="text-[10px] font-bold opacity-50 uppercase tracking-wider mb-0.5">Focus Area</div>
                        <div class="text-lg font-black text-slate-200 leading-tight">Review ${result.wrong} Errors</div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right opacity-50 group-hover:opacity-100 transition-colors"></i>
            </div>`;
        }
    },

    _renderPsychCard(title, value, icon, color) {
        // REFACTOR: Replaced bg-slate-800 with premium-card
        return `
        <div class="p-5 rounded-[24px] premium-card border border-white/5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-${color}-500/10 text-${color}-400 flex items-center justify-center text-xl shrink-0"><i class="fa-solid fa-${icon}"></i></div>
            <div>
                <div class="text-[10px] font-bold opacity-50 uppercase tracking-wider mb-0.5">${title}</div>
                <div class="text-lg font-black text-slate-200 leading-tight">${value}</div>
            </div>
        </div>`;
    },

    _getSubjectConfig(id) {
        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        return [...gs1, ...csat].find(s => s.id === id) || { name: 'Unknown', color: 'slate', icon: 'question' };
    },

    _getLoadingSkeleton() {
        return `<div class="flex flex-col items-center justify-center h-[60vh] space-y-4"><div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>`;
    },

    _renderError(container, msg) {
        // REFACTOR: Removed bg-slate-700
        container.innerHTML = `<div class="p-10 text-center opacity-60">${msg} <br><br> <button onclick="Main.navigate('home')" class="text-white premium-panel px-4 py-2 rounded">Home</button></div>`;
    }
};

window.UIResults = UIResults;


