/**
 * UI-RESULTS (THE REPORT CARD)
 * Version: 2.0.0
 * Path: assets/js/ui/views/ui-results.js
 * Responsibilities:
 * 1. Fetches detailed result data from IndexedDB.
 * 2. Displays the "Big Score" and Pass/Fail status.
 * 3. Renders the Behavioral Analysis (Psych Profile update).
 * 4. Lists mistakes for review.
 */

import { DB } from '../../services/db.js';
import { CONFIG } from '../../config.js';
import { BehavioralEngine } from '../../engine/behavioral-engine.js'; // To fetch archetype

export const UIResults = {
    // ============================================================
    // 1. VIEW INITIALIZATION
    // ============================================================

    async render(container) {
        console.log("📊 UIResults: Generating Report...");
        
        // 1. Clear & Setup
        container.innerHTML = '';
        container.className = 'view-container pb-24 bg-slate-900 min-h-screen';

        // 2. Extract Result ID from URL or Global State
        // Main.js should pass params, but we can also grab hash params if needed
        const resultId = this._getResultId();

        if (!resultId) {
            this._renderError(container, "Result ID not found.");
            return;
        }

        // 3. Show Loading Skeleton
        container.innerHTML = this._getLoadingSkeleton();

        try {
            // 4. Fetch Data from DB
            const result = await DB.get('history', resultId);
            
            if (!result) throw new Error("Result data missing from database.");

            // 5. Render Full View
            this._renderContent(container, result);

        } catch (e) {
            console.error("UIResults: Fetch Error", e);
            this._renderError(container, "Could not load result. It may have been deleted.");
        }
    },

    /**
     * Helper to parse ID from various sources
     */
    _getResultId() {
        // Option A: Passed via Main.navigate state (if strictly SPA)
        if (window.Main && Main.state && Main.state.lastResultId) {
            return Main.state.lastResultId;
        }
        
        // Option B: Passed in the URL hash (e.g. #results?id=123)
        // Simple manual parsing since we aren't using a heavy router lib
        const hash = window.location.hash;
        if (hash.includes('?id=')) {
            return hash.split('?id=')[1];
        }

        // Option C: Fallback to active state
        return null; // Logic in render will handle error
    },

    // ============================================================
    // 2. MAIN CONTENT RENDERER
    // ============================================================

    _renderContent(container, result) {
        // Determine Theme based on Subject
        const subjectConfig = this._getSubjectConfig(result.subject);
        const color = subjectConfig.color;

        // A. Render Header (Score Card)
        const headerHTML = this._getScoreCardTemplate(result, subjectConfig);
        
        // B. Render Body (Analysis Grid)
        // (This will be populated in Part 2)
        const bodyHTML = `<div id="analysis-grid" class="p-4 space-y-6 animate-slide-up"></div>`;

        // C. Render Footer (Action Buttons)
        const footerHTML = this._getFooterTemplate();

        // Inject
        container.innerHTML = `
            ${headerHTML}
            ${bodyHTML}
            ${footerHTML}
        `;

        // D. Trigger Post-Render Scripts (Charts, etc.)
        // We defer this to Part 2
        this._initAnalysis(result);
    },

    // ============================================================
    // 3. TEMPLATES: SCORE CARD
    // ============================================================

    _getScoreCardTemplate(result, config) {
        const percentage = (result.score / result.totalMarks) * 100;
        let grade = "Keep Pushing";
        let gradeColor = "text-slate-400";
        
        if (percentage > 55) { grade = "Good Job!"; gradeColor = "text-emerald-400"; }
        if (percentage > 70) { grade = "Excellent!"; gradeColor = "text-amber-400"; }
        if (percentage < 30) { grade = "Needs Work"; gradeColor = "text-rose-400"; }

        // Formatting Duration
        const mins = Math.floor(result.totalDuration / 60);
        const secs = result.totalDuration % 60;

        return `
        <div class="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between">
            <button onclick="Main.navigate('home')" class="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center active:scale-95">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
            <h2 class="text-xs font-black text-slate-300 uppercase tracking-widest">Analysis Report</h2>
            <div class="w-8"></div> </div>

        <div class="relative m-4 p-6 rounded-[32px] overflow-hidden bg-slate-800 border border-white/5 shadow-2xl">
            <div class="absolute top-0 right-0 w-32 h-32 bg-${config.color}-500/20 rounded-full blur-3xl -mr-10 -mt-10"></div>
            <div class="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -ml-10 -mb-10"></div>

            <div class="relative z-10 flex flex-col items-center text-center">
                
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/50 border border-white/10 mb-4">
                    <i class="fa-solid fa-${config.icon} text-${config.color}-400 text-xs"></i>
                    <span class="text-[10px] font-bold text-slate-300 uppercase tracking-wider">${config.name}</span>
                </div>

                <div class="mb-2">
                    <span class="text-6xl font-black text-white tracking-tighter shadow-black drop-shadow-lg">
                        ${result.score.toFixed(0)}
                    </span>
                    <span class="text-xl font-bold text-slate-500">/ ${result.totalMarks}</span>
                </div>

                <div class="text-sm font-bold ${gradeColor} uppercase tracking-widest mb-6 border-b border-white/5 pb-6 w-full">
                    ${grade}
                </div>

                <div class="flex justify-between w-full px-2">
                    <div class="flex flex-col items-center">
                        <span class="text-xl font-black text-emerald-400">${result.correct}</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase">Correct</span>
                    </div>
                    <div class="w-px h-8 bg-white/10"></div>
                    <div class="flex flex-col items-center">
                        <span class="text-xl font-black text-rose-400">${result.wrong}</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase">Wrong</span>
                    </div>
                    <div class="w-px h-8 bg-white/10"></div>
                    <div class="flex flex-col items-center">
                        <span class="text-xl font-black text-slate-400">${result.skipped}</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase">Skipped</span>
                    </div>
                    <div class="w-px h-8 bg-white/10"></div>
                    <div class="flex flex-col items-center">
                        <span class="text-xl font-black text-blue-400">${mins}m</span>
                        <span class="text-[9px] font-bold text-slate-500 uppercase">Time</span>
                    </div>
                </div>
            </div>
        </div>
        `;
    },

    /**
     * Helper: Loading State
     */
    _getLoadingSkeleton() {
        return `
        <div class="h-screen flex flex-col items-center justify-center p-8 space-y-4">
            <div class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <div class="text-xs font-bold text-slate-500 uppercase animate-pulse">Calculating Score...</div>
        </div>`;
    },

    /**
     * Helper: Error State
     */
    _renderError(container, msg) {
        container.innerHTML = `
        <div class="h-screen flex flex-col items-center justify-center p-8 text-center">
            <i class="fa-solid fa-triangle-exclamation text-4xl text-rose-500 mb-4"></i>
            <h2 class="text-white font-bold mb-2">Error</h2>
            <p class="text-slate-400 text-sm mb-6">${msg}</p>
            <button onclick="Main.navigate('home')" class="px-6 py-2 bg-slate-800 rounded-lg text-white text-sm font-bold">Go Home</button>
        </div>`;
    },

    _getSubjectConfig(id) {
        // Simple lookup from Config (Assuming CONFIG is globally imported)
        const all = [...CONFIG.subjectsGS1, ...CONFIG.subjectsCSAT];
        return all.find(s => s.id === id) || { name: 'Unknown', color: 'slate', icon: 'question' };
    },
      // ============================================================
    // 4. FOOTER TEMPLATE
    // ============================================================

    _getFooterTemplate() {
        return `
        <div class="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl border-t border-white/5 p-4 z-30 flex gap-3 safe-area-pb">
            <button onclick="Main.navigate('home')" class="flex-1 py-4 rounded-xl bg-slate-800 text-slate-300 font-bold uppercase tracking-widest text-xs active:scale-95 transition-transform">
                Go Home
            </button>
            <button onclick="Main.selectSubject(Engine.state.subjectId || 'polity')" class="flex-1 py-4 rounded-xl bg-blue-600 text-white font-bold uppercase tracking-widest text-xs shadow-lg shadow-blue-600/20 active:scale-95 transition-transform">
                Retry Mock
            </button>
        </div>
        `;
    },

    // ============================================================
    // 5. ANALYSIS LOGIC (THE PSYCH BREAKDOWN)
    // ============================================================

    /**
     * Populates the #analysis-grid with cards based on telemetry.
     */
    _initAnalysis(result) {
        const grid = document.getElementById('analysis-grid');
        if (!grid) return;

        // 1. Fetch current Profile Archetype (e.g. "The Maverick")
        // We assume BehavioralEngine is loaded
        const archetype = BehavioralEngine.getUserArchetype ? BehavioralEngine.getUserArchetype() : "The Aspirant";
        
        // 2. Render Archetype Card
        grid.innerHTML += this._renderPsychCard(
            'Archetype Detected', 
            archetype, 
            'brain', 
            'purple'
        );

        // 3. Analyze Telemetry for Insights
        const t = result.telemetry || {};
        
        // Insight A: Speed / Time Management
        const avgTime = (result.totalDuration / result.questionIds.length).toFixed(1);
        let speedMsg = "Balanced Pace";
        let speedColor = "emerald";
        if (avgTime < 15) { speedMsg = "Rushing (Too Fast)"; speedColor = "amber"; }
        if (avgTime > 90) { speedMsg = "Lagging (Too Slow)"; speedColor = "rose"; }
        
        grid.innerHTML += this._renderPsychCard(
            'Avg Time / Q', 
            `${avgTime}s <span class="text-xs opacity-70">(${speedMsg})</span>`, 
            'stopwatch', 
            speedColor
        );

        // Insight B: Focus / Impulse Control
        // If > 20% of clicks were "Impulse" (<1.5s)
        const impulseRate = ((t.impulseClicks || 0) / result.questionIds.length) * 100;
        if (impulseRate > 15) {
            grid.innerHTML += this._renderPsychCard(
                'Focus Alert', 
                `${impulseRate.toFixed(0)}% Impulsive Clicks`, 
                'bolt', 
                'rose'
            );
        }

        // Insight C: Second Guessing (Switches)
        const switchCount = Object.values(t.switches || {}).reduce((a, b) => a + b, 0);
        if (switchCount > 2) {
            grid.innerHTML += this._renderPsychCard(
                'Doubt Factor', 
                `Changed Answer ${switchCount} Times`, 
                'shuffle', 
                'amber'
            );
        }

        // 4. Mistakes Review Button
        if (result.wrong > 0) {
            grid.innerHTML += `
            <button onclick="UIResults.reviewMistakes('${result.id}')" class="w-full p-4 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-between group active:scale-95 transition-all">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div class="text-left">
                        <div class="text-sm font-bold text-slate-200 group-hover:text-white">Review Mistakes</div>
                        <div class="text-[10px] text-slate-500 font-bold uppercase">See what went wrong</div>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-500 group-hover:text-white"></i>
            </button>
            `;
        }
    },

    /**
     * Helper to build a "Psych Card" HTML string
     */
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
    },

    // ============================================================
    // 6. ACTIONS
    // ============================================================

    /**
     * Opens a modal or navigates to a review screen.
     * For MVP, we'll just show an alert or simple list, 
     * but this connects to the 'mistakes' store in DB.js.
     */
    async reviewMistakes(resultId) {
        alert("Detailed Review Mode coming in Phase 2!\nCheck the 'Mistakes' tab later.");
        // Future Logic:
        // 1. Main.navigate('review', { id: resultId })
        // 2. Fetch from DB.mistakes where resultId matches
    }
};

// Global Export
window.UIResults = UIResults;


