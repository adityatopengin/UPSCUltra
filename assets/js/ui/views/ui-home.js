/**
 * UI-HOME (THE DASHBOARD)
 * Version: 3.3.0 (Patched: Grand Mock Integration)
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
        container.className = 'view-container pb-40 px-4'; 

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
        // Create a wrapper for margins/layout, but let UIOracle handle the inner card
        const wrapper = document.createElement('div');
        wrapper.className = 'mb-6 animate-fade-in min-h-[220px]';
        slot.appendChild(wrapper);

        // Trigger Component Load (Delegating view logic to ui-oracle.js)
        this._initOracle(wrapper);
    },

    async _initOracle(container) {
        // 🛡️ FIX: Lazy Load the Oracle Component if missing
        if (!window.UIOracle) {
            try {
                await import('../components/ui-oracle.js');
            } catch (e) {
                console.warn("UIHome: Oracle component missing.");
                container.innerHTML = `<div class="p-4 text-center text-rose-500 text-xs font-bold">Oracle Offline</div>`;
                return;
            }
        }

        // 🛡️ SAFETY: Initialize & Render
        if (window.UIOracle) {
            window.UIOracle.init();
            // Critical Fix: Passing the CONTAINER, not the data. 
            // UIOracle.js handles the fetching via MasterAggregator internally.
            window.UIOracle.render(container); 
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
            
            slot.appendChild(card);

        } catch (e) {
            console.warn("UIHome: Failed to render resume card", e);
            // No user facing error needed, just don't show the card
        }
    }, 

    // ============================================================
    // 4. TOGGLE SWITCH & GRIDS (UPDATED FOR GRAND MOCKS)
    // ============================================================

    _renderToggleSwitch(slot) {
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
        
        slot.appendChild(wrapper);

        // Bind Logic (Targeting New Section IDs)
        setTimeout(() => {
            const btnGS = document.getElementById('btn-gs1');
            const btnCSAT = document.getElementById('btn-csat');
            const pill = document.getElementById('toggle-pill');
            const sectionGS = document.getElementById('section-gs1');
            const sectionCSAT = document.getElementById('section-csat');

            if (!btnGS || !btnCSAT || !sectionGS) return; // Safety

            btnGS.onclick = () => {
                pill.style.transform = 'translateX(0)';
                btnGS.style.opacity = '1';
                btnGS.classList.add('text-blue-600');
                btnCSAT.style.opacity = '0.5';
                btnCSAT.classList.remove('text-blue-600');
                
                sectionGS.classList.remove('hidden');
                sectionGS.classList.add('animate-slide-up');
                sectionCSAT.classList.add('hidden');
            };

            btnCSAT.onclick = () => {
                pill.style.transform = 'translateX(100%)';
                btnCSAT.style.opacity = '1';
                btnCSAT.classList.add('text-blue-600');
                btnGS.style.opacity = '0.5';
                btnGS.classList.remove('text-blue-600');
                
                sectionCSAT.classList.remove('hidden');
                sectionCSAT.classList.add('animate-slide-up');
                sectionGS.classList.add('hidden');
            };
        }, 50);
    },

    _renderSubjectGrids(slot) {
        // 🛡️ REFACTOR: Wrappers now hold both Mock Card + Grid for clean toggling
        
        // --- SECTION 1: GS Paper I ---
        const sectionGS = document.createElement('div');
        sectionGS.id = 'section-gs1';
        sectionGS.className = 'pb-20';

        // 1. Grand Mock Card
        const mockGS = this._createMockCard('mock_gs1', 'GS Prelims Mock', 'Full Syllabus • Weighted Aggregate');
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
        const mockCSAT = this._createMockCard('mock_csat', 'CSAT Mock', 'Logic & Quant • Weighted Aggregate');
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

    // 🛡️ NEW: Helper for the Grand Mock Card
    _createMockCard(id, title, subtitle) {
        const div = document.createElement('div');
        div.className = 'premium-card flavor-gold p-6 rounded-[28px] mb-6 relative overflow-hidden cursor-pointer active:scale-95 transition-transform group animate-fade-in';
        
        // Triggers the Main.handleMockSelection modal
        div.onclick = () => {
            if (window.Main && window.Main.handleMockSelection) {
                window.Main.handleMockSelection(id);
            }
        };
        
        div.innerHTML = `
            <div class="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity rotate-12">
                <i class="fa-solid fa-trophy text-6xl"></i>
            </div>
            
            <div class="relative z-10">
                <div class="flex items-center gap-3 mb-2">
                    <div class="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400">
                        <i class="fa-solid fa-star text-xs animate-pulse"></i>
                    </div>
                    <span class="text-[9px] font-black uppercase tracking-widest text-amber-400">Official Protocol</span>
                </div>
                
                <h3 class="text-xl font-black premium-text-head uppercase italic tracking-tight leading-none mb-1">${title}</h3>
                <p class="text-xs font-bold opacity-60">${subtitle}</p>
            </div>
            
            <div class="mt-5 flex items-center gap-2 text-[10px] font-bold opacity-40 uppercase tracking-widest group-hover:opacity-100 transition-opacity">
                <span>Tap to Configure</span>
                <i class="fa-solid fa-arrow-right"></i>
            </div>
        `;
        return div;
    },

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

