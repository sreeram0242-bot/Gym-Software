import asyncio
import websockets
import json
import urllib.request
import xml.etree.ElementTree as ET
import time
import base64
import sys

# Optional Biometric Matching Engine (SourceAFIS)
try:
    from sourceafis import FingerprintTemplate, FingerprintMatcher
    HAS_SOURCEAFIS = True
except ImportError:
    HAS_SOURCEAFIS = False
    print("[WARNING] sourceafis library not found. Running in MOCK matching mode.")
    print("To enable real matching: pip install sourceafis")

MANTRA_RD_PORT = 11100
SERVER_URL = "http://localhost:3000"
SYNC_INTERVAL = 300  # Sync every 5 minutes

class BiometricAgent:
    def __init__(self):
        self.gym_id = None
        self.templates_cache = [] # list of dicts: {'id', 'name', 'role', 'template_str', 'afis_template'}
        self.websockets = set()
        self.registration_mode = False
        self.last_registration_result = None

    def fetch_templates(self):
        if not self.gym_id:
            return
        
        try:
            url = f"{SERVER_URL}/api/biometrics/sync?gymId={self.gym_id}"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode('utf-8'))
                if data.get('success'):
                    raw_templates = data.get('templates', [])
                    self.templates_cache = []
                    
                    for rt in raw_templates:
                        cache_item = {
                            'id': rt['id'],
                            'name': rt['name'],
                            'role': rt['role'],
                            'template_str': rt['template'],
                            'afis_template': None
                        }
                        
                        # If we have SourceAFIS and we want to load it into memory
                        if HAS_SOURCEAFIS and rt['template']:
                            try:
                                # In production, Mantra RD should be configured to return raw images
                                # which SourceAFIS processes. If it's an ISO template, an ISO converter is needed.
                                # For this agent, we assume 'template' can be loaded by FingerprintTemplate.
                                raw_bytes = base64.b64decode(rt['template'])
                                # Note: This requires an image format (BMP/PNG/JPEG)
                                # If Mantra sends XML ISO minutiae, it would fail here natively without conversion.
                                cache_item['afis_template'] = FingerprintTemplate(raw_bytes)
                            except Exception as e:
                                pass # Ignore parse errors for mock
                        
                        self.templates_cache.append(cache_item)
                    print(f"[*] Synced {len(self.templates_cache)} biometric templates from server.")
        except Exception as e:
            print(f"[!] Error fetching templates: {str(e)}")

    def get_mantra_capture(self):
        """Calls the Mantra RD Service to capture a fingerprint."""
        url = f"http://127.0.0.1:{MANTRA_RD_PORT}/rd/capture"
        # Opts: format=0 (XML), format=1 (Protobuf). We request XML.
        pid_options = '''<?xml version="1.0"?>
        <PidOptions ver="1.0">
            <Opts fCount="1" fType="0" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="10000" env="P" />
        </PidOptions>'''
        
        try:
            req = urllib.request.Request(url, data=pid_options.encode('utf-8'), headers={'Content-Type': 'text/xml'})
            req.get_method = lambda: 'CAPTURE' # Force the UIDAI mandated CAPTURE method
            with urllib.request.urlopen(req, timeout=12) as response:
                xml_response = response.read().decode('utf-8')
                
            root = ET.fromstring(xml_response)
            resp = root.find('Resp')
            
            if resp is not None and resp.get('errCode') == '0':
                data = root.find('Data')
                if data is not None and data.text:
                    return {"success": True, "template": data.text}
                
            return {"success": False, "error": resp.get('errInfo') if resp is not None else "Unknown Error"}
        except Exception as e:
            return {"success": False, "error": f"Mantra Service Unreachable: {str(e)}"}

    def match_fingerprint(self, live_template_str):
        """1:N matching logic"""
        if not HAS_SOURCEAFIS:
            # --- MOCK MODE: Just return the first member for demonstration if we have any ---
            if len(self.templates_cache) > 0:
                print("[MOCK] Simulated a match against the first template in cache.")
                return self.templates_cache[0]
            return None

        # --- REAL MODE (SourceAFIS) ---
        try:
            live_bytes = base64.b64decode(live_template_str)
            live_afis_temp = FingerprintTemplate(live_bytes)
            matcher = FingerprintMatcher(live_afis_temp)
            
            best_match = None
            highest_score = 0
            THRESHOLD = 40.0 # SourceAFIS recommended threshold
            
            for cached in self.templates_cache:
                if cached['afis_template']:
                    score = matcher.match(cached['afis_template'])
                    if score > highest_score:
                        highest_score = score
                        best_match = cached
            
            if highest_score >= THRESHOLD:
                print(f"[*] Match Found! {best_match['name']} (Score: {highest_score:.2f})")
                return best_match
            
            return None
        except Exception as e:
            print(f"[!] Matching Error: {str(e)}")
            return None

    async def continuous_scanner(self):
        """Background loop that continuously polls the scanner for walk-in check-ins"""
        print("[*] Starting continuous biometric scanner loop...")
        while True:
            await asyncio.sleep(1) # Prevent CPU pegging
            
            # If the dashboard requested a manual scan for Registration, pause continuous check-in
            if self.registration_mode or not self.gym_id:
                continue
                
            # Trigger scanner (this blocks for up to 10 seconds waiting for a finger)
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(None, self.get_mantra_capture)
            
            if result.get('success'):
                # We got a live finger! Let's match it.
                matched_user = await loop.run_in_executor(None, self.match_fingerprint, result['template'])
                
                if matched_user:
                    # Notify all connected dashboards
                    event_type = 'scan_match_staff' if matched_user.get('role') != 'Member' else 'scan_match'
                    event_data = {
                        "type": event_type,
                        "success": True,
                        "customerId": matched_user['id'] if event_type == 'scan_match' else None,
                        "staffId": matched_user['id'] if event_type == 'scan_match_staff' else None,
                    }
                    await self.broadcast(event_data)
                    
                    # Prevent double-punching by sleeping a few seconds
                    await asyncio.sleep(4)

    async def background_sync(self):
        """Fetches the latest templates from the server every 5 minutes"""
        while True:
            if self.gym_id:
                loop = asyncio.get_event_loop()
                await loop.run_in_executor(None, self.fetch_templates)
            await asyncio.sleep(SYNC_INTERVAL)

    async def broadcast(self, data):
        if self.websockets:
            msg = json.dumps(data)
            await asyncio.gather(*[ws.send(msg) for ws in self.websockets])

    async def handle_connection(self, websocket, path):
        self.websockets.add(websocket)
        print("[*] Dashboard UI Connected!")
        try:
            async for message in websocket:
                data = json.loads(message)
                action = data.get('action')
                
                if action == 'init':
                    self.gym_id = data.get('gymId')
                    print(f"[*] Initialized for Gym ID: {self.gym_id}")
                    # Trigger immediate sync
                    loop = asyncio.get_event_loop()
                    await loop.run_in_executor(None, self.fetch_templates)
                    
                elif action == 'scan':
                    print("[*] Manual scan requested by dashboard (Registration)")
                    self.registration_mode = True
                    
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(None, self.get_mantra_capture)
                    
                    if result['success']:
                        print("[*] Scan successful, sending template to dashboard.")
                        await websocket.send(json.dumps({
                            "type": "scan_result",
                            "success": True,
                            "template": result['template']
                        }))
                    else:
                        print(f"[!] Scan failed: {result.get('error')}")
                        if "Unreachable" in result.get('error', ''):
                            # Provide a mock template for testing if device isn't plugged in
                            await websocket.send(json.dumps({
                                "type": "scan_result",
                                "success": True,
                                "template": "MOCK_BASE64_TEMPLATE_STRING_FOR_TESTING"
                            }))
                        else:
                            await websocket.send(json.dumps({
                                "type": "scan_result",
                                "success": False,
                                "error": result.get('error')
                            }))
                            
                    self.registration_mode = False
                    
        except websockets.exceptions.ConnectionClosed:
            print("[*] Dashboard UI Disconnected.")
        finally:
            self.websockets.remove(websocket)

async def console_input(agent):
    loop = asyncio.get_event_loop()
    print("\n[MOCK MODE] Press ENTER in this console to simulate a Fingerprint Check-in tap.")
    while True:
        await loop.run_in_executor(None, sys.stdin.readline)
        if not agent.gym_id:
            print("Cannot mock punch: Dashboard not connected (No gym_id).")
            continue
            
        print("Simulating check-in scan...")
        matched = agent.match_fingerprint("MOCK")
        if matched:
            event_type = 'scan_match_staff' if matched.get('role') != 'Member' else 'scan_match'
            event_data = {
                "type": event_type,
                "success": True,
                "customerId": matched['id'] if event_type == 'scan_match' else None,
                "staffId": matched['id'] if event_type == 'scan_match_staff' else None,
            }
            await agent.broadcast(event_data)
            print("Mock scan sent to dashboard.")
        else:
            print("No members enrolled to mock against!")

async def main():
    agent = BiometricAgent()
    print("=========================================")
    print(" GymFlow Fingerprint Bridge Agent (MFS100) ")
    print("=========================================")
    print(f"Listening on ws://localhost:8765")
    
    server = await websockets.serve(agent.handle_connection, "localhost", 8765)
    
    # Start background tasks
    asyncio.create_task(agent.background_sync())
    asyncio.create_task(agent.continuous_scanner())
    asyncio.create_task(console_input(agent))
    
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
