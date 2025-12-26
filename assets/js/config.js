/**
 * CONFIGURATION REGISTRY
 * Version: 2.2.0 (Patched: Added Missing Arcade Mode)
 * Path: assets/js/config.js
 * Responsibilities:
 * 1. Defines the Global App Settings (Name, Version, DB).
 * 2. maintain the "Single Source of Truth" for Subject IDs, Colors, and Icons.
 * 3. Centralizes difficulty weights and behavioral constants.
 * * NOTE: This file contains DATA CONFIGURATION. No CSS refactoring required.
 */

export const CONFIG = {
    // ============================================================
    // 1. GLOBAL APP SETTINGS
    // ============================================================
    name: "UPSC SuperApp",
    version: "3.1.0",
    debug: true, // Set to false in production to suppress console logs
    
    // Database Config (Must match what is in db.js)
    dbName: 'UPSCSuperApp_DB',
    dbVersion: 2,

    // ============================================================
    // 2. SUBJECT TAXONOMY: PAPER 1 (GENERAL STUDIES)
    // ============================================================
    // IDs must match the keys used in 'questions.json' and 'AcademicEngine'.
    
    subjectsGS1: [
        {
            id: 'polity',
            name: 'Indian Polity',
            icon: 'scale-balanced', // FontAwesome class (fa-scale-balanced)
            color: 'blue',          // Tailwind color palette (blue-500, blue-100)
            weight: 0.18,           // Approximate exam weightage (18%)
            description: 'Constitution, Governance, and Political System'
        },
        {
            id: 'history_modern',
            name: 'Modern History',
            icon: 'landmark-dome',
            color: 'amber',
            weight: 0.12,
            description: 'Freedom Struggle (1857-1947)'
        },
        {
            id: 'history_ancient',
            name: 'Ancient & Medieval',
            icon: 'scroll',
            color: 'orange',
            weight: 0.08,
            description: 'Art, Culture, and Dynasties'
        },
        {
            id: 'geography',
            name: 'Geography',
            icon: 'earth-asia',
            color: 'emerald',
            weight: 0.14,
            description: 'Physical, Social, and Economic Geography'
        },
        {
            id: 'economy',
            name: 'Economy',
            icon: 'chart-line',
            color: 'teal',
            weight: 0.15,
            description: 'Macroeconomics and Development'
        },
        {
            id: 'environment',
            name: 'Environment',
            icon: 'tree',
            color: 'green',
            weight: 0.16,
            description: 'Ecology, Biodiversity, and Climate Change'
        },
        {
            id: 'science',
            name: 'Science & Tech',
            icon: 'microchip',
            color: 'indigo',
            weight: 0.10,
            description: 'Biology, Space, and Emerging Tech'
        },
        {
            id: 'current_affairs',
            name: 'Current Affairs',
            icon: 'newspaper',
            color: 'rose',
            weight: 0.07,
            description: 'International Relations and News'
        }
    ],
    // ============================================================
    // 3. SUBJECT TAXONOMY: PAPER 2 (CSAT)
    // ============================================================
    
    subjectsCSAT: [
        {
            id: 'csat_quant',
            name: 'Quant (Math)',
            icon: 'calculator',
            color: 'violet',
            weight: 0.35,
            description: 'Arithmetic, Algebra, and Geometry'
        },
        {
            id: 'csat_logic',
            name: 'Logical Reasoning',
            icon: 'puzzle-piece',
            color: 'purple', // 🛡️ FIX: Changed from 'fuchsia' to 'purple' to match UIHome flavor map
            weight: 0.30,
            description: 'Analytical Ability and Problem Solving'
        },
        {
            id: 'csat_rc',
            name: 'Reading Comp.',
            icon: 'book-open-reader',
            color: 'pink',
            weight: 0.35,
            description: 'Comprehension and Inference'
        }
    ],

    // ============================================================
    // 4. ARCADE MODES (THE GYM)
    // ============================================================
    // Defines the mini-games available in the Arcade View.
    
    arcadeModes: [
        {
            id: 'blink_test',
            name: 'Blink Test',
            icon: 'eye',
            color: 'cyan',
            description: 'Train your focus and reaction speed.'
        },
        {
            id: 'pressure_valve',
            name: 'Pressure Valve',
            icon: 'gauge-high',
            color: 'red',
            description: 'Manage stress under rapid-fire questions.'
        },
        {
            id: 'pattern_architect',
            name: 'Pattern Architect',
            icon: 'layer-group',
            color: 'yellow',
            description: 'Enhance fluid intelligence and logic.'
        },
        // ✅ FIX: Added missing game required by Behavioral Engine
        {
            id: 'balloon_pop',
            name: 'Risk Balloon',
            icon: 'wind', 
            color: 'rose',
            description: 'Test your risk appetite. Pump it up without popping!'
        }
    ],

    // ============================================================
    // 5. GLOBAL CONSTANTS
    // ============================================================
    
    settings: {
        examDate: '2026-05-25', // Target Date for countdowns
        passingMarks: 66.6,     // CSAT Passing threshold
        totalMarksGS: 200,      // GS Paper 1 Total
        negativeMarking: 0.33,  // 1/3rd penalty
        
        // Behavioral Thresholds (Synced with Engine)
        impulseThreshold: 1500, // ms
        panicThreshold: 3       // consecutive wrong answers
    }
};

// Global Exposure (Optional, for console debugging)
window.CONFIG = CONFIG;

