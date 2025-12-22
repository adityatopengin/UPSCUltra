/**
 * DATA SEEDER (THE GENESIS)
 * Version: 2.0.0
 * Path: assets/js/services/data-seeder.js
 * Responsibilities:
 * 1. Checks if the App Database is empty on boot.
 * 2. Generates a robust Mock Question Bank (500+ Qs) internally.
 * 3. Populates IndexedDB so the App works offline immediately.
 */

import { DB } from './db.js';
import { CONFIG } from '../config.js';

export const DataSeeder = {
    // ============================================================
    // 1. CONTROL FLOW
    // ============================================================

    /**
     * Called by Main.js during the boot sequence.
     * Returns a Promise that resolves when data is ready.
     */
    async init() {
        console.log("🌱 DataSeeder: Checking database status...");

        try {
            const isEmpty = await this._checkIfEmpty();
            
            if (isEmpty) {
                console.log("🌱 DataSeeder: Database is empty. Initiating Genesis...");
                // Notify UI (if loader exists)
                const loaderText = document.querySelector('#boot-loader div:last-child');
                if (loaderText) loaderText.textContent = "Generating Question Bank...";
                
                await this.seed();
                console.log("🌱 DataSeeder: Genesis Complete.");
            } else {
                console.log("🌱 DataSeeder: Database already populated. Skipping.");
            }
        } catch (e) {
            console.error("🌱 DataSeeder: Critical Failure", e);
            // We resolve anyway to let the app try to boot, 
            // but the user might see empty screens.
        }
    },

    /**
     * Verify if the 'questions' store has any data.
     */
    async _checkIfEmpty() {
        // We assume if there are < 10 questions, it's effectively empty/broken.
        const keys = await DB.getRandomKeys('questions', null, null, 10);
        return keys.length < 5;
    },

    /**
     * The Master Seeder Function
     */
    async seed() {
        const startTime = Date.now();
        
        // 1. Generate Questions for all subjects
        // We generate ~50 questions per subject for the MVP (approx 500 total)
        const allQuestions = this._generateMasterDataset();

        // 2. Bulk Insert into DB
        // DB.bulkPut is optimized for single-transaction writes
        await DB.bulkPut('questions', allQuestions);

        // 3. Log Performance
        const duration = Date.now() - startTime;
        console.log(`🌱 DataSeeder: Planted ${allQuestions.length} questions in ${duration}ms.`);
    },

    // ============================================================
    // 2. MOCK DATA GENERATOR (THE FACTORY)
    // ============================================================

    _generateMasterDataset() {
        let dataset = [];
        
        // Combine GS and CSAT subjects
        const allSubjects = [...CONFIG.subjectsGS1, ...CONFIG.subjectsCSAT];

        allSubjects.forEach(sub => {
            // Generate 50 questions per subject
            const subjectQuestions = Array.from({ length: 50 }, (_, i) => 
                this._createMockQuestion(sub.id, sub.name, i)
            );
            dataset = dataset.concat(subjectQuestions);
        });

        return dataset;
    },
    // ============================================================
    // 3. THE QUESTION FACTORY (PROCEDURAL GENERATION)
    // ============================================================

    /**
     * Creates a single question object with realistic metadata.
     * @param {string} subjectId - e.g. 'polity'
     * @param {string} subjectName - e.g. 'Indian Polity'
     * @param {number} index - 0 to 49
     */
    _createMockQuestion(subjectId, subjectName, index) {
        // 1. Determine Difficulty based on index
        // First 10 = Easy (L1), Next 20 = Medium (L2), Last 20 = Hard (L3)
        let level = 'L2';
        if (index < 10) level = 'L1';
        else if (index >= 30) level = 'L3';

        // 2. Select a Topic
        const topic = this._getTopicForSubject(subjectId, index);

        // 3. Generate Text Templates
        // We make them look like real UPSC questions
        const qText = this._generateQuestionText(subjectId, topic, level, index);
        
        return {
            id: `seed_${subjectId}_${index}`,
            subject: subjectId,
            topic: topic,
            level: level, // L1, L2, L3
            text: qText.question,
            options: qText.options,
            correctOption: Math.floor(Math.random() * 4), // Random correct answer (0-3)
            explanation: qText.explanation,
            
            // Metadata for indexing
            random: Math.random(), // For fast random fetching
            source: 'Gyan Amala Core'
        };
    },

    /**
     * Returns a relevant sub-topic based on subject.
     */
    _getTopicForSubject(subId, index) {
        const topics = {
            polity: ['Preamble', 'Fundamental Rights', 'Parliament', 'Judiciary', 'Amendments'],
            history_modern: ['1857 Revolt', 'Gandhian Era', 'Congress Sessions', 'Social Reforms', 'Acts & Viceroys'],
            geography: ['Monsoon', 'River Systems', 'Minerals', 'Physical Features', 'Climate Types'],
            economy: ['Banking', 'Budget', 'Inflation', 'BOP', 'Agriculture'],
            environment: ['National Parks', 'Pollution', 'Climate Change', 'Biodiversity', 'Acts & Protocols'],
            science: ['Space Tech', 'Diseases', 'Nano Tech', 'Defense', 'Biotech'],
            csat_quant: ['Number System', 'Percentage', 'Time & Work', 'Speed & Distance', 'Permutation'],
            csat_logic: ['Syllogism', 'Blood Relations', 'Direction Sense', 'Coding-Decoding', 'Seating'],
            csat_rc: ['Inference', 'Assumption', 'Main Idea', 'Tone', 'Conclusion']
        };

        const list = topics[subId] || ['General'];
        // Cycle through topics
        return list[index % list.length];
    },

    /**
     * Generates realistic text string.
     * In a real app, this would come from a server/JSON.
     * Here, we simulate it for the "Local-First" demo.
     */
    _generateQuestionText(subId, topic, level, index) {
        // Base Template
        const base = {
            question: `Which of the following statements regarding <b>${topic}</b> is/are correct in the context of ${subId}?`,
            options: [
                "1 only",
                "2 only",
                "Both 1 and 2",
                "Neither 1 nor 2"
            ],
            explanation: `Statement 1 is correct because [AI Generated Reason]. Statement 2 is incorrect due to factual error regarding ${topic}. Refer to Standard Text Ch. ${index + 1}.`
        };

        // Customization for CSAT (Math/Logic needs numbers)
        if (subId.includes('csat')) {
            base.question = `(Mock CSAT ${topic}) If X is ${index * 5}% of Y, and Y is ${index + 10} more than Z, find the value of Z?`;
            base.options = [
                (index * 10).toString(),
                (index * 12).toString(),
                (index * 15).toString(),
                (index * 20).toString()
            ];
            base.explanation = "Use the formula: P = (R/100) * B. Solving for Z gives the answer.";
        } 
        // Customization for Hard Questions (L3)
        else if (level === 'L3') {
            base.question = `Consider the following assertions about <b>${topic}</b>:\n1. It was first introduced in ${1900 + index}.\n2. It violates Article ${10 + index}.\n3. It has been amended ${index} times.\n\nWhich of the above are correct?`;
            base.options = [
                "1 and 2 only",
                "2 and 3 only",
                "1 and 3 only",
                "1, 2 and 3"
            ];
        }

        return base;
    }
};

// Global Exposure (Allows Main.js to call DataSeeder.init())
window.DataSeeder = DataSeeder;
