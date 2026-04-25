<script setup lang="ts">
// Procedural Elvish scene — drawn entirely in SVG so it ships with the app
// and scales to any window size. Layered far → near for atmospheric depth.
</script>

<template>
  <div class="scene" aria-hidden="true">
    <!-- Sky gradient + moon halo (CSS) -->
    <div class="sky"></div>

    <!-- Drifting star field (CSS pseudo) -->
    <div class="stars stars-a"></div>
    <div class="stars stars-b"></div>

    <!-- Vector landscape -->
    <svg
      class="vector"
      viewBox="0 0 1600 1000"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <!-- Moon -->
        <radialGradient id="moon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#fff8e1" stop-opacity="1" />
          <stop offset="40%" stop-color="#ffe8a8" stop-opacity="0.85" />
          <stop offset="70%" stop-color="#d8e4ff" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#0b1124" stop-opacity="0" />
        </radialGradient>

        <!-- Distant peak silhouette -->
        <linearGradient id="peak-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a2348" />
          <stop offset="100%" stop-color="#0c1226" />
        </linearGradient>
        <linearGradient id="peak-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#101a36" />
          <stop offset="100%" stop-color="#06091a" />
        </linearGradient>
        <linearGradient id="peak-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#08101f" />
          <stop offset="100%" stop-color="#02040c" />
        </linearGradient>

        <!-- Snow caps -->
        <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#e8f0ff" stop-opacity="0.85" />
          <stop offset="100%" stop-color="#a8b8d8" stop-opacity="0" />
        </linearGradient>

        <!-- Mist over the valley -->
        <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#9bb0d8" stop-opacity="0" />
          <stop offset="50%" stop-color="#9bb0d8" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#9bb0d8" stop-opacity="0" />
        </linearGradient>

        <!-- Archway interior -->
        <linearGradient id="arch-glow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffe8a8" stop-opacity="0.0" />
          <stop offset="55%" stop-color="#ffd980" stop-opacity="0.16" />
          <stop offset="100%" stop-color="#ffd980" stop-opacity="0.32" />
        </linearGradient>

        <!-- Tree foliage -->
        <radialGradient id="canopy" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#2a4a3a" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#050a08" stop-opacity="1" />
        </radialGradient>

        <!-- Vignette for edges -->
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="60%" stop-color="#000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000" stop-opacity="0.55" />
        </radialGradient>

        <!-- Leaf shape, used many times -->
        <symbol id="leaf" viewBox="0 0 20 20">
          <path
            d="M10 1 C 4 6, 4 14, 10 19 C 16 14, 16 6, 10 1 Z"
            fill="#caa650"
            opacity="0.85"
          />
          <path d="M10 1 L 10 19" stroke="#7a5a20" stroke-width="0.6" opacity="0.7" />
        </symbol>
      </defs>

      <!-- Moon -->
      <g transform="translate(1280 200)">
        <circle r="240" fill="url(#moon-glow)" />
        <circle r="62" fill="#fff8e1" opacity="0.95" />
        <circle r="62" fill="#fff8e1" opacity="0.5" filter="url(#blur)" />
      </g>

      <!-- Far mountain ridge -->
      <path
        fill="url(#peak-far)"
        d="M 0 620
           L 80 540 140 580 220 460 320 530 400 470 500 540
             580 430 680 500 780 450 880 530 980 460 1100 540
             1200 470 1320 530 1440 480 1560 540 1600 520
           L 1600 1000 0 1000 Z"
        opacity="0.95"
      />
      <!-- Snow caps on far ridge -->
      <g opacity="0.7">
        <path fill="url(#snow)"
          d="M 195 470 L 220 460 L 265 510 L 230 500 Z" />
        <path fill="url(#snow)"
          d="M 555 450 L 580 430 L 630 490 L 590 480 Z" />
        <path fill="url(#snow)"
          d="M 1175 480 L 1200 470 L 1240 520 L 1210 510 Z" />
      </g>

      <!-- Mist band -->
      <rect x="0" y="560" width="1600" height="160" fill="url(#mist)" />

      <!-- Mid mountain ridge -->
      <path
        fill="url(#peak-mid)"
        d="M 0 760
           L 120 700 220 740 340 660 460 730 580 690 700 760
             820 680 940 740 1060 700 1180 760 1300 690 1440 740
             1560 700 1600 720
           L 1600 1000 0 1000 Z"
      />

      <!-- Elven archway, centered, glow within -->
      <g transform="translate(800 770)">
        <!-- Soft glow halo -->
        <ellipse cx="0" cy="-110" rx="200" ry="160"
                 fill="#ffd980" opacity="0.06" />
        <!-- Archway opening (light spilling out) -->
        <path
          d="M -90 0
             L -90 -150
             A 90 110 0 0 1 90 -150
             L 90 0 Z"
          fill="url(#arch-glow)"
        />
        <!-- Arch frame -->
        <path
          d="M -110 0
             L -110 -160
             A 110 130 0 0 1 110 -160
             L 110 0
             L 90 0
             L 90 -150
             A 90 110 0 0 0 -90 -150
             L -90 0 Z"
          fill="#0a0f1f"
          stroke="#caa650"
          stroke-width="1.2"
          opacity="0.95"
        />
        <!-- Side spires -->
        <path d="M -132 0 L -126 -200 L -118 -190 L -118 0 Z" fill="#06091a" stroke="#caa650" stroke-width="0.6" />
        <path d="M  132 0 L  126 -200 L  118 -190 L  118 0 Z" fill="#06091a" stroke="#caa650" stroke-width="0.6" />
        <!-- Keystone leaf flourish -->
        <g transform="translate(0 -276)">
          <use href="#leaf" x="-10" y="-10" width="24" height="24" />
        </g>
        <!-- Filigree along arch crown -->
        <path
          d="M -90 -150 Q 0 -260 90 -150"
          fill="none"
          stroke="#caa650"
          stroke-width="0.8"
          opacity="0.7"
          stroke-dasharray="2 5"
        />
      </g>

      <!-- Near tree silhouettes (left + right) -->
      <g>
        <!-- Left mallorn -->
        <g transform="translate(180 1000)">
          <path d="M -8 0 L -2 -380 L 2 -380 L 8 0 Z" fill="#04060f" />
          <ellipse cx="0" cy="-380" rx="170" ry="130" fill="url(#canopy)" />
          <ellipse cx="-60" cy="-440" rx="80" ry="70" fill="url(#canopy)" />
          <ellipse cx="70" cy="-420" rx="90" ry="80" fill="url(#canopy)" />
          <!-- Hanging lantern dot -->
          <circle cx="-30" cy="-330" r="3" fill="#ffd980">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="3.6s" repeatCount="indefinite" />
          </circle>
          <circle cx="40" cy="-360" r="2.4" fill="#ffe8a8">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="4.2s" repeatCount="indefinite" />
          </circle>
        </g>

        <!-- Right mallorn -->
        <g transform="translate(1450 1000)">
          <path d="M -7 0 L -2 -340 L 2 -340 L 7 0 Z" fill="#04060f" />
          <ellipse cx="0" cy="-340" rx="160" ry="120" fill="url(#canopy)" />
          <ellipse cx="60" cy="-400" rx="90" ry="80" fill="url(#canopy)" />
          <ellipse cx="-70" cy="-380" rx="80" ry="70" fill="url(#canopy)" />
          <circle cx="20" cy="-300" r="2.6" fill="#ffd980">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="4.0s" repeatCount="indefinite" />
          </circle>
          <circle cx="-30" cy="-340" r="2.2" fill="#ffe8a8">
            <animate attributeName="opacity" values="0.7;1;0.7" dur="3.4s" repeatCount="indefinite" />
          </circle>
        </g>
      </g>

      <!-- Near foreground ridge -->
      <path
        fill="url(#peak-near)"
        d="M 0 880
           L 100 850 200 870 320 830 440 870 560 850 700 880
             840 850 980 880 1120 850 1260 880 1400 850 1560 880 1600 870
           L 1600 1000 0 1000 Z"
      />

      <!-- Drifting leaves -->
      <g class="leaves">
        <use href="#leaf" x="120" y="120" width="14" height="14" class="leaf l1" />
        <use href="#leaf" x="320" y="60" width="10" height="10" class="leaf l2" />
        <use href="#leaf" x="540" y="180" width="12" height="12" class="leaf l3" />
        <use href="#leaf" x="980" y="100" width="11" height="11" class="leaf l4" />
        <use href="#leaf" x="1180" y="220" width="13" height="13" class="leaf l5" />
        <use href="#leaf" x="700" y="280" width="9"  height="9"  class="leaf l6" />
      </g>

      <!-- Edge vignette -->
      <rect x="0" y="0" width="1600" height="1000" fill="url(#vignette)" />
    </svg>
  </div>
</template>

<style scoped>
.scene {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

.sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(900px 700px at 80% 12%, rgba(216, 228, 255, 0.20), transparent 60%),
    radial-gradient(1200px 700px at 80% 12%, rgba(231, 198, 106, 0.10), transparent 60%),
    linear-gradient(180deg, #060812 0%, #0a1024 35%, #0d1838 65%, #050918 100%);
}

.stars {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1.5px 1.5px at 12% 18%, rgba(255, 255, 255, 0.85), transparent 60%),
    radial-gradient(1.2px 1.2px at 22% 72%, rgba(255, 255, 255, 0.7),  transparent 60%),
    radial-gradient(1.5px 1.5px at 38% 30%, rgba(255, 255, 255, 0.9),  transparent 60%),
    radial-gradient(1.2px 1.2px at 55% 12%, rgba(255, 255, 255, 0.6),  transparent 60%),
    radial-gradient(1.4px 1.4px at 67% 24%, rgba(255, 255, 255, 0.7),  transparent 60%),
    radial-gradient(1.6px 1.6px at 8% 44%,  rgba(255, 255, 255, 0.85), transparent 60%),
    radial-gradient(1.2px 1.2px at 30% 8%,  rgba(255, 255, 255, 0.7),  transparent 60%),
    radial-gradient(1.4px 1.4px at 75% 50%, rgba(255, 255, 255, 0.6),  transparent 60%),
    radial-gradient(1.5px 1.5px at 85% 18%, rgba(231, 198, 106, 0.75), transparent 60%),
    radial-gradient(1.2px 1.2px at 92% 38%, rgba(255, 255, 255, 0.5),  transparent 60%);
  background-repeat: no-repeat;
  animation: twinkle-a 6s ease-in-out infinite;
  mix-blend-mode: screen;
}
.stars-b {
  background-image:
    radial-gradient(1px 1px at 18% 9%, rgba(255, 255, 255, 0.8), transparent 60%),
    radial-gradient(1px 1px at 42% 50%, rgba(255, 255, 255, 0.6), transparent 60%),
    radial-gradient(1px 1px at 60% 14%, rgba(255, 255, 255, 0.7), transparent 60%),
    radial-gradient(1px 1px at 80% 9%, rgba(255, 255, 255, 0.6), transparent 60%);
  animation: twinkle-b 4.6s ease-in-out infinite;
}

@keyframes twinkle-a {
  0%, 100% { opacity: 0.85; }
  50%      { opacity: 0.55; }
}
@keyframes twinkle-b {
  0%, 100% { opacity: 0.45; }
  50%      { opacity: 0.85; }
}

.vector {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.leaf {
  transform-origin: center;
  animation: drift 18s linear infinite;
  opacity: 0.7;
}
.leaf.l1 { animation-duration: 22s; animation-delay: -2s; }
.leaf.l2 { animation-duration: 26s; animation-delay: -8s; }
.leaf.l3 { animation-duration: 19s; animation-delay: -4s; }
.leaf.l4 { animation-duration: 24s; animation-delay: -12s; }
.leaf.l5 { animation-duration: 28s; animation-delay: -6s; }
.leaf.l6 { animation-duration: 21s; animation-delay: -10s; }

@keyframes drift {
  0%   { transform: translate(0, 0) rotate(0deg);    opacity: 0; }
  10%  { opacity: 0.85; }
  50%  { transform: translate(40px, 220px) rotate(180deg); }
  90%  { opacity: 0.6; }
  100% { transform: translate(80px, 540px) rotate(360deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .leaf, .stars, .stars-b { animation: none !important; }
}
</style>
