import binascii
from Crypto.Cipher import AES

def parse_signed_88(buffer):
    """Convert 2-byte buffer to signed QQ8.8 fixed-point float"""
    value = int.from_bytes(buffer, byteorder='big', signed=True)
    return value / 256

def parse_samples(file_path, aes_key_hex=None):
    """Decodes Minew sensor data following protocol structure"""
    results = []
    aes_key = binascii.unhexlify(aes_key_hex) if aes_key_hex else None
    
    with open(file_path, 'r') as f:
        for line in f:
            line = line.strip()
            buf = binascii.unhexlify(line)
            
            if not buf:
                continue
                
            result = None
            frame_type = buf[0]
            
            try:
                # S3 Series Frame (Environmental sensors)
                if frame_type == 0xa3:
                    frame_version = buf[1]
                    if frame_version == 3 and len(buf) >= 16:  # Temperature/Humidity frame
                        result = {
                            'battery': buf[2],
                            'temperature': parse_signed_88(buf[3:5]),
                            'humidity': parse_signed_88(buf[5:7]),
                            'device_id': buf[12:18][::-1].hex() + '/2'
                        }
                
                # Connect V3 Series Frame
                elif frame_type == 0xca:
                    frame_version = buf[1]
                    
                    # Handle encrypted frames (Type 1B)
                    if frame_version == 0x1b and len(buf) >= 24:
                        if aes_key and (buf[2] & 0x80):  # Check encryption flag
                            cipher = AES.new(aes_key, AES.MODE_ECB)
                            decrypted = cipher.decrypt(buf[3:19])
                            buf = buf[:3] + decrypted + buf[19:]
                        
                        result = {
                            'temperature': parse_signed_88(buf[14:16]),
                            'battery_voltage': int.from_bytes(buf[12:14], 'big') / 1000,
                            'device_id': buf[6:12][::-1].hex() + '/2'
                        }
                    
                    # Temperature/Humidity frame (Type 05)
                    elif frame_version == 0x05 and len(buf) >= 24:
                        result = {
                            'temperature': parse_signed_88(buf[5:7]),
                            'humidity': parse_signed_88(buf[7:9]),
                            'name': buf[9:17].decode('utf-8').strip('\x00'),
                            'device_id': buf[6:12][::-1].hex() + '/2'
                        }
                
                if result:
                    result.update({
                        'raw_hex': line[-20:],  # Last 10 bytes
                        'frame_type': f"{frame_type:#04x}",
                        'uri': "https://sniffypedia.org/Organization/Shenzhen_Minew_Technologies_Co_Ltd/"
                    })
                    results.append(result)
                    
            except (IndexError, ValueError, UnicodeDecodeError) as e:
                print(f"Error decoding {line}: {str(e)}")
    
    return results

def generate_md_report(results):
    """Generates markdown report with protocol-aligned data"""
    md = "# Minew Sensor Data Report\n\n"
    md += "| Frame | Temperature (°C) | Humidity (%) | Battery | Device ID | Raw Data |\n"
    md += "|-------|-------------------|--------------|---------|-----------|----------|\n"
    
    for res in results:
        md += f"| {res['frame_type']} | "
        md += f"{res.get('temperature', 'N/A'):.1f} | "
        md += f"{res.get('humidity', 'N/A'):.1f} | "
        md += f"{res.get('battery', res.get('battery_voltage', 'N/A'))} | "
        md += f"{res['device_id']} | `{res['raw_hex']}` |\n"
    
    return md

# Configuration - Use Minew's default null key if needed
AES_KEY_HEX = "420ec3ea6e740feb07ff4c0012020003"
# AES_KEY_HEX = "420ec3ea6e740feb07ff4c0012020003"  # Corrected key (original had invalid 'p')

# Run decoding
results = parse_samples('samples.txt', aes_key_hex=AES_KEY_HEX)
print(generate_md_report(results))