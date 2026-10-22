/**
 * CampusConnect GSAP Motion System
 * Restrained, production-grade animations and scroll-triggered reveals.
 * Respects prefers-reduced-motion and gracefully degrades without hiding content.
 */

(function () {
  'use strict';

  // Check if reduced motion is preferred
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    // Reveal all elements immediately and cancel animations
    document.querySelectorAll('.reveal, .count-up').forEach(function (el) {
      el.classList.add('visible');
      if (el.classList.contains('count-up') && el.dataset.target) {
        el.textContent = el.dataset.target;
      }
    });
    return;
  }

  function initMotion() {
    if (typeof gsap === 'undefined') {
      console.warn('CampusConnect: GSAP not loaded. Falling back to CSS transitions.');
      return;
    }

    // Register ScrollTrigger if available
    if (typeof ScrollTrigger !== 'undefined') {
      gsap.registerPlugin(ScrollTrigger);
    }

    // -------------------------------------------------------------
    // 1. HERO ENTRANCE SEQUENCES
    // -------------------------------------------------------------
    var heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.6 } });

    var heroBadge = document.querySelector('.college-label, .hero-badge, .dashboard-label, .small-heading');
    var heroTitle = document.querySelector('.home-hero h1, .landing-hero h1, .contact-hero h1, .dash-hero h1, .hero-text h1');
    var heroSub = document.querySelector('.hero-description, .dash-hero-sub, .contact-hero p, .landing-hero p:not(.college-label)');
    var heroActions = document.querySelector('.hero-actions, .hero-buttons, .landing-hero .actions');
    var heroPreview = document.querySelector('.dashboard-preview, .hero-box, .campus-picks');

    if (heroTitle) {
      if (heroBadge) {
        heroTimeline.fromTo(heroBadge, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.4 });
      }

      heroTimeline.fromTo(heroTitle, { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.65 }, '-=0.2');

      if (heroSub) {
        heroTimeline.fromTo(heroSub, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.35');
      }

      if (heroActions) {
        heroTimeline.fromTo(heroActions, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.45 }, '-=0.3');
      }

      if (heroPreview) {
        heroTimeline.fromTo(heroPreview, { opacity: 0, y: 28, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: 'back.out(1.2)' }, '-=0.5');
      }
    }

    // -------------------------------------------------------------
    // 2. SCROLL TRIGGER REVEALS
    // -------------------------------------------------------------
    if (typeof ScrollTrigger !== 'undefined') {
      // Service cards & Grid items
      var cardContainers = [
        '.service-grid .service-card',
        '.event-grid .event-card',
        '.home-stats .stat-highlight',
        '.dashboard-section .grid .dashboard-card',
        '.dashboard-stats .stat-card',
        '.canteen-grid .canteen-card',
        '.feature-grid .feature-card',
        '.quick-cards .quick-card',
        '.item-grid .item-card'
      ];

      cardContainers.forEach(function (selector) {
        var elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          gsap.fromTo(elements,
            { opacity: 0, y: 24 },
            {
              opacity: 1,
              y: 0,
              duration: 0.55,
              stagger: 0.08,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: elements[0].parentElement || elements[0],
                start: 'top 85%',
                toggleActions: 'play none none none'
              }
            }
          );
        }
      });

      // Section intros
      var sectionIntros = document.querySelectorAll('.section-intro, .section-heading, .section-title, .why-heading');
      sectionIntros.forEach(function (intro) {
        gsap.fromTo(intro,
          { opacity: 0, y: 18 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power2.out',
            scrollTrigger: {
              trigger: intro,
              start: 'top 88%',
              toggleActions: 'play none none none'
            }
          }
        );
      });

      // Count-up numbers using GSAP ticker
      var counters = document.querySelectorAll('.count-up');
      counters.forEach(function (counter) {
        var target = parseInt(counter.getAttribute('data-target'), 10);
        if (isNaN(target)) return;

        var countObj = { val: 0 };
        ScrollTrigger.create({
          trigger: counter,
          start: 'top 90%',
          once: true,
          onEnter: function () {
            gsap.to(countObj, {
              val: target,
              duration: 1.2,
              ease: 'power3.out',
              onUpdate: function () {
                counter.textContent = Math.floor(countObj.val);
              },
              onComplete: function () {
                counter.textContent = target;
              }
            });
          }
        });
      });
    }

    // -------------------------------------------------------------
    // 3. SUBTLE BUTTON HOVER POLISH
    // -------------------------------------------------------------
    var buttons = document.querySelectorAll('.home-btn-primary, .primary-btn, .signin-btn');
    buttons.forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        gsap.to(btn, { scale: 1.025, duration: 0.18, ease: 'power1.out' });
      });
      btn.addEventListener('mouseleave', function () {
        gsap.to(btn, { scale: 1, duration: 0.2, ease: 'power1.out' });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMotion);
  } else {
    initMotion();
  }
})();
