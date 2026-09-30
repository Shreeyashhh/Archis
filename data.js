/* ==========================================================================
   PCMC Washing Centre - Centralized Service & Pricing Catalog
   Location: Ravet, PCMC, Pune, Maharashtra
   WhatsApp: +91 95940 54099
   ========================================================================== */

const PRICING_DATA = {
  car: {
    categoryName: 'Car',
    icon: 'car',
    types: [
      {
        id: 'hatchback',
        name: 'Hatchback',
        services: [
          { name: 'Water Wash (Only Body)', price: 130 },
          { name: 'Body Wash (Foam Wash)', price: 230 },
          { name: 'Full Wash', price: 300, desc: 'Underbody wash + full body wash + interior vacuum + mat cleaning.' },
          { name: 'Diesel Wash (Tyres)', price: 400 },
          { name: 'Diesel Wash', price: 500 }
        ]
      },
      {
        id: 'sedan',
        name: 'Sedan / Compact SUV',
        services: [
          { name: 'Water Wash (Only Body)', price: 150 },
          { name: 'Body Wash (Foam Wash)', price: 250 },
          { name: 'Full Wash', price: 350, desc: 'Underbody wash + full body wash + interior vacuum + mat cleaning.' },
          { name: 'Diesel Wash (Tyres)', price: 450 },
          { name: 'Diesel Wash', price: 600 }
        ]
      },
      {
        id: 'suv',
        name: 'MPV / SUV (7 Seater)',
        services: [
          { name: 'Water Wash (Only Body)', price: 150 },
          { name: 'Body Wash (Foam Wash)', price: 250 },
          { name: 'Full Wash', price: 400, desc: 'Underbody wash + full body wash + interior vacuum + mat cleaning.' },
          { name: 'Diesel Wash (Tyres)', price: 550 },
          { name: 'Diesel Wash', price: 700 }
        ]
      }
    ]
  },
  bike: {
    categoryName: 'Bike',
    icon: 'bike',
    types: [
      {
        id: 'scooty',
        name: 'Scooty / Commuter',
        services: [
          { name: 'Water Wash', price: 60 },
          { name: 'Foam Wash', price: 80 },
          { name: 'Chain Lube + Chain Clean (Only)', price: null, notAvailableText: 'Not available' },
          { name: 'Diesel Wash', price: 150 }
        ]
      },
      {
        id: 'sports',
        name: 'Sports / Bullet',
        services: [
          { name: 'Water Wash', price: 70 },
          { name: 'Foam Wash', price: 100 },
          { name: 'Chain Lube + Chain Clean (Only)', price: 200 },
          { name: 'Diesel Wash', price: 150 }
        ]
      }
    ]
  },
  rickshaw: {
    categoryName: 'Rickshaw',
    icon: 'navigation-2',
    types: [
      {
        id: 'rickshaw',
        name: 'Rickshaw',
        services: [
          { name: 'Water Wash', price: 100 },
          { name: 'Body Wash (Foam Wash)', price: 150 },
          { name: 'Diesel Wash (Tyres)', price: 200 },
          { name: 'Diesel Wash', price: 300 }
        ]
      }
    ]
  },
  tractor: {
    categoryName: 'Tractor',
    icon: 'truck',
    types: [
      {
        id: 'tractor',
        name: 'Tractor',
        services: [
          { name: 'Water Wash — Tractor (Only Face)', price: 200 },
          { name: 'Body Wash (Foam Wash)', price: 300 }
        ]
      }
    ]
  }
};

// Global WhatsApp Constants
const WA_PHONE_NUMBER = '919594054099';
const MAPS_URL = 'https://maps.app.goo.gl/UFgvBUuA8TSH2HsUA';

// Utility helper to create WhatsApp booking URL directly for specific service
function getDirectWhatsAppUrl(category, typeName, serviceName, price) {
  let text = `Hello PCMC Washing Centre! I would like to enquire / book a washing slot.\n\n`;
  text += `Vehicle Category: ${category}\n`;
  if (typeName) text += `Vehicle Type: ${typeName}\n`;
  text += `Service: ${serviceName}\n`;
  if (price) text += `Listed Price: ₹${price}\n\n`;
  text += `Please let me know the available time slots. Thank you!`;
  
  return `https://wa.me/${WA_PHONE_NUMBER}?text=${encodeURIComponent(text)}`;
}

// Utility helper to navigate to pickup-drop booking page with pre-filled parameters
function navigateToBooking(category, typeName, serviceName, price) {
  const params = new URLSearchParams();
  if (category) params.set('category', category);
  if (typeName) params.set('type', typeName);
  if (serviceName) params.set('service', serviceName);
  if (price) params.set('price', price);
  
  window.location.href = `pickup-drop.html?${params.toString()}`;
}
