/**
 * Adaptador de persistencia local v0.5. No hay backend remoto ni sincronización.
 * Mantener la clave del prototipo v0.4 evita perder datos existentes en el mismo origen.
 */
export const STORAGE_KEY = 'perci_paso3_review_v2';
export const PRE_B2_CHECKPOINT_KEY = STORAGE_KEY + '_pre_b2_checkpoint';
export const storage = {
  activeUser:null,
  activateUser(id) { this.activeUser=id||null; },
  readLegacy() { this.ensureUpgradeCheckpoint(); try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'); } catch {return null;} },
  activeKey(){return this.activeUser ? `perci_user_v09_${this.activeUser}` : STORAGE_KEY;},
  read() {
    this.ensureUpgradeCheckpoint();
    try { return JSON.parse(localStorage.getItem(this.activeKey()) || 'null'); }
    catch { return null; }
  },
  write(value) { localStorage.setItem(this.activeKey(), JSON.stringify(value)); },
  ensureUpgradeCheckpoint() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && !localStorage.getItem(PRE_B2_CHECKPOINT_KEY)) {
        localStorage.setItem(PRE_B2_CHECKPOINT_KEY, raw);
      }
    } catch { /* Sin cuota disponible: no bloquear el estado local existente. */ }
  },
  hasUpgradeCheckpoint() { return localStorage.getItem(PRE_B2_CHECKPOINT_KEY) !== null; },
  hasBackup() { return localStorage.getItem(this.activeKey() + '_backup') !== null; },
  backup(value) { localStorage.setItem(this.activeKey() + '_backup', JSON.stringify(value)); },
  readBackup() {
    try { return JSON.parse(localStorage.getItem(this.activeKey() + '_backup') || 'null'); }
    catch { return null; }
  },
  clearBackup() { localStorage.removeItem(this.activeKey() + '_backup'); },
};

/** v0.9: aislar los datos por usuario. Jamás se sobreescribe la copia heredada. */
const scopedKey = id => `perci_user_v09_${id}`;
export function readUserState(id){
  if(!/^[0-9a-f-]{36}$/.test(id))return null;
  try{return JSON.parse(localStorage.getItem(scopedKey(id))||'null');}catch{return null;}
}
export function writeUserState(id,data){
  if(!/^[0-9a-f-]{36}$/.test(id))throw new Error('Cuenta inválida.');
  localStorage.setItem(scopedKey(id),JSON.stringify(data));
}
export function getLegacyOwner(){try{return localStorage.getItem('perci_cloud_owner_v08');}catch{return null;}}
export function legacyAlreadyClaimed(){try{return localStorage.getItem('perci_legacy_claimed_v09')==='1';}catch{return true;}}
export function markLegacyClaimed(){localStorage.setItem('perci_legacy_claimed_v09','1');}
export function legacyHasPersonalData(data){
  if(!data||typeof data!=='object')return false;
  return (data.routines||[]).some(r=>r.id!=='r1')
    || (data.records||[]).some(r=>!(data.demo&&['s1','s2','s3'].includes(r.id)))
    || (data.habits||[]).some(h=>!(data.demo&&['h1','h2'].includes(h.id)));
}
