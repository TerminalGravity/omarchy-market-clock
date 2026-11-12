# Market Clock for Omarchy

A bar widget for [Omarchy](https://omarchy.org) that shows where the US equity
session is and how long until the next bell:

| Bar text | Meaning |
|---|---|
| `PRE 1h30m` | Pre-market (04:00–09:30 ET), time until the open |
| `OPEN 2h14m` | Regular session, time until the close (13:00 ET on early-close days) |
| `AH 3h05m` | After-hours (16:00–20:00 ET, or 13:00–17:00 on early-close days), time until it ends |
| `CLOSED` | Weekend, holiday, or overnight; the tooltip says when it next opens |

The widget turns the theme's urgent colour in the last 15 minutes before the
close (configurable). That's useful if you trade 0DTE options or manage
anything into the bell. The tooltip also flags holidays, early closes, and
monthly options expiration (the third Friday, moved to Thursday when that
Friday is an exchange holiday).

Everything is computed locally from the system clock and the NYSE calendar
built into `Model.js`. It makes no network calls, needs no API keys, and has no
dependencies beyond Omarchy itself.

**Mouse:** left click switches between the countdown and New York time
(`OPEN 14:46 ET`). Right click sends the full status as a desktop
notification. Middle click recomputes.

## Install

Requires Omarchy with the Quickshell desktop (`omarchy-shell`, the "Quattro"
line), which has the `omarchy plugin` commands.

```bash
omarchy plugin add https://github.com/TerminalGravity/omarchy-market-clock.git --enable
```

This is Omarchy's own installer. It warns that plugins run unsandboxed, clones
the repo into `~/.config/omarchy/plugins/io.github.terminalgravity.market-clock/`,
validates the manifest, and asks where on the bar to put the widget. You can
also use the menu: **Setup › Plugins › Add**.

Or, from a clone of this repo:

```bash
./install.sh            # same as above, non-interactive; re-running it updates
./install.sh --local    # copy this working tree instead of cloning from GitHub
./install.sh --dry-run  # show what it would do
```

Move it with `omarchy bar move io.github.terminalgravity.market-clock --section left`,
or drag it on the bar.

## Update and remove

```bash
omarchy plugin update io.github.terminalgravity.market-clock   # shows the diff first
omarchy plugin remove io.github.terminalgravity.market-clock   # or ./uninstall.sh
```

Removing a git install deletes the checkout. A `--local` copy is moved to a
timestamped backup inside `~/.config/omarchy/plugins/` instead, which is
Omarchy's rule for folders that aren't git checkouts.

Both scripts only call Omarchy's own plugin commands. They touch nothing outside
`~/.config/omarchy/plugins/` and the bar layout in `~/.config/omarchy/shell.json`,
never write to `$OMARCHY_PATH` / `~/.local/share/omarchy`, and never use sudo.
Running either one twice is safe.

## Settings

Set these in the widget's entry in `~/.config/omarchy/shell.json`, or with
`omarchy bar set`, for example
`omarchy bar set io.github.terminalgravity.market-clock urgentMinutes 30 --json`:

| Key | Default | |
|---|---|---|
| `mode` | `"countdown"` | `"countdown"` or `"clock"` (New York time) |
| `extendedHours` | `true` | Show pre-market and after-hours. When `false`, anything outside 09:30–16:00 reads `CLOSED` |
| `urgentMinutes` | `15` | Highlight this many minutes before the close; `0` turns it off |
| `hideWhenClosed` | `false` | Hide the widget entirely while the market is closed |

## Assumptions and limits

- **Market:** US equities, NYSE/Nasdaq calendar. Regular hours are 09:30–16:00
  ET. Extended hours use the widest common window, 04:00–09:30 and 16:00–20:00
  ET (NYSE Arca). Your broker's extended-hours window may be narrower.
- **Holidays and early closes** come from the
  [NYSE holiday table](https://www.nyse.com/markets/hours-calendars) and cover
  **2026–2028**. After 2028 weekends are still handled but holidays are not,
  and the tooltip says the calendar needs updating. Unscheduled closures
  (national days of mourning, emergencies) can't be known in advance.
- **Options:** the close countdown targets 16:00 ET (13:00 on early closes).
  Some index and ETF options keep trading until 16:15 ET (13:15 on early
  closes); that window isn't modelled. Monthly expiration is the standard
  third-Friday rule. Weekly and daily expirations aren't flagged, since index
  options now expire every weekday.
- **Time zone:** US Eastern time, including DST, is computed from UTC, so the
  widget is correct whatever your machine's time zone is. It relies on your
  system clock being accurate.
- On a vertical bar the widget shrinks to the first letter of its state
  (`P`/`O`/`A`/`C`); the tooltip has the details.

## Development

```bash
node test/model-test.js                 # session logic, DST, holidays, expiration, labels
omarchy plugin validate .               # the shell's manifest checks
./install.sh --local                    # then edit; saving reloads the plugin live
```

`Model.js` holds pure functions with no QML types, so the same file runs under
Node for tests and under the shell's QML engine.

## How Omarchy extensibility works (research notes)

These notes were checked against `omacom/omarchy` at commit
[`ac6cb9c`](https://github.com/omacom/omarchy/commit/ac6cb9c712848741f994d7ecbaccdbab90b526e8) (2026-11-12,
branch `quattro`). `basecamp/omarchy` redirects there.

**There is a formal plugin API, and it's QML.** Since the Quattro line, the
whole desktop (bar, panels, menu, lock screen, notifications) runs as plugins
inside one long-lived [Quickshell](https://quickshell.org) process,
`omarchy-shell`. Third-party plugins are git repos with a `manifest.json`
(`schemaVersion: 1`, `id`, `name`, `version`, `kinds`, `entryPoints`).
The kinds are `bar-widget`, `panel`, `overlay`, `menu`, `service` and `bar`.
User plugins live in `~/.config/omarchy/plugins/<id>/`, and the `omarchy.*`
id namespace is reserved for built-ins. Sources:
[manual: Shell Plugins](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/manual/32-shell-plugins.md),
[docs/omarchy-shell.md](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/docs/omarchy-shell.md),
[shell/plugins/bar/README.md](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/shell/plugins/bar/README.md),
[shell/services/PluginRegistry.qml](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/shell/services/PluginRegistry.qml).

- **Lifecycle CLI:** `omarchy plugin add|update|remove|enable|disable|clone|validate|list`
  ([`bin/omarchy-plugin-*`](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/bin)). `add` clones, validates and moves
  the repo into place. It never runs code from the plugin or uses sudo. `update`
  fast-forwards after showing a diff and rolls back if validation fails. The
  enabled state and bar placement are stored in `~/.config/omarchy/shell.json`.
- **Isolation:** third-party plugins get capability-scoped facades instead of
  host objects. For example, [`shell/Ui/PluginBarApi.qml`](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/shell/Ui/PluginBarApi.qml)
  exposes `run()`, tooltips, popouts and theme colours. The docs are explicit
  that this is not a sandbox: plugin code runs with the user's full permissions.
- **Distribution:** a public git repo, optionally listed at
  [plugins.omarchy.org](https://plugins.omarchy.org)
  ([marketplace repo](https://github.com/omacom/omarchy-plugin-marketplace)).

**Lighter-weight extension points** (no QML needed):

| Mechanism | Path | Source |
|---|---|---|
| Menu entries (JSONC, merged over the defaults, hot-reloaded) | `~/.config/omarchy/extensions/omarchy-menu.jsonc` | [docs/menu.md](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/docs/menu.md), [sample](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/config/omarchy/extensions/omarchy-menu.jsonc) |
| Bar command modules (stdout text or Waybar-style JSON) and ad-hoc QML modules | `bar.layout` in `shell.json`, `~/.config/omarchy/bar/modules/*.qml` | [bar README](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/shell/plugins/bar/README.md#custom-user-modules) |
| Hooks: `post-update`, `theme-set`, `font-set`, `post-boot`, `battery-low`, `pre-refresh-pacman` | `~/.config/omarchy/hooks/<name>` or `<name>.d/*`, run by `omarchy-hook` | [`bin/omarchy-hook`](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/bin/omarchy-hook), [`bin/omarchy-hook-install`](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/bin/omarchy-hook-install), [samples](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/config/omarchy/hooks) |
| Themes from git | `~/.config/omarchy/themes/<name>/` via `omarchy theme install <url>` | [`bin/omarchy-theme-install`](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/bin/omarchy-theme-install), [docs/theming.md](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/docs/theming.md) |
| Hyprland user config (now Lua) | `~/.config/hypr/*.lua` (`bindings.lua`, `input.lua`, …) | [config/hypr](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/config/hypr) |
| Clone and modify a built-in | `omarchy plugin clone omarchy.clock` → `~/.config/omarchy/plugins/<user>.clock` | [manual](https://github.com/omacom/omarchy/blob/ac6cb9c712848741f994d7ecbaccdbab90b526e8/manual/32-shell-plugins.md) |

The rule across all of these is the same: never edit `$OMARCHY_PATH`
(`~/.local/share/omarchy` or the packaged `/usr/share/omarchy`), because
updates overwrite it. Everything personal belongs under `~/.config`.

**Languages and tools:** the shell and plugins use QML/JavaScript (Qt 6,
Quickshell). The CLI, hooks and menu actions are Bash, using `gum` for terminal
prompts and `omarchy-menu-select` for in-shell pickers. Walker and Waybar
were replaced by the shell's menu and bar. Configs are JSON/JSONC
(`shell.json`, menu extensions), TOML (theme `colors.toml` / `shell.toml`)
and Lua (Hyprland).

## License

MIT
