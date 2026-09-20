/** Settings: audio, comfort, language, pacing. Everything here actually works. */
import { C, R, T, VIEW } from '../../core/theme';
import { label, plate, rgba, rr, type Ctx } from '../../core/draw';
import { getLang, setLang, t } from '../../core/i18n';
import { sfx } from '../../core/audio';
import { store } from '../../core/save';
import type { App, Screen } from '../../app/app';

interface Row {
  id: string;
  kind: 'slider' | 'toggle' | 'choice';
  label: string;
  value: () => number;
  set: (v: number) => void;
  options?: string[];
}

export function createSettingsScreen(): Screen {
  const rows = (): Row[] => [
    {
      id: 'master',
      kind: 'slider',
      label: t('masterVolume'),
      value: () => store.settings.master,
      set: (v) => {
        store.settings.master = v;
        sfx.applySettings(store.settings);
        store.saveSettings();
      },
    },
    {
      id: 'music',
      kind: 'slider',
      label: t('music'),
      value: () => store.settings.music,
      set: (v) => {
        store.settings.music = v;
        sfx.applySettings(store.settings);
        store.saveSettings();
      },
    },
    {
      id: 'sfx',
      kind: 'slider',
      label: t('sfx'),
      value: () => store.settings.sfx,
      set: (v) => {
        store.settings.sfx = v;
        sfx.applySettings(store.settings);
        store.saveSettings();
        sfx.ui();
      },
    },
    {
      id: 'shake',
      kind: 'slider',
      label: t('screenShake'),
      value: () => store.settings.shake,
      set: (v) => {
        store.settings.shake = v;
        store.saveSettings();
      },
    },
    {
      id: 'flashes',
      kind: 'toggle',
      label: t('reducedFlashes'),
      value: () => (store.settings.reducedFlashes ? 1 : 0),
      set: (v) => {
        store.settings.reducedFlashes = v > 0.5;
        store.saveSettings();
      },
    },
    {
      id: 'speed',
      kind: 'choice',
      label: t('defaultSpeed'),
      value: () => store.settings.speed - 1,
      set: (v) => {
        store.settings.speed = (v + 1) as 1 | 2 | 3;
        store.saveSettings();
      },
      options: ['1×', '2×', '3×'],
    },
    {
      id: 'lang',
      kind: 'choice',
      label: t('language'),
      value: () => (getLang() === 'vi' ? 0 : 1),
      set: (v) => {
        setLang(v === 0 ? 'vi' : 'en');
        store.settings.lang = v === 0 ? 'vi' : 'en';
        store.saveSettings();
      },
      options: ['Tiếng Việt', 'English'],
    },
  ];

  const drawSlider = (g: Ctx, app: App, row: Row, x: number, y: number, w: number): void => {
    const v = row.value();
    const trackW = 280;
    label(g, row.label, x, y + 4, { size: T.small, color: C.ink, weight: 700 });
    const tx = x + w - trackW - 96;
    g.fillStyle = rgba('#000000', 0.4);
    rr(g, tx, y - 8, trackW, 12, 6);
    g.fill();
    g.fillStyle = C.cyan;
    rr(g, tx, y - 8, Math.max(6, trackW * v), 12, 6);
    g.fill();
    label(g, `${Math.round(v * 100)}%`, x + w - 12, y + 4, {
      size: T.small,
      color: C.dim,
      align: 'right',
      weight: 800,
    });
    const hit = app.ui.hit(`settings.drag.${row.id}`, { x: tx - 10, y: y - 22, w: trackW + 20, h: 40 });
    if (hit.pressed || (hit.hover && app.ui.pressed === `settings.drag.${row.id}`)) {
      const [mx] = app.logicalPointer();
      const nv = Math.max(0, Math.min(1, (mx - tx) / trackW));
      row.set(nv);
    }
  };

  return {
    id: 'settings',
    draw(g, app) {
      g.fillStyle = '#080c16';
      g.fillRect(0, 0, VIEW.w, VIEW.h);
      label(g, t('settingsTitle'), 72, 78, { size: T.title, color: C.ink, weight: 800, tracking: 3 });

      plate(g, 72, 120, VIEW.w - 144, 520, { radius: R.lg, fill: '#121a2c', edge: C.lineHi, depth: 7 });

      const list = rows();
      const x = 112;
      const w = VIEW.w - 224;
      list.forEach((row, i) => {
        const y = 176 + i * 68;
        if (i > 0) {
          g.fillStyle = rgba(C.line, 0.4);
          g.fillRect(x, y - 28, w, 1);
        }
        if (row.kind === 'slider') {
          drawSlider(g, app, row, x, y, w);
        } else if (row.kind === 'toggle') {
          label(g, row.label, x, y + 4, { size: T.small, color: C.ink, weight: 700 });
          app.ui.button(g, `settings.toggle.${row.id}`, { x: x + w - 130, y: y - 18, w: 130, h: 40 }, {
            label: row.value() > 0.5 ? t('on') : t('off'),
            tone: row.value() > 0.5 ? C.mint : C.faint,
            variant: row.value() > 0.5 ? 'solid' : 'ghost',
            fontSize: T.small,
          });
        } else if (row.kind === 'choice') {
          label(g, row.label, x, y + 4, { size: T.small, color: C.ink, weight: 700 });
          const opts = row.options ?? [];
          opts.forEach((opt, oi) => {
            const bx = x + w - opts.length * 130 + oi * 130;
            const selected = Math.round(row.value()) === oi;
            app.ui.button(g, `settings.choice.${row.id}.${oi}`, { x: bx, y: y - 18, w: 120, h: 40 }, {
              label: opt,
              tone: selected ? C.gold : C.cyan,
              variant: selected ? 'solid' : 'ghost',
              fontSize: T.small,
            });
          });
        }
      });

      app.ui.button(g, 'settings.reset', { x: 112, y: 668, w: 260, h: 46 }, {
        label: t('resetProgress'),
        variant: 'ghost',
        tone: C.bad,
        fontSize: T.small,
      });
      if (resetArmed) {
        label(g, t('resetConfirm'), 388, 696, { size: T.small, color: C.bad, weight: 700 });
      }
      app.ui.button(g, 'settings.back', { x: VIEW.w - 212, y: 668, w: 140, h: 46 }, {
        label: t('back'),
        tone: C.cyan,
        fontSize: T.small,
      });
    },
    click(id, app) {
      if (id === 'settings.back') {
        sfx.ui();
        app.goto('title');
        return;
      }
      if (id === 'settings.reset') {
        if (!resetArmed) {
          resetArmed = true;
          window.setTimeout(() => {
            resetArmed = false;
          }, 4000);
          return;
        }
        store.resetProgress();
        resetArmed = false;
        app.toast('Đã xoá tiến trình', C.bad);
        return;
      }
      if (id.startsWith('settings.toggle.')) {
        const key = id.split('.')[2];
        const row = rows().find((r) => r.id === key);
        if (row) row.set(row.value() > 0.5 ? 0 : 1);
        return;
      }
      if (id.startsWith('settings.choice.')) {
        const [, , key, index] = id.split('.');
        const row = rows().find((r) => r.id === key);
        if (row) {
          row.set(Number(index));
          sfx.ui();
        }
      }
    },
    key(e, app) {
      if (e.key === 'Escape') {
        app.goto('title');
        return true;
      }
      return false;
    },
  };
}

let resetArmed = false;
