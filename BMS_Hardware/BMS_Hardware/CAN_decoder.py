#!/usr/bin/env python3

"""
Simple CAN matrix decoder.

- 8-byte CAN frames (DLC = 8)
- Little-endian (Intel) bit numbering:
    bit 0 = LSB of byte 0
    bit 7 = MSB of byte 0
    bit 8 = LSB of byte 1, etc.
- Physical value = raw * factor + offset

You only need to change the CAN_MATRIX definition
to match your CAN matrix.
"""

# 1. CAN Matrix definition 

# Each signal:
#   name, start_bit, length, factor, offset, signed, unit
#
# Start bit is LSB index in the 64-bit payload.
# Example: start_bit=0, length=16 → bits 0..15 (bytes 0..1).

CAN_MATRIX = {
    0x180: {  # Example: PackStatus
        "name": "PackStatus",
        "dlc": 8,
        "signals": [
            {
                "name": "PackVoltage",
                "start_bit": 0,
                "length": 16,
                "factor": 0.1,   # 0.1 V per bit
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
            {
                "name": "PackCurrent",
                "start_bit": 16,
                "length": 16,
                "factor": 0.1,   # 0.1 A per bit
                "offset": -320.0,  # -320 A offset encoded as unsigned
                "signed": False,
                "unit": "A",
            },
            {
                "name": "SOC",
                "start_bit": 32,
                "length": 8,
                "factor": 0.5,   # 0.5 % per bit
                "offset": 0.0,
                "signed": False,
                "unit": "%",
            },
            {
                "name": "SOH",
                "start_bit": 40,
                "length": 8,
                "factor": 0.5,   # 0.5 % per bit
                "offset": 0.0,
                "signed": False,
                "unit": "%",
            },
            {
                "name": "PackTemperature",
                "start_bit": 48,
                "length": 8,
                "factor": 1.0,   # 1 °C per bit
                "offset": -40.0,  # encoded as 0..255, physical -40..+215 °C
                "signed": False,
                "unit": "°C",
            },
        ],
    },

    0x181: {  # Example: CellVoltages1 (cells 1-4)
        "name": "CellVoltages1",
        "dlc": 8,
        "signals": [
            {
                "name": "Cell1Voltage",
                "start_bit": 0,
                "length": 16,
                "factor": 0.001,  # mV → V
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
            {
                "name": "Cell2Voltage",
                "start_bit": 16,
                "length": 16,
                "factor": 0.001,
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
            {
                "name": "Cell3Voltage",
                "start_bit": 32,
                "length": 16,
                "factor": 0.001,
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
            {
                "name": "Cell4Voltage",
                "start_bit": 48,
                "length": 16,
                "factor": 0.001,
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
        ],
    },

    0x182: {  # Example: CellVoltages2 (cells 5-8)
        "name": "CellVoltages2",
        "dlc": 8,
        "signals": [
            {
                "name": "Cell5Voltage",
                "start_bit": 0,
                "length": 16,
                "factor": 0.001,
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
            {
                "name": "Cell6Voltage",
                "start_bit": 16,
                "length": 16,
                "factor": 0.001,
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
            {
                "name": "Cell7Voltage",
                "start_bit": 32,
                "length": 16,
                "factor": 0.001,
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
            {
                "name": "Cell8Voltage",
                "start_bit": 48,
                "length": 16,
                "factor": 0.001,
                "offset": 0.0,
                "signed": False,
                "unit": "V",
            },
        ],
    },
}


# 2. Bit extraction helpers


def _payload_to_u64_little_endian(data):
    """
    Interpret up to 8 bytes as a 64-bit unsigned integer (little-endian).
    """
    if len(data) < 8:
        data = data + b"\x00" * (8 - len(data))
    return int.from_bytes(data[:8], byteorder="little", signed=False)


def _extract_raw(frame_value, start_bit, length, signed):
    """
    Extract a raw integer signal from the 64-bit frame_value.
    """
    mask = (1 << length) - 1
    raw = (frame_value >> start_bit) & mask

    if signed and length > 0:
        sign_bit = 1 << (length - 1)
        if raw & sign_bit:
            raw -= (1 << length)

    return raw


# 3. Public decoder API


def decode_can_frame(can_id, data):
    """
    Decode a CAN frame using the CAN_MATRIX.

    Args:
        can_id (int) : CAN identifier (standard 11-bit in this example).
        data (bytes): 8-byte payload (DLC 8).

    Returns:
        dict: {
            "frame_name": str,
            "signals": {
                signal_name: {
                    "value": float,
                    "unit": str
                },
                ...
            }
        }
        or {} if CAN ID is not defined in the matrix.
    """
    frame_def = CAN_MATRIX.get(can_id)
    if frame_def is None:
        return {}

    if len(data) < frame_def["dlc"]:
        raise ValueError(
            f"Data length {len(data)} < DLC {frame_def['dlc']} for ID 0x{can_id:X}"
        )

    frame_value = _payload_to_u64_little_endian(data)

    result = {
        "frame_name": frame_def["name"],
        "signals": {},
    }

    for sig in frame_def["signals"]:
        raw = _extract_raw(
            frame_value,
            sig["start_bit"],
            sig["length"],
            sig["signed"],
        )
        phys = raw * sig["factor"] + sig["offset"]
        result["signals"][sig["name"]] = {
            "value": phys,
            "unit": sig["unit"],
        }

    return result



# 4. Simple example (you can remove this block in production)


if __name__ == "__main__":
    # Example: decode a Battery PackStatus frame (0x180)
    # Example payload: 8 bytes (hex string just for testing)
    #
    #   PackVoltage  = 260.5 V   (raw = 2605)
    #   PackCurrent  =  10.0 A   (raw = (10 + 320) / 0.1 = 3300)
    #   SOC          =  80.0 %   (raw = 160)
    #   SOH          =  98.0 %   (raw = 196)
    #   PackTemp     =  25 °C    (raw = 65, because 65 - 40 = 25)
    #
    example_id = 0x180
    example_data = bytes.fromhex("2D 0A EC 0C A0 C4 41 00")

    decoded = decode_can_frame(example_id, example_data)

    if not decoded:
        print(f"No matrix entry for ID 0x{example_id:X}")
    else:
        print(f"Frame 0x{example_id:X} ({decoded['frame_name']}):")
        for name, info in decoded["signals"].items():
            val = info["value"]
            unit = info["unit"]
            if unit:
                print(f"  {name:16s} = {val:.3f} {unit}")
            else:
                print(f"  {name:16s} = {val:.3f}")

