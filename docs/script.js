// ── Bubbles ───────────────────────────────────────────
(function () {
    const el = document.getElementById('bubbles');
    if (!el) return;
    for (let i = 0; i < 15; i++) {
        const b = document.createElement('div');
        b.className = 'bubble';
        const s = Math.random() * 10 + 3;
        b.style.width = s + 'px';
        b.style.height = s + 'px';
        b.style.left = Math.random() * 100 + '%';
        b.style.animationDuration = (Math.random() * 18 + 12) + 's';
        b.style.animationDelay = (Math.random() * 25) + 's';
        el.appendChild(b);
    }
})();

// ── Scroll reveal ─────────────────────────────────────
const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.style.opacity = '1';
            e.target.style.transform = 'translateY(0)';
        }
    });
}, { threshold: 0.08 });

document.querySelectorAll('.pipeline-step, .tech-card, .grade-row, .install-step').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(14px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
});
