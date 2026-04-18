import requests

try:
    with open('assets/sample_data/multi_column.csv', 'rb') as f:
        response = requests.post('http://localhost:8000/forecast', files={'file': f})
        print('Forecast status:', response.status_code)
        if response.status_code == 200:
            data = response.json()
            print('Model used:', data.get('model_used', 'N/A'))
            print('Confidence:', data.get('confidence', {}))
            print('Forecast length:', len(data.get('forecast', [])))
            print('Historical length:', len(data.get('historical', [])))
            print('Anomalies count:', len(data.get('anomalies', [])))
            print('Selected column:', data.get('selected_column', 'N/A'))
        else:
            print('Error:', response.text)
except Exception as e:
    print('Error:', e)