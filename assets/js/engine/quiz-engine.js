/**
 * QUIZ ENGINE (THE BRAIN)
 * Version: 2.5.0 (Fixed Scoring & Telemetry)
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
        // ✅ TELEMETRY ADDED
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
        
        this.terminateSession(); 

        this.state.subjectId = subjectId;
        this.state.active = true;
        this.state.startTime = Date.now();
        this.state.currentIndex = 0;
        this.state.answers = {};
        this.state.bookmarks = new Set();
        
        // Reset Telemetry
        this.state.telemetry = {
            impulseClicks: 0,
            switches: {},
            timePerQuestion: {},
            questionStartTimes: {}
        };

        this.state.questions = await this._fetchQuestions(subjectId);
        
        if (!this.state.questions || this.state.questions.length === 0) {
            console.error("Engine: No questions found in DB!");
            this.state.active = false; 
            alert("No questions found! Please wait for Data Seeder to finish.");
            throw new Error("QUIZ_ABORT_NO_DATA"); 
        }

        const duration = this.state.questions.length * 2 * 60; 
        this.state.totalDuration = duration;
        this.state.timeLeft = duration;

        // Start timing the first question
        this.state.telemetry.questionStartTimes[0] = Date.now();

        this._startTimer();
        this._emit('SESSION_START');
    },

    async submitQuiz() {
        if (!this.state.active) return;

        console.log("🧠 Engine: Submitting Quiz...");
        this._stopTimer();
        this.state.active = false;

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
    },

    // ============================================================
    // 3. USER ACTIONS
    // ============================================================

    submitAnswer(questionId, optionIndex) {
        if (!this.state.active) return;

        // ✅ TELEMETRY: Track Switches
        const prevAnswer = this.state.answers[this.state.currentIndex];
        if (prevAnswer !== undefined && prevAnswer !== optionIndex) {
            if (!this.state.telemetry.switches[this.state.currentIndex]) {
                this.state.telemetry.switches[this.state.currentIndex] = 0;
            }
            this.state.telemetry.switches[this.state.currentIndex]++;
        }

        // ✅ TELEMETRY: Track Time
        const now = Date.now();
        const start = this.state.telemetry.questionStartTimes[this.state.currentIndex] || now;
        this.state.telemetry.timePerQuestion[this.state.currentIndex] = now - start;

        this.state.answers[this.state.currentIndex] = optionIndex; // Use Index as key for consistency
        this._emit('ANSWER_SAVED', { questionId: this.state.currentIndex, optionIndex });
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
            // ✅ TELEMETRY: Check Impulse
            const now = Date.now();
            const start = this.state.telemetry.questionStartTimes[this.state.currentIndex] || now;
            if ((now - start) < 1500) {
                this.state.telemetry.impulseClicks++;
            }

            this.state.currentIndex++;
            // Start timing next question
            this.state.telemetry.questionStartTimes[this.state.currentIndex] = Date.now();
            
            this._emit('NAVIGATE');
        }
    },

    prevQuestion() {
        if (this.state.currentIndex > 0) {
            this.state.currentIndex--;
            this.state.telemetry.questionStartTimes[this.state.currentIndex] = Date.now();
            this._emit('NAVIGATE');
        }
    },

    goToQuestion(index) {
        if (index >= 0 && index < this.state.questions.length) {
            this.state.currentIndex = index;
            this.state.telemetry.questionStartTimes[this.state.currentIndex] = Date.now();
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

        // ✅ FIXED SCORING LOGIC
        this.state.questions.forEach((q, idx) => {
            const userAnswer = this.state.answers[idx]; // Access by Index
            
            if (userAnswer !== undefined) {
                if (userAnswer === q.correctAnswer) {
                    correct++;
                    score += 2;
                    q.isCorrect = true; // ✅ Critical for Academic Engine
                } else {
                    wrong++;
                    score -= 0.66;
                    q.isCorrect = false;
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
            // ✅ TELEMETRY INCLUDED
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
        
        // Handle both old and new formats
        const originalCorrectIndex = q.correctOption !== undefined ? q.correctOption : q.correctAnswer;

        let optionsWithIndex = q.options.map((text, idx) => ({ text, originalIndex: idx }));
        optionsWithIndex.sort(() => Math.random() - 0.5);
        
        const newCorrectIndex = optionsWithIndex.findIndex(o => o.originalIndex === originalCorrectIndex);
        
        return {
            ...q,
            options: optionsWithIndex.map(o => o.text),
            correctAnswer: newCorrectIndex, // ✅ Always use correctAnswer
            correctOption: undefined // Clear old field
        };
    }
};


