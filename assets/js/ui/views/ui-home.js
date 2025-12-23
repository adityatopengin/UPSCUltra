/**
 * UI-HOME (THE DASHBOARD)
 * Version: 2.1.0 (Fixed  Syntax Error)
 * Path: assets/js/ui/views/ui-home.js
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
        // REFACTOR: Increased padding to pb-40
        container.className = 'view-container pb-40'; 

        // B. Update Header State
        if (window.UI && window.UIHeader) {
            window.UIHeader.toggle(true);
            window.UIHeader.updateActiveTab('home');
        }

        // C. Render The Oracle HUD
        const oracleSection = document.createElement('div');
        // REFACTOR: Kept premium-card, removed hardcoded bg colors if any
        oracleSection.className = 'oracle-container premium-card mb-6 p-6 relative overflow-hidden rounded-[32px] min-h-[220px] animate-fade-in';
        oracleSection.innerHTML = this._getOracleSkeleton();
        container.appendChild(oracleSection);

        // D. Trigger Prediction Engine (Async)
        this._initOracle(oracleSection);

        // E. Render "Continue Learning"
        await this._renderResumeCard(container);

        // F. Render Subject Grid
        await this._renderSubjectGrid(container);
    },

    // ============================================================
    // 2. ORACLE INTEGRATION
    // ============================================================

    _getOracleSkeleton() {
        // REFACTOR: Replaced specific bg colors with opacity classes where possible,
        // though gradient blobs are often needed for "vibe". Kept them as is for visual flair
        // but removed text-slate-*
        return `
            <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div class="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div class="flex justify-between items-start relative z-10 mb-4">
                <div>
                    <h2 class="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]">Oracle Prediction</h2>
                    <h3 id="prob-text" class="premium-text-head text-lg font-black mt-1 animate-pulse">ANALYZING DATA...</h3>
                </div>
                <div class="w-8 h-8 rounded-full premium-panel flex items-center justify-center opacity-80">
                    <i class="fa-solid fa-brain text-xs"></i>
                </div>
            </div>

            <div class="absolute inset-0 top-16 z-0 opacity-50">
                <canvas id="cloudChart"></canvas>
            </div>

            <div class="relative z-10 mt-8 flex justify-between items-end">
                <div>
                    <div class="text-[9px] font-bold opacity-50 uppercase mb-1">Projected Score</div>
                    <div class="flex items-baseline gap-2">
                        <span id="main-score" class="text-4xl font-black tracking-tighter">--</span>
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

            <div id="warning-container" class="relative z-10 mt-4 flex gap-2 overflow-x-auto no-scrollbar">
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
                probText.classList.add('text-rose-500');
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
            
            let subjectConfig = CONFIG.subjectsGS1.find(s => s.id === subjectId) || 
                                CONFIG.subjectsCSAT.find(s => s.id === subjectId);
                                
            if (!subjectConfig) {
                subjectConfig = { name: subjectId.toUpperCase(), color: 'slate', icon: 'book' };
            }

            const card = document.createElement('div');
            // REFACTOR: Replaced premium-card logic manually to ensure consistency
            card.innerHTML = `
            <div onclick="if(window.Main) Main.showResult('${lastResult.id}')" 
                 class="premium-card p-5 rounded-[28px] mb-8 flex items-center justify-between cursor-pointer active:scale-95 transition-transform animate-slide-up select-none ring-1 ring-white/10 hover:ring-white/20">
                
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-${subjectConfig.color}-100 dark:bg-${subjectConfig.color}-900/30 text-${subjectConfig.color}-600 flex items-center justify-center text-xl shadow-sm">
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
            </div>`;
            
            container.appendChild(card);

        } catch (e) {
            console.warn("UIHome: Failed to render resume card", e);
        }
    }, 

    // ============================================================
    // 4. SUBJECT GRID
    // ============================================================

    async _renderSubjectGrid(container) {
        // Section Title: GS1
        const title = document.createElement('h2');
        title.className = "text-xs font-black opacity-50 uppercase tracking-widest mb-4 pl-2";
        title.textContent = "General Studies (Paper 1)";
        container.appendChild(title);

        // Grid Container GS1
        const grid = document.createElement('div');
        grid.className = "grid grid-cols-2 gap-3 mb-8";
        
        if (CONFIG.subjectsGS1) {
            CONFIG.subjectsGS1.forEach((sub, index) => {
                const tile = this._createSubjectTile(sub, index);
                grid.appendChild(tile);
            });
        }
        container.appendChild(grid);

        // Section Title: CSAT
        const titleCsat = document.createElement('h2');
        titleCsat.className = "text-xs font-black opacity-50 uppercase tracking-widest mb-4 pl-2";
        titleCsat.textContent = "CSAT (Paper 2)";
        container.appendChild(titleCsat);

        // Grid Container CSAT
        const gridCsat = document.createElement('div');
        gridCsat.className = "grid grid-cols-2 gap-3 mb-24"; 
        
        if (CONFIG.subjectsCSAT) {
            CONFIG.subjectsCSAT.forEach((sub, index) => {
                const tile = this._createSubjectTile(sub, index + 5); 
                gridCsat.appendChild(tile);
            });
        }
        container.appendChild(gridCsat);
    }, 

    // ============================================================
    // 5. HELPER: TILE GENERATOR
    // ============================================================

    _createSubjectTile(sub, index) {
        const div = document.createElement('div');
        const delay = index * 50; 
        
        // REFACTOR: Replaced manual border/bg logic with premium-card
        div.className = `premium-card p-4 rounded-[24px] flex flex-col justify-between h-32 active:scale-95 transition-transform animate-view-enter relative overflow-hidden group cursor-pointer border border-white/5 hover:border-${sub.color}-500/30`;
        div.style.animationDelay = `${delay}ms`;
        
        div.onclick = () => {
            if (window.Main && window.Main.selectSubject) {
                window.Main.selectSubject(sub.id); 
            } else {
                console.warn("Main controller not found");
            }
        };

        div.innerHTML = `
            <div class="absolute -right-4 -top-4 w-20 h-20 bg-${sub.color}-500/10 rounded-full blur-2xl group-hover:bg-${sub.color}-500/20 transition-colors"></div>
            
            <div class="w-10 h-10 rounded-xl bg-${sub.color}-100 dark:bg-${sub.color}-900/30 text-${sub.color}-600 flex items-center justify-center text-lg z-10">
                <i class="fa-solid fa-${sub.icon}"></i>
            </div>
            
            <div class="z-10">
                <h3 class="text-sm font-black premium-text-head leading-tight">${sub.name}</h3>
                <p class="text-[9px] font-bold opacity-50 uppercase mt-1 group-hover:text-${sub.color}-400 transition-colors">Start Mock</p>
            </div>
        `;
        
        return div;
    }
};

window.UIHome = UIHome;


