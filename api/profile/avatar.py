"""Vercel endpoint /api/profile/avatar (private GET, POST)."""
from api.shared import ApiHandler

class handler(ApiHandler):
    endpoint = '/api/profile/avatar'
