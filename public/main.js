// ============================================
// MAIN.JS - SIPADAM (FIXED VERSION)
// ============================================

// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// Navbar scroll effect
window.addEventListener('scroll', () => {
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
});

// Mobile Menu Toggle
const mobileToggle = document.querySelector('.mobile-toggle');
const navMenu = document.querySelector('.navbar nav');

if (mobileToggle && navMenu) {
  mobileToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
    
    const spans = mobileToggle.querySelectorAll('span');
    if (navMenu.classList.contains('active')) {
      spans[0].style.transform = 'rotate(45deg) translateY(8px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translateY(-8px)';
    } else {
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.navbar')) {
      navMenu.classList.remove('active');
      const spans = mobileToggle.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  });
}

// Active page indicator
const currentPage = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.navbar a').forEach(link => {
  if (link.getAttribute('href') === currentPage) {
    link.classList.add('active');
  }
});

// Form validation helpers
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validatePhone(phone) {
  const re = /^[0-9+\-\s()]+$/;
  return re.test(phone);
}

// Loading animation
function showLoading(button) {
  const originalText = button.textContent;
  button.textContent = '⏳ Memproses...';
  button.disabled = true;
  button.style.opacity = '0.7';
  
  return () => {
    button.textContent = originalText;
    button.disabled = false;
    button.style.opacity = '1';
  };
}

// Toast notification (IMPROVED)
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  const colors = {
    success: '#2e7d32',
    error: '#e63946',
    info: '#2962ff',
    warning: '#ff9800'
  };
  
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${colors[type] || colors.info};
    color: white;
    padding: 15px 30px;
    border-radius: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideUp 0.3s ease;
    font-weight: 500;
    max-width: 90%;
    text-align: center;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideDown 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(100px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  @keyframes slideDown {
    from { transform: translateX(-50%) translateY(0); opacity: 1; }
    to { transform: translateX(-50%) translateY(100px); opacity: 0; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-10px); }
    75% { transform: translateX(10px); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
document.head.appendChild(style);

// Real-time clock
function updateClock() {
  const clockElements = document.querySelectorAll('.live-clock');
  clockElements.forEach(el => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('id-ID');
  });
}
setInterval(updateClock, 1000);
updateClock();

// Lazy loading images
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  });

  document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
  });
}

// FIXED: In-Memory Storage (NO localStorage!)
const Storage = {
  data: {},
  
  set(key, value) {
    try {
      this.data[key] = JSON.stringify(value);
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  },
  
  get(key) {
    try {
      const item = this.data[key];
      return item ? JSON.parse(item) : null;
    } catch (e) {
      console.error('Storage error:', e);
      return null;
    }
  },
  
  remove(key) {
    try {
      delete this.data[key];
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  },
  
  clear() {
    try {
      this.data = {};
      return true;
    } catch (e) {
      console.error('Storage error:', e);
      return false;
    }
  }
};

// Check auth
function checkAuth() {
  const user = Storage.get('sipadam_user');
  const loginBtn = document.querySelector('a[href="login.html"]');
  
  if (user && loginBtn) {
    loginBtn.textContent = user;
    loginBtn.href = 'profil.html';
  }
}
checkAuth();

// Emergency call with toast (NO alert!)
document.querySelectorAll('.btn-call').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const card = btn.closest('.kontak-card');
    if (card) {
      const number = card.querySelector('h1').textContent;
      const serviceName = card.querySelector('h3').textContent;
      
      e.preventDefault();
      showToast(`🚨 Menghubungi ${serviceName} (${number})...`, 'info');
      
      setTimeout(() => {
        showToast('📞 Pastikan Anda menghubungi nomor darurat hanya dalam keadaan darurat!', 'warning');
        setTimeout(() => {
          window.location.href = `tel:${number}`;
        }, 2000);
      }, 1000);
    }
  });
});

// Animate on scroll
const animateOnScroll = () => {
  const elements = document.querySelectorAll('.kontak-card, .stat-card, .profil-box');
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  elements.forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', animateOnScroll);
} else {
  animateOnScroll();
}

// Online/offline detection
window.addEventListener('online', () => {
  showToast('✅ Koneksi internet tersambung', 'success');
});

window.addEventListener('offline', () => {
  showToast('⚠️ Tidak ada koneksi internet', 'error');
});

// Copy coordinates helper
function copyCoordinates(lat, lng) {
  const coords = `${lat}, ${lng}`;
  
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(coords).then(() => {
      showToast('📋 Koordinat disalin: ' + coords, 'success');
    }).catch(() => {
      fallbackCopy(coords);
    });
  } else {
    fallbackCopy(coords);
  }
}

function fallbackCopy(text) {
  const input = document.createElement('input');
  input.value = text;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  document.body.appendChild(input);
  input.select();
  
  try {
    document.execCommand('copy');
    showToast('📋 Koordinat disalin: ' + text, 'success');
  } catch (err) {
    showToast('❌ Gagal menyalin koordinat', 'error');
  }
  
  document.body.removeChild(input);
}

// Export utilities
window.SipadamUtils = {
  showToast,
  showLoading,
  validateEmail,
  validatePhone,
  copyCoordinates,
  Storage
};

console.log('🚒 SIPADAM System Initialized');
console.log('📍 Location:', window.location.href);
console.log('👤 User:', Storage.get('sipadam_user') || 'Guest');