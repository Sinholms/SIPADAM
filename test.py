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
from queue import Queue
from collections import deque

# ===========================
# CONFIGURATION - OPTIMIZED FOR SPEED
# ===========================
ESP32_IP = "10.144.219.96"
ESP32_URL = f"http://{ESP32_IP}/api/fire"
SERVER_URL = "http://localhost:3000"
MODEL_PATH = 'best.pt'
CONFIDENCE_THRESHOLD = 0.5

# ⚡ FPS OPTIMIZATION SETTINGS
SEND_INTERVAL = 1.0
FRAME_SEND_INTERVAL = 0.05  # 20 FPS to web (adjust: 0.033 = 30fps, 0.016 = 60fps)
INFERENCE_SKIP = 4  # Process every 2nd frame (doubles FPS)
JPEG_QUALITY = 65  # Lower = faster encoding (70-85 recommended)
DRAW_BOXES = True  # Set False to skip drawing (huge speed boost)

# ===========================
# GLOBAL CONTROL VARIABLES
# ===========================
camera_enabled = False
system_running = True
camera_lock = threading.Lock()
cap = None

# ===========================
# DATA SENDING QUEUE
# ===========================
send_queue = Queue(maxsize=10)
frame_queue = Queue(maxsize=2)  # Small queue to prevent lag

# ===========================
# FPS COUNTER
# ===========================
fps_deque = deque(maxlen=30)  # Rolling average of 30 frames

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
# WEBCAM INITIALIZATION - OPTIMIZED
# ===========================
def find_working_camera():
    """Cari webcam yang tersedia"""
    print("🔍 Mencari webcam yang tersedia...")
    
    if platform.system() == 'Linux':
        backends = [cv2.CAP_V4L2, cv2.CAP_ANY]
    elif platform.system() == 'Windows':
        backends = [cv2.CAP_DSHOW, cv2.CAP_MSMF, cv2.CAP_ANY]
    elif platform.system() == 'Darwin':
        backends = [cv2.CAP_AVFOUNDATION, cv2.CAP_ANY]
    else:
        backends = [cv2.CAP_ANY]
    
    for index in range(5):
        for backend in backends:
            try:
                test_cap = cv2.VideoCapture(index, backend)
                
                if test_cap.isOpened():
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
    """Initialize camera with optimization"""
    global cap
    
    cap, cam_index, backend = find_working_camera()
    
    if cap is None:
        print("\n❌ TIDAK ADA WEBCAM YANG TERSEDIA!")
        return False
    
    try:
        # ⚡ OPTIMAL SETTINGS FOR SPEED
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)  # Lower = faster (try 480 for more speed)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 60)  # Request highest FPS
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # CRITICAL: Minimize latency
        
        # Try to disable auto-focus (reduces lag)
        try:
            cap.set(cv2.CAP_PROP_AUTOFOCUS, 0)
        except:
            pass
        
        actual_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
        actual_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
        actual_fps = cap.get(cv2.CAP_PROP_FPS)
        
        print(f"✅ Webcam initialized")
        print(f"   Resolution: {int(actual_width)}x{int(actual_height)}")
        print(f"   Target FPS: {int(actual_fps)}")
        print(f"   Inference skip: Every {INFERENCE_SKIP} frames")
        print(f"   JPEG quality: {JPEG_QUALITY}")
        return True
        
    except Exception as e:
        print(f"⚠️ Error setting camera properties: {e}")
        return True

# ===========================
# BACKGROUND SENDER THREADS
# ===========================
def send_worker():
    """Background thread untuk kirim data ke ESP32"""
    global system_running
    print("📡 ESP32 sender thread started")
    
    consecutive_errors = 0
    max_errors = 5
    
    while system_running:
        try:
            data = send_queue.get(timeout=1)
            
            try:
                response = requests.post(ESP32_URL, data=data, timeout=2)
                
                if response.status_code == 200:
                    consecutive_errors = 0
                    if data['fire_area'] > 0:
                        print(f"📤 ESP32: Area={data['fire_area']}px, Conf={data['confidence']:.2f}")
                else:
                    consecutive_errors += 1
                    if consecutive_errors <= max_errors:
                        print(f"⚠️ ESP32 error: HTTP {response.status_code}")
                    
            except requests.exceptions.Timeout:
                consecutive_errors += 1
                if consecutive_errors <= max_errors:
                    print("⏱️ ESP32 timeout")
            except requests.exceptions.ConnectionError:
                consecutive_errors += 1
                if consecutive_errors == 1:
                    print("📡 ESP32 connection lost")
            except Exception as e:
                consecutive_errors += 1
            
            if consecutive_errors > max_errors and consecutive_errors == max_errors + 1:
                print("🔇 Too many ESP32 errors, suppressing messages...")
            
            send_queue.task_done()
            
        except:
            continue
    
    print("📡 ESP32 sender thread stopped")

def frame_sender_worker():
    """Background thread untuk kirim frame ke web (non-blocking)"""
    global system_running
    print("🎥 Frame sender thread started")
    
    while system_running:
        try:
            frame = frame_queue.get(timeout=1)
            
            if sio.connected:
                try:
                    _, buffer = cv2.imencode('.jpg', frame, 
                                           [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                    jpg_as_text = base64.b64encode(buffer).decode('utf-8')
                    sio.emit('video-frame', {'frame': jpg_as_text})
                except:
                    pass
            
            frame_queue.task_done()
            
        except:
            continue
    
    print("🎥 Frame sender thread stopped")

def send_fire_data(fire_area, confidence=0):
    """Kirim data ke ESP32 (non-blocking)"""
    data = {
        'fire_area': int(fire_area),
        'confidence': round(confidence, 2)
    }
    
    try:
        send_queue.put_nowait(data)
        return True
    except:
        return False

def send_frame_to_web(frame):
    """Queue frame untuk dikirim ke web"""
    try:
        frame_queue.put_nowait(frame.copy())
    except:
        pass  # Queue full, skip frame

# ===========================
# CONNECT TO SERVER
# ===========================
def connect_to_server():
    try:
        sio.connect(SERVER_URL)
        print(f"🔗 Connecting to server: {SERVER_URL}")
    except Exception as e:
        print(f"⚠️ Cannot connect to server: {e}")

# ===========================
# HELPER FUNCTIONS - OPTIMIZED
# ===========================
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

def draw_detection_fast(frame, boxes_data, fps):
    """Optimized drawing function"""
    if not DRAW_BOXES:
        return frame
    
    for x1, y1, x2, y2, area, conf, color, label in boxes_data:
        # Draw rectangle
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        
        # Draw label background
        text = f"{label} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(frame, (x1, y1-th-8), (x1+tw+6, y1), color, -1)
        cv2.putText(frame, text, (x1+3, y1-4), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255,255,255), 1)
    
    # Status overlay
    status_text = f"FPS: {fps:.1f} | Detections: {len(boxes_data)}"
    cv2.rectangle(frame, (10, 10), (300, 50), (0, 0, 0), -1)
    cv2.putText(frame, status_text, (15, 35), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    
    return frame

# ===========================
# INITIALIZE
# ===========================
print("🔥 Fire Detection IoT System - HIGH FPS MODE")
print(f"📡 ESP32 Target: {ESP32_URL}")
print(f"🌐 Server: {SERVER_URL}")
print("⚡ Optimizations: Frame skipping, JPEG compression, Threading\n")

# Load YOLO model
try:
    model = YOLO(MODEL_PATH)
    
    # ⚡ CRITICAL: Set model to eval mode & move to GPU if available
    import torch
    if torch.cuda.is_available():
        model.to('cuda')
        print("✅ YOLOv8 model loaded (GPU ENABLED)")
    else:
        print("✅ YOLOv8 model loaded (CPU mode)")
        print("   💡 Tip: Install CUDA for 3-5x speed boost")
        
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None

# Initialize camera
camera_available = init_camera()

if not camera_available:
    print("\n⚠️ RUNNING IN SENSOR-ONLY MODE")
    sys.exit(1)

# Connect to server
connect_to_server()

# Start background threads
sender_thread = threading.Thread(target=send_worker, daemon=True)
sender_thread.start()

frame_sender_thread = threading.Thread(target=frame_sender_worker, daemon=True)
frame_sender_thread.start()

last_send_time = 0
last_frame_send_time = 0
frame_count = 0

# ===========================
# TEST CONNECTION
# ===========================
print("🔍 Testing ESP32 connection...")
send_fire_data(0, 0)
time.sleep(0.5)
print("✅ System ready!\n")

# ===========================
# MAIN LOOP - OPTIMIZED FOR SPEED
# ===========================
print("🎬 Starting HIGH FPS detection loop!")
print("=" * 60)

frame_error_count = 0
MAX_FRAME_ERRORS = 10

try:
    while system_running:
        with camera_lock:
            current_camera_state = camera_enabled
        
        if current_camera_state and camera_available and cap is not None:
            # ⚡ SPEED OPTIMIZATION: Fast frame read
            ret, frame = cap.read()
            
            if not ret or frame is None:
                frame_error_count += 1
                if frame_error_count >= MAX_FRAME_ERRORS:
                    print(f"❌ Too many frame errors, reinitializing...")
                    cap.release()
                    time.sleep(1)
                    camera_available = init_camera()
                    frame_error_count = 0
                time.sleep(0.1)
                continue
            
            frame_error_count = 0
            frame_count += 1
            
            # ⚡ FPS CALCULATION
            curr_time = time.time()
            fps_deque.append(curr_time)
            
            if len(fps_deque) > 1:
                fps = len(fps_deque) / (fps_deque[-1] - fps_deque[0])
            else:
                fps = 0
            
            # ⚡ SKIP FRAMES FOR INFERENCE (huge speed boost)
            if frame_count % INFERENCE_SKIP == 0 and model is not None:
                # Run inference
                results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)
                result = results[0]
                
                # Process detections
                largest_area = 0
                largest_conf = 0
                fire_detected = False
                boxes_data = []
                
                if len(result.boxes) > 0:
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
                            
                            color, label = get_fire_color(area)
                            boxes_data.append((x1, y1, x2, y2, area, confidence, color, label))
                
                # Send to ESP32 (throttled)
                if curr_time - last_send_time >= SEND_INTERVAL:
                    send_fire_data(largest_area, largest_conf)
                    last_send_time = curr_time
                    
                    # Update server
                    if sio.connected:
                        sio.emit('fire-detection', {
                            'area': int(largest_area),
                            'confidence': float(largest_conf),
                            'detected': fire_detected
                        })
                
                # Draw boxes if enabled
                if DRAW_BOXES:
                    frame = draw_detection_fast(frame, boxes_data, fps)
            else:
                # No inference this frame - just draw FPS
                cv2.rectangle(frame, (10, 10), (200, 50), (0, 0, 0), -1)
                cv2.putText(frame, f"FPS: {fps:.1f}", (15, 35), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            # ⚡ Send frame to web (throttled, non-blocking)
            if curr_time - last_frame_send_time >= FRAME_SEND_INTERVAL:
                send_frame_to_web(frame)
                last_frame_send_time = curr_time
            
            # Console log setiap 60 frame
            if frame_count % 60 == 0:
                print(f"⚡ FPS: {fps:.1f} | Frames: {frame_count}")
            
        else:
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
    print("\n🧹 Cleaning up...")
    
    system_running = False
    send_fire_data(0, 0)
    
    try:
        send_queue.join()
        frame_queue.join()
    except:
        pass
    
    if sender_thread.is_alive():
        sender_thread.join(timeout=3)
    if frame_sender_thread.is_alive():
        frame_sender_thread.join(timeout=3)
    
    if cap is not None:
        cap.release()
    
    if sio.connected:
        sio.emit('camera-status', {'status': 'disconnected', 'enabled': False})
        sio.disconnect()
    
    print("✅ System stopped")
    print("=" * 60)