/**
 * UI-ORACLE (THE VISUAL BRAIN)
 * Version: 2.0.0
 * Path: assets/js/ui/components/ui-oracle.js
 * Responsibilities:
 * 1. Renders the interactive Holographic Chart (Canvas).
 * 2. Visualizes the 7-Dimensional Behavioral Profile.
 * 3. Adds "Living" animations (rotation, pulse) to the home screen.
 */

import { BehavioralEngine } from '../../engine/behavioral-engine.js';

export const UIOracle = {
    // ============================================================
    // 1. CONFIGURATION
    // ============================================================
    config: {
        canvasId: 'oracle-canvas',
        containerId: 'oracle-container',
        color: '#3b82f6', // Default Blue (Tailwind blue-500)
        size: 300,        // Logical size
        rotationSpeed: 0.002,
        pulseSpeed: 0.02
    },

    state: {
        ctx: null,
        width: 0,
        height: 0,
        angleOffset: 0,
        pulseOffset: 0,
        animationFrame: null,
        profileData: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] // Default balanced
    },

    // ============================================================
    // 2. INITIALIZATION
    // ============================================================

    init() {
        // Only run if we are on the Home View (or container exists)
        // Actually, UI-Manager calls this globally, so we check for container presence
        // or inject it if missing (usually UIHome injects the container).
        
        console.log("🔮 UIOracle: Booting Hologram...");
        this._syncProfileData();
        
        // Listen for window resize to redraw crisp lines
        window.addEventListener('resize', () => this._resize());
    },

    /**
     * Called by UIHome.js when the Dashboard is rendered.
     * This attaches the canvas to the DOM element provided by UIHome.
     */
    mount(containerElement) {
        if (!containerElement) return;

        // Create Canvas
        containerElement.innerHTML = ''; // Clear placeholder
        const canvas = document.createElement('canvas');
        canvas.id = this.config.canvasId;
        // REFACTOR: Removed 'opacity-80'. Kept structural classes.
        canvas.className = 'w-full h-full object-contain'; 
        containerElement.appendChild(canvas);

        this.state.ctx = canvas.getContext('2d');
        this._resize();
        this._startAnimation();
    },

    /**
     * Fetches real data from the Engine to populate the chart.
     */
    _syncProfileData() {
        if (!BehavioralEngine || !BehavioralEngine.profile) return;

        const p = BehavioralEngine.profile;
        // Map the 7 dimensions to an array (Order matters for shape)
        // Focus, Calm, Speed, Precision, Risk, Endurance, Flexibility
        this.state.profileData = [
            p.focus?.value || 0.5,
            p.calm?.value || 0.5,
            p.speed?.value || 0.5,
            p.precision?.value || 0.5,
            p.risk?.value || 0.5,
            p.endurance?.value || 0.5,
            p.flexibility?.value || 0.5
        ];
    },

    _resize() {
        const canvas = document.getElementById(this.config.canvasId);
        if (!canvas) return;

        const parent = canvas.parentElement;
        this.state.width = parent.clientWidth;
        this.state.height = parent.clientHeight;

        // Handle High DPI (Retina) Displays for crisp text
        const dpr = window.devicePixelRatio || 1;
        canvas.width = this.state.width * dpr;
        canvas.height = this.state.height * dpr;
        
        this.state.ctx.scale(dpr, dpr);
    },
    // ============================================================
    // 3. RENDER LOOP (THE ARTIST)
    // ============================================================

    _startAnimation() {
        if (this.state.animationFrame) cancelAnimationFrame(this.state.animationFrame);

        const loop = () => {
            this._draw();
            // Update rotation params
            this.state.angleOffset += this.config.rotationSpeed;
            this.state.pulseOffset += this.config.pulseSpeed;
            
            this.state.animationFrame = requestAnimationFrame(loop);
        };
        loop();
    },

    _draw() {
        const { ctx, width, height, angleOffset, pulseOffset, profileData } = this.state;
        if (!ctx) return;

        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2.5; // Padding
        const labels = ['FOC', 'CLM', 'SPD', 'PRC', 'RSK', 'END', 'FLX'];
        const numSides = labels.length;
        const stepAngle = (Math.PI * 2) / numSides;

        // Clear Canvas
        ctx.clearRect(0, 0, width, height);

        // A. Draw Background Grid (Spider Web)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;

        for (let r = 0.2; r <= 1.0; r += 0.2) {
            ctx.beginPath();
            for (let i = 0; i <= numSides; i++) {
                const angle = (i * stepAngle) - (Math.PI / 2); // Start at top
                const x = centerX + Math.cos(angle) * (radius * r);
                const y = centerY + Math.sin(angle) * (radius * r);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }

        // B. Draw Axes (Spokes)
        ctx.beginPath();
        for (let i = 0; i < numSides; i++) {
            const angle = (i * stepAngle) - (Math.PI / 2);
            const x = centerX + Math.cos(angle) * radius;
            const y = centerY + Math.sin(angle) * radius;
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(x, y);
            
            // Draw Labels
            ctx.fillStyle = 'rgba(148, 163, 184, 0.8)'; // Slate-400
            ctx.font = '10px monospace';
            ctx.textAlign = 'center';
            const lx = centerX + Math.cos(angle) * (radius * 1.15);
            const ly = centerY + Math.sin(angle) * (radius * 1.15);
            ctx.fillText(labels[i], lx, ly);
        }
        ctx.stroke();

        // C. Draw Data Polygon (The Profile)
        ctx.beginPath();
        profileData.forEach((value, i) => {
            const angle = (i * stepAngle) - (Math.PI / 2);
            // Add a subtle pulse effect to the size
            const pulse = Math.sin(pulseOffset + i) * 0.05; 
            const r = radius * (Math.max(0.1, value) + pulse);
            
            const x = centerX + Math.cos(angle) * r;
            const y = centerY + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();

        // Fill Style (Gradient)
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)'); // Blue core
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)'); // Faded edge
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.strokeStyle = '#60a5fa'; // Blue-400 border
        ctx.lineWidth = 2;
        ctx.stroke();

        // D. Draw Rotating Outer Ring (Decoration)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 20]); // Dashed line
        ctx.arc(centerX, centerY, radius * 1.05, angleOffset, angleOffset + (Math.PI * 2));
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
    },

    /**
     * Cleanup to stop the animation loop when view changes.
     */
    destroy() {
        if (this.state.animationFrame) {
            cancelAnimationFrame(this.state.animationFrame);
            this.state.animationFrame = null;
        }
        console.log("🔮 UIOracle: Shutting down.");
    }
};

// Global Exposure
window.UIOracle = UIOracle;


