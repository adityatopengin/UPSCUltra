/**
 * DB SERVICE (THE WAREHOUSE) - PART A
 * Path: assets/js/services/db.js
 * Version: 2.0.0
 * Purpose: A robust, Promise-based wrapper for IndexedDB.
 * Responsibilities:
 * 1. Manages the connection to 'UPSCSuperApp_DB'.
 * 2. Defines the Schema for Questions, User Profiles, and History.
 * 3. Handles Migration (upgrading from old versions without data loss).
 */

export const DB = {
    // Configuration
    _dbName: 'UPSCSuperApp_DB',
    _version: 2, // We increment this to trigger an upgrade from your old DB
    _db: null,

    // ============================================================
    // 1. CONNECTION & SCHEMA MIGRATION
    // ============================================================

    async connect() {
        // If we already have a connection, return it (Singleton pattern)
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this._dbName, this._version);

            // MIGRATION LOGIC: This runs ONLY if the browser sees a new version number.
            // This is where we define the structure of our data.
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                console.log(`💾 DB: Upgrading Schema to v${this._version}...`);

                // --- 1. LEGACY STORES (PRESERVING OLD DATA) ---
                // We ensure these exist so old 'history' and 'mistakes' are safe.
                
                if (!db.objectStoreNames.contains('history')) {
                    // Holds past quiz results. Key = 'id' (timestamp based)
                    const hStore = db.createObjectStore('history', { keyPath: 'id' });
                    hStore.createIndex('timestamp', 'timestamp', { unique: false });
                    hStore.createIndex('subject', 'subject', { unique: false }); // Added index for faster filtering
                }

                if (!db.objectStoreNames.contains('mistakes')) {
                    // Holds specific questions user got wrong.
                    // We use autoIncrement because one question can be wrong multiple times
                    const mStore = db.createObjectStore('mistakes', { keyPath: 'id', autoIncrement: true });
                    mStore.createIndex('qId', 'qId', { unique: false });
                    mStore.createIndex('subjectId', 'subjectId', { unique: false });
                }

                // --- 2. NEW ROBUST STORES (FOR THE UPGRADE) ---

                // A. QUESTION BANK (The Asset)
                // Holds 10,000+ questions. 
                // We index 'subject', 'topic', and 'level' for the Worker to query instantly.
                if (!db.objectStoreNames.contains('questions')) {
                    const qStore = db.createObjectStore('questions', { keyPath: 'id' });
                    qStore.createIndex('subject', 'subject', { unique: false });
                    qStore.createIndex('topic', 'topic', { unique: false });
                    qStore.createIndex('level', 'level', { unique: false }); // L1, L2, L3
                    qStore.createIndex('random', 'random', { unique: false }); // Specialized index for random fetching
                }

                // B. ACADEMIC STATE (The Professor's Notebook)
                // Holds the 'Mastery Vectors' (decay, stability) per subject.
                if (!db.objectStoreNames.contains('academic_state')) {
                    db.createObjectStore('academic_state', { keyPath: 'subjectId' });
                }

                // C. BEHAVIORAL PROFILE (The Psychologist's File)
                // Holds the 7-Dimensional Profile (Focus, Calm, etc.).
                if (!db.objectStoreNames.contains('profiles')) {
                    db.createObjectStore('profiles', { keyPath: 'userId' });
                }

                // D. TELEMETRY (The Black Box)
                // Records raw click data (impulse clicks, switches) for the Behavioral Engine.
                if (!db.objectStoreNames.contains('telemetry')) {
                    const tStore = db.createObjectStore('telemetry', { keyPath: 'id', autoIncrement: true });
                    tStore.createIndex('sessionId', 'sessionId', { unique: false });
                    tStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                // console.log("💾 DB: Connection Established."); // Optional: Comment out to reduce console noise
                resolve(this._db);
            };

            request.onerror = (e) => {
                console.error("💾 DB: Connection Failed", e);
                reject(e);
            };
        });
    },
    // ============================================================
    // 2. CORE OPERATIONS (CRUD)
    // ============================================================

    /**
     * Get a single item by its Key (ID).
     * @param {String} storeName - e.g., 'questions', 'profiles'
     * @param {String|Number} key - The unique ID
     */
    async get(storeName, key) {
        await this.connect(); // Ensure connection exists
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.get(key);
            
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * Get ALL items from a store.
     * WARNING: Use carefully on large stores like 'questions'.
     */
    async getAll(storeName) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const req = store.getAll();
            
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * Save a single item (Insert or Update).
     * @param {String} storeName
     * @param {Object} item - Must contain the KeyPath (e.g., 'id')
     */
    async put(storeName, item) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.put(item);
            
            tx.oncomplete = () => resolve(req.result);
            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Delete an item by Key.
     */
    async delete(storeName, key) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.delete(key);
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },

    /**
     * Clear an entire store (Factory Reset helper).
     */
    async clearStore(storeName) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            store.clear();
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    },
    // ============================================================
    // 3. ADVANCED UTILITIES (WORKER OPTIMIZED)
    // ============================================================

    /**
     * BULK IMPORT: Used by DataWorker to load initial JSONs.
     * Uses a single transaction for massive performance gain.
     */
    async bulkPut(storeName, items) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            
            items.forEach(item => store.put(item));
            
            tx.oncomplete = () => {
                console.log(`💾 DB: Bulk Import (${items.length} items) -> ${storeName}`);
                resolve(true);
            };
            tx.onerror = (e) => reject(e);
        });
    },

    /**
     * FAST QUERY: Find items by Index (e.g., "All Polity Questions").
     * @param {String} indexName - 'subject', 'topic', 'level'
     */
    async query(storeName, indexName, value) {
        await this.connect();
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const req = index.getAll(value);
            
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },

    /**
     * THE MOCK GENERATOR ENGINE
     * Fetches only Keys first (lightweight), picks random ones, then fetches Data.
     * This allows generating a random test from 10,000 Qs in < 50ms.
     */
    async getRandomKeys(storeName, indexName, value, count) {
        await this.connect();
        return new Promise((resolve) => {
            const tx = this._db.transaction([storeName], 'readonly');
            const store = tx.objectStore(storeName);
            const index = indexName ? store.index(indexName) : store;
            
            // 1. Get ALL keys for the filter (e.g. 500 keys for 'Polity')
            // This is extremely fast compared to getting the full objects.
            const req = indexName ? index.getAllKeys(value) : store.getAllKeys();

            req.onsuccess = () => {
                const keys = req.result;
                if (keys.length === 0) return resolve([]);

                // 2. Fisher-Yates Shuffle (or simple sort for now)
                // We shuffle the KEYS, not the heavy objects.
                const shuffled = keys.sort(() => 0.5 - Math.random());
                
                // 3. Slice the needed amount
                const selectedKeys = shuffled.slice(0, count);
                resolve(selectedKeys);
            };
        });
    },
    
    /**
     * Closes the connection (Clean shutdown)
     */
    close() {
        if (this._db) {
            this._db.close();
            this._db = null;
        }
    }
}; 
