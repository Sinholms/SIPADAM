#!/usr/bin/env python3
"""
Webcam Diagnostic Tool
Checks for available webcams and their capabilities
"""

import cv2
import platform
import sys

print("=" * 60)
print("🔍 WEBCAM DIAGNOSTIC TOOL")
print("=" * 60)
print(f"OS: {platform.system()} {platform.release()}")
print(f"Python: {sys.version.split()[0]}")
print(f"OpenCV: {cv2.__version__}")
print("=" * 60)

def test_camera(index, backend):
    """Test a specific camera index and backend"""
    try:
        cap = cv2.VideoCapture(index, backend)
        if not cap.isOpened():
            return None
        
        ret, frame = cap.read()
        if not ret or frame is None:
            cap.release()
            return None
        
        info = {
            'index': index,
            'backend': backend,
            'width': int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
            'height': int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
            'fps': int(cap.get(cv2.CAP_PROP_FPS)),
        }
        
        cap.release()
        return info
        
    except Exception as e:
        return None

# Determine backends to test based on OS
if platform.system() == 'Linux':
    backends = [
        (cv2.CAP_V4L2, "V4L2"),
        (cv2.CAP_ANY, "ANY")
    ]
    print("\n📹 Testing Linux webcam backends (V4L2)...")
    
elif platform.system() == 'Windows':
    backends = [
        (cv2.CAP_DSHOW, "DirectShow"),
        (cv2.CAP_MSMF, "Media Foundation"),
        (cv2.CAP_ANY, "ANY")
    ]
    print("\n📹 Testing Windows webcam backends...")
    
elif platform.system() == 'Darwin':  # macOS
    backends = [
        (cv2.CAP_AVFOUNDATION, "AVFoundation"),
        (cv2.CAP_ANY, "ANY")
    ]
    print("\n📹 Testing macOS webcam backends...")
    
else:
    backends = [(cv2.CAP_ANY, "ANY")]
    print("\n📹 Testing default backend...")

print()

# Test camera indices 0-4 with each backend
found_cameras = []

for index in range(5):
    for backend_id, backend_name in backends:
        info = test_camera(index, backend_id)
        if info:
            found_cameras.append(info)
            print(f"✅ Camera {index} ({backend_name})")
            print(f"   Resolution: {info['width']}x{info['height']}")
            print(f"   FPS: {info['fps']}")
            print()

print("=" * 60)

if found_cameras:
    print(f"✅ FOUND {len(found_cameras)} WORKING CAMERA(S)")
    print()
    print("Recommended for test.py:")
    best = found_cameras[0]
    print(f"   cap = cv2.VideoCapture({best['index']}, cv2.CAP_V4L2)")
    print("   # or")
    print(f"   cap = cv2.VideoCapture({best['index']})")
else:
    print("❌ NO WEBCAMS FOUND!")
    print()
    print("🔧 Troubleshooting Steps:")
    print()
    
    if platform.system() == 'Linux':
        print("1. Check webcam devices:")
        print("   ls -l /dev/video*")
        print()
        print("2. Check permissions:")
        print("   groups $USER  # Should include 'video'")
        print("   sudo usermod -a -G video $USER")
        print("   # Then logout and login again")
        print()
        print("3. Test with v4l2:")
        print("   v4l2-ctl --list-devices")
        print("   sudo apt install v4l-utils  # If not installed")
        print()
        print("4. Check if webcam is in use:")
        print("   sudo lsof /dev/video0")
        print()
        
    elif platform.system() == 'Windows':
        print("1. Check Device Manager:")
        print("   - Open Device Manager")
        print("   - Look under 'Cameras' or 'Imaging devices'")
        print("   - Update drivers if needed")
        print()
        print("2. Check Windows Camera app:")
        print("   - Try opening Windows Camera app")
        print("   - If it works there, restart your Python script")
        print()
        print("3. Check privacy settings:")
        print("   Settings > Privacy > Camera")
        print("   - Allow desktop apps to access camera")
        print()
        
    elif platform.system() == 'Darwin':
        print("1. Check System Preferences:")
        print("   System Preferences > Security & Privacy > Camera")
        print("   - Allow Terminal/Python to access camera")
        print()
        print("2. Try Photo Booth:")
        print("   - Open Photo Booth to test camera")
        print()
        
    print("5. Common solutions:")
    print("   - Close Zoom, Skype, Teams, or other apps using camera")
    print("   - Restart your computer")
    print("   - Try a different USB port")
    print("   - Try an external USB webcam")

print("=" * 60)