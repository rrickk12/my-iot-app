def hex_to_binary(hex_lines):
    binary_lines = []
    for line in hex_lines:
        hex_values = line.strip().split()
        binary_values = ['{0:08b}'.format(int(hv, 16)) for hv in hex_values]
        binary_line = ' '.join(binary_values)
        binary_lines.append(binary_line)
    return binary_lines


data = [
    "00 00 00 00 00 00 09 7c 34 fe",
    "00 0f ff 00 07 00 ec b9 72 cc",
    "00 00 00 00 00 00 93 1f f3 b2",
    "00 0f ff 00 07 00 d9 ca 78 d1",
    "00 00 00 00 00 00 6b 1d b5 2d",
    "00 0f ff 00 07 00 fc 65 9c c0",
    "00 0f ff 00 07 00 4d ef 1d f9",
    "00 0f ff 00 07 00 a7 b8 3b 7e",
    "00 00 00 00 00 00 3f c7 ba e5",
    "00 0f ff 00 07 00 b8 6f b3 50",
    "00 00 00 00 00 00 d6 ce 5f 20",
    "00 00 00 00 00 00 62 d5 a9 d8",
    "00 0f ff 00 07 00 37 1e 4c 6d",
    "00 0f ff 00 07 00 46 53 f0 f0",
    "00 00 00 00 00 00 c1 0d 7c 64"
]

binary_output = hex_to_binary(data)

for line in binary_output:
    print(line)
