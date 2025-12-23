/**
 * MAIN.JS (PRODUCTION - SAFE MODE)
 * Version: 3.2.0
 * Status: Review Module Disabled (to prevent crash)
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';

// ✅ UI MANAGERS
import { UI } from './ui/ui-manager.js'; 

// ✅ VIEW CONTROLLERS
import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';

// 🔴 REVIEW MODULE DISABLED (Prevents White Screen)
// import { UIReview } from './ui/views/ui-review.js'; 

export const Main = {
    state: {
        currentView: 'home',
        activeSubject: null,
        isQuizActive: false,
        lastResultId: null,
        lastResult: null
    },

    async init() {
        console.log(`🚀 SYSTEM LAUNCH: v${CONFIG.version}`);

        try {
            // 1. Initialize DB & UI
            await DB.connect();
            if (window.UI) window.UI.init();

            // 2. Initialize Logic
            if (MasterAggregator) MasterAggregator.init();

            // 3. Start Router
            this._initRouter();

            // 4. Force Render Home
            // We use a small timeout to let the DOM settle
            setTimeout(() => {
                if (!window.location.hash || window.location.hash === '#review') {
                    this.navigate('home');
                } else {
                    this._handleRoute(); 
                }
                
                // Hide Boot Loader
                if (window.UI) UI.toggleLoader(false);
            }, 500);

        } catch (e) {
            console.error("CRITICAL: Boot Failed", e);
            alert("App Start Failed: " + e.message);
        }
    },

    navigate(viewName, params = null) {
        // Safety: Prevent accidental exit during quiz
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz? Progress will be lost.")) return;
            this.endQuizSession();
        }

        this.state.currentView = viewName;
        
        if (params) {
            if (params.subjectId) this.state.activeSubject = params.subjectId;
            if (params.id) this.state.lastResultId = params.id;
        }

        // Update URL
        if (viewName === 'quiz') {
            history.replaceState(null, null, `#${viewName}`);
            this._handleRoute(); 
        } else {
            window.location.hash = `#${viewName}`;
        }
    },

    _initRouter() {
        window.addEventListener('hashchange', () => this._handleRoute());
    },

    async _handleRoute() {
        const hash = window.location.hash.replace('#', '') || 'home';
        const container = document.getElementById('app-container');
        
        // Scroll to top
        window.scrollTo(0, 0);

        switch (hash.split('?')[0]) {
            case 'home':
                if (window.UIHome) await UIHome.render(container);
                break;
                
            case 'quiz':
                if (window.UIQuiz) UIQuiz.render(container);
                break;
                
            case 'results':
                if (window.UIResults) await UIResults.render(container);
                break;
            
            case 'review':
                // 🔴 SAFE FALLBACK
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-[60vh] text-slate-500">
                        <i class="fa-solid fa-screwdriver-wrench text-4xl mb-4"></i>
                        <p class="font-bold uppercase text-xs">Review Module Maintenance</p>
                        <button onclick="Main.navigate('home')" class="mt-4 px-4 py-2 bg-slate-800 rounded-lg text-white text-xs">Go Home</button>
                    </div>`;
                break;
                
            default:
                this.navigate('home');
        }
        
        // Update Bottom Dock
        if (window.UIHeader) UIHeader.updateActiveTab(hash);
    },

    // --- QUIZ ACTIONS ---

    async selectSubject(subjectId) {
        this.state.activeSubject = subjectId;
        await this.startQuizSession(subjectId);
    },

    async startQuizSession(subjectId) {
        if (window.UI) UI.toggleLoader(true);
        await Engine.startSession(subjectId); 
        this.state.isQuizActive = true;
        this.navigate('quiz');
        if (window.UI) UI.toggleLoader(false);
    },

    handleQuizCompletion(resultData) {
        this.state.lastResult = resultData;
        this.state.lastResultId = resultData.id;
        this.state.isQuizActive = false;
        this.navigate('results', { id: resultData.id });
    },

    endQuizSession() {
        if (Engine) Engine.terminateSession();
        this.state.isQuizActive = false;
        this.navigate('home');
    },

    toggleTheme() {
        document.documentElement.classList.toggle('dark');
    }
};

window.Main = Main;

document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});

