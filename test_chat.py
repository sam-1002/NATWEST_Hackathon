import requests
import json

try:
    with open('assets/sample_data/multi_column.csv', 'rb') as f:
        response = requests.post(
            'http://localhost:8000/chat',
            files={'file': f},
            data={'question': 'What is the forecast for sales in the next 4 weeks?'}
        )
        print('Chat status:', response.status_code)
        if response.status_code == 200:
            data = response.json()
            print('Graph type:', data.get('graph_type', 'N/A'))
            print('Metric:', data.get('metric', 'N/A'))
            print('AI summary:', data.get('ai_summary', 'N/A'))
            print('Model used:', data.get('model_used', 'N/A'))
            print('Forecast length:', len(data.get('forecast', [])))
            print('Anomalies count:', len(data.get('anomalies', [])))
        else:
            print('Error:', response.text)
except Exception as e:
    print('Error:', e)