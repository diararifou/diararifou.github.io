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
      this.particleCfg = { count: 80 }
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
    // =============================================
    // PARTNER LOGOS - SECTEUR MINIER
    // Entreprises légitimes - Liens officiels directs
    // =============================================
    const partnerLogos = [
      // -------------------------------------------------
      // 🌍 GLOBAL MAJORS (Partenaires stratégiques mondiaux)
      // -------------------------------------------------
      {
        name: "BHP",
        image: "https://www.bhp.com/-/media/project/bhp1ip/bhp1ip-en/bhp-orange.png?iar=0&hash=9467A83EBA5D4819D582B7F0A7E0239B",
        type: "investor",
        badge: "Investisseur"
      },
      {
        name: "Rio Tinto",
        image: "https://cdn-rio.dataweavers.io/-/media/project/riotinto/shared/riologo.svg?rev=-1",
        type: "investor",
        badge: "Investisseur"
      },
      {
        name: "Glencore",
        image: "https://www.glencore.com/.resources/gc/webresources/img/Glencore_logo.svg",
        type: "investor",
        badge: "Investisseur"
      },
      {
        name: "Anglo American",
        image: "https://www.angloamerican.com/~/media/Images/A/Anglo-American-Group-v9/Universal/logo/anglo-american-logo-color.svg",
        type: "partner"
      },
      {
        name: "Shell",
        image: "https://upload.wikimedia.org/wikipedia/fr/e/e8/Shell_logo.svg",
        type: "partner"
      },
      {
        name: "TotalEnergies",
        image: "https://totalenergies.com/themes/custom/totalenergies_com/dist/img/logo_totalenergies.png",
        type: "partner"
      },

      // -------------------------------------------------
      // 🌍 AFRICA & STRATEGIC PLAYERS (Partenaires clés)
      // -------------------------------------------------
      {
        name: "Perkins Engines",
        image: "https://upload.wikimedia.org/wikipedia/commons/1/14/Perkins-Logo.svg",
        type: "investor",
        badge: "Investisseur"
      },
      {
        name: " Protection EPI",
        image: "https://protection-epi.com/uploads/2024/01/protection-epi-logo.svg",
        type: "partner"
      },
      {
        name: "Caterpillar Inc",
        image: "https://media.designrush.com/inspiration_images/134799/conversions/_1511457750_728_-caterpillar-desktop.jpg",
        type: "partner"
      },
      {
        name: "Carbon Activated Europe",
        image: "https://www.carbonactivatedeurope.com/wp-content/uploads/2022/07/CAE-Logo-Blue.png",
        type: "partner"
      },
      {
        name: "Ronix Tools",
        image: "https://ronixtools.com/en/blog/wp-content/uploads/2023/03/ronix-mag-logo.png",
        type: "partner"
      },
      {
        name: "Lincoln Electric",
        image: "https://www.lincolnelectric.com/-/media/project/website/logo.ashx?iar=0&hash=C14096386CBAB143E630526AD0ACF6AB",
        type: "partner"
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
(function() {
  "use strict";

  // Configuration
  const canvasId = "#particles-canvas";
  const particleCount = 40; // Nombre de particules
  const particleColor = 'rgba(255, 215, 0, 0.8)'; // Couleur (ici le Gold du thème)

  const canvas = document.querySelector(canvasId);
  if (!canvas) return; // Sécurité si le canvas n'existe pas

  const ctx = canvas.getContext("2d");
  let particles = [];

  // Redimensionner le canvas pour qu'il prenne tout l'écran
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  
  window.addEventListener("resize", resize);
  resize(); // Appel initial

  // Initialisation des particules
  for(let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.5, // Vitesse horizontale
      vy: (Math.random() - 0.5) * 0.5, // Vitesse verticale
      size: Math.random() * 3 + 2,     // Taille aléatoire entre 1 et 3px
      color: particleColor
    });
  }

  // Boucle d'animation
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      // Mise à jour de la position
      p.x += p.vx;
      p.y += p.vy;

      // Rebondir / Réapparaître si sort de l'écran (Boundary checks)
      if(p.x < 0) p.x = canvas.width;
      if(p.x > canvas.width) p.x = 0;
      if(p.y < 0) p.y = canvas.height;
      if(p.y > canvas.height) p.y = 0;

      // Dessin de la particule
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    requestAnimationFrame(animate);
  };

  // Lancer l'animation
  animate();
})();
  // ---------- Boot ----------
  const boot = () => {
    const manager = new AnimationManager();
    manager.init();
const langManager = new LanguageManager();
langManager.init();
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
// =============================================
// LANGUAGE MANAGER - VOORS (FR/EN)
// =============================================
// =============================================
// LANGUAGE MANAGER - VOORS (FR/EN) - ULTRA ROBUSTE
// =============================================
// =============================================
// LANGUAGE MANAGER - VOORS (FR/EN)
// =============================================
class LanguageManager {
  constructor() {
    // Dictionnaire complet des traductions
    this.translations = {
      fr: {
        langLabel: "FR",
        navAbout: "À propos",
        navOffers: "Produits & Services",
        navSectors: "Secteurs",
        navPartners: "Partenaires",
        navBlog: "Actualités",
        navContact: "Contact",
        heroKicker: "Mining Innovation & Performance",
        heroTrust1: "Réactivité & support",
        heroTrust2: "Approche partenariat",
        heroTrust3: "Couverture internationale",
        numbersTitle: "Chiffres clés",
        numbersLead: "Une vitrine claire pour rassurer les achats, la logistique et les partenaires.",
        numbers1: "Catégories d’équipements",
        numbers2: "Temps de réponse message cible",
        numbers3: "Zones : Afrique & Europe",
        aboutTitle: "À propos de VOORS",
        aboutLead: "VOORS structure ses offres autour de la disponibilité, de la sécurité et de l’efficacité opérationnelle.",
        aboutCard1Title: "Mission",
        aboutCard1Text: "Approvisionner le secteur minier avec des biens et services fiables, dans le respect des exigences industrielles.",
        aboutCard2Title: "Vision",
        aboutCard2Text: "Devenir un partenaire de référence pour les sous-traitants miniers et les acteurs industriels de la région.",
        aboutCard3Title: "Valeurs",
        aboutCard3Text: "Fiabilité • Qualité • Sécurité • Transparence • Engagement.",
        whyTitle: "Pourquoi nous choisir ?",
        why1: "Approche B2B : process achats, conformité et délais.",
        why2: "Catalogue structuré : équipements, pièces, consommables.",
        why3: "Support opérationnel : maintenance et assistance.",
        why4: "Communication claire : devis, spécifications, traçabilité.",
        why5: "Couverture internationale : Afrique de l’Ouest & partenaires.",
        implTitle: "Implantation",
        implText: "Belgique • Mali — Coordination, sourcing et proximité opérationnelle.",
        offersTitle: "Produits & Services",
        offersLead: "Une offre structurée, orientée disponibilité et performance terrain.",
        offersCard1Title: "Fourniture de biens",
        offersCard1Text: "Machines industrielles, pièces de rechange, moteurs, pompes, équipements électriques, télécoms, EPI…",
        offersCardLink: "Voir le catalogue",
        offersCard2Title: "Maintenance & assistance",
        offersCard2Text: "Entretiens, maintenance industrielle et support opérationnel selon vos besoins.",
        offersCardLink2: "Parler à un responsable",
        offersCard3Title: "Sourcing & partenariat",
        offersCard3Text: "Approvisionnement, coordination et réseau partenaires pour sécuriser la chaîne de valeur.",
        offersCardLink3: "Découvrir",
        catalogTitle: "Catégories principales",
        cat1: "Machines industrielles & pièces",
        cat2: "Moteurs & pompes",
        cat3: "Produits chimiques & labo",
        cat4: "Véhicules & pièces",
        cat5: "Groupes électrogènes & solaire",
        cat6: "Électrique / IT / Télécom",
        cat7: "EPI & robinetterie",
        sectorsTitle: "Secteurs d’intervention",
        sectorsLead: "Une approche adaptable aux environnements industriels exigeants.",
        sector1: "Mines industrielles",
        sector1Text: "Approvisionnement, consommables, équipements et besoins spécifiques.",
        sector2: "Sous-traitance minière",
        sector2Text: "Support aux sous-traitants : pièces, maintenance, équipements terrain.",
        sector3: "Projets industriels",
        sector3Text: "Équipements, énergie, sécurité et logistique pour opérations industrielles.",
        partnersTitle: "Partenaires & investisseurs",
        partnersLead: "VOORS développe un réseau de collaboration pour renforcer la qualité, la disponibilité et la couverture internationale.",
        p1: "Partenaires fournisseurs",
        p1d: "Sourcing et disponibilité sur des catégories critiques.",
        p2: "Partenaires techniques",
        p2d: "Support maintenance, expertise et interventions.",
        p3: "Investisseurs / institutions",
        p3d: "Développement, conformité et expansion régionale.",
        portalTitle: "Espace client",
        portalLead: "Une extension Phase 2 pour centraliser documents, demandes et suivi.",
        portalCard1Title: "Documentation & Conformité",
        portalCard1Text: "Accès centralisé à vos certificats d'origine, fiches techniques et documents douaniers.",
        portalCard2Title: "Suivi de commande (Live)",
        portalCard2Text: "Tracking en temps réel de vos expéditions depuis la Belgique jusqu'au site minier.",
        portalCard3Title: "Support Prioritaire",
        portalCard3Text: "Ticket SAV dédié et historique des maintenances pour vos équipements industriels.",
        portalCtaTitle: "Accès réservé aux partenaires",
        portalCtaText: "Le portail est en cours de déploiement final.",
        portalCtaBtn: "Demander mes accès",
        contactTitle: "Contact",
        contactLead: "Décrivez votre besoin (équipement, pièce, consommable, maintenance). Nous répondons rapidement.",
        fName: "Nom",
        fEmail: "Email",
        fMsg: "Message",
        fSend: "Envoyer",
        contactInfo: "Informations",
        contactPhone: "Téléphone :",
        contactNoteTitle: "Engagement",
        contactNoteText: "Réponse rapide • Process clair • Partenariat long terme.",
        footerText: "Fourniture de biens & services pour le secteur minier. Approche B2B, fiabilité et performance.",
        footerLinks: "Liens",
        footerLegal: "Légal",
        legal: "Mentions légales",
        privacy: "Politique de confidentialité",
        footerMade: "Identité digitale : Charte VOORS",
        ctaPartnersTitle: "Vous souhaitez collaborer ?",
        ctaPartnersText: "Contactez-nous pour étudier un partenariat ou une opportunité d’investissement.",
        ctaPartnersBtn: "Nous contacter"
      },
      en: {
        langLabel: "EN",
        navAbout: "About",
        navOffers: "Products & Services",
        navSectors: "Sectors",
        navPartners: "Partners",
        navBlog: "News",
        navContact: "Contact",
        heroKicker: "Mining Innovation & Performance",
        heroTrust1: "Responsiveness & Support",
        heroTrust2: "Partnership Approach",
        heroTrust3: "International Coverage",
        numbersTitle: "Key Figures",
        numbersLead: "A clear overview to reassure procurement, logistics, and partners.",
        numbers1: "Equipment Categories",
        numbers2: "Target Response Time",
        numbers3: "Zones: Africa & Europe",
        aboutTitle: "About VOORS",
        aboutLead: "VOORS structures its offers around availability, safety, and operational efficiency.",
        aboutCard1Title: "Mission",
        aboutCard1Text: "Supplying the mining sector with reliable goods and services, compliant with industrial standards.",
        aboutCard2Title: "Vision",
        aboutCard2Text: "To become a reference partner for mining subcontractors and industrial players in the region.",
        aboutCard3Title: "Values",
        aboutCard3Text: "Reliability • Quality • Safety • Transparency • Commitment.",
        whyTitle: "Why choose us?",
        why1: "B2B Approach: procurement process, compliance, and deadlines.",
        why2: "Structured Catalog: equipment, spare parts, consumables.",
        why3: "Operational Support: maintenance and assistance.",
        why4: "Clear Communication: quotes, specifications, traceability.",
        why5: "International Coverage: West Africa & partners.",
        implTitle: "Locations",
        implText: "Belgium • Mali — Coordination, sourcing, and operational proximity.",
        offersTitle: "Products & Services",
        offersLead: "A structured offer, focused on availability and field performance.",
        offersCard1Title: "Goods Supply",
        offersCard1Text: "Industrial machines, spare parts, motors, pumps, electrical equipment, telecoms, PPE…",
        offersCardLink: "View catalog",
        offersCard2Title: "Maintenance & Support",
        offersCard2Text: "Servicing, industrial maintenance, and operational support tailored to your needs.",
        offersCardLink2: "Talk to an expert",
        offersCard3Title: "Sourcing & Partnership",
        offersCard3Text: "Procurement, coordination, and partner network to secure the value chain.",
        offersCardLink3: "Discover",
        catalogTitle: "Main Categories",
        cat1: "Industrial Machines & Parts",
        cat2: "Motors & Pumps",
        cat3: "Chemicals & Lab",
        cat4: "Vehicles & Parts",
        cat5: "Generators & Solar",
        cat6: "Electrical / IT / Telecom",
        cat7: "PPE & Valves",
        sectorsTitle: "Sectors of Intervention",
        sectorsLead: "An approach adaptable to demanding industrial environments.",
        sector1: "Industrial Mining",
        sector1Text: "Supply, consumables, equipment, and specific needs.",
        sector2: "Mining Subcontracting",
        sector2Text: "Support for subcontractors: parts, maintenance, field equipment.",
        sector3: "Industrial Projects",
        sector3Text: "Equipment, energy, safety, and logistics for industrial operations.",
        partnersTitle: "Partners & Investors",
        partnersLead: "VOORS develops a collaboration network to strengthen quality, availability, and international coverage.",
        p1: "Supplier Partners",
        p1d: "Sourcing and availability for critical categories.",
        p2: "Technical Partners",
        p2d: "Maintenance support, expertise, and interventions.",
        p3: "Investors / Institutions",
        p3d: "Development, compliance, and regional expansion.",
        portalTitle: "Client Portal",
        portalLead: "A Phase 2 extension to centralize documents, requests, and tracking.",
        portalCard1Title: "Documentation & Compliance",
        portalCard1Text: "Centralized access to your certificates of origin, technical data sheets, and customs documents.",
        portalCard2Title: "Order Tracking (Live)",
        portalCard2Text: "Real-time tracking of your shipments from Belgium to the mining site.",
        portalCard3Title: "Priority Support",
        portalCard3Text: "Dedicated after-sales ticket and maintenance history for your industrial equipment.",
        portalCtaTitle: "Access reserved for partners",
        portalCtaText: "The portal is currently in final deployment.",
        portalCtaBtn: "Request my access",
        contactTitle: "Contact",
        contactLead: "Describe your need (equipment, part, consumable, maintenance). We reply quickly.",
        fName: "Name",
        fEmail: "Email",
        fMsg: "Message",
        fSend: "Send",
        contactInfo: "Information",
        contactPhone: "Phone:",
        contactNoteTitle: "Commitment",
        contactNoteText: "Fast response • Clear process • Long-term partnership.",
        footerText: "Supply of goods & services for the mining sector. B2B approach, reliability, and performance.",
        footerLinks: "Links",
        footerLegal: "Legal",
        legal: "Legal Mentions",
        privacy: "Privacy Policy",
        footerMade: "Digital Identity: VOORS Charter",
        ctaPartnersTitle: "Wish to collaborate?",
        ctaPartnersText: "Contact us to discuss a partnership or an investment opportunity.",
        ctaPartnersBtn: "Contact us"
      }
    };

    // Récupération de la langue stockée ou français par défaut
    this.lang = localStorage.getItem('voors-lang') || 'fr';
    this.btn = null;
    this.targets = null;
  }

  // Initialisation (à appeler après le chargement du DOM)
  init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.start());
    } else {
      this.start();
    }
  }

  start() {
    this.btn = document.querySelector('[data-lang-switch]');
    this.targets = document.querySelectorAll('[data-i18n]');

    if (!this.btn) {
      console.warn('Bouton de langue introuvable. Délégation activée.');
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-lang-switch]');
        if (btn) this.handleClick(btn);
      });
    } else {
      this.btn.addEventListener('click', (e) => this.handleClick(e.currentTarget));
    }

    // Appliquer la langue sauvegardée
    this.applyLanguage(this.lang);
  }

  handleClick(btn) {
    if (btn && btn.preventDefault) btn.preventDefault();
    const newLang = this.lang === 'fr' ? 'en' : 'fr';
    this.applyLanguage(newLang);
  }

  applyLanguage(lang) {
    if (!this.translations[lang]) {
      console.error(`Langue ${lang} non supportée`);
      return;
    }

    this.lang = lang;
    localStorage.setItem('voors-lang', lang);
    document.documentElement.setAttribute('lang', lang);

    // Mettre à jour tous les éléments data-i18n
    this.targets?.forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.translations[lang][key];
      if (text) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.setAttribute('placeholder', text);
        } else {
          el.innerHTML = text;
        }
      }
    });

    // Mettre à jour le label du bouton
    const labelSpan = this.btn?.querySelector('[data-i18n="langLabel"]');
    if (labelSpan) labelSpan.textContent = lang.toUpperCase();
  }
}

// Instanciation et initialisation (APRÈS la définition de la classe)
const langManager = new LanguageManager();
langManager.init();

