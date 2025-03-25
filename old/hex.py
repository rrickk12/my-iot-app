from Crypto.Cipher import AES
import struct

# Configuration
AES_KEY = bytes.fromhex("420ec3ea6e740feb07ff4c0012020003")
MAC_ADDRESS = "ac:23:3f:ae:30:40"

def parse_sensor_data(decrypted):
    """Improved parser with multiple format attempts"""
    attempts = [
        # Attempt 1: Temperature at bytes 5-6, Humidity at 7-8
        {'offsets': (5,7), 'format': '>hH', 'scale': 100},
        # Attempt 2: Little-endian at start
        {'offsets': (0,2), 'format': '<hH', 'scale': 100},
        # Attempt 3: Compact format with different scaling
        {'offsets': (0,2), 'format': '>hH', 'scale': 10}
    ]
    
    for attempt in attempts:
        try:
            t_start, h_start = attempt['offsets']
            temp = struct.unpack(attempt['format'], decrypted[t_start:t_start+2])[0]/attempt['scale']
            humi = struct.unpack(attempt['format'][-1], decrypted[h_start:h_start+2])[0]/attempt['scale']
            batt = decrypted[h_start+2] if (h_start+2) < len(decrypted) else None
            return {
                'temperature': temp,
                'humidity': humi,
                'battery': batt,
                'format': attempt
            }
        except Exception as e:
            continue
    return None

def process_packet(packet_hex):
    try:
        data = bytes.fromhex(packet_hex)
    except ValueError:
        return None

    # Correct BLE structure parsing:
    # 1 byte flags + 6 bytes MAC + 1 byte reserved + advertisement data
    if len(data) < 8:
        return None
    
    adv_data = data[8:]  # Skip flags(1) + MAC(6) + reserved(1)
    
    pos = 0
    manufacturer_data = None
    while pos < len(adv_data):
        length = adv_data[pos]
        if length == 0 or pos + length + 1 > len(adv_data):
            break
        
        ad_type = adv_data[pos+1]
        if ad_type == 0xFF:
            manufacturer_data = adv_data[pos+2:pos+1+length]
            break
            
        pos += 1 + length

    if not manufacturer_data:
        return None

    # Minew processing
    company_id = int.from_bytes(manufacturer_data[:2], 'little')
    if company_id != 0x0639:
        return None

    encrypted_payload = manufacturer_data[2:]
    if len(encrypted_payload) != 24:
        return None

    try:
        cipher = AES.new(AES_KEY, AES.MODE_ECB)
        decrypted = cipher.decrypt(encrypted_payload[:16])
    except:
        return None

    sensor_data = parse_sensor_data(decrypted)
    if sensor_data:
        sensor_data['mac'] = MAC_ADDRESS
        return sensor_data
    return None

# Test with your sample
sample = "00254030ae3f23ac0201061bff3906ca050100311cf84c5c4d535430310000000000005063fddc"
result = process_packet(sample)

if result:
    print(f"Decrypted: {result['temperature']:.1f}°C/{result['humidity']:.1f}%")
    print(f"Battery: {result['battery']}%")
    print(f"Format: {result['format']}")
else:
    print("Decryption failed")