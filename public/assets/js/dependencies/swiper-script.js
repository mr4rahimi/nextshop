/**
 * =========================================================
 * SWIPER INIT
 * =========================================================
 * All sliders are managed in this file.
 * The section is marked with a comment and the main settings can be changed.
 ========================================================= */

/**
 * =============================
 * 1. Main Hero Slider
 * =============================
 */
document.addEventListener('DOMContentLoaded', function () {
    const mainHeroSwiper = new Swiper('.mainHeroSwiper', {
        rtl: true,
        loop: true,
        speed: 800,
        effect: 'slide',
        autoplay: {
            delay: 5000,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
        },
        navigation: {
            nextEl: '.swiper-button-next-custom',
            prevEl: '.swiper-button-prev-custom',
        },
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
            renderBullet: function (index, className) {
                return `<span class="${className} !bg-white !w-3 !h-3 !opacity-50 hover:!opacity-100 transition-all"></span>`;
            },
        },
        touchEventsTarget: 'container',
        threshold: 5,
    });
});

/**
 * =============================
 * 2. Suggestion Slider
 * =============================
 */
document.addEventListener('DOMContentLoaded', function () {
    const suggestionSwiper = new Swiper('.suggestionSwiper', {
        rtl: true,
        slidesPerView: 1,
        spaceBetween: 20,
        loop: true,
        grabCursor: true,
        speed: 800,
        autoplay: {
            delay: 4000,
        },
        breakpoints: {
            0: { direction: 'horizontal', slidesPerView: 1 },
            1024: { direction: 'vertical', slidesPerView: 1, spaceBetween: 0 },
        },
    });
});

/**
 * =============================
 * 3. Modal Product + Thumbnails (Updated)
 * =============================
 */

// 1. Thumbnail Settings
var swiperThumbs = new Swiper(".thumbSwiper", {
    spaceBetween: 12,
    slidesPerView: 4,
    watchSlidesProgress: true,
    freeMode: true,
});

// 2. Main slider settings with custom buttons
var swiperMain = new Swiper(".mainGallerySwiper", {
    spaceBetween: 10,
    grabCursor: true,
    zoom: {
        maxRatio: 3,
        minRatio: 1,
    },
    // Connect to new buttons
    navigation: {
        nextEl: ".custom-next",
        prevEl: ".custom-prev",
        disabledClass: "opacity-20 cursor-not-allowed pointer-events-none" // Style when inactive
    },
    thumbs: {
        swiper: swiperThumbs,
    },
});

// 3. Active Thumbnail Style Management (Optimized)
swiperMain.on('slideChange', function () {
    const activeIndex = swiperMain.activeIndex;
    document.querySelectorAll('.thumbSwiper .swiper-slide').forEach((el, index) => {
        if(index === activeIndex) {
            el.classList.add('opacity-100');
            el.classList.remove('opacity-40');
        } else {
            el.classList.remove('opacity-100');
            el.classList.add('opacity-40');
        }
    });
});

// Initial implementation for the first slide
document.querySelector('.thumbSwiper .swiper-slide')?.classList.add('opacity-100');

/**
 * =============================
 * 4. Last Seen Slider
 * =============================
 */
document.addEventListener("DOMContentLoaded", () => {
    new Swiper(".recentSwiper", {
        slidesPerView: 1.2,
        spaceBetween: 16,
        navigation: { nextEl: ".recent-next", prevEl: ".recent-prev" },
        breakpoints: {
            640: { slidesPerView: 2.2 },
            1024: { slidesPerView: 3.2 },
            1280: { slidesPerView: 4 },
        },
    });
});

/**
 * =============================
 * 5. Product Slider
 * =============================
 */
document.addEventListener("DOMContentLoaded", () => {
    const productSwiper = new Swiper(".productSwiper", {
        slidesPerView: 1.3,
        spaceBetween: 20,
        speed: 600,
        navigation: { nextEl: ".prod-next", prevEl: ".prod-prev" },
        breakpoints: {
            640: { slidesPerView: 2.2 },
            1024: { slidesPerView: 3.5 },
            1280: { slidesPerView: 4.5 },
        },
    });
});

/**
 * =============================
 * 6. Amazing Slider
 * =============================
 */

document.addEventListener('DOMContentLoaded', function () {
    const incredibleSwiper = new Swiper('.incredibleSwiper', {
        rtl: true,
        spaceBetween: 24,

        slidesPerView: 1.2,
        centeredSlides: false,

        loop: false,
        speed: 800,

        breakpoints: {
            640: {
                slidesPerView: 2,
                spaceBetween: 20,
            },
            1024: {
                slidesPerView: 2.5,
                spaceBetween: 30,
            },
            1280: {
                slidesPerView: 3,
                spaceBetween: 32,
            }
        },

        grabCursor: true,

        pagination: {
            el: '.swiper-pagination',
            clickable: true,
            dynamicBullets: true,
        },

        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
    });
});



/**
 * =============================
 * 7. Amazing Slider TWO
 * =============================
 */

document.addEventListener('DOMContentLoaded', () => {
    // مقداردهی اسلایدر
    const amazingSwiper = new Swiper('.main-amazing-swiper', {
        slidesPerView: 1,
        spaceBetween: 30,
        rtl: true,
        //loop: true,
        grabCursor: true,
        navigation: {
            nextEl: '.swiper-nav-next',
            prevEl: '.swiper-nav-prev',
        },
        breakpoints: {
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
            1280: { slidesPerView: 4 },
        }
    });

});


/**
 * =============================
 * 8. MAGAZINE BLOG SLIDER
 * =============================
 */
document.addEventListener('DOMContentLoaded', function () {
    new Swiper(".magazineSwiper", {
        rtl: true,
        slidesPerView: 1,
        spaceBetween: 20,
        speed: 800,
        grabCursor: true,
        navigation: {
            nextEl: ".swiper-nav-next",
            prevEl: ".swiper-nav-prev",
        },
        breakpoints: {
            640: { slidesPerView: 2 },
            1024: { slidesPerView: 3 },
            1280: { slidesPerView: 4 },
        }
    });
});

/**
 * =============================
 * 9. PRODUCT DETAIL SLIDERS
 * =============================
 */

document.addEventListener('DOMContentLoaded', function () {
    var productThumbs = new Swiper(".productThumbsSwiper", {
        rtl: true,
        spaceBetween: 15,
        slidesPerView: 4,
        freeMode: true,
        watchSlidesProgress: true,
    });

    var productMain = new Swiper(".productMainSwiper", {
        rtl: true,
        spaceBetween: 10,
        zoom: {
            maxRatio: 3,
            minRatio: 1,
            toggle: true,
        },
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev",
        },
        thumbs: {
            swiper: productThumbs,
        },
    });

    productMain.on('slideChange', function () {
        const index = productMain.activeIndex;
        const thumbs = document.querySelectorAll('.productThumbsSwiper .swiper-slide');
        thumbs.forEach((slide, i) => {
            if (i === index) {
                slide.classList.add('!opacity-100', 'border-blue-600', 'shadow-lg');
            } else {
                slide.classList.remove('!opacity-100', 'border-blue-600', 'shadow-lg');
            }
        });
    });
});
window.Swiper = Swiper;