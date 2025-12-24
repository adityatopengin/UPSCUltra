/**
 * QUIZ ENGINE (THE BRAIN)
 * Version: 2.5.0 (Patched: Persistence + Logic Fixes)
 * Path: assets/js/engine/quiz-engine.js
 */

import { DB } from '../services/db.js';

export const Engine = {
    // ============================================================
    // 1. ENGINE STATE
    // ============================================================
    state: {
        active: false,
        subjectId: null,
        startTime: null,
        totalDuration: 0,
        timeLeft: 0,
        questions: [],
        answers: {}, 
        bookmarks: new Set(),
        currentIndex: 0,
        // 🛡️ FIX: Added Telemetry State [Fix #4]
        telemetry: {
            impulseClicks: 0,
            switches: {},
            timePerQuestion: {},
            questionStartTimes: {}
        }
    },

    timerInterval: null,

    // ============================================================
    // 2. SESSION MANAGEMENT
    // ============================================================
    async startSession(subjectId) {
        console.log(`🧠 Engine: Starting Session for ${subjectId}`);
        
        // 🛡️ FIX: Check for Orphan Session (Persistence)
        const savedState = localStorage.getItem('quiz_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.active && parsed.subjectId === subjectId) {
                    console.log("🧠 Engine: Restoring Orphan Session...");
                    this.state = {
                        ...parsed,
                        bookmarks: new Set(parsed.bookmarks), // Restore Set
                        // Ensure telemetry exists if restoring old state
                        telemetry: parsed.telemetry || { impulseClicks: 0, switches: {}, timePerQuestion: {}, questionStartTimes: {} }
                    };
                    this._startTimer();
                    this._emit('SESSION_START');
                    return;
                }
            } catch(e) { localStorage.removeItem('quiz_state'); }
        }

        // 1. Clean Slate
        this.terminateSession(); 

        // 2. Setup New State
        this.state.subjectId = subjectId;
        this.state.active = true;
        this.state.startTime = Date.now();
        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.bookmarks = new Set();
        // Reset Telemetry
        this.state.telemetry = { impulseClicks: 0, switches: {}, timePerQuestion: {}, questionStartTimes: {} };

        // 3. Load Real Questions
        this.state.questions = await this._fetchQuestions(subjectId);
        
        if (!this.state.questions || this.state.questions.length === 0) {
            console.error("Engine: No questions found in DB!");
            this.state.active = false; 
            alert("No questions found! Please wait for Data Seeder to finish.");
            throw new Error("QUIZ_ABORT_NO_DATA"); 
        }

        // 4. Set Timer
        const duration = this.state.questions.length * 2 * 60; 
        this.state.totalDuration = duration;
        this.state.timeLeft = duration;

        // 5. Start
        this._startTimer();
        this._saveState(); // Initial Save
        this._emit('SESSION_START');
    },
     
    async submitQuiz() {
        if (!this.state.active) return;

        console.log("🧠 Engine: Submitting Quiz...");
        this._stopTimer();
        this.state.active = false;
        
        // 🛡️ FIX: Clear local persistence on explicit finish
        localStorage.removeItem('quiz_state');

        const result = this._calculateResult();

        try {
            await DB.put('history', result);
            await this._updateMastery(result);
            console.log("🧠 Engine: Results Saved Successfully.");

            if (window.Main && window.Main.handleQuizCompletion) {
                window.Main.handleQuizCompletion(result);
            }

        } catch (e) {
            console.error("Engine: Save Failed", e);
            if (window.Main && window.Main.handleQuizCompletion) {
                window.Main.handleQuizCompletion(result);
            }
        }
    },

    terminateSession() {
        this._stopTimer();
        this.state.active = false;
        localStorage.removeItem('quiz_state');
    },

    // ============================================================
    // 3. USER ACTIONS
    // ============================================================

    submitAnswer(questionId, optionIndex) {
        if (!this.state.active) return;

        // 🛡️ FIX: Telemetry - Track Switches [Fix #4]
        const currentIndex = this.state.currentIndex;
        const prevAnswer = this.state.answers[currentIndex]; // Use index as key
        
        if (prevAnswer !== undefined && prevAnswer !== optionIndex) {
             if (!this.state.telemetry.switches[currentIndex]) {
                this.state.telemetry.switches[currentIndex] = 0;
            }
            this.state.telemetry.switches[currentIndex]++;
        }

        // 🛡️ FIX: Telemetry - Track Time
        const now = Date.now();
        if (!this.state.telemetry.questionStartTimes[currentIndex]) {
            this.state.telemetry.questionStartTimes[currentIndex] = now;
        } else {
             const timeSpent = now - this.state.telemetry.questionStartTimes[currentIndex];
             this.state.telemetry.timePerQuestion[currentIndex] = timeSpent;
        }

        // Save Answer (Using Index Key consistent with _calculateResult)
        this.state.answers[currentIndex] = optionIndex;
        
        this._saveState(); // Persistence
        this._emit('ANSWER_SAVED', { questionId: currentIndex, optionIndex });
    },

    toggleBookmark(questionId) {
        if (this.state.bookmarks.has(questionId)) {
            this.state.bookmarks.delete(questionId);
        } else {
            this.state.bookmarks.add(questionId);
        }
        this._saveState();
        this._emit('BOOKMARK_TOGGLED', { questionId });
    },

    nextQuestion() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            // 🛡️ FIX: Telemetry - Track Impulse [Fix #4]
            const currentIndex = this.state.currentIndex;
            const startTime = this.state.telemetry.questionStartTimes[currentIndex] || Date.now();
            const timeOnQuestion = Date.now() - startTime;
            
            if (timeOnQuestion < 1500) { // < 1.5s
                this.state.telemetry.impulseClicks++;
            }

            this.state.currentIndex++;
            this._saveState();
            this._emit('NAVIGATE');
        }
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this._saveState();
            this._emit('NAVIGATE');
        }
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length) {
            this.state.currentIndex = index;
            this._saveState();
            this._emit('NAVIGATE');
        }
    },

    // ============================================================
    // 4. INTERNAL UTILITIES
    // ============================================================

    _saveState() {
        // Convert Set to Array for JSON
        const storageObj = {
            ...this.state,
            bookmarks: Array.from(this.state.bookmarks)
        };
        localStorage.setItem('quiz_state', JSON.stringify(storageObj));
    },

    _startTimer() {
        this._stopTimer(); 
        this.timerInterval = setInterval(() => {
            this.state.timeLeft--;
            // Only autosave every 10s to save IO
            if (this.state.timeLeft % 10 === 0) this._saveState();

            window.dispatchEvent(new CustomEvent('quiz-tick', { 
                detail: { timeLeft: this.state.timeLeft } 
            }));

            if (this.state.timeLeft <= 0) {
                this.submitQuiz(); 
            }
        }, 1000);
    },

    _stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

    _calculateResult() {
        let correct = 0;
        let wrong = 0;
        let score = 0;
        const total = this.state.questions.length;

        // 🛡️ FIX: Use Index for answers [Fix #1]
        this.state.questions.forEach((q, idx) => {
            const userAnswer = this.state.answers[idx]; // Changed from q.id to idx
            
            if (userAnswer !== undefined) {
                if (userAnswer === q.correctAnswer) {
                    correct++;
                    score += 2;
                    q.isCorrect = true; // 🛡️ FIX: Inject Flag for Academic Engine [Fix #3]
                } else {
                    wrong++;
                    score -= 0.66;
                    q.isCorrect = false; // Inject Flag
                }
            } else {
                q.isCorrect = false;
            }
        });

        const id = (window.crypto && window.crypto.randomUUID) 
            ? crypto.randomUUID() 
            : 'res_' + Date.now();

        return {
            id: id,
            timestamp: Date.now(),
            subject: this.state.subjectId,
            score: Number(score.toFixed(2)),
            totalMarks: total * 2,
            correct: correct,
            wrong: wrong,
            skipped: total - (correct + wrong),
            accuracy: correct > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0,
            totalDuration: this.state.totalDuration - this.state.timeLeft,
            questions: this.state.questions,
            // 🛡️ FIX: Return Telemetry [Fix #4]
            telemetry: {
                impulseClicks: this.state.telemetry.impulseClicks,
                switches: this.state.telemetry.switches,
                timePerQuestion: this.state.telemetry.timePerQuestion
            }
        };
    },

    _emit(type, payload = {}) {
        window.dispatchEvent(new CustomEvent('quiz-update', {
            detail: { type, state: this.state, ...payload }
        }));
    },

    async _updateMastery(result) {
        try {
            const subjectId = result.subject;
            const currentEntry = await DB.get('academic_state', subjectId) || { subjectId, mastery: 0, attempts: 0 };
            
            const newMastery = ((currentEntry.mastery * currentEntry.attempts) + result.score) / (currentEntry.attempts + 1);
            
            currentEntry.mastery = newMastery;
            currentEntry.attempts += 1;
            currentEntry.lastStudied = Date.now();

            await DB.put('academic_state', currentEntry);
            
        } catch (e) {
            console.warn("Engine: Failed to update mastery stats (non-critical)", e);
        }
    },

    // ============================================================
    // 6. REAL DATA FETCHING
    // ============================================================

    async _fetchQuestions(subjectId) {
        try {
            const keys = await DB.getRandomKeys('questions', 'subject', subjectId, 15);
            if (!keys || keys.length === 0) return [];

            const promises = keys.map(key => DB.get('questions', key));
            const questions = await Promise.all(promises);
            return questions.map(q => this._randomizeOptions(q));

        } catch(e) {
            console.error("Engine: DB Fetch Failed", e);
            return [];
        }
    },

    _randomizeOptions(question) {
        const q = JSON.parse(JSON.stringify(question));
        
        // 🛡️ FIX: Handle both naming conventions (Legacy Support) [Fix #5]
        const originalCorrectIndex = q.correctOption !== undefined ? q.correctOption : q.correctAnswer;

        let optionsWithIndex = q.options.map((text, idx) => ({ text, originalIndex: idx }));
        
        // Shuffle
        optionsWithIndex.sort(() => Math.random() - 0.5);
        
        const newCorrectIndex = optionsWithIndex.findIndex(o => o.originalIndex === originalCorrectIndex);
        
        return {
            ...q,
            options: optionsWithIndex.map(o => o.text),
            correctAnswer: newCorrectIndex,
            // 🛡️ FIX: Explicitly remove old field to prevent confusion
            correctOption: undefined 
        };
    }
};

