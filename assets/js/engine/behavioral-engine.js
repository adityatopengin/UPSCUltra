/**
 * BEHAVIORAL ENGINE (THE PSYCHOLOGIST)
 * Version: 2.0.0
 * Path: assets/js/engine/behavioral-engine.js
 * Responsibilities:
 * 1. Maintains the 7-Dimensional User Profile (Focus, Calm, Risk, etc.).
 * 2. Analyzes raw telemetry (clicks, time) to infer personality traits.
 * 3. Integrates with 'Fun Games' (Active Signals) and 'Quizzes' (Passive Signals).
 */

import { DB } from '../services/db.js';

export const BehavioralEngine = {
    // ============================================================
    // 1. THE 7-DIMENSIONAL PROFILE (The "Soul")
    // ============================================================
    // All values are normalized (0.0 to 1.0).
    // 'confidence' (0-1) represents statistical significance (sample size).
    profile: {
        // 1. CONSCIENTIOUSNESS
        focus: { value: 0.5, confidence: 0.0 }, 
        
        // 2. NEUROTICISM / STABILITY
        calm: { value: 0.5, confidence: 0.0 },
        
        // 3. RISK APPETITE
        risk: { value: 0.5, confidence: 0.0 },
        
        // 4. COGNITIVE SPEED
        speed: { value: 0.5, confidence: 0.0 },
        
        // 5. METACOGNITION
        precision: { value: 0.5, confidence: 0.0 },
        
        // 6. STAMINA (NEW) - Performance degradation over time
        endurance: { value: 0.5, confidence: 0.0 },
        
        // 7. ADAPTABILITY (NEW) - Recovery from difficulty spikes
        flexibility: { value: 0.5, confidence: 0.0 },

        // Metadata for Time-Decay calculations
        lastUpdate: Date.now(),
        totalSessions: 0,
        userId: 'user_1' // Default ID for single-user local app
    },

    // ============================================================
    // 2. TUNING CONSTANTS (The "Math")
    // ============================================================
    CONSTANTS: {
        // Learning Rate: How fast does the profile change?
        // 0.05 = Very Stable (Takes 20 tests to shift significantly)
        // 0.20 = Volatile (Shifts heavily after 1 test)
        LEARNING_RATE_PASSIVE: 0.15, // Quizzes (Real data)
        LEARNING_RATE_ACTIVE: 0.08,  // Games (Simulation data)

        // Decay Factor: How much does old behavior "fade" per day?
        // 0.99 = Memories last forever. 0.90 = Memories fade fast.
        TIME_DECAY_DAILY: 0.98,

        // Thresholds for "Analysis"
        IMPULSE_THRESHOLD_MS: 1500, // < 1.5s on a text question is an impulse
        FATIGUE_DROP_OFF: 0.15,     // 15% accuracy drop implies fatigue
        PANIC_SWITCH_COUNT: 2       // Changing answer >2 times implies panic
    },

    // ============================================================
    // 3. INITIALIZATION & PERSISTENCE
    // ============================================================

    async init() {
        console.log("🧠 BehavioralEngine: Initializing Neural Core...");
        
        try {
            await this._loadProfile();
            await this._applyTimeDecay(); // Fade old memories on startup
            console.log("🧠 BehavioralEngine: Online.");
        } catch (e) {
            console.warn("🧠 BehavioralEngine: Init failed (using defaults).", e);
        }
    },

    /**
     * Internal: Load profile from IndexedDB
     */
    async _loadProfile() {
        // We fetch the profile for 'user_1'
        const saved = await DB.get('profiles', this.profile.userId);
        
        if (saved) {
            // Merge saved data with default structure (migration safety)
            // This ensures if we add new traits later, the app won't crash
            this.profile = { ...this.profile, ...saved };
            console.log("🧠 Profile Loaded. Confidence:", this._getAverageConfidence().toFixed(2));
        } else {
            console.log("🧠 New User Profile Created.");
            this._saveProfile(); // Save the default immediately
        }
    },

    /**
     * Internal: Save profile to IndexedDB
     */
    async _saveProfile() {
        this.profile.lastUpdate = Date.now();
        await DB.put('profiles', this.profile);
    },

    /**
     * Internal: Apply Time Decay
     * If user hasn't played in 10 days, their 'Confidence' drops.
     * This ensures the engine doesn't rely on stale data.
     */
    async _applyTimeDecay() {
        const now = Date.now();
        const lastUpdate = this.profile.lastUpdate || now;
        const diffDays = (now - lastUpdate) / (1000 * 60 * 60 * 24);
        
        // Only decay if > 1 day has passed
        if (diffDays > 1) {
            const decayFactor = Math.pow(this.CONSTANTS.TIME_DECAY_DAILY, diffDays);
            
            // Decay confidence for all traits
            Object.keys(this.profile).forEach(key => {
                // Check if the key is a trait object (has .confidence)
                if (this.profile[key] && typeof this.profile[key].confidence === 'number') {
                    this.profile[key].confidence *= decayFactor;
                }
            });
            
            console.log(`🧠 Applied Time Decay: ${diffDays.toFixed(1)} days (Factor: ${decayFactor.toFixed(3)})`);
            await this._saveProfile();
        }
    },

    /**
     * Helper: Get overall reliability of the profile
     */
    _getAverageConfidence() {
        const keys = ['focus', 'calm', 'risk', 'speed', 'precision', 'endurance', 'flexibility'];
        const sum = keys.reduce((acc, k) => acc + (this.profile[k]?.confidence || 0), 0);
        return sum / keys.length;
    },
    // ============================================================
    // 4. SIGNAL PROCESSING: PASSIVE TELEMETRY (From Quizzes)
    // ============================================================

    /**
     * The Heavy Lifter. Converts raw quiz clicks into Psychological Traits.
     * @param {Object} telemetry - { impulseClicks, switches, timePerQuestion[], sequence }
     * @param {Object} result - { accuracy, totalMarks, wrong, skipped, questions[] }
     */
    async processQuizTelemetry(telemetry, result) {
        console.log("🧠 BehavioralEngine: Analyzing Passive Signals...");
        
        // Safety Check
        if (!telemetry || !result) return;

        const count = result.questions ? result.questions.length : (result.totalMarks / 2); // Approx count if data missing
        if (count === 0) return;

        // --- 1. CALCULATE FOCUS (Conscientiousness) ---
        // Logic: High switches + impulse clicks = Low Focus / Fidgety
        const impulseRate = telemetry.impulseClicks / count; 
        
        // Sum total switches across all questions
        const totalSwitches = Object.values(telemetry.switches).reduce((a, b) => a + b, 0);
        const switchRate = totalSwitches / count;
        
        // Formula: Start at 1.0, subtract for erratic behavior
        // If you switch answers on every question, your focus score drops heavily.
        const rawFocus = Math.max(0, 1.0 - (impulseRate * 0.5) - (switchRate * 0.2));


        // --- 2. CALCULATE ENDURANCE (Stamina) ---
        // Logic: Compare accuracy of First 25% vs Last 25% of the test.
        let rawEndurance = 0.5; // Default neutral
        
        if (result.questions && result.questions.length >= 8) {
            const quarter = Math.floor(result.questions.length / 4);
            
            // Get IDs for start and end segments based on the original order
            // We assume result.questions is ordered. If shuffled, we rely on the index.
            const firstQuarterQs = result.questions.slice(0, quarter);
            const lastQuarterQs = result.questions.slice(-quarter);
            
            // Count mistakes in these segments
            // We look at the 'wrong' count derived from the engine's checking logic
            // (Engine needs to pass detailed correctness data, or we infer from answers)
            const firstMistakes = firstQuarterQs.filter(q => !q.isCorrect).length;
            const lastMistakes = lastQuarterQs.filter(q => !q.isCorrect).length;
            
            // Normalization
            if (lastMistakes > firstMistakes + 1) {
                rawEndurance = 0.3; // Fatigued (Performance dropped at the end)
            } else if (lastMistakes < firstMistakes) {
                rawEndurance = 0.8; // Warm-up effect (Strong finisher)
            } else {
                rawEndurance = 0.6; // Steady
            }
        }


        // --- 3. CALCULATE RISK (Risk Appetite) ---
        // Logic: Skips vs Wrongs. 
        // High Skips = Risk Averse (Low score). High Wrongs = High Risk (Gunslinger).
        const skipRate = result.skipped / count;
        const wrongRate = result.wrong / count;
        
        let rawRisk = 0.5;
        if (skipRate > 0.4) rawRisk = 0.2; // Very safe player (Leaves anything doubtful)
        else if (wrongRate > 0.4 && skipRate < 0.1) rawRisk = 0.8; // Reckless (Guesses everything)
        else rawRisk = 0.5; // Balanced


        // --- 4. CALCULATE CALM (Neuroticism) ---
        // Logic: "The Panic Spiral". Did mistakes happen in clusters?
        // Proxy: High 'switches' specifically on Wrong answers.
        // "I changed my answer 3 times and still got it wrong" -> High Anxiety.
        
        let anxiousWrongs = 0;
        if (result.wrong > 0) {
            // Calculate how many switches happened on questions that ended up wrong
            // We iterate through the telemetry.switches map
            Object.keys(telemetry.switches).forEach(qId => {
                // Find if this qId was wrong
                // (Depends on result structure, assuming we can check this)
                const q = result.questions.find(item => item.id == qId); // loose equality for string/int IDs
                if (q && !q.isCorrect) {
                    anxiousWrongs += telemetry.switches[qId];
                }
            });
            
            // Normalize per wrong answer
            anxiousWrongs = anxiousWrongs / result.wrong;
        }

        const rawCalm = Math.max(0, 1.0 - (anxiousWrongs * 0.15));


        // --- 5. CALCULATE SPEED (Cognitive Processing) ---
        // Simple avg time normalized
        // 10s per Q = Fast (1.0), 120s per Q = Slow (0.0)
        const avgTimeMs = (result.totalDuration * 1000) / count;
        const rawSpeed = this._normalizeTime(avgTimeMs);


        // --- UPDATE THE PROFILE ---
        this._updateTrait('focus', rawFocus, 'PASSIVE');
        this._updateTrait('endurance', rawEndurance, 'PASSIVE');
        this._updateTrait('risk', rawRisk, 'PASSIVE');
        this._updateTrait('calm', rawCalm, 'PASSIVE');
        this._updateTrait('speed', rawSpeed, 'PASSIVE');

        // Increment session count and save
        this.profile.totalSessions++;
        await this._saveProfile();
    },

    /**
     * Helper to map milliseconds to a 0.0-1.0 score
     */
    _normalizeTime(ms) {
        const min = 10000;  // 10s (Fastest expected average)
        const max = 120000; // 2 mins (Slowest expected average)
        
        // Clamp input
        const clamped = Math.max(min, Math.min(ms, max));
        
        // Invert: Lower time = Higher speed score
        return 1.0 - ((clamped - min) / (max - min));
    },
    // ============================================================
    // 5. SIGNAL PROCESSING: ACTIVE TELEMETRY (From Arcade)
    // ============================================================

    /**
     * Updates profile based on "Fun Games".
     * Games are high-intensity but simulated environments, so we use a different learning rate.
     */
    async processArcadeSignal(gameType, data) {
        console.log(`🧠 Analyzing Active Signal: ${gameType}`);
        
        // Data format: { score: 0-1, metrics: { recoveryRate, riskFactor, etc. } }

        switch(gameType) {
            case 'BLINK_TEST': // Vigilance Game
                this._updateTrait('focus', data.score, 'ACTIVE');
                if (data.metrics?.recoveryRate) {
                    this._updateTrait('flexibility', data.metrics.recoveryRate, 'ACTIVE');
                }
                break;

            case 'PRESSURE_VALVE': // Stress Management Game
                this._updateTrait('calm', data.score, 'ACTIVE');
                if (data.metrics?.reactionTime) {
                    // Convert ms to speed score (reuse normalize helper)
                    const speedScore = this._normalizeTime(data.metrics.reactionTime);
                    this._updateTrait('speed', speedScore, 'ACTIVE');
                }
                break;
                
            case 'BALLOON_POP': // Risk Assessment Game
                if (data.metrics?.riskFactor) {
                    this._updateTrait('risk', data.metrics.riskFactor, 'ACTIVE');
                }
                break;
                
            case 'PATTERN_ARCHITECT': // Fluid IQ Game
                this._updateTrait('precision', data.score, 'ACTIVE');
                if (data.metrics?.adaptability) {
                    this._updateTrait('flexibility', data.metrics.adaptability, 'ACTIVE');
                }
                break;
        }

        await this._saveProfile();
    },

    // ============================================================
    // 6. INTERNAL BRAIN: BAYESIAN UPDATE LOGIC
    // ============================================================

    /**
     * Updates a trait using a Weighted Moving Average relative to Confidence.
     * @param {String} trait - 'focus', 'calm', etc.
     * @param {Number} signalValue - The new data point (0.0 to 1.0)
     * @param {String} source - 'PASSIVE' or 'ACTIVE'
     */
    _updateTrait(trait, signalValue, source) {
        if (!this.profile[trait]) return;

        const current = this.profile[trait];
        
        // Dynamic Learning Rate
        // If confidence is low, we learn fast (volatile).
        // If confidence is high, we learn slow (stable).
        // 0.05 (Base) * (1 - 0.8) = 0.01 (Very slow update for established users)
        const baseRate = this.CONSTANTS[`LEARNING_RATE_${source}`] || 0.1;
        const stabilityFactor = 1.0 - (current.confidence * 0.5); // Reduces rate by up to 50%
        const effectiveRate = baseRate * stabilityFactor;

        // The Update Formula: NewValue = OldValue + (Difference * EffectiveRate)
        const newValue = current.value + ((signalValue - current.value) * effectiveRate);
        
        // Update Value (Round to 3 decimals for storage efficiency)
        this.profile[trait].value = parseFloat(newValue.toFixed(3));
        
        // Update Confidence (Diminishing returns)
        // It's easy to get to 0.8, hard to get to 1.0
        // Formula: NewConf = OldConf + (0.05 * RemainingDistance)
        const confidenceGrowth = 0.05 * (1.0 - current.confidence);
        this.profile[trait].confidence = Math.min(1.0, current.confidence + confidenceGrowth);

        console.log(`🧠 Trait [${trait.toUpperCase()}] Updated: ${current.value.toFixed(2)} -> ${this.profile[trait].value} (Conf: ${this.profile[trait].confidence.toFixed(2)})`);
    },

    // ============================================================
    // 7. THE ORACLE INTERFACE (External API)
    // ============================================================

    /**
     * Called by MasterAggregator.js to refine prediction simulations.
     * Returns multipliers that "warp" the academic score.
     */
    getPredictionModifiers() {
        const p = this.profile;

        // 1. SILLY MISTAKE FACTOR (Focus + Precision)
        // Low focus = High penalty. (e.g. 0.92 multiplier)
        const sillyMistakeMod = 0.92 + (p.focus.value * 0.08) + (p.precision.value * 0.05);

        // 2. EXAM PANIC FACTOR (Calm + Flexibility)
        // Can they recover from a hard question?
        // < 0.4 Calm means they might crash (-12% score)
        const panicMod = p.calm.value < 0.4 ? 0.88 : 1.02;

        // 3. FATIGUE FACTOR (Endurance)
        // If endurance is low, penalize the last 20 questions in simulation.
        const fatigueMod = p.endurance.value < 0.5 ? 0.95 : 1.0;

        // 4. GUESSING FACTOR (Risk)
        // Normalized curve: 0.5 is optimal (1.0). 
        // 0.0 (Too safe) -> 0.98 (Missed marks)
        // 1.0 (Reckless) -> 0.90 (Negative marking disaster)
        let riskMod = 1.0;
        const risk = p.risk.value;
        if (risk < 0.3) riskMod = 0.98; // Too conservative
        else if (risk > 0.7) riskMod = 0.90; // Too risky
        else riskMod = 1.03; // Strategic guessing bonus

        return {
            sillyMistakeMod: parseFloat(sillyMistakeMod.toFixed(3)),
            panicMod: parseFloat(panicMod.toFixed(3)),
            fatigueMod: parseFloat(fatigueMod.toFixed(3)),
            riskMod: parseFloat(riskMod.toFixed(3))
        };
    },

    /**
     * Returns a human-readable "Archetype" for the UI.
     * Used in the "Profile" or "Stats" page.
     */
    getUserArchetype() {
        const p = this.profile;
        if (p.risk.value > 0.7 && p.calm.value > 0.7) return "The Maverick";
        if (p.focus.value > 0.8 && p.endurance.value > 0.8) return "The Marathon Runner";
        if (p.precision.value > 0.8 && p.speed.value < 0.4) return "The Grandmaster";
        if (p.speed.value > 0.8 && p.precision.value < 0.4) return "The Gunslinger";
        if (p.calm.value < 0.3) return "The Nervous Rookie";
        return "The Aspirant"; // Default
    }
};
