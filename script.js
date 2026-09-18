/* ==========================================================================
   PCMC Washing Center - Interactive Client JavaScript
   Location: Ravet, Pune, Maharashtra
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Global Constants
  const WHATSAPP_NUMBER = '919594054099';
  const DEFAULT_MESSAGE = 'Hello PCMC Washing Center, I would like to book a washing slot. Please share the available time slots.';

  // DOM Elements
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  const navOverlay = document.getElementById('nav-overlay');
  const navLinks = document.querySelectorAll('.nav-link');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const serviceCards = document.querySelectorAll('.service-card');
  const exploreBtn = document.getElementById('explore-services-btn');
  const hiddenCountSpan = document.getElementById('hidden-count');

  let isServicesExpanded = false;

  /* ------------------------------------------------------------------------
     1. Sticky Navbar Scroll Effect
     ------------------------------------------------------------------------ */
  const handleScroll = () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  /* ------------------------------------------------------------------------
     2. Mobile Menu Navigation Drawer Toggle
     ------------------------------------------------------------------------ */
  const toggleMobileMenu = (forceClose = false) => {
    const isActive = forceClose ? false : !navMenu.classList.contains('active');
    
    if (isActive) {
      navMenu.classList.add('active');
      hamburger.classList.add('active');
      navOverlay.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    } else {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
      navOverlay.classList.remove('active');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }
  };

  if (hamburger) {
    hamburger.addEventListener('click', () => toggleMobileMenu());
  }

  if (navOverlay) {
    navOverlay.addEventListener('click', () => toggleMobileMenu(true));
  }

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      toggleMobileMenu(true);
    });
  });

  /* ------------------------------------------------------------------------
     3. Explore More Services Toggle Handler
     ------------------------------------------------------------------------ */
  if (exploreBtn) {
    exploreBtn.addEventListener('click', () => {
      isServicesExpanded = !isServicesExpanded;
      const moreCards = document.querySelectorAll('.service-card-more');

      if (isServicesExpanded) {
        moreCards.forEach(card => card.classList.add('expanded'));
        exploreBtn.innerHTML = `<i data-lucide="chevron-up"></i> Show Less Services`;
      } else {
        moreCards.forEach(card => card.classList.remove('expanded'));
        const totalMoreCount = moreCards.length;
        exploreBtn.innerHTML = `<i data-lucide="grid"></i> Explore More Services (${totalMoreCount})`;
        
        // Scroll back to services header smoothly if scrolled far
        const servicesSection = document.getElementById('services');
        if (servicesSection) {
          servicesSection.scrollIntoView({ behavior: 'smooth' });
        }
      }
      lucide.createIcons();
    });
  }

  /* ------------------------------------------------------------------------
     4. Services Category Filter Tabs
     ------------------------------------------------------------------------ */
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-tab');

      // Update active tab button
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Auto expand cards if specific category tab selected (bike or car)
      if (category !== 'all' && !isServicesExpanded) {
        isServicesExpanded = true;
        const moreCards = document.querySelectorAll('.service-card-more');
        moreCards.forEach(card => card.classList.add('expanded'));
        if (exploreBtn) {
          exploreBtn.innerHTML = `<i data-lucide="chevron-up"></i> Show Less Services`;
          lucide.createIcons();
        }
      }

      // Filter Cards
      serviceCards.forEach(card => {
        const cardCategory = card.getAttribute('data-category');
        const isMoreCard = card.classList.contains('service-card-more');

        if (category === 'all') {
          if (!isMoreCard || isServicesExpanded) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        } else {
          if (cardCategory === category) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        }
      });
    });
  });

  /* ------------------------------------------------------------------------
     5. IntersectionObserver for Scroll Reveal Animations
     ------------------------------------------------------------------------ */
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -50px 0px',
    threshold: 0.15
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ------------------------------------------------------------------------
     6. WhatsApp Booking Handler
     ------------------------------------------------------------------------ */
  window.openWhatsAppBooking = (serviceName = null) => {
    let textMessage = DEFAULT_MESSAGE;
    if (serviceName) {
      textMessage = `Hello PCMC Washing Center, I would like to book a ${serviceName} slot. Please share the available time slots.`;
    }
    
    const encodedText = encodeURIComponent(textMessage);
    const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };
});
