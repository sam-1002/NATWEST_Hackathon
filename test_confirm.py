import requests

try:
    with open('assets/sample_data/multi_column.csv', 'rb') as f:
        # First get the preprocessing info
        response = requests.post('http://localhost:8000/preprocess', files={'file': f})
        if response.status_code == 200:
            data = response.json()
            print('Original data has outliers:', data.get('has_outliers', False))

            # Now confirm and remove outliers from traffic column
            f.seek(0)  # Reset file pointer
            response2 = requests.post(
                'http://localhost:8000/preprocess/confirm',
                files={'file': f},
                data={'remove_outlier_cols': 'traffic'}
            )
            print('Confirm status:', response2.status_code)
            if response2.status_code == 200:
                data2 = response2.json()
                print('Warnings after removal:', data2.get('warnings', []))
                print('Row count:', data2.get('row_count', 0))
                print('Preview:', data2.get('preview', [])[:2])
            else:
                print('Error:', response2.text)
        else:
            print('Preprocess error:', response.text)
except Exception as e:
    print('Error:', e)