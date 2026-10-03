(function () {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const counter = document.getElementById("counter");
  const prev = document.getElementById("prev");
  const next = document.getElementById("next");
  const deck = document.getElementById("deck");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxStage = document.getElementById("lightbox-stage");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxPrev = document.getElementById("lightbox-prev");
  const lightboxNext = document.getElementById("lightbox-next");
  const shareToast = document.getElementById("share-toast");
  let index = 0;
  let shareToastTimer = 0;
  let lightboxOpen = false;
  let suppressImgClick = false;
  let applyingHash = false;

  const TAP_MAX_PX = 14;
  const SLIDE_HASH_RE = /^#(?:slide-)?(\d+)$/i;

  function isSlideHash(hash) {
    return SLIDE_HASH_RE.test(hash);
  }

  /** 0-based index from #N / #slide-N; clamps to [0, slides.length - 1]. */
  function slideIndexFromHash(hash) {
    const m = (hash || location.hash).match(SLIDE_HASH_RE);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 1) return 0;
    if (n > slides.length) return slides.length - 1;
    return n - 1;
  }

  function setSlideHash(oneBased) {
    const desired = `#${oneBased}`;
    if (location.hash === desired) return;
    const url = `${location.pathname}${location.search}${desired}`;
    history.replaceState(null, "", url);
  }

  function applyLocationHash() {
    const hash = location.hash;
    if (!hash || hash === "#deck") return;

    applyingHash = true;
    if (isSlideHash(hash)) {
      show(slideIndexFromHash(hash), { fromHash: true });
      setSlideHash(index + 1);
    } else {
      show(0, { fromHash: true });
      setSlideHash(1);
    }
    applyingHash = false;
  }

  function lockHorizontalScroll() {
    window.scrollTo(0, 0);
    document.documentElement.scrollLeft = 0;
    document.body.scrollLeft = 0;
    if (deck) deck.scrollLeft = 0;
  }

  function show(i, opts = {}) {
    index = (i + slides.length) % slides.length;
    slides.forEach((s, n) => s.classList.toggle("is-active", n === index));
    counter.textContent = `${index + 1} / ${slides.length}`;
    lockHorizontalScroll();
    if (lightboxOpen) syncLightboxFromActiveSlide();
    if (!opts.fromHash && !applyingHash) {
      setSlideHash(index + 1);
    }
  }

  function getActiveSlide() {
    return slides.find((s) => s.classList.contains("is-active")) || slides[index];
  }

  function slideDeepLink(oneBased) {
    const base = `${location.origin}${location.pathname}${location.search}`;
    return `${base}#${oneBased}`;
  }

  function showShareToast() {
    if (!shareToast) return;
    shareToast.hidden = false;
    shareToast.classList.add("is-visible");
    clearTimeout(shareToastTimer);
    shareToastTimer = setTimeout(() => {
      shareToast.classList.remove("is-visible");
      shareToast.hidden = true;
    }, 2400);
  }

  function copyTextFallback(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }

  async function copySlideLink(oneBased) {
    const url = slideDeepLink(oneBased);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showShareToast();
        return;
      }
    } catch {
      /* try fallback */
    }
    try {
      if (copyTextFallback(url)) {
        showShareToast();
        return;
      }
    } catch {
      /* prompt below */
    }
    window.prompt("Скопируйте ссылку:", url);
  }

  function oneBasedIndexForSlide(slideEl) {
    if (!slideEl) return index + 1;
    const raw = slideEl.getAttribute("data-index");
    const n = raw === null ? NaN : parseInt(raw, 10);
    return Number.isFinite(n) ? n + 1 : index + 1;
  }

  function syncLightboxFromActiveSlide() {
    const slide = getActiveSlide();
    if (!slide || !lightboxImg) return;
    const img = slide.querySelector(".slide__img");
    if (!img) return;
    lightboxImg.src = img.currentSrc || img.src;
    lightboxImg.alt = img.alt;
    const textEl = slide.querySelector(".slide__text");
    const text = textEl ? textEl.textContent.trim() : "";
    if (lightboxCaption) {
      if (text) {
        lightboxCaption.textContent = text;
        lightboxCaption.hidden = false;
      } else {
        lightboxCaption.textContent = "";
        lightboxCaption.hidden = true;
      }
    }
  }

  function requestElFullscreen(el) {
    const fn =
      el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.msRequestFullscreen;
    if (!fn) return Promise.reject(new Error("fullscreen unsupported"));
    return Promise.resolve(fn.call(el));
  }

  function exitElFullscreen() {
    const doc = document;
    if (
      !doc.fullscreenElement &&
      !doc.webkitFullscreenElement &&
      !doc.msFullscreenElement
    ) {
      return Promise.resolve();
    }
    const fn =
      doc.exitFullscreen ||
      doc.webkitExitFullscreen ||
      doc.msExitFullscreen;
    return fn ? Promise.resolve(fn.call(doc)) : Promise.resolve();
  }

  function openLightbox() {
    if (!lightbox || !lightboxImg) return;
    syncLightboxFromActiveSlide();
    lightbox.hidden = false;
    lightboxOpen = true;
    document.body.classList.add("is-lightbox-open");
    lockHorizontalScroll();
    requestElFullscreen(lightbox).catch(() => {
      /* CSS fixed overlay is the fallback */
    });
    lightboxClose?.focus({ preventScroll: true });
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightboxOpen = false;
    lightbox.hidden = true;
    document.body.classList.remove("is-lightbox-open");
    exitElFullscreen().catch(() => {});
  }

  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));

  lightboxClose?.addEventListener("click", closeLightbox);

  lightboxPrev?.addEventListener("click", (e) => {
    e.stopPropagation();
    show(index - 1);
  });
  lightboxNext?.addEventListener("click", (e) => {
    e.stopPropagation();
    show(index + 1);
  });

  lightboxStage?.addEventListener("click", (e) => {
    if (e.target === lightboxStage) closeLightbox();
  });

  document.addEventListener("fullscreenchange", () => {
    const fsEl =
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement;
    if (!fsEl && lightboxOpen) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (lightboxOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        show(index + 1);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        show(index - 1);
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        return;
      }
    }

    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
      e.preventDefault();
      show(index + 1);
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      show(index - 1);
    }
  });

  deck?.addEventListener("click", (e) => {
    const shareBtn = e.target.closest(".slide__share");
    if (shareBtn) {
      const slide = shareBtn.closest(".slide");
      if (slide?.classList.contains("is-active")) {
        e.preventDefault();
        copySlideLink(oneBasedIndexForSlide(slide));
      }
      return;
    }
    if (suppressImgClick) return;
    const img = e.target.closest(".slide__img");
    if (!img || !img.closest(".slide.is-active")) return;
    openLightbox();
  });

  let touchX = 0;
  let touchY = 0;
  let tracking = false;

  function isInteractiveTarget(el) {
    return Boolean(el && el.closest("a, button, input, textarea, select, label"));
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      if (lightboxOpen) {
        tracking = false;
        return;
      }
      if (isInteractiveTarget(e.target)) {
        tracking = false;
        return;
      }
      const t = e.changedTouches[0];
      touchX = t.clientX;
      touchY = t.clientY;
      tracking = true;
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (lightboxOpen || !tracking || !e.touches.length) return;
      const t = e.touches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        e.preventDefault();
        lockHorizontalScroll();
      }
    },
    { passive: false }
  );

  document.addEventListener(
    "touchend",
    (e) => {
      if (lightboxOpen) return;
      if (!tracking) return;
      tracking = false;
      if (isInteractiveTarget(e.target)) {
        lockHorizontalScroll();
        return;
      }
      const t = e.changedTouches[0];
      const dx = t.clientX - touchX;
      const dy = t.clientY - touchY;
      const img = e.target.closest(".slide__img");
      const isTap = Math.abs(dx) < TAP_MAX_PX && Math.abs(dy) < TAP_MAX_PX;

      if (img && isTap) {
        suppressImgClick = true;
        setTimeout(() => {
          suppressImgClick = false;
        }, 400);
        openLightbox();
        return;
      }

      if (Math.abs(dx) >= 50) {
        show(dx < 0 ? index + 1 : index - 1);
      } else {
        lockHorizontalScroll();
      }
    },
    { passive: true }
  );

  document.addEventListener(
    "touchcancel",
    () => {
      tracking = false;
      lockHorizontalScroll();
    },
    { passive: true }
  );

  window.addEventListener("scroll", lockHorizontalScroll, { passive: true });
  window.addEventListener("orientationchange", lockHorizontalScroll, {
    passive: true,
  });
  window.addEventListener("resize", lockHorizontalScroll, { passive: true });

  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener("resize", lockHorizontalScroll, { passive: true });
    vv.addEventListener("scroll", lockHorizontalScroll, { passive: true });
  }

  window.addEventListener("hashchange", applyLocationHash);

  if (!slides.length) return;

  const initialHash = location.hash;
  if (initialHash && initialHash !== "#deck") {
    applyLocationHash();
  } else {
    show(0, { fromHash: true });
  }
})();
