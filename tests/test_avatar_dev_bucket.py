"""DEV promotion: avatar storage must be isolated from QA, authenticated and private."""
from pathlib import Path
import unittest
from server import perci_avatar

class TestDevAvatarIsolation(unittest.TestCase):
    def test_server_targets_only_dev_bucket(self):
        self.assertEqual(perci_avatar.BUCKET, 'perci-avatars-dev')
        self.assertNotEqual(perci_avatar.BUCKET, 'perci-avatars-qa')
    def test_authenticated_owner_path_is_dev(self):
        uid='11111111-1111-4111-8111-111111111111'
        for ext in ('jpg', 'webp'):
            self.assertEqual(perci_avatar._object_path(uid, ext), '/storage/v1/object/perci-avatars-dev/'+uid+'/avatar.'+ext)
    def test_migration_is_private_owner_scoped_and_dual_format(self):
        s=Path('supabase/migrations/202611130003_perci_avatar_storage_dev.sql').read_text()
        self.assertIn("values ('perci-avatars-dev', 'perci-avatars-dev', false, 200000", s)
        self.assertIn("array['image/webp','image/jpeg']", s)
        self.assertIn('public = false', s)
        self.assertIn("(select auth.uid())::text || '/avatar.jpg'", s)
        self.assertIn("(select auth.uid())::text || '/avatar.webp'", s)
        for operation in ('select','insert','update','delete'):
            self.assertIn('for '+operation+' to authenticated', s)
        self.assertNotIn('drop policy if exists "perci_avatar_read_own"',s)
    def test_qa_migrations_unchanged_for_history(self):
        old=Path('supabase/migrations/202611130002_perci_avatar_jpeg_ios_qa.sql').read_text()
        self.assertIn("'perci-avatars-qa'", old)

if __name__=='__main__':
    unittest.main()
