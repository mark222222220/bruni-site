// Минималистичные силуэты-иллюстрации товаров (viewBox 0 0 200 260).
// Цвет заливки = цвет выбранного варианта товара.
(function () {
  const P = {
    coat: `<path d="M70 40 L100 52 L130 40 L160 62 L168 200 L150 202 L146 120 L144 232 L56 232 L54 120 L50 202 L32 200 L40 62 Z"/><path class="ln" d="M100 52 L92 90 L100 232 M100 52 L108 90 M80 160 h14 M106 160 h14"/>`,
    trench: `<path d="M72 38 L100 50 L128 38 L158 60 L166 196 L148 198 L144 118 L150 236 L50 236 L56 118 L52 198 L34 196 L42 60 Z"/><path class="ln" d="M100 50 L88 92 L100 236 M100 50 L112 92 M54 130 H146 M92 130 v14 M86 100 h4 M110 100 h4 M86 116 h4 M110 116 h4"/>`,
    jacket: `<path d="M68 46 L100 56 L132 46 L162 66 L168 170 L150 172 L146 110 L146 176 L54 176 L54 110 L50 172 L32 170 L38 66 Z"/><path class="ln" d="M100 56 L86 80 M100 56 L114 80 M106 70 L98 176 M60 150 h20"/>`,
    blazer: `<path d="M70 44 L100 54 L130 44 L160 64 L166 186 L148 188 L144 112 L146 198 L54 198 L56 112 L52 188 L34 186 L40 64 Z"/><path class="ln" d="M100 54 L84 96 L100 140 L116 96 L100 54 M100 140 V198 M62 150 h22 M116 150 h22"/><circle class="dot" cx="100" cy="150" r="3"/>`,
    dress: `<path d="M80 34 L92 40 Q100 50 108 40 L120 34 L150 60 L140 76 L126 66 L124 112 L150 236 L50 236 L76 112 L74 66 L60 76 L50 60 Z"/><path class="ln" d="M76 112 H124"/>`,
    slipdress: `<path d="M84 30 L86 70 Q100 80 114 70 L116 30 M86 70 L80 110 L60 238 L140 238 L120 110 L114 70"/><path class="ln" d="M86 70 Q100 92 114 70"/>`,
    minidress: `<path d="M60 64 Q100 54 140 64 L132 96 L124 110 L148 182 L52 182 L76 110 L68 96 Z"/><path class="ln" d="M76 110 Q100 120 124 110 M90 112 L84 182 M110 112 L116 182"/>`,
    sweater: `<path d="M72 48 Q100 62 128 48 L168 76 L178 180 L158 184 L146 108 L148 194 L52 194 L54 108 L42 184 L22 180 L32 76 Z"/><path class="ln" d="M80 52 Q100 72 120 52 M52 184 H148 M30 172 l18 2 M170 172 l-18 2"/>`,
    cardigan: `<path d="M74 48 L100 58 L126 48 L162 72 L170 182 L152 184 L144 108 L146 196 L54 196 L56 108 L48 184 L30 182 L38 72 Z"/><path class="ln" d="M100 58 L90 110 V196 M100 58 L110 110"/><circle class="dot" cx="96" cy="124" r="3"/><circle class="dot" cx="96" cy="146" r="3"/><circle class="dot" cx="96" cy="168" r="3"/>`,
    turtleneck: `<path d="M84 30 H116 V54 L162 72 L170 186 L152 188 L144 106 L146 196 L54 196 L56 106 L48 188 L30 186 L38 72 L84 54 Z"/><path class="ln" d="M84 38 H116 M84 46 H116"/>`,
    shirt: `<path d="M76 44 L100 52 L124 44 L164 70 L172 186 L154 188 L144 104 L148 204 L52 204 L56 104 L46 188 L28 186 L36 70 Z"/><path class="ln" d="M76 44 L92 66 L100 52 L108 66 L124 44 M100 60 V204 M112 92 h18 v16 h-18 z"/>`,
    blouse: `<path d="M78 46 L100 54 L122 46 L160 66 Q184 130 168 172 L150 168 L144 104 L148 190 L52 190 L56 104 L50 168 L32 172 Q16 130 40 66 Z"/><path class="ln" d="M94 58 Q80 76 86 96 M106 58 Q120 76 114 96 M94 58 Q100 66 106 58"/>`,
    corset: `<path d="M78 40 L82 78 Q100 70 118 78 L122 40 M82 78 Q72 100 74 168 H126 Q128 100 118 78"/><path class="ln" d="M88 82 V166 M100 76 V168 M112 82 V166"/>`,
    jeans: `<path d="M64 34 H136 L148 238 H112 L100 96 L88 238 H52 Z"/><path class="ln" d="M64 48 H136 M100 48 V96 M72 56 Q80 72 92 60 M128 56 Q120 72 108 60"/>`,
    trousers: `<path d="M68 34 H132 L156 238 H108 L100 100 L92 238 H44 Z"/><path class="ln" d="M68 46 H132 M80 60 L70 238 M120 60 L130 238"/>`,
    joggers: `<path d="M66 40 H134 L142 214 L144 232 H112 L100 102 L88 232 H56 L58 214 Z"/><path class="ln" d="M66 54 H134 M58 214 H86 M114 214 H142 M96 54 l-4 14 M104 54 l4 14"/>`,
    skirt: `<path d="M72 50 H128 L152 228 H48 Z"/><path class="ln" d="M72 62 H128 M90 70 L80 228 M110 70 L120 228"/>`,
    miniskirt: `<path d="M70 70 H130 L150 170 H50 Z"/><path class="ln" d="M70 82 H130 M118 82 V150"/>`,
    boot: `<path d="M74 50 H118 V170 Q120 196 160 206 Q172 212 168 224 H106 L102 210 L94 224 H74 Z"/><path class="ln" d="M74 64 H118 M96 50 V170"/>`,
    tallboot: `<path d="M76 24 H122 V184 Q124 204 162 212 Q172 218 168 230 H112 V214 H100 V230 H76 Z"/><path class="ln" d="M76 38 H122"/>`,
    flat: `<path d="M28 160 Q30 140 70 138 L150 140 Q178 144 176 168 Q170 182 140 182 H52 Q28 182 28 160 Z"/><path class="ln" d="M70 140 Q100 166 150 142 M96 134 Q104 112 120 128"/>`,
    bag: `<path d="M46 98 H154 L164 214 H36 Z"/><path class="ln" d="M76 98 Q76 48 100 48 Q124 48 124 98 M46 116 H154"/>`,
    baguette: `<path d="M38 120 Q40 102 60 102 H140 Q160 102 162 120 L158 168 H42 Z"/><path class="ln" d="M70 102 Q70 66 100 66 Q130 66 130 102 M40 132 H160"/><rect class="dot" x="94" y="128" width="12" height="10" rx="2"/>`,
    scarf: `<path d="M70 30 H130 Q140 30 138 46 L120 140 L134 236 H104 L100 160 L84 236 H56 L78 120 L62 46 Q60 30 70 30 Z"/><path class="ln" d="M60 236 v8 M68 236 v8 M76 236 v8 M108 236 v8 M118 236 v8 M128 236 v8"/>`,
    bra: `<path d="M30 110 Q34 168 98 160 Q100 150 102 160 Q166 168 170 110 L176 164 Q100 184 24 164 Z"/><path d="M30 110 Q60 96 98 156 M170 110 Q140 96 102 156"/><path class="ln" d="M50 104 L66 50 M150 104 L134 50 M34 132 Q64 132 96 156 M166 132 Q136 132 104 156"/>`,
    bralette: `<path d="M30 168 L68 84 L98 160 L132 84 L170 168 Z"/><path class="ln" d="M68 84 L70 40 M132 84 L130 40 M40 156 Q68 140 96 156 M104 156 Q132 140 160 156"/>`,
    sportbra: `<path d="M44 66 Q60 54 74 62 Q100 92 126 62 Q140 54 156 66 L164 176 H36 Z"/><path class="ln" d="M40 156 H160 M74 62 Q100 120 126 62"/>`,
    panty: `<path d="M34 92 Q100 108 166 92 L156 136 Q120 150 108 190 H92 Q80 150 44 136 Z"/><path class="ln" d="M38 106 Q100 122 162 106 M46 132 Q70 144 92 188 M154 132 Q130 144 108 188"/>`,
    thong: `<path d="M30 92 Q100 104 170 92 L166 104 Q118 112 106 184 H94 Q82 112 34 104 Z"/>`,
    set: `<path d="M44 40 Q48 86 96 82 Q100 76 104 82 Q152 86 156 40 L160 82 Q100 96 40 82 Z"/><path d="M44 40 Q70 30 96 80 M156 40 Q130 30 104 80"/><path d="M40 134 Q100 146 160 134 L152 170 Q120 182 108 216 H92 Q80 182 48 170 Z"/><path class="ln" d="M40 118 Q100 134 160 118 M60 128 V140 M140 128 V140 M60 170 L56 244 M140 170 L144 244"/>`,
    teddy: `<path d="M74 26 L84 92 Q100 86 116 92 L126 26 L132 26 L120 96 Q138 120 130 168 Q118 182 108 214 H92 Q82 182 70 168 Q62 120 80 96 L68 26 Z"/><path class="ln" d="M84 92 Q100 140 116 92 M76 140 Q100 152 124 140"/>`,
    pajama: `<path d="M62 30 L100 40 L138 30 L168 52 L176 132 L156 134 L150 80 L150 130 L50 130 L50 80 L44 134 L24 132 L32 52 Z"/><path d="M58 142 H142 L152 244 H110 L100 172 L90 244 H48 Z"/><path class="ln" d="M62 30 L84 60 L100 40 L116 60 L138 30 M100 50 V130 M32 52 L44 134 M168 52 L156 134"/>`,
    robe: `<path d="M74 28 L100 40 L126 28 L176 70 L170 132 L148 124 L156 220 H44 L52 124 L30 132 L24 70 Z"/><path class="ln" d="M74 28 L120 220 M126 28 L96 120 M54 128 H146 M100 128 l-16 34 M110 128 l12 30"/>`,
    hoodie: `<path d="M72 50 Q70 14 100 14 Q130 14 128 50 L168 74 L178 186 L158 188 L146 112 L148 204 L52 204 L54 112 L42 188 L22 186 L32 74 Z"/><path class="ln" d="M78 52 Q100 80 122 52 M92 66 V96 M108 66 V96 M70 150 H130 L124 184 H76 Z"/>`,
    perfume: `<rect x="90" y="40" width="20" height="26" rx="2"/><path d="M80 66 H120 V80 H80 Z"/><rect x="54" y="80" width="92" height="140" rx="16"/><path class="ln" d="M70 110 H130"/>`,
    mist: `<path d="M88 28 H112 V50 H88 Z"/><path d="M84 50 H116 V68 H84 Z"/><path d="M72 68 H128 Q140 68 140 86 V222 Q140 236 126 236 H74 Q60 236 60 222 V86 Q60 68 72 68 Z"/><path class="ln" d="M76 130 H124 M76 146 H110"/><path class="ln" d="M120 34 l22 -6 M120 40 l26 2 M120 46 l22 10"/>`,
    lotion: `<path d="M92 22 H108 V40 H92 Z"/><path d="M84 40 H116 V54 H84 Z"/><path d="M66 54 H134 Q144 54 144 70 V224 Q144 238 130 238 H70 Q56 238 56 224 V70 Q56 54 66 54 Z"/><path class="ln" d="M72 120 H128 M72 136 H112"/>`,
    giftset: `<rect x="32" y="110" width="136" height="120" rx="6"/><path class="ln" d="M100 110 V230 M32 150 H168"/><path d="M100 110 Q70 70 80 92 Q86 106 100 110 Q130 70 120 92 Q114 106 100 110 Z"/>`,
    gloss: `<rect x="86" y="28" width="28" height="60" rx="6"/><path d="M80 88 H120 L116 230 Q100 240 84 230 Z"/><path class="ln" d="M86 140 H114"/>`
  };

  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  window.renderArt = function (key, color) {
    const fill = color || "#ccc";
    const line = lum(fill) > 0.55 ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.38)";
    const body = P[key] || P.dress;
    return `<svg class="art" viewBox="0 0 200 260" aria-hidden="true">
      <g style="--fill:${fill};--line:${line}">${body}</g></svg>`;
  };
})();
