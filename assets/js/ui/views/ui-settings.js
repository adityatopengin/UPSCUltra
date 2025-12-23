/**
 * UI-SETTINGS (CONTROL CENTER)
 * Version: 2.6.0 (Fixed Import & Handlers)
 * Path: assets/js/ui/views/ui-settings.js
 * Responsibilities:
 * 1. System Preferences (Theme, Haptics, Data).
 * 2. Information Hub (Mission, Creator, Tech Specs).
 * 3. The "Personality" Modules (Roast, Audio, Plan B).
 */

import { UI } from '../ui-manager.js';
import { CONFIG } from '../../config.js';
import { StorageService, DB } from '../../services/db.js'; 

export const UISettings = {
    // ============================================================
    // 1. STATE
    // ============================================================
    state: {
        clickCount: 0, // For unlocking developer mode easter egg
        audioPlaying: false,
        audioInstance: null
    },

    // ============================================================
    // 2. MAIN RENDER (DASHBOARD)
    // ============================================================

    render(container) {
        console.log("⚙️ UISettings: Opening Control Center...");
        
        // 1. Setup Shell
        container.className = 'view-container pb-32 bg-slate-900 min-h-screen select-none';
        
        // 2. Inject Content
        container.innerHTML = `
            ${this._getHeaderTemplate()}
            <div class="px-4 space-y-8 animate-slide-up">
                ${this._getSystemPrefsTemplate()}
                ${this._getDataControlTemplate()}
                ${this._getIntelligenceTemplate()}
                ${this._getMissionTemplate()}
                ${this._getCreatorTemplate()}
                ${this._getFooterTemplate()}
            </div>
            <div id="settings-modal-overlay" class="fixed inset-0 z-[60] hidden flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300"></div>
        `;
    },

    // ============================================================
    // 3. DATA HANDLERS (ADDED THIS SECTION TO FIX BUTTONS)
    // ============================================================

    async handleExport() {
        try {
            UI.showToast("Preparing Backup...", "info");
            const json = await StorageService.exportData();
            
            // Create Download Link
            const blob = new Blob([json], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `upsc-backup-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            
            UI.showToast('Backup Downloaded!', 'success');
        } catch(e) {
            console.error(e);
            UI.showToast('Export Failed', 'error');
        }
    },

    handleImport() {
        // Trigger the hidden file input
        const input = document.getElementById('import-file');
        if(input) input.click();
    },

    async processImportFile(input) {
        const file = input.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                UI.showToast("Restoring Data...", "info");
                await StorageService.importData(e.target.result);
                UI.showToast('Data Restored Successfully!', 'success');
                // Reload to apply changes
                setTimeout(() => window.location.reload(), 1500);
            } catch(err) {
                UI.showToast('Corrupt or Invalid File', 'error');
            }
        };
        reader.readAsText(file);
    },

    async handleReset() {
        if(confirm("⚠️ FACTORY RESET WARNING ⚠️\n\nThis will permanently delete ALL your progress, history, and stats.\n\nAre you sure?")) {
            await DB.clearStore('history');
            await DB.clearStore('profiles');
            await DB.clearStore('academic_state');
            await DB.clearStore('mistakes');
            window.location.reload();
        }
    },
    
    _handleEasterEgg() {
        this.state.clickCount++;
        if (this.state.clickCount === 5) {
            UI.showToast("👨‍💻 Developer Mode Unlocked", "success");
            // Add any dev logic here
        }
    },

    // ============================================================
    // 4. COMPONENT TEMPLATES (PRESERVED)
    // ============================================================

    _getHeaderTemplate() {
        return `
        <header class="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-white/5 px-6 pt-12 pb-4 mb-6">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest">Control Center</h2>
                    <h1 class="text-2xl font-black text-white tracking-tight">Settings</h1>
                </div>
                <div class="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-400 shadow-lg">
                    <i class="fa-solid fa-sliders"></i>
                </div>
            </div>
        </header>`;
    },

    _getSystemPrefsTemplate() {
        // Calculate Storage Usage (Mock logic or actual localstorage length)
        const usedKB = Math.round(JSON.stringify(localStorage).length / 1024);
        const percent = Math.min(100, (usedKB / 5000) * 100); 

        return `
        <section class="space-y-3">
            <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-4">System Preferences</label>
            
            <div class="glass-card p-5 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                        <i class="fa-solid fa-moon"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-white">Appearance</h3>
                        <p class="text-[9px] font-bold text-slate-500 uppercase">Dark Mode Only</p>
                    </div>
                </div>
                onclick="Main.toggleTheme()" class="w-12 h-7 bg-blue-600 rounded-full relative transition-all shadow-inner">
                    <div class="w-5 h-5 bg-white rounded-full absolute top-1 right-1 shadow-md"></div>
                </button>
            </div>

            <div class="glass-panel p-5 rounded-2xl">
                <div class="flex justify-between items-end mb-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase">Local Storage</span>
                    <span class="text-xs font-mono font-bold text-emerald-400">${usedKB} KB Used</span>
                </div>
                <div class="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]" style="width: ${percent}%"></div>
                </div>
            </div>
        </section>`;
    },

    _getDataControlTemplate() {
        return `
        <section class="space-y-3">
            <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-4">Data Persistence</label>
            
            <div class="grid grid-cols-2 gap-3">
                <button onclick="UISettings.handleExport()" class="glass-card p-4 flex flex-col gap-3 group active:scale-95 transition-transform hover:bg-white/5">
                    <div class="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform">
                        <i class="fa-solid fa-cloud-arrow-down text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-xs font-black text-white uppercase">Backup</h3>
                        <p class="text-[9px] font-bold text-slate-500 uppercase group-hover:text-blue-400 transition-colors">Save JSON</p>
                    </div>
                </button>

                <button onclick="UISettings.handleImport()" class="glass-card p-4 flex flex-col gap-3 group active:scale-95 transition-transform hover:bg-white/5">
                    <div class="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 group-hover:scale-110 transition-transform">
                        <i class="fa-solid fa-file-import text-lg"></i>
                    </div>
                    <div>
                        <h3 class="text-xs font-black text-white uppercase">Restore</h3>
                        <p class="text-[9px] font-bold text-slate-500 uppercase group-hover:text-purple-400 transition-colors">Load JSON</p>
                    </div>
                </button>
            </div>

            <div class="pt-2">
                <button onclick="UISettings.handleReset()" class="w-full glass-card p-5 flex items-center justify-between border-rose-500/30 hover:border-rose-500/60 group active:scale-95 transition-all">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 animate-pulse-slow">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div class="text-left">
                            <h3 class="text-xs font-black text-rose-500 group-hover:text-rose-400 transition-colors">Factory Reset</h3>
                            <p class="text-[9px] font-bold text-rose-500/50 uppercase">Erase all progress</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-rose-500/30 group-hover:text-rose-500 transition-colors"></i>
                </button>
            </div>
            
            <input type="file" id="import-file" class="hidden" accept=".json" onchange="UISettings.processImportFile(this)">
        </section>`;
    },

    _getIntelligenceTemplate() {
        return `
        <section class="space-y-3">
            <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-4">App Intelligence</label>
            
            <div class="grid grid-cols-2 gap-3">
                <button onclick="UISettings.openModal('techBrief')" class="glass-card p-4 relative overflow-hidden group active:scale-95 transition-transform">
                    <div class="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div class="relative z-10 flex flex-col gap-3">
                        <i class="fa-solid fa-microchip text-cyan-400 text-xl"></i>
                        <div>
                            <h3 class="text-xs font-black text-white uppercase">Logic Core</h3>
                            <p class="text-[9px] font-bold text-slate-500 uppercase">Architecture</p>
                        </div>
                    </div>
                </button>
                
                <button onclick="UISettings.openModal('techFAQ')" class="glass-card p-4 relative overflow-hidden group active:scale-95 transition-transform">
                    <div class="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    
                    <div class="relative z-10 flex flex-col gap-3">
                        <i class="fa-solid fa-code text-amber-400 text-xl"></i>
                        <div>
                            <h3 class="text-xs font-black text-white uppercase">Tech FAQ</h3>
                            <p class="text-[9px] font-bold text-slate-500 uppercase">How it works</p>
                        </div>
                    </div>
                </button>
            </div>
        </section>`;
    },

    _getMissionTemplate() {
        return `
        <section class="space-y-3">
            <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-4">Mission Universal</label>
            
            <button onclick="UISettings.openModal('orientation')" class="w-full glass-card p-5 flex items-center justify-between group active:scale-95 transition-transform">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)] group-hover:shadow-[0_0_25px_rgba(99,102,241,0.4)] transition-shadow">
                        <i class="fa-solid fa-microphone-lines"></i>
                    </div>
                    <div class="text-left">
                        <h3 class="text-xs font-black text-white group-hover:text-indigo-300 transition-colors">Orientation</h3>
                        <p class="text-[9px] font-bold text-slate-500 uppercase">Poet Pradeep Tripathi</p>
                    </div>
                </div>
                <div class="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-slate-500 group-hover:bg-white/10 group-hover:text-white transition-all">
                    <i class="fa-solid fa-play text-[10px]"></i>
                </div>
            </button>
            
            <button onclick="UISettings.openModal('motive')" class="w-full glass-card p-5 flex items-center justify-between group active:scale-95 transition-transform">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.2)]">
                        <i class="fa-solid fa-heart"></i>
                    </div>
                    <div class="text-left">
                        <h3 class="text-xs font-black text-white group-hover:text-pink-300 transition-colors">The Vision</h3>
                        <p class="text-[9px] font-bold text-slate-500 uppercase">Gyan Amala Logic</p>
                    </div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-600 group-hover:text-white transition-colors"></i>
            </button>
        </section>`;
    },

    _getCreatorTemplate() {
        return `
        <section class="space-y-3">
            <label class="text-[9px] font-black text-slate-500 uppercase tracking-widest pl-4">The Estate</label>
            
            <button onclick="UISettings.openModal('aboutCreator')" class="w-full glass-card p-6 relative overflow-hidden group active:scale-95 transition-transform">
                <div class="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-50"></div>
                
                <div class="relative z-10 flex flex-col items-center text-center gap-2">
                    <div class="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 text-xl mb-1 shadow-[0_0_20px_rgba(245,158,11,0.2)] group-hover:scale-110 transition-transform duration-300">
                        <i class="fa-solid fa-user-tie"></i>
                    </div>
                    <h3 class="text-sm font-black text-white uppercase tracking-tight">About Creator</h3>
                    <p class="text-[9px] font-bold text-amber-500 uppercase tracking-[0.2em] group-hover:tracking-[0.3em] transition-all">Ekam Satyam</p>
                </div>
            </button>

            <div class="pt-2">
                 <button onclick="UISettings.openModal('roastMenu')" class="w-full glass-card p-5 flex items-center justify-between border-rose-500/20 hover:border-rose-500/40 group active:scale-95 transition-all">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                            <i class="fa-solid fa-fire"></i>
                        </div>
                        <div class="text-left">
                            <h3 class="text-xs font-black text-rose-400">Roast Me</h3>
                            <p class="text-[9px] font-bold text-slate-500 uppercase">Demotivating Feedback</p>
                        </div>
                    </div>
                    <i class="fa-solid fa-chevron-right text-rose-500/30 group-hover:text-rose-500 transition-colors"></i>
                </button>
            </div>
        </section>`;
    },

    _getFooterTemplate() {
        return `
        <footer class="pt-4 pb-8 space-y-6">
            <div class="grid grid-cols-2 gap-3">
                <button onclick="UISettings.openModal('disclaimer')" class="glass-panel p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                    <i class="fa-solid fa-circle-exclamation text-rose-500 text-xs"></i>
                    <span class="text-[9px] font-bold uppercase text-slate-400">Disclaimer</span>
                </button>
                <button onclick="UISettings.openModal('privacy')" class="glass-panel p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                    <i class="fa-solid fa-user-shield text-teal-500 text-xs"></i>
                    <span class="text-[9px] font-bold uppercase text-slate-400">Privacy</span>
                </button>
                <button onclick="UISettings.openModal('terms')" class="glass-panel p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                    <i class="fa-solid fa-scale-balanced text-slate-500 text-xs"></i>
                    <span class="text-[9px] font-bold uppercase text-slate-400">Terms</span>
                </button>
                <button onclick="UISettings.openModal('contact')" class="glass-panel p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-white/5 transition-colors">
                    <i class="fa-solid fa-headset text-blue-500 text-xs"></i>
                    <span class="text-[9px] font-bold uppercase text-slate-400">Feedback</span>
                </button>
            </div>

            <div class="text-center opacity-30 hover:opacity-100 transition-opacity" onclick="UISettings._handleEasterEgg()">
                <p class="text-[8px] font-black tracking-[0.3em] uppercase text-white">
                    Gyan Amala &bull; v${CONFIG.version || '2.0.0'}
                </p>
            </div>
        </footer>`;
    },

    // ============================================================
    // 5. MODAL SYSTEM ENGINE
    // ============================================================

    openModal(modalType) {
        const overlay = document.getElementById('settings-modal-overlay');
        if (!overlay) return;

        // 1. Generate Content based on Type
        const contentHTML = this._getModalContent(modalType);
        if (!contentHTML) return;

        // 2. Inject into Overlay
        overlay.innerHTML = `
            <div class="w-full max-w-md mx-4 max-h-[85vh] overflow-hidden relative animate-slide-up
                bg-slate-900/90 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 rounded-[32px] flex flex-col">
                
                <div class="absolute -top-20 -right-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div class="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div class="relative z-10 overflow-y-auto custom-scrollbar flex-1">
                    ${contentHTML}
                </div>

                <div class="p-4 bg-slate-900/50 border-t border-white/5 backdrop-blur-md z-20">
                    <button onclick="UISettings.closeModal()" class="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95">
                        Close
                    </button>
                </div>
            </div>
        `;

        // 3. Show Overlay
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    },

    closeModal() {
        const overlay = document.getElementById('settings-modal-overlay');
        if (overlay) {
            // Stop Audio if playing
            if (this.state.audioInstance) {
                this.state.audioInstance.pause();
                this.state.audioPlaying = false;
            }

            overlay.classList.add('hidden');
            overlay.innerHTML = ''; 
            document.body.style.overflow = '';
        }
    },

    /**
     * Router for Modal Content
     */
    _getModalContent(type) {
        switch (type) {
            case 'techBrief': return this._renderTechBrief();
            case 'techFAQ': return this._renderTechFAQ();
            case 'orientation': return this._renderOrientation();
            case 'motive': return this._renderMotive();
            case 'aboutCreator': return this._renderAboutCreator();
            case 'roastMenu': return this._renderRoastMenu();
            case 'disclaimer': return this._renderLegal('disclaimer');
            case 'privacy': return this._renderLegal('privacy');
            case 'terms': return this._renderLegal('terms');
            case 'contact': return this._renderLegal('contact');
            default: return `<div class="p-8 text-center text-rose-500 font-bold">Error: Unknown Modal Type</div>`;
        }
    },

    // ============================================================
    // 6. CONTENT: TECH SPECS
    // ============================================================

    _renderTechBrief() {
        return `
        <div class="p-8 pb-4">
            <div class="text-center mb-8">
                <div class="w-16 h-16 mx-auto bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl mb-4 shadow-lg shadow-cyan-500/30">
                    <i class="fa-solid fa-microchip"></i>
                </div>
                <h2 class="text-2xl font-black text-white uppercase tracking-tight">Intelligence Brief</h2>
                <p class="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">System Architecture</p>
            </div>

            <div class="space-y-8">
                <div class="relative pl-6 border-l-2 border-slate-700">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-purple-500"></div>
                    <h3 class="text-sm font-black text-purple-400 uppercase tracking-wide mb-2">1. The Predictive Oracle</h3>
                    <p class="text-xs text-slate-300 leading-relaxed text-justify mb-2 font-light">
                        Built on a <b class="text-white">Weighted Exponential Moving Average (WEMA)</b>. Unlike simple averages, this gives 60% weight to your recent performance.
                    </p>
                    <ul class="text-[10px] text-slate-400 space-y-1 ml-1">
                        <li>• <b class="text-slate-200">Decay Factor:</b> Scores drop by 5% weekly if inactive.</li>
                        <li>• <b class="text-slate-200">Confidence Interval:</b> Requires min 5 quizzes to predict.</li>
                    </ul>
                </div>

                <div class="relative pl-6 border-l-2 border-slate-700">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-emerald-500"></div>
                    <h3 class="text-sm font-black text-emerald-400 uppercase tracking-wide mb-2">2. Passive Sensing</h3>
                    <p class="text-xs text-slate-300 leading-relaxed text-justify mb-2 font-light">
                        Tracks discipline via <b class="text-white">DOM Event Listeners</b>, not manual logs.
                    </p>
                    <ul class="text-[10px] text-slate-400 space-y-1 ml-1">
                        <li>• <b class="text-slate-200">Active Focus:</b> Tab switching pauses the "Study Timer".</li>
                        <li>• <b class="text-slate-200">Silent Gap Analysis:</b> Infers sleep quality from login times.</li>
                    </ul>
                </div>

                <div class="relative pl-6 border-l-2 border-slate-700">
                    <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-800 border-2 border-blue-500"></div>
                    <h3 class="text-sm font-black text-blue-400 uppercase tracking-wide mb-2">3. Local-First Infra</h3>
                    <p class="text-xs text-slate-300 leading-relaxed text-justify mb-2 font-light">
                        <b class="text-white">Serverless & Private.</b> Data lives in IndexedDB.
                    </p>
                    <ul class="text-[10px] text-slate-400 space-y-1 ml-1">
                        <li>• <b class="text-slate-200">Drift-Proof Timing:</b> Recursive correction loop.</li>
                        <li>• <b class="text-slate-200">Offline Capable:</b> Works without internet (PWA).</li>
                    </ul>
                </div>
            </div>
        </div>`;
    },

    _renderTechFAQ() {
        return `
        <div class="p-8 pb-4">
            <div class="flex items-center gap-4 mb-6 text-amber-500">
                <div class="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-2xl border border-amber-500/20">
                    <i class="fa-solid fa-circle-question"></i>
                </div>
                <div>
                    <h2 class="text-xl font-black uppercase tracking-tight text-white">Technical FAQ</h2>
                    <p class="text-[9px] font-bold text-slate-500 uppercase">Under the Hood</p>
                </div>
            </div>

            <div class="space-y-4">
                <div class="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <h3 class="text-[11px] font-bold text-amber-400 mb-2">Q: Why did my score drop overnight?</h3>
                    <p class="text-[10px] text-slate-300 leading-relaxed">
                        The <b class="text-white">Forgetting Curve</b> algorithm applies a decay penalty if you haven't revised a subject in 7 days.
                    </p>
                </div>

                <div class="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <h3 class="text-[11px] font-bold text-amber-400 mb-2">Q: Where is my data?</h3>
                    <p class="text-[10px] text-slate-300 leading-relaxed">
                        100% on this device. If you clear browser cache, it's gone. Use <b class="text-white">Backup</b> frequently.
                    </p>
                </div>

                <div class="bg-slate-800/50 p-4 rounded-2xl border border-white/5">
                    <h3 class="text-[11px] font-bold text-amber-400 mb-2">Q: Is the "Psych Profile" real?</h3>
                    <p class="text-[10px] text-slate-300 leading-relaxed">
                        It is heuristic-based. We measure reaction time (<1s = Impulsive) and answer switching (Doubt) to build the profile.
                    </p>
                </div>
            </div>
        </div>`;
    },

    // ============================================================
    // 7. CONTENT: PERSONALITY MODULES
    // ============================================================

    _renderOrientation() {
        return `
        <div class="p-8 text-center">
            <div class="relative w-24 h-24 mx-auto mb-8 group">
                <div class="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity animate-pulse-slow"></div>
                <div class="relative w-full h-full bg-slate-800/50 border border-white/10 rounded-full flex items-center justify-center text-4xl text-indigo-400">
                    <i class="fa-solid fa-headphones"></i>
                </div>
            </div>

            <h2 class="text-2xl font-display font-black text-white mb-2 uppercase tracking-tight">Orientation</h2>
            <p class="text-[10px] font-bold text-indigo-300/80 uppercase mb-8 tracking-[0.2em]">Poet PRADEEP TRIPATHI</p>
            
            <div class="bg-black/40 p-4 rounded-3xl border border-white/5 mb-8 flex items-center gap-4 relative overflow-hidden">
                <audio id="orientation-audio" src="assets/audio/disclaimer.mp3" preload="metadata" onended="UISettings.resetAudioUI()"></audio>
                
                <button id="audio-play-btn" onclick="UISettings.toggleAudio()" 
                    class="w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all active:scale-95 z-20 relative shrink-0">
                    <i class="fa-solid fa-play ml-1"></i>
                </button>

                <div class="flex-1 h-8 flex items-center gap-1 justify-center opacity-50 transition-opacity" id="audio-waveform">
                    <div class="w-1 h-3 bg-indigo-400 rounded-full"></div>
                    <div class="w-1 h-5 bg-indigo-400 rounded-full"></div>
                    <div class="w-1 h-4 bg-indigo-400 rounded-full"></div>
                    <div class="w-1 h-6 bg-indigo-400 rounded-full"></div>
                    <div class="w-1 h-4 bg-indigo-400 rounded-full"></div>
                    <div class="w-1 h-2 bg-indigo-400 rounded-full"></div>
                    <div class="w-1 h-5 bg-indigo-400 rounded-full"></div>
                </div>
            </div>
            
            <p class="text-xs text-slate-400 italic mb-8 font-serif">"If you are sang-e-marmar, I am your Khajuraho ka majdoor"</p>
        </div>`;
    },

    toggleAudio() {
        const audio = document.getElementById('orientation-audio');
        const btn = document.getElementById('audio-play-btn');
        const wave = document.getElementById('audio-waveform');
        
        if (!audio) return;
        this.state.audioInstance = audio; // Save ref to stop on close

        if (audio.paused) {
            audio.play().then(() => {
                this.state.audioPlaying = true;
                btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                // Add animation classes to bars
                Array.from(wave.children).forEach((bar, i) => {
                    bar.style.animation = `bounce-small 0.6s infinite ease-in-out ${i * 0.1}s`;
                });
                wave.classList.remove('opacity-50');
                wave.classList.add('opacity-100');
            }).catch(e => {
                console.error("Audio Error:", e);
                UI.showToast("Audio file missing or blocked", "error");
            });
        } else {
            audio.pause();
            this.state.audioPlaying = false;
            btn.innerHTML = '<i class="fa-solid fa-play ml-1"></i>';
            Array.from(wave.children).forEach(bar => bar.style.animation = 'none');
            wave.classList.add('opacity-50');
        }
    },

    resetAudioUI() {
        const btn = document.getElementById('audio-play-btn');
        const wave = document.getElementById('audio-waveform');
        if(btn) btn.innerHTML = '<i class="fa-solid fa-play ml-1"></i>';
        if(wave) {
            Array.from(wave.children).forEach(bar => bar.style.animation = 'none');
            wave.classList.add('opacity-50');
        }
        this.state.audioPlaying = false;
    },

    _renderMotive() {
        return `
        <div class="p-8 text-center relative overflow-hidden">
            <div class="w-20 h-20 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-2xl mx-auto flex items-center justify-center text-3xl mb-6 shadow-lg shadow-pink-500/30 rotate-3">
                <i class="fa-solid fa-heart"></i>
            </div>
            
            <h2 class="text-2xl font-black text-white mb-6 uppercase tracking-tight">The Vision</h2>
            
            <div class="space-y-4 text-sm text-slate-300 leading-relaxed text-justify font-light">
                <p>
                    <b class="text-pink-400 font-bold">Gyan Amala</b> (Pure Knowledge) was founded on the principle that elite-level preparation shouldn't cost a fortune.
                </p>
                <p>
                    We leverage <b class="text-pink-400 font-bold">Local-First Architecture</b> to provide you with tools like the <b class="text-white">Predictive Oracle</b> and <b class="text-white">Behavioral Analytics</b> at zero cost. Your device is the server. Your data is yours.
                </p>
            </div>
        </div>`;
    },

    _renderAboutCreator() {
        const myEmail = "aditya.aditya.1492@gmail.com";
        const subject = encodeURIComponent("Plan B: Official Recruitment of the Dholakpur Legend");
        const body = encodeURIComponent(
`Ae Raju! 👓 

I saw your app and I have only one thing to say: 'Utha le re Baba, mere ko nahi, is app ke creator ko utha le!' 

Your coding is so bad that even Majnu Bhai’s donkey won't use it. I am offering you a job at Star Fisheries to count dead fish, because they are more active than your app logic.

Isse dekh kr bas ek hi sabd bolna hai—Aaa Thuuu! 💦

Details: [Insert your bekaar job offer here]`
        );

        return `
        <div class="p-0">
            <div class="bg-gradient-to-br from-amber-600 to-orange-700 text-white p-10 text-center relative overflow-hidden">
                <div class="absolute inset-0 bg-black/20 mix-blend-overlay"></div>
                <div class="relative z-10">
                    <h2 class="text-3xl font-display font-black mb-2 text-white drop-shadow-md">Ekam Satyam</h2>
                    <p class="text-[9px] uppercase tracking-widest opacity-70">Truth is one</p>
                </div>
            </div>

            <div class="p-8 space-y-8">
                <div>
                    <h3 class="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3">The Story</h3>
                    <p class="text-sm text-slate-300 leading-relaxed text-justify font-light">
                        I am a <b class="text-white">B.A. (Hons) Political Science</b> graduate with absolutely no background in formal coding. <b class="text-amber-400">UPSCSuperApp</b> is an amateur project born out of a week of sleepless nights and collaboration with AI.
                    </p>
                </div>

                <div class="p-5 bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-white/5">
                    <h3 class="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-3">Professional Disgrace</h3>
                    <p class="text-xs text-slate-400 leading-relaxed mb-6">
                        If you are an employer and you want to offer me a job (not security guard 🛡️), use the button below.
                    </p>
                    
                    <a href="mailto:${myEmail}?subject=${subject}&body=${body}" 
                       class="block w-full py-4 bg-rose-600 hover:bg-rose-500 text-white text-center rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-rose-600/30 active:scale-95 transition-transform">
                        Offer Plan B 
                    </a>
                </div>
            </div>
        </div>`;
    },

    _renderRoastMenu() {
        const myEmail = "aditya.aditya.1492@gmail.com";
        const myTelegram = "kandiladitya";
        
        // Draft 1: Email
        const emailSub = encodeURIComponent("Aaa Thuuu: My Eyes Are Bleeding 🩸");
        const emailBody = encodeURIComponent("Dear Aditya,\n\nIsse kharab app meine aaj tak nahi dekha. My phone started playing 'Mera Jeevan Kora Kaagaz' because there is zero logic here.\n\nIsse dekh kr bas ek hi sabd bolna hai—Aaa Thuuu! 💦");
        
        // Draft 2: Telegram
        const tgText = encodeURIComponent("Knock Knock! 🚪 I am here to tell you that your app is a national emergency. NASA has detected a black hole and it's actually your 'Predictive Engine'. Aaa Thuuu! 💦");

        return `
        <div class="p-8 text-center">
            <h2 class="text-2xl font-black text-white mb-2 uppercase tracking-tight">Roast & Feedback</h2>
            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8">Tell the creator how much you hate it</p>
            
            <div class="grid grid-cols-2 gap-4">
                <a href="mailto:${myEmail}?subject=${emailSub}&body=${emailBody}" 
                   class="p-6 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-[24px] flex flex-col items-center gap-3 text-blue-400 transition-all group active:scale-95">
                    <i class="fa-solid fa-envelope text-3xl group-hover:scale-110 transition-transform"></i>
                    <span class="text-[9px] font-black uppercase tracking-widest">Email Roast</span>
                </a>
                
                <a href="https://t.me/${myTelegram}?text=${tgText}" target="_blank"
                   class="p-6 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-[24px] flex flex-col items-center gap-3 text-emerald-400 transition-all group active:scale-95">
                    <i class="fa-brands fa-telegram text-3xl group-hover:scale-110 transition-transform"></i>
                    <span class="text-[9px] font-black uppercase tracking-widest">Telegram Ping</span>
                </a>
            </div>
        </div>`;
    },

    _renderLegal(type) {
        let content = '';
        if (type === 'disclaimer') {
            content = `
                <ul class="space-y-4 text-xs text-slate-300 list-disc pl-4 leading-relaxed font-light">
                    <li><b class="text-rose-400">AI-Generated Content:</b> Questions are generated using AI. Gyan Amala does not guarantee 100% accuracy.</li>
                    <li><b class="text-rose-400">Limitation of Liability:</b> The creator is not liable for exam failures or data loss.</li>
                    <li><b class="text-rose-400">Non-Commercial:</b> This is a portfolio project.</li>
                </ul>`;
        } else if (type === 'privacy') {
            content = `
                <ul class="space-y-6 text-xs text-slate-300">
                    <li class="flex gap-4 items-start"><div class="w-4 text-teal-400"><i class="fa-solid fa-check"></i></div><div><b class="text-white">Local-First:</b> Data never leaves this device.</div></li>
                    <li class="flex gap-4 items-start"><div class="w-4 text-teal-400"><i class="fa-solid fa-check"></i></div><div><b class="text-white">Zero Tracking:</b> No analytics, no IPs collected.</div></li>
                </ul>`;
        } else {
            content = `<p class="text-xs text-slate-300 leading-relaxed">Provided 'as is' for educational purposes. Use at your own risk. Don't blame us if you get addicted to the Arcade mode.</p>`;
        }

        return `
        <div class="p-8">
            <h2 class="text-xl font-black uppercase tracking-tight text-white mb-6 border-b border-white/10 pb-4">${type.toUpperCase()}</h2>
            ${content}
        </div>`;
    }
};

window.UISettings = UISettings;

