from flask import Flask, request, jsonify
import time

app = Flask(__name__)

# Store last seen values per MAC to detect changes
last_values = {}

def has_changed(mac, new_data):
    old_data = last_values.get(mac)
    if not old_data:
        return True
    return any(
        new_data.get(k) != old_data.get(k)
        for k in ['temperature', 'humidity']
    )

@app.route('/data', methods=['POST'])
def receive_data():
    data = request.get_json(force=True)
    print(f"\n📦 Received POST with {len(data)} items:\n")

    for item in data:
        if item.get("type") == "MST01":
            mac = item.get("mac")
            if has_changed(mac, item):
                last_values[mac] = item
                print(f"🌡️ {mac} | Temp: {item['temperature']}°C | Humidity: {item['humidity']}% | RSSI: {item['rssi']}")
    
    return jsonify({"status": "ok"}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
