/**
 * Blueprint content.
 *
 * A word is only admitted if it materialises as a literal, instantly readable
 * object with a distinct battlefield function. Recipes are gameplay tokens and
 * never get translated; only the explanation does.
 */
import { L } from '../core/i18n';
import type { BlueprintDef, BlueprintId } from '../alphabet/types';

const def = (
  id: BlueprintId,
  recipe: string,
  nameVi: string,
  nameEn: string,
  descVi: string,
  descEn: string,
  tags: BlueprintDef['tags'],
  color: string,
  order: number,
  limit: number,
  starter = false,
): BlueprintDef => ({
  id,
  word: recipe,
  recipe: [...recipe],
  tags,
  object: id,
  name: L(nameVi, nameEn),
  desc: L(descVi, descEn),
  color,
  limit,
  order,
  starter,
});

export const BLUEPRINTS: Record<BlueprintId, BlueprintDef> = {
  BOMB: def(
    'BOMB',
    'BOMB',
    'Bom',
    'Bomb',
    'Lăn vào chỗ đông nhất rồi nổ. Đốt được dầu.',
    'Rolls into the densest crowd, then detonates. Ignites oil.',
    ['EXPLOSIVE', 'PUSHABLE', 'GROUND'],
    '#f2734a',
    1,
    4,
    true,
  ),
  FIRE: def(
    'FIRE',
    'FIRE',
    'Lửa',
    'Fire',
    'Vùng cháy giữ cửa, bén sang dầu và mọi thứ dễ cháy.',
    'A burning zone that holds a lane and spreads to oil.',
    ['BURNING', 'AREA'],
    '#f0952e',
    2,
    2,
    true,
  ),
  BEE: def(
    'BEE',
    'BEE',
    'Ong',
    'Bee',
    'Bay qua vật cản. Ưu tiên đốt kẻ đang mang chữ.',
    'Flies over blockers and hunts letter carriers first.',
    ['FLYING', 'HUNTER'],
    '#c8e05a',
    3,
    4,
    true,
  ),
  WALL: def(
    'WALL',
    'WALL',
    'Tường',
    'Wall',
    'Chặn lối đi bộ, dồn quân thành cụm cho bom.',
    'Blocks ground paths and bunches enemies up for bombs.',
    ['BLOCKING', 'STRUCTURE'],
    '#8fa3c8',
    4,
    4,
    true,
  ),
  FAN: def(
    'FAN',
    'FAN',
    'Quạt',
    'Fan',
    'Đẩy quân nhẹ ra xa, đẩy cả bom lăn nhanh hơn.',
    'Pushes light enemies back — and pushes bombs across the field.',
    ['PUSH', 'UTILITY'],
    '#4fd8e4',
    5,
    3,
    true,
  ),
  OIL: def(
    'OIL',
    'OIL',
    'Dầu',
    'Oil',
    'Vũng dầu trơn, không sát thương. Gặp lửa là bùng.',
    'A slick with no damage of its own. Meets fire, becomes a blaze.',
    ['LIQUID', 'FLAMMABLE', 'SETUP'],
    '#7d6bd6',
    6,
    2,
    true,
  ),
  MINE: def(
    'MINE',
    'MINE',
    'Mìn',
    'Mine',
    'Nằm im chờ. Có gì chạm vào là nổ.',
    'Sits still, arms itself, detonates on contact.',
    ['EXPLOSIVE', 'SETUP'],
    '#e4534f',
    7,
    3,
  ),
  SAW: def(
    'SAW',
    'SAW',
    'Cưa',
    'Saw',
    'Lưỡi cưa lăn xuyên đội hình, cắt mọi thứ trên đường.',
    'A rolling blade that cuts through everything in its lane.',
    ['GROUND', 'HEAVY'],
    '#c0c8d8',
    8,
    2,
  ),
  WEB: def(
    'WEB',
    'WEB',
    'Lưới',
    'Web',
    'Lưới dính giữ chân quân đi bộ, dồn chúng lại một chỗ.',
    'Sticky web pins ground units in place and clusters them.',
    ['AREA', 'SETUP'],
    '#b09cf0',
    9,
    2,
  ),
  ICE: def(
    'ICE',
    'ICE',
    'Băng',
    'Ice',
    'Đóng băng một vùng. Mục tiêu đông cứng ăn sát thương nổ nặng hơn.',
    'Freezes a zone. Frozen targets take heavier explosive damage.',
    ['AREA', 'UTILITY'],
    '#8fe3f0',
    10,
    2,
  ),
};

export const STARTER_BLUEPRINTS: BlueprintDef[] = Object.values(BLUEPRINTS)
  .filter((b) => b.starter)
  .sort((a, b) => a.order - b.order);

export const ACQUIRABLE_BLUEPRINTS: BlueprintDef[] = Object.values(BLUEPRINTS)
  .filter((b) => !b.starter)
  .sort((a, b) => a.order - b.order);

export const blueprintById = (id: BlueprintId): BlueprintDef => BLUEPRINTS[id];
