"""iOS Safari fallback; preserve authorization constraints and previously saved WebP."""
import base64
import unittest
from unittest.mock import patch
from server import perci_avatar
from api import shared

UID='11111111-1111-4111-8111-111111111111'
OTHER='22222222-2222-4222-8222-222222222222'


def jpeg_512():
    # Marker-compliant JPEG with 512 x 512 SOF, scan marker and EOI.
    sof=b'\xff\xc0\x00\x11\x08\x02\x00\x02\x00\x03\x01\x11\x00\x02\x11\x00\x03\x11\x00'
    return b'\xff\xd8' + sof + b'\xff\xda\x00\x02\x00' + b'\xff\xd9'


class TestAvatarSafariJPEG(unittest.TestCase):
    def test_size_reader_and_invalid_format(self):
        j=jpeg_512()
        self.assertEqual(perci_avatar._size_jpeg(j), (512,512))
        self.assertIsNone(perci_avatar._size_jpeg(j[:-2]))
        self.assertIsNone(perci_avatar._size_jpeg(b'not jpeg'))
        with self.assertRaises(shared.core.ApiError):
            perci_avatar.validate_image(shared.core,base64.b64encode(j).decode(),'image/webp')
        self.assertEqual(perci_avatar.validate_image(shared.core,base64.b64encode(j).decode(),'image/jpeg'),j)

    def test_store_uses_authenticated_users_id_and_jpeg_mime(self):
        requests=[]
        with patch.object(perci_avatar,'_storage',side_effect=lambda c,p,t,**kw:requests.append((p,t,kw)) or b'{}'):
            out=perci_avatar.update(shared.core,'privatejwt',UID,{'ownerId':UID,'action':'save','mime':'image/jpeg','image':base64.b64encode(jpeg_512()).decode(),'path':OTHER})
        self.assertTrue(out['saved'])
        self.assertEqual(requests[0][0],'/storage/v1/object/perci-avatars-dev/'+UID+'/avatar.jpg')
        self.assertEqual(requests[0][1],'privatejwt')
        self.assertNotIn(OTHER,requests[0][0])

    def test_jpeg_read_preferred_and_old_webp_compatible(self):
        j=jpeg_512()
        with patch.object(perci_avatar,'_storage',return_value=j) as storage:
            output=perci_avatar.fetch(shared.core,'token',UID)
        self.assertTrue(output['image'].startswith('data:image/jpeg;base64,'))
        self.assertIn('/object/authenticated/perci-avatars-dev/'+UID+'/avatar.jpg',storage.call_args.args[1])
        with patch.object(perci_avatar,'_storage',side_effect=[None,None]):
            self.assertFalse(perci_avatar.fetch(shared.core,'token',UID)['present'])

    def test_remove_both_formats_and_legacy_owner_validation(self):
        calls=[]
        with patch.object(perci_avatar,'_storage',side_effect=lambda c,p,t,**kw:calls.append((p,kw['method']))):
            perci_avatar.update(shared.core,'token',UID,{'ownerId':UID,'action':'remove'})
        self.assertEqual(calls,[('/storage/v1/object/perci-avatars-dev/'+UID+'/avatar.jpg','DELETE'),('/storage/v1/object/perci-avatars-dev/'+UID+'/avatar.webp','DELETE')])
        with self.assertRaises(shared.core.ApiError) as caught:
            perci_avatar.update(shared.core,'token',UID,{'ownerId':OTHER,'action':'remove'})
        self.assertEqual(caught.exception.status,403)

if __name__=='__main__':unittest.main()
