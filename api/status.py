"""Vercel endpoint /api/status (GET)."""
from api.shared import ApiHandler

class handler(ApiHandler):
    endpoint = '/api/status'
