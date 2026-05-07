
import pdfplumber
import re
from collections import defaultdict

pdf_path = r'C:\Users\brook\Downloads\Client-roster-from-01_04_2026-to-30_04_2026.pdf'

def parse_roster():
    clients_hours = defaultdict(float)
    current_client = None
    
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            lines = text.split('\n')
            
            for line in lines:
                # Look for client headers: "Mr Jamie Morton - 539h, 0m" or similar
                # Sometimes it's "Mr Jamie Morton - 539 9:00 am..."
                client_match = re.match(r'^(Mr|Mrs|Ms|Miss)\s+([^-\d]+)', line)
                if client_match:
                    name = client_match.group(2).strip()
                    # Clean up name if it has extra stuff
                    name = re.split(r'\d', name)[0].strip()
                    current_client = f"{client_match.group(1)} {name}"
                    print(f"Found Client: {current_client}")
                
                # Look for hours: "(2 hours)" or "(2 hours and 30 min)"
                hour_match = re.search(r'\((\d+)\s+hours?(?:\s+and\s+(\d+)\s+min)?\)', line)
                if hour_match and current_client:
                    h = int(hour_match.group(1))
                    m = int(hour_match.group(2) or 0)
                    clients_hours[current_client] += h + (m / 60.0)

    return clients_hours

if __name__ == "__main__":
    results = parse_roster()
    print("\n--- RESULTS PER CLIENT ---")
    for client, hours in sorted(results.items()):
        print(f"{client}: {hours:.2f} hours")
    
    total = sum(results.values())
    print(f"\nGRAND TOTAL: {total:.2f} hours")
