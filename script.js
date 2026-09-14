(() => {
  'use strict';

  /* ==========================================================================
     3D Canvas Cinematic Frame Scrubber
     ========================================================================== */
  const TOTAL_FRAMES = 300;
  const canvas = document.getElementById('cinema-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });

  const images = new Array(TOTAL_FRAMES + 1);
  const loaded = new Array(TOTAL_FRAMES + 1).fill(false);

  let targetScroll = window.scrollY || 0;
  let currentScroll = targetScroll;
  let isTicking = false;
  let lastTimestamp = performance.now();
  let isProgrammaticScroll = false;

  // Frame URL constructor
  const getFrameUrl = (index) => {
    const padded = String(index).padStart(3, '0');
    return `frames/ezgif-frame-${padded}.jpg`;
  };

  // High-DPI canvas scaling with mobile visualViewport support
  const resizeCanvas = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const displayHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);

    drawAtCurrentPosition();
  };

  // Find nearest loaded frame if current frame is not yet ready
  const getNearestLoaded = (index) => {
    const rounded = Math.round(index);
    if (loaded[rounded] && images[rounded]) return images[rounded];

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = rounded - offset;
      if (prev >= 1 && loaded[prev] && images[prev]) return images[prev];
      const next = rounded + offset;
      if (next <= TOTAL_FRAMES && loaded[next] && images[next]) return images[next];
    }
    return null;
  };

  // Draw frame with cinematic cover scale and optical blend
  const drawFrame = (frameFloat) => {
    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const clamped = Math.max(1, Math.min(TOTAL_FRAMES, frameFloat));
    const baseIndex = Math.floor(clamped);
    const nextIndex = Math.min(TOTAL_FRAMES, baseIndex + 1);
    const fraction = clamped - baseIndex;

    const baseImg = loaded[baseIndex] ? images[baseIndex] : getNearestLoaded(baseIndex);
    if (!baseImg) return;

    const iw = baseImg.naturalWidth || 1280;
    const ih = baseImg.naturalHeight || 720;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) * 0.5;
    const dy = (ch - dh) * 0.5;

    // Draw primary base frame
    ctx.globalAlpha = 1.0;
    ctx.drawImage(baseImg, dx, dy, dw, dh);

    // Sub-frame optical cross-fade for seamless continuity
    if (fraction > 0.01 && baseIndex !== nextIndex && loaded[nextIndex] && images[nextIndex]) {
      const nextImg = images[nextIndex];
      ctx.globalAlpha = fraction;
      ctx.drawImage(nextImg, dx, dy, dw, dh);
      ctx.globalAlpha = 1.0;
    }
  };

  /* ==========================================================================
     3D Screw Float Pattern Engine
     ========================================================================== */
  const stageCards = [
    document.getElementById('stage-0'),
    document.getElementById('stage-1'),
    document.getElementById('stage-2'),
    document.getElementById('stage-3')
  ];

  const helicalDots = document.querySelectorAll('.helical-dot');
  const helicalProgressBar = document.getElementById('helical-progress-bar');

  // Calibrated focal ranges for the 4 narrative chapters:
  // enterStart: starts floating in from below (+160px)
  // enterEnd: arrives at 0px resting position
  // exitStart: stays 100% stationary and rock-solid stable until this point
  // exitEnd: floats up to -140px and fades away
  const stageRanges = [
    { enterStart: -0.10, enterEnd: 0.00, exitStart: 0.10, exitEnd: 0.22, targetCenter: 0.00 }, // Stage 0 (Hero)
    { enterStart: 0.16, enterEnd: 0.26, exitStart: 0.38, exitEnd: 0.48, targetCenter: 0.32 }, // Stage 1 (Architecture)
    { enterStart: 0.42, enterEnd: 0.52, exitStart: 0.64, exitEnd: 0.74, targetCenter: 0.58 }, // Stage 2 (Spatial)
    { enterStart: 0.68, enterEnd: 0.76, exitStart: 0.84, exitEnd: 0.90, targetCenter: 0.80 }  // Stage 3 (Finale)
  ];

  let currentActiveStageIndex = 0;
  const helicalNav = document.getElementById('screw-helical-nav');

  const updateScrewFloat = (progress) => {
    let activeIdx = 0;

    stageCards.forEach((card, i) => {
      if (!card) return;
      const rng = stageRanges[i];

      // Outside visibility window - completely hidden
      if (progress < rng.enterStart || progress > rng.exitEnd) {
        card.style.opacity = '0';
        card.style.visibility = 'hidden';
        card.style.pointerEvents = 'none';
        card.classList.remove('active-interact');
        return;
      }

      card.style.visibility = 'visible';

      let ty = 0;
      let tz = 0;
      let rotX = 0;
      let opacity = 1;
      let scale = 1;

      if (progress < rng.enterEnd) {
        // FLOATING IN SMOOTHLY FROM THE BOTTOM
        const p = Math.max(0, Math.min(1, (progress - rng.enterStart) / (rng.enterEnd - rng.enterStart)));
        // Smooth cubic ease-out
        const e = 1 - Math.pow(1 - p, 2.5);
        ty = (1 - e) * 160; // Starts 160px down, floats cleanly up to 0px
        tz = (1 - e) * -100;
        rotX = -(1 - e) * 8;
        scale = 0.95 + 0.05 * e;
        opacity = Math.min(1, p * 1.3);
      } else if (progress <= rng.exitStart) {
        // ROCK-SOLID STABLE RESTING ZONE (ZERO SHAKING, 100% STATIONARY)
        ty = 0;
        tz = 0;
        rotX = 0;
        scale = 1;
        opacity = 1;
        activeIdx = i;
      } else {
        // FLOATING UP AND OUT
        const q = Math.max(0, Math.min(1, (progress - rng.exitStart) / (rng.exitEnd - rng.exitStart)));
        // Smooth cubic ease-in
        const e = Math.pow(q, 2.2);
        ty = -e * 140; // Floats up towards -140px
        tz = -e * 100;
        rotX = e * 6;
        scale = 1 - 0.05 * e;
        opacity = Math.max(0, 1 - q * 1.3);
      }

      card.style.opacity = opacity.toFixed(3);
      card.style.transform = `translate3d(0px, ${ty.toFixed(1)}px, ${tz.toFixed(1)}px) rotateX(${rotX.toFixed(2)}deg) scale(${scale.toFixed(3)})`;

      if (opacity > 0.6) {
        card.style.pointerEvents = 'auto';
        card.classList.add('active-interact');
      } else {
        card.style.pointerEvents = 'none';
        card.classList.remove('active-interact');
      }
    });

    // Update active stage indicator on the helical nav
    if (activeIdx !== currentActiveStageIndex) {
      currentActiveStageIndex = activeIdx;
      helicalDots.forEach((dot, idx) => {
        if (idx === currentActiveStageIndex) {
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
        }
      });
    }

    // Update helical track progress bar height
    if (helicalProgressBar) {
      helicalProgressBar.style.height = `${Math.min(100, Math.max(0, progress * 100))}%`;
    }

    // Fade out helical nav when scrolling into footer
    if (helicalNav) {
      if (progress > 0.88) {
        const fade = Math.max(0, 1 - (progress - 0.88) / 0.07);
        helicalNav.style.opacity = fade.toFixed(2);
        helicalNav.style.pointerEvents = fade < 0.1 ? 'none' : 'auto';
      } else {
        helicalNav.style.opacity = '1';
        helicalNav.style.pointerEvents = 'auto';
      }
    }
  };

  const drawAtCurrentPosition = () => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? Math.max(0, Math.min(1, currentScroll / maxScroll)) : 0;
    const frameFloat = 1 + progress * (TOTAL_FRAMES - 1);
    drawFrame(frameFloat);
    updateScrewFloat(progress);
  };

  // Cinematic smooth LERP render loop
  const smoothScrollToProgress = (progressFraction) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll <= 0) return;
    const targetY = Math.max(0, Math.min(maxScroll, progressFraction * maxScroll));
    window.scrollTo({
      top: targetY,
      behavior: 'smooth'
    });
  };

  const updateLoop = () => {
    const rawScroll = window.scrollY || 0;
    const diff = rawScroll - currentScroll;

    if (Math.abs(diff) > 0.15) {
      currentScroll += diff * 0.18;
      drawAtCurrentPosition();
      requestAnimationFrame(updateLoop);
    } else {
      currentScroll = rawScroll;
      drawAtCurrentPosition();
      isTicking = false;
    }
  };

  const kickRender = () => {
    if (!isTicking) {
      isTicking = true;
      requestAnimationFrame(updateLoop);
    }
  };

  // Direct native scroll listener - fully responsive to all mouse wheels, touchpads, scrollbars, touch, and keys
  window.addEventListener('scroll', kickRender, { passive: true });

  // Binary bundle preloader
  const loadViaBinaryBundle = async () => {
    try {
      const response = await fetch('frames.bin');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const view = new DataView(buffer);
      const totalInBundle = view.getUint32(0, true);

      for (let i = 0; i < totalInBundle; i++) {
        const frameNum = i + 1;
        const offset = view.getUint32(4 + i * 8, true);
        const length = view.getUint32(4 + i * 8 + 4, true);

        const slice = buffer.slice(offset, offset + length);
        const blob = new Blob([slice], { type: 'image/jpeg' });
        const blobUrl = URL.createObjectURL(blob);

        const img = new Image();
        img.src = blobUrl;
        images[frameNum] = img;

        img.decode().then(() => {
          loaded[frameNum] = true;
          if (frameNum === 1) drawAtCurrentPosition();
        }).catch(() => {
          loaded[frameNum] = true;
        });
      }
      return true;
    } catch (err) {
      console.warn('Binary bundle unpack failed, falling back to individual frames:', err);
      return false;
    }
  };

  // Fallback individual frame preloader
  const loadViaIndividualFiles = () => {
    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      images[i] = img;

      img.decode().then(() => {
        loaded[i] = true;
        if (i === 1) drawAtCurrentPosition();
      }).catch(() => {
        img.onload = () => {
          loaded[i] = true;
          if (i === 1) drawAtCurrentPosition();
        };
      });
    }
  };

  // Master asset loader
  const initAssets = async () => {
    const instantFrame1 = new Image();
    instantFrame1.src = getFrameUrl(1);
    images[1] = instantFrame1;
    instantFrame1.onload = () => {
      loaded[1] = true;
      drawAtCurrentPosition();
    };

    const success = await loadViaBinaryBundle();
    if (!success) {
      loadViaIndividualFiles();
    }
  };

  /* ==========================================================================
     X*FOCUS Interactive Suite & Modals
     ========================================================================== */
  const projectModal = document.getElementById('project-modal');
  const casesModal = document.getElementById('cases-modal');
  const signinModal = document.getElementById('signin-modal');
  const navDrawer = document.getElementById('nav-drawer');
  const visionModal = document.getElementById('vision-modal');
  const missionModal = document.getElementById('mission-modal');
  const workModal = document.getElementById('work-modal');
  const aboutModal = document.getElementById('about-modal');

  const openModal = (modalEl) => {
    if (!modalEl) return;
    modalEl.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    if (window.lucide) window.lucide.createIcons();
  };

  const closeModal = (modalEl) => {
    if (!modalEl) return;
    modalEl.setAttribute('hidden', '');
    const anyStillOpen = document.querySelector('.modal-backdrop:not([hidden])');
    if (!anyStillOpen) {
      document.body.style.overflow = '';
    }
  };

  // Close modals on backdrop click
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        closeModal(backdrop);
      }
    });
  });

  // Close modals on Esc key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop:not([hidden])').forEach((backdrop) => {
        closeModal(backdrop);
      });
    }
  });

  /* --- Navigation Pill & Drawer Management --- */
  const navPills = document.querySelectorAll('.nav-pill-btn, .mobile-nav-item');
  const mobileMenu = document.getElementById('mobile-nav-menu');
  const mobileToggle = document.getElementById('nav-mobile-toggle');

  const setActiveNav = (navId) => {
    navPills.forEach((btn) => {
      if (btn.dataset.nav === navId) {
        btn.classList.add('active');
      } else if (btn.dataset.nav) {
        btn.classList.remove('active');
      }
    });

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (navId === 'home') {
      closeModal(navDrawer);
      smoothScrollToProgress(stageRanges[0].targetCenter);
    } else if (navId === 'services') {
      closeModal(navDrawer);
      smoothScrollToProgress(stageRanges[1].targetCenter);
    } else if (navId === 'cases') {
      closeModal(navDrawer);
      openModal(workModal);
    } else if (navId === 'pricing') {
      closeModal(navDrawer);
      smoothScrollToProgress(stageRanges[3].targetCenter);
    } else if (['about'].includes(navId)) {
      closeModal(navDrawer);
      openModal(aboutModal);
    }
  };

  navPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      const navId = btn.dataset.nav;
      if (navId) {
        setActiveNav(navId);
        if (mobileMenu && !mobileMenu.hasAttribute('hidden')) {
          mobileMenu.setAttribute('hidden', '');
        }
      }
    });
  });

  const brandLogoBtn = document.getElementById('nav-brand-logo');
  if (brandLogoBtn) {
    brandLogoBtn.addEventListener('click', () => {
      setActiveNav('home');
    });
  }

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      if (mobileMenu.hasAttribute('hidden')) {
        mobileMenu.removeAttribute('hidden');
      } else {
        mobileMenu.setAttribute('hidden', '');
      }
    });
  }

  // Nav Drawer Panes
  const openNavDrawerPane = (paneId) => {
    document.querySelectorAll('.drawer-pane').forEach((pane) => {
      pane.setAttribute('hidden', '');
    });
    const targetPane = document.getElementById(`drawer-pane-${paneId}`);
    if (targetPane) {
      targetPane.removeAttribute('hidden');
    }
    openModal(navDrawer);
  };

  document.getElementById('close-nav-drawer')?.addEventListener('click', () => {
    closeModal(navDrawer);
    setActiveNav('home');
  });

  // Drawer CTA buttons trigger Project Modal
  document.querySelectorAll('.drawer-cta-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(navDrawer);
      openModal(projectModal);
    });
  });

  /* --- Project Modal ("Get a website") --- */
  let selectedProjectType = 'High-Converting SaaS';
  let selectedBudget = '$15,000 - $30,000';
  let selectedTimeline = '3-4 Weeks (Standard)';

  const setupPillOptions = (containerId, onSelect) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.select-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.select-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        onSelect(btn.dataset.value);
      });
    });
  };

  setupPillOptions('project-type-options', (val) => { selectedProjectType = val; });
  setupPillOptions('budget-options', (val) => { selectedBudget = val; });
  setupPillOptions('timeline-options', (val) => { selectedTimeline = val; });

  const btnGotoStep2 = document.getElementById('btn-goto-step-2');
  const btnBacktoStep1 = document.getElementById('btn-backto-step-1');
  const projectStep1 = document.getElementById('project-step-1');
  const projectStep2 = document.getElementById('project-step-2');
  const projectFormView = document.getElementById('project-form-view');
  const projectSuccessView = document.getElementById('project-success-view');
  const projectContactForm = document.getElementById('project-contact-form');
  const projectSummaryBox = document.getElementById('project-summary-box');

  if (btnGotoStep2) {
    btnGotoStep2.addEventListener('click', () => {
      projectStep1.setAttribute('hidden', '');
      projectStep2.removeAttribute('hidden');
    });
  }

  if (btnBacktoStep1) {
    btnBacktoStep1.addEventListener('click', () => {
      projectStep2.setAttribute('hidden', '');
      projectStep1.removeAttribute('hidden');
    });
  }

  if (projectContactForm) {
    projectContactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contact-name').value;
      const email = document.getElementById('contact-email').value;
      const company = document.getElementById('contact-company').value;
      const details = document.getElementById('contact-details').value;

      projectSummaryBox.innerHTML = `
        <div style="margin-bottom: 0.4rem;"><strong>Partner:</strong> ${name} (${company})</div>
        <div style="margin-bottom: 0.4rem;"><strong>Email:</strong> ${email}</div>
        <div style="margin-bottom: 0.4rem;"><strong>Scope:</strong> ${selectedProjectType}</div>
        <div style="margin-bottom: 0.4rem;"><strong>Budget Tier:</strong> ${selectedBudget}</div>
        <div><strong>Timeline:</strong> ${selectedTimeline}</div>
      `;

      projectFormView.setAttribute('hidden', '');
      projectSuccessView.removeAttribute('hidden');
      if (window.lucide) window.lucide.createIcons();
    });
  }

  const resetProjectModal = () => {
    projectStep1.removeAttribute('hidden');
    projectStep2.setAttribute('hidden', '');
    projectFormView.removeAttribute('hidden');
    projectSuccessView.setAttribute('hidden', '');
    projectContactForm?.reset();
  };

  document.getElementById('close-project-modal')?.addEventListener('click', () => {
    closeModal(projectModal);
    resetProjectModal();
  });

  document.getElementById('btn-close-success')?.addEventListener('click', () => {
    closeModal(projectModal);
    resetProjectModal();
  });

  // All "Get a website" / consultation triggers across all stages
  document.querySelectorAll('[data-trigger="get-website"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(visionModal);
      closeModal(missionModal);
      closeModal(casesModal);
      closeModal(workModal);
      closeModal(aboutModal);
      openModal(projectModal);
    });
  });

  // All "View cases" triggers across all stages
  document.querySelectorAll('[data-trigger="view-cases"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(visionModal);
      closeModal(missionModal);
      closeModal(casesModal);
      closeModal(aboutModal);
      openModal(workModal);
    });
  });

  // Helical Stage Dots Navigation Click Handlers
  helicalDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const stageIdx = parseInt(dot.dataset.stage, 10);
      if (!isNaN(stageIdx) && stageRanges[stageIdx]) {
        smoothScrollToProgress(stageRanges[stageIdx].targetCenter);
      }
    });
  });

  document.getElementById('hero-cta-get-website')?.addEventListener('click', () => {
    openModal(projectModal);
  });

  /* --- Vision Manifesto Modal ("To shape what comes next") --- */
  document.getElementById('square-box-1')?.addEventListener('click', () => {
    openModal(visionModal);
  });

  document.querySelectorAll('[data-trigger="view-vision"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal(visionModal);
    });
  });

  document.getElementById('close-vision-modal')?.addEventListener('click', () => {
    closeModal(visionModal);
  });

  /* --- Mission Manifesto Modal ("Transforming ideas into digital impact") --- */
  document.getElementById('square-box-2')?.addEventListener('click', () => {
    openModal(missionModal);
  });

  document.querySelectorAll('[data-trigger="view-mission"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openModal(missionModal);
    });
  });

  document.getElementById('close-mission-modal')?.addEventListener('click', () => {
    closeModal(missionModal);
  });

  // Keyboard accessibility for interactive manifesto cards
  ['square-box-1', 'square-box-2'].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        el.click();
      }
    });
  });

  /* --- Hero "View cases" Button --- */
  document.getElementById('hero-cta-view-cases')?.addEventListener('click', () => {
    closeModal(visionModal);
    closeModal(missionModal);
    closeModal(casesModal);
    openModal(workModal);
  });

  document.getElementById('close-cases-modal')?.addEventListener('click', () => {
    closeModal(casesModal);
  });

  document.getElementById('cases-book-call-btn')?.addEventListener('click', () => {
    closeModal(casesModal);
    openModal(projectModal);
  });

  /* --- Selected Work Showcase Modal --- */
  document.querySelectorAll('[data-trigger="view-work"], #trigger-work-modal').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(visionModal);
      closeModal(missionModal);
      closeModal(casesModal);
      closeModal(aboutModal);
      openModal(workModal);
    });
  });

  document.getElementById('close-work-modal')?.addEventListener('click', () => {
    closeModal(workModal);
  });

  /* --- Full About Xfocus Modal --- */
  document.querySelectorAll('[data-trigger="view-about"], #stage-about-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal(visionModal);
      closeModal(missionModal);
      closeModal(casesModal);
      closeModal(workModal);
      openModal(aboutModal);
    });
  });

  document.getElementById('stage-about-card')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      closeModal(visionModal);
      closeModal(missionModal);
      closeModal(casesModal);
      closeModal(workModal);
      openModal(aboutModal);
    }
  });

  document.getElementById('close-about-modal')?.addEventListener('click', () => {
    closeModal(aboutModal);
  });

  /* --- Footer Navigation & Interaction Handlers --- */
  document.getElementById('footer-link-home')?.addEventListener('click', () => {
    smoothScrollToProgress(0);
  });

  document.getElementById('footer-brand-signature')?.addEventListener('click', () => {
    smoothScrollToProgress(0);
  });

  document.getElementById('footer-brand-signature')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      smoothScrollToProgress(0);
    }
  });

  document.getElementById('footer-link-contact')?.addEventListener('click', (e) => {
    e.preventDefault();
    smoothScrollToProgress(stageRanges[2].targetCenter);
  });

  // Cases Filter Tabs
  const caseTabs = document.querySelectorAll('.case-tab');
  const caseCards = document.querySelectorAll('.case-item-card');

  caseTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      caseTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const category = tab.dataset.category;
      caseCards.forEach((card) => {
        if (category === 'all' || card.dataset.category === category) {
          card.style.display = 'flex';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });

  /* --- Sign In Modal --- */
  const signinFormView = document.getElementById('signin-form-view');
  const signinAuthView = document.getElementById('signin-authenticated-view');
  const signinForm = document.getElementById('signin-form');
  const portalUserEmail = document.getElementById('portal-user-email');

  document.getElementById('nav-signin-button')?.addEventListener('click', () => {
    openModal(signinModal);
  });

  document.getElementById('mobile-signin-btn')?.addEventListener('click', () => {
    if (mobileMenu) mobileMenu.setAttribute('hidden', '');
    openModal(signinModal);
  });

  document.getElementById('close-signin-modal')?.addEventListener('click', () => {
    closeModal(signinModal);
  });

  if (signinForm) {
    signinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value;
      if (portalUserEmail) portalUserEmail.textContent = email || 'partner@hyperion-ventures.com';
      signinFormView.setAttribute('hidden', '');
      signinAuthView.removeAttribute('hidden');
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // 1-Click Sandbox Sign-In
  document.getElementById('btn-sandbox-login')?.addEventListener('click', () => {
    document.getElementById('signin-email').value = 'partner@hyperion-ventures.com';
    document.getElementById('signin-password').value = '••••••••••••';
    if (portalUserEmail) portalUserEmail.textContent = 'partner@hyperion-ventures.com';
    signinFormView.setAttribute('hidden', '');
    signinAuthView.removeAttribute('hidden');
    if (window.lucide) window.lucide.createIcons();
  });

  document.getElementById('btn-logout-portal')?.addEventListener('click', () => {
    signinAuthView.setAttribute('hidden', '');
    signinFormView.removeAttribute('hidden');
    signinForm?.reset();
    closeModal(signinModal);
  });

  /* ==========================================================================
     Initialization & Icon Bootstrapping
     ========================================================================== */
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('orientationchange', resizeCanvas, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', resizeCanvas, { passive: true });
  }
  resizeCanvas();
  initAssets();

  if (window.lucide) {
    window.lucide.createIcons();
  } else {
    window.addEventListener('load', () => {
      if (window.lucide) window.lucide.createIcons();
    });
  }

})();
