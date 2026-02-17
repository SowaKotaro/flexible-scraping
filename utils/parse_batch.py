import re
import json

def parse_proverbs(file_path, start_line, end_line):
    groups = []
    current_group = None
    
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Adjust for 0-indexed list
    lines_to_process = lines[max(0, start_line-1):end_line]
    
    for line in lines_to_process:
        line = line.strip()
        if not line:
            continue
            
        # Check for numbered identifier (e.g., "747. ")
        match_num = re.match(r'^(\d+)\.\s+(.*)', line)
        # Check for hyphen variant (e.g., "- ")
        match_hyphen = re.match(r'^-\s+(.*)', line)
        
        if match_num:
            if current_group:
                groups.append(current_group)
            current_group = {
                'id': match_num.group(1),
                'main': match_num.group(2),
                'variants': []
            }
        elif match_hyphen and current_group:
            current_group['variants'].append(match_hyphen.group(1))
            
    if current_group:
        groups.append(current_group)
        
    return groups

if __name__ == "__main__":
    groups = parse_proverbs('/home/gestnl/flexible-scraping/utils/output.txt', 501, 1000)
    print(json.dumps([g for g in groups if g['variants']], ensure_ascii=False, indent=2))
