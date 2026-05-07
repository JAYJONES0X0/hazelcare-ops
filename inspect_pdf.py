
import pdfplumber
import re

pdf_path = r'C:\Users\brook\Downloads\Client-roster-from-01_04_2026-to-30_04_2026.pdf'

with pdfplumber.open(pdf_path) as pdf:
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        if not text:
            print(f"Page {i+1}: EMPTY")
            continue
        lines = text.splitlines()
        print(f"Page {i+1}: {lines[0]}")
        # Print lines that look like a client header
        for line in lines:
            if re.match(r'^(Mr|Mrs|Ms|Miss)\s+', line):
                print(f"  CLIENT LINE: {line}")
