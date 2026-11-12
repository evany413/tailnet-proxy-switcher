# Tailnet Proxy Switcher

A Manifest V3 Chrome extension that switches the current Chrome profile between a direct connection and user-defined SOCKS5 proxies.

It works especially well with private networks such as Tailscale, allowing Chrome to use another device as its internet exit without changing the system-wide route.

## Features

- Add SOCKS5 proxies by hostname or IP address
- Use Tailscale MagicDNS device names
- Save and switch between multiple proxy hosts
- Return to a direct connection at any time
- Restrict non-proxied WebRTC UDP while a proxy is active
- Store all configuration locally in Chrome extension storage

No proxy hosts are included by default.

## Install

1. Download or clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked**.
5. Choose the project directory.

## Usage

1. Select the extension icon in the Chrome toolbar.
2. Select **Add host**.
3. Enter a display name, hostname or IP address, and SOCKS5 port.
4. Select the saved proxy from the dropdown menu.
5. Select **Apply connection**.

Example:

```text
Display name: Home proxy
Host: my-tailnet-proxy
Port: 1080
```

Select **Direct | No proxy** to clear the proxy setting applied by this extension.

## Compatible proxy servers

The extension works with any reachable, unauthenticated SOCKS5 server. Examples include:

- [GOST](https://github.com/go-gost/gost)
- [3proxy](https://github.com/3proxy/3proxy)
- [Dante](https://www.inet.no/dante/)
- OpenSSH dynamic forwarding with `ssh -D`

Chrome does not support username/password authentication for SOCKS5 proxies. Protect access with a private network, firewall rules, or an equivalent access-control layer.

## Example: Tailscale with GOST

One practical setup is to run GOST on another device in the same Tailnet:

```text
Chrome
  |
  | SOCKS5 over Tailscale
  v
Device running GOST
  |
  v
Internet
```

Install and authenticate [Tailscale](https://tailscale.com/download) on both devices, then install GOST on the device that should provide the internet exit.

Start a SOCKS5 server on its Tailscale IP:

```sh
gost -L "socks5://<tailscale-ip>:1080"
```

Test it from the computer running Chrome:

```sh
curl --proxy "socks5h://<tailscale-device-name-or-ip>:1080" "https://ipinfo.io/json"
```

Then add the same device name or IP address and port to the extension.

For installation, service management, Docker, and advanced resolver options, refer to the [GOST documentation](https://gost.run/en/) and [Tailscale documentation](https://tailscale.com/docs/).

## Permissions

The extension requests:

- `proxy` to configure Chrome SOCKS5 settings
- `storage` to save proxy hosts locally
- `privacy` to restrict non-proxied WebRTC UDP while a proxy is active

## Limitations

- Proxy settings apply to the entire Chrome profile, not an individual tab.
- Chrome only proxies TCP-based URL requests through SOCKS5.
- Chrome does not support SOCKS5 username/password authentication.
- The extension does not install or manage Tailscale or the SOCKS5 server.

## Privacy

- Saved hosts are stored locally with `chrome.storage.local`.
- The extension does not send configuration or browsing data to an external service.
- No analytics or telemetry is included.

## License

Licensed under the [MIT License](LICENSE).
