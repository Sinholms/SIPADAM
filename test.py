from ultralytics import YOLO
import cv2
import time
import requests
import socketio
import threading
import numpy as np
import base64
import sys
import platform

# ===========================
# CONFIGURATION
# ===========================
ESP32_IP = "192.168.51.96"
ESP32_URL = f"http://{ESP32_IP}/api/fire"
SERVER_URL = "http://localhost:3000"
MODEL_PATH = 'best.pt'
CONFIDENCE_THRESHOLD = 0.5
SEND_INTERVAL = 1.0
FRAME_SEND_INTERVAL = 0.1  # 10 FPS

# ===========================
# GLOBAL CONTROL VARIABLES
# ===========================
camera_enabled = False
system_running = True
camera_lock = threading.Lock()
cap = None

# ===========================
# SOCKET.IO CLIENT SETUP
# ===========================
sio = socketio.Client()

@sio.event
def connect():
    print("✅ Connected to Node.js server")
    sio.emit('camera-status', {'status': 'connected', 'enabled': camera_enabled})

@sio.event
def disconnect():
    print("❌ Disconnected from server")

@sio.on('camera-control')
def handle_camera_control(data):
    global camera_enabled
    action = data.get('action')
    
    with camera_lock:
        if action == 'start':
            camera_enabled = True
            print("🔹 Camera ENABLED by remote command")
            sio.emit('camera-status', {'status': 'active', 'enabled': True})
        elif action == 'stop':
            camera_enabled = False
            print("🛑 Camera DISABLED by remote command")
            send_fire_data(0, 0)
            sio.emit('camera-status', {'status': 'inactive', 'enabled': False})

@sio.on('get-camera-status')
def handle_status_request(data):
    sio.emit('camera-status', {'status': 'active' if camera_enabled else 'inactive', 'enabled': camera_enabled})

# ===========================
# WEBCAM INITIALIZATION
# ===========================
def find_working_camera():
    """Cari webcam yang tersedia"""
    print("🔍 Mencari webcam yang tersedia...")
    
    # Try different backends based on OS
    if platform.system() == 'Linux':
        backends = [cv2.CAP_V4L2, cv2.CAP_ANY]
    elif platform.system() == 'Windows':
        backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
    elif platform.system() == 'Darwin':  # macOS
        backends = [cv2.CAP_AVFOUNDATION, cv2.CAP_ANY]
    else:
        backends = [cv2.CAP_ANY]
    
    # Try camera indices 0-4
    for index in range(5):
        for backend in backends:
            try:
                print(f"   Mencoba camera {index} dengan backend {backend}...")
                test_cap = cv2.VideoCapture(index, backend)
                
                if test_cap.isOpened():
                    # Test read a frame
                    ret, frame = test_cap.read()
                    if ret and frame is not None:
                        width = test_cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                        height = test_cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                        print(f"   ✅ Webcam ditemukan di index {index} ({int(width)}x{int(height)})")
                        return test_cap, index, backend
                    else:
                        test_cap.release()
                else:
                    test_cap.release()
            except Exception as e:
                continue
    
    return None, None, None

def init_camera():
    """Initialize camera with retry"""
    global cap
    
    cap, cam_index, backend = find_working_camera()
    
    if cap is None:
        print("\n❌ TIDAK ADA WEBCAM YANG TERSEDIA!")
        print("\n🔧 Troubleshooting:")
        print("   1. Pastikan webcam terpasang dengan benar")
        print("   2. Tutup aplikasi lain yang menggunakan webcam (Zoom, Skype, dll)")
        print("   3. Cek permission webcam:")
        
        if platform.system() == 'Linux':
            print("      sudo usermod -a -G video $USER")
            print("      ls -l /dev/video*")
        elif platform.system() == 'Darwin':
            print("      System Preferences > Security & Privacy > Camera")
        elif platform.system() == 'Windows':
            print("      Settings > Privacy > Camera")
        
        print("   4. Restart komputer jika perlu")
        print("\n⚠️  Sistem akan berjalan tanpa kamera (sensor only mode)")
        return False
    
    # Optimize camera settings
    try:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        actual_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        actual_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        
        print(f"✅ Webcam initialized (index={cam_index}, backend={backend})")
        print(f"   Resolution: {int(actual_width)}x{int(actual_height)}")
        print(f"   FPS: {int(actual_fps)}")
        return True
        
    except Exception as e:
        print(f"⚠️  Error setting camera properties: {e}")
        return True  # Still continue if camera opened

# ===========================
# CONNECT TO SERVER
# ===========================
def connect_to_server():
    try:
        sio.connect(SERVER_URL)
        print(f"🔗 Connecting to server: {SERVER_URL}")
    except Exception as e:
        print(f"⚠️ Cannot connect to server: {e}")
        print("⚠️ Running in standalone mode")

# ===========================
# INITIALIZE
# ===========================
print("🔥 Fire Detection IoT System - HEADLESS MODE")
print(f"📡 ESP32 Target: {ESP32_URL}")
print(f"🌐 Server: {SERVER_URL}")
print("🎮 Camera controlled via web dashboard")
print("🚫 NO OpenCV windows will appear\n")

# Load YOLO model
try:
    model = YOLO(MODEL_PATH)
    print("✅ YOLOv8 model loaded")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    print("⚠️  Continuing without fire detection (sensor only)")
    model = None

# Initialize camera
camera_available = init_camera()

if not camera_available:
    print("\n⚠️  RUNNING IN SENSOR-ONLY MODE")
    print("   Fire detection via camera DISABLED")
    print("   Only sensor data will be processed\n")

# Connect to server
connect_to_server()

last_send_time = 0
last_frame_send_time = 0
prev_time = time.time()

# ===========================
# HELPER FUNCTIONS
# ===========================
def send_fire_data(fire_area, confidence=0):
    """Kirim data ke ESP32"""
    try:
        data = {
            'fire_area': int(fire_area),
            'confidence': round(confidence, 2)
        }
        response = requests.post(ESP32_URL, data=data, timeout=2)
        
        if response.status_code == 200:
            if fire_area > 0:
                print(f"📤 Sent to ESP32: Area={int(fire_area)}px, Conf={confidence:.2f}")
            return True
        else:
            return False
    except:
        return False

def get_fire_color(area):
    """Visual feedback"""
    if area > 15000:
        return (0, 0, 255), "LARGE"
    elif area > 5000:
        return (0, 165, 255), "MEDIUM"
    elif area > 1000:
        return (0, 255, 0), "SMALL"
    else:
        return (0, 255, 255), "TINY"

def send_frame_to_web(frame):
    """Kirim frame ke web via Socket.IO"""
    try:
        if sio.connected:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')
            sio.emit('video-frame', {'frame': jpg_as_text})
    except Exception as e:
        pass

# ===========================
# TEST CONNECTION
# ===========================
print("🔍 Testing ESP32 connection...")
if send_fire_data(0):
    print("✅ ESP32 connected!\n")
else:
    print("⚠️ Cannot connect to ESP32 (continuing anyway)\n")

# ===========================
# MAIN LOOP - HEADLESS MODE
# ===========================
print("🎬 System ready in HEADLESS mode!")
print("   Camera controlled via web dashboard")
print("   Press Ctrl+C to quit")
print("=" * 60)

frame_error_count = 0
MAX_FRAME_ERRORS = 10

try:
    while system_running:
        with camera_lock:
            current_camera_state = camera_enabled
        
        if current_camera_state and camera_available and cap is not None:
            # CAMERA ACTIVE - Process frames
            ret, frame = cap.read()
            
            if not ret or frame is None:
                frame_error_count += 1
                if frame_error_count >= MAX_FRAME_ERRORS:
                    print(f"❌ Too many frame errors ({frame_error_count}), reinitializing camera...")
                    cap.release()
                    time.sleep(1)
                    camera_available = init_camera()
                    frame_error_count = 0
                time.sleep(0.1)
                continue
            
            frame_error_count = 0  # Reset on successful read
            
            # Run inference if model available
            if model is not None:
                results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
                result = results[0]
            else:
                result = None
            
            # Calculate FPS
            curr_time = time.time()
            fps = 1 / (curr_time - prev_time + 0.001)
            prev_time = curr_time
            
            # Find largest fire
            largest_area = 0
            largest_conf = 0
            fire_detected = False
            
            if result is not None and len(result.boxes) > 0:
                for box in result.boxes:
                    class_id = int(box.cls[0])
                    confidence = float(box.conf[0])
                    class_name = result.names[class_id]
                    
                    if class_name.lower() == 'fire':
                        fire_detected = True
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        area = (x2 - x1) * (y2 - y1)
                        
                        if area > largest_area:
                            largest_area = area
                            largest_conf = confidence
                        
                        # Visual overlay
                        color, label = get_fire_color(area)
                        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)
                        
                        text = f"{label} {confidence:.2f} ({int(area)}px)"
                        label_size, _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                        cv2.rectangle(frame, (x1, y1-label_size[1]-10), 
                                    (x1+label_size[0]+10, y1), color, -1)
                        cv2.putText(frame, text, (x1+5, y1-5), 
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255,255,255), 2)
            
            # Send to ESP32
            if curr_time - last_send_time >= SEND_INTERVAL:
                send_fire_data(largest_area, largest_conf)
                last_send_time = curr_time
                
                # Update server about detection
                if sio.connected:
                    sio.emit('fire-detection', {
                        'area': int(largest_area),
                        'confidence': float(largest_conf),
                        'detected': fire_detected
                    })
            
            # Display status on frame
            if fire_detected:
                status_color, status_label = get_fire_color(largest_area)
                status_text = f"FIRE DETECTED: {status_label} ({int(largest_area)}px)"
            else:
                status_text = "NO FIRE DETECTED"
                status_color = (50, 200, 200)
            
            cv2.rectangle(frame, (10, 10), (500, 60), status_color, -1)
            cv2.putText(frame, status_text, (20, 45), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            
            # Status: CAMERA ON
            cv2.rectangle(frame, (10, 70), (200, 100), (0, 255, 0), -1)
            cv2.putText(frame, "LIVE", (70, 92), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 0), 2)
            
            # Info overlay
            cv2.putText(frame, f"FPS: {fps:.1f}", (210, 92), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            
            # Send frame to web
            if curr_time - last_frame_send_time >= FRAME_SEND_INTERVAL:
                send_frame_to_web(frame)
                last_frame_send_time = curr_time
            
        else:
            # CAMERA INACTIVE or UNAVAILABLE - Just wait
            time.sleep(0.1)

except KeyboardInterrupt:
    print("\n🛑 Stopping system...")
except Exception as e:
    print(f"\n❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
finally:
    # ===========================
    # CLEANUP
    # ===========================
    send_fire_data(0, 0)
    
    if cap is not None:
        cap.release()
    
    if sio.connected:
        sio.emit('camera-status', {'status': 'disconnected', 'enabled': False})
        sio.disconnect()
    
    print("✅ System stopped")
    print("=" * 60)