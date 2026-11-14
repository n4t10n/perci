"""v1.13: private avatar validation, user-scope and API route regression."""
import base64
import unittest
from pathlib import Path
from unittest.mock import patch

from server import perci_avatar
from api import shared

UID = '11111111-1111-4111-8111-111111111111'
OTHER = '22222222-2222-4222-8222-222222222222'


class FakeCore:
    ApiError = shared.core.ApiError


def webp_header(width=512, height=512):
    # Valid RIFF/WEBP VP8X container header, sufficient for input validation.
    chunk = b'VP8X' + (10).to_bytes(4, 'little') + b'\0\0\0\0' + \
        (width - 1).to_bytes(3, 'little') + (height - 1).to_bytes(3, 'little')
    return b'RIFF' + (len(chunk) + 4).to_bytes(4, 'little') + b'WEBP' + chunk


class TestAvatarStorage(unittest.TestCase):
    def test_fixed_path_is_derived_from_auth_user(self):
        self.assertEqual(perci_avatar._object_path(UID),
                         '/storage/v1/object/perci-avatars-dev/' + UID + '/avatar.webp')
        for value in ('../admin', 'not-an-uuid', OTHER + '/evil.webp', None, ''):
            with self.subTest(value=value), self.assertRaises(ValueError):
                perci_avatar._object_path(value)

    def test_server_validates_square_webp(self):
        raw = webp_header()
        self.assertEqual(perci_avatar.validate_image(FakeCore, base64.b64encode(raw).decode()), raw)
        for image in (webp_header(500, 512), webp_header(16, 16), b'MALICIOUS', b'\0' * 32):
            with self.subTest(image=image[:15]), self.assertRaises(FakeCore.ApiError):
                perci_avatar.validate_image(FakeCore, base64.b64encode(image).decode())
        with self.assertRaises(FakeCore.ApiError):
            perci_avatar.validate_image(FakeCore, '??invalid!')
        with self.assertRaises(FakeCore.ApiError):
            perci_avatar.validate_image(FakeCore, base64.b64encode(b'A' * 200_100).decode())

    def test_fetch_uses_authenticated_private_object_not_public_url(self):
        raw = webp_header()
        calls = []
        def fake_storage(core, path, token, **kwargs):
            calls.append((path, token, kwargs))
            return raw
        def read_avatar(core, path, token, **kwargs):
            calls.append((path, token, kwargs))
            return raw if path.endswith('/avatar.webp') else None
        with patch.object(perci_avatar, '_storage', side_effect=read_avatar):
            response = perci_avatar.fetch(FakeCore, 'USER_JWT', UID)
        self.assertTrue(response['present'])
        self.assertEqual(base64.b64decode(response['image'].split(',')[1]), raw)
        self.assertEqual(len(calls), 2)
        self.assertIn('/object/authenticated/perci-avatars-dev/' + UID + '/avatar.jpg', calls[0][0])
        self.assertIn('/object/authenticated/perci-avatars-dev/' + UID + '/avatar.webp', calls[1][0])
        self.assertNotIn('/public/', calls[0][0])
        self.assertTrue(all(x[1] == 'USER_JWT' for x in calls))

    def test_missing_avatar_is_normal_empty_state(self):
        with patch.object(perci_avatar, '_storage', return_value=None):
            self.assertEqual(perci_avatar.fetch(FakeCore, 'JWT', UID), {'present': False, 'image': None, 'ownerId': UID})

    def test_save_and_remove_cannot_accept_user_supplied_object_paths(self):
        seen = []
        def mock_storage(core, path, token, **kwargs):
            seen.append((path, token, kwargs))
            return b'{}'
        body = {'action': 'save', 'mime': 'image/webp',
                'image': base64.b64encode(webp_header()).decode(), 'ownerId': UID,
                'userId': OTHER, 'path': OTHER + '/avatar.webp'}
        with patch.object(perci_avatar, '_storage', side_effect=mock_storage):
            self.assertTrue(perci_avatar.update(FakeCore, 'USER_JWT', UID, body)['saved'])
            self.assertTrue(perci_avatar.update(FakeCore, 'USER_JWT', UID, {'action':'remove', 'userId':OTHER, 'ownerId':UID})['removed'])
        self.assertEqual([x[2]['method'] for x in seen], ['POST', 'DELETE', 'DELETE'])
        self.assertTrue(all('/' + UID + '/avatar.' in x[0] for x in seen))
        self.assertTrue(all(OTHER not in x[0] for x in seen))

    def test_stale_session_cannot_copy_photo_into_another_user(self):
        with self.assertRaises(FakeCore.ApiError) as caught:
            perci_avatar.update(FakeCore, 'JWT_FOR_OTHER', OTHER,
                {'action':'save','ownerId':UID,'mime':'image/webp',
                 'image':base64.b64encode(webp_header()).decode()})
        self.assertEqual(caught.exception.status,403)

    def test_disallowed_action_and_mime_fail(self):
        for body in ({'action':'save','ownerId':UID,'mime':'image/svg+xml','image':'AAAA'},
                     {'action':'url','ownerId':UID,'url':'https://example.com/pic.png'},
                     {'action':'save','ownerId':UID,'mime':'image/webp','image':123}):
            with self.subTest(body=body), self.assertRaises(FakeCore.ApiError):
                perci_avatar.update(FakeCore, 'JWT', UID, body)

    def test_private_qa_migration_restricts_bucket_and_exact_name(self):
        sql=Path('supabase/migrations/202611130001_perci_avatar_storage_qa.sql').read_text()
        self.assertIn("'perci-avatars-qa'", sql)
        self.assertIn('public = false', sql)
        self.assertIn("name = (select auth.uid())::text || '/avatar.webp'", sql)
        for operation in ('select','insert','update','delete'):
            self.assertIn('for ' + operation + ' to authenticated', sql)

    def test_api_dispatch_requires_authenticated_user_and_uses_same_origin_check(self):
        self.assertIn('/api/profile/avatar', shared.ENDPOINTS)
        h = object.__new__(shared.ApiHandler)
        h.path='/api/profile/avatar'
        h.endpoint='/api/profile/avatar'
        responses=[]
        h.send_json=lambda payload, status=200, **kwargs: responses.append((status, payload))
        h.authenticated=lambda: (None, None, ())
        h.check_post=lambda: {'action':'remove'}
        shared.ApiHandler.dispatch(h, 'GET')
        shared.ApiHandler.dispatch(h, 'POST')
        self.assertEqual([status for status,_ in responses], [401,401])


if __name__=='__main__':
    unittest.main()
