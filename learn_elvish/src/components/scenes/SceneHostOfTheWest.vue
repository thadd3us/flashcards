<script setup lang="ts">
// Host of the West — a column of Elven soldiers under banners and torchlight,
// ridge in the distance, dawn breaking. All silhouettes — procedural SVG.
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
        <!-- Dawn glow on horizon -->
        <linearGradient id="dawn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%"   stop-color="#ffb878" stop-opacity="0.0" />
          <stop offset="40%"  stop-color="#ff9a4a" stop-opacity="0.40" />
          <stop offset="80%"  stop-color="#ffd980" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#ffd980" stop-opacity="0.00" />
        </linearGradient>

        <linearGradient id="ridge-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1d2244" />
          <stop offset="100%" stop-color="#0a0e1f" />
        </linearGradient>
        <linearGradient id="ridge-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0e1226" />
          <stop offset="100%" stop-color="#04060e" />
        </linearGradient>

        <!-- Torch flicker glow -->
        <radialGradient id="torch" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffd980" stop-opacity="0.85" />
          <stop offset="40%" stop-color="#ff8c3a" stop-opacity="0.40" />
          <stop offset="100%" stop-color="#ff8c3a" stop-opacity="0" />
        </radialGradient>

        <!-- Banner cloth gradient -->
        <linearGradient id="banner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3b6aa8" />
          <stop offset="100%" stop-color="#0e1f44" />
        </linearGradient>
        <linearGradient id="banner2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#a82a2a" />
          <stop offset="100%" stop-color="#3a0808" />
        </linearGradient>
        <linearGradient id="banner3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c9a64a" />
          <stop offset="100%" stop-color="#5a3e10" />
        </linearGradient>

        <!-- An Elven soldier silhouette: tall helm with crest, cloak, spear,
             oval shield. Reusable symbol. -->
        <symbol id="soldier" viewBox="0 0 60 160">
          <!-- Spear -->
          <line x1="50" y1="5" x2="50" y2="158"
                stroke="#0a0a14" stroke-width="2.2" />
          <!-- Spear tip -->
          <path d="M 50 5 L 47 -8 L 53 -8 Z" fill="#0a0a14" />
          <!-- Pennant -->
          <path d="M 50 8 L 64 14 L 50 22 Z" fill="#a82a2a" opacity="0.9" />
          <!-- Body / cloak -->
          <path d="M 18 60
                   Q 12 90, 14 130
                   L 14 158 L 38 158 L 38 130
                   Q 40 90, 36 60 Z" fill="#06080f" />
          <!-- Shoulders -->
          <path d="M 12 56 Q 28 50, 44 56 L 42 70 Q 28 64, 14 70 Z" fill="#06080f" />
          <!-- Arm holding spear -->
          <path d="M 38 64 Q 46 70, 50 80 L 50 100 Q 44 92, 40 84 Z" fill="#06080f" />
          <!-- Shield (oval) -->
          <ellipse cx="14" cy="92" rx="9" ry="20" fill="#0a0a14" />
          <ellipse cx="14" cy="92" rx="6" ry="16" fill="none" stroke="#caa650" stroke-width="0.6" opacity="0.6" />
          <!-- Head + helm -->
          <ellipse cx="28" cy="46" rx="10" ry="12" fill="#06080f" />
          <!-- Helm — winged crest profile -->
          <path d="M 18 46
                   Q 18 30, 28 28
                   Q 38 30, 38 46
                   L 36 50 Q 28 46, 20 50 Z" fill="#0a0a14" />
          <!-- Helm crest sweep (thin line) -->
          <path d="M 28 28 Q 24 18, 14 16"
                fill="none" stroke="#0a0a14" stroke-width="2" />
          <!-- Subtle gold rim -->
          <path d="M 18 46 Q 28 50, 38 46"
                fill="none" stroke="#caa650" stroke-width="0.5" opacity="0.5" />
        </symbol>

        <radialGradient id="vignette-h" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stop-color="#000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.6" />
        </radialGradient>
      </defs>

      <!-- Dawn band along horizon -->
      <rect x="0" y="500" width="1600" height="280" fill="url(#dawn)" />

      <!-- Far ridge -->
      <path
        fill="url(#ridge-far)"
        d="M 0 720
           L 100 660 200 690 320 600 440 690 560 640 700 720
             840 620 980 700 1100 660 1260 720 1400 660 1560 720 1600 700
           L 1600 1000 0 1000 Z"
      />

      <!-- Mid ridge -->
      <path
        fill="url(#ridge-mid)"
        d="M 0 820
           L 140 770 260 810 380 740 520 800 660 770 800 820
             940 760 1080 810 1220 770 1360 820 1500 780 1600 800
           L 1600 1000 0 1000 Z"
      />

      <!-- Far torchlight bloom (general atmosphere) -->
      <g opacity="0.55">
        <ellipse cx="180"  cy="850" rx="160" ry="50" fill="url(#torch)" />
        <ellipse cx="500"  cy="860" rx="180" ry="55" fill="url(#torch)" />
        <ellipse cx="820"  cy="850" rx="220" ry="60" fill="url(#torch)" />
        <ellipse cx="1140" cy="860" rx="180" ry="55" fill="url(#torch)" />
        <ellipse cx="1450" cy="850" rx="160" ry="50" fill="url(#torch)" />
      </g>

      <!-- Banners on tall poles, behind the line -->
      <g>
        <!-- Banner 1: blue with leaf -->
        <g transform="translate(260 760)">
          <line x1="0" y1="0" x2="0" y2="-220" stroke="#2a200a" stroke-width="3" />
          <path d="M 0 -220 L 5 -226 L 0 -232 L -5 -226 Z" fill="#caa650" />
          <path d="M 0 -200 L 80 -200 L 70 -120 L 0 -120 Z" fill="url(#banner)" />
          <!-- Leaf emblem -->
          <path d="M 35 -178 C 22 -168, 22 -148, 35 -138 C 48 -148, 48 -168, 35 -178 Z"
                fill="#caa650" opacity="0.85" />
          <line x1="35" y1="-178" x2="35" y2="-138" stroke="#7a5a20" stroke-width="0.8" />
        </g>
        <!-- Banner 2: red with star -->
        <g transform="translate(720 760)">
          <line x1="0" y1="0" x2="0" y2="-260" stroke="#2a200a" stroke-width="3" />
          <path d="M 0 -260 L 5 -266 L 0 -272 L -5 -266 Z" fill="#caa650" />
          <path d="M 0 -240 L 90 -240 L 80 -150 L 0 -150 Z" fill="url(#banner2)" />
          <!-- 8-point star -->
          <g transform="translate(40 -195)" fill="#ffe39a">
            <polygon points="0,-18 4,-4 18,0 4,4 0,18 -4,4 -18,0 -4,-4" opacity="0.95" />
          </g>
        </g>
        <!-- Banner 3: gold with tree of Gondor / White Tree (just suggested) -->
        <g transform="translate(1140 760)">
          <line x1="0" y1="0" x2="0" y2="-230" stroke="#2a200a" stroke-width="3" />
          <path d="M 0 -230 L 5 -236 L 0 -242 L -5 -236 Z" fill="#caa650" />
          <path d="M 0 -210 L 85 -210 L 75 -130 L 0 -130 Z" fill="url(#banner3)" />
          <!-- Tree silhouette -->
          <g transform="translate(38 -205)" fill="#1a1208" opacity="0.85">
            <path d="M 0 0 L 0 50 M 0 8 Q -8 4, -14 -4 M 0 14 Q 9 10, 16 0
                     M 0 22 Q -10 16, -18 4 M 0 28 Q 11 20, 18 6"
                  stroke="#1a1208" stroke-width="1.6" fill="none" />
          </g>
        </g>
      </g>

      <!-- Soldier line — many small figures -->
      <g class="line">
        <use href="#soldier" x="40"   y="760" width="56" height="160" />
        <use href="#soldier" x="110"  y="760" width="56" height="160" />
        <use href="#soldier" x="180"  y="760" width="56" height="160" />
        <use href="#soldier" x="250"  y="760" width="56" height="160" />
        <use href="#soldier" x="320"  y="760" width="56" height="160" />
        <use href="#soldier" x="390"  y="760" width="56" height="160" />
        <use href="#soldier" x="460"  y="760" width="56" height="160" />
        <use href="#soldier" x="530"  y="760" width="56" height="160" />
        <use href="#soldier" x="600"  y="760" width="56" height="160" />
        <use href="#soldier" x="670"  y="760" width="56" height="160" />
        <use href="#soldier" x="740"  y="760" width="56" height="160" />
        <use href="#soldier" x="810"  y="760" width="56" height="160" />
        <use href="#soldier" x="880"  y="760" width="56" height="160" />
        <use href="#soldier" x="950"  y="760" width="56" height="160" />
        <use href="#soldier" x="1020" y="760" width="56" height="160" />
        <use href="#soldier" x="1090" y="760" width="56" height="160" />
        <use href="#soldier" x="1160" y="760" width="56" height="160" />
        <use href="#soldier" x="1230" y="760" width="56" height="160" />
        <use href="#soldier" x="1300" y="760" width="56" height="160" />
        <use href="#soldier" x="1370" y="760" width="56" height="160" />
        <use href="#soldier" x="1440" y="760" width="56" height="160" />
        <use href="#soldier" x="1510" y="760" width="56" height="160" />
      </g>

      <!-- Foreground torch bearers — bigger -->
      <g>
        <g transform="translate(120 760)">
          <use href="#soldier" width="80" height="220" />
          <!-- Torch -->
          <line x1="60" y1="40" x2="60" y2="80" stroke="#3a2a10" stroke-width="3" />
          <ellipse cx="60" cy="36" rx="12" ry="18" fill="url(#torch)">
            <animate attributeName="ry" values="16;20;16" dur="0.7s" repeatCount="indefinite" />
          </ellipse>
        </g>
        <g transform="translate(1420 760)">
          <use href="#soldier" width="80" height="220" />
          <line x1="60" y1="40" x2="60" y2="80" stroke="#3a2a10" stroke-width="3" />
          <ellipse cx="60" cy="36" rx="12" ry="18" fill="url(#torch)">
            <animate attributeName="ry" values="16;20;16" dur="0.6s" repeatCount="indefinite" />
          </ellipse>
        </g>
      </g>

      <rect x="0" y="0" width="1600" height="1000" fill="url(#vignette-h)" />
    </svg>
  </div>
</template>

<style scoped>
.scene { position: absolute; inset: 0; overflow: hidden; }

.sky {
  position: absolute; inset: 0;
  background:
    radial-gradient(1100px 600px at 50% 80%, rgba(255, 154, 74, 0.10), transparent 70%),
    radial-gradient(900px 500px at 50% 20%, rgba(86, 60, 110, 0.18), transparent 70%),
    linear-gradient(180deg, #0a0820 0%, #16142a 40%, #2a1a28 75%, #3a1f18 100%);
}

.vector { position: absolute; inset: 0; width: 100%; height: 100%; }
</style>
