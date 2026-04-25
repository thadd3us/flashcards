<script setup lang="ts">
// Lothlórien — golden mallorn forest, silver mist, soft warm glow.
</script>

<template>
  <div class="scene" aria-hidden="true">
    <div class="sky"></div>
    <div class="stars"></div>

    <svg
      class="vector"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="loth-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff3c8" stop-opacity="1" />
          <stop offset="40%" stop-color="#ffd980" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#0e1426" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="loth-canopy" cx="50%" cy="40%" r="60%">
          <stop offset="0%"  stop-color="#e7c66a" stop-opacity="0.85" />
          <stop offset="60%" stop-color="#8a6a28" stop-opacity="0.7" />
          <stop offset="100%" stop-color="#1a1208" stop-opacity="1" />
        </radialGradient>
        <linearGradient id="loth-trunk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d8c89a" />
          <stop offset="100%" stop-color="#3a2e10" />
        </linearGradient>
        <linearGradient id="loth-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#d8e4ff" stop-opacity="0" />
          <stop offset="50%" stop-color="#d8e4ff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#d8e4ff" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="loth-vignette" cx="50%" cy="50%" r="70%">
          <stop offset="55%" stop-color="#000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.55" />
        </radialGradient>
        <symbol id="loth-leaf" viewBox="0 0 20 20">
          <path d="M10 1 C 4 6, 4 14, 10 19 C 16 14, 16 6, 10 1 Z" fill="#ffe39a" opacity="0.9" />
        </symbol>
      </defs>

      <!-- Soft golden bloom up high -->
      <ellipse cx="800" cy="120" rx="700" ry="280" fill="url(#loth-glow)" opacity="0.7" />

      <!-- Distant tree trunks (background) -->
      <g opacity="0.55">
        <rect x="120" y="280" width="14" height="500" fill="url(#loth-trunk)" />
        <rect x="240" y="240" width="18" height="540" fill="url(#loth-trunk)" />
        <rect x="380" y="300" width="12" height="480" fill="url(#loth-trunk)" />
        <rect x="500" y="260" width="16" height="520" fill="url(#loth-trunk)" />
        <rect x="640" y="230" width="20" height="550" fill="url(#loth-trunk)" />
        <rect x="780" y="250" width="14" height="530" fill="url(#loth-trunk)" />
        <rect x="900" y="280" width="14" height="500" fill="url(#loth-trunk)" />
        <rect x="1020" y="240" width="18" height="540" fill="url(#loth-trunk)" />
        <rect x="1160" y="270" width="14" height="510" fill="url(#loth-trunk)" />
        <rect x="1300" y="240" width="20" height="540" fill="url(#loth-trunk)" />
        <rect x="1450" y="260" width="14" height="520" fill="url(#loth-trunk)" />
      </g>

      <!-- Mist band -->
      <rect x="0" y="500" width="1600" height="280" fill="url(#loth-mist)" />

      <!-- Foreground giant mallorns -->
      <g>
        <!-- Trunk left -->
        <path d="M 240 1000
                 L 220 700 Q 215 500, 235 320
                 Q 245 200, 260 100
                 L 290 100
                 Q 295 200, 305 320
                 Q 320 500, 320 700
                 L 300 1000 Z"
              fill="url(#loth-trunk)" />
        <!-- Branches -->
        <path d="M 270 300 Q 180 260, 90 240"
              stroke="#7a5a20" stroke-width="14" fill="none" />
        <path d="M 270 300 Q 360 260, 460 240"
              stroke="#7a5a20" stroke-width="14" fill="none" />
        <path d="M 270 380 Q 200 360, 130 350"
              stroke="#7a5a20" stroke-width="10" fill="none" />
        <!-- Canopy -->
        <ellipse cx="270" cy="180" rx="320" ry="170" fill="url(#loth-canopy)" />
        <ellipse cx="120" cy="220" rx="160" ry="100" fill="url(#loth-canopy)" />
        <ellipse cx="430" cy="200" rx="200" ry="120" fill="url(#loth-canopy)" />
      </g>
      <g>
        <!-- Trunk right -->
        <path d="M 1320 1000
                 L 1300 700 Q 1295 500, 1315 320
                 Q 1325 200, 1340 100
                 L 1370 100
                 Q 1375 200, 1385 320
                 Q 1400 500, 1400 700
                 L 1380 1000 Z"
              fill="url(#loth-trunk)" />
        <path d="M 1350 320 Q 1450 280, 1550 260"
              stroke="#7a5a20" stroke-width="14" fill="none" />
        <path d="M 1350 320 Q 1240 280, 1140 260"
              stroke="#7a5a20" stroke-width="14" fill="none" />
        <ellipse cx="1350" cy="200" rx="320" ry="170" fill="url(#loth-canopy)" />
        <ellipse cx="1500" cy="240" rx="160" ry="100" fill="url(#loth-canopy)" />
        <ellipse cx="1180" cy="220" rx="200" ry="120" fill="url(#loth-canopy)" />
      </g>

      <!-- Galadriel's flet — a small lantern-lit platform between the trees -->
      <g transform="translate(800 380)">
        <!-- Platform -->
        <ellipse cx="0" cy="0" rx="120" ry="14" fill="#3a2e10" />
        <rect x="-110" y="-4" width="220" height="6" fill="#6a5028" />
        <!-- Railing posts -->
        <g stroke="#d8c89a" stroke-width="1.4" opacity="0.85">
          <line x1="-100" y1="-30" x2="-100" y2="0" />
          <line x1="-50"  y1="-34" x2="-50"  y2="0" />
          <line x1="0"    y1="-36" x2="0"    y2="0" />
          <line x1="50"   y1="-34" x2="50"   y2="0" />
          <line x1="100"  y1="-30" x2="100"  y2="0" />
        </g>
        <!-- Lanterns -->
        <g>
          <circle cx="-100" cy="-40" r="3.4" fill="#fff3c8">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="3.2s" repeatCount="indefinite" />
          </circle>
          <circle cx="0" cy="-46" r="4" fill="#fff3c8">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="3.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="100" cy="-40" r="3.4" fill="#fff3c8">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="3.0s" repeatCount="indefinite" />
          </circle>
        </g>
      </g>

      <!-- Drifting golden leaves -->
      <g class="leaves">
        <use href="#loth-leaf" x="220" y="80" width="14" height="14" class="leaf l1" />
        <use href="#loth-leaf" x="540" y="120" width="11" height="11" class="leaf l2" />
        <use href="#loth-leaf" x="900" y="60" width="13" height="13" class="leaf l3" />
        <use href="#loth-leaf" x="1180" y="180" width="12" height="12" class="leaf l4" />
        <use href="#loth-leaf" x="700" y="240" width="10" height="10" class="leaf l5" />
        <use href="#loth-leaf" x="380" y="300" width="14" height="14" class="leaf l6" />
        <use href="#loth-leaf" x="1320" y="320" width="12" height="12" class="leaf l7" />
      </g>

      <!-- Forest floor -->
      <path d="M 0 920 Q 800 880, 1600 920 L 1600 1000 L 0 1000 Z"
            fill="#1a1208" opacity="0.85" />

      <rect x="0" y="0" width="1600" height="1000" fill="url(#loth-vignette)" />
    </svg>
  </div>
</template>

<style scoped>
.scene { position: absolute; inset: 0; overflow: hidden; }

.sky {
  position: absolute; inset: 0;
  background:
    radial-gradient(900px 700px at 50% -10%, rgba(255, 227, 154, 0.18), transparent 60%),
    linear-gradient(180deg, #1a1808 0%, #1c1a10 35%, #0e1024 70%, #050918 100%);
}

.stars {
  position: absolute; inset: 0;
  background-image:
    radial-gradient(1.4px 1.4px at 14% 20%, rgba(255, 243, 200, 0.7), transparent 60%),
    radial-gradient(1.2px 1.2px at 32% 8%, rgba(255, 227, 154, 0.6), transparent 60%),
    radial-gradient(1.6px 1.6px at 56% 14%, rgba(255, 255, 255, 0.5), transparent 60%),
    radial-gradient(1.2px 1.2px at 78% 22%, rgba(255, 243, 200, 0.7), transparent 60%);
  background-repeat: no-repeat;
  mix-blend-mode: screen;
  animation: tw 5s ease-in-out infinite;
}
@keyframes tw { 0%,100% { opacity: 0.7; } 50% { opacity: 0.95; } }

.vector { position: absolute; inset: 0; width: 100%; height: 100%; }

.leaf { transform-origin: center; animation: drift 22s linear infinite; opacity: 0.85; }
.l1 { animation-duration: 26s; animation-delay: -2s; }
.l2 { animation-duration: 22s; animation-delay: -7s; }
.l3 { animation-duration: 28s; animation-delay: -3s; }
.l4 { animation-duration: 24s; animation-delay: -11s; }
.l5 { animation-duration: 30s; animation-delay: -5s; }
.l6 { animation-duration: 23s; animation-delay: -9s; }
.l7 { animation-duration: 27s; animation-delay: -13s; }

@keyframes drift {
  0%   { transform: translate(0,0) rotate(0deg); opacity: 0; }
  10%  { opacity: 0.9; }
  100% { transform: translate(60px, 600px) rotate(360deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) { .leaf, .stars { animation: none !important; } }
</style>
