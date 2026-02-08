// =============================================
// VOORS - main.js (clean)
// Animations premium (sans changer l’architecture HTML)
// Palette: Or / Gris / Noir
// Curseur custom: désactivé
// =============================================

(() => {
  "use strict";

  // ---------- Helpers ----------
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;

  // ---------- Core ----------
  class AnimationManager {
    constructor() {
      this.isReduced = prefersReducedMotion();
      this.isMobile = window.matchMedia?.("(max-width: 900px)")?.matches || false;

      this.rafIds = new Set();
      this.cleanupFns = [];
      this.scrollY = window.scrollY || 0;

      // Canvas particles
      this.canvas = null;
      this.ctx = null;
      this.particles = [];
      this.particleCfg = { count: 42 };
    }

    init() {
      // Accessibility: disable heavy effects if reduced motion
      document.documentElement.classList.toggle("reduced-motion", this.isReduced);

      // Force-disable custom cursor everywhere (requested)
      document.body.classList.add("no-custom-cursor");

      this.initLazyLoad();
      this.initNavigation();
      this.initReveal();
      this.initTyping();
      this.initCounters();

      if (!this.isReduced) {
        this.initParticles();
        this.initParallax();
        this.initTiltCards();
        this.initMicroInteractions();
        this.initIndustrialAnimations();
        this.initProgressAnimations();
        this.initFormAnimations();
        this.initEnhancedHero();
        this.initLogoCarousel(); // ← Ajouter cette ligne
      }

      // Recompute on resize (throttled)
      let resizeT = null;
      const onResize = () => {
        window.clearTimeout(resizeT);
        resizeT = window.setTimeout(() => {
          this.isMobile = window.matchMedia?.("(max-width: 900px)")?.matches || false;
        }, 180);
      };
      window.addEventListener("resize", onResize, { passive: true });
      this.cleanupFns.push(() => window.removeEventListener("resize", onResize));
    }

    destroy() {
      // Stop RAFs
      for (const id of this.rafIds) cancelAnimationFrame(id);
      this.rafIds.clear();

      // Cleanup listeners/observers
      for (const fn of this.cleanupFns) {
        try { fn(); } catch (_) {}
      }
      this.cleanupFns = [];
    }

    // ---------- Lazy load images (data-src) ----------
    initLazyLoad() {
      const imgs = qsa("img[data-src]");
      if (!imgs.length) return;

      if (!("IntersectionObserver" in window)) {
        imgs.forEach(img => { img.src = img.dataset.src; img.removeAttribute("data-src"); });
        return;
      }

      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          const img = e.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute("data-src");
          }
          io.unobserve(img);
        });
      }, { rootMargin: "200px 0px" });

      imgs.forEach(img => io.observe(img));
      this.cleanupFns.push(() => io.disconnect());
    }

    // ---------- Navigation (burger + smooth scroll) ----------
    initNavigation() {
      const burger = qs("[data-burger]");
      const mobile = qs("[data-mobile]");
      if (burger && mobile) {
        const close = () => {
          burger.setAttribute("aria-expanded", "false");
          mobile.classList.remove("is-open");
          document.body.classList.remove("menu-open");
        };
        const toggle = () => {
          const isOpen = burger.getAttribute("aria-expanded") === "true";
          if (isOpen) close();
          else {
            burger.setAttribute("aria-expanded", "true");
            mobile.classList.add("is-open");
            document.body.classList.add("menu-open");
          }
        };

        burger.addEventListener("click", toggle);
        mobile.addEventListener("click", (e) => {
          const a = e.target.closest("a");
          if (a) close();
        });
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") close();
        });

        this.cleanupFns.push(() => {
          burger.removeEventListener("click", toggle);
        });
      }

      // Smooth scroll for same-page anchors
      const onClick = (e) => {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = a.getAttribute("href");
        if (!id || id === "#" || id.length < 2) return;

        const target = qs(id);
        if (!target) return;

        e.preventDefault();
        target.scrollIntoView({ behavior: this.isReduced ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", id);
      };
      document.addEventListener("click", onClick);
      this.cleanupFns.push(() => document.removeEventListener("click", onClick));
    }

    // ---------- Reveal on scroll ----------
    initReveal() {
      const items = qsa(".reveal");
      if (!items.length) return;

      // Auto-stagger: for elements inside grids/lists, add delay if none is set
      items.forEach((el, idx) => {
        if (el.style.transitionDelay) return;
        const parent = el.parentElement;
        const isGroup = parent && (parent.classList.contains("grid") || parent.classList.contains("cards") || parent.classList.contains("offers") || parent.classList.contains("services"));
        if (isGroup) el.style.transitionDelay = `${Math.min(idx, 8) * 70}ms`;
      });

      if (!("IntersectionObserver" in window)) {
        items.forEach(el => el.classList.add("is-visible"));
        return;
      }

      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" });

      items.forEach(el => io.observe(el));
      this.cleanupFns.push(() => io.disconnect());
    }

    // ---------- Typing effect (span[data-typing]) ----------
    initTyping() {
      const el = qs("[data-typing]");
      if (!el) return;

      const strings = (el.getAttribute("data-typing-strings") || "")
        .split("|")
        .map(s => s.trim())
        .filter(Boolean);

      if (!strings.length) return;

      let si = 0;
      let ci = 0;
      let deleting = false;
      let t = null;

      const tick = () => {
        const current = strings[si] || "";
        const speed = deleting ? 28 : 44;

        if (!deleting) {
          ci++;
          el.textContent = current.slice(0, ci);
          if (ci >= current.length) {
            deleting = true;
            t = window.setTimeout(tick, 1100);
            return;
          }
        } else {
          ci--;
          el.textContent = current.slice(0, ci);
          if (ci <= 0) {
            deleting = false;
            si = (si + 1) % strings.length;
          }
        }
        t = window.setTimeout(tick, speed);
      };

      // Respect reduced motion
      if (this.isReduced) {
        el.textContent = strings[0];
        return;
      }

      tick();
      this.cleanupFns.push(() => window.clearTimeout(t));
    }

    // ---------- Counters ----------
    initCounters() {
      const els = qsa("[data-counter]");
      if (!els.length) return;

      const animateCount = (el) => {
        const end = Number(el.getAttribute("data-counter") || "0");
        const prefix = el.getAttribute("data-prefix") || "";
        const suffix = el.getAttribute("data-suffix") || "";
        const dur = 900;

        const start = performance.now();
        const from = 0;

        const step = (now) => {
          const p = clamp((now - start) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
          const v = Math.round(from + (end - from) * eased);
          el.textContent = `${prefix}${v}${suffix}`;
          if (p < 1) {
            const id = requestAnimationFrame(step);
            this.rafIds.add(id);
          }
        };

        const id = requestAnimationFrame(step);
        this.rafIds.add(id);
      };

      if (!("IntersectionObserver" in window) || this.isReduced) {
        els.forEach(el => {
          const end = el.getAttribute("data-counter") || "0";
          const prefix = el.getAttribute("data-prefix") || "";
          const suffix = el.getAttribute("data-suffix") || "";
          el.textContent = `${prefix}${end}${suffix}`;
        });
        return;
      }

      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          animateCount(e.target);
          io.unobserve(e.target);
        });
      }, { threshold: 0.6 });

      els.forEach(el => io.observe(el));
      this.cleanupFns.push(() => io.disconnect());
    }

    // ---------- Particles (canvas overlay) ----------
    initParticles() {
      this.canvas = qs("#particles-canvas");
      if (!this.canvas) return;

      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      this.ctx = this.canvas.getContext("2d", { alpha: true });

      const resize = () => {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = Math.floor(rect.width * dpr);
        this.canvas.height = Math.floor(rect.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      resize();
      window.addEventListener("resize", resize, { passive: true });
      this.cleanupFns.push(() => window.removeEventListener("resize", resize));

      const w = () => this.canvas.getBoundingClientRect().width;
      const h = () => this.canvas.getBoundingClientRect().height;

      const rand = (a, b) => a + Math.random() * (b - a);

      // Gray + gold dust
      const colors = ["rgba(255,215,0,.75)", "rgba(212,175,55,.55)", "rgba(180,150,40,.35)", "rgba(90,90,90,.22)"];

      const spawn = () => ({
        x: rand(0, w()),
        y: rand(0, h()),
        r: rand(1.5, 4.5),
        vx: rand(-0.25, 0.25),
        vy: rand(-0.18, 0.18),
        a: rand(0.25, 0.8),
        c: colors[(Math.random() * colors.length) | 0]
      });

      this.particles = Array.from({ length: this.particleCfg.count }, spawn);

      const loop = () => {
        if (document.hidden) {
          const id = requestAnimationFrame(loop);
          this.rafIds.add(id);
          return;
        }

        const ctx = this.ctx;
        if (!ctx) return;

        const width = w();
        const height = h();

        ctx.clearRect(0, 0, width, height);

        for (const p of this.particles) {
          p.x += p.vx;
          p.y += p.vy;

          // soft wrap
          if (p.x < -20) p.x = width + 20;
          if (p.x > width + 20) p.x = -20;
          if (p.y < -20) p.y = height + 20;
          if (p.y > height + 20) p.y = -20;

          ctx.globalAlpha = p.a;
          ctx.beginPath();
          ctx.fillStyle = p.c;
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        const id = requestAnimationFrame(loop);
        this.rafIds.add(id);
      };

      const id = requestAnimationFrame(loop);
      this.rafIds.add(id);
    }

    // ---------- Parallax (data-parallax) ----------
    initParallax() {
      const els = qsa("[data-parallax]");
      if (!els.length) return;

      let ticking = false;
      const onScroll = () => {
        this.scrollY = window.scrollY || 0;
        if (ticking) return;
        ticking = true;
        const id = requestAnimationFrame(() => {
          ticking = false;
          const vh = window.innerHeight || 1;
          els.forEach(el => {
            const speed = Number(el.getAttribute("data-parallax")) || 0.15;
            const rect = el.getBoundingClientRect();
            const progress = (rect.top / vh) - 0.5;
            const y = progress * speed * 120;
            el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`;
          });
        });
        this.rafIds.add(id);
      };

      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
      this.cleanupFns.push(() => window.removeEventListener("scroll", onScroll));
    }

    // ---------- Tilt cards (data-tilt) ----------
    initTiltCards() {
      const cards = qsa("[data-tilt]");
      if (!cards.length) return;

      const onMove = (e) => {
        const card = e.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;

        const max = Number(card.getAttribute("data-tilt-max")) || 10;
        const rx = (0.5 - y) * max;
        const ry = (x - 0.5) * max;

        card.style.setProperty("--rx", `${rx.toFixed(2)}deg`);
        card.style.setProperty("--ry", `${ry.toFixed(2)}deg`);
        card.classList.add("is-tilting");
      };

      const onLeave = (e) => {
        const card = e.currentTarget;
        card.style.setProperty("--rx", `0deg`);
        card.style.setProperty("--ry", `0deg`);
        card.classList.remove("is-tilting");
      };

      cards.forEach(card => {
        card.addEventListener("mousemove", onMove);
        card.addEventListener("mouseleave", onLeave);
      });

      this.cleanupFns.push(() => {
        cards.forEach(card => {
          card.removeEventListener("mousemove", onMove);
          card.removeEventListener("mouseleave", onLeave);
        });
      });
    }

    // ---------- Micro interactions (data-animate) ----------
    initMicroInteractions() {
      const items = qsa("[data-animate]");
      if (!items.length) return;

      items.forEach(el => {
        el.addEventListener("mouseenter", () => el.classList.add("is-animated"));
        el.addEventListener("mouseleave", () => el.classList.remove("is-animated"));
      });

      // nothing heavy to cleanup; browser GC is enough
    }

    // ---------- Industrial accent: subtle “scan” line on sections ----------
    initIndustrialAnimations() {
      const sections = qsa("section");
      sections.forEach(sec => {
        sec.classList.add("industrial-scan");
      });
    }

    // ---------- Progress bars (data-width) ----------
    initProgressAnimations() {
      const bars = qsa("[data-width]");
      if (!bars.length) return;

      const setBar = (bar) => {
        const w = bar.getAttribute("data-width");
        if (!w) return;
        bar.style.width = w;
      };

      if (!("IntersectionObserver" in window) || this.isReduced) {
        bars.forEach(setBar);
        return;
      }

      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          setBar(e.target);
          io.unobserve(e.target);
        });
      }, { threshold: 0.5 });

      bars.forEach(b => io.observe(b));
      this.cleanupFns.push(() => io.disconnect());
    }

    // ---------- Forms (focus glow) ----------
    initFormAnimations() {
      const inputs = qsa("input, textarea, select");
      if (!inputs.length) return;

      inputs.forEach(inp => {
        inp.addEventListener("focus", () => inp.classList.add("is-focus"));
        inp.addEventListener("blur", () => inp.classList.remove("is-focus"));
      });
    }

    // ---------- Enhanced hero (video sanity + cascade) ----------
    initEnhancedHero() {
      // If video exists, ensure it plays (autoplay policies)
      const video = qs(".hero video") || qs("video");
      if (video) {
        // Try play; ignore if blocked
        const attempt = () => {
          const p = video.play?.();
          if (p && typeof p.catch === "function") p.catch(() => {});
        };
        // Some browsers need a tick
        window.setTimeout(attempt, 50);
      }

      const hero = qs(".hero");
      if (!hero) return;

      // Cascade animate hero content (works with existing .reveal too)
      const cascade = qsa(".hero .reveal, .hero .hero__content > *");
      cascade.forEach((el, i) => {
        if (el.classList.contains("reveal")) return; // reveal already handled
        el.style.transitionDelay = `${Math.min(i, 8) * 80}ms`;
        el.classList.add("hero-cascade");
        requestAnimationFrame(() => el.classList.add("is-in"));
      });
    }
    // ---------- Logo Carousel ----------
initLogoCarousel() {
  const track = document.querySelector('.logos-track');
  if (!track) return;

  // Liste des logos avec distinction partenaire/investisseur
  const partnerLogos = [
    { 
      name: "Partner 1", 
      image: "assets/img/partner1.png",
      type: "partner"
    },
    { 
      name: "Partner 2", 
      image: "assets/img/partner2.png",
      type: "investor",
      badge: "Investisseur"
    },
    { 
      name: "Partner 3", 
      image: "assets/img/partner3.png",
      type: "partner"
    },
    { 
      name: "Partner 4", 
      image: "assets/img/partner4.png",
      type: "investor",
      badge: "Investisseur"
    },
    { 
      name: "Partner 5", 
      image: "assets/img/partner5.png",
      type: "partner"
    },
    { 
      name: "Partner 6", 
      image: "assets/img/partner6.png",
      type: "partner"
    },
    { 
      name: "Partner 7", 
      image: "assets/img/partner7.png",
      type: "investor",
      badge: "Investisseur"
    },
    { 
      name: "Partner 8", 
      image: "assets/img/partner8.png",
      type: "partner"
    },
    { 
      name: "Partner 9", 
      image: "assets/img/partner9.png",
      type: "partner"
    },
    { 
      name: "Partner 10", 
      image: "assets/img/partner10.png",
      type: "investor",
      badge: "Investisseur"
    }
  ];

  // Dupliquer les logos pour un effet de boucle fluide
  for (let i = 0; i < 3; i++) {
    partnerLogos.forEach(logo => {
      const logoItem = document.createElement('div');
      logoItem.className = 'logo-item';
      
      const img = document.createElement('img');
      img.src = logo.image;
      img.alt = `${logo.name} logo`;
      img.title = logo.name;
      img.loading = "lazy";
      
      logoItem.appendChild(img);
      
      // Ajouter un badge pour les investisseurs
      if (logo.type === 'investor' && logo.badge) {
        const badge = document.createElement('span');
        badge.className = 'investor-badge';
        badge.textContent = logo.badge;
        logoItem.appendChild(badge);
      }
      
      track.appendChild(logoItem);
    });
  }
}
  }

  // ---------- Boot ----------
  const boot = () => {
    const manager = new AnimationManager();
    manager.init();

    // Pause heavy loops when tab hidden
    const onVis = () => {
      document.documentElement.classList.toggle("is-hidden", document.hidden);
    };
    document.addEventListener("visibilitychange", onVis);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
class IntersectionManager {
  constructor() {
    this.observers = new Map();
  }
  
  register(selector, callback, options = {}) {
    const io = new IntersectionObserver(callback, options);
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => io.observe(el));
    this.observers.set(selector, io);
  }
  
  cleanup() {
    this.observers.forEach(io => io.disconnect());
  }
}
