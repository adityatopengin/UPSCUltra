/**
 * QUIZ ENGINE (THE BRAIN)
 * Version: 2.4.0 (Connected to Real DB)
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
        currentIndex: 0
    },

    timerInterval: null,

    // ============================================================
    // 2. SESSION MANAGEMENT
    // ============================================================
         async startSession(subjectId) {
        console.log(`🧠 Engine: Starting Session for ${subjectId}`);
        
        // 1. Clean Slate
        this.terminateSession(); 

        // 2. Setup New State (Initially Active)
        this.state.subjectId = subjectId;
        this.state.active = true;
        this.state.startTime = Date.now();
        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.bookmarks = new Set();

        // 3. Load Real Questions from DB
        this.state.questions = await this._fetchQuestions(subjectId);
        
        // 🛡️ CRITICAL FIX: Handle Empty Database Safely
        if (!this.state.questions || this.state.questions.length === 0) {
            console.error("Engine: No questions found in DB!");
            
            // A. Reset Active State
            this.state.active = false; 
            
            // B. Alert User
            alert("No questions found! Please wait for Data Seeder to finish.");
            
            // C. THROW ERROR so Main.js stops navigation
            throw new Error("QUIZ_ABORT_NO_DATA"); 
        }

        // 4. Set Timer (2 mins per question)
        const duration = this.state.questions.length * 2 * 60; 
        this.state.totalDuration = duration;
        this.state.timeLeft = duration;

        // 5. Start Timer Loop
        this._startTimer();

        // 6. Notify UI
        this._emit('SESSION_START');
    },

     
    async submitQuiz() {
        if (!this.state.active) return;

        console.log("🧠 Engine: Submitting Quiz...");
        this._stopTimer();
        this.state.active = false;

        const result = this._calculateResult();

        try {
            // 1. Save to History (Using .put as fixed earlier)
            await DB.put('history', result);
            
            // 2. Update Mastery
            await this._updateMastery(result);

            console.log("🧠 Engine: Results Saved Successfully.");

            // 3. Navigate to Results
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
    },

    // ============================================================
    // 3. USER ACTIONS
    // ============================================================

    submitAnswer(questionId, optionIndex) {
        if (!this.state.active) return;
        this.state.answers[questionId] = optionIndex;
        this._emit('ANSWER_SAVED', { questionId, optionIndex });
    },

    toggleBookmark(questionId) {
        if (this.state.bookmarks.has(questionId)) {
            this.state.bookmarks.delete(questionId);
        } else {
            this.state.bookmarks.add(questionId);
        }
        this._emit('BOOKMARK_TOGGLED', { questionId });
    },

    nextQuestion() {
        if (this.state.currentIndex < this.state.questions.length - 1) {
            this.state.currentIndex++;
            this._emit('NAVIGATE');
        }
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this._emit('NAVIGATE');
        }
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length) {
            this.state.currentIndex = index;
            this._emit('NAVIGATE');
        }
    },

    // ============================================================
    // 4. INTERNAL UTILITIES
    // ============================================================

    _startTimer() {
        this._stopTimer(); 
        
        this.timerInterval = setInterval(() => {
            this.state.timeLeft--;
            
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

        this.state.questions.forEach(q => {
            const userAnswer = this.state.answers[q.id];
            if (userAnswer !== undefined) {
                if (userAnswer === q.correctAnswer) {
                    correct++;
                    score += 2;
                } else {
                    wrong++;
                    score -= 0.66;
                }
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
            questions: this.state.questions // Save questions for "Review Mistakes"
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
    // 6. REAL DATA FETCHING (REPLACES MOCK)
    // ============================================================

    async _fetchQuestions(subjectId) {
        try {
            // 1. Get Random Keys for the subject
            // We fetch 15 random question IDs from the DB 'questions' store
            const keys = await DB.getRandomKeys('questions', 'subject', subjectId, 15);
            
            if (!keys || keys.length === 0) return [];

            // 2. Fetch the actual question objects
            const promises = keys.map(key => DB.get('questions', key));
            const questions = await Promise.all(promises);
            
            // 3. Shuffle Options for display
            return questions.map(q => this._randomizeOptions(q));

        } catch(e) {
            console.error("Engine: DB Fetch Failed", e);
            return [];
        }
    },

    /**
     * Helper to shuffle options so A/B/C/D aren't always the same.
     * Keeps track of the correct answer's new position.
     */
    _randomizeOptions(question) {
        // Clone to avoid modifying DB object directly
        const q = JSON.parse(JSON.stringify(question));
        
        // Map options to objects to track original index
        let optionsWithIndex = q.options.map((text, idx) => ({ text, originalIndex: idx }));
        
        // Shuffle
        optionsWithIndex.sort(() => Math.random() - 0.5);
        
        // Find where the correct answer moved to
        const newCorrectIndex = optionsWithIndex.findIndex(o => o.originalIndex === q.correctOption);
        
        return {
            ...q,
            options: optionsWithIndex.map(o => o.text),
            correctAnswer: newCorrectIndex // Remap correct index
        };
    }
};

