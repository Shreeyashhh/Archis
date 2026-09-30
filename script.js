/* ==========================================================================
<<<<<<< HEAD
   PCMC Washing Centre - Interactive JavaScript
   Location: Ravet, PCMC, Pune, Maharashtra
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Toggle
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  const navOverlay = document.getElementById('nav-overlay');
  const navbar = document.getElementById('navbar');

  const toggleMobileMenu = (forceClose = false) => {
    if (!navMenu || !hamburger) return;
=======
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
>>>>>>> d923d19286602ff75897bf1613635633e874cc58
    const isActive = forceClose ? false : !navMenu.classList.contains('active');
    
    if (isActive) {
      navMenu.classList.add('active');
      hamburger.classList.add('active');
<<<<<<< HEAD
      if (navOverlay) navOverlay.classList.add('active');
=======
      navOverlay.classList.add('active');
>>>>>>> d923d19286602ff75897bf1613635633e874cc58
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    } else {
      navMenu.classList.remove('active');
      hamburger.classList.remove('active');
<<<<<<< HEAD
      if (navOverlay) navOverlay.classList.remove('active');
=======
      navOverlay.classList.remove('active');
>>>>>>> d923d19286602ff75897bf1613635633e874cc58
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

<<<<<<< HEAD
  // Handle sticky navbar scroll background effect
  const handleScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // Reveal Animations on Scroll
=======
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

>>>>>>> d923d19286602ff75897bf1613635633e874cc58
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('active');
        observer.unobserve(entry.target);
      }
    });
<<<<<<< HEAD
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  // Initialize Pickup & Drop Form if on pickup-drop.html
  const bookingForm = document.getElementById('pickup-drop-form');
  if (bookingForm) {
    initBookingForm();
  }
});

/* ------------------------------------------------------------------------
   Pickup & Drop Form Logic
   ------------------------------------------------------------------------ */
function initBookingForm() {
  const categorySelect = document.getElementById('vehicleCategory');
  const typeSelect = document.getElementById('vehicleType');
  const serviceSelect = document.getElementById('serviceSelect');
  const priceInput = document.getElementById('servicePrice');

  const sameWaCheckbox = document.getElementById('sameAsMobile');
  const sameAddressCheckbox = document.getElementById('sameAsPickup');

  const mobileInput = document.getElementById('customerMobile');
  const waInput = document.getElementById('customerWa');
  const pickupAddressInput = document.getElementById('pickupAddress');
  const dropAddressInput = document.getElementById('dropAddress');

  const summaryCategory = document.getElementById('summaryCategory');
  const summaryType = document.getElementById('summaryType');
  const summaryService = document.getElementById('summaryService');
  const summaryPrice = document.getElementById('summaryPrice');

  if (!categorySelect || !typeSelect || !serviceSelect) return;

  // Sync checkboxes
  if (sameWaCheckbox) {
    sameWaCheckbox.addEventListener('change', () => {
      if (sameWaCheckbox.checked) {
        waInput.value = mobileInput.value;
      }
    });
    mobileInput.addEventListener('input', () => {
      if (sameWaCheckbox.checked) {
        waInput.value = mobileInput.value;
      }
    });
  }

  if (sameAddressCheckbox) {
    sameAddressCheckbox.addEventListener('change', () => {
      if (sameAddressCheckbox.checked) {
        dropAddressInput.value = pickupAddressInput.value;
      }
    });
    pickupAddressInput.addEventListener('input', () => {
      if (sameAddressCheckbox.checked) {
        dropAddressInput.value = pickupAddressInput.value;
      }
    });
  }

  // Populate Vehicle Types based on selected Category
  const updateVehicleTypes = (selectedTypeId = null) => {
    const categoryKey = categorySelect.value;
    typeSelect.innerHTML = '<option value="">-- Select Vehicle Type --</option>';
    serviceSelect.innerHTML = '<option value="">-- Select Service --</option>';
    priceInput.value = '';
    updateSummary();

    if (!categoryKey || !PRICING_DATA[categoryKey]) return;

    const categoryData = PRICING_DATA[categoryKey];
    categoryData.types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.name;
      opt.textContent = t.name;
      if (selectedTypeId && (t.id === selectedTypeId || t.name === selectedTypeId)) {
        opt.selected = true;
      }
      typeSelect.appendChild(opt);
    });

    if (typeSelect.options.length === 2) {
      typeSelect.selectedIndex = 1;
    }

    updateServices();
  };

  // Populate Services based on selected Category & Type
  const updateServices = (selectedServiceName = null) => {
    const categoryKey = categorySelect.value;
    const typeName = typeSelect.value;

    serviceSelect.innerHTML = '<option value="">-- Select Service --</option>';
    priceInput.value = '';
    updateSummary();

    if (!categoryKey || !typeName || !PRICING_DATA[categoryKey]) return;

    const categoryData = PRICING_DATA[categoryKey];
    const typeObj = categoryData.types.find(t => t.name === typeName);

    if (!typeObj) return;

    typeObj.services.forEach(s => {
      if (s.price === null) return; // Skip unavailable services (e.g. Chain lube for Scooty)

      const opt = document.createElement('option');
      opt.value = s.name;
      opt.dataset.price = s.price;
      opt.textContent = `${s.name} - ₹${s.price}`;
      if (selectedServiceName && s.name.toLowerCase() === selectedServiceName.toLowerCase()) {
        opt.selected = true;
      }
      serviceSelect.appendChild(opt);
    });

    if (selectedServiceName) {
      updatePrice();
    }
  };

  const updatePrice = () => {
    const selectedOpt = serviceSelect.options[serviceSelect.selectedIndex];
    if (selectedOpt && selectedOpt.dataset.price) {
      priceInput.value = selectedOpt.dataset.price;
    } else {
      priceInput.value = '';
    }
    updateSummary();
  };

  const updateSummary = () => {
    const catText = categorySelect.options[categorySelect.selectedIndex]?.text || '-';
    const typeText = typeSelect.value || '-';
    const serviceOpt = serviceSelect.options[serviceSelect.selectedIndex];
    const serviceText = serviceOpt ? serviceOpt.value || '-' : '-';
    const priceVal = priceInput.value ? `₹${priceInput.value}` : '₹0';

    if (summaryCategory) summaryCategory.textContent = categorySelect.value ? PRICING_DATA[categorySelect.value]?.categoryName || catText : '-';
    if (summaryType) summaryType.textContent = typeText;
    if (summaryService) summaryService.textContent = serviceText !== '-' ? serviceText : '-';
    if (summaryPrice) summaryPrice.textContent = priceVal;
  };

  categorySelect.addEventListener('change', () => updateVehicleTypes());
  typeSelect.addEventListener('change', () => updateServices());
  serviceSelect.addEventListener('change', () => updatePrice());

  // Check URL query parameters for pre-filling form
  const urlParams = new URLSearchParams(window.location.search);
  const paramCat = urlParams.get('category');
  const paramType = urlParams.get('type');
  const paramService = urlParams.get('service');

  if (paramCat && PRICING_DATA[paramCat]) {
    categorySelect.value = paramCat;
    updateVehicleTypes(paramType);
    if (paramService) {
      updateServices(paramService);
    }
  }

  // Set minimum date for pickup date to today
  const dateInput = document.getElementById('pickupDate');
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
  }

  // Form submission handler
  const bookingForm = document.getElementById('pickup-drop-form');
  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    if (!validateBookingForm()) {
      return;
    }

    const fullName = document.getElementById('customerName').value.trim();
    const mobile = document.getElementById('customerMobile').value.trim();
    const whatsapp = sameWaCheckbox && sameWaCheckbox.checked ? mobile : (document.getElementById('customerWa').value.trim() || mobile);

    const categoryKey = categorySelect.value;
    const categoryName = PRICING_DATA[categoryKey]?.categoryName || categoryKey;
    const vehicleType = typeSelect.value;
    const vehicleModel = document.getElementById('vehicleModel').value.trim() || 'Not specified';
    const regNo = document.getElementById('vehicleReg').value.trim() || 'Not specified';

    const selectedService = serviceSelect.value;
    const price = priceInput.value;

    const pickupAddress = pickupAddressInput.value.trim();
    const landmark = document.getElementById('pickupLandmark').value.trim();
    const mapsLink = document.getElementById('pickupMapsLink').value.trim() || 'Not provided';
    const pickupDate = document.getElementById('pickupDate').value;
    const pickupTime = document.getElementById('pickupTime').value;

    const dropAddress = sameAddressCheckbox && sameAddressCheckbox.checked ? pickupAddress : (dropAddressInput.value.trim() || pickupAddress);
    const instructions = document.getElementById('additionalInstructions').value.trim() || 'None';

    // Construct standardized structured WhatsApp message
    let message = `Hello PCMC Washing Centre! I would like to book a vehicle wash with pickup and drop.\n\n`;
    message += `CUSTOMER DETAILS\n`;
    message += `Name: ${fullName}\n`;
    message += `Mobile: ${mobile}\n`;
    message += `WhatsApp: ${whatsapp}\n\n`;

    message += `VEHICLE DETAILS\n`;
    message += `Category: ${categoryName}\n`;
    message += `Type: ${vehicleType}\n`;
    message += `Model: ${vehicleModel}\n`;
    message += `Registration: ${regNo}\n\n`;

    message += `SERVICE DETAILS\n`;
    message += `Selected Service: ${selectedService}\n`;
    message += `Listed Price: ₹${price}\n\n`;

    message += `PICKUP DETAILS\n`;
    message += `Pickup Address: ${pickupAddress}\n`;
    message += `Area / Landmark: ${landmark}\n`;
    message += `Maps Link: ${mapsLink}\n`;
    message += `Preferred Date: ${pickupDate}\n`;
    message += `Preferred Time: ${pickupTime}\n\n`;

    message += `DROP-OFF DETAILS\n`;
    message += `Drop-off Address: ${dropAddress}\n`;
    message += `Additional Instructions: ${instructions}\n\n`;

    message += `Please confirm availability, pickup/drop arrangements, and the final payable amount. Thank you!`;

    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${WA_PHONE_NUMBER}?text=${encodedMessage}`;

    window.open(waUrl, '_blank', 'noopener,noreferrer');
  });
}

function validateBookingForm() {
  let isValid = true;

  const requiredFields = [
    { id: 'customerName', name: 'Full Name' },
    { id: 'customerMobile', name: 'Mobile Number', pattern: /^[6-9]\d{9}$/, patternMsg: 'Enter valid 10-digit Indian mobile number' },
    { id: 'pickupAddress', name: 'Pickup Address' },
    { id: 'pickupLandmark', name: 'Area / Landmark' },
    { id: 'pickupDate', name: 'Pickup Date' },
    { id: 'pickupTime', name: 'Pickup Time' },
    { id: 'vehicleCategory', name: 'Vehicle Category' },
    { id: 'vehicleType', name: 'Vehicle Type' },
    { id: 'serviceSelect', name: 'Service' }
  ];

  const sameAddressCheckbox = document.getElementById('sameAsPickup');
  if (!sameAddressCheckbox || !sameAddressCheckbox.checked) {
    requiredFields.push({ id: 'dropAddress', name: 'Drop-off Address' });
  }

  requiredFields.forEach(field => {
    const el = document.getElementById(field.id);
    if (!el) return;

    const formGroup = el.closest('.form-group');
    const errorMsg = formGroup ? formGroup.querySelector('.form-error-msg') : null;

    const val = el.value.trim();
    if (!val) {
      isValid = false;
      if (formGroup) formGroup.classList.add('has-error');
      if (errorMsg) errorMsg.textContent = `${field.name} is required.`;
    } else if (field.pattern && !field.pattern.test(val)) {
      isValid = false;
      if (formGroup) formGroup.classList.add('has-error');
      if (errorMsg) errorMsg.textContent = field.patternMsg;
    } else {
      if (formGroup) formGroup.classList.remove('has-error');
    }
  });

  if (!isValid) {
    const firstError = document.querySelector('.has-error');
    if (firstError) {
      firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  return isValid;
}
=======
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
>>>>>>> d923d19286602ff75897bf1613635633e874cc58
