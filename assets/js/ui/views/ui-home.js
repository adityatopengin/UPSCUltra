/**
 * UI-HOME (THE DASHBOARD)
 * Version: 3.4.1 (Patched: Oracle Import Fix & Memory Leak Protection)
 * Path: assets/js/ui/views/ui-home.js
 * Responsibilities:
 * 1. Renders the Oracle HUD (AI Prediction).
 * 2. Renders the "Resume Learning" card.
 * 3. Renders the Grand Mock Cards & Subject Grids.
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
        container.className = 'view-container pb-40 px-4 bg-slate-50 dark:bg-slate-900 transition-colors duration-300'; 

        // B. Update Header State (Safety Check)
        if (window.UI && window.UIHeader) {
            window.UIHeader.toggle(true);
            window.UIHeader.updateActiveTab('home');
        }

        // 🛡️ CRASH PROOFING: Create Layout Slots
        // This ensures UI structure exists immediately, preventing layout shifts
        const slots = {
            oracle: document.createElement('div'),
            resume: document.createElement('div'),
            toggle: document.createElement('div'),
            grids: document.createElement('div')
        };

        // Append slots in specific visual order
        container.append(slots.oracle, slots.resume, slots.toggle, slots.grids);

        // C. Render Components into Slots (Independent Execution)
        this._renderOracleSection(slots.oracle);
        this._renderResumeCard(slots.resume); // Async, won't block grids
        this._renderToggleSwitch(slots.toggle);
        this._renderSubjectGrids(slots.grids);
    },

    // ============================================================
    // 2. ORACLE INTEGRATION
    // ============================================================

    _renderOracleSection(slot) {
        // Create a wrapper for margins/layout
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-6 animate-fade-in min-h-[220px]';
        slot.appendChild(wrapper);

        // Trigger Component Load (Delegating view logic to ui-oracle.js)
        this._initOracle(wrapper);
    },

    async _initOracle(container) {
        let Component = window.UIOracle;

        // 1. Try to load if missing
        if (!Component) {
            try {
                // 🛡️ FIX: Capture the exported module directly
                // Standard imports do not automatically attach to 'window'
                const module = await import('../components/ui-oracle.js');
                Component = module.UIOracle;
                
                // Attach to window for future use (standardizing access)
                window.UIOracle = Component;
            } catch (e) {
                console.warn("UIHome: Oracle component missing.", e);
                container.innerHTML = `<div class="p-4 text-center text-rose-500 text-xs font-bold">Oracle Offline</div>`;
                return;
            }
        }

        // 2. Initialize & Render
        if (Component) {
            // 🛡️ FIX: Prevent "Event Listener Explosion" (Memory Leak)
            // Only init if we haven't done it before to prevent duplicate listeners on navigation
            if (!Component.state || !Component.state.isInitialized) {
                Component.init();
                // Mark as initialized
                if (!Component.state) Component.state = {}; 
                Component.state.isInitialized = true;
            }

            // 3. Render into the container
            // We pass the container, and the component fetches its own data via MasterAggregator
            Component.render(container); 
        }
    }, 

    // ============================================================
    // 3. RESUME CARD
    // ============================================================

    async _renderResumeCard(slot) {
        try {
            // 🛡️ SAFETY: Graceful fail if DB is locked
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

            const color = subjectConfig.color || 'blue';

            const card = document.createElement('div');
            // Dual Theme Style: White Card (Light) vs Glass (Dark)
            card.className = `premium-card p-5 rounded-[28px] mb-8 flex items-center justify-between cursor-pointer active:scale-95 transition-all animate-slide-up select-none bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 shadow-xl shadow-slate-200/50 dark:shadow-none`;
            
            card.onclick = () => {
                if(window.Main) Main.showResult(lastResult.id);
            };

            card.innerHTML = `
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-${color}-100 dark:bg-${color}-500/20 text-${color}-600 dark:text-${color}-400">
                        <i class="fa-solid fa-${subjectConfig.icon}"></i>
                    </div>
                    
                    <div>
                        <h3 class="text-xs font-black premium-text-head text-slate-800 dark:text-white uppercase tracking-wider">RESUME LEARNING</h3>
                        <p class="text-[10px] font-bold opacity-60 uppercase tracking-wide mt-0.5 text-slate-500 dark:text-slate-400">
                            ${subjectConfig.name} &bull; ${lastResult.score.toFixed(0)} Marks
                        </p>
                    </div>
                </div>

                <div class="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-white/50">
                    <i class="fa-solid fa-chevron-right text-xs"></i>
                </div>
            `;
            
            slot.appendChild(card);

        } catch (e) {
            console.warn("UIHome: Failed to render resume card", e);
        }
    }, 

    // ============================================================
    // 4. TOGGLE SWITCH & GRIDS
    // ============================================================

    _renderToggleSwitch(slot) {
        const wrapper = document.createElement('div');
        wrapper.className = "flex justify-center mb-6";
        
        // Adaptive Backgrounds for the Switch
        wrapper.innerHTML = `
            <div class="p-1 rounded-full flex relative w-64 h-12 bg-slate-200 dark:bg-slate-800/50 shadow-inner">
                <div id="toggle-pill" class="absolute top-1 left-1 bottom-1 w-[calc(50%-4px)] bg-white dark:bg-slate-600 shadow-md rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"></div>
                
                <button id="btn-gs1" class="flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 text-blue-600 dark:text-white">
                    GS Paper I
                </button>
                
                <button id="btn-csat" class="flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 opacity-50 text-slate-500 dark:text-slate-400 hover:opacity-100 hover:text-slate-700 dark:hover:text-white">
                    CSAT
                </button>
            </div>
        `;
        
        slot.appendChild(wrapper);

        // Bind Logic
        setTimeout(() => {
            const btnGS = document.getElementById('btn-gs1');
            const btnCSAT = document.getElementById('btn-csat');
            const pill = document.getElementById('toggle-pill');
            const sectionGS = document.getElementById('section-gs1');
            const sectionCSAT = document.getElementById('section-csat');

            if (!btnGS || !btnCSAT || !sectionGS) return;

            btnGS.onclick = () => {
                pill.style.transform = 'translateX(0)';
                btnGS.style.opacity = '1';
                btnGS.className = 'flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 text-blue-600 dark:text-white';
                btnCSAT.style.opacity = '0.5';
                btnCSAT.className = 'flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 text-slate-500 dark:text-slate-400';
                
                sectionGS.classList.remove('hidden');
                sectionGS.classList.add('animate-slide-up');
                sectionCSAT.classList.add('hidden');
            };

            btnCSAT.onclick = () => {
                pill.style.transform = 'translateX(100%)';
                btnCSAT.style.opacity = '1';
                btnCSAT.className = 'flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 text-purple-600 dark:text-white';
                btnGS.style.opacity = '0.5';
                btnGS.className = 'flex-1 relative z-10 text-[10px] font-black uppercase tracking-widest text-center transition-colors duration-300 text-slate-500 dark:text-slate-400';
                
                sectionCSAT.classList.remove('hidden');
                sectionCSAT.classList.add('animate-slide-up');
                sectionGS.classList.add('hidden');
            };
        }, 50);
    },

    _renderSubjectGrids(slot) {
        // --- SECTION 1: GS Paper I ---
        const sectionGS = document.createElement('div');
        sectionGS.id = 'section-gs1';
        sectionGS.className = 'pb-20';

        // 1. Grand Mock Card
        const mockGS = this._createMockCard('mock_gs1', 'GS Prelims Mock', 'Full Syllabus • Weighted Aggregate', 'amber');
        sectionGS.appendChild(mockGS);

        // 2. Subject Grid
        const gridGS = document.createElement('div');
        gridGS.className = "grid grid-cols-2 gap-4"; 
        
        if (CONFIG && CONFIG.subjectsGS1) {
            CONFIG.subjectsGS1.forEach((sub, index) => {
                const tile = this._createSubjectTile(sub, index);
                gridGS.appendChild(tile);
            });
        }
        sectionGS.appendChild(gridGS);
        slot.appendChild(sectionGS);

        // --- SECTION 2: CSAT (Hidden by default) ---
        const sectionCSAT = document.createElement('div');
        sectionCSAT.id = 'section-csat';
        sectionCSAT.className = 'hidden pb-20';

        // 1. Grand Mock Card
        const mockCSAT = this._createMockCard('mock_csat', 'CSAT Mock', 'Logic & Quant • Weighted Aggregate', 'purple');
        sectionCSAT.appendChild(mockCSAT);

        // 2. Subject Grid
        const gridCSAT = document.createElement('div');
        gridCSAT.className = "grid grid-cols-2 gap-4"; 
        
        if (CONFIG && CONFIG.subjectsCSAT) {
            CONFIG.subjectsCSAT.forEach((sub, index) => {
                const tile = this._createSubjectTile(sub, index); 
                gridCSAT.appendChild(tile);
            });
        }
        sectionCSAT.appendChild(gridCSAT);
        slot.appendChild(sectionCSAT);
    },

    // ============================================================
    // 5. COMPONENT HELPERS
    // ============================================================

    _createMockCard(id, title, subtitle, color) {
        const div = document.createElement('div');
        // Adaptive Grand Mock Card
        div.className = `premium-card p-6 rounded-[28px] mb-6 relative overflow-hidden cursor-pointer active:scale-95 transition-transform group animate-fade-in bg-${color}-50 dark:bg-${color}-500/10 border border-${color}-100 dark:border-${color}-500/20`;
        
        div.onclick = () => {
            if (window.Main && window.Main.handleMockSelection) {
                window.Main.handleMockSelection(id);
            }
        };
        
        div.innerHTML = `
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity rotate-12 text-${color}-600 dark:text-${color}-400">
                <i class="fa-solid fa-trophy text-6xl"></i>
            </div>
            
            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-8 h-8 rounded-full bg-${color}-200 dark:bg-${color}-500/20 flex items-center justify-center text-${color}-600 dark:text-${color}-400">
                        <i class="fa-solid fa-star text-xs animate-pulse"></i>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-widest text-${color}-600 dark:text-${color}-400">Official Protocol</span>
                </div>
                
                <h3 class="text-xl font-black uppercase italic tracking-tight leading-none mb-1 text-${color}-800 dark:text-white">${title}</h3>
                <p class="text-xs font-bold opacity-70 text-${color}-700 dark:text-${color}-200">${subtitle}</p>
            </div>
            
            <div class="mt-5 flex items-center gap-2 text-[10px] font-bold opacity-60 uppercase tracking-widest group-hover:opacity-100 transition-opacity text-${color}-800 dark:text-white">
                <span>Tap to Configure</span>
                <i class="fa-solid fa-arrow-right"></i>
            </div>
        `;
        return div;
    },

    _createSubjectTile(sub, index) {
        const div = document.createElement('div');
        const delay = index * 50; 
        const color = sub.color || 'blue';

        // Adaptive Subject Tile
        div.className = `premium-card p-4 rounded-[28px] flex flex-col items-center justify-center h-44 active:scale-95 transition-transform animate-view-enter relative group bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 shadow-lg shadow-slate-200/50 dark:shadow-none`;
        div.style.animationDelay = `${delay}ms`;
        
        div.onclick = () => {
            if (window.Main && window.Main.selectSubject) {
                window.Main.selectSubject(sub.id); 
            } else {
                console.warn("Main controller not found");
            }
        };

        div.innerHTML = `
            <div class="mb-3 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-sm w-12 h-12 rounded-2xl flex items-center justify-center text-2xl bg-${color}-50 dark:bg-${color}-500/10 text-${color}-600 dark:text-${color}-400">
                <i class="fa-solid fa-${sub.icon}"></i>
            </div>
            
            <div class="z-10 text-center">
                <h3 class="text-xs font-black uppercase tracking-wider leading-tight text-slate-800 dark:text-white">${sub.name}</h3>
                <p class="text-[9px] font-bold opacity-40 uppercase mt-1 text-slate-500 dark:text-slate-400">Start Mock</p>
            </div>

            <div class="absolute -right-4 -top-4 w-16 h-16 bg-${color}-500 opacity-5 dark:opacity-10 rounded-full blur-xl group-hover:opacity-20 transition-opacity pointer-events-none"></div>
        `;
        
        return div;
    }
};

window.UIHome = UIHome;

