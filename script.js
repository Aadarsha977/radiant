/**
 * RADIANT DENTAL - Premium Website JavaScript
 * Bulletproof implementation with graceful degradation
 * All features work independently. Hero WebGL shader uses Three.js when available.
 */

(function() {
    'use strict';

    // ============ CONFIGURATION ============
    const CONFIG = {
        observerThreshold: 0.1,
        observerRootMargin: '0px 0px -50px 0px',
        scrollThreshold: 50,
        counterDuration: 1200,
        preloaderDelay: 200
    };

    // ============ UTILITY FUNCTIONS ============
    
    /**
     * Safe query selector with error handling
     */
    function $(selector, context = document) {
        try {
            return context.querySelector(selector);
        } catch (e) {
            console.warn('Selector error:', selector);
            return null;
        }
    }

    /**
     * Safe query selector all
     */
    function $$(selector, context = document) {
        try {
            return Array.from(context.querySelectorAll(selector));
        } catch (e) {
            console.warn('Selector error:', selector);
            return [];
        }
    }

    /**
     * Debounce function for performance
     */
    function debounce(func, wait = 100) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * Throttle function for scroll events
     */
    function throttle(func, limit = 100) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Check if element is in viewport
     */
    function isInViewport(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return (
            rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0
        );
    }

    // ============ PRELOADER ============
    
    function initPreloader() {
        try {
            const preloader = $('#preloader');
            if (!preloader) return;

            const hidePreloader = () => {
                preloader.classList.add('hidden');
                document.body.style.overflow = '';
            };

            // Hide preloader when page loads
            if (document.readyState === 'complete') {
                setTimeout(hidePreloader, CONFIG.preloaderDelay);
            } else {
                window.addEventListener('load', () => {
                    setTimeout(hidePreloader, CONFIG.preloaderDelay);
                });
            }

            // Fallback: hide after 3 seconds no matter what
            setTimeout(hidePreloader, 3000);

        } catch (e) {
            console.warn('Preloader error:', e);
            // Make sure content is visible even if preloader fails
            const preloader = $('#preloader');
            if (preloader) preloader.style.display = 'none';
        }
    }

    // ============ HERO WEBGL SHADER ============

    function initHeroShader() {
        try {
            const canvas = $('#hero-shader');
            if (!canvas) return;

            // Respect reduced motion.
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

            const THREE = window.THREE;
            if (!THREE) return;

            // Avoid double initialization (e.g. if reinit is called).
            if (canvas.dataset.shaderInitialized === 'true') return;

            // Dispose any previous instance.
            if (window.RadiantDental?.heroShader?.dispose) {
                try { window.RadiantDental.heroShader.dispose(); } catch (e) { /* noop */ }
            }

            canvas.dataset.shaderInitialized = 'true';

            const vertexShader = `
      attribute vec3 position;
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

            const fragmentShader = `
      precision highp float;
      uniform vec2 resolution;
      uniform float time;
      uniform float xScale;
      uniform float yScale;
      uniform float distortion;

      void main() {
        vec2 p = (gl_FragCoord.xy * 2.0 - resolution) / min(resolution.x, resolution.y);
        
        float d = length(p) * distortion;
        
        float rx = p.x * (1.0 + d);
        float gx = p.x;
        float bx = p.x * (1.0 - d);

        float r = 0.05 / abs(p.y + sin((rx + time) * xScale) * yScale);
        float g = 0.05 / abs(p.y + sin((gx + time) * xScale) * yScale);
        float b = 0.05 / abs(p.y + sin((bx + time) * xScale) * yScale);
        
        gl_FragColor = vec4(r, g, b, 1.0);
      }
    `;

            const refs = {
                scene: null,
                camera: null,
                renderer: null,
                mesh: null,
                uniforms: null,
                animationId: null,
            };

            const initScene = () => {
                refs.scene = new THREE.Scene();

                refs.renderer = new THREE.WebGLRenderer({
                    canvas,
                    antialias: false,
                    alpha: false,
                    powerPreference: 'high-performance'
                });
                refs.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
                refs.renderer.setClearColor(new THREE.Color(0x000000), 1);

                // Camera isn't used by the raw shader, but Three requires one.
                refs.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

                refs.uniforms = {
                    resolution: { value: new THREE.Vector2(1, 1) },
                    time: { value: 0.0 },
                    xScale: { value: 1.0 },
                    yScale: { value: 0.5 },
                    distortion: { value: 0.05 },
                };

                const position = [
                    -1.0, -1.0, 0.0,
                    1.0, -1.0, 0.0,
                    -1.0, 1.0, 0.0,
                    1.0, -1.0, 0.0,
                    -1.0, 1.0, 0.0,
                    1.0, 1.0, 0.0,
                ];

                const positions = new THREE.BufferAttribute(new Float32Array(position), 3);
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', positions);

                const material = new THREE.RawShaderMaterial({
                    vertexShader,
                    fragmentShader,
                    uniforms: refs.uniforms,
                    side: THREE.DoubleSide,
                });

                refs.mesh = new THREE.Mesh(geometry, material);
                refs.scene.add(refs.mesh);

                handleResize();
            };

            const animate = () => {
                if (refs.uniforms) refs.uniforms.time.value += 0.01;
                if (refs.renderer && refs.scene && refs.camera) {
                    refs.renderer.render(refs.scene, refs.camera);
                }
                refs.animationId = requestAnimationFrame(animate);
            };

            const handleResize = () => {
                if (!refs.renderer || !refs.uniforms) return;

                const rect = canvas.getBoundingClientRect();
                const width = Math.max(1, Math.floor(rect.width));
                const height = Math.max(1, Math.floor(rect.height));

                refs.renderer.setSize(width, height, false);
                refs.uniforms.resolution.value.set(width, height);
            };

            const handleVisibility = () => {
                if (document.hidden) {
                    if (refs.animationId) cancelAnimationFrame(refs.animationId);
                    refs.animationId = null;
                } else {
                    if (!refs.animationId) animate();
                }
            };

            initScene();
            animate();
            window.addEventListener('resize', handleResize);
            document.addEventListener('visibilitychange', handleVisibility);

            const dispose = () => {
                if (refs.animationId) cancelAnimationFrame(refs.animationId);
                refs.animationId = null;
                window.removeEventListener('resize', handleResize);
                document.removeEventListener('visibilitychange', handleVisibility);

                if (refs.mesh) {
                    refs.scene?.remove(refs.mesh);
                    refs.mesh.geometry?.dispose?.();
                    refs.mesh.material?.dispose?.();
                }
                refs.renderer?.dispose?.();

                canvas.dataset.shaderInitialized = 'false';
            };

            window.RadiantDental = window.RadiantDental || {};
            window.RadiantDental.heroShader = { dispose };

        } catch (e) {
            console.warn('Hero shader init error:', e);
            try {
                const canvas = document.getElementById('hero-shader');
                if (canvas) canvas.dataset.shaderInitialized = 'false';
            } catch (_) {
                // noop
            }
        }
    }

    // ============ HEADER & NAVIGATION ============
    
    function initHeader() {
        try {
            const header = $('#header');
            const navToggle = $('#nav-toggle');
            const navMenu = $('#nav-menu');
            const navLinks = $$('.nav-link');

            if (!header) return;

            // Scroll behavior for header
            let lastScroll = 0;
            
            const handleScroll = throttle(() => {
                const currentScroll = window.pageYOffset;
                
                // Add scrolled class when page is scrolled
                if (currentScroll > CONFIG.scrollThreshold) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }

                lastScroll = currentScroll;
            }, 50);

            window.addEventListener('scroll', handleScroll, { passive: true });
            
            // Initial check
            handleScroll();

            // Mobile menu toggle
            if (navToggle && navMenu) {
                navToggle.addEventListener('click', () => {
                    navToggle.classList.toggle('active');
                    navMenu.classList.toggle('active');
                    document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
                });

                // Close menu when clicking nav links
                navLinks.forEach(link => {
                    link.addEventListener('click', () => {
                        navToggle.classList.remove('active');
                        navMenu.classList.remove('active');
                        document.body.style.overflow = '';
                    });
                });

                // Close menu on escape key
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape' && navMenu.classList.contains('active')) {
                        navToggle.classList.remove('active');
                        navMenu.classList.remove('active');
                        document.body.style.overflow = '';
                    }
                });
            }

            // Active nav link based on scroll position
            const sections = $$('section[id]');
            
            const updateActiveLink = throttle(() => {
                const scrollPos = window.scrollY + 100;

                sections.forEach(section => {
                    const sectionTop = section.offsetTop;
                    const sectionHeight = section.offsetHeight;
                    const sectionId = section.getAttribute('id');
                    const navLink = $(`.nav-link[href="#${sectionId}"]`);

                    if (scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
                        navLinks.forEach(link => link.classList.remove('active'));
                        if (navLink) navLink.classList.add('active');
                    }
                });
            }, 100);

            window.addEventListener('scroll', updateActiveLink, { passive: true });

        } catch (e) {
            console.warn('Header init error:', e);
        }
    }

    // ============ SMOOTH SCROLL ============
    
    function initSmoothScroll() {
        try {
            // Handle all anchor links
            $$('a[href^="#"]').forEach(anchor => {
                anchor.addEventListener('click', function(e) {
                    const targetId = this.getAttribute('href');
                    if (targetId === '#') return;

                    const target = $(targetId);
                    if (target) {
                        e.preventDefault();
                        
                        const headerHeight = $('#header')?.offsetHeight || 80;
                        const targetPosition = target.offsetTop - headerHeight;

                        window.scrollTo({
                            top: targetPosition,
                            behavior: 'smooth'
                        });
                    }
                });
            });

        } catch (e) {
            console.warn('Smooth scroll error:', e);
        }
    }

    // ============ REVEAL ANIMATIONS ============
    
    function initRevealAnimations() {
        try {
            const revealElements = $$('.reveal-up');
            
            if (!revealElements.length) return;

            // Use IntersectionObserver if available
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            entry.target.classList.add('revealed');
                            // Unobserve after revealing to improve performance
                            observer.unobserve(entry.target);
                        }
                    });
                }, {
                    threshold: CONFIG.observerThreshold,
                    rootMargin: CONFIG.observerRootMargin
                });

                revealElements.forEach(el => observer.observe(el));

            } else {
                // Fallback: reveal all elements immediately
                revealElements.forEach(el => el.classList.add('revealed'));
            }

        } catch (e) {
            console.warn('Reveal animation error:', e);
            // Fallback: show all elements
            $$('.reveal-up').forEach(el => el.classList.add('revealed'));
        }
    }

    // ============ COUNTER ANIMATION ============
    
    function initCounters() {
        try {
            const counters = $$('[data-count]');
            
            if (!counters.length) return;

            const animateCounter = (counter) => {
                const target = parseInt(counter.dataset.count, 10);
                const duration = CONFIG.counterDuration;
                const step = target / (duration / 16); // 60fps
                let current = 0;

                const updateCounter = () => {
                    current += step;
                    if (current < target) {
                        counter.textContent = Math.floor(current).toLocaleString();
                        requestAnimationFrame(updateCounter);
                    } else {
                        counter.textContent = target.toLocaleString();
                    }
                };

                updateCounter();
            };

            // Use IntersectionObserver to trigger animation when visible
            if ('IntersectionObserver' in window) {
                const observer = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            animateCounter(entry.target);
                            observer.unobserve(entry.target);
                        }
                    });
                }, { threshold: 0.5 });

                counters.forEach(counter => observer.observe(counter));

            } else {
                // Fallback: animate immediately
                counters.forEach(animateCounter);
            }

        } catch (e) {
            console.warn('Counter animation error:', e);
            // Fallback: show final numbers
            $$('[data-count]').forEach(counter => {
                counter.textContent = counter.dataset.count;
            });
        }
    }

    // ============ FORM HANDLING ============
    
    function initContactForm() {
        try {
            const form = $('#contact-form');
            if (!form) return;

            form.addEventListener('submit', function(e) {
                e.preventDefault();

                const submitBtn = form.querySelector('button[type="submit"]');
                const originalText = submitBtn.innerHTML;

                // Show loading state
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span>Sending...</span>';

                // Simulate form submission (replace with actual API call)
                setTimeout(() => {
                    // Show success message
                    submitBtn.innerHTML = '<span>Message Sent! ✓</span>';

                    // Reset form
                    form.reset();

                    // Reset button after delay
                    setTimeout(() => {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = originalText;
                    }, 3000);

                }, 1500);
            });

            // Real-time validation feedback
            const inputs = form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('blur', function() {
                    if (this.required && !this.value.trim()) {
                        this.style.borderColor = 'var(--color-danger)';
                    } else {
                        this.style.borderColor = '';
                    }
                });

                input.addEventListener('focus', function() {
                    this.style.borderColor = '';
                });
            });

        } catch (e) {
            console.warn('Form init error:', e);
        }
    }

    // ============ PARALLAX EFFECTS (SUBTLE) ============
    
    function initParallax() {
        try {
            // Only enable on desktop and if user prefers motion
            if (window.innerWidth < 768 || 
                window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return;
            }

            const particles = $('#particles');
            if (!particles) return;

            let ticking = false;

            window.addEventListener('scroll', () => {
                if (!ticking) {
                    requestAnimationFrame(() => {
                        const scrolled = window.pageYOffset;
                        particles.style.transform = `translateY(${scrolled * 0.3}px)`;
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });

        } catch (e) {
            console.warn('Parallax error:', e);
        }
    }

    // ============ KEYBOARD ACCESSIBILITY ============
    
    function initAccessibility() {
        try {
            // Add focus visible class for keyboard navigation
            document.body.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    document.body.classList.add('keyboard-nav');
                }
            });

            document.body.addEventListener('mousedown', () => {
                document.body.classList.remove('keyboard-nav');
            });

            // Handle reduced motion preference
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                document.documentElement.style.setProperty('--duration-fast', '0ms');
                document.documentElement.style.setProperty('--duration-normal', '0ms');
                document.documentElement.style.setProperty('--duration-slow', '0ms');
            }

        } catch (e) {
            console.warn('Accessibility init error:', e);
        }
    }

    // ============ LAZY LOADING IMAGES (FUTURE USE) ============
    
    function initLazyLoad() {
        try {
            if ('loading' in HTMLImageElement.prototype) {
                // Native lazy loading supported
                $$('img[data-src]').forEach(img => {
                    img.src = img.dataset.src;
                    img.loading = 'lazy';
                });
            } else if ('IntersectionObserver' in window) {
                // Fallback to IntersectionObserver
                const imageObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src;
                            img.classList.add('loaded');
                            imageObserver.unobserve(img);
                        }
                    });
                });

                $$('img[data-src]').forEach(img => imageObserver.observe(img));
            }

        } catch (e) {
            console.warn('Lazy load error:', e);
        }
    }

    // ============ CURRENT YEAR FOR COPYRIGHT ============
    
    function updateCopyrightYear() {
        try {
            const yearElements = $$('[data-year]');
            const currentYear = new Date().getFullYear();
            yearElements.forEach(el => {
                el.textContent = currentYear;
            });
        } catch (e) {
            // Silent fail - not critical
        }
    }

    // ============ INITIALIZATION ============
    
    function init() {
        try {
            // Mark init as run so the window-load fallback doesn't over-trigger.
            if (document.body) document.body.classList.add('js-initialized');

            // Core functionality
            initPreloader();
            initHeroShader();
            initHeader();
            initSmoothScroll();
            initRevealAnimations();
            initCounters();
            initContactForm();
            
            // Enhancements
            initParallax();
            initAccessibility();
            initLazyLoad();
            updateCopyrightYear();

            console.log('Radiant Dental: All systems initialized ✓');

        } catch (e) {
            console.error('Initialization error:', e);
            // Ensure content is visible even if JS fails
            $$('.reveal-up').forEach(el => el.classList.add('revealed'));
            const preloader = $('#preloader');
            if (preloader) preloader.classList.add('hidden');
        }
    }

    // ============ DOM READY ============
    
    // Multiple fallbacks for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already ready
        init();
    }

    // Additional safety: run init on window load if DOMContentLoaded somehow missed
    window.addEventListener('load', () => {
        // Check if init already ran
        if (!document.body.classList.contains('js-initialized')) {
            document.body.classList.add('js-initialized');
            // Re-run critical functions
            const preloader = $('#preloader');
            if (preloader && !preloader.classList.contains('hidden')) {
                preloader.classList.add('hidden');
            }
            $$('.reveal-up:not(.revealed)').forEach(el => el.classList.add('revealed'));
        }
    });

    // Expose utility for debugging (optional)
    window.RadiantDental = Object.assign(window.RadiantDental || {}, {
        version: '2.0.0',
        reinit: init
    });

})();
