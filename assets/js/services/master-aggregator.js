/**
 * MASTER AGGREGATOR (THE MANAGER)
 * Version: 2.0.0
 * Path: assets/js/services/master-aggregator.js
 * Responsibilities:
 * 1. Orchestrates the "Handshake" between UI and Background Workers.
 * 2. Fetches raw data from IndexedDB (DB.js).
 * 3. Caches predictions to prevent CPU waste.
 */

import { DB } from './db.js';

export const MasterAggregator = {
    
    // ============================================================
    // 1. CONFIGURATION & STATE
    // ============================================================
    
    worker: null,           // The background thread instance
    isCalculating: false,   // Flag to prevent double-triggering
    
    // The "Ground Truth" configuration for the Ensemble Model
    config: {
        simulationRuns: 500, // LHS allows us to use 500 instead of 10,000 for speed
        models: {
            monteCarlo: { weight: 0.50 }, // The Stress Tester
            bayesian:   { weight: 0.30 }, // The Uncertainty Mapper
            xgboost:    { weight: 0.20 }  // The Pattern Recognizer
        }
    },

    // Cache system: We store the last input signature. 
    // If input hasn't changed, we return the cached output instantly.
    lastPrediction: null,
    lastDataSignature: "",
    
    // Promise resolver for the pending worker request
    _pendingResolve: null, 

    // ============================================================
    // 2. INITIALIZATION (WORKER SETUP)
    // ============================================================

    init() {
        console.log("🔮 MasterAggregator: Initializing Oracle System...");

        if (this.worker) return; // Already initialized

        if (window.Worker) {
            try {
                // Spawning the Background Worker (The Heavy Lifter)
                this.worker = new Worker('assets/js/workers/oracle.worker.js');
                
                // Set up the listener for when the Worker finishes
                this.worker.onmessage = (e) => this._handleWorkerResponse(e);
                
                // Error handling
                this.worker.onerror = (err) => {
                    console.error("🔮 OracleWorker Error:", err);
                    this.isCalculating = false;
                };

                // Optional: Send a PING to warm it up
                this.worker.postMessage({ command: 'PING' });

                console.log("🔮 OracleWorker Spawned Successfully.");
            } catch (e) {
                console.warn("🔮 OracleWorker Failed. Will use Main Thread Fallback.", e);
            }
        } else {
            console.warn("🔮 Web Workers not supported in this browser.");
        }
    },

    // ============================================================
    // 3. PUBLIC API: GET PREDICTION
    // ============================================================

    /**
     * The Main Function called by your UI (UIHome / UIStats).
     * Returns a Promise that resolves with the Prediction Result.
     */
    async getPrediction() {
        // 1. Init if needed
        if (!this.worker) this.init();

        // 2. Prevent spamming
        if (this.isCalculating) {
            console.warn("🔮 Oracle is already thinking...");
            return null; 
        }

        // 3. Gather Data from the new DB Service
        const telemetry = await this._gatherTelemetry();
        
        // 4. Optimization: Check if data has changed since last time
        // We hash the input to see if it's identical to the previous run
        const currentSignature = JSON.stringify(telemetry);
        if (this.lastPrediction && this.lastDataSignature === currentSignature) {
            // console.log("🔮 Data unchanged. Returning cached prediction.");
            return this.lastPrediction;
        }

        this.isCalculating = true;
        this.lastDataSignature = currentSignature;

        // 5. Send to Worker
        return new Promise((resolve) => {
            
            if (this.worker) {
                // OFF-THREAD: Send data to the background worker
                this.worker.postMessage({
                    command: 'RUN_ENSEMBLE',
                    data: telemetry,
                    config: this.config
                });

                // Store the resolve function so we can call it when 'onmessage' fires
                this._pendingResolve = resolve;

            } else {
                // MAIN-THREAD FALLBACK (For older phones or error states)
                console.warn("🔮 Running simulation on Main Thread (Low Power Mode).");
                const fallbackResult = this._runFallbackSimulation(telemetry);
                this.isCalculating = false;
                resolve(fallbackResult);
            }
        });
    },
    // ============================================================
    // 4. DATA COLLECTION (THE INPUT LAYER)
    // ============================================================

    /**
     * Pulls the "Truth Vector" from IndexedDB.
     * This decouples the UI from the Engines. We read the raw state from the DB.
     */
    async _gatherTelemetry() {
        // A. Fetch Academic State (Mastery & Decay)
        // We get all subjects to build the full knowledge map.
        const academicState = {};
        const academicRaw = await DB.getAll('academic_state');
        
        if (academicRaw && academicRaw.length > 0) {
            academicRaw.forEach(item => {
                academicState[item.subjectId] = item;
            });
        } else {
            // Cold Start: No data yet. Worker will handle empty state.
            console.warn("🔮 Oracle: No academic data found. Using cold-start defaults.");
        }

        // B. Fetch Behavioral Profile (Psych Analysis)
        // We grab the current user's profile (defaulting to 'user_1' for now)
        let behavioralProfile = await DB.get('profiles', 'user_1');
        
        // If missing, use a safe default (The "Average Aspirant" profile)
        if (!behavioralProfile) {
            behavioralProfile = {
                focus: { value: 0.5 },
                risk: { value: 0.5 },
                calm: { value: 0.5 },
                sillyMistakeMod: 1.0,
                panicMod: 1.0
            };
        }

        // C. Meta Data for Pattern Recognition
        const historyCount = await DB.get('history', 'count') || 0; // Simplified count check
        
        return {
            academic: academicState,
            behavioral: behavioralProfile,
            meta: {
                totalTests: historyCount,
                daysToExam: this._getDaysToExam()
            }
        };
    },

    // ============================================================
    // 5. WORKER RESPONSE HANDLER
    // ============================================================

    _handleWorkerResponse(e) {
        const { status, result } = e.data;

        if (status === 'SUCCESS') {
            // console.log("🔮 Oracle Prediction Received:", result);
            this.lastPrediction = result;
            this.isCalculating = false;

            // Resolve the Promise waiting in getPrediction()
            if (this._pendingResolve) {
                this._pendingResolve(result);
                this._pendingResolve = null;
            }

            // Broadcast Event (Optional: For other UI components listening)
            window.dispatchEvent(new CustomEvent('oracle-update', { detail: result }));
        }
    },

    // ============================================================
    // 6. UI FORMATTERS (THE OUTPUT LAYER)
    // ============================================================

    /**
     * Converts the raw Oracle Result into chart-ready data.
     * Use this in UI_Oracle.js or UI_Home.js.
     */
    formatForDisplay(prediction) {
        if (!prediction) return null;

        const score = prediction.score;
        const flags = prediction.flags || [];

        // 1. CRITICAL CHECK: Did they fail CSAT?
        // If yes, we override the probability logic.
        if (flags.includes("CSAT_CRITICAL_FAIL")) {
            return {
                displayScore: score, // We still show the GS score
                probabilityText: "CSAT DISQUALIFIED",
                probabilityValue: 0,
                color: '#F44336', // Neon Red
                chartData: [],    // Flatline (No curve)
                warnings: ["CSAT Score < 66", ...flags]
            };
        }

        // 2. Determine Selection Probability (Based on 2024 Trends)
        let probability = 0;
        let color = '#F44336'; // Default Red

        if (score > 105) {
            probability = 95; color = '#00E676'; // Neon Green
        } else if (score > 98) {
            probability = 80; color = '#00E676';
        } else if (score > 88) {
            probability = 55; color = '#FFC107'; // Neon Amber
        } else if (score > 75) {
            probability = 25; color = '#FF5722'; // Deep Orange
        } else {
            probability = 10; color = '#F44336';
        }

        // 3. Generate "Probability Cloud" Data for Charts
        const bellCurveData = this._generateBellCurvePoints(score, prediction.range);

        return {
            displayScore: score,
            probabilityText: `${probability}% CHANCE`,
            probabilityValue: probability,
            color: color,
            chartData: bellCurveData,
            warnings: flags
        };
    },

    /**
     * Generates XY points to draw a Bell Curve around the predicted score.
     */
    _generateBellCurvePoints(mean, range) {
        const points = [];
        // Standard Deviation estimation: (Max - Min) / 6 (covers 99.7% of data)
        const stdDev = Math.max(1, (range.max - range.min) / 6); 
        
        // Generate 20 points spanning -3 to +3 standard deviations
        for (let i = -3; i <= 3; i += 0.3) {
            const x = mean + (i * stdDev);
            
            // Gaussian Function: f(x)
            const exponent = -0.5 * Math.pow((x - mean) / stdDev, 2);
            const y = Math.exp(exponent); // Normalized height (0 to 1)
            
            points.push({ x: Math.round(x), y: y });
        }
        return points;
    },

    // ============================================================
    // 7. UTILITIES & FALLBACKS
    // ============================================================

    _getDaysToExam() {
        const examDate = new Date('2025-05-25'); // UPSC Prelims 2025
        const diff = examDate - new Date();
        return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    },

    /**
     * A lightweight simulation (Main Thread) for old devices/errors.
     */
    _runFallbackSimulation(data) {
        let totalScore = 0;
        const subjects = data.academic ? Object.values(data.academic) : [];
        
        // Simple linear projection
        subjects.forEach(sub => {
            totalScore += (sub.mastery || 0) * (sub.weight || 0) * 2;
        });

        return {
            score: Math.round(totalScore),
            range: { min: totalScore * 0.9, max: totalScore * 1.1 },
            confidence: 0.5,
            flags: ["LOW_POWER_MODE"], 
            breakdown: { mc: 0, bayesian: 0, pattern: 0 }
        };
    }
};
