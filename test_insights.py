import requests

try:
    with open('assets/sample_data/multi_column.csv', 'rb') as f:
        response = requests.post('http://localhost:8000/insights', files={'file': f})
        print('Insights status:', response.status_code)
        if response.status_code == 200:
            data = response.json()
            print('Confidence:', data.get('confidence', {}))
            print('Model used:', data.get('model_used', 'N/A'))
            print('AI summary:', data.get('ai_summary', 'N/A'))
            print('Revenue forecast length:', len(data.get('revenue_forecast', [])))
            print('Revenue historical length:', len(data.get('revenue_historical', [])))
            print('Row count:', data.get('row_count', 0))
        else:
            print('Error:', response.text)
except Exception as e:
    print('Error:', e)