"""Vercel endpoint para borrados de registros autenticados (POST)."""
from api.shared import ApiHandler

class handler(ApiHandler):
    endpoint = '/api/cloud/delete'
