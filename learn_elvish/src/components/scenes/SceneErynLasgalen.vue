<script setup lang="ts">
// Eryn Lasgalen — the Wood of Greenleaves (formerly Mirkwood). Dense conifer
// forest, cool greens, drifting fireflies, slivers of moonlight through trunks.
</script>

<template>
  <div class="scene" aria-hidden="true">
    <div class="sky"></div>

    <svg
      class="vector"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="moon-eryn" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#e8f0ff" stop-opacity="1" />
          <stop offset="40%" stop-color="#b8d8c8" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#0a1820" stop-opacity="0" />
        </radialGradient>

        <linearGradient id="trunk-eryn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a3028" />
          <stop offset="100%" stop-color="#040a08" />
        </linearGradient>

        <linearGradient id="floor-eryn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0a1a14" />
          <stop offset="100%" stop-color="#020604" />
        </linearGradient>

        <radialGradient id="canopy-eryn" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#2a4a3a" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#020604" stop-opacity="1" />
        </radialGradient>

        <linearGradient id="moon-shaft" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#cfe2d2" stop-opacity="0.0" />
          <stop offset="40%" stop-color="#cfe2d2" stop-opacity="0.10" />
          <stop offset="100%" stop-color="#cfe2d2" stop-opacity="0.0" />
        </linearGradient>

        <radialGradient id="vignette-e" cx="50%" cy="50%" r="70%">
          <stop offset="55%" stop-color="#000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.65" />
        </radialGradient>

        <symbol id="conifer" viewBox="0 0 60 200">
          <rect x="28" y="120" width="6" height="80" fill="#0a1410" />
          <path d="M 30 0
                   L 12 50 L 22 50 L 6 96 L 18 96 L 0 140 L 60 140
                   L 42 96 L 54 96 L 38 50 L 48 50 Z"
                fill="#1a2e22" />
        </symbol>
      </defs>

      <!-- Moon high left, peeking through canopy -->
      <g transform="translate(280 160)">
        <circle r="180" fill="url(#moon-eryn)" />
        <circle r="46" fill="#e8f0ff" opacity="0.95" />
      </g>

      <!-- Moon shafts cutting down through trees -->
      <g opacity="0.55">
        <path d="M 220 150 L 100 1000 L 360 1000 L 460 150 Z" fill="url(#moon-shaft)" />
        <path d="M 700 200 L 620 1000 L 820 1000 L 880 200 Z" fill="url(#moon-shaft)" />
        <path d="M 1200 180 L 1140 1000 L 1320 1000 L 1380 180 Z" fill="url(#moon-shaft)" />
      </g>

      <!-- Far conifers -->
      <g opacity="0.45">
        <use href="#conifer" x="40"   y="380" width="50"  height="200" />
        <use href="#conifer" x="120"  y="360" width="60"  height="220" />
        <use href="#conifer" x="220"  y="400" width="50"  height="200" />
        <use href="#conifer" x="320"  y="360" width="60"  height="220" />
        <use href="#conifer" x="430"  y="380" width="50"  height="200" />
        <use href="#conifer" x="540"  y="360" width="60"  height="220" />
        <use href="#conifer" x="660"  y="400" width="50"  height="200" />
        <use href="#conifer" x="780"  y="360" width="60"  height="220" />
        <use href="#conifer" x="900"  y="380" width="50"  height="200" />
        <use href="#conifer" x="1020" y="360" width="60"  height="220" />
        <use href="#conifer" x="1140" y="400" width="50"  height="200" />
        <use href="#conifer" x="1260" y="360" width="60"  height="220" />
        <use href="#conifer" x="1380" y="380" width="50"  height="200" />
        <use href="#conifer" x="1500" y="360" width="60"  height="220" />
      </g>

      <!-- Mid-distance trunks -->
      <g opacity="0.7">
        <rect x="80"   y="450" width="10" height="500" fill="url(#trunk-eryn)" />
        <rect x="240"  y="430" width="14" height="540" fill="url(#trunk-eryn)" />
        <rect x="420"  y="460" width="10" height="510" fill="url(#trunk-eryn)" />
        <rect x="600"  y="420" width="16" height="560" fill="url(#trunk-eryn)" />
        <rect x="780"  y="440" width="12" height="540" fill="url(#trunk-eryn)" />
        <rect x="960"  y="430" width="14" height="540" fill="url(#trunk-eryn)" />
        <rect x="1120" y="460" width="10" height="510" fill="url(#trunk-eryn)" />
        <rect x="1300" y="430" width="14" height="540" fill="url(#trunk-eryn)" />
        <rect x="1480" y="450" width="10" height="510" fill="url(#trunk-eryn)" />
      </g>

      <!-- Foreground giant trunks framing edges -->
      <g>
        <path d="M 0 1000 L 40 1000 L 80 700 L 100 400 L 120 200 L 130 0
                 L 200 0 L 200 200 L 180 400 L 170 700 L 200 1000 Z"
              fill="#040a08" />
        <ellipse cx="120" cy="180" rx="280" ry="180" fill="url(#canopy-eryn)" />
        <path d="M 1600 1000 L 1560 1000 L 1520 700 L 1500 400 L 1480 200 L 1470 0
                 L 1400 0 L 1400 200 L 1420 400 L 1430 700 L 1400 1000 Z"
              fill="#040a08" />
        <ellipse cx="1480" cy="180" rx="280" ry="180" fill="url(#canopy-eryn)" />
      </g>

      <!-- Forest floor -->
      <path d="M 0 870 Q 800 830, 1600 870 L 1600 1000 L 0 1000 Z"
            fill="url(#floor-eryn)" />

      <!-- Fireflies -->
      <g class="fireflies">
        <circle class="ff f1" cx="380" cy="600" r="2" fill="#aaffcc" />
        <circle class="ff f2" cx="540" cy="700" r="2.4" fill="#aaffcc" />
        <circle class="ff f3" cx="780" cy="640" r="2" fill="#aaffcc" />
        <circle class="ff f4" cx="920" cy="720" r="2.4" fill="#caffbb" />
        <circle class="ff f5" cx="1080" cy="660" r="2" fill="#aaffcc" />
        <circle class="ff f6" cx="1240" cy="700" r="2.4" fill="#caffbb" />
        <circle class="ff f7" cx="660" cy="780" r="2" fill="#aaffcc" />
        <circle class="ff f8" cx="1140" cy="800" r="2.4" fill="#caffbb" />
      </g>

      <rect x="0" y="0" width="1600" height="1000" fill="url(#vignette-e)" />
    </svg>
  </div>
</template>

<style scoped>
.scene { position: absolute; inset: 0; overflow: hidden; }

.sky {
  position: absolute; inset: 0;
  background:
    radial-gradient(700px 500px at 18% 12%, rgba(216, 240, 224, 0.10), transparent 70%),
    linear-gradient(180deg, #050b16 0%, #061614 40%, #04100c 70%, #020806 100%);
}

.vector { position: absolute; inset: 0; width: 100%; height: 100%; }

.ff {
  filter: drop-shadow(0 0 3px #aaffcc);
  animation: blink 3.4s ease-in-out infinite;
}
.f1 { animation-delay: -0.3s; }
.f2 { animation-delay: -1.1s; }
.f3 { animation-delay: -2.0s; animation-duration: 4.2s; }
.f4 { animation-delay: -0.7s; animation-duration: 3.8s; }
.f5 { animation-delay: -2.6s; }
.f6 { animation-delay: -1.4s; animation-duration: 4.6s; }
.f7 { animation-delay: -3.0s; }
.f8 { animation-delay: -0.5s; animation-duration: 3.6s; }

@keyframes blink {
  0%, 100% { opacity: 0.2; transform: translate(0, 0); }
  50%      { opacity: 1.0; transform: translate(8px, -6px); }
}

@media (prefers-reduced-motion: reduce) { .ff { animation: none !important; } }
</style>
