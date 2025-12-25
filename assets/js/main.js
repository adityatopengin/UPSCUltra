/**
 * MAIN.JS (FINAL PRODUCTION ROUTER)
 * Version: 3.8.0 (Patched: History API for Hardware Back Button)
 * Path: assets/js/main.js
 * Responsibilities:
 * 1. Application Entry Point (Boot Sequence).
 * 2. Global Router (Navigate, GoBack, History).
 * 3. State Orchestrator (Tying Engine, UI, and DB together).
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';
import { AcademicEngine } from './engine/academic-engine.js'; 
import { UI } from './ui/ui-manager.js'; 
// 🛡️ FIX: Explicit Import to guarantee Seeder availability
import { DataSeeder } from './services/data-seeder.js';

// ✅ IMPORT THE HEADER (Critical Component)
import { UIHeader } from './ui/components/ui-header.js';

// ✅ CORE VIEWS (Loaded Immediately for Critical Path)
import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';
import { UIReview } from './ui/views/ui-review.js'; 

// ⏳ OPTIONAL VIEWS (Lazy Loaded to save bundle size)
let UISettings, UIStats, UIArcade;

export const Main = {
    // ============================================================
    // 1. GLOBAL STATE
    // ============================================================
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false,
        lastResultId: null,
        lastResult: null,
        // 🛡️ FIX: Navigation History Stack
        history: [], 
        params: {}
    },

    // ============================================================
    // 2. INITIALIZATION (BOOT SEQUENCE)
    // ============================================================
    async init() {
        console.log(`🚀 SYSTEM LAUNCH: v${CONFIG.version}`);

        try {
            // 1. Connect Database
            await DB.connect();
            
            // 2. Initialize UI Manager (Loader, Toasts)
            await UI.init();
            
            // 3. Initialize Logic Engines
            // 🛡️ FIX: Ensure Academic logic (Decay/Blindspots) runs on boot
            await AcademicEngine.init(); 

            // 4. Initialize Oracle (Background Worker)
            if (MasterAggregator) MasterAggregator.init();

            // 5. Initialize Data Seeder
            // 🛡️ FIX: Explicit call to ensure questions are loaded before UI starts
            await DataSeeder.init();

            // 6. Check for Deep Links (URL Hash)
            this._handleDeepLink();

            // 7. Initialize Hardware Back Button Support
            this._initHistoryListener();

        } catch (e) {
            console.error("❌ CRITICAL BOOT FAILURE:", e);
            alert("System Error: " + e.message);
        } finally {
            // 8. Remove Boot Loader
            UI.toggleLoader(false);
        }
    },

    // 🛡️ FIX: Hardware Back Button Logic
    _initHistoryListener() {
        // Set initial state
        window.history.replaceState({ view: 'home' }, '', '#home');

        // Listen for the physical back button
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view) {
                // Determine if we should allow going back (Anti-Cheat check happens in navigate)
                // We pass 'true' to skip pushing a new history entry (since we are already moving in history)
                this.navigate(event.state.view, event.state.params || {}, true);
            } else {
                // Fallback to home if history is lost
                this.navigate('home', {}, true);
            }
        });
    },

    _handleDeepLink() {
        const hash = window.location.hash;
        
        // 🛡️ FIX: Robust URL Parsing using URLSearchParams [Fix #1]
        if (hash.includes('?')) {
            const queryString = hash.split('?')[1];
            const urlParams = new URLSearchParams(queryString);
            const id = urlParams.get('id');

            if (hash.includes('results') && id) {
                this.navigate('results', { id });
                return;
            }
        }
        
        // Default Route
        this.navigate('home');
    },

    // ============================================================
    // 3. THE ROUTER (NAVIGATION ENGINE)
    // ============================================================

    /**
     * Primary method to switch screens.
     * @param {string} viewName - 'home', 'quiz', 'results', etc.
     * @param {object} params - Data to pass to the view (e.g. subjectId)
     * @param {boolean} isFromHistory - If true, prevents pushing duplicate history states
     */
    async navigate(viewName, params = {}, isFromHistory = false) {
        console.log(`🧭 Router: Navigating to [${viewName}]`, params);

        const container = document.getElementById('app-container');
        if (!container) return;

        // 🛡️ FIX: Prevent navigation if Quiz is locked (Anti-Cheat)
        if (this.state.isQuizActive && viewName !== 'quiz' && viewName !== 'results') {
            if (!confirm("⚠️ Quit Exam?\n\nYour progress will be lost.")) {
                // If user cancels leaving, we must fix the URL if they used Back Button
                if (isFromHistory) {
                    window.history.pushState({ view: 'quiz' }, '', '#quiz');
                }
                // Restore active tab to quiz
                if (window.UIHeader) UIHeader.updateActiveTab('quiz');
                return;
            }
            this.endQuizSession();
        }

        // 🛡️ FIX: Sync Browser History (Prevents App Exit on Back Button)
        if (!isFromHistory) {
            window.history.pushState({ view: viewName, params }, '', `#${viewName}`);
        }

        // 🛡️ FIX: Push to Internal History Stack (unless going Home which clears stack)
        if (viewName === 'home') {
            this.state.history = []; // Root reset
        } else if (this.state.currentView !== viewName) {
            this.state.history.push({
                view: this.state.currentView,
                params: { ...this.state.params }
            });
        }

        // Update State
        this.state.currentView = viewName;
        this.state.params = params;

        // 🛡️ FIX: Optimized Transition Timing [Fix #2]
        // 1. Visual Exit
        container.classList.add('opacity-0', 'translate-y-4');
        
        // 2. Wait for animation to finish (Promise wrapper)
        await new Promise(resolve => setTimeout(resolve, 200));

        // 3. Render New View
        window.scrollTo(0, 0);
        await this._renderView(viewName, container, params);
        
        // 4. Update Dock
        if (window.UIHeader) UIHeader.updateActiveTab(viewName);

        // 5. Visual Enter (Next Frame to ensure DOM paint)
        requestAnimationFrame(() => {
            container.classList.remove('opacity-0', 'translate-y-4');
        });
    },

    /**
     * The "Back" Button Handler
     * Restores previous state from history stack.
     */
    goBack() {
        // If we have history, pop it. 
        // Note: We use history.back() to trigger the popstate listener we defined above.
        // This ensures the Hardware button and UI button behave identically.
        if (window.history.length > 1) {
            window.history.back();
        } else {
            this.navigate('home');
        }
    },

    // ============================================================
    // 4. VIEW RENDERER (THE SWITCHBOARD)
    // ============================================================

    async _renderView(viewName, container, params) {
        switch (viewName) {
            case 'home':
                await UIHome.render(container);
                break;

            case 'quiz':
                await UIQuiz.render(container);
                break;

            case 'results':
                await UIResults.render(container);
                break;

            case 'review':
                await UIReview.render(container);
                break;

            // ⏳ LAZY LOADED VIEWS
            case 'stats':
                if (!UIStats) UIStats = (await import('./ui/views/ui-stats.js')).UIStats;
                await UIStats.render(container);
                break;

            case 'settings':
                if (!UISettings) UISettings = (await import('./ui/views/ui-settings.js')).UISettings;
                await UISettings.render(container);
                break;

            case 'arcade':
                if (!UIArcade) UIArcade = (await import('./ui/views/ui-arcade.js')).UIArcade;
                await UIArcade.render(container);
                break;

            default:
                console.warn(`Router: Unknown view [${viewName}]`);
                this.navigate('home');
        }
    },

    // ============================================================
    // 5. DOMAIN ACTIONS (QUIZ CONTROL)
    // ============================================================

    async selectSubject(subjectId) {
        this.state.activeSubject = subjectId;
        await this.startQuizSession(subjectId);
    },

    // 🛡️ FIX: Added Mock Selection Modal Logic
    handleMockSelection(mockId) {
        // 1. Config
        const isGS = mockId === 'mock_gs1';
        const half = isGS ? 50 : 40;
        const full = isGS ? 100 : 80;
        const title = isGS ? 'GS PRELIMS MOCK' : 'CSAT MOCK';

        // 2. Create Modal DOM
        const div = document.createElement('div');
        div.id = 'mock-modal';
        div.className = 'fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in p-4';
        
        div.innerHTML = `
            <div class="premium-card p-6 w-full max-w-sm rounded-[32px] relative overflow-hidden animate-slide-up">
                <div class="text-center mb-6">
                    <h3 class="text-lg font-black premium-text-head uppercase">${title}</h3>
                    <p class="text-[10px] font-bold opacity-50 uppercase tracking-widest">Select Protocol</p>
                </div>
                
                <div class="space-y-3">
                    <button id="btn-half" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-between group active:scale-95 transition-all">
                        <div class="text-left">
                            <div class="text-xs font-black text-blue-400 uppercase tracking-wider">Sprint Mode</div>
                            <div class="text-[10px] font-bold opacity-50 uppercase">${half} Questions</div>
                        </div>
                        <i class="fa-solid fa-bolt text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity"></i>
                    </button>
                    
                    <button id="btn-full" class="w-full p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-between group active:scale-95 transition-all">
                        <div class="text-left">
                            <div class="text-xs font-black text-purple-400 uppercase tracking-wider">Marathon Mode</div>
                            <div class="text-[10px] font-bold opacity-50 uppercase">${full} Questions</div>
                        </div>
                        <i class="fa-solid fa-flag-checkered text-purple-400 opacity-50 group-hover:opacity-100 transition-opacity"></i>
                    </button>
                </div>
                
                <button id="btn-cancel" class="mt-6 w-full py-3 text-[10px] font-bold uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity">Cancel</button>
            </div>
        `;

        document.body.appendChild(div);

        // 3. Bind Events
        const close = () => div.remove();
        
        document.getElementById('btn-half').onclick = () => {
            close();
            this.startQuizSession(mockId, { limit: half });
        };

        document.getElementById('btn-full').onclick = () => {
            close();
            this.startQuizSession(mockId, { limit: full });
        };

        document.getElementById('btn-cancel').onclick = close;
    },

    // 🛡️ FIX: Updated to accept options (limit)
    async startQuizSession(subjectId, options = {}) {
        if (window.UI) UI.toggleLoader(true);
        try {
            await Engine.startSession(subjectId, options); 
            this.state.isQuizActive = true;
            this.navigate('quiz');
        } catch(e) {
            console.error("Quiz Start Failed", e);
            if (window.UI) UI.showToast("Could not start quiz. Database empty?", 'error');
        } finally {
            if (window.UI) UI.toggleLoader(false);
        }
    },

    async handleQuizCompletion(resultData) {
        this.state.lastResult = resultData;
        this.state.lastResultId = resultData.id;
        this.state.isQuizActive = false;
        
        // Replace history so "Back" doesn't go to Quiz
        this.state.history = [{ view: 'home', params: {} }]; 
        
        // 🛡️ FIX: Handshake with Academic Engine to update stats immediately
        if (AcademicEngine) {
            try {
                // We pass the raw questions so WMI can be calculated
                await AcademicEngine.processTestResult(resultData, resultData.questions);
            } catch (e) {
                console.warn("Main: Stats update failed", e);
            }
        }

        this.navigate('results', { id: resultData.id });
    },

    endQuizSession() {
        if (Engine) Engine.terminateSession();
        this.state.isQuizActive = false;
        this.navigate('home');
    },

    showResult(id) {
        this.navigate('results', { id: id });
    },

    toggleTheme() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }
};

// Global Exposure for Inline HTML Events
window.Main = Main;

// Boot Trigger
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

