import os
import argparse
import pandas as pd
from pathlib import Path
from multiprocessing import Pool, cpu_count

SUPPORTED_EXT = ".25o"
DEBUG = False

TARGET_COLUMNS = [
    "time", "sv", 
    "C1C", "L1C", "S1C", 
    "C2W", "L2W", "S2W", 
    "C2X", "L2X", "S2X", 
    "C5X", "L5X", "S5X", 
    "C2C", "L2C", "S2C", 
    "C1X", "L1X", "S1X", 
    "C6X", "L6X", "S6X", 
    "C7X", "L7X", "S7X", 
    "C8X", "L8X", "S8X"
]



#header

def extract_obs_types(lines):
    obs_map = {}
    i = 0

    while i < len(lines):
        line = lines[i]

        if "SYS / # / OBS TYPES" in line:
            sys_code = line[0]
            total = int(line[3:6])
            obs = line[7:60].split()

            i += 1
            while len(obs) < total and i < len(lines):
                obs.extend(lines[i][7:60].split())
                i += 1

            obs_map[sys_code] = obs
            continue

        if "END OF HEADER" in line:
            break

        i += 1

    return obs_map, i + 1



#format เวลา

def format_time(parts):
    try:
        year = int(parts[1])
        month = int(parts[2])
        day = int(parts[3])

        hour = int(parts[4])
        minute = int(parts[5])

        #ปัดเศษวินาที
        second = int(round(float(parts[6])))

        #ตัดเลขเกิน
        if second == 60:
            second = 0
            minute += 1

        if minute == 60:
            minute = 0
            hour += 1

        if hour == 24:
            hour = 0
            day += 1

        return f"{year}-{month}-{day} {hour:02}:{minute:02}:{second:02}"

    except:
        return None



#core

def parse_rinex(file_path):
    with open(file_path, 'r', encoding='latin-1', errors='ignore') as f:
        lines = f.readlines()

    obs_map, i = extract_obs_types(lines)

    rows = []
    current_time = None

    while i < len(lines):
        line = lines[i]

        #epoch
        if line.startswith(">"):
            p = line.split()
            current_time = format_time(p)  # 🔥 ใช้ function ใหม่
            i += 1
            continue

        #skip
        if not current_time or len(line) < 3:
            i += 1
            continue

        sv = line[:3].strip()
        if len(sv) < 2:
            i += 1
            continue

        sys_code = sv[0]
        if sys_code not in obs_map:
            i += 1
            continue

        obs_types = obs_map[sys_code]
        expected_len = len(obs_types)

        #อ่านข้อมูล
        values = []
        chunk = line[3:]
        values.extend([chunk[j:j+16].strip() for j in range(0, len(chunk), 16)])
        i += 1

        while len(values) < expected_len and i < len(lines):
            next_line = lines[i]

            if next_line.startswith(">"):
                break

            if len(next_line) >= 3:
                possible_sv = next_line[:3].strip()
                if possible_sv and possible_sv[0].isalpha():
                    break

            chunk = next_line[3:]
            values.extend([chunk[j:j+16].strip() for j in range(0, len(chunk), 16)])
            i += 1

        row = {col: None for col in TARGET_COLUMNS}
        row["time"] = current_time
        row["sv"] = sv

        for idx, val in enumerate(values):
            if idx >= len(obs_types):
                break

            obs_name = obs_types[idx]

            if obs_name in TARGET_COLUMNS and val:
                try:
                    row[obs_name] = float(val)
                except:
                    row[obs_name] = None

        rows.append(row)

    df = pd.DataFrame(rows)

    if df.empty:
        return df

    #remove dup
    df = df.drop_duplicates(subset=["time", "sv"])

    for col in TARGET_COLUMNS:
        if col not in df.columns:
            df[col] = None

    df = df[TARGET_COLUMNS]
    
    for col in df.columns:
        if col not in ["time", "sv"]:
            df[col] = pd.to_numeric(df[col], errors='coerce', downcast='float')

    return df



#process

def process_file(file_path):
    output_path = Path(file_path).with_suffix(".csv")

    if output_path.exists():
        return

    df = parse_rinex(file_path)

    if df.empty:
        return

    df.to_csv(output_path, index=False, float_format="%.6f")

    if DEBUG:
        print(f"[DONE] {output_path} rows={len(df)}  etl_gnss.py:210 - ETL.py:206")



#execute Mode // bulk

def bulk_run(root_folder):
    files = list(Path(root_folder).rglob(f"*{SUPPORTED_EXT}"))

    print(f" {len(files)} files")

    if not files:
        return

    workers = min(cpu_count(), len(files))

    with Pool(workers) as p:
        p.map(process_file, [str(f) for f in files])

#main

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--bulk")

    args = parser.parse_args()

    if args.bulk:
        bulk_run(args.bulk)
    else:
        print("Usage: python  bulk <folder>  etl_gnss.py:243 - ETL.py:236")


if __name__ == "__main__":
    main()