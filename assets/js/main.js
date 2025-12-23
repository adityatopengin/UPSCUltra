/**
 * MAIN.JS (SAFE MODE)
 * Purpose: Isolate the broken file.
 */

import { DB } from './services/db.js';
import { CONFIG } from './config.js';
import { MasterAggregator } from './services/master-aggregator.js';
import { Engine } from './engine/quiz-engine.js';
import { UI } from './ui/ui-manager.js'; 

import { UIHome } from './ui/views/ui-home.js';
import { UIQuiz } from './ui/views/ui-quiz.js';
import { UIResults } from './ui/views/ui-results.js';

// 🔴 DISABLED THE SUSPECT FILE
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
        console.log(`🚀 SAFE MODE: System Launching...`);

        try {
            await DB.connect();
            console.log("✅ DB Connected");

            if (window.UI) window.UI.init();
            console.log("✅ UI Initialized");

            if (MasterAggregator) MasterAggregator.init();

            // Force Router
            this._initRouter();
            
            setTimeout(() => {
                this.navigate('home');
                const loader = document.getElementById('boot-loader');
                if (loader) loader.style.display = 'none';
                console.log("✅ BOOT COMPLETE");
            }, 500);

        } catch (e) {
            console.error("CRITICAL BOOT ERROR:", e);
            alert("Boot Failed: " + e.message);
        }
    },

    navigate(viewName, params = null) {
        if (this.state.isQuizActive && viewName !== 'quiz') {
            if (!confirm("⚠️ End Quiz?")) return;
            this.endQuizSession();
        }

        this.state.currentView = viewName;
        if (params) {
            if (params.id) this.state.lastResultId = params.id;
        }

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
        window.scrollTo(0, 0);

        console.log("Navigating to:", hash);

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
            // 🔴 DISABLED ROUTE
            case 'review':
                container.innerHTML = "<h2 class='p-10 text-center'>Review Module Disabled in Safe Mode</h2>";
                // if (window.UIReview) await UIReview.render(container);
                break;
            default:
                this.navigate('home');
        }
        
        if (window.UIHeader) UIHeader.updateActiveTab(hash);
    },

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
document.addEventListener('DOMContentLoaded', () => Main.init());

