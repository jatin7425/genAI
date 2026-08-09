import json


def sse(event, data):
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
