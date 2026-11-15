import time
import requests # Added for Blynk API connectivity
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()

CREDENTIALS_FILE = os.getenv(
    "FIREBASE_CREDENTIALS",
    "firebase_credentials.json"
)

FIREBASE_URL = "https://firebaseio.com"

BLYNK_TOKEN = os.getenv("BLYNK_TOKEN")
CARD_ID = os.getenv("CARD_ID", "YOUR_CARD_ID")
POLL_INTERVAL = 5                       

# Maps virtual pins directly to your production Firestore field keys
PINS_TO_FETCH = {
    "V0": "gps_status",
    "V1": "status",            
    "V2": "emergency_status",  
    "V3": "lat",               
    "V4": "lon"                
}

# --- STATE TRACKER (PRESERVES LAST KNOWN PIN VALUES) ---
latest_device_state = {}

# --- INITIALIZE FIREBASE ---
if not firebase_admin._apps:
    try:
        cred = credentials.Certificate(CREDENTIALS_FILE)
        firebase_admin.initialize_app(cred, {'databaseURL': FIREBASE_URL})
        print("Successfully connected to Firebase Account!")
    except Exception as e:
        print(f"Failed to initialize Firebase: {e}")
        raise
else:
    print("Firebase already initialized.")

db_firestore = firestore.client()

# --- THE AUTOMATED SORTING ENGINE WITH HISTORY TIMELINE LOGS ---
def on_snapshot(doc_snapshot, changes, read_time):
    for doc in doc_snapshot:
        card_id = doc.id
        data = doc.to_dict()
        print(f"New raw envelope received in ingest room for card: {card_id}")
        
        # Track coordinate presence for logging mapping
        has_valid_coordinates = 'lat' in data and 'lon' in data
        
        # 1. Sort and route map coordinates
        if has_valid_coordinates:
            try:
                location_ref = db_firestore.collection('locations').document(card_id)
                # Using set with merge=True so missing documents are created without error
                location_ref.set({
                    'lat': float(data['lat']),
                    'lon': float(data['lon']),
                    'updated_at': firestore.SERVER_TIMESTAMP
                }, merge=True)
                print(f" -> Sent coordinates to /locations/{card_id}")
            except Exception as e:
                print(f" -> Location Route Error: {e}")
                
        # 2. Sort and route safety profile status
        if 'status' in data:
            try:
                # --- DYNAMIC EMERGENCY STATE FILTER RESOLUTION ---
                # Check if pin V1 (status) or pin V2 contains a fallback crash hazard alert string
                raw_status = str(data.get('status', 'Safe'))
                raw_emergency = str(data.get('emergency_status', 'NORMAL'))
                
                resolved_emergency = "NORMAL"
                if "FALL" in raw_status.upper() or "EMERGENCY" in raw_status.upper():
                    resolved_emergency = raw_status # Force copy hazard text ("Fall Detected")
                elif "FALL" in raw_emergency.upper() or "EMERGENCY" in raw_emergency.upper():
                    resolved_emergency = raw_emergency
                elif raw_emergency != "" and raw_emergency != "NONE":
                    resolved_emergency = raw_emergency

                student_ref = db_firestore.collection('students').document(card_id)
                # Using set with merge=True so missing documents are created without error
                student_ref.set({
                    'status': raw_status,
                    'emergency_status': resolved_emergency, # Injects the resolved hazard status string
                    'last_seen': firestore.SERVER_TIMESTAMP
                }, merge=True)
                print(f" -> Sent safety status to /students/{card_id} [Emergency: {resolved_emergency}]")
                
                # --- SUBCOLLECTION HISTORICAL ARCHIVER ENTRY LINE ---
                try:
                    history_log_ref = student_ref.collection('logs')
                    history_log_ref.add({
                        'timestamp': firestore.SERVER_TIMESTAMP,
                        'status': raw_status,
                        'emergency_status': resolved_emergency,
                        'lat': float(data['lat']) if has_valid_coordinates else None,
                        'lon': float(data['lon']) if has_valid_coordinates else None
                    })
                    print(f" -> Appended telemetry log into /students/{card_id}/logs timeline archive")
                except Exception as log_error:
                    print(f" -> History Timeline Logging Error: {log_error}")
                    
            except Exception as e:
                print(f" -> Student Route Error: {e}")

# --- START THE LIVE DATA WATCHER ---
print("Sorting engine is live. Watching /device_ingest for incoming Blynk deliveries...")
ingest_collection_ref = db_firestore.collection('device_ingest')

# This listener runs in the background and stays active without a 'while True' loop
query_watch = ingest_collection_ref.on_snapshot(on_snapshot)

# --- BACKGROUND FUNCTION: PULLS FROM BLYNK AND WRITES TO INGEST ---
def fetch_from_blynk_and_write_to_ingest():
    global latest_device_state
    fetch_errors = 0
    has_new_data = False
    is_emergency_event = False
    
    for pin_id, field_name in PINS_TO_FETCH.items():
        blynk_url = f"https://blynk.cloud/external/api/get?token={BLYNK_TOKEN}&{pin_id}"
        try:
            response = requests.get(blynk_url, timeout=3)
            if response.status_code == 200:
                val = response.text.strip()
                if pin_id in ["V3", "V4"]:
                    try:
                        val = float(val)
                    except ValueError:
                        val = None 
                
                # If valid data came from Blynk, update our persistent memory state
                if val is not None and val != "":
                    if latest_device_state.get(field_name) != val:
                        latest_device_state[field_name] = val
                        has_new_data = True
                        
                        # --- INTERCEPT THRESHOLDS ON BOTH LOGICAL DATA CHANNELS ---
                        clean_val = str(val).upper()
                        is_hazard_word = clean_val in ["FALL", "1", "TRUE", "EMERGENCY", "FALL DETECTED", "SOS"]
                        
                        if (field_name in ["status", "emergency_status"]) and is_hazard_word:
                            is_emergency_event = True
                            print(f"EMERGENCY INTERCEPT: Anomaly event observed on {field_name} ({pin_id}): {val}! Bypassing loop delay...")
            else:
                fetch_errors += 1
        except Exception:
            fetch_errors += 1

    # Writes the complete accumulated state so no past pins are lost or left behind
    if len(latest_device_state) > 0:
        try:
            ingest_ref = db_firestore.collection('device_ingest').document(CARD_ID)
            ingest_ref.set(latest_device_state, merge=True)
            if has_new_data:
                print(f" -> Updated ingest room with full state: {latest_device_state}")
        except Exception as e:
            print(f" -> Error writing raw data to ingest room: {e}")
            
    if fetch_errors == len(PINS_TO_FETCH):
        print(" -> Notice: Blynk device is offline. Waiting for hardware connectivity...")
        
    return is_emergency_event

# Main runtime control loop
try:
    while True:
        # Added execution call inside your loop to fetch data from Blynk continuously
        is_fall_detected = fetch_from_blynk_and_write_to_ingest()
        
        # CHANGED: If a fall occurred, bypass the wait interval and immediately run the next fetch
        if is_fall_detected:
            print("Instant Push Completed: Skipped normal delay due to emergency fall status event.")
            time.sleep(0.2)  # Tiny pause to allow Firestore snapshot processing
        else:
            time.sleep(POLL_INTERVAL)
except KeyboardInterrupt:
    print("Sorting engine safely stopped.")