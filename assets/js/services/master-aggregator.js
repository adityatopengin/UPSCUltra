/**
 * MASTER AGGREGATOR (THE MANAGER)
 * Version: 2.6.0 (Fix: Worker Integration & History Injection)
 * Path: assets/js/services/master-aggregator.js
 * Responsibilities:
 * 1. Spawns the background Oracle Worker.
 * 2. Gathers data from DB (Academic + Behavioral + History).
 * 3. Merges static config (Weights) with dynamic data.
 * 4. Sends data to Worker and dispatches predictions to UI.
 */

import { DB } from './db.js';
import { AcademicEngine } from '../engine/academic-engine.js';

export const MasterAggregator = {
    
    // ============================================================
    // 1. CONFIGURATION & STATE
    // ============================================================
    
    worker: null,
    isCalculating: false,
    _useFallbackMode: false, 
    
    config: {
        simulationRuns: 500,
        // Manual weights override (Optional - Worker handles this dynamically now)
        models: {
            monteCarlo: { weight: 0.50 },
            bayesian:   { weight: 0.30 },
            xgboost:    { weight: 0.20 }
        }
    },

    lastPrediction: null,
    lastDataSignature: "",
    _pendingResolve: null, 

    // ============================================================
    // 2. INITIALIZATION
    // ============================================================

    init() {
        console.log("🔮 MasterAggregator: Initializing Oracle System...");

        if (this.worker || this._useFallbackMode) return; 

        if (window.Worker) {
            try {
                // 🛡️ FIX: Relative Path is required for GitHub Pages & Sub-folders
                const workerPath = './assets/js/workers/oracle.worker.js'; 

                this.worker = new Worker(workerPath);
                
                // 🛡️ FIX: Bind context to ensure 'this' refers to MasterAggregator
                this.worker.onmessage = this._handleWorkerResponse.bind(this);
                
                this.worker.onerror = (err) => {
                    // Log the full error object to see the real cause
                    console.error("🔮 OracleWorker Critical Error (Main Thread):", err);
                    this.isCalculating = false;
                    // Only fallback if it's a genuine script load error
                    if (err.message && (err.message.includes('404') || err.message.includes('Script error'))) {
                        this._useFallbackMode = true; 
                    }
                };

                this.worker.postMessage({ command: 'PING' });
                console.log("🔮 OracleWorker Spawned Successfully.");

            } catch (e) {
                console.warn("🔮 OracleWorker path error. Using Fallback.", e);
                this._useFallbackMode = true;
            }
        } else {
            console.warn("🔮 Web Workers not supported. Using Fallback.");
            this._useFallbackMode = true;
        }
    },

    // ============================================================
    // 3. PUBLIC API
    // ============================================================

    async getPrediction() {
        if (!this.worker && !this._useFallbackMode) this.init();

        if (this.isCalculating) return null; 

        try {
            const telemetry = await this._gatherTelemetry();
            
            // Generate signature to prevent re-running on identical data
            // We include history length in signature now
            const currentSignature = JSON.stringify({
                ac: telemetry.academic,
                bh: telemetry.behavioral,
                histCount: telemetry.rawHistory ? telemetry.rawHistory.length : 0
            });

            if (this.lastPrediction && this.lastDataSignature === currentSignature) {
                return this.lastPrediction;
            }

            this.isCalculating = true;
            this.lastDataSignature = currentSignature;

            return new Promise((resolve) => {
                if (this.worker && !this._useFallbackMode) {
                    // 🚀 FIX: SEND HISTORY SEPARATELY
                    // The Worker V3.1.0 expects { command, data, history, config }
                    this.worker.postMessage({
                        command: 'RUN_ENSEMBLE',
                        data: telemetry, // Contains academic & behavioral
                        history: telemetry.rawHistory, // REQUIRED for "25 Exam" Rule
                        config: this.config
                    });
                    this._pendingResolve = resolve;
                } else {
                    console.log("🔮 Running Prediction on Main Thread (Fallback)...");
                    const fallbackResult = this._runFallbackSimulation(telemetry);
                    this.isCalculating = false;
                    this.lastPrediction = fallbackResult;
                    resolve(fallbackResult);
                }
            });
        } catch (e) {
            console.error("🔮 Prediction Failed:", e);
            this.isCalculating = false;
            return null;
        }
    },

    // ============================================================
    // 4. DATA COLLECTION
    // ============================================================

    async _gatherTelemetry() {
        const academicState = {};
        let fullHistory = [];
        
        try {
            await DB.connect();
            
            // 1. Get Academic Snapshot
            const academicRaw = await DB.getAll('academic_state');
            
            if (academicRaw && academicRaw.length > 0) {
                academicRaw.forEach(item => {
                    // 🛡️ FIX: Inject 'Weight' from AcademicEngine Config
                    const subjectConfig = AcademicEngine.SUBJECTS[item.subjectId];
                    const weight = subjectConfig ? subjectConfig.weight : 0.1;

                    academicState[item.subjectId] = {
                        ...item,
                        weight: weight,
                        // Ensure legacy 'score' is mapped to 'mastery' just in case
                        mastery: (item.mastery !== undefined) ? item.mastery : (item.score || 0)
                    };
                });
            }

            // 2. 🛡️ CRITICAL FIX: Get Full History for Worker Analysis
            // The worker needs the actual records to calculate 'historyDepth' and volatility.
            fullHistory = await DB.getAll('history');

        } catch (e) {
            console.warn("🔮 Oracle: Data fetch incomplete.", e);
        }

        // 3. Get Behavioral Profile
        let behavioralProfile = null;
        try {
            behavioralProfile = await DB.get('profiles', 'user_1');
        } catch (e) {}
        
        if (!behavioralProfile) {
            behavioralProfile = {
                focus: { value: 0.5 },
                risk: { value: 0.5 },
                calm: { value: 0.5 },
                sillyMistakeMod: 1.0,
                panicMod: 1.0
            };
        }
        
        return {
            academic: academicState,
            behavioral: behavioralProfile,
            rawHistory: fullHistory || [], // Passed to 'history' prop in postMessage
            meta: {
                totalTests: fullHistory ? fullHistory.length : 0,
                daysToExam: this._getDaysToExam()
            }
        };
    },

    // ============================================================
    // 5. WORKER RESPONSE
    // ============================================================

    _handleWorkerResponse(e) {
        // 🛡️ CRITICAL FIX: Flat Structure Handling
        // Worker V3.1.0 returns { status: 'SUCCESS', score: 145... } 
        // It is NOT nested inside a 'result' key anymore.
        const response = e.data;

        if (response.status === 'SUCCESS') {
            this.lastPrediction = response;
            this.isCalculating = false;

            if (this._pendingResolve) {
                this._pendingResolve(response);
                this._pendingResolve = null;
            }
            // Dispatch event for UI-Oracle to pick up
            window.dispatchEvent(new CustomEvent('oracle-update', { detail: response }));
            
        } else if (response.status === 'PONG') {
            console.log("🔮 Oracle Connection Verified.");
        } else {
            console.error("🔮 Oracle Worker Error:", response.message);
            this.isCalculating = false;
        }
    },

    // ============================================================
    // 6. UI FORMATTERS
    // ============================================================

    formatForDisplay(prediction) {
        if (!prediction) return null;

        const score = prediction.score;
        const flags = prediction.flags || [];

        if (flags.includes("CSAT_CRITICAL_FAIL")) {
            return {
                displayScore: score,
                probabilityText: "CSAT DISQUALIFIED",
                probabilityValue: 0,
                color: '#F44336',
                chartData: [],
                warnings: ["CSAT Score < 66", ...flags]
            };
        }

        let probability = 0;
        let color = '#F44336'; 

        if (score > 105) { probability = 95; color = '#00E676'; } 
        else if (score > 98) { probability = 80; color = '#00E676'; } 
        else if (score > 88) { probability = 55; color = '#FFC107'; } 
        else if (score > 75) { probability = 25; color = '#FF5722'; } 
        else { probability = 10; color = '#F44336'; }

        // Use Worker's calculated curve if available, otherwise generate simple one
        const bellCurveData = prediction.bellCurve || this._generateBellCurvePoints(score, prediction.range);

        return {
            displayScore: score,
            probabilityText: `${probability}% CHANCE`,
            probabilityValue: probability,
            color: color,
            chartData: bellCurveData,
            warnings: flags
        };
    },

    _generateBellCurvePoints(mean, range) {
        // Fallback generator if worker data is missing
        const points = [];
        const safeRange = range || { min: mean * 0.9, max: mean * 1.1 };
        const stdDev = Math.max(1, (safeRange.max - safeRange.min) / 6); 
        
        for (let i = -3; i <= 3; i += 0.3) {
            const x = mean + (i * stdDev);
            const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
            const y = Math.exp(exponent);
            points.push({ x: Math.round(x), y: y });
        }
        return points;
    },

    // ============================================================
    // 7. UTILITIES
    // ============================================================

    _getDaysToExam() {
        try {
            const examDate = new Date('2025-05-25');
            const diff = examDate - new Date();
            return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        } catch (e) {
            return 100;
        }
    },

    _runFallbackSimulation(data) {
        let totalScore = 0;
        const subjects = data.academic ? Object.values(data.academic) : [];
        
        subjects.forEach(sub => {
            // 🛡️ FIX: Use 'mastery' and 'weight' (both ensured by _gatherTelemetry)
            totalScore += (sub.mastery || 0) * (sub.weight || 0) * 2;
        });

        const safeScore = Math.max(0, Math.min(200, Math.round(totalScore)));

        return {
            score: safeScore,
            range: { min: safeScore * 0.85, max: safeScore * 1.15 },
            confidence: 0.5,
            flags: ["LOW_POWER_MODE"], 
            // Return dummy curve to prevent UI crash
            bellCurve: [ { x: safeScore - 10, y: 0.1 }, { x: safeScore, y: 1 }, { x: safeScore + 10, y: 0.1 } ]
        };
    }
};

