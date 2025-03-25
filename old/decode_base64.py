import struct

packet_hex = "00254030ae3f23ac0201061bff3906ca050100311e734bcc4d535430310000000000003fc7bae5"

def parse_packet(hex_data):
    data = bytes.fromhex(hex_data)

    # Slice packet according to your defined structure
    header = data[:21]
    ascii_part = data[21:24]
    model = data[24:29]
    sensor_data = data[29:39]  # exactly 10 bytes

    print(f"Header (21 bytes): {header.hex()}")
    
    # ASCII check
    try:
        ascii_str = ascii_part.decode('ascii')
        print(f"ASCII part (3 bytes): {ascii_str}")
    except UnicodeDecodeError:
        ascii_str = None
        print(f"ASCII part (3 bytes): {ascii_part.hex()} (Non-ASCII)")

    # Model extraction
    model_str = model.decode('ascii', errors='ignore')
    print(f"Model (5 bytes): {model_str}")

    # Sensor Data (10 bytes)
    print(f"Sensor Data (10 bytes): {sensor_data.hex()}")

    # Example numeric parsing (hypothetical):
    # Let's assume the first 2 bytes represent temperature (signed 8.8 fixed-point),
    # next 2 bytes humidity (unsigned 8.8 fixed-point), next byte battery level, 
    # followed by 5 reserved or unknown bytes.
    if len(sensor_data) >= 5:
        temp_raw = struct.unpack('>h', sensor_data[0:2])[0] / 256
        humi_raw = struct.unpack('>H', sensor_data[2:4])[0] / 256
        battery = sensor_data[4]
        print(f"Parsed Temperature: {temp_raw:.2f} °C")
        print(f"Parsed Humidity: {humi_raw:.2f} %")
        print(f"Parsed Battery Level: {battery}%")
    else:
        print("Insufficient data length for numeric parsing.")

# Run parser
parse_packet(packet_hex)
