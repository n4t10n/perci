"""Endpoint de Percí Social. Reutiliza cookies HttpOnly y validación de Origin."""
from api.shared import ApiHandler

class handler(ApiHandler):
    endpoint = '/api/social'
