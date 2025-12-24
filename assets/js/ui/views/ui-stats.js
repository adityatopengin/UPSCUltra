/**
 * UI-STATS (THE ANALYTICS HUB)
 * Version: 2.2.0 (Full Logic Restored + Memory Fix)
 * Path: assets/js/ui/views/ui-stats.js
 * Responsibilities:
 * 1. Visualizes Academic & Behavioral Data.
 * 2. Dynamically loads Chart.js (performance optimization).
 * 3. Implements the "Tri-View" Strategy (Overview, Psych, Timeline).
 */

import { BehavioralEngine } from '../../engine/behavioral-engine.js';
import { AcademicEngine } from '../../engine/academic-engine.js';
import { UI } from '../ui-manager.js';

export const UIStats = {
    // ============================================================
    // 1. STATE & CONFIG
    // ============================================================
    state: {
        activeTab: 'overview', // 'overview' | 'psych' | 'timeline'
        chartLibLoaded: false,
        charts: {}, // Store instances to destroy them properly
    },

    config: {
        chartJsUrl: 'https://cdn.jsdelivr.net/npm/chart.js',
        colors: {
            primary: '#3b82f6',   // Blue
            accent: '#8b5cf6',    // Purple
            success: '#10b981',   // Emerald
            danger: '#f43f5e',    // Rose
            warning: '#f59e0b',   // Amber
            text: '#94a3b8',      // Slate-400
            grid: 'rgba(255,255,255,0.05)'
        }
    },

    // ============================================================
    // 2. INITIALIZATION & LOADER
    // ============================================================

    async render(container) {
        console.log("📈 UIStats: Initializing Analytics...");
        container.innerHTML = '';
        // REFACTOR: Removed bg-slate-900. Increased padding to pb-40.
        container.className = 'view-container pb-40 min-h-screen';

        // 1. Show Loading Skeleton first
        container.innerHTML = this._getSkeletonTemplate();

        // 2. Load Chart.js if not present
        if (!this.state.chartLibLoaded) {
            try {
                await this._loadChartJs();
                this.state.chartLibLoaded = true;
            } catch (e) {
                if (window.UI) UI.showToast("Failed to load Analytics Engine", "error");
                console.error(e);
                return;
            }
        }

        // 3. Render Full UI
        this._renderShell(container);
    },

    // 🛡️ FIX: Memory Leak Prevention
    onUnmount() {
        console.log("📈 UIStats: Cleaning up charts...");
        this._destroyAllCharts();
    },

    _destroyAllCharts() {
        Object.keys(this.state.charts).forEach(key => {
            if (this.state.charts[key]) {
                this.state.charts[key].destroy();
                delete this.state.charts[key];
            }
        });
        this.state.charts = {};
    },

    /**
     * Dynamically injects Chart.js script tag
     */
    _loadChartJs() {
        return new Promise((resolve, reject) => {
            if (window.Chart) {
                resolve();
                return;
            }
            
            console.log("📈 UIStats: Fetching Chart.js...");
            const script = document.createElement('script');
            script.src = this.config.chartJsUrl;
            script.onload = () => {
                console.log("📈 UIStats: Chart.js Ready.");
                // Register defaults for Premium Look
                Chart.defaults.color = this.config.colors.text;
                Chart.defaults.font.family = "'Inter', sans-serif";
                Chart.defaults.scale.grid.color = this.config.colors.grid;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    // ============================================================
    // 3. THE SHELL (LAYOUT & TABS)
    // ============================================================

    _renderShell(container) {
        // REFACTOR: Removed bg-slate-900/backdrop-blur/borders from header.
        // Using semantic .premium-text-head and .premium-panel
        container.innerHTML = `
            <header class="sticky top-0 z-30 px-6 pt-12 pb-4">
                <div class="flex items-center justify-between mb-6">
                    <div>
                        <h2 class="text-xs font-bold opacity-60 uppercase tracking-widest">Deep Analysis</h2>
                        <h1 class="premium-text-head text-2xl font-black tracking-tight">Your DNA</h1>
                    </div>
                    <div class="flex flex-col items-end">
                        <span class="text-[10px] font-bold opacity-50 uppercase">Rank</span>
                        <span class="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                            ${this._calculateGlobalRank()}
                        </span>
                    </div>
                </div>

                <div class="flex p-1 premium-panel rounded-xl">
                    <button onclick="UIStats.switchTab('overview')" id="tab-overview" class="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${this.state.activeTab === 'overview' ? 'bg-white/10 shadow-lg' : 'opacity-50 hover:opacity-80'}">
                        Overview
                    </button>
                    <button onclick="UIStats.switchTab('psych')" id="tab-psych" class="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${this.state.activeTab === 'psych' ? 'bg-white/10 shadow-lg' : 'opacity-50 hover:opacity-80'}">
                        Psych
                    </button>
                    <button onclick="UIStats.switchTab('timeline')" id="tab-timeline" class="flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${this.state.activeTab === 'timeline' ? 'bg-white/10 shadow-lg' : 'opacity-50 hover:opacity-80'}">
                        Timeline
                    </button>
                </div>
            </header>

            <main id="stats-content" class="px-4 py-6 animate-fade-in">
                </main>
        `;

        // Load initial tab
        this.switchTab(this.state.activeTab);
    },

    _getSkeletonTemplate() {
        return `
            <div class="pt-20 px-6 animate-pulse">
                <div class="h-8 w-1/2 bg-white/10 rounded mb-4"></div>
                <div class="h-12 w-full bg-white/10 rounded-xl mb-8"></div>
                <div class="h-64 w-full bg-white/10 rounded-2xl mb-4"></div>
                <div class="h-32 w-full bg-white/10 rounded-2xl"></div>
            </div>
        `;
    },

    _calculateGlobalRank() {
        // Uses AcademicEngine to calculate rank based on mastery
        const avg = AcademicEngine.getGlobalMastery ? AcademicEngine.getGlobalMastery() : 0;
        if (avg > 90) return 'ELITE';
        if (avg > 75) return 'VETERAN';
        if (avg > 50) return 'ROOKIE';
        return 'NOVICE';
    },

    switchTab(tabName) {
        this.state.activeTab = tabName;
        
        // Update Buttons
        ['overview', 'psych', 'timeline'].forEach(t => {
            const btn = document.getElementById(`tab-${t}`);
            if (btn) {
                if (t === tabName) {
                    btn.className = "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all bg-white/10 shadow-lg";
                } else {
                    btn.className = "flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all opacity-50 hover:opacity-80";
                }
            }
        });

        // Update Content
        const content = document.getElementById('stats-content');
        if (content) {
            content.innerHTML = ''; // Clear old content
            
            // 🛡️ FIX: Explicitly destroy old charts when switching tabs
            this._destroyAllCharts();

            // Render Specific View
            if (tabName === 'overview') this._renderOverview(content);
            else if (tabName === 'psych') this._renderPsych(content);
            else if (tabName === 'timeline') this._renderTimeline(content);
        }
    },

    // ============================================================
    // 4. VIEW: OVERVIEW (RADAR & DECAY)
    // ============================================================

    _renderOverview(parent) {
        // 1. Fetch Data
        // Fallback to empty object if Engine not ready
        const subjects = (AcademicEngine.state && AcademicEngine.state.mastery) ? AcademicEngine.state.mastery : {}; 
        const labels = Object.keys(subjects).map(s => s.charAt(0).toUpperCase() + s.slice(1));
        const dataPoints = Object.values(subjects).map(s => s.score || 0);

        // 2. Inject Layout
        // REFACTOR: Replaced glass-card/glass-panel with premium-card/premium-panel
        parent.innerHTML = `
            <div class="premium-card p-4 mb-6 relative overflow-hidden">
                <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
                
                <div class="flex justify-between items-center mb-4 px-2">
                    <h3 class="text-sm font-bold uppercase tracking-wider">Subject Mastery</h3>
                    <i class="fa-solid fa-bullseye text-blue-400"></i>
                </div>
                
                <div class="relative h-[300px] w-full flex items-center justify-center">
                    <canvas id="chart-radar"></canvas>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-6">
                
                <div class="premium-panel rounded-2xl p-5 border-l-4 border-rose-500">
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h3 class="text-sm font-bold opacity-80 uppercase">Attention Needed</h3>
                            <p class="text-[10px] opacity-50 mt-1">Based on Forgetting Curve decay</p>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 animate-pulse">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                        </div>
                    </div>
                    
                    <div id="decay-list" class="space-y-4">
                        </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <div class="premium-panel p-4 rounded-xl flex flex-col items-center justify-center text-center">
                        <span class="text-[10px] opacity-50 uppercase font-bold">Total Qs</span>
                        <span class="text-2xl font-black mt-1">${AcademicEngine.getTotalQuestionsAnswered ? AcademicEngine.getTotalQuestionsAnswered() : 0}</span>
                    </div>
                    <div class="premium-panel p-4 rounded-xl flex flex-col items-center justify-center text-center">
                        <span class="text-[10px] opacity-50 uppercase font-bold">Accuracy</span>
                        <span class="text-2xl font-black text-emerald-400 mt-1">${AcademicEngine.getGlobalAccuracy ? AcademicEngine.getGlobalAccuracy() : 0}%</span>
                    </div>
                </div>
            </div>
        `;

        // 3. Init Chart (Delay slightly to ensure DOM is ready)
        requestAnimationFrame(() => {
            this._initRadarChart(labels, dataPoints);
            this._renderDecayList(subjects);
        });
    },

    _initRadarChart(labels, data) {
        const ctx = document.getElementById('chart-radar');
        if (!ctx) return;

        // Create Gradient Fill
        const gradient = ctx.getContext('2d').createRadialGradient(150, 150, 0, 150, 150, 150);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)'); // Blue center
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.1)'); // Purple fade

        // Default data if empty
        const safeLabels = labels.length ? labels : ['Polity', 'History', 'Geog', 'Econ', 'Env'];
        const safeData = data.length ? data : [65, 59, 90, 81, 56];

        this.state.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: safeLabels,
                datasets: [{
                    label: 'Current Mastery',
                    data: safeData,
                    backgroundColor: gradient,
                    borderColor: '#60a5fa', // Blue-400
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3b82f6',
                    pointRadius: 3,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        angleLines: { color: 'rgba(255,255,255,0.05)' },
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        pointLabels: {
                            color: '#cbd5e1', // Slate-300
                            font: { size: 10, family: 'Inter', weight: 'bold' }
                        },
                        ticks: { display: false } // Hide numbers on axis for cleaner look
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#94a3b8',
                        padding: 10,
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: (ctx) => `Mastery: ${ctx.raw}%`
                        }
                    }
                }
            }
        });
    },

    _renderDecayList(subjects) {
        const container = document.getElementById('decay-list');
        if (!container) return;

        // Sort subjects by "Urgency" (Low Score + Old Timestamp)
        // For MVP, we just take the lowest mastery
        const sorted = Object.entries(subjects)
            .sort(([, a], [, b]) => (a.score || 0) - (b.score || 0))
            .slice(0, 3); // Top 3 worst

        if (sorted.length === 0) {
            container.innerHTML = `<div class="text-xs opacity-50 italic text-center py-2">No data yet. Start studying!</div>`;
            return;
        }

        container.innerHTML = sorted.map(([key, data]) => {
            const name = key.charAt(0).toUpperCase() + key.slice(1);
            const score = Math.round(data.score || 0);
            
            return `
            <div class="flex items-center gap-3">
                <div class="flex-1">
                    <div class="flex justify-between mb-1">
                        <span class="text-xs font-bold opacity-80">${name}</span>
                        <span class="text-[10px] font-mono text-rose-400">${score}% Mastery</span>
                    </div>
                    <div class="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div class="h-full bg-rose-500 rounded-full" style="width: ${score}%"></div>
                    </div>
                </div>
                <button onclick="Main.selectSubject('${key}')" class="w-8 h-8 rounded-lg bg-white/5 border border-white/5 opacity-60 hover:opacity-100 hover:bg-white/10 flex items-center justify-center transition-all">
                    <i class="fa-solid fa-play text-xs"></i>
                </button>
            </div>
            `;
        }).join('');
    },

    // ============================================================
    // 5. VIEW: PSYCH (BEHAVIORAL DNA)
    // ============================================================

    _renderPsych(parent) {
        // 1. Fetch Data
        const p = BehavioralEngine.profile || {};
        const labels = ['Focus', 'Calm', 'Speed', 'Precision', 'Risk', 'Endurance', 'Flexibility'];
        const dataValues = [
            (p.focus?.value || 0.5) * 100,
            (p.calm?.value || 0.5) * 100,
            (p.speed?.value || 0.5) * 100,
            (p.precision?.value || 0.5) * 100,
            (p.risk?.value || 0.5) * 100,
            (p.endurance?.value || 0.5) * 100,
            (p.flexibility?.value || 0.5) * 100
        ];

        // 2. Inject Layout
        // REFACTOR: Replaced glass-card/glass-panel with premium-card/premium-panel
        parent.innerHTML = `
            <div class="premium-card p-4 mb-6">
                <div class="flex justify-between items-center mb-4 px-2">
                    <div>
                        <h3 class="text-sm font-bold uppercase tracking-wider">Cognitive Profile</h3>
                        <p class="text-[10px] opacity-50">Your psychological archetype</p>
                    </div>
                    <i class="fa-solid fa-brain text-purple-400"></i>
                </div>
                
                <div class="relative h-[280px] w-full flex items-center justify-center">
                    <canvas id="chart-psych"></canvas>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="premium-panel p-4 rounded-xl relative overflow-hidden">
                    <div class="relative z-10">
                        <span class="text-[10px] opacity-50 font-bold uppercase">Impulsivity</span>
                        <div class="flex items-end gap-2 mt-1">
                            <span class="text-2xl font-black">${Math.round((1 - (p.calm?.value || 0.5)) * 100)}%</span>
                            <span class="text-[10px] opacity-50 mb-1">Risk Factor</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-bolt absolute -bottom-2 -right-2 text-6xl opacity-10"></i>
                </div>

                <div class="premium-panel p-4 rounded-xl relative overflow-hidden">
                    <div class="relative z-10">
                        <span class="text-[10px] opacity-50 font-bold uppercase">Stamina</span>
                        <div class="flex items-end gap-2 mt-1">
                            <span class="text-2xl font-black">${Math.round((p.endurance?.value || 0.5) * 100)}%</span>
                            <span class="text-[10px] opacity-50 mb-1">Battery</span>
                        </div>
                    </div>
                    <i class="fa-solid fa-battery-full absolute -bottom-2 -right-2 text-6xl opacity-10"></i>
                </div>
            </div>

            <div class="premium-card p-4">
                <div class="mb-4">
                    <h3 class="text-xs font-bold uppercase">Focus Retention</h3>
                    <p class="text-[10px] opacity-50">Accuracy drop-off over quiz duration</p>
                </div>
                <div class="h-[150px] w-full">
                    <canvas id="chart-stamina"></canvas>
                </div>
            </div>
        `;

        // 3. Init Charts
        requestAnimationFrame(() => {
            this._initPsychChart(labels, dataValues);
            this._initStaminaChart(); // Uses mock curve for MVP
        });
    },

    _initPsychChart(labels, data) {
        const ctx = document.getElementById('chart-psych');
        if (!ctx) return;

        this.state.charts.psych = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        'rgba(59, 130, 246, 0.5)',  // Blue (Focus)
                        'rgba(16, 185, 129, 0.5)',  // Emerald (Calm)
                        'rgba(245, 158, 11, 0.5)',  // Amber (Speed)
                        'rgba(139, 92, 246, 0.5)',  // Purple (Precision)
                        'rgba(244, 63, 94, 0.5)',   // Rose (Risk)
                        'rgba(14, 165, 233, 0.5)',  // Sky (Endurance)
                        'rgba(236, 72, 153, 0.5)'   // Pink (Flexibility)
                    ],
                    borderWidth: 0, // Cleaner look
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { display: false, backdropColor: 'transparent' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#94a3b8',
                            font: { size: 10 },
                            boxWidth: 8
                        }
                    }
                }
            }
        });
    },

    _initStaminaChart() {
        const ctx = document.getElementById('chart-stamina');
        if (!ctx) return;

        // Mock data representing typical user fall-off
        const labels = ['0m', '5m', '10m', '15m', '20m', '25m'];
        const data = [100, 95, 92, 85, 70, 65]; // E.g., user gets tired

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 150);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');

        this.state.charts.stamina = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Focus Level',
                    data: data,
                    borderColor: '#10b981', // Emerald
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4, // Smooth curve
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 9 } } },
                    y: { display: false, min: 0, max: 110 }
                }
            }
        });
    },

    // ============================================================
    // 6. VIEW: TIMELINE (HISTORY & CONSISTENCY)
    // ============================================================

    _renderTimeline(parent) {
        // 1. Inject Layout
        // REFACTOR: Replaced glass-card/glass-panel with premium-card/premium-panel
        parent.innerHTML = `
            <div class="premium-card p-4 mb-6">
                <div class="flex justify-between items-center mb-4 px-2">
                    <div>
                        <h3 class="text-sm font-bold uppercase tracking-wider">The Ascent</h3>
                        <p class="text-[10px] opacity-50">Score progression over last 30 days</p>
                    </div>
                    <i class="fa-solid fa-arrow-trend-up text-emerald-400"></i>
                </div>
                
                <div class="relative h-[250px] w-full">
                    <canvas id="chart-history"></canvas>
                </div>
            </div>

            <div class="premium-panel p-5 rounded-2xl mb-6">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xs font-bold opacity-80 uppercase">Consistency Streak</h3>
                    <span class="text-[10px] font-mono opacity-50">Last 28 Days</span>
                </div>
                
                <div id="heatmap-grid" class="grid grid-cols-7 gap-2">
                    </div>

                <div class="flex justify-between items-center mt-4 text-[10px] opacity-50 font-bold uppercase">
                    <span>Less</span>
                    <div class="flex gap-1">
                        <div class="w-3 h-3 rounded bg-white/5"></div>
                        <div class="w-3 h-3 rounded bg-blue-900"></div>
                        <div class="w-3 h-3 rounded bg-blue-600"></div>
                        <div class="w-3 h-3 rounded bg-blue-400"></div>
                    </div>
                    <span>More</span>
                </div>
            </div>
        `;

        // 2. Init Charts & Grid
        requestAnimationFrame(() => {
            this._initHistoryChart();
            this._renderHeatmap();
        });
    },

    _initHistoryChart() {
        const ctx = document.getElementById('chart-history');
        if (!ctx) return;

        const labels = Array.from({length: 10}, (_, i) => `Day ${i+1}`);
        const data = [30, 35, 32, 45, 50, 48, 60, 65, 70, 75]; // Simulated growth

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        this.state.charts.history = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Avg Score',
                    data: data,
                    borderColor: '#3b82f6', // Blue-500
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 3,
                    pointBackgroundColor: '#1e293b',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { 
                        display: true, 
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#64748b', font: { size: 9 } }
                    }
                }
            }
        });
    },

    _renderHeatmap() {
        const grid = document.getElementById('heatmap-grid');
        if (!grid) return;

        // Generate 28 days of activity (4 weeks)
        // Mock logic: Random activity levels
        let html = '';
        for (let i = 0; i < 28; i++) {
            const activityLevel = Math.floor(Math.random() * 4); // 0 to 3
            
            let colorClass = 'bg-white/5 border-white/5'; // Default empty
            if (activityLevel === 1) colorClass = 'bg-blue-900 border-blue-800'; // Low
            if (activityLevel === 2) colorClass = 'bg-blue-600 border-blue-500 shadow-[0_0_5px_rgba(37,99,235,0.5)]'; // Med
            if (activityLevel === 3) colorClass = 'bg-blue-400 border-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.8)]'; // High

            // Tooltip via title attr
            html += `<div class="aspect-square rounded-md border border-opacity-20 ${colorClass} transition-all hover:scale-110" title="Day ${i+1}: ${activityLevel} sessions"></div>`;
        }
        grid.innerHTML = html;
    }
};

window.UIStats = UIStats;

