import requests

try:
    with open('assets/sample_data/multi_column.csv', 'rb') as f:
        response = requests.post('http://localhost:8000/preprocess', files={'file': f})
        print('Status:', response.status_code)
        if response.status_code == 200:
            data = response.json()
            print('Warnings:', data.get('warnings', []))
            print('Has outliers:', data.get('has_outliers', False))
            print('Outlier info:')
            for col, info in data.get('outlier_info', {}).items():
                print(f'  {col}: {info["count"]} outliers')
                print(f'    Bounds: {info["lower_bound"]} to {info["upper_bound"]}')
                values = info["values"]
                print(f'    Values: {values[:2]}...' if len(values) > 2 else f'    Values: {values}')
        else:
            print('Error:', response.text)
except Exception as e:
    print('Error:', e)