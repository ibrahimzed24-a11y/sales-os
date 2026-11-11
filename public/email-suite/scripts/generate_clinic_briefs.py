#!/usr/bin/env python3
"""
VALIOZ Health — Bespoke Clinic Email HTML Generator
Usage:
  python3 generate_clinic_briefs.py --clinic "Brampton Dental Arts" --city "Brampton"
"""
import argparse
import os

def main():
    parser = argparse.ArgumentParser(description="Generate customized HTML email briefs for a target dental clinic.")
    parser.add_argument("--clinic", default="Brampton Dental Arts", help="Clinic Name")
    parser.add_argument("--city", default="Brampton", help="Clinic City")
    parser.add_argument("--out", default="./dist", help="Output folder")
    args = parser.parse_args()

    os.makedirs(args.out, exist_ok=True)
    base_dir = os.path.join(os.path.dirname(__file__), "..", "emails")
    for fname in sorted(os.listdir(base_dir)):
        if fname.endswith(".html"):
            with open(os.path.join(base_dir, fname), "r", encoding="utf-8") as f:
                content = f.read()
            customized = content.replace("Brampton Dental Arts", args.clinic).replace("Brampton", args.city)
            out_path = os.path.join(args.out, f"{args.clinic.lower().replace(' ', '-')}-{fname}")
            with open(out_path, "w", encoding="utf-8") as out_f:
                out_f.write(customized)
            print(f"Generated: {out_path}")

if __name__ == "__main__":
    main()
