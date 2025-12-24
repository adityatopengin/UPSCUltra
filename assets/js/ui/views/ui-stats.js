/**
 * UI-STATS (THE ANALYTICS HUB)
 * Version: 2.4.0 (Patched: Percentage Normalization)
 * Path: assets/js/ui/views/ui-stats.js
 * Responsibilities:
 * 1. Visualizes Academic & Behavioral Data.
 * 2. Dynamically loads Chart.js (performance optimization).
 * 3. Implements the "Tri-View" Strategy (Overview, Psych, Timeline).
 * 4. Fetches raw history from DB for accurate trend analysis.
 */

import { BehavioralEngine } from '../../engine/behavioral-engine.js';
import { AcademicEngine } from '../../engine/academic-engine.js';
import { UI } from '../ui-manager.js';
import { DB } from '../../services/db.js';

export const UIStats = {
    // ============================================================
    // 1. STATE & CONFIG
    // ============================================================
    state: {
        activeTab: 'overview', // 'overview' | 'psych' | 'timeline'
        chartLibLoaded: false,
        charts: {}, // Store instances to destroy them properly
        historyData: [] // Cache for history records
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
        container.className = 'view-container pb-40 min-h-screen';

        // 1. Show Loading Skeleton
        container.innerHTML = this._getSkeletonTemplate();

        // 2. Load Dependencies in Parallel (Chart.js + DB Data)
        try {
            const [_, history] = await Promise.all([
                this._loadChartJs(),
                DB.getAll('history')
            ]);
            
            this.state.chartLibLoaded = true;
            this.state.historyData = history || []; 
            
        } catch (e) {
            if (window.UI) UI.showToast("Failed to load Analytics Engine", "error");
            console.error(e);
            return;
        }

        // 3. Render Full UI
        this._renderShell(container);
    },

    // Memory Leak Prevention
    onUnmount() {
        console.log("📈 UIStats: Cleaning up charts...");
        this._destroyAllCharts();
        this.state.historyData = [];
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

    _loadChartJs() {
        return new Promise((resolve, reject) => {
            if (window.Chart) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = this.config.chartJsUrl;
            script.onload = () => {
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
        const avg = (AcademicEngine.getGlobalMastery) ? AcademicEngine.getGlobalMastery() : 0;
        if (avg > 90) return 'ELITE';
        if (avg > 75) return 'VETERAN';
        if (avg > 50) return 'ROOKIE';
        return 'NOVICE';
    },

    switchTab(tabName) {
        this.state.activeTab = tabName;
        
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

        const content = document.getElementById('stats-content');
        if (content) {
            content.innerHTML = '';
            this._destroyAllCharts();

            if (tabName === 'overview') this._renderOverview(content);
            else if (tabName === 'psych') this._renderPsych(content);
            else if (tabName === 'timeline') this._renderTimeline(content);
        }
    },

    // ============================================================
    // 4. VIEW: OVERVIEW (RADAR & DECAY)
    // ============================================================

    _renderOverview(parent) {
        const subjects = (AcademicEngine.state && AcademicEngine.state.mastery) ? AcademicEngine.state.mastery : {}; 
        const labels = Object.keys(subjects).map(s => s.charAt(0).toUpperCase() + s.slice(1));
        const dataPoints = Object.values(subjects).map(s => s.mastery || s.score || 0);

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
                    
                    <div id="decay-list" class="space-y-4"></div>
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

        requestAnimationFrame(() => {
            this._initRadarChart(labels, dataPoints);
            this._renderDecayList(subjects);
        });
    },

    _initRadarChart(labels, data) {
        const ctx = document.getElementById('chart-radar');
        if (!ctx) return;

        const gradient = ctx.getContext('2d').createRadialGradient(150, 150, 0, 150, 150, 150);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.1)');

        const safeLabels = labels.length ? labels : ['Polity', 'History', 'Geog', 'Econ', 'Env'];
        const safeData = data.length ? data : [0, 0, 0, 0, 0];

        this.state.charts.radar = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: safeLabels,
                datasets: [{
                    label: 'Current Mastery',
                    data: safeData,
                    backgroundColor: gradient,
                    borderColor: '#60a5fa',
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
                            color: '#cbd5e1',
                            font: { size: 10, family: 'Inter', weight: 'bold' }
                        },
                        ticks: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        callbacks: { label: (ctx) => `Mastery: ${ctx.raw}%` }
                    }
                }
            }
        });
    },

    _renderDecayList(subjects) {
        const container = document.getElementById('decay-list');
        if (!container) return;

        const sorted = Object.entries(subjects)
            .sort(([, a], [, b]) => (a.mastery || 0) - (b.mastery || 0))
            .slice(0, 3);

        if (sorted.length === 0) {
            container.innerHTML = `<div class="text-xs opacity-50 italic text-center py-2">No data yet. Start studying!</div>`;
            return;
        }

        container.innerHTML = sorted.map(([key, data]) => {
            const name = key.charAt(0).toUpperCase() + key.slice(1);
            const score = Math.round(data.mastery || 0);
            
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
                    <p class="text-[10px] opacity-50">Estimated accuracy drop-off (Derived from Endurance)</p>
                </div>
                <div class="h-[150px] w-full">
                    <canvas id="chart-stamina"></canvas>
                </div>
            </div>
        `;

        requestAnimationFrame(() => {
            this._initPsychChart(labels, dataValues);
            this._initStaminaChart(p.endurance?.value || 0.5); 
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
                        'rgba(59, 130, 246, 0.5)',
                        'rgba(16, 185, 129, 0.5)',
                        'rgba(245, 158, 11, 0.5)',
                        'rgba(139, 92, 246, 0.5)',
                        'rgba(244, 63, 94, 0.5)',
                        'rgba(14, 165, 233, 0.5)',
                        'rgba(236, 72, 153, 0.5)'
                    ],
                    borderWidth: 0,
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
                        labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 8 }
                    }
                }
            }
        });
    },

    _initStaminaChart(enduranceScore) {
        const ctx = document.getElementById('chart-stamina');
        if (!ctx) return;

        const labels = ['0m', '10m', '20m', '30m', '45m', '60m'];
        const startFocus = 100;
        const decayFactor = 1.0 - enduranceScore; 
        const data = labels.map((_, i) => {
            const drop = (i * 10) * decayFactor; 
            return Math.max(40, startFocus - drop);
        });

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
                    borderColor: '#10b981',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
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
        parent.innerHTML = `
            <div class="premium-card p-4 mb-6">
                <div class="flex justify-between items-center mb-4 px-2">
                    <div>
                        <h3 class="text-sm font-bold uppercase tracking-wider">The Ascent</h3>
                        <p class="text-[10px] opacity-50">Score progression (%)</p>
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
                
                <div id="heatmap-grid" class="grid grid-cols-7 gap-2"></div>

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

        requestAnimationFrame(() => {
            this._initHistoryChart();
            this._renderHeatmap();
        });
    },

    _initHistoryChart() {
        const ctx = document.getElementById('chart-history');
        if (!ctx) return;

        const sortedHistory = [...this.state.historyData]
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-20); 

        let labels, data;

        if (sortedHistory.length === 0) {
            labels = ['Start'];
            data = [0];
        } else {
            labels = sortedHistory.map(h => new Date(h.timestamp).toLocaleDateString(undefined, {month:'short', day:'numeric'}));
            // 🛡️ FIX: Normalized to Percentage to prevent zig-zag between Mock (200) and Practice (30)
            data = sortedHistory.map(h => {
                const total = h.totalMarks || 30; // Fallback to 30 if missing
                return Math.round((h.score / total) * 100);
            });
        }

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 250);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        this.state.charts.history = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Score %',
                    data: data,
                    borderColor: '#3b82f6',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.3,
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
                        min: 0, 
                        max: 100, // Fixed 0-100 scale
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

        const activityMap = {};
        this.state.historyData.forEach(h => {
            const dateKey = new Date(h.timestamp).toISOString().split('T')[0];
            activityMap[dateKey] = (activityMap[dateKey] || 0) + 1;
        });

        let html = '';
        const today = new Date();
        
        for (let i = 27; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            const count = activityMap[key] || 0;

            let colorClass = 'bg-white/5 border-white/5';
            if (count >= 1) colorClass = 'bg-blue-900 border-blue-800';
            if (count >= 3) colorClass = 'bg-blue-600 border-blue-500 shadow-[0_0_5px_rgba(37,99,235,0.5)]';
            if (count >= 5) colorClass = 'bg-blue-400 border-blue-300 shadow-[0_0_10px_rgba(96,165,250,0.8)]';

            html += `<div class="aspect-square rounded-md border border-opacity-20 ${colorClass} transition-all hover:scale-110" title="${key}: ${count} quizzes"></div>`;
        }
        grid.innerHTML = html;
    }
};

window.UIStats = UIStats;

