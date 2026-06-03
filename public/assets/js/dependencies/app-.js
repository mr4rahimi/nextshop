/* =========================================================
   MAIN JAVASCRIPT MODULES - ORGANIZED BY FUNCTIONALITY
   ========================================================= */

// Global variables shared across modules
let otpCountdown;
let selectedProducts = [];
let chartInstance = null;
const OTP_TIMER_SECONDS = 59;
const MAX_COMPARE_ITEMS = 3;

// Make category filters instance globally accessible
let categoryFiltersInstance = null;

/* =========================================================
   1. TIMER MODULES
   ========================================================= */

/**
 * 24-HOUR COUNTDOWN TIMER
 * Displays Persian-formatted countdown for special offers
 */
function startIncredibleTimer() {
    const countDownDate = new Date().getTime() + (24 * 60 * 60 * 1000);

    const timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = countDownDate - now;

        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const hoursEl = document.getElementById("hours");
        const minutesEl = document.getElementById("minutes");
        const secondsEl = document.getElementById("seconds");
        const timerContainer = document.querySelector(".incredible-timer-container");

        // Display with Persian digits
        if (hoursEl) hoursEl.innerHTML = hours < 10 ? "۰" + hours : hours;
        if (minutesEl) minutesEl.innerHTML = minutes < 10 ? "۰" + minutes : minutes;
        if (secondsEl) secondsEl.innerHTML = seconds < 10 ? "۰" + seconds : seconds;

        if (distance < 0) {
            clearInterval(timerInterval);
            if (timerContainer) timerContainer.innerHTML = "Offer Expired";
        }
    }, 1000);
}

/**
 * AMAZING TIMER (8-HOUR COUNTDOWN)
 * Special offer countdown timer with Persian digit formatting
 * @param {number} durationInHours - Timer duration in hours
 * @param {string} displayId - DOM element ID for timer display
 */
function startTimer(durationInHours, displayId) {
    let timer = durationInHours * 3600;
    const container = document.getElementById(displayId);

    if (!container) return;

    const hoursElem = container.querySelector('.hours');
    const minsElem = container.querySelector('.minutes');
    const secsElem = container.querySelector('.seconds');

    if (!hoursElem || !minsElem || !secsElem) return;

    const interval = setInterval(() => {
        let hours = Math.floor(timer / 3600);
        let minutes = Math.floor((timer % 3600) / 60);
        let seconds = timer % 60;

        hoursElem.textContent = hours < 10 ? "۰" + hours : hours;
        minsElem.textContent = minutes < 10 ? "۰" + minutes : minutes;
        secsElem.textContent = seconds < 10 ? "۰" + seconds : seconds;

        if (--timer < 0) {
            clearInterval(interval);
            container.innerHTML = "<span class='text-red-500 font-bold'>فرصت تمام شد!</span>";
        }
    }, 1000);
}

/**
 * AMAZING DEALS TIMER
 * Alternative 8-hour timer with different DOM structure
 */
function startAmazingTimer(hours, elementId) {
    let totalSeconds = hours * 3600;
    const container = document.getElementById(elementId);
    const displays = container.querySelectorAll('.timer-box span:first-child');

    const updateTimer = () => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;

        const persian = (num) => String(num).padStart(2, '0').replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);

        displays[2].textContent = persian(h); // Hours
        displays[1].textContent = persian(m); // Minutes
        displays[0].textContent = persian(s); // Seconds

        if (totalSeconds > 0) totalSeconds--;
    };

    setInterval(updateTimer, 1000);
    updateTimer();
}

/* =========================================================
   2. AUTHENTICATION & MODAL SYSTEM
   ========================================================= */

/**
 * LOGIN & OTP MODAL SYSTEM
 * Manages two-step authentication flow with OTP timer
 */

/**
 * Transitions between login steps (Phone input → OTP verification)
 * @param {number} step - Target step number (1 or 2)
 */
function goToStep(step) {
    const step1 = document.getElementById('step-1');
    const step2 = document.getElementById('step-2');

    if (step === 2) {
        step1.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            step1.classList.add('hidden');
            step2.classList.remove('hidden');
            setTimeout(() => {
                step2.classList.remove('opacity-0', 'scale-95');
                step2.classList.add('opacity-100', 'scale-100');
                document.querySelector('.otp-field')?.focus();
                startOtpTimer();
            }, 50);
        }, 300);
    } else {
        step2.classList.add('opacity-0', 'scale-95');
        setTimeout(() => {
            step2.classList.add('hidden');
            step1.classList.remove('hidden');
            clearInterval(otpCountdown);
            setTimeout(() => {
                step1.classList.remove('opacity-0', 'scale-95');
            }, 50);
        }, 300);
    }
}

/**
 * Initiates and manages countdown timer for OTP resend functionality
 */
function startOtpTimer() {
    const timerDisplay = document.getElementById('timer-text');
    const resendBtn = document.getElementById('resend-btn');
    let timeLeft = OTP_TIMER_SECONDS;

    if (!resendBtn || !timerDisplay) return;

    resendBtn.disabled = true;
    resendBtn.style.opacity = "0.5";
    resendBtn.classList.remove('text-blue-600');
    resendBtn.classList.add('text-gray-400');

    clearInterval(otpCountdown);
    otpCountdown = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = `ارسال مجدد کد (${timeLeft}s)`;

        if (timeLeft <= 0) {
            clearInterval(otpCountdown);
            timerDisplay.textContent = "ارسال مجدد کد";
            resendBtn.disabled = false;
            resendBtn.style.opacity = "1";
            resendBtn.classList.remove('text-gray-400');
            resendBtn.classList.add('text-blue-600', 'hover:text-blue-700');
        }
    }, 1000);
}

/**
 * Opens the login modal with smooth animation
 */
function openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    const content = modal.querySelector('.relative.transform');
    modal.classList.remove('opacity-0', 'pointer-events-none');
    modal.classList.add('opacity-100', 'pointer-events-auto');
    content?.classList.remove('scale-95', 'translate-y-10');
    content?.classList.add('scale-100', 'translate-y-0');
}

/**
 * Closes the login modal with smooth animation
 * Resets to step 1 and clears any active timers
 */
function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (!modal) return;
    const content = modal.querySelector('.relative.transform');
    modal.classList.replace('opacity-100', 'opacity-0');
    modal.classList.replace('pointer-events-auto', 'pointer-events-none');
    content?.classList.replace('scale-100', 'scale-95');
    content?.classList.replace('translate-y-0', 'translate-y-10');
    setTimeout(() => {
        goToStep(1);
        clearInterval(otpCountdown);
    }, 500);
}

/* =========================================================
   3. QUICK VIEW MODAL
   ========================================================= */

/**
 * Quick View Modal System
 * Handles product preview in modal view
 */
function initQuickViewModal() {
    const quickViewButtons = document.querySelectorAll(".quick-view-btn");
    const modal = document.getElementById("quick-view-modal");
    const closeModalButton = document.querySelector(".close-modal-btn");
    const modalContent = modal?.querySelector("div:first-child");

    if (modal && closeModalButton && modalContent && quickViewButtons.length) {
        quickViewButtons.forEach(button => {
            button.addEventListener("click", event => {
                event.preventDefault();
                modal.classList.remove("opacity-0", "pointer-events-none");
                modalContent.classList.remove("scale-95", "opacity-0");
                modalContent.classList.add("scale-100", "opacity-100");
                if (typeof initModalSwiper === "function") initModalSwiper();
            });
        });

        const hideQuickView = () => {
            modalContent.classList.remove("scale-100", "opacity-100");
            modalContent.classList.add("scale-95", "opacity-0");
            setTimeout(() => modal.classList.add("opacity-0", "pointer-events-none"), 300);
        };

        closeModalButton.addEventListener("click", hideQuickView);
        modal.addEventListener("click", e => {
            if (e.target === modal) hideQuickView();
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && !modal.classList.contains("opacity-0")) hideQuickView();
        });
    }
}

/* =========================================================
   4. CART SYSTEM
   ========================================================= */

/**
 * CART SYSTEM (DRAWER, COUNTER & CALCULATIONS)
 * Manages shopping cart functionality including drawer, counters, and calculations
 */

// Format numbers with Persian digit grouping (3-digit separation)
const formatFaPrice = (num) => new Intl.NumberFormat('fa-IR').format(num);

/**
 * Updates all cart-related UI elements
 * - Empty cart state
 * - Item count badges
 * - Total price calculation
 * - Visual transitions
 */
function updateCartUI() {
    const rows = document.querySelectorAll('.product-row');
    const emptyMsg = document.getElementById('empty-cart-msg');
    const itemsList = document.getElementById('actual-items-list');
    const cartFooter = document.getElementById('cart-footer');
    const headerCount = document.getElementById('cart-header-count');
    const badgeCount = document.getElementById('cart-badge-count');

    let total = 0;

    // Manage empty cart state
    if (rows.length === 0) {
        emptyMsg.classList.replace('hidden', 'flex');
        itemsList.classList.add('hidden');
        cartFooter.classList.add('hidden');
        if (headerCount) headerCount.textContent = `(۰ کالا)`;
        if (badgeCount) badgeCount.textContent = '۰';
    } else {
        emptyMsg.classList.replace('flex', 'hidden');
        itemsList.classList.remove('hidden');
        cartFooter.classList.remove('hidden');

        // Calculate total price
        rows.forEach(row => {
            const price = parseInt(row.querySelector('.unit-price').dataset.price);
            const count = parseInt(row.querySelector('.item-count').textContent);
            total += price * count;
        });

        if (headerCount) headerCount.textContent = `(${rows.length} کالا)`;
        if (badgeCount) badgeCount.textContent = rows.length;
    }

    // Display formatted total price
    const priceDisplay = document.getElementById('total-price-display');
    if (priceDisplay) {
        priceDisplay.innerHTML = `${formatFaPrice(total)} <span class="text-[10px]">تومان</span>`;
    }
}

/**
 * Initializes cart drawer functionality
 */
function initCartSystem() {
    const cartBtn = document.getElementById('cart-btn');
    const cartDrawer = document.getElementById('cart-drawer');
    const closeBtn = document.querySelector('.close-cart');
    const overlay = document.querySelector('.drawer-overlay');

    // Manage drawer open/close functionality
    if (cartBtn && cartDrawer) {
        cartBtn.addEventListener('click', () => {
            cartDrawer.classList.remove('pointer-events-none');
            overlay.classList.replace('opacity-0', 'opacity-100');
            cartDrawer.querySelector('.transform').classList.replace('-translate-x-full', 'translate-x-0');
        });

        const hideDrawer = () => {
            overlay.classList.replace('opacity-100', 'opacity-0');
            cartDrawer.querySelector('.transform').classList.replace('translate-x-0', '-translate-x-full');
            setTimeout(() => cartDrawer.classList.add('pointer-events-none'), 500);
        };

        closeBtn.addEventListener('click', hideDrawer);
        overlay.addEventListener('click', hideDrawer);
    }

    // Manage cart interactions (increase, decrease, remove)
    document.addEventListener('click', e => {
        // Counter buttons
        const counterBtn = e.target.closest('.cart-counter-btn');
        if (counterBtn) {
            const countEl = counterBtn.parentElement.querySelector('.item-count');
            let count = parseInt(countEl.textContent);

            if (counterBtn.dataset.action === 'increase') count++;
            else if (counterBtn.dataset.action === 'decrease' && count > 1) count--;

            countEl.textContent = count;
            updateCartUI();
            return;
        }

        // Remove item button
        const removeBtn = e.target.closest('.remove-item-btn');
        if (removeBtn) {
            const row = removeBtn.closest('.product-row');
            row.style.transform = 'scale(0.9)';
            row.style.opacity = '0';
            setTimeout(() => {
                row.remove();
                updateCartUI();
            }, 300);
        }
    });
}

/* =========================================================
   5. NAVIGATION & MENU SYSTEMS
   ========================================================= */

/**
 * MEGA MENU NAVIGATION
 * Manages hover-based mega menu navigation with tabbed content
 */
function initMegaMenu() {
    const tabItems = document.querySelectorAll('.mega-tab-item');
    const tabContents = document.querySelectorAll('.mega-tab-content');

    if (tabItems.length && tabContents.length) {
        tabItems.forEach(item => {
            item.addEventListener('mouseenter', () => {
                const targetId = item.dataset.target;
                tabItems.forEach(i => i.classList.remove('active'));
                tabContents.forEach(c => c.classList.add('hidden'));
                item.classList.add('active');
                const targetContent = document.getElementById(targetId);
                if (targetContent) targetContent.classList.remove('hidden');
            });
        });
    }
}

/**
 * MOBILE MENU & DROPDOWNS
 * Mobile menu drawer system with overlay and dropdown support
 */
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('resMenu');
    const mobileMenu = document.getElementById('mobile-menu');
    const closeMobileBtn = document.getElementById('close-mobile-menu');
    const mobileOverlay = mobileMenu?.querySelector('.mobile-overlay');

    if (mobileMenuBtn && mobileMenu && mobileOverlay) {
        const toggleMobileMenu = (isOpen) => {
            if (isOpen) {
                mobileMenu.classList.remove('pointer-events-none');
                mobileOverlay.classList.replace('opacity-0', 'opacity-100');
                mobileMenu.querySelector('div:last-child')?.classList.replace('translate-x-full', 'translate-x-0');
            } else {
                mobileOverlay.classList.replace('opacity-100', 'opacity-0');
                mobileMenu.querySelector('div:last-child')?.classList.replace('translate-x-0', 'translate-x-full');
                setTimeout(() => mobileMenu.classList.add('pointer-events-none'), 300);
            }
        };

        mobileMenuBtn.addEventListener('click', () => toggleMobileMenu(true));
        if (closeMobileBtn) closeMobileBtn.addEventListener('click', () => toggleMobileMenu(false));
        mobileOverlay.addEventListener('click', () => toggleMobileMenu(false));

        // Mobile dropdown toggle logic
        document.querySelectorAll('.mobile-dropdown button').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.nextElementSibling?.classList.toggle('hidden');
                btn.querySelector('svg')?.classList.toggle('rotate-180');
            });
        });
    }
}

/**
 * ENHANCED MOBILE MENU SYSTEM (DRAWER)
 * Enhanced mobile menu with multi-layer accordion support
 */
function initEnhancedMobileMenu() {
    const menuBtn = document.getElementById('resMenu');
    const mobileMenu = document.getElementById('mobile-menu');
    const closeMenu = document.querySelector('.close-menu');
    const menuOverlay = document.querySelector('.menu-overlay');

    if (menuBtn && mobileMenu) {
        const toggleMenu = (isOpen) => {
            mobileMenu.classList.toggle('pointer-events-none', !isOpen);
            menuOverlay.classList.replace(isOpen ? 'opacity-0' : 'opacity-100', isOpen ? 'opacity-100' : 'opacity-0');
            mobileMenu.querySelector('div:last-child').classList.toggle('translate-x-0', isOpen);
            mobileMenu.querySelector('div:last-child').classList.toggle('translate-x-full', !isOpen);
        };

        menuBtn.addEventListener('click', () => toggleMenu(true));
        closeMenu.addEventListener('click', () => toggleMenu(false));
        menuOverlay.addEventListener('click', () => toggleMenu(false));

        // Multi-layer accordion management
        document.querySelectorAll('.layer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing parent layers

                const submenu = btn.nextElementSibling;
                const arrow = btn.querySelector('.arrow-icon');

                if (submenu && submenu.classList.contains('submenu')) {
                    const isHidden = submenu.classList.contains('hidden');

                    // Open or close the current layer
                    submenu.classList.toggle('hidden');

                    // Arrow rotation animation
                    if (arrow) {
                        arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                    }

                    // Optional active button styling
                    if (isHidden) {
                        btn.classList.add('ring-1', 'ring-blue-500/30');
                    } else {
                        btn.classList.remove('ring-1', 'ring-blue-500/30');
                    }
                }
            });
        });
    }
}

/* =========================================================
   6. PRODUCT PAGE COMPONENTS
   ========================================================= */

/**
 * PRODUCT CONTENT TABS
 * Product detail page tab switching with smooth transitions
 */
function initProductTabs() {
    const productTabs = document.querySelectorAll('.product-tab');
    if (productTabs.length) {
        productTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetContent = document.getElementById(tab.dataset.target);
                if (!targetContent) return;

                productTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                // Smooth transition logic
                document.querySelectorAll('.product-content').forEach(content => {
                    content.style.opacity = '0';
                    content.style.transform = 'translateY(10px)';
                    setTimeout(() => {
                        content.classList.add('hidden');
                        content.classList.remove('grid');
                    }, 300);
                });

                setTimeout(() => {
                    targetContent.classList.remove('hidden');
                    targetContent.classList.add('grid');
                    setTimeout(() => {
                        targetContent.style.opacity = '1';
                        targetContent.style.transform = 'translateY(0)';
                    }, 50);
                }, 320);
            });
        });
    }
}

/**
 * PRODUCT VARIABLE SELECTION
 * Manages color and size selection in product page
 */
function initProductVariables() {
    // Color selection
    const colorBtns = document.querySelectorAll('.color-btn');
    const colorNameDisplay = document.getElementById('selected-color-name');

    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active ring from others
            colorBtns.forEach(b => b.classList.replace('ring-blue-600', 'ring-transparent'));
            // Add ring to clicked button
            btn.classList.replace('ring-transparent', 'ring-blue-600');
            // Update color text
            if (colorNameDisplay) {
                colorNameDisplay.innerText = btn.getAttribute('data-color');
            }
        });
    });

    // Size selection
    const sizeBtns = document.querySelectorAll('.size-btn');
    const sizeNameDisplay = document.getElementById('selected-size-name');

    sizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Reset all size buttons
            sizeBtns.forEach(b => {
                b.classList.remove('border-blue-600', 'bg-blue-50', 'dark:bg-blue-600/10', 'text-blue-600', 'dark:text-blue-400');
                b.classList.add('border-transparent', 'bg-gray-100', 'dark:bg-white/5', 'text-gray-700', 'dark:text-gray-300');
            });

            // Apply active style to selected button
            btn.classList.replace('border-transparent', 'border-blue-600');
            btn.classList.replace('bg-gray-100', 'bg-blue-50');
            btn.classList.add('dark:bg-blue-600/10', 'text-blue-600', 'dark:text-blue-400');

            // Update size text
            if (sizeNameDisplay) {
                sizeNameDisplay.innerText = btn.getAttribute('data-size');
            }
        });
    });
}

/**
 * ADD TO CART IN PRODUCT PAGE
 * Handles add to cart button interaction
 */
function initAddToCart() {
    const cartBtn = document.getElementById('add-to-cart-btn');
    if (!cartBtn) return;

    cartBtn.addEventListener('click', function() {
        // Simple click effect
        const originalText = this.querySelector('span')?.innerText || '';
        this.querySelector('span').innerText = 'به سبد اضافه شد';
        this.classList.replace('bg-blue-600', 'bg-green-600');

        setTimeout(() => {
            this.querySelector('span').innerText = originalText;
            this.classList.replace('bg-green-600', 'bg-blue-600');
        }, 2000);

        // Here you would call your cart addition function (Redux/Context)
        console.log('Product added to cart!');
    });
}

/**
 * COLOR SELECTOR LOGIC
 * Product color selection with visual feedback
 */
function initColorSelector() {
    const colorOptions = document.querySelectorAll(".color-option");
    if (colorOptions.length) {
        colorOptions.forEach(button => {
            button.addEventListener("click", function () {
                colorOptions.forEach(btn => btn.classList.remove("active"));
                this.classList.add("active");
                console.log("User selected color:", this.getAttribute("data-color"));
            });
        });
    }
}

/* =========================================================
   7. FAQ ACCORDION
   ========================================================= */

/**
 * FAQ ACCORDION SYSTEM
 * Single-item expand/collapse behavior for FAQ sections
 */
function initFaqAccordion() {
    const faqTriggers = document.querySelectorAll('.faq-trigger');
    if (faqTriggers.length) {
        faqTriggers.forEach(trigger => {
            trigger.addEventListener('click', () => {
                const parent = trigger.closest('.faq-item');
                if (!parent) return;
                const isOpen = parent.classList.contains('active');

                // Collapse all other FAQ items
                document.querySelectorAll('.faq-item').forEach(item => {
                    item.classList.remove('active');
                    const content = item.querySelector('.faq-content');
                    if (content) content.style.maxHeight = '0px';
                });

                // Expand selected FAQ item
                if (!isOpen) {
                    parent.classList.add('active');
                    const content = parent.querySelector('.faq-content');
                    if (content) content.style.maxHeight = content.scrollHeight + 'px';
                }
            });
        });
    }
}

/* =========================================================
   8. DARK MODE MANAGEMENT
   ========================================================= */

/**
 * DARK MODE TOGGLE
 * Dark mode toggle with localStorage persistence and system preference detection
 */
function initDarkMode() {
    const toggleButton = document.getElementById("dark-mode-toggle");
    const htmlElement = document.documentElement;
    if (!htmlElement) return;

    // Load initial theme from storage or system preference
    const savedTheme = localStorage.getItem("theme");
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
        htmlElement.classList.add("dark");
    }

    // Listen for system theme changes
    if (window.matchMedia) {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
            if (!localStorage.getItem("theme")) {
                e.matches ? htmlElement.classList.add("dark") : htmlElement.classList.remove("dark");
            }
        });
    }

    // Toggle button event
    if (toggleButton) {
        toggleButton.addEventListener("click", () => {
            if (htmlElement.classList.contains("dark")) {
                htmlElement.classList.remove("dark");
                localStorage.setItem("theme", "light");
            } else {
                htmlElement.classList.add("dark");
                localStorage.setItem("theme", "dark");
            }
        });
    }
}

/* =========================================================
   9. SHOP FILTERING SYSTEM
   ========================================================= */

/**
 * CYBER-GLASS SHOP SECTION SCRIPT
 * Product filtering system with smooth card animations
 */
function initShopFiltering() {
    const filterButtons = document.querySelectorAll('.shop-filter-btn');
    const cards = document.querySelectorAll('.product-card');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const filterValue = btn.getAttribute('data-filter');

            // Update active state of filter buttons
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Start exit animation for all cards
            cards.forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'scale(0.9) translateY(10px)';
            });

            // Filtering and entry animation (after previous cards fade)
            setTimeout(() => {
                cards.forEach(card => {
                    const category = card.getAttribute('data-category');

                    if (filterValue === 'all' || category === filterValue) {
                        card.classList.remove('hidden');
                        // Short delay for entry animation
                        setTimeout(() => {
                            card.style.opacity = '1';
                            card.style.transform = 'scale(1) translateY(0)';
                        }, 50);
                    } else {
                        card.classList.add('hidden');
                    }
                });
            }, 400); // Match exit animation duration
        });
    });

    // Buy button click animation with temporary state feedback
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const originalText = this.innerText;
            this.innerText = "✓ اضافه شد";
            this.style.transform = "scale(0.95)";

            setTimeout(() => {
                this.innerText = originalText;
                this.style.transform = "scale(1)";
            }, 1500);
        });
    });
}

/* =========================================================
   10. SEARCH SYSTEM
   ========================================================= */

/**
 * MAIN SEARCH SYSTEM
 * Search input functionality with overlay and focus management
 */
function initSearchSystem() {
    const input = document.getElementById('main-search-input');
    const wrapper = document.getElementById('search-wrapper');
    const panel = document.getElementById('mega-search-panel');

    if (!input || !wrapper) return;

    // Create high-z-index overlay (one layer below search)
    const overlay = document.createElement('div');
    overlay.id = 'final-search-overlay';
    overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-md opacity-0 invisible transition-all duration-500 z-[99998]';
    document.body.appendChild(overlay);

    // Find header for z-index management during scroll
    const mainHeader = document.querySelector('header') || wrapper.parentElement;

    const openSearch = () => {
        overlay.classList.remove('opacity-0', 'invisible');
        overlay.classList.add('opacity-100', 'visible');

        // Ensure header stays above overlay when page is scrolled
        if (mainHeader) {
            mainHeader.style.zIndex = '999999';
        }

        wrapper.style.zIndex = '100000';
        wrapper.style.position = 'relative';
        document.body.style.overflow = 'hidden';
    };

    const closeSearch = () => {
        overlay.classList.add('opacity-0', 'invisible');
        overlay.classList.remove('opacity-100', 'visible');

        if (mainHeader) {
            mainHeader.style.zIndex = '';
        }

        wrapper.style.zIndex = '';
        document.body.style.overflow = '';
    };

    input.addEventListener('focus', openSearch);

    // Handle focus loss with delay to prevent panel flicker
    input.addEventListener('blur', () => {
        setTimeout(() => {
            // Check if focus moved inside the panel
            if (document.activeElement !== input) {
                closeSearch();
            }
        }, 200);
    });

    // Prevent closing when interacting with search panel
    if (panel) {
        panel.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }

    // Close search when clicking overlay
    overlay.addEventListener('click', closeSearch);

    // Close search with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            input.blur();
            closeSearch();
        }
    });
}

/**
 * MOBILE SEARCH MODAL
 * Mobile search modal functionality
 */
function initMobileSearchModal() {
    const searchModal = document.getElementById('search-modal');
    const openModalBtn = document.getElementById('mobile-search-toggle');
    const closeModalBtn = document.getElementById('close-search-modal');
    const modalInput = document.getElementById('modal-search-input');

    if (!searchModal || !openModalBtn || !closeModalBtn || !modalInput) return;

    // Function to open mobile search modal
    const openSearch = () => {
        searchModal.classList.remove('invisible', 'opacity-0');
        searchModal.classList.add('visible', 'opacity-100');
        document.body.style.overflow = 'hidden'; // Disable page scroll
        setTimeout(() => modalInput.focus(), 400); // Auto-focus on input
    };

    // Function to close mobile search modal
    const closeSearch = () => {
        searchModal.classList.add('invisible', 'opacity-0');
        searchModal.classList.remove('visible', 'opacity-100');
        document.body.style.overflow = 'auto';
    };

    // Event bindings
    openModalBtn.addEventListener('click', openSearch);
    closeModalBtn.addEventListener('click', closeSearch);

    // Close modal with Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeSearch();
    });
}

/* =========================================================
   11. MODAL SYSTEMS
   ========================================================= */

/**
 * SELLER MODAL
 * Modal for displaying seller information
 */
function initSellerModal() {
    const modal = document.getElementById('sellers-modal');
    const openBtn = document.getElementById('open-sellers-modal');
    const closeBtn = document.getElementById('close-sellers-modal');
    const modalContent = modal?.querySelector('.relative');

    if (!modal || !openBtn || !closeBtn || !modalContent) return;

    const openModal = () => {
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modalContent.classList.replace('scale-95', 'scale-100');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        modal.classList.add('opacity-0', 'pointer-events-none');
        modalContent.classList.replace('scale-100', 'scale-95');
        document.body.style.overflow = '';
    };

    openBtn.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);

    // Close by clicking on background
    modal.querySelector('.absolute').addEventListener('click', closeModal);
}

/**
 * TAB MANAGER
 * Generic tab switching functionality
 */
function switchTab(tabId) {
    // Hide all content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('block');
    });

    // Deactivate all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-blue-600', 'text-white');
        btn.classList.add('text-gray-400');
    });

    // Show selected content
    const targetContent = document.getElementById('tab-' + tabId);
    if (targetContent) {
        targetContent.classList.remove('hidden');
        targetContent.classList.add('block');
    }

    // Activate selected button
    const targetButton = document.getElementById('btn-' + tabId);
    if (targetButton) {
        targetButton.classList.add('active');
        targetButton.classList.remove('text-gray-400');
    }
}

/**
 * TOGGLE MODAL
 * Generic modal toggle function
 */
function toggleModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.toggle('hidden');
        if (!modal.classList.contains('hidden')) {
            setTimeout(initChart, 100); // Short delay for canvas rendering
        }
    }
}

/* =========================================================
   12. PROS & CONS MANAGEMENT
   ========================================================= */

/**
 * PROS & CONS TAG MANAGEMENT
 * Handles adding and removing pros/cons tags
 */
function initProsConsManager() {
    // Function to add items (pros/cons)
    function addItem(type) {
        const input = document.getElementById(`${type}Input`);
        const list = document.getElementById(`${type}List`);

        if (!input || !list) return;

        const val = input.value.trim();

        if (val !== "") {
            const tag = document.createElement('div');
            const colorClass = type === 'pros'
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border-rose-500/20';

            tag.className = `flex items-center gap-3 px-5 py-2.5 rounded-2xl border ${colorClass} text-[13px] font-black animate-in fade-in slide-in-from-bottom-2 duration-300`;
            tag.innerHTML = `
                <span>${val}</span>
                <button type="button" class="hover:rotate-90 hover:text-black dark:hover:text-white transition-all duration-300" onclick="this.parentElement.remove()">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            `;
            list.appendChild(tag);
            input.value = "";
            input.focus();
        }
    }

    // Enter key for quick addition
    ['prosInput', 'consInput'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addItem(id.replace('Input', ''));
                }
            });
        }
    });

    // Make addItem function globally available
    window.addItem = addItem;
}

/* =========================================================
   13. PRICE CHART MODAL
   ========================================================= */

/**
 * PRICE CHART MODAL
 * Modal with price history chart visualization
 */
function initChart() {
    const ctx = document.getElementById('priceChart')?.getContext('2d');
    if (!ctx) return;

    const fontName = 'payda, sans-serif';

    if (chartInstance) chartInstance.destroy();

    // Create gradient for chart area
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(37, 99, 235, 0.25)');
    gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور'],
            datasets: [{
                data: [1300000, 1450000, 1420000, 1680000, 1600000, 1890000],
                borderColor: '#2563eb',
                borderWidth: 5,
                fill: true,
                backgroundColor: gradient,
                tension: 0.45,
                pointRadius: 0,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#2563eb',
                pointHoverBorderWidth: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: true,
                    backgroundColor: '#18181b',
                    titleFont: { family: fontName, size: 14, weight: 'bold' },
                    bodyFont: { family: fontName, size: 13 },
                    padding: 15,
                    cornerRadius: 15,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `قیمت: ${context.raw.toLocaleString()} تومان`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    display: true,
                    position: 'right',
                    grid: { color: 'rgba(0,0,0,0.03)', drawBorder: false },
                    ticks: {
                        font: { family: fontName, size: 11, weight: '600' },
                        color: '#94a3b8',
                        callback: value => value.toLocaleString()
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        font: { family: fontName, size: 12, weight: 'bold' },
                        color: '#64748b'
                    }
                }
            }
        }
    });
}

/* =========================================================
   14. SHARE MODAL
   ========================================================= */

/**
 * SHARE MODAL FUNCTIONALITY
 * Handles link copying for social sharing
 */
function copyLink() {
    const linkInput = document.getElementById('shareLink');
    if (!linkInput) return;

    linkInput.select();
    document.execCommand('copy');

    // Change button text for user feedback
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'کپی شد!';
    btn.classList.replace('bg-blue-600', 'bg-emerald-500');

    setTimeout(() => {
        btn.innerText = originalText;
        btn.classList.replace('bg-emerald-500', 'bg-blue-600');
    }, 2000);
}

/* =========================================================
   15. COMPARE MODAL
   ========================================================= */

/**
 * COMPARE MODAL (Product Comparison Center)
 * Manages product selection for comparison (max 3 products)
 */

/**
 * Filters product list based on user input
 */
function filterProducts() {
    const searchInput = document.getElementById('productSearch');
    if (!searchInput) return;

    const query = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('.product-item');

    items.forEach(item => {
        const name = item.innerText.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

/**
 * Adds product to comparison list
 * @param {number|string} id - Product identifier
 * @param {string} name - Product name
 * @param {string} img - Product image URL
 */
function addProduct(id, name, img) {
    // Maximum limit (3 products in addition to current product)
    if (selectedProducts.length >= MAX_COMPARE_ITEMS) {
        alert("شما می‌توانید حداکثر ۳ کالا برای مقایسه انتخاب کنید.");
        return;
    }

    // Prevent duplicate selection
    if (selectedProducts.find(p => p.id === id)) {
        return;
    }

    // Add to array and update UI
    selectedProducts.push({ id, name, img });
    updateSlots();
}

/**
 * Removes product from comparison list
 * @param {number|string} id - Product identifier
 */
function removeProduct(id) {
    selectedProducts = selectedProducts.filter(p => p.id !== id);
    updateSlots();
}

/**
 * Updates visual state of comparison slots
 * Maintains constant height (h-36) and styles
 */
function updateSlots() {
    const slots = document.querySelectorAll('.slot');
    const finalBtn = document.getElementById('finalBtn');

    slots.forEach(slot => {
        // Reset to empty state
        slot.className = "slot h-36 border-2 border-dashed border-blue-300/40 dark:border-blue-900/50 rounded-3xl flex items-center justify-center text-blue-400/50 transition-all hover:bg-blue-500/5";
        slot.innerHTML = `<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4"/></svg>`;
    });

    selectedProducts.forEach((product, index) => {
        const slot = slots[index];
        // Glass effect for filled state
        slot.className = "slot h-36 relative flex flex-col items-center justify-center p-3 bg-white/80 dark:bg-white/10 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-3xl animate-modal-in shadow-xl";
        slot.innerHTML = `
            <button onclick="removeProduct('${product.id}')" class="absolute -top-2 -left-2 w-7 h-7 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform z-20">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
            <div class="w-14 h-14 mb-2 p-1 bg-white dark:bg-zinc-800 rounded-xl shadow-inner">
                <img src="${product.img}" class="w-full h-full object-contain" alt="${product.name}">
            </div>
            <span class="text-[9px] font-black text-zinc-900 dark:text-white text-center line-clamp-2 px-1">${product.name}</span>
        `;
    });

    if (finalBtn) {
        finalBtn.disabled = selectedProducts.length === 0;
    }
}

/**
 * Redirects user to technical comparison page with product IDs as parameters
 */
function goToComparePage() {
    if (selectedProducts.length === 0) return;

    // Extract IDs for URL parameters
    const productIds = selectedProducts.map(p => p.id).join(',');

    // Current product ID (should be dynamically set)
    const currentProductId = "current"; // Replace with dynamic value

    const compareUrl = `/compare?items=${currentProductId},${productIds}`;

    // Execute redirect
    window.location.href = compareUrl;
}

/* =========================================================
   17. CATEGORY FILTERS CLASS
   ========================================================= */

/**
 * CATEGORY FILTERS CLASS
 * Optimized category page filters without ID dependency
 */
class CategoryFilters {
    constructor() {
        this.init();
    }

    init() {
        // Only execute if required elements exist
        if (document.querySelector('.js-collapse-header')) {
            this.initUniversalCollapse();
        }

        if (document.querySelector('.js-price-range-container')) {
            this.initAllPriceRanges();
        }

        if (document.querySelector('.js-brand-search')) {
            this.initAllBrandSearches();
        }

        this.initOffcanvas();
    }

    /**
     * 1. Universal Collapse System
     * Manages collapse cards using event delegation
     */
    initUniversalCollapse() {
        // Use event delegation to manage clicks
        document.addEventListener('click', (e) => {
            const header = e.target.closest('.js-collapse-header');
            if (!header) return;

            const parent = header.closest('.relative');
            if (!parent) return;

            const content = parent.querySelector('.js-collapse-content');
            const icon = parent.querySelector('.js-collapse-icon');

            if (!content) return;

            const isOpen = content.style.maxHeight &&
                content.style.maxHeight !== '0px' &&
                content.style.maxHeight !== '';

            if (isOpen) {
                this.collapseClose(content, icon);
            } else {
                this.collapseOpen(content, icon);
            }
        });
    }

    collapseOpen(content, icon) {
        // Calculate exact height
        content.style.maxHeight = content.scrollHeight + "px";
        content.style.opacity = '1';
        if (icon) icon.style.transform = 'rotate(180deg)';
    }

    collapseClose(content, icon) {
        content.style.maxHeight = '0px';
        content.style.opacity = '0';
        if (icon) icon.style.transform = 'rotate(0deg)';
    }

    /**
     * 2. Price Range Sliders
     * Manages all range sliders independently
     */
    initAllPriceRanges() {
        // Find all price range containers
        const containers = document.querySelectorAll('.js-price-range-container');

        containers.forEach(container => {
            this.initPriceRange(container);
        });
    }

    initPriceRange(container) {
        // Find elements inside current container
        const minRange = container.querySelector('.js-min-range');
        const maxRange = container.querySelector('.js-max-range');
        const minInput = container.querySelector('.js-min-price-input');
        const maxInput = container.querySelector('.js-max-price-input');
        const track = container.querySelector('.js-slider-track');

        // Don't continue if required elements are missing
        if (!minRange || !maxRange || !minInput || !maxInput || !track) return;

        const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const unformatNumber = (str) => str.replace(/,/g, '');

        const updateUI = (source, context) => {
            let minVal = parseInt(context.minRange.value);
            let maxVal = parseInt(context.maxRange.value);

            // Maintain minimum distance
            if (maxVal - minVal < 1000000) {
                if (source === 'min') context.minRange.value = maxVal - 1000000;
                else if (source === 'max') context.maxRange.value = minVal + 1000000;
            }

            const minPercent = (context.minRange.value / context.minRange.max) * 100;
            const maxPercent = (context.maxRange.value / context.maxRange.max) * 100;
            context.track.style.right = minPercent + "%";
            context.track.style.left = (100 - maxPercent) + "%";

            if (source !== 'input') {
                context.minInput.value = formatNumber(context.minRange.value);
                context.maxInput.value = formatNumber(context.maxRange.value);
            }
        };

        const handleInputChange = (e, context) => {
            let cleanVal = unformatNumber(e.target.value).replace(/\D/g, '');
            if (cleanVal === "") cleanVal = 0;
            e.target.value = formatNumber(cleanVal);

            const val = parseInt(cleanVal);
            if (e.target === context.minInput) {
                if (val <= parseInt(context.maxRange.value)) context.minRange.value = val;
            } else {
                if (val >= parseInt(context.minRange.value)) context.maxRange.value = val;
            }
            updateUI('input', context);
        };

        // Store context for access in event handlers
        const context = { minRange, maxRange, minInput, maxInput, track };

        // Event listeners
        minRange.addEventListener('input', () => updateUI('min', context));
        maxRange.addEventListener('input', () => updateUI('max', context));

        minInput.addEventListener('input', (e) => handleInputChange(e, context));
        maxInput.addEventListener('input', (e) => handleInputChange(e, context));

        // Initial value setting
        updateUI(null, context);
    }

    /**
     * 3. Brand Search
     * Manages brand search in both versions
     */
    initAllBrandSearches() {
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('js-brand-search')) {
                this.handleBrandSearch(e.target);
            }
        });
    }

    handleBrandSearch(searchInput) {
        const term = searchInput.value.toLowerCase();
        // Only filter brands within current container
        const container = searchInput.closest('.js-collapse-content')?.parentElement;
        if (!container) return;

        const brandItems = container.querySelectorAll('.group\\/brand');

        brandItems.forEach(item => {
            const brandName = item.querySelector('span')?.textContent?.toLowerCase() || '';
            item.style.display = brandName.includes(term) ? 'flex' : 'none';
        });

        // Update height
        const brandsContent = searchInput.closest('.js-collapse-content');
        if (brandsContent && brandsContent.style.maxHeight !== '0px') {
            brandsContent.style.maxHeight = brandsContent.scrollHeight + "px";
        }
    }

    /**
     * 4. Offcanvas Management
     */
    initOffcanvas() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !document.getElementById('filter-offcanvas')?.classList.contains('translate-x-full')) {
                this.toggleFilters(false);
            }
        });

        // For overlay if exists
        const overlay = document.getElementById('filter-overlay');
        if (overlay) {
            overlay.addEventListener('click', () => this.toggleFilters(false));
        }
    }

    toggleFilters(isOpen) {
        const offcanvas = document.getElementById('filter-offcanvas');
        const overlay = document.getElementById('filter-overlay');
        const body = document.body;

        if (!offcanvas) return;

        if (isOpen) {
            offcanvas.classList.remove('translate-x-full');
            if (overlay) {
                overlay.classList.remove('opacity-0', 'pointer-events-none');
                overlay.classList.add('opacity-100', 'pointer-events-auto');
            }
            body.style.overflow = 'hidden';
        } else {
            offcanvas.classList.add('translate-x-full');
            if (overlay) {
                overlay.classList.remove('opacity-100', 'pointer-events-auto');
                overlay.classList.add('opacity-0', 'pointer-events-none');
            }
            body.style.overflow = '';
        }
    }
}

/**
 * Global function for filter buttons
 */
function toggleFilters(isOpen) {
    if (!categoryFiltersInstance) {
        categoryFiltersInstance = new CategoryFilters();
    }
    categoryFiltersInstance.toggleFilters(isOpen);
}

/* =========================================================
   18. CART PAGE COUNTER
   ========================================================= */

/**
 * CART PAGE COUNTER
 * Handles quantity adjustments on cart page
 */
function initCartPageCounter() {
    // Find all quantity control containers
    const counters = document.querySelectorAll('.js-counter-value');

    counters.forEach(counterValue => {
        // Find parent container to access buttons in same card
        const parent = counterValue.closest('div');
        const plusBtn = parent.querySelector('.js-plus');
        const minusBtn = parent.querySelector('.js-minus');

        // Check to ensure buttons are found
        if (plusBtn && minusBtn) {
            plusBtn.addEventListener('click', () => {
                let count = parseInt(counterValue.innerText);
                count++;
                counterValue.innerText = count;
            });

            minusBtn.addEventListener('click', () => {
                let count = parseInt(counterValue.innerText);
                if (count > 1) {
                    count--;
                    counterValue.innerText = count;
                } else {
                    // Optional: Shake effect when reaching 1
                    parent.parentElement.classList.add('animate-shake');
                    setTimeout(() => parent.parentElement.classList.remove('animate-shake'), 400);
                }
            });
        }
    });
}

/* =========================================================
   19. CHECKOUT ADDRESS MANAGEMENT
   ========================================================= */

/**
 * CHECKOUT ADDRESS MANAGEMENT
 * Manages address selection and addition in checkout page
 */
function initCheckoutAddress() {
    const toggleBtn = document.getElementById('toggle-address-btn');
    const addressList = document.getElementById('address-list');
    const currentDisplay = document.getElementById('current-address-display');
    const addForm = document.getElementById('add-address-form');
    const addressContainer = document.getElementById('address-items-container');
    const showAddFormBtn = document.getElementById('show-add-form-btn');
    const cancelAddBtn = document.getElementById('cancel-add-btn');
    const saveBtn = document.getElementById('save-address-btn');

    if (!toggleBtn || !addressList || !currentDisplay || !addForm || !addressContainer ||
        !showAddFormBtn || !cancelAddBtn || !saveBtn) return;

    // Function to switch between sections
    const switchSection = (toShow) => {
        [currentDisplay, addressList, addForm].forEach(el => el.classList.add('hidden'));
        toShow.classList.remove('hidden');
    };

    // 1. Main toggle button management
    toggleBtn.addEventListener('click', () => {
        if (addressList.classList.contains('hidden') && addForm.classList.contains('hidden')) {
            switchSection(addressList);
            toggleBtn.textContent = 'انصراف';
        } else {
            switchSection(currentDisplay);
            toggleBtn.textContent = 'تغییر یا ویرایش';
        }
    });

    // 2. Show add address form
    showAddFormBtn.addEventListener('click', () => {
        switchSection(addForm);
        toggleBtn.textContent = 'انصراف';
    });

    // 3. Cancel add form
    cancelAddBtn.addEventListener('click', () => switchSection(addressList));

    // 4. Address selection logic
    function selectAddress(element) {
        // Reset other cards' style
        document.querySelectorAll('.address-item').forEach(el => {
            el.classList.remove('border-blue-500', 'bg-white/60', 'shadow-sm');
            el.classList.add('border-transparent');
            const dot = el.querySelector('.status-dot');
            if (dot) {
                dot.className = "status-dot w-4 h-4 rounded-full border-2 border-gray-300 dark:border-white/10 bg-transparent";
            }
        });

        // Activate current card
        element.classList.add('border-blue-500', 'bg-white/60', 'shadow-sm');
        element.classList.remove('border-transparent');
        const activeDot = element.querySelector('.status-dot');
        if (activeDot) {
            activeDot.className = "status-dot w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-500";
        }

        // Update main display
        const addressText = document.getElementById('active-address-text');
        const nameText = document.getElementById('active-name');
        const phoneText = document.getElementById('active-phone');

        if (addressText) addressText.textContent = element.dataset.address || '';
        if (nameText) nameText.textContent = element.dataset.name || '';
        if (phoneText) phoneText.textContent = element.dataset.phone || '';

        // Return to main view
        switchSection(currentDisplay);
        toggleBtn.textContent = 'تغییر یا ویرایش';
    }

    // 5. Save new address and add to list
    saveBtn.addEventListener('click', () => {
        const name = document.getElementById('new-name')?.value;
        const phone = document.getElementById('new-phone')?.value;
        const addr = document.getElementById('new-address')?.value;

        if (name && phone && addr) {
            const newCard = document.createElement('div');
            newCard.className = "address-item cursor-pointer p-5 rounded-2xl bg-white/50 dark:bg-white/5 border-2 border-transparent hover:border-blue-500/30 transition-all";
            newCard.dataset.address = addr;
            newCard.dataset.name = name;
            newCard.dataset.phone = phone;

            newCard.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-black text-gray-400 italic">آدرس ثبت شده</span>
                    <div class="status-dot w-4 h-4 rounded-full border-2 border-gray-300 dark:border-white/10 bg-transparent"></div>
                </div>
                <p class="text-xs text-gray-700 dark:text-gray-300 mt-2 font-bold leading-relaxed">${addr}</p>
            `;

            newCard.addEventListener('click', () => selectAddress(newCard));
            addressContainer.appendChild(newCard);

            // Auto-select new address
            selectAddress(newCard);

            // Reset form
            document.querySelectorAll('#add-address-form input, textarea').forEach(i => i.value = '');
        } else {
            alert('لطفاً تمام موارد را پر کنید');
        }
    });

    // Activate click for existing items
    document.querySelectorAll('.address-item').forEach(item => {
        item.addEventListener('click', () => selectAddress(item));
    });
}

/* =========================================================
   20. SHIPPING COST CALCULATION
   ========================================================= */

/**
 * SHIPPING COST CALCULATION
 * Manages shipping cost selection and invoice updates
 */
function initShippingCost() {
    // 1. Invoice elements
    const shippingDisplay = document.getElementById('shipping-cost-summary');
    const totalDisplay = document.getElementById('total-payable-summary');

    // Fixed invoice values (adjust based on your invoice)
    const baseProductPrice = 125000000; // 125 million
    const totalDiscount = 2000000;      // 2 million discount

    const dayCards = document.querySelectorAll('.day-card');

    if (!shippingDisplay || !totalDisplay || dayCards.length === 0) return;

    dayCards.forEach(card => {
        card.addEventListener('click', () => {
            // 2. Manage card appearance and checkbox movement
            dayCards.forEach(c => {
                // Reset style and border
                c.classList.remove('border-blue-600', 'bg-white/80', 'dark:bg-blue-600/10');
                c.classList.add('border-white/60', 'dark:border-white/5', 'bg-white/30', 'dark:bg-white/[0.02]');

                // Hide checkbox in others
                const icon = c.querySelector('.status-icon');
                if (icon) icon.classList.replace('flex', 'hidden');

                // Reset text color
                const labels = c.querySelectorAll('span');
                if (labels[1]) {
                    labels[1].classList.remove('font-black', 'text-gray-900', 'dark:text-white');
                    labels[1].classList.add('font-bold', 'text-gray-600', 'dark:text-gray-400');
                }
            });

            // 3. Activate selected card
            card.classList.remove('border-white/60', 'dark:border-white/5', 'bg-white/30', 'dark:bg-white/[0.02]');
            card.classList.add('border-blue-600', 'bg-white/80', 'dark:bg-blue-600/10');

            // Show checkbox in active card
            const activeIcon = card.querySelector('.status-icon');
            if (activeIcon) activeIcon.classList.replace('hidden', 'flex');

            // Bolden day text
            const activeLabels = card.querySelectorAll('span');
            if (activeLabels[1]) {
                activeLabels[1].classList.remove('font-bold', 'text-gray-600', 'dark:text-gray-400');
                activeLabels[1].classList.add('font-black', 'text-gray-900', 'dark:text-white');
            }

            // 4. Main section: Update invoice
            updateInvoice(card.dataset.cost);
        });
    });

    // Function to calculate and display price in invoice
    function updateInvoice(shippingCostRaw) {
        let shippingValue = 0;

        // Convert cost text to computable number
        if (shippingCostRaw !== "0" && shippingCostRaw !== "رایگان") {
            // Remove commas and convert Persian digits to English for calculation
            const cleanPrice = shippingCostRaw.replace(/,/g, '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
            shippingValue = parseInt(cleanPrice) || 0;
        }

        const finalAmount = baseProductPrice - totalDiscount + shippingValue;

        // Update shipping cost text in invoice
        if (shippingValue === 0) {
            shippingDisplay.innerHTML = `<span class="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-lg">رایگان</span>`;
        } else {
            shippingDisplay.innerHTML = `<span class="text-sm font-black text-gray-900 dark:text-white">${shippingCostRaw} تومان</span>`;
        }

        // Update final amount with animation
        animateValue(totalDisplay, finalAmount);
    }

    function formatNumber(num) {
        return num.toLocaleString('fa-IR');
    }

    function animateValue(obj, newValue) {
        obj.style.opacity = "0.5";
        obj.style.transform = "translateY(5px)";
        setTimeout(() => {
            obj.textContent = formatNumber(newValue);
            obj.style.opacity = "1";
            obj.style.transform = "translateY(0)";
        }, 120);
    }
}

/* =========================================================
   21. PANEL SUBMENU TOGGLE
   ========================================================= */

/**
 * PANEL SUBMENU TOGGLE
 * Toggles submenu visibility in panel pages
 */
function toggleSubmenu(button) {
    // Find submenu content right after button
    const submenu = button.nextElementSibling;
    // Find arrow icon inside button
    const arrow = button.querySelector('.arrow-icon');

    if (submenu) {
        // Toggle hidden class
        const isHidden = submenu.classList.contains('hidden');

        if (isHidden) {
            submenu.classList.remove('hidden');
            submenu.classList.add('flex');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        } else {
            submenu.classList.add('hidden');
            submenu.classList.remove('flex');
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
    }
}

/* =========================================================
   22. WALLET AMOUNT CHIPS
   ========================================================= */

/**
 * WALLET AMOUNT CHIPS
 * Manages amount chip selection in wallet recharge page
 */
function initWalletAmountChips() {
    const amountInput = document.getElementById('wallet-amount-input');
    const chips = document.querySelectorAll('.amount-chip');

    if (!amountInput || chips.length === 0) return;

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            // 1. Remove "active" style from all buttons and restore to default glass style
            chips.forEach(c => {
                c.classList.remove('bg-primary-500/10', 'border-primary-500/30', 'text-primary-600', 'dark:text-primary-400', 'shadow-sm');
                c.classList.add('bg-white/50', 'dark:bg-white/[0.03]', 'border-gray-100', 'dark:border-white/10', 'text-gray-600', 'dark:text-gray-300');
            });

            // 2. Add "active" style to clicked button
            chip.classList.remove('bg-white/50', 'dark:bg-white/[0.03]', 'border-gray-100', 'dark:border-white/10', 'text-gray-600', 'dark:text-gray-300');
            chip.classList.add('bg-primary-500/10', 'border-primary-500/30', 'text-primary-600', 'dark:text-primary-400', 'shadow-sm');

            // 3. Transfer button value to input field
            amountInput.value = chip.innerText.trim();
            // Create a manual input event to trigger any formatting script
            amountInput.dispatchEvent(new Event('input'));
        });
    });
}

/* =========================================================
   23. BANK CARD INPUT FORMATTING
   ========================================================= */

/**
 * BANK CARD INPUT FORMATTING
 * Formats bank card number input with automatic bank detection
 */
function initBankCardInput() {
    const cardInput = document.getElementById('card-input');

    if (cardInput) {
        cardInput.addEventListener('input', (e) => {
            // 1. Remove all non-digit characters and previous dashes
            let value = e.target.value.replace(/\D/g, '');

            // 2. Limit input to maximum 16 digits
            value = value.substring(0, 16);

            // 3. Separate every 4 digits using Regex
            // This code finds every 4 digits and puts a dash after them
            let formattedValue = value.match(/.{1,4}/g)?.join('-') || '';

            // 4. Place formatted value in input
            e.target.value = formattedValue;

            // 5. (Optional) Automatic bank detection (simple example)
            const bankDisplay = document.getElementById('bank-name-display');
            if (value.length >= 6) {
                const bin = value.substring(0, 6);
                if (bin === '603799') {
                    if (bankDisplay) {
                        bankDisplay.innerText = 'بانک ملی ایران';
                        bankDisplay.classList.remove('text-gray-400', 'italic');
                        bankDisplay.classList.add('text-primary-500');
                    }
                } else if (bin === '621986') {
                    if (bankDisplay) {
                        bankDisplay.innerText = 'بانک سامان';
                        bankDisplay.classList.remove('text-gray-400', 'italic');
                        bankDisplay.classList.add('text-primary-500');
                    }
                }
                // You can add other BINs here
            } else {
                if (bankDisplay) {
                    bankDisplay.innerText = 'در انتظار ورود اطلاعات...';
                    bankDisplay.classList.add('text-gray-400', 'italic');
                    bankDisplay.classList.remove('text-primary-500');
                }
            }
        });

        // Prevent entering letters (Back-up for mobile)
        cardInput.addEventListener('keydown', (e) => {
            const keysAllowed = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (!keysAllowed.includes(e.key)) {
                e.preventDefault();
            }
        });
    }
}

/* =========================================================
   24. PASSWORD STRENGTH CHECKER
   ========================================================= */

/**
 * PASSWORD STRENGTH CHECKER
 * Checks password strength and updates graphical checklist
 */
function checkPasswordStrength(password) {
    let strength = 0;

    // UI elements
    const bar = document.getElementById('strength-bar');
    const text = document.getElementById('strength-text');
    const percentText = document.getElementById('strength-percent');

    if (!bar || !text || !percentText) return;

    // Checklist elements (icons and boxes)
    const checks = {
        len: { el: document.getElementById('check-len'), valid: password.length >= 8 },
        upper: { el: document.getElementById('check-upper'), valid: /[A-Z]/.test(password) && /[a-z]/.test(password) },
        spec: { el: document.getElementById('check-spec'), valid: /[!@#$%^&*(),.?":{}|<>]/.test(password) }
    };

    // 1. Update visual checklist
    Object.values(checks).forEach(item => {
        if (!item.el) return;
        const icon = item.el.querySelector('svg');

        if (item.valid) {
            strength += 33.3;
            item.el.classList.add('bg-emerald-500/20', 'border-emerald-500/40');
            item.el.classList.remove('bg-white', 'dark:bg-white/5', 'border-gray-200', 'dark:border-white/10');
            if (icon) {
                icon.classList.remove('opacity-0');
                icon.classList.add('opacity-100', 'text-emerald-500');
            }
        } else {
            item.el.classList.remove('bg-emerald-500/20', 'border-emerald-500/40');
            item.el.classList.add('bg-white', 'dark:bg-white/5', 'border-gray-200', 'dark:border-white/10');
            if (icon) {
                icon.classList.add('opacity-0');
                icon.classList.remove('opacity-100', 'text-emerald-500');
            }
        }
    });

    // 2. Calculate final percentage (rounded)
    const finalPercent = Math.min(Math.round(strength), 100);
    bar.style.width = finalPercent + '%';
    percentText.innerText = finalPercent + '٪';

    // 3. Change strength bar state based on score
    if (finalPercent === 0) {
        text.innerText = 'امنیت: نامشخص';
        bar.className = 'h-full bg-gray-400 rounded-full transition-all duration-700';
    } else if (finalPercent < 40) {
        text.innerText = 'امنیت: ضعیف';
        bar.className = 'h-full bg-red-500 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    } else if (finalPercent < 80) {
        text.innerText = 'امنیت: متوسط';
        bar.className = 'h-full bg-amber-500 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(245,158,11,0.5)]';
    } else {
        text.innerText = 'امنیت: عالی و پولادین';
        bar.className = 'h-full bg-emerald-500 rounded-full transition-all duration-700 shadow-[0_0_15px_rgba(16,185,129,0.6)]';
    }
}

/* =========================================================
   25. TICKET CHAT SYSTEM
   ========================================================= */

/**
 * TICKET CHAT SYSTEM
 * Manages ticket chat functionality with user and bot messages
 */
function initTicketChat() {
    const chatBox = document.getElementById('chatBox');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    if (!chatBox || !chatInput || !sendBtn) return;

    function createMessage(text, type = 'user') {
        const time = new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
        const isUser = type === 'user';

        const messageHTML = `
            <div class="flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div class="${isUser
            ? 'bg-primary-500 text-white rounded-tl-none shadow-lg shadow-primary-500/20'
            : 'bg-white/50 dark:bg-white/5 backdrop-blur-md border border-white/40 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-tr-none'} 
                    p-4 rounded-[1.5rem] max-w-[85%]">
                    <p class="text-[11px] font-bold leading-6">${text}</p>
                </div>
                <span class="text-[9px] text-gray-400 ${isUser ? 'ml-2' : 'mr-2'}">${time}</span>
            </div>
        `;

        chatBox.insertAdjacentHTML('beforeend', messageHTML);
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }

    function handleSend() {
        const msg = chatInput.value.trim();
        if (msg) {
            createMessage(msg, 'user');
            chatInput.value = '';

            // Simulated system response
            setTimeout(() => {
                createMessage("پیام شما دریافت شد. کارشناسان مانا در حال بررسی تیکت شما هستند.", 'bot');
            }, 1000);
        }
    }

    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSend(); });
}

/* =========================================================
   26. USER COMMENTS PAGINATION
   ========================================================= */

/**
 * USER COMMENTS PAGINATION
 * Manages pagination and like functionality in user comments page
 */
function initUserComments() {
    // Manage clicks on page numbers
    const pageButtons = document.querySelectorAll('.pagination-btn'); // Add class to buttons

    pageButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active style from previous
            document.querySelector('.page-active')?.classList.remove('bg-primary-500', 'text-white');
            // Add to current button
            this.classList.add('bg-primary-500', 'text-white');

            // Here you can load new page data with Ajax
            console.log('Loading page:', this.innerText);
        });
    });

    // Like/Useful effect
    const likeBtns = document.querySelectorAll('button[title="مفید بود"]');
    likeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            this.classList.toggle('text-emerald-500');
            const svg = this.querySelector('svg');
            if (svg) svg.classList.toggle('fill-current');
        });
    });
}

/* =========================================================
   27. DISCOUNT CODE COPY
   ========================================================= */

/**
 * DISCOUNT CODE COPY
 * Copies discount code to clipboard
 */
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Create a simple notification or change icon for user feedback
        alert('کد تخفیف کپی شد: ' + text);
    });
}


/* =========================================================
   28 TERMS & CONDITIONS NAVIGATION (SCROLLSPY)
   ========================================================= */

/**
 * TERMS & CONDITIONS NAVIGATION (SCROLLSPY)
 */
function initTermsNavigation() {
    const navLinks = document.querySelectorAll('.lg\\:col-span-3 a');
    const sections = document.querySelectorAll('.lg\\:col-span-9 > div[id]');

    if (navLinks.length === 0 || sections.length === 0) return;

    // 1. Smooth scroll on navigation click
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);

            if (targetSection) {
                const headerOffset = 120;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 2. Detect active section on scroll (optimized scrollspy)
    function updateActiveSection() {
        let currentSectionId = null;
        const scrollPosition = window.scrollY + 150; // offset for better visibility

        // Iterate sections from bottom to top
        for (let i = sections.length - 1; i >= 0; i--) {
            const section = sections[i];
            const sectionTop = section.offsetTop;

            if (scrollPosition >= sectionTop) {
                currentSectionId = section.id;
                break;
            }
        }

        // If no section matched, activate the first one
        if (!currentSectionId && sections.length > 0) {
            currentSectionId = sections[0].id;
        }

        // Update CSS classes for active navigation link
        navLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            const linkSectionId = linkHref.substring(1); // remove leading #

            link.classList.remove(
                'text-blue-600',
                'bg-blue-600/5',
                'border-blue-600/10',
                'dark:text-blue-400'
            );
            link.classList.add('text-gray-500');

            if (linkSectionId === currentSectionId) {
                link.classList.add(
                    'text-blue-600',
                    'bg-blue-600/5',
                    'border-blue-600/10'
                );
                link.classList.remove('text-gray-500');
            }
        });
    }

    // Initial execution and event listeners setup
    updateActiveSection();

    // Use throttling to improve scroll performance
    let scrollTimeout;
    window.addEventListener('scroll', () => {
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        scrollTimeout = setTimeout(updateActiveSection, 100);
    });

    // Also update on window resize
    window.addEventListener('resize', updateActiveSection);
}



/* =========================================================
   DOM CONTENT LOADED INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    // Initialize Timer on Load
    if (document.getElementById("hours") || document.querySelector(".incredible-timer-container")) {
        startIncredibleTimer();
    }

    // Initialize 8-hour timer
    if (document.getElementById('special-timer')) {
        startTimer(8, 'special-timer');
    }

    // Initialize amazing deals timer
    if (document.getElementById('special-timer-unique')) {
        startAmazingTimer(8, 'special-timer-unique');
    }

    // OTP Field navigation and input handling
    const otpFields = document.querySelectorAll('.otp-field');
    otpFields.forEach((field, index) => {
        field.addEventListener('input', (e) => {
            if (e.target.value && index < otpFields.length - 1) otpFields[index + 1].focus();
        });
        field.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !field.value && index > 0) otpFields[index - 1].focus();
        });
    });

    // Login Modal Event Listeners
    const loginBtn = document.getElementById('login-btn');
    const closeLogin = document.querySelector('.close-login');
    const loginModal = document.getElementById('login-modal');

    if (loginBtn) loginBtn.addEventListener('click', openLoginModal);
    if (closeLogin) closeLogin.addEventListener('click', closeLoginModal);
    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) closeLoginModal();
        });
    }

    // Initialize all core modules
    initQuickViewModal();
    initCartSystem();
    initMegaMenu();
    initMobileMenu();
    initEnhancedMobileMenu();
    initProductTabs();
    initProductVariables();
    initAddToCart();
    initColorSelector();
    initFaqAccordion();
    initDarkMode();
    initShopFiltering();
    initSearchSystem();
    initMobileSearchModal();
    initSellerModal();
    initProsConsManager();
    initChart();
    initTermsNavigation();

    // Initialize e-commerce modules
    initCartPageCounter();
    initCheckoutAddress();
    initShippingCost();
    initWalletAmountChips();
    initBankCardInput();
    initTicketChat();
    initUserComments();

    // Initialize category filters if needed
    if (document.querySelector('.js-collapse-header') ||
        document.querySelector('.js-price-range-container') ||
        document.querySelector('.js-brand-search')) {
        categoryFiltersInstance = new CategoryFilters();
    }

    // Initial UI updates
    updateCartUI();
});

// Make global functions available
window.copyLink = copyLink;
window.switchTab = switchTab;
window.toggleModal = toggleModal;
window.filterProducts = filterProducts;
window.addProduct = addProduct;
window.removeProduct = removeProduct;
window.updateSlots = updateSlots;
window.goToComparePage = goToComparePage;
window.toggleFilters = toggleFilters;
window.toggleSubmenu = toggleSubmenu;
window.checkPasswordStrength = checkPasswordStrength;
window.copyToClipboard = copyToClipboard;