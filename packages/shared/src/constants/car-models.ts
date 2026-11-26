/**
 * Common cars in Pakistan, for the garage app's picker and for consistent spelling (api/06,
 * garage-app/10). Not exhaustive: "Other" lets a mechanic type any make and model.
 */
export const CAR_MODELS: Readonly<Record<string, readonly string[]>> = {
  Suzuki: ['Mehran', 'Alto', 'Cultus', 'Wagon R', 'Swift', 'Bolan', 'Ravi', 'Every', 'Jimny'],
  Toyota: [
    'Corolla',
    'Yaris',
    'Vitz',
    'Aqua',
    'Prius',
    'Passo',
    'Fortuner',
    'Hilux',
    'Land Cruiser',
    'Prado',
  ],
  Honda: ['City', 'Civic', 'BR-V', 'HR-V', 'Vezel', 'N-WGN', 'Fit'],
  Daihatsu: ['Mira', 'Cuore', 'Move', 'Hijet'],
  KIA: ['Picanto', 'Sportage', 'Stonic', 'Sorento'],
  Hyundai: ['Tucson', 'Elantra', 'Sonata'],
  Changan: ['Alsvin', 'Oshan X7'],
  MG: ['HS', 'ZS'],
  Haval: ['H6', 'Jolion'],
  Nissan: ['Dayz', 'Note'],
  Mitsubishi: ['eK Wagon', 'Pajero'],
};

const squash = (value: string) => value.trim().replace(/\s+/g, ' ');

/**
 * Spells a make and model the same way every time: 'toyota' + ' corolla ' → 'Toyota', 'Corolla'.
 * Unknown makes and models are kept as typed (trimmed), since the list isn't exhaustive.
 */
export function canonicalCar(
  make: string,
  model?: string | null,
): { make: string; model: string | null } {
  const typedMake = squash(make);
  const knownMake = Object.keys(CAR_MODELS).find(
    (m) => m.toLowerCase() === typedMake.toLowerCase(),
  );
  const finalMake = knownMake ?? typedMake;
  if (model == null || squash(model) === '') return { make: finalMake, model: null };
  const typedModel = squash(model);
  const knownModel = knownMake
    ? CAR_MODELS[knownMake]!.find((m) => m.toLowerCase() === typedModel.toLowerCase())
    : undefined;
  return { make: finalMake, model: knownModel ?? typedModel };
}
