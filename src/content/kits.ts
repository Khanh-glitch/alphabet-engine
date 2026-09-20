/**
 * Starting kits.
 *
 * A kit is a bag, three blueprints and a small rule of its own. Kits are the
 * clearest expression of "you are building an engine, not picking a class":
 * each one starts a different kind of chain.
 */
import { L, type LocaleText } from '../core/i18n';
import type { BlueprintId, Letter } from '../alphabet/types';
import type { BlueprintDef } from '../alphabet/types';
import { BLUEPRINTS } from './blueprints';

export interface KitDef {
  id: string;
  name: LocaleText;
  tagline: LocaleText;
  /** How the engine works, in one sentence. */
  how: LocaleText;
  blueprints: BlueprintId[];
  bag: Letter[];
  coreHp: number;
  wildcards: number;
  /** Drives the kit card's accent colour and the bag display. */
  color: string;
}

export const KITS: KitDef[] = [
  {
    id: 'assembly',
    name: L('DÂY CHUYỀN', 'THE ASSEMBLY'),
    tagline: L('Bom → Lửa → Dầu', 'Bomb → Fire → Oil'),
    how: L(
      'Dầu trải thảm, lửa châm ngòi, bom dọn cụm. Chuỗi bắt đầu từ vũng dầu.',
      'Oil lays the carpet, fire lights it, bombs clear the pile. Chains start in the slick.',
    ),
    blueprints: ['BOMB', 'FIRE', 'OIL'],
    bag: ['B', 'B', 'O', 'O', 'M', 'M', 'F', 'I', 'R', 'E'],
    coreHp: 100,
    wildcards: 1,
    color: '#f2734a',
  },
  {
    id: 'bastion',
    name: L('PHÁO ĐÀI', 'THE BASTION'),
    tagline: L('Tường → Mìn → Bom', 'Wall → Mine → Bomb'),
    how: L(
      'Tường chặn lối và dồn quân thành cụm. Mìn với bom xử lý cái cụm đó.',
      'Walls block the path and bunch enemies up. Mines and bombs handle the pile.',
    ),
    blueprints: ['WALL', 'MINE', 'BOMB'],
    // WALL and BOMB are complete from the bag; MINE is one E short, which is
    // exactly the gap the first carrier drop (or the wildcard) is there to fill.
    bag: ['W', 'A', 'L', 'L', 'B', 'B', 'O', 'M', 'M', 'I', 'N'],
    coreHp: 120,
    wildcards: 1,
    color: '#4fd8e4',
  },
  {
    id: 'hunter',
    name: L('THỢ SĂN', 'THE HUNTER'),
    tagline: L('Ong → Mìn → Lưới', 'Bee → Mine → Web'),
    how: L(
      'Ong tỉa kẻ mang chữ, lưới giữ chân cả bầy, mìn chờ sẵn ở lối vào.',
      'Bees pick off carriers, webs pin the crowd, mines wait on the path in.',
    ),
    blueprints: ['BEE', 'MINE', 'WEB'],
    bag: ['B', 'E', 'E', 'M', 'I', 'N', 'E', 'W', 'B', 'E'],
    coreHp: 90,
    wildcards: 2,
    color: '#c8e05a',
  },
];

export const kitById = (id: string): KitDef => {
  const found = KITS.find((k) => k.id === id);
  if (!found) throw new Error(`unknown kit: ${id}`);
  return found;
};

export const kitBlueprints = (kit: KitDef): BlueprintDef[] =>
  kit.blueprints.map((id) => BLUEPRINTS[id]);
