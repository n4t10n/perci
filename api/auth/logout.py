"""Vercel endpoint /api/auth/logout (POST)."""
from api.shared import ApiHandler

class handler(ApiHandler):
    endpoint = '/api/auth/logout'
