"""Percí v1.2: contract for set-by-set recovery, without real Supabase credentials."""
import unittest
from unittest.mock import patch
from server import perci_server as core

USER='123e4567-e89b-12d3-a456-426614174000'
SESSION={'id':'s-offline','type':'gym','name':'Día 1 Full Body','date':'2026-11-06',
         'minutes':35,'setsDone':2,'volume':820,'note':'',
         'setDetails':[{'exercisePosition':0,'exerciseName':'Press de banca','setNumber':2,'reps':10,'weight':42,'completed':True},
                       {'exercisePosition':0,'exerciseName':'Press de banca','setNumber':1,'reps':10,'weight':40,'completed':True}]}
SNAP={'version':3,'demo':False,'routines':[{'id':'r1','name':'Día 1 Full Body',
       'exercises':[{'name':'Press de banca','sets':4,'reps':10}]}],
       'records':[SESSION],'habits':[],'checks':{},'draft':None}

class TestWorkoutSets(unittest.TestCase):
    def test_upload_series_uses_authenticated_owner_and_idempotent_key(self):
        written=[]
        def upsert(table,rows,token,conflict):
            written.append((table,rows,conflict))
            return rows
        def select(table,token,user,cols='*'):
            self.assertEqual(user,USER)
            if table=='perci_routines':
                return [{'id':'uuid-r1','client_id':'perci-v04:routine:r1'}]
            if table=='perci_activity_records':
                return [{'id':'uuid-s1','client_id':'perci-v04:record:s-offline'}]
            return []
        with patch.object(core,'batch_upsert',side_effect=upsert),patch.object(core,'select_rows',side_effect=select):
            result=core.upload_data(SNAP,'jwt-token',USER)
        sets=[item for item in written if item[0]=='perci_workout_sets']
        self.assertEqual(len(sets),1)
        self.assertEqual(sets[0][2],'record_id,exercise_position,set_number')
        self.assertEqual(len(sets[0][1]),2)
        self.assertEqual({x['set_number'] for x in sets[0][1]},{1,2})
        self.assertTrue(all(x['record_id']=='uuid-s1' and x['user_id']==USER for x in sets[0][1]))
        self.assertEqual(result['records'],1)

    def test_download_recovers_weights_and_reps_sorted(self):
        def select(table,token,user,cols='*'):
            if table=='perci_routines': return []
            if table=='perci_routine_exercises': return []
            if table=='perci_activity_records':
                return [{'id':'uuid-s1','client_id':'perci-v04:record:s-offline','activity_type':'gym',
                         'name':'Día 1 Full Body','activity_date':'2026-11-06','minutes':35,
                         'note':'','distance_km':None,'sets_done':2,'volume_kg':820}]
            if table=='perci_workout_sets':
                return [{'record_id':'uuid-s1','exercise_position':0,'exercise_name':'Press de banca','set_number':2,'reps':10,'weight_kg':'42.00','completed':True},
                        {'record_id':'uuid-s1','exercise_position':0,'exercise_name':'Press de banca','set_number':1,'reps':10,'weight_kg':'40.00','completed':True}]
            return []
        with patch.object(core,'select_rows',side_effect=select):
            downloaded=core.download_data('jwt-token',USER)
        details=downloaded['records'][0]['setDetails']
        self.assertEqual([d['setNumber'] for d in details],[1,2])
        self.assertEqual([d['weight'] for d in details],[40,42])
        self.assertEqual([d['reps'] for d in details],[10,10])

    def test_rejects_duplicate_and_invalid_series(self):
        import copy
        invalid=copy.deepcopy(SNAP)
        invalid['records'][0]['setDetails'][1]['setNumber']=2
        with self.assertRaises(core.ApiError):core.verify_snapshot(invalid)
        invalid=copy.deepcopy(SNAP)
        invalid['records'][0]['setDetails'][0]['weight']=-1
        with self.assertRaises(core.ApiError):core.verify_snapshot(invalid)
        invalid=copy.deepcopy(SNAP)
        invalid['records'][0]['setDetails'][0]['weight']=float('nan')
        with self.assertRaises(core.ApiError):core.verify_snapshot(invalid)

if __name__=='__main__':unittest.main()
