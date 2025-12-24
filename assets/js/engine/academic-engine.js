/**
 * ACADEMIC ENGINE (THE PROFESSOR)
 * Version: 2.6.0 (Patched: Mastery Field Alignment)
 * Path: assets/js/engine/academic-engine.js
 * Responsibilities:
 * 1. Tracks Subject Mastery (0-100%) using WMI (Weighted Mastery Index).
 * 2. Applies "Forgetting Curve" decay based on inactivity.
 * 3. Identifies Blind Spots and aggregates stats for the Oracle.
 */

import { DB } from '../services/db.js';

export const AcademicEngine = {
    
    // ============================================================
    // 1. CONFIGURATION
    // ============================================================
    SUBJECTS: {
        'polity': { name: "Indian Polity", weight: 0.18, decayRate: 0.015, complexity: 'conceptual' },
        'history_modern': { name: "Modern History", weight: 0.10, decayRate: 0.025, complexity: 'factual' },
        'history_ancient': { name: "Ancient/Medieval", weight: 0.05, decayRate: 0.030, complexity: 'factual' },
        'economy': { name: "Economy", weight: 0.14, decayRate: 0.010, complexity: 'conceptual' },
        'environment': { name: "Environment & Ecology", weight: 0.16, decayRate: 0.020, complexity: 'analytical' },
        'geography': { name: "Geography", weight: 0.12, decayRate: 0.012, complexity: 'conceptual' },
        'science': { name: "Science & Tech", weight: 0.08, decayRate: 0.018, complexity: 'dynamic' },
        'current_affairs': { name: "Current Affairs", weight: 0.17, decayRate: 0.040, complexity: 'factual' },
        'csat_quant': { name: "Quant (Math)", weight: 0.40, decayRate: 0.005, complexity: 'analytical' },
        'csat_logic': { name: "Logical Reasoning", weight: 0.25, decayRate: 0.005, complexity: 'analytical' },
        'csat_rc': { name: "Reading Comprehension", weight: 0.35, decayRate: 0.008, complexity: 'inference' }
    },

    DIFFICULTY_WEIGHTS: {
        'L1': 1.0, 
        'L2': 1.5, 
        'L3': 2.5 
    },

    // ============================================================
    // 2. STATE MANAGEMENT
    // ============================================================
    state: {
        mastery: {}, 
        coverage: {},
        totalTestsTaken: 0,
        lastAggregation: 0
    },

    async init() {
        console.log("🎓 AcademicEngine: Initializing Syllabus Core...");
        try {
            await this._loadState();
            await this._checkKnowledgeDecay();
            await this._calculateBlindSpots();
            console.log("🎓 AcademicEngine: Online.");
        } catch (e) {
            console.error("🎓 AcademicEngine: Init failed.", e);
        }
    },

    async _loadState() {
        const savedRecords = await DB.getAll('academic_state');
        if (savedRecords && savedRecords.length > 0) {
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
        Object.keys(this.SUBJECTS).forEach(subId => {
            // 🛡️ FIX: Standardized 'mastery' field (was 'score')
            const emptyRecord = {
                subjectId: subId, mastery: 0, stability: 0, lastTested: 0, attemptsL1: 0, attemptsL3: 0, streak: 0
            };
            this.state.mastery[subId] = emptyRecord;
            this.state.coverage[subId] = 0.0;
            promises.push(DB.put('academic_state', emptyRecord));
        });
        await Promise.all(promises);
    },

    // ============================================================
    // 3. CORE LOGIC
    // ============================================================
    async processTestResult(result, detailedQuestions) {
        console.log("🎓 AcademicEngine: Processing Test Result...");
        const subjectGroups = this._groupQuestionsBySubject(detailedQuestions);
        const dbUpdates = [];

        for (const subId of Object.keys(subjectGroups)) {
            if (!this.SUBJECTS[subId]) continue;
            const subjectQs = subjectGroups[subId];
            
            const performance = this._calculateWMI(subjectQs);
            await this._applyDecayToSubject(subId);
            const updatedRecord = this._updateMasteryState(subId, performance);
            
            dbUpdates.push(DB.put('academic_state', updatedRecord));
            await this._updateCoverage(subId, subjectQs);
        }

        this.state.totalTestsTaken++;
        this.state.lastAggregation = Date.now();
        await Promise.all(dbUpdates);
        console.log("🎓 Knowledge Map Updated.");
    },

    _groupQuestionsBySubject(questions) {
        const groups = {};
        questions.forEach(q => {
            const sub = q.subject || 'polity'; 
            if (!groups[sub]) groups[sub] = [];
            groups[sub].push(q); 
        });
        return groups;
    },

    _calculateWMI(questions) {
        let totalWeightedScore = 0;
        let maxWeightedScore = 0;
        let l1Count = 0;
        let l3Count = 0;

        questions.forEach(q => {
            const level = q.level || 'L1'; 
            const weight = this.DIFFICULTY_WEIGHTS[level] || 1.0;

            // Strict boolean check for correctness
            if (q.isCorrect === true) {
                totalWeightedScore += (1 * weight);
            }
            maxWeightedScore += (1 * weight);

            if (level === 'L1') l1Count++;
            if (level === 'L3') l3Count++;
        });

        const finalWMI = maxWeightedScore === 0 ? 0 : (totalWeightedScore / maxWeightedScore) * 100;

        return {
            wmi: finalWMI,
            l1Count: l1Count,
            l3Count: l3Count,
            totalQs: questions.length
        };
    },

    _updateMasteryState(subId, perf) {
        const current = this.state.mastery[subId] || { 
            mastery: 0, stability: 0, attemptsL1: 0, attemptsL3: 0, streak: 0 
        };
        
        // 1. Calculate Confidence based on data volume
        const totalAttempts = (current.attemptsL1 || 0) + (current.attemptsL3 || 0) + perf.totalQs;
        const dataConfidence = Math.min(1.0, totalAttempts / 100); 
        
        // 2. Calculate Update Weight (More confidence = Slower updates, stability)
        const updateWeight = 0.5 - (dataConfidence * 0.4); 
        
        // 3. Weighted Moving Average for Mastery
        // 🛡️ FIX: Using 'mastery' field consistently
        const newMastery = current.mastery + ((perf.wmi - current.mastery) * updateWeight);

        const updatedRecord = {
            subjectId: subId,
            mastery: parseFloat(newMastery.toFixed(2)), // 🛡️ FIX: Saved as 'mastery'
            stability: parseFloat(dataConfidence.toFixed(2)),
            lastTested: Date.now(),
            attemptsL1: (current.attemptsL1 || 0) + perf.l1Count,
            attemptsL3: (current.attemptsL3 || 0) + perf.l3Count,
            streak: (current.streak || 0) + 1
        };

        this.state.mastery[subId] = updatedRecord;
        return updatedRecord;
    },

    async _applyDecayToSubject(subId) {
        const current = this.state.mastery[subId];
        if (!current || !current.lastTested) return;

        const now = Date.now();
        const diffDays = (now - current.lastTested) / (1000 * 60 * 60 * 24);

        if (diffDays < 1) return; 

        const config = this.SUBJECTS[subId];
        const decayRate = config ? config.decayRate : 0.02;
        
        // Forgetting Curve Formula
        const retentionFactor = Math.pow((1.0 - decayRate), diffDays);
        
        const oldMastery = current.mastery;
        const decayedMastery = oldMastery * retentionFactor;

        // 🛡️ FIX: Updating 'mastery'
        this.state.mastery[subId].mastery = parseFloat(decayedMastery.toFixed(2));
    },

    async _checkKnowledgeDecay() {
        const updates = [];
        const now = Date.now();
        Object.keys(this.state.mastery).forEach(subId => {
            const record = this.state.mastery[subId];
            if (!record.lastTested) return;
            const diffDays = (now - record.lastTested) / (1000 * 60 * 60 * 24);
            // Only force update if significant time passed > 2 days
            if (diffDays > 2) {
                this._applyDecayToSubject(subId);
                this.state.mastery[subId].lastTested = now;
                updates.push(DB.put('academic_state', this.state.mastery[subId]));
            }
        });
        if (updates.length > 0) await Promise.all(updates);
    },

    async _updateCoverage(subId, questions) {
        const currentDensity = this.state.coverage[subId] || 0.0;
        const addedDensity = (questions.length * 0.002); // 0.2% coverage per question
        this.state.coverage[subId] = Math.min(1.0, currentDensity + addedDensity);
    },

    async _calculateBlindSpots() {
        const blindSpots = [];
        Object.keys(this.SUBJECTS).forEach(subId => {
            const config = this.SUBJECTS[subId];
            const coverage = this.state.coverage[subId] || 0;
            // High priority subject but low coverage
            if (config.weight > 0.10 && coverage < 0.10) {
                blindSpots.push(subId);
            }
        });
        this.state.blindSpots = blindSpots;
    },

    // ============================================================
    // 5. DATA ACCESSORS
    // ============================================================

    getAggregatedStats() {
        return {
            mastery: this.state.mastery,
            coverage: this.state.coverage,
            blindSpots: this.state.blindSpots || [],
            metadata: {
                totalTests: this.state.totalTestsTaken,
                lastActive: this.state.lastAggregation
            }
        };
    },

    getUIStats() {
        return Object.keys(this.state.mastery).map(subId => {
            const m = this.state.mastery[subId];
            const c = this.SUBJECTS[subId];
            // 🛡️ FIX: Map 'mastery' to UI 'score'
            const scoreVal = m.mastery || 0;
            return {
                id: subId,
                name: c ? c.name : subId,
                score: Math.round(scoreVal),
                color: scoreVal > 75 ? 'green' : (scoreVal > 40 ? 'yellow' : 'red')
            };
        });
    },

    getGlobalMastery() {
        const subjects = Object.values(this.state.mastery);
        if (subjects.length === 0) return 0;
        const total = subjects.reduce((sum, sub) => sum + (sub.mastery || 0), 0);
        return Math.round(total / subjects.length);
    },

    getTotalQuestionsAnswered() {
        return Object.values(this.state.mastery).reduce((sum, sub) => {
            return sum + (sub.attemptsL1 || 0) + (sub.attemptsL3 || 0);
        }, 0);
    },

    getGlobalAccuracy() {
        // Simple proxy for now, ideally tracked separately
        return this.getGlobalMastery();
    }
};

