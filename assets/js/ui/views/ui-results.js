/**
 * UI-RESULTS (THE REPORT CARD)
 * Version: 3.1.0 (Robust + Features Enabled)
 * Path: assets/js/ui/views/ui-results.js
 * Responsibilities:
 * 1. Fetches result data (Memory first, then DB).
 * 2. Displays Score, Grade, and Pass/Fail status.
 * 3. Renders Behavioral Analysis (Speed, Impulse, Archetype).
 * 4. Navigation hook to the future 'Review' page.
 */

import { DB } from '../../services/db.js';
import { CONFIG } from '../../config.js';

// Optional: Import BehavioralEngine if available, else graceful fallback
let BehavioralEngine = null;
try {
    const module = await import('../../engine/behavioral-engine.js');
    BehavioralEngine = module.BehavioralEngine;
} catch (e) {
    console.warn("UIResults: BehavioralEngine not loaded, using defaults.");
}

export const UIResults = {
    // ============================================================
    // 1. VIEW INITIALIZATION
    // ============================================================

    async render(container) {
        console.log("📊 UIResults: Generating Report...");
        
        container.innerHTML = '';
        container.className = 'view-container pb-24 bg-slate-900 min-h-screen';

        // 1. Try Memory First (Fastest)
        let result = window.Main && window.Main.state ? window.Main.state.lastResult : null;
        const resultId = this._getResultId();

        container.innerHTML = this._getLoadingSkeleton();

        try {
            // 2. If not in memory, fetch from DB
            if (!result && resultId) {
                console.log("📊 UIResults: Fetching from DB...");
                result = await DB.get('history', resultId);
            }

            if (!result) throw new Error("Result data missing.");

            // 3. Render Content
            this._renderContent(container, result);

            // 4. Animate Progress Bar
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
        // Fallback: Check URL hash params
        const hash = window.location.hash;
        if (hash.includes('?id=')) {
            return hash.split('?id=')[1];
        }
        return null;
    },

    // ============================================================
    // 2. MAIN CONTENT RENDERER
    // ============================================================

    _renderContent(container, result) {
        const subjectConfig = this._getSubjectConfig(result.subject);
        
        // A. Score Card (Header)
        const headerHTML = this._getScoreCardTemplate(result, subjectConfig);
        
        // B. Analysis Grid (Body) - Populated via JS
        const bodyHTML = `<div id="analysis-grid" class="p-4 space-y-4 animate-slide-up"></div>`;

        // C. Footer (Actions)
        const footerHTML = this._getFooterTemplate(result.id);

        container.innerHTML = `
            ${headerHTML}
            ${bodyHTML}
            ${footerHTML}
        `;

        // D. Populate Analysis
        this._initAnalysis(result);
    },

    // ============================================================
    // 3. VISUAL TEMPLATES
    // ============================================================

    _getScoreCardTemplate(result, config) {
        const percentage = Math.round((result.score / result.totalMarks) * 100);
        const passed = percentage >= 33; // UPSC Standard 33% for CSAT/Prelims cutoff
        
        // Dynamic Styling
        let color = passed ? 'emerald' : 'rose';
        let grade = passed ? 'Qualified' : 'Needs Work';
        if (percentage > 60) { color = 'amber'; grade = 'Excellent'; } // High score

        const mins = Math.floor((result.totalDuration || 0) / 60);

        return `
        <div class="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
            <button onclick="Main.navigate('home')" class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center active:scale-95">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <h2 class="text-xs font-black text-slate-300 uppercase tracking-widest">Performance Report</h2>
            <div class="w-8"></div>
        </div>

        <div class="p-6 pb-2">
            <div class="premium-card p-8 rounded-[32px] text-center relative overflow-hidden border border-${color}-500/20 shadow-2xl">
                <div class="absolute inset-0 bg-${color}-500/5 blur-3xl"></div>
                
                <div class="w-16 h-16 mx-auto bg-${color}-500/10 text-${color}-400 rounded-full flex items-center justify-center text-2xl mb-4 shadow-lg shadow-${color}-500/10">
                    <i class="fa-solid fa-${config.icon}"></i>
                </div>

                <div class="text-5xl font-black text-white tracking-tighter mb-1 shadow-black drop-shadow-md">
                    ${result.score.toFixed(1)}
                </div>
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                    Target: 66 Marks
                </div>

                <div class="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
                    <div id="score-bar-fill" class="h-full bg-${color}-500 w-0 transition-all duration-1000 ease-out"></div>
                </div>

                <div class="inline-block px-4 py-1 rounded-full bg-${color}-500/10 border border-${color}-500/20 text-${color}-400 text-xs font-black uppercase tracking-wider">
                    ${grade}
                </div>
            </div>
        </div>

        <div class="grid grid-cols-4 gap-2 px-6 mb-2">
             <div class="p-3 rounded-2xl bg-slate-800 border border-white/5 text-center">
                <div class="text-lg font-black text-emerald-400">${result.correct}</div>
                <div class="text-[8px] font-bold text-slate-500 uppercase">Right</div>
            </div>
            <div class="p-3 rounded-2xl bg-slate-800 border border-white/5 text-center">
                <div class="text-lg font-black text-rose-400">${result.wrong}</div>
                <div class="text-[8px] font-bold text-slate-500 uppercase">Wrong</div>
            </div>
             <div class="p-3 rounded-2xl bg-slate-800 border border-white/5 text-center">
                <div class="text-lg font-black text-slate-400">${result.skipped}</div>
                <div class="text-[8px] font-bold text-slate-500 uppercase">Skip</div>
            </div>
             <div class="p-3 rounded-2xl bg-slate-800 border border-white/5 text-center">
                <div class="text-lg font-black text-blue-400">${mins}m</div>
                <div class="text-[8px] font-bold text-slate-500 uppercase">Time</div>
            </div>
        </div>
        `;
    },

    _getFooterTemplate(resultId) {
        return `
        <div class="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl border-t border-white/5 p-4 z-30 flex gap-3 safe-area-pb">
            <button onclick="Main.navigate('home')" class="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-bold uppercase tracking-widest text-xs active:scale-95 transition-transform hover:bg-slate-700">
                Finish
            </button>
            <button onclick="Main.navigate('review', { id: '${resultId}' })" class="flex-1 py-4 rounded-xl bg-white text-slate-900 font-bold uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-transform hover:bg-gray-100">
                Review Mistakes
            </button>
        </div>
        `;
    },

    _getLoadingSkeleton() {
        return `
        <div class="flex flex-col items-center justify-center h-[60vh] space-y-4">
            <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Analyzing Performance...</div>
        </div>`;
    },

    _renderError(container, msg) {
        container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-[60vh] space-y-4 p-8 text-center">
            <div class="text-4xl text-rose-500"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <div class="text-sm font-bold text-slate-400">${msg}</div>
            <button onclick="window.Main.navigate('home')" class="px-6 py-3 bg-slate-800 rounded-xl text-white text-xs font-bold uppercase mt-4">Return Home</button>
        </div>`;
    },

    _getSubjectConfig(id) {
        // Safe access to config
        const gs1 = CONFIG.subjectsGS1 || [];
        const csat = CONFIG.subjectsCSAT || [];
        return [...gs1, ...csat].find(s => s.id === id) || { name: 'Unknown', color: 'slate', icon: 'question' };
    },

    // ============================================================
    // 4. BEHAVIORAL ANALYSIS (The "Psych" Part)
    // ============================================================

    _initAnalysis(result) {
        const grid = document.getElementById('analysis-grid');
        if (!grid) return;

        // 1. Archetype Card (If Engine Available)
        if (BehavioralEngine && BehavioralEngine.getUserArchetype) {
            const archetype = BehavioralEngine.getUserArchetype();
            grid.innerHTML += this._renderPsychCard(
                'Archetype Detected', 
                archetype, 
                'brain', 
                'purple'
            );
        }

        // 2. Accuracy Card
        const accuracy = result.accuracy || 0;
        let accMsg = "Low Accuracy";
        let accColor = "rose";
        if (accuracy > 50) { accMsg = "Average"; accColor = "amber"; }
        if (accuracy > 80) { accMsg = "High Precision"; accColor = "emerald"; }

        grid.innerHTML += this._renderPsychCard(
            'Precision', 
            `${accuracy}% <span class="text-xs opacity-70">(${accMsg})</span>`, 
            'crosshairs', 
            accColor
        );

        // 3. Speed Analysis
        // Prevent division by zero
        const qCount = (result.correct + result.wrong + result.skipped) || 1;
        const avgTime = ((result.totalDuration || 0) / qCount).toFixed(1);
        
        let speedMsg = "Balanced";
        let speedColor = "emerald";
        if (avgTime < 10) { speedMsg = "Rushing!"; speedColor = "amber"; }
        if (avgTime > 120) { speedMsg = "Too Slow"; speedColor = "rose"; }

        grid.innerHTML += this._renderPsychCard(
            'Avg Time / Question', 
            `${avgTime}s <span class="text-xs opacity-70">(${speedMsg})</span>`, 
            'stopwatch', 
            speedColor
        );

        // 4. "Mistakes" Teaser Card
        if (result.wrong > 0) {
            grid.innerHTML += `
            <div onclick="Main.navigate('review', { id: '${result.id}' })" class="p-5 rounded-[24px] bg-slate-800 border border-white/5 flex items-center justify-between cursor-pointer active:scale-95 transition-transform group">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-file-circle-xmark"></i>
                    </div>
                    <div>
                        <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Focus Area</div>
                        <div class="text-lg font-black text-slate-200 leading-tight">Review ${result.wrong} Errors</div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-600 group-hover:text-white transition-colors"></i>
            </div>
            `;
        }
    },

    _renderPsychCard(title, value, icon, color) {
        return `
        <div class="p-5 rounded-[24px] bg-slate-800 border border-white/5 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-${color}-500/10 text-${color}-400 flex items-center justify-center text-xl shrink-0">
                <i class="fa-solid fa-${icon}"></i>
            </div>
            <div>
                <div class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">${title}</div>
                <div class="text-lg font-black text-slate-200 leading-tight">${value}</div>
            </div>
        </div>
        `;
    }
};

window.UIResults = UIResults;

