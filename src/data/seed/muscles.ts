import type { Muscle } from '../../domain/types';

/**
 * Músculos con nombre común y anatómico. `regions` enlaza con las regiones dibujadas
 * en el rig anatómico (src/anatomy/body). Un músculo puede no ser visible en todas las vistas.
 */
export const MUSCLES: Muscle[] = [
  { id: 'pec-clavicular', commonName: 'Pecho superior', anatomicalName: 'Pectoral mayor, porción clavicular', regions: ['pec-clavicular'] },
  { id: 'pec-sternal', commonName: 'Pecho', anatomicalName: 'Pectoral mayor, porción esternocostal', regions: ['pec-sternal'] },
  { id: 'delt-anterior', commonName: 'Hombro anterior', anatomicalName: 'Deltoides anterior', regions: ['delt-anterior'] },
  { id: 'delt-lateral', commonName: 'Hombro lateral', anatomicalName: 'Deltoides lateral (medio)', regions: ['delt-lateral'] },
  { id: 'delt-posterior', commonName: 'Hombro posterior', anatomicalName: 'Deltoides posterior', regions: ['delt-posterior'] },
  { id: 'latissimus', commonName: 'Dorsal', anatomicalName: 'Dorsal ancho', regions: ['latissimus'] },
  { id: 'trap-upper', commonName: 'Trapecio superior', anatomicalName: 'Trapecio, porción descendente', regions: ['trap-upper'] },
  { id: 'trap-mid', commonName: 'Trapecio medio e inferior', anatomicalName: 'Trapecio, porciones transversa y ascendente', regions: ['trap-mid'] },
  { id: 'rhomboids', commonName: 'Romboides', anatomicalName: 'Romboides mayor y menor', regions: ['rhomboids'] },
  { id: 'rotator-posterior', commonName: 'Manguito posterior', anatomicalName: 'Infraespinoso y redondo menor', regions: ['rotator-posterior'] },
  { id: 'biceps', commonName: 'Bíceps', anatomicalName: 'Bíceps braquial', regions: ['biceps'] },
  { id: 'brachialis', commonName: 'Braquial', anatomicalName: 'Braquial', regions: ['brachialis'] },
  { id: 'brachioradialis', commonName: 'Antebrazo (lado del pulgar)', anatomicalName: 'Braquiorradial', regions: ['brachioradialis'] },
  { id: 'forearm-flexors', commonName: 'Antebrazo (agarre)', anatomicalName: 'Flexores de muñeca y dedos', regions: ['forearm-flexors'] },
  { id: 'triceps', commonName: 'Tríceps', anatomicalName: 'Tríceps braquial', regions: ['triceps'] },
  { id: 'rectus-abdominis', commonName: 'Abdomen', anatomicalName: 'Recto abdominal', regions: ['rectus-abdominis'] },
  { id: 'obliques', commonName: 'Oblicuos', anatomicalName: 'Oblicuos externo e interno', regions: ['obliques'] },
  { id: 'erector-spinae', commonName: 'Zona lumbar', anatomicalName: 'Erectores de la columna', regions: ['erector-spinae'] },
  { id: 'glute-max', commonName: 'Glúteo', anatomicalName: 'Glúteo mayor', regions: ['glute-max'] },
  { id: 'glute-med', commonName: 'Glúteo lateral', anatomicalName: 'Glúteo medio', regions: ['glute-med'] },
  { id: 'quadriceps', commonName: 'Cuádriceps', anatomicalName: 'Cuádriceps femoral', regions: ['quadriceps'] },
  { id: 'hamstrings', commonName: 'Isquiotibiales', anatomicalName: 'Bíceps femoral, semitendinoso y semimembranoso', regions: ['hamstrings'] },
  { id: 'adductors', commonName: 'Aductores', anatomicalName: 'Aductor mayor y aductores de la cadera', regions: ['adductors'] },
  { id: 'gastrocnemius', commonName: 'Gemelos', anatomicalName: 'Gastrocnemio', regions: ['gastrocnemius'] },
  { id: 'soleus', commonName: 'Sóleo', anatomicalName: 'Sóleo', regions: ['soleus'] },
];

export const MUSCLE_BY_ID = new Map(MUSCLES.map((m) => [m.id, m]));
