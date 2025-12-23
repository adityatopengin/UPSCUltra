/**
 * UI-HOME (THE DASHBOARD)
 * Version: 3.0.0 (Nebula OS Final)
 * Path: assets/js/ui/views/ui-home.js
 * Responsibilities:
 * 1. Renders the Oracle HUD (AI Prediction).
 * 2. Renders the "Resume Learning" card.
 * 3. Renders the Subject Grids with "Pillow" design.
 * 4. Handles the GS1/CSAT Toggle Switch.
 */

import { MasterAggregator } from '../../services/master-aggregator.js';
import { DB } from '../../services/db.js';
import { CONFIG } from '../../config.js';

export const UIHome = {
    // ============================================================
    // 1. VIEW CONTROLLER (ENTRY POINT)
    // ============================================================

    async render(container) {
        // A. Clear Container & Set Layout
        container.innerHTML = '';
        // Increased padding to ensure scrolling clears the "Floor Fog"
        container.className = 'view-container pb-40 px-4'; 

        // B. Update Header State
        if (window.UI && window.UIHeader) {
            window.UIHeader.toggle(true);
            window.UIHeader.updateActiveTab('home');
        }

        // C. Render The Oracle HUD
        const oracleSection = document.createElement('div');
        oracleSection.className = 'oracle-container premium-card mb-6 p-6 relative overflow-hidden rounded-[32px] min-h-[220px] animate-fade-in';
        // Add the Oracle Mist effect (CSS class)
        const mist = document.createElement('div');
        mist.className = 'oracle-mist';
        oracleSection.appendChild(mist);
        
        const content = document.createElement('div');
        content.className = 'relative z-10';
        content.innerHTML = this._getOracleSkeleton();
        oracleSection.appendChild(content);
        
        container.appendChild(oracleSection);

        // D. Trigger Prediction Engine (Async)
        this._initOracle(oracleSection);

        // E. Render "Resume Learning" Card
        await this._renderResumeCard(container);

        // F. Render The Toggle Switch (GS1 / CSAT)
        this._renderToggleSwitch(container);

        // G. Render The Grids (Both, but one hidden)
        await this._renderSubjectGrids(container);
    },

    // ============================================================
    // 2. ORACLE INTEGRATION
    // ============================================================

    _getOracleSkeleton() {
        return `
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h2 class="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]">Oracle Prediction</h2>
                    <h3 id="prob-text" class="premium-text-head text-lg font-black mt-1 animate-pulse">ANALYZING DATA...</h3>
                </div>
                <div class="w-10 h-10 rounded-2xl premium-panel flex items-center justify-center shadow-lg">
                    <i class="fa-solid fa-brain text-sm text-indigo-400"></i>
                </div>
            </div>

            <div class="absolute inset-0 top-16 z-0 opacity-50">
                <canvas id="cloudChart"></canvas>
            </div>

            <div class="relative z-10 mt-8 flex justify-between items-end">
                <div>
                    <div class="text-[9px] font-bold opacity-50 uppercase mb-1">Projected Score</div>
                    <div class="flex items-baseline gap-2">
                        <span id="main-score" class="text-5xl font-black tracking-tighter premium-text-head">--</span>
                        <span class="text-xs opacity-50 font-bold">/ 200</span>
                    </div>
                </div>
                
                <div class="text-right space-y-1">
                    <div class="flex items-center justify-end gap-2 text-[9px] opacity-40 font-bold">
                        <span>MIN</span> <span id="min-score" class="opacity-80">--</span>
                    </div>
                    <div class="flex items-center justify-end gap-2 text-[9px] opacity-40 font-bold">
                        <span>MAX</span> <span id="max-score" class="opacity-80">--</span>
                    </div>
                </div>
            </div>

            <div id="warning-container" class="relative z-10 mt-6 flex gap-2 overflow-x-auto no-scrollbar">
                </div>
        `;
    }, 

    async _initOracle(containerElement) {
        if (window.UIOracle) {
            window.UIOracle.init(); 
        }

        try {
            if (MasterAggregator) {
                const prediction = await MasterAggregator.getPrediction();
                if (window.UIOracle && prediction) {
                    window.UIOracle.render(prediction);
                }
            }
        } catch (e) {
            console.error("UIHome: Oracle failed to load.", e);
            const probText = document.getElementById('prob-text');
            if (probText) {
                probText.innerText = "SYSTEM OFFLINE";
                probText.classList.remove('animate-pulse');
                probText.style.color = 'var(--danger)';
            }
        }
    }, 

    // ============================================================
    // 3. RESUME CARD
    // ============================================================

    async _renderResumeCard(container) {
        try {
            const allHistory = await DB.getAll('history');
            
            if (!allHistory || allHistory.length === 0) return;

            const lastResult = allHistory.sort((a, b) => b.timestamp - a.timestamp)[0];
            
            if (!lastResult) return;

            const subjectId = lastResult.subject || 'unknown';
            
            // Find config
            let subjectConfig = CONFIG.subjectsGS1.find(s => s.id === subjectId) || 
                                CONFIG.subjectsCSAT.find(s => s.id === subjectId);
                                
            if (!subjectConfig) {
                subjectConfig = { name: subjectId.toUpperCase(), color: 'slate', icon: 'book' };
            }

            // Get Flavor
            const flavorClass = this._getFlavor(subjectConfig.color);

            const card = document.createElement('div');
            // Premium Card Style with Flavor
            card.className = `premium-card ${flavorClass} p-5 rounded-[28px] mb-8 flex items-center justify-between cursor-pointer active:scale-95 transition-transform animate-slide-up select-none`;
            
            card.onclick = () => {
                if(window.Main) Main.showResult(lastResult.id);
            };

            card.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="icon-pillow w-12 h-12 text-xl rounded-2xl">
                        <i class="fa-solid fa-${subjectConfig.icon}"></i>
                    </div>
                    
                    <div>
                        <h3 class="text-xs font-black premium-text-head">RESUME LEARNING</h3>
                        <p class="text-[10px] font-bold opacity-60 uppercase tracking-wide mt-0.5">
                            ${subjectConfig.name} &bull; ${lastResult.score.toFixed(0)} Marks
                        </p>
                    </div>
                </div>

                <div class="w-8 h-8 rounded-full premium-panel flex items-center justify-center opacity-50">
                    <i class="fa-solid fa-chevron-right text-xs"></i>
                </div>
            `;
            
            container.appendChild(card);

        } catch (e) {
            console.warn("UIHome: Failed to render resume card", e);
        }
    }, 

    // ============================================================
    // 4. TOGGLE SWITCH & GRIDS
    // ============================================================

    _renderToggleSwitch(container) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex justify-center mb-6";
        
        wrapper.innerHTML = `
            <div class="premium-panel p-1 rounded-full flex relative w-64 h-12">
                <div id="toggle-pill" class="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-700 shadow-sm rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"></div>
                
                <button id="btn-gs1" class="flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 text-blue-600 dark:text-white">
                    GS Paper I
                </button>
                
                <button id="btn-csat" class="flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 opacity-50 hover:opacity-100">
                    CSAT
                </button>
            </div>
        `;
        
        container.appendChild(wrapper);

        // Bind Logic
        setTimeout(() => {
            const btnGS = document.getElementById('btn-gs1');
            const btnCSAT = document.getElementById('btn-csat');
            const pill = document.getElementById('toggle-pill');
            const gridGS = document.getElementById('grid-gs1');
            const gridCSAT = document.getElementById('grid-csat');

            btnGS.onclick = () => {
                // Move Pill Left
                pill.style.transform = 'translateX(0)';
                // Text Styling
                btnGS.style.opacity = '1';
                btnGS.classList.add('text-blue-600');
                btnCSAT.style.opacity = '0.5';
                btnCSAT.classList.remove('text-blue-600');
                // View Switch
                gridGS.classList.remove('hidden');
                gridGS.classList.add('animate-slide-up');
                gridCSAT.classList.add('hidden');
            };

            btnCSAT.onclick = () => {
                // Move Pill Right
                pill.style.transform = 'translateX(100%)'; // Moves full width of pill
                // Text Styling
                btnCSAT.style.opacity = '1';
                btnCSAT.classList.add('text-blue-600');
                btnGS.style.opacity = '0.5';
                btnGS.classList.remove('text-blue-600');
                // View Switch
                gridCSAT.classList.remove('hidden');
                gridCSAT.classList.add('animate-slide-up');
                gridGS.classList.add('hidden');
            };
        }, 0);
    },

    async _renderSubjectGrids(container) {
        // --- GRID 1: GS Paper I ---
        const gridGS = document.createElement('div');
        gridGS.id = 'grid-gs1';
        gridGS.className = "grid grid-cols-2 gap-4 pb-20"; // Premium Gap
        
        if (CONFIG.subjectsGS1) {
            CONFIG.subjectsGS1.forEach((sub, index) => {
                const tile = this._createSubjectTile(sub, index);
                gridGS.appendChild(tile);
            });
        }
        container.appendChild(gridGS);

        // --- GRID 2: CSAT (Hidden by default) ---
        const gridCSAT = document.createElement('div');
        gridCSAT.id = 'grid-csat';
        gridCSAT.className = "hidden grid grid-cols-2 gap-4 pb-20"; 
        
        if (CONFIG.subjectsCSAT) {
            CONFIG.subjectsCSAT.forEach((sub, index) => {
                const tile = this._createSubjectTile(sub, index); 
                gridCSAT.appendChild(tile);
            });
        }
        container.appendChild(gridCSAT);
    },

    // ============================================================
    // 5. HELPER: PILLOW TILE GENERATOR
    // ============================================================

    _createSubjectTile(sub, index) {
        const div = document.createElement('div');
        const delay = index * 50; 
        
        // 1. Get Premium Flavor
        const flavorClass = this._getFlavor(sub.color);

        // 2. Build Card
        div.className = `premium-card ${flavorClass} p-4 rounded-[28px] flex flex-col items-center justify-center h-44 active:scale-95 transition-transform animate-view-enter relative group`;
        div.style.animationDelay = `${delay}ms`;
        
        div.onclick = () => {
            if (window.Main && window.Main.selectSubject) {
                window.Main.selectSubject(sub.id); 
            } else {
                console.warn("Main controller not found");
            }
        };

        div.innerHTML = `
            <div class="icon-pillow mb-3 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm">
                <i class="fa-solid fa-${sub.icon}"></i>
            </div>
            
            <div class="z-10 text-center">
                <h3 class="text-xs font-black premium-text-head uppercase tracking-wider leading-tight">${sub.name}</h3>
                <p class="text-[9px] font-bold opacity-40 uppercase mt-1">Start Mock</p>
            </div>

            <div class="absolute -right-4 -top-4 w-16 h-16 bg-[var(--accent)] opacity-10 rounded-full blur-xl group-hover:opacity-20 transition-opacity"></div>
        `;
        
        return div;
    },

    // Helper to map config colors to Premium Flavors
    _getFlavor(originalColor) {
        const map = {
            'yellow': 'flavor-gold',
            'orange': 'flavor-gold',
            'amber': 'flavor-gold',
            'blue': 'flavor-blue',
            'indigo': 'flavor-blue',
            'sky': 'flavor-blue',
            'red': 'flavor-pink',
            'rose': 'flavor-pink',
            'pink': 'flavor-pink',
            'green': 'flavor-green',
            'emerald': 'flavor-green',
            'teal': 'flavor-cyan',
            'cyan': 'flavor-cyan',
            'purple': 'flavor-purple',
            'violet': 'flavor-purple'
        };
        return map[originalColor] || 'flavor-blue';
    }
};

window.UIHome = UIHome;

