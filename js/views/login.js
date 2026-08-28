import { el } from '../util.js';
import { login, register } from '../auth.js';
import { navigate } from '../router.js';
import { getUsers } from '../store.js';

/**
 * Combined sign-in / create-account screen. The original page had two forms
 * toggled by a jQuery handler that was never loaded; this is one form whose
 * fields change with the mode.
 */
export default function loginView() {
  // Default new visitors to "create account" so the first run has somewhere to go.
  let mode = getUsers().length ? 'signin' : 'signup';

  const card = el('div.card');
  const root = el('div.auth',
    {},
    el('div.brand', {}, el('span.dot'), 'CoinCheck'),
    el('p.sub', { text: 'Prices, favourites and trends.' }),
    card
  );

  function render() {
    const isSignup = mode === 'signup';
    const alert = el('div');

    const identifier = el('input.input', {
      type: 'text',
      name: 'identifier',
      autocomplete: 'username',
      placeholder: isSignup ? 'satoshi' : 'username or email',
    });
    const email = el('input.input', {
      type: 'email', name: 'email', autocomplete: 'email', placeholder: 'you@example.com',
    });
    const password = el('input.input', {
      type: 'password',
      name: 'password',
      autocomplete: isSignup ? 'new-password' : 'current-password',
      placeholder: '••••••••',
    });

    const submit = el('button.btn.btn-primary.btn-block', {
      type: 'submit',
      text: isSignup ? 'Create account' : 'Sign in',
    });

    const form = el('form',
      {
        novalidate: true,
        onsubmit: async (event) => {
          event.preventDefault();
          alert.replaceChildren();
          submit.disabled = true;
          submit.textContent = isSignup ? 'Creating…' : 'Signing in…';
          try {
            if (isSignup) {
              await register({
                username: identifier.value,
                email: email.value,
                password: password.value,
              });
            } else {
              await login({ identifier: identifier.value, password: password.value });
            }
            navigate('/markets');
          } catch (error) {
            alert.replaceChildren(el('div.alert.alert-error', { text: error.message }));
            submit.disabled = false;
            submit.textContent = isSignup ? 'Create account' : 'Sign in';
            password.focus();
          }
        },
      },
      alert,
      el('div.field', {}, el('label', { for: 'cc-id', text: isSignup ? 'Username' : 'Username or email' }), identifier),
      isSignup && el('div.field', {}, el('label', { text: 'Email' }), email),
      el('div.field', {}, el('label', { text: 'Password' }), password),
      submit,
      el('p.switch',
        {},
        isSignup ? 'Already registered? ' : 'No account yet? ',
        el('button', {
          type: 'button',
          text: isSignup ? 'Sign in' : 'Create one',
          onclick: () => { mode = isSignup ? 'signin' : 'signup'; render(); },
        })
      ),
      el('p.hint', {
        text: 'Accounts are stored in this browser only — CoinCheck has no server. Use a password you do not reuse elsewhere.',
      })
    );

    identifier.id = 'cc-id';
    card.replaceChildren(form);
    identifier.focus();
  }

  render();
  return root;
}
