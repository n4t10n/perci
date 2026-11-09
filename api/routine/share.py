"""Vercel endpoint /api/routine/share (POST)."""
from api.shared import ApiHandler


class handler(ApiHandler):
    endpoint = '/api/routine/share'
