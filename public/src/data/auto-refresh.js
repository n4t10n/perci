/** Reglas de lectura automática por cuenta: sin afectar datos locales no enviados.
 * La presencia de un editor obsoleto en memoria no es motivo para bloquear el sync:
 * solo importa si la persona está efectivamente en un flujo de edición.
 */
const EDITING_VIEWS=new Set(['routineEdit','record','session','otherForm','habitEdit']);
const READING_VIEWS=new Set(['home','activity','progress','habits','account']);

export function canAutoRefreshCloud({uid,authenticated,online,visible,legacyChoice,hydrating,conflict,modal,draft,view}){
  return Boolean(uid&&authenticated&&online&&visible&&!legacyChoice&&!hydrating&&
    !conflict&&!modal&&!draft&&!EDITING_VIEWS.has(view));
}
export function shouldRefreshOnNavigation(view){return READING_VIEWS.has(view);}
