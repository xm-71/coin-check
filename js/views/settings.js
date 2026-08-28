import { el, CURRENCIES } from '../util.js';
import { getSettings, updateSettings, currentUser, getFavorites } from '../store.js';
import { invalidate } from '../api.js';
import { deleteAccount, logout } from '../auth.js';
import { navigate, refresh } from '../router.js';
import { applyTheme } from '../theme.js';

function row(label, description, control) {
  return el('div.row',
    {},
    el('div.label', {}, label, description ? el('small', { text: description }) : null),
    el('div.control', {}, control)
  );
}

function select(options, value, onChange) {
  const node = el('select.select', { onchange: (e) => onChange(e.target.value) },
    options.map(([val, text]) => el('option', { value: val, text, selected: String(val) === String(value) }))
  );
  return node;
}

export default function settingsView() {
  const settings = getSettings();
  const user = currentUser();
  const notice = el('div');

  function save(patch, { rerender = false } = {}) {
    updateSettings(patch);
    notice.replaceChildren(el('div.alert.alert-ok', { text: 'Saved.' }));
    setTimeout(() => notice.replaceChildren(), 1800);
    if (rerender) refresh();
  }

  const display = el('section.panel',
    {},
    el('h2', { text: 'Display' }),
    el('p.sub', { text: 'How prices and trends are shown.' }),
    row('Currency', 'Used for every price, chart and stat.',
      select(CURRENCIES.map((c) => [c.id, c.label]), settings.currency, (value) => {
        // Prices are cached per-currency URL, but drop the cache so the
        // next render cannot show a stale mix.
        invalidate();
        save({ currency: value });
      })
    ),
    row('Default trend range', 'The window a coin page opens on.',
      select([['1', '24 hours'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', '1 year']],
        settings.defaultRange, (value) => save({ defaultRange: value }))
    ),
    row('Theme', 'Follow the system setting, or pin one.',
      select([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], settings.theme, (value) => {
        save({ theme: value });
        applyTheme(value);
      })
    )
  );

  const data = el('section.panel',
    {},
    el('h2', { text: 'Data' }),
    el('p.sub', { text: 'Market data comes from the free CoinGecko API.' }),
    row('Auto-refresh', 'How often the market lists re-fetch prices.',
      select([['0', 'Off'], ['30', 'Every 30 seconds'], ['60', 'Every minute'], ['300', 'Every 5 minutes']],
        String(settings.refreshSeconds), (value) => save({ refreshSeconds: Number(value) }, { rerender: false }))
    ),
    row('Coins to load', 'Size of the Markets list.',
      select([['50', '50'], ['100', '100'], ['250', '250']], String(settings.listSize),
        (value) => save({ listSize: Number(value) }))
    ),
    row('CoinGecko API key', 'Optional. A free demo key raises the rate limit.',
      el('input.input', {
        type: 'password',
        placeholder: 'CG-…',
        value: settings.apiKey || '',
        autocomplete: 'off',
        onchange: (event) => { invalidate(); save({ apiKey: event.target.value.trim() }); },
      })
    )
  );

  const account = el('section.panel',
    {},
    el('h2', { text: 'Account' }),
    el('p.sub', { text: 'Stored in this browser only — there is no CoinCheck server.' }),
    row('Signed in as', user?.email || '', el('div', { text: user?.username || '—' })),
    row('Favourites', 'Coins you are currently following.',
      el('div', { text: String(getFavorites().length) })),
    row('Session', 'Sign out on this device.',
      el('button.btn', { type: 'button', text: 'Sign out', onclick: () => { logout(); navigate('/login'); } })),
    row('Delete account', 'Removes this account, its favourites and its settings. Cannot be undone.',
      el('button.btn.btn-danger', {
        type: 'button',
        text: 'Delete account',
        onclick: () => {
          if (!confirm('Delete this account along with its favourites and settings? This cannot be undone.')) return;
          deleteAccount();
          navigate('/login');
        },
      }))
  );

  return el('div',
    {},
    el('h1', { text: 'Settings' }),
    el('p.sub', { text: 'Preferences apply to your account on this device.' }),
    notice,
    display,
    data,
    account
  );
}
