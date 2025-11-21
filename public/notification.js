// ============================================
// NOTIFICATION.JS - FIXED VERSION
// ============================================

const NotificationManager = {
  hasUnreadAlerts: false,
  stylesInjected: false,
  
  init: function() {
    this.injectStyles();
    this.createBellIcon();
    this.requestPushPermission();
    this.listenToSensorAlerts();
  },
  
  // Inject CSS only once
  injectStyles: function() {
    if (this.stylesInjected) return;
    
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      .notification-bell {
        position: relative !important;
        font-size: 1.3rem !important;
      }

      .notification-bell.alert-active {
        animation: bellRing 0.5s ease infinite;
      }

      @keyframes bellRing {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(-15deg); }
        75% { transform: rotate(15deg); }
      }

      .notification-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #e63946;
        color: white;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        font-size: 0.7rem;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
      }

      .in-app-alert {
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        border: 3px solid #e63946;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(230, 57, 70, 0.4);
        z-index: 10000;
        min-width: 320px;
        max-width: 400px;
        animation: slideInRight 0.5s ease;
      }

      @keyframes slideInRight {
        from { transform: translateX(500px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      .alert-header {
        background: #e63946;
        color: white;
        padding: 15px;
        border-radius: 12px 12px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .alert-header h3 {
        margin: 0;
        font-size: 1rem;
      }

      .alert-header button {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: 0.3s;
      }

      .alert-header button:hover {
        background: rgba(255,255,255,0.2);
      }

      .alert-body {
        padding: 20px;
      }

      .alert-body p {
        margin: 8px 0;
        font-size: 0.9rem;
      }

      .alert-actions {
        padding: 0 20px 20px;
      }

      .btn-alert {
        width: 100%;
        background: linear-gradient(135deg, #e63946, #c92a2a);
        color: white;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: 0.3s;
      }

      .btn-alert:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(230, 57, 70, 0.3);
      }

      .notification-panel {
        position: fixed;
        top: 70px;
        right: 20px;
        background: white;
        border: 2px solid #eee;
        border-radius: 15px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.15);
        z-index: 9999;
        width: 350px;
        max-height: 500px;
        animation: slideDown 0.3s ease;
      }

      @keyframes slideDown {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }

      .notification-panel-header {
        background: #f8f8f8;
        padding: 15px;
        border-radius: 13px 13px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid #eee;
      }

      .notification-panel-header h3 {
        margin: 0;
        font-size: 1.1rem;
        color: #111;
      }

      .notification-panel-header button {
        background: #e63946;
        color: white;
        border: none;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 1.3rem;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: 0.3s;
      }

      .notification-panel-header button:hover {
        background: #c92a2a;
        transform: rotate(90deg);
      }

      .notification-panel-body {
        padding: 10px;
        max-height: 400px;
        overflow-y: auto;
      }
    `;
    
    document.head.appendChild(style);
    this.stylesInjected = true;
  },
  
  createBellIcon: function() {
    const navbar = document.querySelector('.navbar ul');
    if (!navbar) return;
    
    // Check if bell already exists
    if (document.getElementById('notificationBell')) return;
    
    const bellItem = document.createElement('li');
    bellItem.innerHTML = `
      <a href="#" id="notificationBell" class="notification-bell">
        🔔
        <span class="notification-badge" style="display: none;">!</span>
      </a>
    `;
    navbar.appendChild(bellItem);
    
    document.getElementById('notificationBell').addEventListener('click', (e) => {
      e.preventDefault();
      this.showNotificationPanel();
    });
  },
  
  requestPushPermission: function() {
    if (!('Notification' in window)) {
      console.log('Browser tidak mendukung notifikasi');
      return;
    }
    
    if (Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted' && window.SipadamUtils) {
            window.SipadamUtils.showToast('✅ Notifikasi darurat diaktifkan', 'success');
          }
        });
      }, 3000);
    }
  },
  
  // FIXED: Less frequent alerts (30 seconds, 5% chance)
  listenToSensorAlerts: function() {
    setInterval(() => {
      const randomChance = Math.random();
      
      // Only 5% chance every 30 seconds = ~1 alert per 10 minutes
      if (randomChance < 0.05) {
        this.triggerFireAlert({
          location: 'Sensor #1 - Ruang Tamu',
          temperature: 85,
          smokeLevel: 'HIGH',
          timestamp: new Date()
        });
      }
    }, 30000); // Check every 30 seconds
  },
  
  triggerFireAlert: function(data) {
    this.hasUnreadAlerts = true;
    this.updateBellIcon();
    this.showInAppAlert(data);
    this.sendPushNotification(data);
    this.playAlertSound();
  },
  
  updateBellIcon: function() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      badge.style.display = this.hasUnreadAlerts ? 'block' : 'none';
    }
    
    const bell = document.getElementById('notificationBell');
    if (bell) {
      if (this.hasUnreadAlerts) {
        bell.classList.add('alert-active');
      } else {
        bell.classList.remove('alert-active');
      }
    }
  },
  
  showInAppAlert: function(data) {
    const alertDiv = document.createElement('div');
    alertDiv.className = 'in-app-alert';
    alertDiv.innerHTML = `
      <div class="alert-header">
        <h3>🚨 PERINGATAN KEBAKARAN!</h3>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="alert-body">
        <p><strong>Lokasi:</strong> ${data.location}</p>
        <p><strong>Suhu:</strong> ${data.temperature}°C</p>
        <p><strong>Level Asap:</strong> ${data.smokeLevel}</p>
        <p><strong>Waktu:</strong> ${data.timestamp.toLocaleTimeString('id-ID')}</p>
      </div>
      <div class="alert-actions">
        <button onclick="window.location.href='laporan.html'" class="btn-alert">Laporkan Sekarang</button>
      </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
      if (alertDiv.parentElement) {
        alertDiv.remove();
      }
    }, 30000);
  },
  
  sendPushNotification: function(data) {
    if (Notification.permission === 'granted') {
      const notification = new Notification('🚨 PERINGATAN KEBAKARAN SIPADAM', {
        body: `${data.location}\nSuhu: ${data.temperature}°C\nLevel Asap: ${data.smokeLevel}`,
        icon: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        badge: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        tag: 'fire-alert',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      });
      
      notification.onclick = function() {
        window.focus();
        window.location.href = 'laporan.html';
      };
    }
  },
  
  playAlertSound: function() {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZRQ0PVqzn77BdGAg+ltrzxnUrBSl+zPLaizsIGGS36+mdTBAMT6Lh8bllHAU2kdfz0IEqBSV7yvDekUAKE16y6+uqVxUJRp/g8r9uIQU0h9P00YQ0Bh5uxO/mnEgPD1as5++yXxkHPZXb88p6LAUpfczz3Ig7CBhktOvqnU4RA0+i4fG6Zx4FNpHY89GDKgQkd8rx35JAChNesevrq1kVCUSd3/K/cCMGM4nU9NGFNgYebsPv6Z5KEA9Wq+fvtGEaBzuT2vPLfC0FKXvM8t6KOwgYY7Hr6Z5QEgNOoODwu2kfBTWQ1vLSgywFI3bH79+TQwoTXrDo6qxbFgs/m9zzwXMkBzOI0/PRhjgIHmzB7+mgSxASVqrm7rRjHAc6ktj0y34uBSd6y/PfizwIG2Kw6umfUhMETp7f8LxqIAUzjdTy0IQtBSJ0xu7gk0MLElyvouqtWhYKPJjZ8sN0JQczh9Hy0Yc4Bx1rwO7on04RE1an5O+1ZB0HOI/W8sx+LgUme8rx4Iw+CBtgsOjpoFMUBU2d3u+8aiEEMYvT8dCHLgUhcsTu4ZZECRVZK=');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Audio play error:', e));
    } catch (e) {
      console.log('Audio error:', e);
    }
  },
  
  showNotificationPanel: function() {
    this.hasUnreadAlerts = false;
    this.updateBellIcon();
    
    const panel = document.createElement('div');
    panel.className = 'notification-panel';
    panel.innerHTML = `
      <div class="notification-panel-header">
        <h3>🔔 Notifikasi</h3>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
      <div class="notification-panel-body">
        <p style="text-align: center; color: #666; padding: 20px;">
          Tidak ada notifikasi baru
        </p>
      </div>
    `;
    
    document.body.appendChild(panel);
    
    setTimeout(() => {
      const closePanel = (e) => {
        if (!panel.contains(e.target) && e.target.id !== 'notificationBell') {
          panel.remove();
          document.removeEventListener('click', closePanel);
        }
      };
      document.addEventListener('click', closePanel);
    }, 100);
  }
};

// Initialize when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => NotificationManager.init());
} else {
  NotificationManager.init();
}

window.NotificationManager = NotificationManager;