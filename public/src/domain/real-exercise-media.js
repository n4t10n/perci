/** Percí QA v1.12.1. Clips originales de sus proveedores, permisos en docs/real-exercise-sources-v1121.json. */
import {findCatalogExercise} from './exercise-catalog.js?v=1.12.0';
const CLIPS=Object.freeze({
  "press-banca":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "sentadilla":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "peso-muerto":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "remo-mancuerna":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "jalon-pecho":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "prensa-piernas":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "elevacion-lateral":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "remo-polea-baja":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:"agarre cerrado en V"}),
  "peso-muerto-rumano":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:"con kettlebell"}),
  "curl-martillo":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "extension-triceps-polea":Object.freeze({provider:"YMove",source:"https://ymove.app/free-exercise-videos",variant:""}),
  "press-militar":Object.freeze({provider:"Pexels",source:"https://www.pexels.com/video/a-man-doing-dumbbell-shoulder-press-4367541/",variant:"con mancuernas"}),
  "curl-biceps":Object.freeze({provider:"Pexels",source:"https://www.pexels.com/video/a-man-doing-dumbbell-curls-6547801/",variant:""}),
  "plancha":Object.freeze({provider:"Pexels",source:"https://www.pexels.com/video/woman-performing-plank-exercise-in-gym-31035751/",variant:""}),
  "dominadas":Object.freeze({provider:"Pexels",source:"https://www.pexels.com/video/young-man-practicing-pull-ups-in-gym-34780117/",variant:""}),
  "aperturas-mancuernas":Object.freeze({provider:"Pexels",source:"https://www.pexels.com/video/a-woman-doing-dumbbell-chest-flys-at-an-outdoor-gym-8402113/",variant:""}),
  "crunch-abdominal":Object.freeze({provider:"Pexels",source:"https://www.pexels.com/video/young-man-performing-crunches-in-modern-gym-36484275/",variant:""}),
});
export function getRealExerciseMedia(name){
 const exercise=findCatalogExercise(name);
 if(!exercise)return null;
 const item=CLIPS[exercise.id];
 if(!item)return null;
 return {...item,id:exercise.id,name:exercise.name,
  video:`./assets/exercises/real/${exercise.id}.mp4`,
  poster:`./assets/exercises/real/${exercise.id}.jpg`};
}
export const REAL_EXERCISE_COUNT=Object.keys(CLIPS).length;
