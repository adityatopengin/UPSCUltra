/**
 * ACADEMIC ENGINE (THE PROFESSOR)
 * Version: 2.0.0
 * Path: assets/js/engine/academic-engine.js
 * Responsibilities:
 * 1. Tracks Knowledge Mastery per subject.
 * 2. Applies "Forgetting Curve" (Time Decay) to scores.
 * 3. Identifies Blind Spots (ignored subjects) and Weaknesses.
 */

import { DB } from '../services/db.js';

export const AcademicEngine = {
    
    // ============================================================
    // 1. CONFIGURATION: THE SYLLABUS MAP
    // ============================================================
    
    // Taxonomy: Defines the "Weight" and "Volatility" of every subject.
    // weight: % of questions in real exam (approx).
    // decayRate: Daily loss of mastery (0.01 = 1% loss/day).
    // complexity: 'factual' (L1 heavy) or 'conceptual' (L3 heavy).
    
    SUBJECTS: {
        // --- GENERAL STUDIES (PAPER 1) ---
        'polity': { 
            name: "Indian Polity", 
            weight: 0.18, 
            decayRate: 0.015, // Medium decay (Concepts stick, Articles fade)
            complexity: 'conceptual' 
        },
        'history_modern': { 
            name: "Modern History", 
            weight: 0.10, 
            decayRate: 0.025, // High decay (Names/Years fade fast)
            complexity: 'factual' 
        },
        'history_ancient': { 
            name: "Ancient/Medieval", 
            weight: 0.05, 
            decayRate: 0.030, // Very High decay
            complexity: 'factual' 
        },
        'economy': { 
            name: "Economy", 
            weight: 0.14, 
            decayRate: 0.010, // Low decay (Logic sticks well)
            complexity: 'conceptual' 
        },
        'environment': { 
            name: "Environment & Ecology", 
            weight: 0.16, 
            decayRate: 0.020, // Medium (Mix of logic and species names)
            complexity: 'analytical' 
        },
        'geography': { 
            name: "Geography", 
            weight: 0.12, 
            decayRate: 0.012, 
            complexity: 'conceptual' 
        },
        'science': { 
            name: "Science & Tech", 
            weight: 0.08, 
            decayRate: 0.018, 
            complexity: 'dynamic' // Changes rapidly with current affairs
        },
        'current_affairs': { 
            name: "Current Affairs", 
            weight: 0.17, 
            decayRate: 0.040, // Extreme decay (Last month's news is useless)
            complexity: 'factual' 
        },

        // --- CSAT (PAPER 2) ---
        'csat_quant': { 
            name: "Quant (Math)", 
            weight: 0.40, // of Paper 2
            decayRate: 0.005, // Skills don't really decay, speed does
            complexity: 'analytical' 
        },
        'csat_logic': { 
            name: "Logical Reasoning", 
            weight: 0.25, 
            decayRate: 0.005, 
            complexity: 'analytical' 
        },
        'csat_rc': { 
            name: "Reading Comprehension", 
            weight: 0.35, 
            decayRate: 0.008, 
            complexity: 'inference' 
        }
    },

    // Difficulty Weights (The "Bouncer" Logic)
    // Multipliers for the weighted average score calculation.
    DIFFICULTY_WEIGHTS: {
        'L1': 1.0, // Direct Recall
        'L2': 1.5, // Conceptual Linkage
        'L3': 2.5  // Analytical / Applied / 'Bouncers'
    },

    // ============================================================
    // 2. STATE MANAGEMENT
    // ============================================================

    state: {
        // Subject-wise Mastery Vectors
        // Format: { subjectId: { score: 0-100, lastTested: timestamp, difficultyCeiling: 'L1' } }
        mastery: {}, 
        
        // The Blind Spot Matrix
        // Format: { subjectId: exposureDensity (0.0-1.0) }
        coverage: {},
        
        // Metadata
        totalTestsTaken: 0,
        lastAggregation: 0
    },

    // ============================================================
    // 3. INITIALIZATION & PERSISTENCE
    // ============================================================

    async init() {
        console.log("🎓 AcademicEngine: Initializing Syllabus Core...");
        
        try {
            await this._loadState();
            
            // Run specific checks on startup
            await this._checkKnowledgeDecay(); // "Erode" scores based on time away
            await this._calculateBlindSpots(); // Identify neglected subjects
            
            console.log("🎓 AcademicEngine: Online.");
        } catch (e) {
            console.error("🎓 AcademicEngine: Init failed.", e);
        }
    },

    async _loadState() {
        // Fetch all academic records from DB
        const savedRecords = await DB.getAll('academic_state');
        
        if (savedRecords && savedRecords.length > 0) {
            // Convert Array back to Object Map for easier lookup
            savedRecords.forEach(record => {
                this.state.mastery[record.subjectId] = record;
            });
            console.log("🎓 Academic History Loaded.");
        } else {
            console.log("🎓 Creating New Academic Profile.");
            await this._initializeEmptyState();
        }
    },

    async _initializeEmptyState() {
        const promises = [];

        // Create empty vectors for all subjects defined in config
        Object.keys(this.SUBJECTS).forEach(subId => {
            const emptyRecord = {
                subjectId: subId,
                score: 0,           // Current mastery (0-100)
                stability: 0,       // How consistent are they? (0-1)
                lastTested: 0,      // Timestamp
                attemptsL1: 0,      // Count of L1 Qs faced
                attemptsL3: 0,      // Count of L3 Qs faced (Bouncer Count)
                streak: 0           // Consecutive days studied
            };
            
            // Update local state
            this.state.mastery[subId] = emptyRecord;
            this.state.coverage[subId] = 0.0;
            
            // Queue DB write
            promises.push(DB.put('academic_state', emptyRecord));
        });

        await Promise.all(promises);
    },
    // ============================================================
    // 4. CORE LOGIC: PROCESSING RESULTS
    // ============================================================

    /**
     * The Main Entry Point. Called by QuizEngine when a user finishes a test.
     * @param {Object} result - Standard result object { score, accuracy, ... }
     * @param {Array} detailedQuestions - Array of question objects with 'userAnswer' attached
     */
    async processTestResult(result, detailedQuestions) {
        console.log("🎓 AcademicEngine: Processing Test Result...");

        // 1. Group questions by Subject (Crucial for full-length mocks mixing History & Polity)
        const subjectGroups = this._groupQuestionsBySubject(detailedQuestions);

        const dbUpdates = [];

        // 2. Process each subject individually
        for (const subId of Object.keys(subjectGroups)) {
            // Skip if subject not in our taxonomy (e.g. 'unknown')
            if (!this.SUBJECTS[subId]) continue;

            const subjectQs = subjectGroups[subId];
            
            // A. Calculate Weighted Mastery Index (WMI)
            // This accounts for L1 vs L3 difficulty
            const performance = this._calculateWMI(subjectQs);

            // B. Apply Decay to OLD data before merging NEW data
            // (We must erode the old score to 'today' before adding new knowledge)
            await this._applyDecayToSubject(subId);

            // C. Update the Mastery Vector (Bayesian Update)
            const updatedRecord = this._updateMasteryState(subId, performance);
            
            // Queue DB Save
            dbUpdates.push(DB.put('academic_state', updatedRecord));

            // D. Update Syllabus Coverage (Blind Spot Detection)
            await this._updateCoverage(subId, subjectQs);
        }

        // 3. Save Everything
        this.state.totalTestsTaken++;
        this.state.lastAggregation = Date.now();
        await Promise.all(dbUpdates);
        
        console.log("🎓 Knowledge Map Updated.");
    },

    /**
     * Helper: Groups questions so we can handle multi-subject tests
     */
    _groupQuestionsBySubject(questions) {
        const groups = {};
        questions.forEach(q => {
            // Fallback to 'polity' if subject tag missing (Safety net)
            const sub = q.subject || 'polity'; 
            if (!groups[sub]) groups[sub] = [];
            groups[sub].push(q); 
        });
        return groups;
    },

    /**
     * THE DIFFICULTY ALGORITHM
     * Calculates score based on L1 (1.0x), L2 (1.5x), L3 (2.5x) weights.
     * A user getting L3 questions right gets a much higher mastery score.
     */
    _calculateWMI(questions) {
        let totalWeightedScore = 0;
        let maxWeightedScore = 0;
        
        let l1Count = 0;
        let l3Count = 0; // Bouncer tracker

        questions.forEach(q => {
            // Default to L1 if level is missing
            const level = q.level || 'L1'; 
            const weight = this.DIFFICULTY_WEIGHTS[level] || 1.0;

            // Check correctness (QuizEngine attaches 'isCorrect' flag)
            if (q.isCorrect) {
                totalWeightedScore += (1 * weight);
            }
            maxWeightedScore += (1 * weight);

            // Stats tracking
            if (level === 'L1') l1Count++;
            if (level === 'L3') l3Count++;
        });

        // Avoid division by zero
        const finalWMI = maxWeightedScore === 0 ? 0 : (totalWeightedScore / maxWeightedScore) * 100;

        return {
            wmi: finalWMI,          // The "Real" Score (0-100)
            l1Count: l1Count,
            l3Count: l3Count,
            totalQs: questions.length
        };
    },

    /**
     * THE BAYESIAN UPDATE
     * Merges the new score with the old history to determine "True Mastery".
     */
    _updateMasteryState(subId, perf) {
        // Get current state from memory (loaded during init)
        const current = this.state.mastery[subId] || { 
            score: 0, stability: 0, attemptsL1: 0, attemptsL3: 0, streak: 0 
        };
        
        // 1. Calculate Confidence (Stability)
        // If we have very little data (attempts < 50), score is volatile.
        const totalAttempts = (current.attemptsL1 || 0) + (current.attemptsL3 || 0) + perf.totalQs;
        
        // 0.0 = Newbie (Volatile), 1.0 = Seasoned Veteran (Stable)
        const dataConfidence = Math.min(1.0, totalAttempts / 100); 

        // 2. Weighted Moving Average
        // If confidence is low, new score changes mastery FAST (High weight).
        // If confidence is high, new score changes mastery SLOW (Low weight).
        // Max weight 0.5 (Newbie), Min weight 0.1 (Veteran)
        const updateWeight = 0.5 - (dataConfidence * 0.4); 
        
        // Formula: New = Old + (Diff * Weight)
        const newScore = current.score + ((perf.wmi - current.score) * updateWeight);

        // 3. Create Updated Record
        const updatedRecord = {
            subjectId: subId,
            score: parseFloat(newScore.toFixed(2)),
            stability: parseFloat(dataConfidence.toFixed(2)),
            lastTested: Date.now(),
            attemptsL1: (current.attemptsL1 || 0) + perf.l1Count,
            attemptsL3: (current.attemptsL3 || 0) + perf.l3Count,
            streak: (current.streak || 0) + 1
        };

        // Update In-Memory State
        this.state.mastery[subId] = updatedRecord;

        console.log(`🎓 Subject [${subId}] Updated: WMI ${perf.wmi.toFixed(1)}% -> Mastery ${newScore.toFixed(1)}%`);
        
        return updatedRecord;
    },
    // ============================================================
    // 5. DECAY MECHANICS (THE FORGETTING CURVE)
    // ============================================================

    /**
     * Applies time-based erosion to a specific subject's mastery.
     * Called before merging new test results to ensure "rustiness" is accounted for.
     */
    async _applyDecayToSubject(subId) {
        const current = this.state.mastery[subId];
        if (!current || !current.lastTested) return;

        const now = Date.now();
        const diffDays = (now - current.lastTested) / (1000 * 60 * 60 * 24);

        if (diffDays < 1) return; // No decay within 24 hours

        // Get Subject-specific rate (e.g. Current Affairs decays faster than Polity)
        const config = this.SUBJECTS[subId];
        const decayRate = config ? config.decayRate : 0.02;

        // Formula: NewScore = OldScore * (1 - Rate)^Days
        // If rate is 0.02 (2%) and 10 days passed: 0.98^10 = ~0.81 (19% loss)
        const retentionFactor = Math.pow((1.0 - decayRate), diffDays);
        
        const oldScore = current.score;
        const decayedScore = oldScore * retentionFactor;

        // Apply Update
        this.state.mastery[subId].score = parseFloat(decayedScore.toFixed(2));
        
        // Note: We do NOT update 'lastTested' here. 
        // We only erode the value so the new test starts from a lower baseline.
        console.log(`📉 Decay applied to ${subId}: -${(oldScore - decayedScore).toFixed(1)} pts (${diffDays.toFixed(1)} days)`);
    },

    /**
     * Global Decay Check (Runs on App Startup).
     * Updates ALL subjects if the user hasn't logged in for a while.
     */
    async _checkKnowledgeDecay() {
        const updates = [];
        const now = Date.now();

        Object.keys(this.state.mastery).forEach(subId => {
            const record = this.state.mastery[subId];
            if (!record.lastTested) return;

            const diffDays = (now - record.lastTested) / (1000 * 60 * 60 * 24);
            
            // Only write to DB if significant decay happened (> 2 days)
            if (diffDays > 2) {
                this._applyDecayToSubject(subId);
                // Since we aren't taking a test, we update 'lastTested' to now 
                // effectively "banking" the decay so we don't apply it again tomorrow.
                this.state.mastery[subId].lastTested = now;
                updates.push(DB.put('academic_state', this.state.mastery[subId]));
            }
        });

        if (updates.length > 0) {
            await Promise.all(updates);
            console.log(`📉 Global Decay Applied to ${updates.length} subjects.`);
        }
    },

    // ============================================================
    // 6. BLIND SPOT DETECTION (COVERAGE)
    // ============================================================

    async _updateCoverage(subId, questions) {
        // Simple Density Logic for MVP:
        // We assume ~500 questions needed for full coverage of a subject.
        // Each question adds 0.002 (0.2%) to coverage.
        const currentDensity = this.state.coverage[subId] || 0.0;
        const addedDensity = (questions.length * 0.002);
        
        // Clamp at 1.0 (100%)
        this.state.coverage[subId] = Math.min(1.0, currentDensity + addedDensity);
        
        // (In a full version, we would save this to DB, but for MVP we keep it in memory/compute)
    },

    async _calculateBlindSpots() {
        // Find subjects with High Weightage but Low Coverage
        const blindSpots = [];
        
        Object.keys(this.SUBJECTS).forEach(subId => {
            const config = this.SUBJECTS[subId];
            const coverage = this.state.coverage[subId] || 0;
            
            // If Subject is important (>10% weight) AND Coverage is low (<10%)
            if (config.weight > 0.10 && coverage < 0.10) {
                blindSpots.push(subId);
            }
        });
        
        this.state.blindSpots = blindSpots;
    },

    // ============================================================
    // 7. PUBLIC API (FOR MASTER AGGREGATOR)
    // ============================================================

    /**
     * Returns the full "Truth Vector" required by the Oracle Worker.
     */
    getAggregatedStats() {
        return {
            mastery: this.state.mastery, // The Scores
            coverage: this.state.coverage, // The Experience
            blindSpots: this.state.blindSpots || [],
            metadata: {
                totalTests: this.state.totalTestsTaken,
                lastActive: this.state.lastAggregation
            }
        };
    },

    /**
     * Returns a simple list for the UI Dashboard (Progress Bars).
     */
    getUIStats() {
        return Object.keys(this.state.mastery).map(subId => {
            const m = this.state.mastery[subId];
            const c = this.SUBJECTS[subId];
            return {
                id: subId,
                name: c ? c.name : subId,
                score: Math.round(m.score),
                color: m.score > 75 ? 'green' : (m.score > 40 ? 'yellow' : 'red')
            };
        });
    }
};
