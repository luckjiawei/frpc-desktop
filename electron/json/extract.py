import json
import os
import requests
import logging

# Set up logging configuration
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def extract_frp_releases():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    json_file_path = os.path.join(current_dir, 'frp-releases.json')
    
    logging.info('Reading JSON file: %s', json_file_path)
    with open(json_file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    
    checksums = {}
    
    for i in data:
        for asset in i['assets']:
            if asset['name'] == 'frp_sha256_checksums.txt':
                logging.info('Found checksum file: %s', asset['browser_download_url'])
                content = fetch_txt_content(asset['browser_download_url'])
                if content:
                    lines = content.splitlines()
                    for line in lines:
                        if line.strip():  # Ensure the line is not empty
                            parts = line.split()
                            if len(parts) == 2:
                                checksums[parts[0]] = parts[1]  # 反转映射关系
                                logging.debug('Added checksum: %s -> %s', parts[0], parts[1])

    output_file_path = os.path.join(current_dir, 'frp_all_sha256_checksums.json')
    logging.info('Writing checksums to file: %s', output_file_path)
    with open(output_file_path, 'w', encoding='utf-8') as output_file:
        json.dump(checksums, output_file, ensure_ascii=False, indent=4)

def fetch_txt_content(url):
    logging.info('Fetching content from: %s', url)
    response = requests.get(url)
    if response.status_code == 200:
        logging.info('Successfully fetched content')
        return response.text
    else:
        logging.error('Failed to fetch content, status code: %d', response.status_code)
        return None

if __name__ == "__main__":
    extract_frp_releases()
